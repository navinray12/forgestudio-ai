/**
 * Durable workspace checkpoints for Visual Editor ↔ Code Workspace synchronization
 * (blueprint §33.3, §34.3–34.4; FS21-AT-SYN-03, SYN-04, SYN-05, SYN-07).
 *
 * A checkpoint is written after a save or sync step has committed. It records the exact visual
 * document version/hash and the exact source file versions that belong together, what kind of
 * state that is (synchronized, saved draft, conflict, source only), and — for code saves made with
 * an idempotency key — the response, so a retried request returns the original result instead of
 * writing twice. Everything lives in PostgreSQL; nothing here is held in process memory.
 */
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { pgPool } from "../../config/prisma.js";

export type CheckpointKind = "SYNCHRONIZED" | "DRAFT" | "CONFLICT" | "SOURCE_ONLY";
export type CheckpointOrigin = "CODE" | "VISUAL";

export interface WorkspaceCheckpoint {
  id: string;
  projectId: string;
  sequence: number;
  origin: CheckpointOrigin;
  kind: CheckpointKind;
  filePath: string | null;
  message: string | null;
  documentVersion: number | null;
  documentHash: string | null;
  sourceManifest: Array<{ path: string; version: number; contentHash: string }>;
  changeSetId: string | null;
  createdById: string | null;
  createdAt: string;
}

function toCheckpoint(row: any): WorkspaceCheckpoint {
  return {
    id: row.id,
    projectId: row.projectId,
    sequence: Number(row.sequence),
    origin: row.origin,
    kind: row.kind,
    filePath: row.filePath,
    message: row.message,
    documentVersion: row.documentVersion,
    documentHash: row.documentHash,
    sourceManifest: row.sourceManifest ?? [],
    changeSetId: row.changeSetId,
    createdById: row.createdById,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/** Maps a code→visual sync outcome to the checkpoint kind it represents. */
export function kindForSyncStatus(status: string | undefined | null): CheckpointKind {
  switch (status) {
    case "synced":
    case "reverted":
      return "SYNCHRONIZED";
    case "conflict":
      return "CONFLICT";
    case "invalid":
    case "unsupported":
    case "error":
      return "DRAFT";
    default:
      return "SOURCE_ONLY";
  }
}

const stableHash = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");

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

/**
 * Read-modify-write of forge_projects.metadata under a row lock, so concurrent syncs of
 * different pages cannot overwrite each other's sync state (lost update).
 */
export async function updateProjectMetadataAtomic(
  projectId: string,
  mutate: (metadata: Record<string, any>) => void
): Promise<void> {
  await inTransaction(async (client) => {
    const { rows } = await client.query(`SELECT metadata FROM forge_projects WHERE id = $1 FOR UPDATE`, [projectId]);
    if (!rows[0]) return;
    const metadata = rows[0].metadata && typeof rows[0].metadata === "object" ? { ...rows[0].metadata } : {};
    mutate(metadata);
    await client.query(`UPDATE forge_projects SET metadata = $2::jsonb, "updatedAt" = now() WHERE id = $1`, [
      projectId,
      JSON.stringify(metadata),
    ]);
  });
}

export interface RecordCheckpointInput {
  projectId: string;
  websiteId?: string | null;
  origin: CheckpointOrigin;
  kind: CheckpointKind;
  filePath?: string | null;
  message?: string | null;
  changeSetId?: string | null;
  response?: unknown;
  actorId?: string | null;
}

/**
 * Records the committed state. The project row is locked to assign a gap-free sequence, and the
 * document and source versions are read inside the same transaction.
 */
export async function recordCheckpoint(input: RecordCheckpointInput): Promise<WorkspaceCheckpoint> {
  return inTransaction(async (client) => {
    const locked = await client.query(`SELECT id FROM forge_projects WHERE id = $1 FOR UPDATE`, [input.projectId]);
    if (!locked.rows[0]) throw new Error(`Project ${input.projectId} not found`);

    let documentVersion: number | null = null;
    let documentHash: string | null = null;
    if (input.websiteId) {
      const site = await client.query(`SELECT "documentVersion", "editorData" FROM websites WHERE id = $1`, [input.websiteId]);
      if (site.rows[0]) {
        documentVersion = site.rows[0].documentVersion ?? null;
        documentHash = stableHash(site.rows[0].editorData);
      }
    }
    const files = await client.query(
      `SELECT path, version, "contentHash" FROM forge_project_files WHERE "projectId" = $1 AND "deletedAt" IS NULL ORDER BY path`,
      [input.projectId]
    );
    const next = await client.query(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS seq FROM forge_workspace_checkpoints WHERE "projectId" = $1`,
      [input.projectId]
    );
    const { rows } = await client.query(
      `INSERT INTO forge_workspace_checkpoints
         ("projectId", sequence, origin, kind, "filePath", message, "documentVersion", "documentHash",
          "sourceManifest", "changeSetId", response, "createdById")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb, $12)
       RETURNING *`,
      [
        input.projectId,
        next.rows[0].seq,
        input.origin,
        input.kind,
        input.filePath ?? null,
        input.message ?? null,
        documentVersion,
        documentHash,
        JSON.stringify(files.rows.map((f: any) => ({ path: f.path, version: f.version, contentHash: f.contentHash }))),
        input.changeSetId ?? null,
        input.response === undefined ? null : JSON.stringify(input.response),
        input.actorId ?? null,
      ]
    );
    return toCheckpoint(rows[0]);
  });
}

/** Returns the stored result of a change set that was already committed, if any. */
export async function findCommittedChangeSet(
  projectId: string,
  changeSetId: string
): Promise<{ checkpoint: WorkspaceCheckpoint; response: unknown } | null> {
  const { rows } = await pgPool.query(
    `SELECT * FROM forge_workspace_checkpoints WHERE "projectId" = $1 AND "changeSetId" = $2`,
    [projectId, changeSetId]
  );
  return rows[0] ? { checkpoint: toCheckpoint(rows[0]), response: rows[0].response } : null;
}

export async function getCheckpointState(projectId: string): Promise<{
  latest: WorkspaceCheckpoint | null;
  lastSynchronized: WorkspaceCheckpoint | null;
}> {
  const latest = await pgPool.query(
    `SELECT * FROM forge_workspace_checkpoints WHERE "projectId" = $1 ORDER BY sequence DESC LIMIT 1`,
    [projectId]
  );
  const synced = await pgPool.query(
    `SELECT * FROM forge_workspace_checkpoints WHERE "projectId" = $1 AND kind = 'SYNCHRONIZED' ORDER BY sequence DESC LIMIT 1`,
    [projectId]
  );
  return {
    latest: latest.rows[0] ? toCheckpoint(latest.rows[0]) : null,
    lastSynchronized: synced.rows[0] ? toCheckpoint(synced.rows[0]) : null,
  };
}

/** Checkpoints after a sequence number, for a client resuming after a disconnect. */
export async function listCheckpointsAfter(projectId: string, afterSequence: number, limit = 100): Promise<WorkspaceCheckpoint[]> {
  const { rows } = await pgPool.query(
    `SELECT * FROM forge_workspace_checkpoints WHERE "projectId" = $1 AND sequence > $2 ORDER BY sequence ASC LIMIT $3`,
    [projectId, Math.max(0, Math.floor(afterSequence) || 0), Math.min(Math.max(limit, 1), 500)]
  );
  return rows.map(toCheckpoint);
}
