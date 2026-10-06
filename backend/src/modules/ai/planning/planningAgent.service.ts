/**
 * ForgeStudio Module 39: AI Planning Agent Service
 * Produces structured, risk-assessed, executable implementation plans before high-impact changes.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { aiGatewayService } from "../gateway/aiGateway.service.js";
import { contextEngineService } from "../context/contextEngine.service.js";
import { projectMemoryService } from "../memory/projectMemory.service.js";
import { impactAnalysisService } from "./impactAnalysis.service.js";
import {
  GeneratePlanRequest,
  PlanEntity,
  PlanStepItem,
  PlanStatus,
} from "./planning.types.js";

const db = prisma as any;

export class PlanningAgentService {
  /**
   * Generate an end-to-end implementation plan with impact analysis & DAG steps
   */
  public async generatePlan(req: GeneratePlanRequest): Promise<PlanEntity> {
    const { projectId, taskId, userId, objective, targetFiles = [], constraints = [] } = req;

    if (!projectId || !objective) {
      throw new AppError("projectId and objective are required to generate a plan", 400, "INVALID_PLAN_REQUEST");
    }

    // 1. Gather rich context via Module 37 (PlanningAgentContext profile)
    const contextSnapshot = await contextEngineService.assembleContext({
      projectId,
      taskId,
      userId,
      objective,
      files: targetFiles,
      contextProfile: "PlanningAgentContext",
      tokenBudget: 24000,
    });

    // 2. Perform impact analysis & risk detection
    const impact = await impactAnalysisService.analyzeImpact({
      projectId,
      objective,
      suggestedFiles: targetFiles,
    });

    // 3. Retrieve relevant project memories via Module 38
    const memories = await projectMemoryService.listMemories(projectId, { status: "ACTIVE" });
    const memoryRules = memories.map((m) => `[${m.type} | ${m.severity}] ${m.title}: ${m.content}`);

    // 4. Generate structured plan steps with AI Gateway
    const prompt = `Objective: "${objective}"\nRisk Level: ${impact.riskLevel}\nFiles likely affected: ${JSON.stringify(
      impact.predictedFiles
    )}\nProject Rules:\n${memoryRules.join("\n")}\nContext Summary: ${contextSnapshot.explainability.rationale.join(" ")}`;

    let generatedPlanData: any = null;
    try {
      const aiRes = await aiGatewayService.complete({
        task: "planning",
        messages: [{ role: "user", content: prompt }],
        responseFormat: {
          type: "json_schema",
          json_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              assumptions: { type: "array", items: { type: "string" } },
              currentState: { type: "string" },
              targetState: { type: "string" },
              architectureNotes: { type: "string" },
              steps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    agentRole: { type: "string", enum: ["PLANNER", "ARCHITECTURE", "CODING", "TESTING", "REVIEW", "SYNTHESIS"] },
                    action: { type: "string", enum: ["create", "modify", "delete", "test", "build", "verify", "analyze"] },
                    targetFiles: { type: "array", items: { type: "string" } },
                  },
                  required: ["title", "description", "agentRole", "action", "targetFiles"],
                },
              },
              rollbackPlan: { type: "string" },
            },
            required: ["title", "assumptions", "currentState", "targetState", "steps", "rollbackPlan"],
          },
        },
        projectId,
        userId: userId || "system",
      });

      generatedPlanData = aiRes.structuredOutput;
    } catch {
      // Deterministic fallback if AI provider is unreachable
      generatedPlanData = null;
    }

    // 5. Construct well-formed DAG steps
    const stepItems: PlanStepItem[] = [];
    const rawSteps = generatedPlanData?.steps || [
      {
        title: "Architecture & Boundary Check",
        description: `Verify system constraints for objective: ${objective}`,
        agentRole: "ARCHITECTURE",
        action: "analyze",
        targetFiles: impact.predictedFiles.map((f) => f.path),
      },
      {
        title: "Implementation Execution",
        description: `Apply targeted changes for objective: ${objective}`,
        agentRole: "CODING",
        action: "modify",
        targetFiles: impact.predictedFiles.map((f) => f.path),
      },
      {
        title: "Build and Test Verification",
        description: "Run compilation and test suite to ensure zero regressions",
        agentRole: "TESTING",
        action: "test",
        targetFiles: [],
      },
      {
        title: "Synthesis and Artifact Finalization",
        description: "Generate final diff synthesis and verify outcomes",
        agentRole: "SYNTHESIS",
        action: "verify",
        targetFiles: [],
      },
    ];

    let previousStepId = "";
    for (let i = 0; i < rawSteps.length; i++) {
      const s = rawSteps[i];
      const stepId = `step-${i + 1}`;
      stepItems.push({
        id: stepId,
        order: i + 1,
        title: s.title,
        description: s.description,
        agentRole: s.agentRole || "CODING",
        action: s.action || "modify",
        targetFiles: s.targetFiles || [],
        dependencies: previousStepId ? [previousStepId] : [], // Sequential DAG chain by default
        status: "PENDING",
      });
      previousStepId = stepId;
    }

    const title = generatedPlanData?.title || `Implementation Plan: ${objective.slice(0, 50)}`;
    const assumptions = generatedPlanData?.assumptions || [
      "Repository is in clean or recoverable state.",
      "Required dependencies are available.",
    ];
    const currentState = generatedPlanData?.currentState || "Current project state before change.";
    const targetState = generatedPlanData?.targetState || `Target state with objective '${objective}' fulfilled.`;
    const rollbackPlan = generatedPlanData?.rollbackPlan || "Revert via git commit checkpoint or restore previous files snapshot.";

    // 6. Initial status: if high risk, DRAFT requiring approval; if low risk, APPROVED immediately
    const initialStatus: PlanStatus = impact.requiresApproval ? "DRAFT" : "APPROVED";

    const planRecord = await db.forgeAiPlan.create({
      data: {
        projectId,
        taskId: taskId || null,
        title,
        objective,
        assumptions,
        constraints,
        currentState,
        targetState,
        architectureNotes: generatedPlanData?.architectureNotes || impact.backwardCompatibilityImpact,
        affectedFiles: impact.predictedFiles,
        dependencies: [],
        steps: stepItems,
        testStrategy: {
          unitTests: ["npm run test", "runProjectBuild"],
          integrationTests: ["verifyWorkspaceHealth"],
          manualVerificationSteps: ["Inspect diff viewer in Forge Developer Workspace"],
        },
        rollbackPlan,
        riskLevel: impact.riskLevel,
        status: initialStatus,
        version: 1,
      },
    });

    return planRecord;
  }

  /**
   * Retrieve plan by ID
   */
  public async getPlan(planId: string): Promise<PlanEntity | null> {
    return await db.forgeAiPlan.findUnique({ where: { id: planId } });
  }

  /**
   * Human approval gate: Approve plan
   */
  public async approvePlan(planId: string, approvedBy: string): Promise<PlanEntity> {
    const plan = await this.getPlan(planId);
    if (!plan) throw new AppError("Plan not found", 404, "PLAN_NOT_FOUND");

    return await db.forgeAiPlan.update({
      where: { id: planId },
      data: {
        status: "APPROVED",
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Human approval gate: Reject plan
   */
  public async rejectPlan(planId: string, reason: string): Promise<PlanEntity> {
    const plan = await this.getPlan(planId);
    if (!plan) throw new AppError("Plan not found", 404, "PLAN_NOT_FOUND");

    return await db.forgeAiPlan.update({
      where: { id: planId },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        updatedAt: new Date(),
      },
    });
  }
}

export const planningAgentService = new PlanningAgentService();
