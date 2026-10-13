/**
 * Approved permanent purge of a trashed website (blueprint §10: "Purge is a separate exact-manifest
 * operation with an independent approver by default, expiring approval, fresh authority/hold checks
 * ... A single-owner exception must be explicit and use stronger authentication and independently
 * protected audit").
 *
 * Policy (the same values as CMS entry purge, services/cms/contentLifecycle.service.ts):
 *  - Only the website owner requests and executes a purge (the existing website rule), with the
 *    existing name/slug confirmation and a reason.
 *  - A different owner/admin of the website approves; the approval expires after one hour.
 *  - Single-owner exception: only when no other owner/admin exists, explicitly requested, and with
 *    a sign-in within the last 15 minutes at both request and execution.
 *  - Execution re-checks ownership, trash state, the retention hold (FORGE_TRASH_RETENTION_DAYS),
 *    expiry and that the website still matches the approved manifest, inside the transaction that
 *    deletes it. If anything changed, nothing is deleted.
 *  - Requests live in website_purge_requests, which has no foreign key to the website, so the
 *    record of who requested, approved and executed survives the purge.
 */
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { pgPool } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { recordAuditLog } from "./audit.service.js";
import { verifyProjectAccess } from "../modules/data-platform/common/project-access.js";
import { listWebsiteAdministrators, PURGE_APPROVAL_TTL_MS, FRESH_AUTH_WINDOW_MS } from "./cms/contentLifecycle.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Child tables counted into the manifest; a change in any count invalidates the approval. */
const COUNTED_TABLES: Array<[label: string, table: string]> = [
  ["formSubmissions", "form_submissions"],
  ["leads", "forge_leads"],
  ["deployments", "deployments"],
  ["customPostTypes", "custom_post_types"],
];

export interface WebsitePurgeManifest {
  websiteId: string;
  name: string;
  slug: string;
  ownerId: string;
  trashedAt: string;
  updatedAt: string;
  counts: Record<string, number>;
}

/** Key order is not preserved by JSONB, so the manifest is hashed in a canonical (sorted-key) form. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}
const hashOf = (manifest: WebsitePurgeManifest) => crypto.createHash("sha256").update(canonical(manifest)).digest("hex");

type Queryable = Pick<PoolClient, "query">;

async function buildManifest(db: Queryable, websiteId: string, lock: boolean): Promise<WebsitePurgeManifest | null> {
  const { rows } = await db.query(
    `SELECT id, name, slug, "userId", status, "deletedAt", "updatedAt" FROM websites WHERE id = $1::uuid ${lock ? "FOR UPDATE" : ""}`,
    [websiteId]
  );
  const site = rows[0];
  if (!site || site.status !== "TRASH" || !site.deletedAt) return null;
  const counts: Record<string, number> = {};
  for (const [label, table] of COUNTED_TABLES) {
    const result = await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE "websiteId" = $1::uuid`, [websiteId]);
    counts[label] = result.rows[0].n;
  }
  return {
    websiteId: site.id,
    name: site.name,
    slug: site.slug,
    ownerId: site.userId,
    trashedAt: new Date(site.deletedAt).toISOString(),
    updatedAt: new Date(site.updatedAt).toISOString(),
    counts,
  };
}

function assertFreshAuth(authTime: Date | null): void {
  if (!authTime || Date.now() - authTime.getTime() > FRESH_AUTH_WINDOW_MS) {
    throw new AppError("Sign in again within the last 15 minutes to use the single-owner exception", 401, "REAUTHENTICATION_REQUIRED");
  }
}

function assertRetentionElapsed(trashedAt: string): void {
  const retentionDays = process.env.FORGE_TRASH_RETENTION_DAYS ? parseInt(process.env.FORGE_TRASH_RETENTION_DAYS, 10) : 0;
  if (!(retentionDays > 0)) return;
  const elapsedDays = (Date.now() - new Date(trashedAt).getTime()) / 86_400_000;
  if (elapsedDays < retentionDays) {
    throw new AppError(
      `Website retention policy active: it must remain in trash for ${retentionDays} days before purge (${Math.ceil(retentionDays - elapsedDays)} days remaining).`,
      409,
      "RETENTION_PERIOD_ACTIVE"
    );
  }
}

/** Non-members get 404; members who are not the owner get 403. */
async function requireOwner(websiteId: string, userId: string): Promise<void> {
  if (!UUID.test(websiteId)) throw new AppError("Website not found", 404, "NOT_FOUND");
  const access = await verifyProjectAccess(websiteId, userId);
  if (access.website.userId !== userId) {
    throw new AppError("Only the project owner can permanently purge a website.", 403, "FORBIDDEN");
  }
}

