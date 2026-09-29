import { postgresFailure } from "./postgres-failure.js";
/** Retry only an aborted, local database transaction. Never use this classifier
 * to retry provider calls or an operation whose external outcome is unknown.
 */
export function isRetryableTransactionConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const failure = error as {
    name?: unknown; code?: unknown;
    meta?: { code?: unknown };
    cause?: { kind?: unknown; originalCode?: unknown };
  };
  if (failure.code === "P2034" || failure.code === "P2002") return true;
  if (failure.code === "P2010") return ["23505", "40001", "40P01"].includes(postgresFailure(error).code ?? "");
  if (failure.name !== "DriverAdapterError") return false;
  const cause = failure.cause;
  if (cause?.kind === "TransactionWriteConflict") {
    return cause.originalCode === undefined || ["40001", "40P01"].includes(String(cause.originalCode));
  }
  return cause?.kind === "UniqueConstraintViolation" && String(cause.originalCode) === "23505";
}
