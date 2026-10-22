/**
 * Project controller: Module 18: Forge CLI Automation.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Module 18: Forge CLI Automation Handlers
// ---------------------------------------------------------------------------

export async function executeCliHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const { args = [], cwd, json = true, nonInteractive = true, projectId } = req.body;

    const { forgeCliService } = await import("../../services/cli/forgeCli.service.js");
    const result = await forgeCliService.runCliCommand(args, {
      cwd,
      json,
      nonInteractive,
      userId: user.id,
      projectId,
    });
    res.status(result.exitCode === 0 ? 200 : 400).json(result);
  } catch (err) {
    next(err);
  }
}