async function loadRequest(websiteId: string, requestId: string) {
  if (!UUID.test(requestId)) throw new AppError("Purge request not found", 404, "NOT_FOUND");
  const { rows } = await pgPool.query(`SELECT * FROM website_purge_requests WHERE id = $1::uuid AND "websiteId" = $2::uuid`, [requestId, websiteId]);
  if (!rows[0]) throw new AppError("Purge request not found", 404, "NOT_FOUND");
  return rows[0];
}

async function expireIfNeeded(request: { id: string; status: string; expiresAt: Date }): Promise<void> {
  if ((request.status === "PENDING_APPROVAL" || request.status === "APPROVED") && new Date(request.expiresAt).getTime() <= Date.now()) {
    await pgPool.query(`UPDATE website_purge_requests SET status = 'EXPIRED', "updatedAt" = now() WHERE id = $1::uuid AND status = $2`, [request.id, request.status]);
    throw new AppError("This purge request has expired; create a new one", 409, "APPROVAL_EXPIRED");
  }
}

export async function createWebsitePurgeRequest(websiteId: string, userId: string, authTime: Date | null, input: {
  reason?: unknown; confirmNameOrSlug?: unknown; singleOwnerException?: unknown;
}) {
  await requireOwner(websiteId, userId);
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) throw new AppError("A reason is required for permanent deletion", 400, "REASON_REQUIRED");

  const manifest = await buildManifest(pgPool, websiteId, false);
  if (!manifest) throw new AppError("Only websites currently in the trash can be permanently purged.", 409, "WEBSITE_NOT_IN_TRASH");
  if (input.confirmNameOrSlug !== manifest.name && input.confirmNameOrSlug !== manifest.slug) {
    throw new AppError("Confirmation mismatch: provide the exact website name or slug to confirm permanent purge.", 400, "CONFIRMATION_MISMATCH");
  }
  assertRetentionElapsed(manifest.trashedAt);

  const singleOwnerException = input.singleOwnerException === true;
  if (singleOwnerException) {
    const admins = await listWebsiteAdministrators(websiteId);
    admins.delete(userId);
    if (admins.size > 0) {
      throw new AppError("Another owner or admin can approve this purge, so the single-owner exception does not apply", 409, "INDEPENDENT_APPROVER_AVAILABLE");
    }
    assertFreshAuth(authTime);
  }

  const { rows: [request] } = await pgPool.query(
    `INSERT INTO website_purge_requests ("websiteId", manifest, "manifestHash", reason, "requestedById", "singleOwnerException", status, "approvedById", "approvedAt", "expiresAt")
     VALUES ($1::uuid, $2::jsonb, $3, $4, $5::uuid, $6, $7, $8::uuid, $9, now() + ($10 || ' milliseconds')::interval) RETURNING *`,
    [websiteId, JSON.stringify(manifest), hashOf(manifest), reason.slice(0, 500), userId, singleOwnerException,
      singleOwnerException ? "APPROVED" : "PENDING_APPROVAL", singleOwnerException ? userId : null,
      singleOwnerException ? new Date() : null, String(PURGE_APPROVAL_TTL_MS)]
  );
  await recordAuditLog({
    userId,
    action: "WEBSITE_PURGE_REQUESTED",
    targetResource: `website_purge_request:${request.id}`,
    details: { websiteId, manifestHash: request.manifestHash, reason, singleOwnerException },
  });
  return request;
}

export async function listWebsitePurgeRequests(websiteId: string, userId: string) {
  if (!UUID.test(websiteId)) throw new AppError("Website not found", 404, "NOT_FOUND");
  const access = await verifyProjectAccess(websiteId, userId);
  if (!access.canAdminister) throw new AppError("Only website owners and admins can view purge requests", 403, "FORBIDDEN");
  const { rows } = await pgPool.query(`SELECT * FROM website_purge_requests WHERE "websiteId" = $1::uuid ORDER BY "createdAt" DESC LIMIT 50`, [websiteId]);
  return rows;
}

