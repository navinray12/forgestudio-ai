/**
 * Project controller: Round-trip compatibility and construct classification.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { RoundTripContractService } from "../../services/compiler/roundTripContract.service.js";
import { getAuthUser } from "./shared.js";

export async function getRoundTripCompatibilityHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);

    const framework = (req.query.framework as any) || (project.framework === "nextjs" ? "nextjs" : "react");
    const matrix = RoundTripContractService.publishCompatibilityMatrix(framework);

    res.status(200).json({ success: true, matrix });
  } catch (err) {
    next(err);
  }
}

export async function classifyConstructHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { codeFragment, filePath } = req.body;
    const classification = RoundTripContractService.classifyConstruct(
      codeFragment || "",
      filePath || ""
    );

    res.status(200).json({ success: true, classification });
  } catch (err) {
    next(err);
  }
}
