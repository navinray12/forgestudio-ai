/**
 * ForgeStudio Module 42: Run Manager Service
 * Controls execution attempts, pause/resume/cancel/retry lifecycles, and run comparison.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { planningAgentService } from "../planning/planningAgent.service.js";
import { multiAgentOrchestratorService } from "../orchestrator/multiAgentOrchestrator.service.js";
import { DagEngine } from "../orchestrator/dagEngine.js";
import { DagNode } from "../orchestrator/orchestrator.types.js";
import { eventBusService } from "./eventBus.service.js";
import { artifactManagerService } from "./artifactManager.service.js";
import { RunEntity, RunStepEntity } from "./taskManager.types.js";

const db = prisma as any;

class RunManagerService {
  private activeAbortControllers: Map<string, AbortController> = new Map();
  private pausedRuns: Set<string> = new Set();

  /**
   * Start a new execution run for a task
   */
  public async startRun(taskId: string): Promise<RunEntity> {
    const task = await db.forgeAiTask.findUnique({ where: { id: taskId } });
    if (!task) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");

    // 1. Ensure plan exists
    let plan = task.planId ? await planningAgentService.getPlan(task.planId) : null;
    if (!plan) {
      // Auto-generate plan if not already created
      plan = await planningAgentService.generatePlan({
        projectId: task.projectId,
        taskId: task.id,
        objective: task.objective,
      });
      await db.forgeAiTask.update({
        where: { id: taskId },
        data: { planId: plan.id },
      });
    }

    // 2. Count existing runs to calculate attemptNumber
    const existingRunsCount = await db.forgeAiRun.count({ where: { taskId } });
    const attemptNumber = existingRunsCount + 1;

    // 3. Create new Run record
    const run = await db.forgeAiRun.create({
      data: {
        taskId,
        projectId: task.projectId,
        attemptNumber,
        status: "RUNNING",
        orchestrationPlan: { planId: plan.id, stepCount: plan.steps.length },
        startedAt: new Date(),
      },
    });

    // Update activeRunId on task
    await db.forgeAiTask.update({
      where: { id: taskId },
      data: { activeRunId: run.id, status: "RUNNING" },
    });

    // 4. Create RunStep records
    const stepRecords: any[] = [];
    for (let i = 0; i < plan.steps.length; i++) {
      const s = plan.steps[i];
      const stepRec = await db.forgeAiRunStep.create({
        data: {
          runId: run.id,
          stepKey: s.id,
          agentId: s.agentRole,
          title: s.title,
          orderIndex: s.order,
          dependencies: s.dependencies,
          status: "PENDING",
          inputPayload: { targetFiles: s.targetFiles, action: s.action },
        },
      });
      stepRecords.push(stepRec);
    }

    await eventBusService.emitEvent({
      projectId: task.projectId,
      taskId: task.id,
      runId: run.id,
      eventType: "STEP_STARTED",
      payload: { attemptNumber, totalSteps: plan.steps.length },
    });

    // 5. Launch execution loop asynchronously
    const abortController = new AbortController();
    this.activeAbortControllers.set(run.id, abortController);
    this.pausedRuns.delete(run.id);

    void this.executeRunLoop(run.id, task.projectId, task.id, task.objective, plan.steps);

    return run;
  }

  /**
   * Internal DAG Execution Loop
   */
  private async executeRunLoop(
    runId: string,
    projectId: string,
    taskId: string,
    objective: string,
    rawSteps: any[]
  ): Promise<void> {
    const startTime = Date.now();
    const abortController = this.activeAbortControllers.get(runId);

    // Convert to DAG nodes
    let dagNodes: DagNode[] = rawSteps.map((s) => ({
      id: s.id,
      agentRole: s.agentRole,
      title: s.title,
      dependencies: s.dependencies || [],
      status: "PENDING",
      input: {
        taskId,
        runId,
        stepId: s.id,
        projectId,
        objective: s.description || s.title,
        targetFiles: s.targetFiles,
        context: null as any,
      },
    }));

    let lastOutput: any = null;
    let lastRole: any = null;

    try {
      while (!DagEngine.isComplete(dagNodes)) {
        // Check for pause
        if (this.pausedRuns.has(runId)) {
          await db.forgeAiRun.update({
            where: { id: runId },
            data: { status: "PAUSED" },
          });
          await db.forgeAiTask.update({
            where: { id: taskId },
            data: { status: "PAUSED" },
          });
          await eventBusService.emitEvent({
            projectId,
            taskId,
            runId,
            eventType: "RUN_PAUSED",
            payload: { message: "Execution paused at safe checkpoint." },
          });
          return;
        }

        // Check for cancellation
        if (abortController?.signal.aborted) {
          await db.forgeAiRun.update({
            where: { id: runId },
            data: { status: "CANCELLED", completedAt: new Date() },
          });
          await db.forgeAiTask.update({
            where: { id: taskId },
            data: { status: "CANCELLED" },
          });
          await eventBusService.emitEvent({
            projectId,
            taskId,
            runId,
            eventType: "RUN_CANCELLED",
            payload: { message: "Execution cancelled by user." },
          });
          return;
        }

        // Get ready nodes
        const readyNodes = DagEngine.getReadyNodes(dagNodes);
        if (readyNodes.length === 0) {
          if (DagEngine.hasFailure(dagNodes) || DagEngine.isDeadlocked(dagNodes)) {
            break;
          }
          // Brief backoff
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }

        // Execute ready nodes
        for (const node of readyNodes) {
          node.status = "RUNNING";

          await db.forgeAiRunStep.updateMany({
            where: { runId, stepKey: node.id },
            data: { status: "RUNNING", startedAt: new Date() },
          });

          await eventBusService.emitEvent({
            projectId,
            taskId,
            runId,
            eventType: "AGENT_STARTED",
            agentId: node.agentRole,
            stepId: node.id,
            payload: { stepTitle: node.title },
          });

          const stepStart = Date.now();
          const output = await multiAgentOrchestratorService.executeAgentStep(runId, node, {
            projectId,
            taskId,
            objective,
            previousAgentRole: lastRole,
            previousOutput: lastOutput,
          });
          const stepDuration = Date.now() - stepStart;

          node.output = output;
          lastOutput = output;
          lastRole = node.agentRole;

          // Record artifacts
          if (output.artifacts && output.artifacts.length > 0) {
            for (const art of output.artifacts) {
              await artifactManagerService.recordArtifact({
                projectId,
                taskId,
                runId,
                stepId: node.id,
                type: art.type,
                name: art.name,
                data: art.data,
              });
            }
          }

          if (output.status === "COMPLETED") {
            node.status = "COMPLETED";
            await db.forgeAiRunStep.updateMany({
              where: { runId, stepKey: node.id },
              data: {
                status: "COMPLETED",
                outputPayload: output,
                durationMs: stepDuration,
                completedAt: new Date(),
              },
            });

            await eventBusService.emitEvent({
              projectId,
              taskId,
              runId,
              eventType: "STEP_COMPLETED",
              agentId: node.agentRole,
              stepId: node.id,
              payload: { summary: output.summary },
            });
          } else {
            node.status = "FAILED";
            await db.forgeAiRunStep.updateMany({
              where: { runId, stepKey: node.id },
              data: {
                status: "FAILED",
                errorMessage: output.errorMessage || "Agent execution failed",
                durationMs: stepDuration,
                completedAt: new Date(),
              },
            });

            await eventBusService.emitEvent({
              projectId,
              taskId,
              runId,
              eventType: "STEP_FAILED",
              agentId: node.agentRole,
              stepId: node.id,
              payload: { error: output.errorMessage },
            });
            break;
          }
        }
      }

      // Conclude Run
      const durationMs = Date.now() - startTime;
      const allPassed = DagEngine.isComplete(dagNodes);

      await db.forgeAiRun.update({
        where: { id: runId },
        data: {
          status: allPassed ? "COMPLETED" : "FAILED",
          totalDurationMs: durationMs,
          completedAt: new Date(),
        },
      });

      await db.forgeAiTask.update({
        where: { id: taskId },
        data: { status: allPassed ? "COMPLETED" : "FAILED" },
      });

      await eventBusService.emitEvent({
        projectId,
        taskId,
        runId,
        eventType: allPassed ? "RUN_COMPLETED" : "RUN_FAILED",
        payload: { durationMs, allPassed },
      });
    } catch (err: any) {
      console.error("[RunManager] Run loop crashed:", err);
      await db.forgeAiRun.update({
        where: { id: runId },
        data: { status: "FAILED", errorMessage: err?.message || "Execution exception", completedAt: new Date() },
      });
      await db.forgeAiTask.update({
        where: { id: taskId },
        data: { status: "FAILED" },
      });
    } finally {
      this.activeAbortControllers.delete(runId);
      this.pausedRuns.delete(runId);
    }
  }

  /**
   * Pause execution at next safe checkpoint
   */
  public async pauseRun(runId: string): Promise<RunEntity> {
    const run = await db.forgeAiRun.findUnique({ where: { id: runId } });
    if (!run) throw new AppError("Run not found", 404, "RUN_NOT_FOUND");
    if (run.status !== "RUNNING") {
      throw new AppError(`Cannot pause run with status '${run.status}'`, 400, "CANNOT_PAUSE");
    }

    this.pausedRuns.add(runId);
    return await db.forgeAiRun.update({
      where: { id: runId },
      data: { status: "PAUSED" },
    });
  }

  /**
   * Resume paused run
   */
  public async resumeRun(runId: string): Promise<RunEntity> {
    const run = await db.forgeAiRun.findUnique({ where: { id: runId } });
    if (!run) throw new AppError("Run not found", 404, "RUN_NOT_FOUND");
    if (run.status !== "PAUSED") {
      throw new AppError(`Cannot resume run with status '${run.status}'`, 400, "CANNOT_RESUME");
    }

    const task = await db.forgeAiTask.findUnique({ where: { id: run.taskId } });
    const plan = await planningAgentService.getPlan(task.planId);

    this.pausedRuns.delete(runId);
    const abortController = new AbortController();
    this.activeAbortControllers.set(run.id, abortController);

    await db.forgeAiRun.update({
      where: { id: runId },
      data: { status: "RUNNING" },
    });
    await db.forgeAiTask.update({
      where: { id: run.taskId },
      data: { status: "RUNNING" },
    });

    await eventBusService.emitEvent({
      projectId: run.projectId,
      taskId: run.taskId,
      runId,
      eventType: "RUN_RESUMED",
      payload: { message: "Execution resumed." },
    });

    void this.executeRunLoop(run.id, run.projectId, task.id, task.objective, plan?.steps || []);

    return run;
  }

  /**
   * Cancel in-flight run
   */
  public async cancelRun(runId: string): Promise<RunEntity> {
    const run = await db.forgeAiRun.findUnique({ where: { id: runId } });
    if (!run) throw new AppError("Run not found", 404, "RUN_NOT_FOUND");

    const controller = this.activeAbortControllers.get(runId);
    if (controller) {
      controller.abort();
    }
    this.pausedRuns.delete(runId);

    const updated = await db.forgeAiRun.update({
      where: { id: runId },
      data: { status: "CANCELLED", completedAt: new Date() },
    });

    await db.forgeAiTask.update({
      where: { id: run.taskId },
      data: { status: "CANCELLED" },
    });

    await eventBusService.emitEvent({
      projectId: run.projectId,
      taskId: run.taskId,
      runId,
      eventType: "RUN_CANCELLED",
      payload: { message: "Cancelled by user." },
    });

    return updated;
  }

  /**
   * Retry failed run (creates next attempt)
   */
  public async retryRun(runId: string): Promise<RunEntity> {
    const run = await db.forgeAiRun.findUnique({ where: { id: runId } });
    if (!run) throw new AppError("Run not found", 404, "RUN_NOT_FOUND");

    return await this.startRun(run.taskId);
  }

  /**
   * Fetch run details with steps
   */
  public async getRun(runId: string): Promise<any> {
    const run = await db.forgeAiRun.findUnique({ where: { id: runId } });
    if (!run) return null;

    const steps = await db.forgeAiRunStep.findMany({
      where: { runId },
      orderBy: { orderIndex: "asc" },
    });

    return { ...run, steps };
  }

  /**
   * Compare two execution runs
   */
  public async compareRuns(runIdA: string, runIdB: string): Promise<any> {
    const runA = await this.getRun(runIdA);
    const runB = await this.getRun(runIdB);
    if (!runA || !runB) throw new AppError("One or both runs not found", 404, "RUN_NOT_FOUND");

    return {
      runA: {
        id: runA.id,
        attempt: runA.attemptNumber,
        status: runA.status,
        durationMs: runA.totalDurationMs,
        stepsCount: runA.steps?.length || 0,
        completedSteps: runA.steps?.filter((s: any) => s.status === "COMPLETED").length || 0,
      },
      runB: {
        id: runB.id,
        attempt: runB.attemptNumber,
        status: runB.status,
        durationMs: runB.totalDurationMs,
        stepsCount: runB.steps?.length || 0,
        completedSteps: runB.steps?.filter((s: any) => s.status === "COMPLETED").length || 0,
      },
      durationDifferenceMs: runB.totalDurationMs - runA.totalDurationMs,
      statusMatch: runA.status === runB.status,
    };
  }
}

export const runManagerService = new RunManagerService();
