import type { Request, Response, NextFunction } from "express";
import { documentWriteContext } from "../services/websites/document-request.js";
import { AppError } from "../utils/app-error.js";
import { authorizedExecution, cancelDesignExecution, getDesignExecution, retryDesignExecution, startDesignExecution } from "../modules/ai/design/executions.js";
import { designAvailability } from "../modules/ai/design/config.js";

export async function createDesignHandler(req: Request, res: Response, next: NextFunction) {
  try { const id = String(req.params.id); const result = await startDesignExecution(id, res.locals.user.id, req.body, documentWriteContext(req, id)); res.status(202).json(result); } catch (error) { next(error); }
}
export async function getDesignHandler(req: Request, res: Response, next: NextFunction) {
  try { res.setHeader("Cache-Control", "no-store"); res.json({ execution: await getDesignExecution(String(req.params.executionId), res.locals.user.id) }); } catch (error) { next(error); }
}
export async function cancelDesignHandler(req: Request, res: Response, next: NextFunction) {
  try { if (req.get("X-Forge-Intent") !== "document-command") throw new AppError("An explicit document command header is required", 403, "DOCUMENT_INTENT_REQUIRED"); res.json(await cancelDesignExecution(String(req.params.executionId), res.locals.user.id, req.get("Idempotency-Key") || "")); } catch (error) { next(error); }
}
export async function retryDesignHandler(req: Request, res: Response, next: NextFunction) {
  try { const id = String(req.params.executionId), row = await authorizedExecution(id, res.locals.user.id); res.status(202).json(await retryDesignExecution(id, res.locals.user.id, documentWriteContext(req, row.websiteId))); } catch (error) { next(error); }
}
export function designCapabilitiesHandler(_req: Request, res: Response) { res.setHeader("Cache-Control", "no-store"); res.json({ design: designAvailability() }); }
