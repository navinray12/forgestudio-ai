/**
 * Project controller: Module 14: Terminal.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Module 14: Terminal
// ---------------------------------------------------------------------------

export async function createTerminalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name } = req.body;
    const { forgeTerminalService } = await import("../../services/terminal/forgeTerminal.service.js");
    const session = await forgeTerminalService.createTerminalSession(projectId, name);
    res.status(201).json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function executeTerminalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const sessionId = String(req.params.sessionId);
    const { command, confirmedByUser } = req.body;

    const { forgeTerminalService } = await import("../../services/terminal/forgeTerminal.service.js");
    const result = await forgeTerminalService.executeTerminalCommand(sessionId, command, {
      userId: user.id,
      userRole: user.role,
      confirmedByUser,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getTerminalTasksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeTerminalService } = await import("../../services/terminal/forgeTerminal.service.js");
    const tasks = await forgeTerminalService.getManifestTasks(projectId);
    res.status(200).json({ success: true, tasks });
  } catch (err) {
    next(err);
  }
}
