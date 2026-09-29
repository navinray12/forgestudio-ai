import { ZodError } from "zod";
import { postgresFailure } from "../config/postgres-failure.js";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error.js";

/** RFC 9457 fields plus the legacy envelope during client migration. Unknown
 * errors never disclose SQL, request bodies, credentials or internal stack traces.
 */
export function errorMiddleware(error: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(error);
  const requestId = randomUUID();
  let status = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "Something went wrong";
  if (error instanceof AppError && error.statusCode >= 400 && error.statusCode <= 599) {
    status = error.statusCode;
    code = /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : "APPLICATION_ERROR";
    message = error.message;
  } else if (error instanceof ZodError) {
    status = 422; code = "VALIDATION_ERROR"; message = "The submitted fields are invalid.";
  } else if (typeof error === "object" && error !== null) {
    const failure = error as { code?: unknown; type?: unknown };
    const database = postgresFailure(error);
    if (database.code === "55000" && database.message === "WORKSPACE_READ_ONLY") {
      status = 409; code = "WORKSPACE_READ_ONLY"; message = "This workspace is archived and read-only";
    } else if (database.code === "23514" && ["WORKSPACE_OWNER_REQUIRED", "TENANT_SCOPE_MISMATCH", "RESOURCE_PARENT_IMMUTABLE"].includes(database.message ?? "")) {
      status = 409; code = "OWNERSHIP_CONFLICT"; message = "The operation would violate resource ownership";
    } else if (["P1001", "P1002", "P1008", "P1017", "P2024"].includes(String(failure.code))) {
      status = 503; code = "DEPENDENCY_UNAVAILABLE"; message = "The service is temporarily unavailable";
    } else if (failure.type === "entity.too.large") {
      status = 413; code = "PAYLOAD_TOO_LARGE"; message = "The request exceeds the permitted size";
    } else if (failure.type === "entity.parse.failed") {
      status = 400; code = "INVALID_JSON"; message = "The request body is not valid JSON";
    }
  }
  // Do not stringify the original Error: ORM errors can contain parameters and
  // provider errors can contain tokens. Correlation enables safe operator triage.
  if (status >= 500) console.error(JSON.stringify({ event: "request.failed", requestId, code, status }));
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("Cache-Control", "no-store");
  res.type("application/problem+json");
  return res.status(status).json({
    type: `urn:forge:problem:${code.toLowerCase().replaceAll("_", "-")}`,
    title: status >= 500 ? "Service request failed" : "Request rejected",
    status, detail: message, code, requestId, retryable: status === 503,
    success: false, error: { code, message, requestId },
  });
}
