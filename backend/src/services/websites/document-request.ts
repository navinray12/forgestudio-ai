import type { Request } from "express";
import { AppError } from "../../utils/app-error.js";
import { parseDocumentETag } from "./document-policy.js";
import type { DocumentWriteContext } from "./save-document.js";
export function documentWriteContext(request: Request, websiteId: string): DocumentWriteContext {
  if (request.get("X-Forge-Intent") !== "document-command") throw new AppError("An explicit document command header is required", 403, "DOCUMENT_INTENT_REQUIRED");
  return { key: request.get("Idempotency-Key") || "", expectedVersion: parseDocumentETag(websiteId, request.get("If-Match")) };
}
