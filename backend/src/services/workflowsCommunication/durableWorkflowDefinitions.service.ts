/**
 * Durable, versioned workflow definitions (blueprint §15: "Published definitions are immutable").
 *
 * Lifecycle and recovery contract:
 *  - Every draft is a new, gap-free version of (websiteId, workflowKey); its content never changes.
 *  - DRAFT -> PUBLISHED -> DEPRECATED are the only transitions. Publishing deprecates the previous
 *    published version in the same transaction; at most one version is PUBLISHED.
 *  - The database enforces both rules (trigger + partial unique index), so they hold for any
 *    writer and survive restarts; the service holds no state.
 *
 * Graph validation and simulation reuse VersionedWorkflowEngine's pure functions. Simulation uses a
 * synthetic recipient and a virtual clock and has no production effects. Workflow *runs* (timers,
 * budgets, per-run idempotency) are not implemented here.
 */
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import {
  VersionedWorkflowEngine,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowSimulationResult,
} from "./workflowEngine.service.js";

const WORKFLOW_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export interface StoredWorkflowVersion {
  id: string;
  websiteId: string;
  workflowKey: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "DEPRECATED";
  name: string;
  definitionHash: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  limits: { maxSteps: number; maxTimeSeconds: number; maxSpendUsd: number };
  createdById: string;
  createdAt: string;
  publishedById: string | null;
  publishedAt: string | null;
}

interface Scope {
  websiteId: string;
  tenantId: string;
}

function toStored(row: any): StoredWorkflowVersion {
  return {
    id: row.id,
    websiteId: row.websiteId,
    workflowKey: row.workflowKey,
    version: row.version,
    status: row.status,
    name: row.name,
    definitionHash: row.definitionHash,
    nodes: row.definition.nodes,
    edges: row.definition.edges,
    limits: row.definition.limits,
    createdById: row.createdById,
    createdAt: new Date(row.createdAt).toISOString(),
    publishedById: row.publishedById,
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
  };
}

function toEngineDefinition(stored: StoredWorkflowVersion, tenantId: string): WorkflowDefinition {
  return {
    workflowId: stored.workflowKey,
    tenantId,
    version: stored.version,
    status: stored.status,
    name: stored.name,
    nodes: stored.nodes,
    edges: stored.edges,
    maxExecutionSteps: stored.limits.maxSteps,
    maxExecutionTimeSeconds: stored.limits.maxTimeSeconds,
    maxSpendLimitUsd: stored.limits.maxSpendUsd,
    createdAt: stored.createdAt,
  };
}

function assertKey(workflowKey: string): void {
  if (typeof workflowKey !== "string" || !WORKFLOW_KEY.test(workflowKey)) {
    throw new AppError("workflowId must be 1-100 characters of letters, digits, '-' or '_'", 400, "INVALID_WORKFLOW_ID");
  }
}

function boundedNumber(value: unknown, fallback: number, max: number, label: string): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > max) {
    throw new AppError(`${label} must be a positive number no greater than ${max}`, 400, "INVALID_WORKFLOW_LIMIT");
  }
  return value;
}

