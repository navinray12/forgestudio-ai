/**
 * Project controller: Module 15: Debugging.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Module 15: Debugging
// ---------------------------------------------------------------------------

export async function startDebugSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { target } = req.body;
    const { forgeDebugService } = await import("../../services/debug/forgeDebug.service.js");
    const session = await forgeDebugService.startDebugSession(projectId, target);
    res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function setBreakpointHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = String(req.params.sessionId);
    const { forgeDebugService } = await import("../../services/debug/forgeDebug.service.js");
    const bp = await forgeDebugService.setBreakpoint(sessionId, req.body);
    res.status(200).json({ success: true, breakpoint: bp });
  } catch (err) {
    next(err);
  }
}

export async function removeBreakpointHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = String(req.params.sessionId);
    const bpId = String(req.params.bpId);
    const { forgeDebugService } = await import("../../services/debug/forgeDebug.service.js");
    const removed = await forgeDebugService.removeBreakpoint(sessionId, bpId);
    res.status(200).json({ success: true, removed });
  } catch (err) {
    next(err);
  }
}

export async function stepDebugHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = String(req.params.sessionId);
    const { forgeDebugService } = await import("../../services/debug/forgeDebug.service.js");
    const session = forgeDebugService.stepOver(sessionId);
    res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function askAiDebugHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = String(req.params.sessionId);
    const { errorMessage, sourceFile, line } = req.body;
    const { forgeDebugService } = await import("../../services/debug/forgeDebug.service.js");
    const result = forgeDebugService.askAiToDebug({
      sessionId,
      errorMessage: errorMessage || "Unknown runtime exception",
      sourceFile: sourceFile || "src/App.tsx",
      line: line || 1,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
