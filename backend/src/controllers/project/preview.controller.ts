/**
 * Project controller: Module 13: Live Preview.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Module 13: Live Preview
// ---------------------------------------------------------------------------

export async function createPreviewSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { viewport, route } = req.body;
    const { forgePreviewService } = await import("../../services/preview/forgePreview.service.js");
    const session = await forgePreviewService.createPreviewSession(projectId, { viewport, route });
    res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function updatePreviewViewportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionToken = String(req.params.token);
    const { viewport } = req.body;
    const { forgePreviewService } = await import("../../services/preview/forgePreview.service.js");
    const session = await forgePreviewService.updatePreviewViewport(sessionToken, viewport);
    res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function logPreviewConsoleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionToken = String(req.params.token);
    const { forgePreviewService } = await import("../../services/preview/forgePreview.service.js");
    forgePreviewService.appendPreviewConsoleMessage(sessionToken, req.body);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}
