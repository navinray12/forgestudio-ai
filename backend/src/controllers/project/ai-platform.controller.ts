/**
 * Project controller: Modules 19–23: Forge AI Platform (gateway, tools, coding agent, creator, website agent).
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Modules 19–24: Forge AI Platform & MCP Handlers
// ---------------------------------------------------------------------------

export async function aiGatewayCompleteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { aiGatewayService } = await import("../../modules/ai/gateway/aiGateway.service.js");
    const result = await aiGatewayService.complete({
      ...req.body,
      projectId,
      userId: user.id,
    });
    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

export async function aiGatewayModelsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { aiGatewayService } = await import("../../modules/ai/gateway/aiGateway.service.js");
    const provider = req.query.provider as any;
    const models = aiGatewayService.listModels(provider);
    res.status(200).json({ success: true, models });
  } catch (err) {
    next(err);
  }
}

export async function aiGatewayHealthHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { aiGatewayService } = await import("../../modules/ai/gateway/aiGateway.service.js");
    const health = aiGatewayService.getHealth();
    res.status(200).json({ success: true, health });
  } catch (err) {
    next(err);
  }
}

export async function aiGatewayByokHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { aiGatewayService } = await import("../../modules/ai/gateway/aiGateway.service.js");
    const result = await aiGatewayService.registerByok({
      ...req.body,
      projectId,
      userId: user.id,
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function aiGatewayUsageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { aiGatewayService } = await import("../../modules/ai/gateway/aiGateway.service.js");
    const stats = await aiGatewayService.getUsageStats(projectId, user.id);
    res.status(200).json({ success: true, stats });
  } catch (err) {
    next(err);
  }
}

export async function listToolsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { toolExecutionService } = await import("../../modules/ai/tools/toolExecution.service.js");
    const category = req.query.category as string;
    const tools = toolExecutionService.listTools(category);
    res.status(200).json({ success: true, tools });
  } catch (err) {
    next(err);
  }
}

export async function executeToolHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, parameters, sessionId } = req.body;
    const { toolExecutionService } = await import("../../modules/ai/tools/toolExecution.service.js");
    const result = await toolExecutionService.executeTool(name, parameters, {
      projectId,
      userId: user.id,
      sessionId,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function resolveToolApprovalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const { executionId, decision } = req.body;

    const { toolExecutionService } = await import("../../modules/ai/tools/toolExecution.service.js");
    const result = await toolExecutionService.resolveApproval(executionId, decision, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createCodingSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { goal, targetFiles } = req.body;
    const { codingAgentService } = await import("../../modules/ai/coding/codingAgent.service.js");
    const session = await codingAgentService.createSession({
      projectId,
      userId: user.id,
      goal,
      targetFiles,
    });
    res.status(201).json({ success: true, ...session });
  } catch (err) {
    next(err);
  }
}

export async function generateCodingPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const { sessionId } = req.body;

    const { codingAgentService } = await import("../../modules/ai/coding/codingAgent.service.js");
    const plan = await codingAgentService.generatePlan(sessionId);
    res.status(200).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
}

export async function executeCodingPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const { sessionId, planId } = req.body;

    const { codingAgentService } = await import("../../modules/ai/coding/codingAgent.service.js");
    const result = await codingAgentService.executePlan(sessionId, planId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function aiCreatorPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { prompt, framework } = req.body;
    const { aiCreatorService } = await import("../../modules/ai/creator/aiCreator.service.js");
    const plan = await aiCreatorService.generatePlan(prompt, framework);
    res.status(200).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
}

export async function aiCreatorGenerateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const { prompt, framework } = req.body;

    const { aiCreatorService } = await import("../../modules/ai/creator/aiCreator.service.js");
    const result = await aiCreatorService.createFromPrompt(prompt, user.id, framework);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function aiCreatorRegenerateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { targetFilePath, instruction } = req.body;
    const { aiCreatorService } = await import("../../modules/ai/creator/aiCreator.service.js");
    const result = await aiCreatorService.regenerateSection(projectId, targetFilePath, instruction, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function aiWebsiteAuditHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { websiteAgentService } = await import("../../modules/ai/website/websiteAgent.service.js");
    const report = await websiteAgentService.auditProject(projectId);
    res.status(200).json({ success: true, report });
  } catch (err) {
    next(err);
  }
}

export async function aiWebsiteFixHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { findingId } = req.body;
    const { websiteAgentService } = await import("../../modules/ai/website/websiteAgent.service.js");
    const result = await websiteAgentService.fixFinding(projectId, findingId, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