/** A different owner/admin approves; the approval is valid for one hour. */
export async function approveWebsitePurgeRequest(websiteId: string, requestId: string, userId: string) {
  if (!UUID.test(websiteId)) throw new AppError("Purge request not found", 404, "NOT_FOUND");
  const access = await verifyProjectAccess(websiteId, userId).catch(() => {
    throw new AppError("Purge request not found", 404, "NOT_FOUND");
  });
  if (!access.canAdminister) throw new AppError("Only website owners and admins can approve a purge", 403, "FORBIDDEN");
  const request = await loadRequest(websiteId, requestId);
  await expireIfNeeded(request);
  if (request.status !== "PENDING_APPROVAL") throw new AppError(`Request is ${request.status}`, 409, "INVALID_STATE");
  if (request.requestedById === userId) {
    throw new AppError("The approver must be someone other than the requester", 403, "INDEPENDENT_APPROVER_REQUIRED");
  }
  const { rows } = await pgPool.query(
    `UPDATE website_purge_requests SET status = 'APPROVED', "approvedById" = $2::uuid, "approvedAt" = now(),
            "expiresAt" = now() + ($3 || ' milliseconds')::interval, "updatedAt" = now()
      WHERE id = $1::uuid AND status = 'PENDING_APPROVAL' RETURNING *`,
    [requestId, userId, String(PURGE_APPROVAL_TTL_MS)]
  );
  if (!rows[0]) throw new AppError("This purge request changed; reload it", 409, "INVALID_STATE");
  await recordAuditLog({
    userId,
    action: "WEBSITE_PURGE_APPROVED",
    targetResource: `website_purge_request:${requestId}`,
    details: { websiteId, requestedById: request.requestedById, manifestHash: request.manifestHash },
  });
  return rows[0];
}

/**
 * Executes an approved purge. The claim, the manifest comparison (under a row lock) and the delete
 * share one transaction, so a website that was restored or changed after approval is never deleted
 * and a failed delete leaves the request APPROVED rather than EXECUTED.
 */
export async function executeWebsitePurgeRequest(websiteId: string, requestId: string, userId: string, authTime: Date | null) {
  await requireOwner(websiteId, userId);
  const request = await loadRequest(websiteId, requestId);
  await expireIfNeeded(request);
  if (request.status !== "APPROVED") throw new AppError(`Request is ${request.status}`, 409, "INVALID_STATE");
  if (request.requestedById !== userId) throw new AppError("Only the requesting owner can execute this purge", 403, "FORBIDDEN");
  if (request.singleOwnerException) assertFreshAuth(authTime);
  else if (!request.approvedById || request.approvedById === request.requestedById) {
    throw new AppError("This purge has no independent approval", 403, "INDEPENDENT_APPROVER_REQUIRED");
  }
  const approved = request.manifest as WebsitePurgeManifest;
  if (hashOf(approved) !== request.manifestHash) throw new AppError("The purge manifest does not match its recorded hash", 409, "MANIFEST_CHANGED");

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `UPDATE website_purge_requests SET status = 'EXECUTING', "updatedAt" = now() WHERE id = $1::uuid AND status = 'APPROVED' AND "expiresAt" > now()`,
      [requestId]
    );
    if (claimed.rowCount !== 1) throw new AppError("This purge request is no longer executable", 409, "INVALID_STATE");
    const current = await buildManifest(client, websiteId, true);
    if (!current || hashOf(current) !== request.manifestHash) {
      throw new AppError("The website was restored or changed after approval; nothing was purged", 409, "MANIFEST_CHANGED");
    }
    assertRetentionElapsed(current.trashedAt);
    await client.query(`DELETE FROM websites WHERE id = $1::uuid`, [websiteId]);
    await client.query(
      `UPDATE website_purge_requests SET status = 'EXECUTED', "executedById" = $2::uuid, "executedAt" = now(), "updatedAt" = now() WHERE id = $1::uuid`,
      [requestId, userId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  await recordAuditLog({
    userId,
    action: "WEBSITE_PERMANENTLY_PURGED",
    targetResource: `website:${websiteId}`,
    details: {
      purgeRequestId: requestId, websiteName: approved.name, websiteSlug: approved.slug, manifestHash: request.manifestHash,
      purgedRecords: approved.counts, requestedById: request.requestedById, approvedById: request.approvedById,
      singleOwnerException: request.singleOwnerException,
    },
  });
  return { success: true, purgedWebsiteId: websiteId, purgeRequestId: requestId };
}
