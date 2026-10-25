/**
 * Project controller: Module 24: Model Context Protocol (MCP).
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

export async function listMcpServersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { mcpRegistryService } = await import("../../modules/ai/mcp/mcpRegistry.service.js");
    const servers = await mcpRegistryService.listServers(projectId);
    res.status(200).json({ success: true, servers });
  } catch (err) {
    next(err);
  }
}

export async function registerMcpServerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { mcpRegistryService } = await import("../../modules/ai/mcp/mcpRegistry.service.js");
    const server = await mcpRegistryService.registerServer({
      ...req.body,
      projectId,
      userId: user.id,
    });
    res.status(201).json({ success: true, server });
  } catch (err) {
    next(err);
  }
}

export async function mcpJsonRpcHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeMcpServerService } = await import("../../modules/ai/mcp/mcpServer.service.js");
    const result = await forgeMcpServerService.handleJsonRpc(req.body, projectId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function mcpInvokeToolHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { serverId, toolName, arguments: args } = req.body;
    const { mcpClientService } = await import("../../modules/ai/mcp/mcpClient.service.js");
    const result = await mcpClientService.invokeTool(serverId, toolName, args, {
      projectId,
      userId: user.id,
    });
    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

export async function mcpScaffoldHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const name = String(req.query.name || "CustomServer");
    const { mcpRegistryService } = await import("../../modules/ai/mcp/mcpRegistry.service.js");
    const files = mcpRegistryService.generateServerScaffolding(name);
    res.status(200).json({ success: true, files });
  } catch (err) {
    next(err);
  }
}
