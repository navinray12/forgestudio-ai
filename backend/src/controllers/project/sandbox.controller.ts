/**
 * Project controller: Module 11: Sandbox / Runtime.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Module 11: Sandbox / Runtime
// ---------------------------------------------------------------------------

export async function getRuntimeStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeSandboxService } = await import("../../services/runtime/forgeSandbox.service.js");
    const runtime = await forgeSandboxService.getOrCreateRuntimeSession(projectId, "development");
    res.status(200).json({ success: true, runtime });
  } catch (err) {
    next(err);
  }
}

export async function executeSandboxHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { command, args, cwd, env, secrets } = req.body;
    const { forgeSandboxService } = await import("../../services/runtime/forgeSandbox.service.js");
    const result = await forgeSandboxService.executeInSandbox({
      projectId,
      command,
      args,
      cwd,
      env,
      secrets,
      userId: user.id,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function stopSandboxProcessHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { processId } = req.body;
    const { forgeSandboxService } = await import("../../services/runtime/forgeSandbox.service.js");
    const result = await forgeSandboxService.terminateSandboxProcess(processId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
