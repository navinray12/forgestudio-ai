/**
 * Durable, website-scoped records for the blueprint v2 feature routers (WP-01, WP-16).
 *
 * Replaces the process-local Maps those routers used. The scope always comes from verified
 * membership (tenantScope.middleware), so a record can only be read or written inside the website
 * it belongs to. A write that repeats the previous request is a replay: it returns the stored
 * record and does not create a new revision.
 */
import { createHash } from "node:crypto";
import { pgPool } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";

export type WebsiteRecordKind = "FACT_OFFER" | "CONSENT_DECISION" | "LOCAL_DRAFT" | "SOURCE_IMPORT";

export interface WebsiteRecordScope {
  websiteId: string;
  tenantId: string;
}

export interface WebsiteRecord<T> {
  key: string;
  data: T;
  revision: number;
  createdById: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebsiteRecordWrite<T> {
  record: WebsiteRecord<T>;
  /** CREATED: first write. UPDATED: new revision. REPLAYED: identical to the stored request. */
  outcome: "CREATED" | "UPDATED" | "REPLAYED";
}

const MAX_DATA_BYTES = 256 * 1024;
const COLUMNS = `"recordKey" AS key, data, revision, "createdById", "updatedById", "createdAt", "updatedAt", "requestHash"`;

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable((value as Record<string, unknown>)[k])]));
  }
  return value;
}

/** SHA-256 of a value with object keys in a stable order. */
export function requestHashOf(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stable(value)) ?? "null").digest("hex");
}

function assertKey(key: string): void {
  if (typeof key !== "string" || key.length < 1 || key.length > 200) {
    throw new AppError("Record key must be between 1 and 200 characters", 400, "INVALID_RECORD_KEY");
  }
}

function toRecord<T>(row: any): WebsiteRecord<T> {
  return {
    key: row.key,
    data: row.data as T,
    revision: row.revision,
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function getWebsiteRecord<T>(scope: WebsiteRecordScope, kind: WebsiteRecordKind, key: string): Promise<WebsiteRecord<T> | null> {
  assertKey(key);
  const { rows } = await pgPool.query(
    `SELECT ${COLUMNS} FROM forge_website_records WHERE "websiteId" = $1::uuid AND kind = $2 AND "recordKey" = $3`,
    [scope.websiteId, kind, key]
  );
  return rows[0] ? toRecord<T>(rows[0]) : null;
}

/**
 * Creates or replaces a record. `request` is what the caller asked for (hashed for replay
 * detection); `data` is what gets stored. With `expectedRevision`, the write only succeeds against
 * that revision, so two concurrent read-modify-write requests cannot both win.
 */
export async function putWebsiteRecord<T>(params: {
  scope: WebsiteRecordScope;
  kind: WebsiteRecordKind;
  key: string;
  data: T;
  request: unknown;
  userId: string;
  expectedRevision?: number;
}): Promise<WebsiteRecordWrite<T>> {
  const { scope, kind, key, userId } = params;
  assertKey(key);
  const json = JSON.stringify(params.data);
  if (Buffer.byteLength(json, "utf8") > MAX_DATA_BYTES) {
    throw new AppError(`Record exceeds the ${MAX_DATA_BYTES} byte limit`, 413, "RECORD_TOO_LARGE");
  }
  const requestHash = requestHashOf(params.request);
  const expected = params.expectedRevision ?? null;

  const { rows } = await pgPool.query(
    `INSERT INTO forge_website_records AS r ("websiteId", "tenantId", kind, "recordKey", data, "requestHash", "createdById", "updatedById")
     SELECT $1::uuid, $2, $3, $4, $5::jsonb, $6, $7::uuid, $7::uuid WHERE $8::int IS NULL
     ON CONFLICT ("websiteId", kind, "recordKey") DO UPDATE
       SET data = EXCLUDED.data, "requestHash" = EXCLUDED."requestHash", revision = r.revision + 1,
           "updatedById" = EXCLUDED."updatedById", "updatedAt" = now()
       WHERE r."requestHash" <> EXCLUDED."requestHash"
     RETURNING ${COLUMNS}, (xmax = 0) AS inserted`,
    [scope.websiteId, scope.tenantId, kind, key, json, requestHash, userId, expected]
  );
  if (rows[0]) return { record: toRecord<T>(rows[0]), outcome: rows[0].inserted ? "CREATED" : "UPDATED" };

  if (expected !== null) {
    const { rows: updated } = await pgPool.query(
      `UPDATE forge_website_records SET data = $4::jsonb, "requestHash" = $5, revision = revision + 1, "updatedById" = $6::uuid, "updatedAt" = now()
       WHERE "websiteId" = $1::uuid AND kind = $2 AND "recordKey" = $3 AND revision = $7 AND "requestHash" <> $5
       RETURNING ${COLUMNS}`,
      [scope.websiteId, kind, key, json, requestHash, userId, expected]
    );
    if (updated[0]) return { record: toRecord<T>(updated[0]), outcome: "UPDATED" };
  }

  const { rows: existing } = await pgPool.query(
    `SELECT ${COLUMNS} FROM forge_website_records WHERE "websiteId" = $1::uuid AND kind = $2 AND "recordKey" = $3`,
    [scope.websiteId, kind, key]
  );
  if (!existing[0]) throw new AppError("Record not found", 404, "RECORD_NOT_FOUND");
  if (existing[0].requestHash === requestHash) return { record: toRecord<T>(existing[0]), outcome: "REPLAYED" };
  throw new AppError("The record changed since it was read", 409, "REVISION_CONFLICT");
}
