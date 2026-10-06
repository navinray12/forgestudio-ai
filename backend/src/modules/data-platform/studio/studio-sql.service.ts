import { TenantPoolManager } from "../common/pool-manager.js";
import { AppError } from "../../../utils/app-error.js";
import type { DatabaseEnvironment } from "../../../generated/prisma/client.js";

export interface FieldInfo {
  name: string;
  dataTypeId: number;
}

export interface QueryExecutionResult {
  rows: any[];
  fields: FieldInfo[];
  rowCount: number;
  durationMs: number;
}

/**
 * Normalizes PostgreSQL error codes into user-friendly diagnostic messages.
 */
function normalizePostgreSqlError(err: any): { message: string; code: string; position?: number } {
  const code = err.code || "UNKNOWN_ERROR";
  let message = err.message || "An unknown database error occurred.";

  switch (code) {
    case "57014":
      message = "Query execution cancelled: Statement timeout exceeded (max 8000ms).";
      break;
    case "42P01":
      message = `Table or relation not found: ${err.message}`;
      break;
    case "42703":
      message = `Column does not exist: ${err.message}`;
      break;
    case "42601":
      message = `Syntax error in SQL statement: ${err.message}`;
      break;
    case "23505":
      message = `Unique constraint violation: ${err.detail || err.message}`;
      break;
    case "23503":
      message = `Foreign key violation: ${err.detail || err.message}`;
      break;
    case "28P01":
      message = "Authentication failed connecting to tenant database.";
      break;
    default:
      break;
  }

  return {
    message,
    code,
    position: err.position ? parseInt(err.position, 10) : undefined,
  };
}

/**
 * Executes an arbitrary user SQL query in a sandboxed, timeout-guarded tenant transaction.
 */
export async function executeUserQuery(
  projectId: string,
  sql: string,
  environment: DatabaseEnvironment = "PRODUCTION"
): Promise<QueryExecutionResult> {
  const trimmedSql = (sql || "").trim();
  if (!trimmedSql) {
    throw new AppError("SQL query string cannot be empty", 400, "EMPTY_QUERY");
  }

  const pool = await TenantPoolManager.getTenantPool(projectId, environment);
  const client = await pool.connect();

  const startTime = Date.now();

  try {
    // 1. Enter transaction to enforce local statement timeout
    await client.query("BEGIN;");
    await client.query("SET LOCAL statement_timeout = '8000ms';");

    // 2. Execute user query
    const res = await client.query(trimmedSql);

    // If query returns multiple statements, pick the last statement result
    const actualResult = Array.isArray(res) ? res[res.length - 1] : res;

    await client.query("COMMIT;");
    const durationMs = Date.now() - startTime;

    // 3. Cap max rows to 500 to prevent browser and memory exhaustion
    const rows = actualResult.rows.slice(0, 500);

    return {
      rows,
      fields: ((actualResult as any).fields || []).map((f: any) => ({
        name: f.name,
        dataTypeId: f.dataTypeID,
      })),
      rowCount: actualResult.rowCount ?? rows.length,
      durationMs,
    };
  } catch (err: any) {
    await client.query("ROLLBACK;").catch(() => undefined);
    const normalized = normalizePostgreSqlError(err);
    throw new AppError(normalized.message, 400, normalized.code);
  } finally {
    client.release();
  }
}