async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Stores a validated graph as the next immutable version of this website's workflow. */
export async function createWorkflowDraft(scope: Scope, userId: string, input: {
  workflowKey: string; name: string; nodes: WorkflowNode[]; edges: WorkflowEdge[];
  limits?: { maxSteps?: number; maxTimeSeconds?: number; maxSpendUsd?: number };
}): Promise<StoredWorkflowVersion> {
  assertKey(input.workflowKey);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 200) throw new AppError("name must be 1-200 characters", 400, "INVALID_WORKFLOW_NAME");
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
    throw new AppError("nodes and edges must be arrays", 400, "INVALID_WORKFLOW_GRAPH");
  }
  const limits = {
    maxSteps: boundedNumber(input.limits?.maxSteps, 50, 1000, "limits.maxSteps"),
    maxTimeSeconds: boundedNumber(input.limits?.maxTimeSeconds, 86400, 31_536_000, "limits.maxTimeSeconds"),
    maxSpendUsd: boundedNumber(input.limits?.maxSpendUsd, 10, 100_000, "limits.maxSpendUsd"),
  };
  const definition = { nodes: input.nodes, edges: input.edges, limits };
  const serialized = JSON.stringify(definition);
  if (serialized.length > 500_000) throw new AppError("Workflow definition is too large", 413, "WORKFLOW_TOO_LARGE");

  const report = VersionedWorkflowEngine.validateWorkflowGraph({
    workflowId: input.workflowKey, tenantId: scope.tenantId, version: 0, status: "DRAFT", name,
    nodes: input.nodes, edges: input.edges, maxExecutionSteps: limits.maxSteps,
    maxExecutionTimeSeconds: limits.maxTimeSeconds, maxSpendLimitUsd: limits.maxSpendUsd, createdAt: new Date().toISOString(),
  });
  if (!report.valid) {
    throw new AppError(`Workflow validation failed: ${report.errors.join("; ")}`, 400, "INVALID_WORKFLOW_GRAPH");
  }

  return inTransaction(async (client) => {
    // Serializes version allocation for this workflow so versions are gap-free and unique.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`workflow:${scope.websiteId}:${input.workflowKey}`]);
    const { rows: [{ next }] } = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next FROM forge_workflow_definitions WHERE "websiteId" = $1::uuid AND "workflowKey" = $2`,
      [scope.websiteId, input.workflowKey]
    );
    const { rows: [row] } = await client.query(
      `INSERT INTO forge_workflow_definitions ("websiteId", "workflowKey", version, status, name, definition, "definitionHash", "createdById")
       VALUES ($1::uuid, $2, $3, 'DRAFT', $4, $5::jsonb, $6, $7::uuid) RETURNING *`,
      [scope.websiteId, input.workflowKey, next, name, serialized, crypto.createHash("sha256").update(serialized).digest("hex"), userId]
    );
    return toStored(row);
  });
}

export async function getWorkflowVersion(scope: Scope, workflowKey: string, version: number): Promise<StoredWorkflowVersion> {
  assertKey(workflowKey);
  if (!Number.isInteger(version) || version < 1) throw new AppError("version must be a positive integer", 400, "INVALID_VERSION");
  const { rows } = await pgPool.query(
    `SELECT * FROM forge_workflow_definitions WHERE "websiteId" = $1::uuid AND "workflowKey" = $2 AND version = $3`,
    [scope.websiteId, workflowKey, version]
  );
  if (!rows[0]) throw new AppError(`Workflow ${workflowKey} version ${version} not found`, 404, "WORKFLOW_NOT_FOUND");
  return toStored(rows[0]);
}

export async function listWorkflowVersions(scope: Scope, workflowKey?: string): Promise<Array<Omit<StoredWorkflowVersion, "nodes" | "edges" | "limits">>> {
  if (workflowKey !== undefined) assertKey(workflowKey);
  const { rows } = await pgPool.query(
    `SELECT id, "websiteId", "workflowKey", version, status, name, "definitionHash", "createdById", "createdAt", "publishedById", "publishedAt"
       FROM forge_workflow_definitions WHERE "websiteId" = $1::uuid ${workflowKey ? `AND "workflowKey" = $2` : ""}
      ORDER BY "workflowKey", version DESC LIMIT 500`,
    workflowKey ? [scope.websiteId, workflowKey] : [scope.websiteId]
  );
  return rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
  }));
}

/**
 * Publishes a draft. Idempotent for an already-published version; a deprecated version cannot be
 * republished (create a new version instead). The previous published version is deprecated atomically.
 */
export async function publishWorkflowVersion(scope: Scope, userId: string, workflowKey: string, version: number): Promise<StoredWorkflowVersion> {
  assertKey(workflowKey);
  if (!Number.isInteger(version) || version < 1) throw new AppError("version must be a positive integer", 400, "INVALID_VERSION");
  return inTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM forge_workflow_definitions WHERE "websiteId" = $1::uuid AND "workflowKey" = $2 ORDER BY version FOR UPDATE`,
      [scope.websiteId, workflowKey]
    );
    const target = rows.find((r) => r.version === version);
    if (!target) throw new AppError(`Workflow ${workflowKey} version ${version} not found`, 404, "WORKFLOW_NOT_FOUND");
    if (target.status === "PUBLISHED") return toStored(target);
    if (target.status !== "DRAFT") {
      throw new AppError(`Version ${version} is ${target.status} and cannot be published; create a new version`, 409, "WORKFLOW_VERSION_NOT_PUBLISHABLE");
    }
    await client.query(
      `UPDATE forge_workflow_definitions SET status = 'DEPRECATED' WHERE "websiteId" = $1::uuid AND "workflowKey" = $2 AND status = 'PUBLISHED'`,
      [scope.websiteId, workflowKey]
    );
    const { rows: [published] } = await client.query(
      `UPDATE forge_workflow_definitions SET status = 'PUBLISHED', "publishedAt" = now(), "publishedById" = $2::uuid WHERE id = $1::uuid RETURNING *`,
      [target.id, userId]
    );
    return toStored(published);
  });
}

export async function simulateWorkflowVersion(scope: Scope, workflowKey: string, version: number, initialContext: unknown): Promise<WorkflowSimulationResult> {
  const stored = await getWorkflowVersion(scope, workflowKey, version);
  const context = initialContext && typeof initialContext === "object" && !Array.isArray(initialContext)
    ? (initialContext as Record<string, any>)
    : {};
  return VersionedWorkflowEngine.simulateDefinition(toEngineDefinition(stored, scope.tenantId), context);
}
