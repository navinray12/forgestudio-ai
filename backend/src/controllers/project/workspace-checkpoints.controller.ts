/**
 * Project controller: Workspace checkpoints.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getCheckpointState, listCheckpointsAfter } from "../../services/workspace/workspaceCheckpoints.service.js";
import { getAuthUser } from "./shared.js";

/** GET /:id/workspace/checkpoint — durable latest and last synchronized checkpoints. */
export async function getWorkspaceCheckpointHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);
    const state = await getCheckpointState(projectId);
    res.status(200).json({ success: true, ...state });
  } catch (err) {
    next(err);
  }
}

/** GET /:id/workspace/checkpoints?after=N — checkpoints after a sequence, for reconnecting clients. */
export async function listWorkspaceCheckpointsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);
    const checkpoints = await listCheckpointsAfter(projectId, Number(req.query.after) || 0, Number(req.query.limit) || 100);
    res.status(200).json({ success: true, checkpoints });
  } catch (err) {
    next(err);
  }
}
