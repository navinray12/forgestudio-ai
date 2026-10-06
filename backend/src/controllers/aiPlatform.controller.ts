/**
 * ForgeStudio Modules 37–42: AI Engineering Platform Controller
 */

import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../services/project/forgeProject.service.js";
import { contextEngineService } from "../modules/ai/context/contextEngine.service.js";
import { projectMemoryService } from "../modules/ai/memory/projectMemory.service.js";
import { planningAgentService } from "../modules/ai/planning/planningAgent.service.js";
import { architectureAgentService } from "../modules/ai/architecture/architectureAgent.service.js";
import { taskManagerService } from "../modules/ai/task-manager/taskManager.service.js";
import { runManagerService } from "../modules/ai/task-manager/runManager.service.js";
import { eventBusService } from "../modules/ai/task-manager/eventBus.service.js";
import { artifactManagerService } from "../modules/ai/task-manager/artifactManager.service.js";

function getAuthUser(res: Response, req: Request) {
  const user = res.locals.user || (req as any).user;
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

// ==========================================
// Module 37: Context Engine Endpoints
// ==========================================

export async function assembleContextHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const snapshot = await contextEngineService.assembleContext({
      ...req.body,
      projectId,
      userId: user.id,
    });

    res.status(200).json({ success: true, snapshot });
  } catch (err) {
    next(err);
  }
}

export async function getContextSnapshotHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const snapshot = await contextEngineService.getSnapshot(String(req.params.snapshotId));
    res.status(200).json({ success: true, snapshot });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// Module 38: Project Memory Endpoints
// ==========================================

export async function createMemoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const memory = await projectMemoryService.createMemory({
      ...req.body,
      projectId,
      createdBy: user.id,
    });

    res.status(201).json({ success: true, memory });
  } catch (err) {
    next(err);
  }
}

export async function listMemoriesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const memories = await projectMemoryService.listMemories(projectId, {
      type: req.query.type ? String(req.query.type) : undefined,
      status: req.query.status ? (String(req.query.status) as any) : undefined,
      severity: req.query.severity ? String(req.query.severity) : undefined,
      search: req.query.q ? String(req.query.q) : undefined,
    });

    res.status(200).json({ success: true, memories });
  } catch (err) {
    next(err);
  }
}

export async function getMemoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const memory = await projectMemoryService.getMemory(String(req.params.memoryId));
    res.status(200).json({ success: true, memory });
  } catch (err) {
    next(err);
  }
}

export async function updateMemoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const memory = await projectMemoryService.updateMemory(String(req.params.memoryId), req.body);
    res.status(200).json({ success: true, memory });
  } catch (err) {
    next(err);
  }
}

export async function revokeMemoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const memory = await projectMemoryService.revokeMemory(String(req.params.memoryId), req.body?.reason);
    res.status(200).json({ success: true, memory });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// Module 39: Planning Agent Endpoints
// ==========================================

export async function generatePlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const plan = await planningAgentService.generatePlan({
      ...req.body,
      projectId,
      userId: user.id,
    });

    res.status(201).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
}

export async function getPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const plan = await planningAgentService.getPlan(String(req.params.planId));
    res.status(200).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
}

export async function approvePlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const plan = await planningAgentService.approvePlan(String(req.params.planId), user.id);
    res.status(200).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
}

export async function rejectPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const plan = await planningAgentService.rejectPlan(String(req.params.planId), req.body?.reason || "Rejected by user");
    res.status(200).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// Module 40: Architecture Agent Endpoints
// ==========================================

export async function analyzeArchitectureHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const snapshot = await architectureAgentService.analyzeProjectArchitecture(projectId);
    res.status(200).json({ success: true, snapshot });
  } catch (err) {
    next(err);
  }
}

export async function getArchitectureSnapshotHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const snapshot = await architectureAgentService.getLatestSnapshot(projectId);
    res.status(200).json({ success: true, snapshot });
  } catch (err) {
    next(err);
  }
}

export async function listArchitectureFindingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const findings = await architectureAgentService.listFindings(projectId);
    res.status(200).json({ success: true, findings });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// Module 42: Task & Run Manager Endpoints
// ==========================================

export async function createTaskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const task = await taskManagerService.createTask({
      ...req.body,
      projectId,
      userId: user.id,
    });

    res.status(201).json({ success: true, task });
  } catch (err) {
    next(err);
  }
}

export async function listTasksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const tasks = await taskManagerService.listTasks(projectId, {
      status: req.query.status ? (String(req.query.status) as any) : undefined,
    });

    res.status(200).json({ success: true, tasks });
  } catch (err) {
    next(err);
  }
}

export async function getTaskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const task = await taskManagerService.getTask(String(req.params.taskId));
    res.status(200).json({ success: true, task });
  } catch (err) {
    next(err);
  }
}

export async function startRunHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const run = await runManagerService.startRun(String(req.params.taskId));
    res.status(201).json({ success: true, run });
  } catch (err) {
    next(err);
  }
}

export async function getRunHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const run = await runManagerService.getRun(String(req.params.runId));
    res.status(200).json({ success: true, run });
  } catch (err) {
    next(err);
  }
}

export async function pauseRunHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const run = await runManagerService.pauseRun(String(req.params.runId));
    res.status(200).json({ success: true, run });
  } catch (err) {
    next(err);
  }
}

export async function resumeRunHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const run = await runManagerService.resumeRun(String(req.params.runId));
    res.status(200).json({ success: true, run });
  } catch (err) {
    next(err);
  }
}

export async function cancelRunHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const run = await runManagerService.cancelRun(String(req.params.runId));
    res.status(200).json({ success: true, run });
  } catch (err) {
    next(err);
  }
}

export async function retryRunHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const run = await runManagerService.retryRun(String(req.params.runId));
    res.status(201).json({ success: true, run });
  } catch (err) {
    next(err);
  }
}

export async function compareRunsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const comparison = await runManagerService.compareRuns(
      String(req.params.runId),
      String(req.params.otherRunId)
    );
    res.status(200).json({ success: true, comparison });
  } catch (err) {
    next(err);
  }
}

export async function getRunEventsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const events = await eventBusService.getRunEvents(String(req.params.runId));
    res.status(200).json({ success: true, events });
  } catch (err) {
    next(err);
  }
}

export async function streamRunEventsHandler(req: Request, res: Response) {
  const runId = String(req.params.runId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  eventBusService.addSubscriber(runId, res);
  res.write(`data: ${JSON.stringify({ event: "connected", runId })}\n\n`);
}

export async function listArtifactsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const artifacts = await artifactManagerService.listArtifacts(String(req.params.runId));
    res.status(200).json({ success: true, artifacts });
  } catch (err) {
    next(err);
  }
}
