/**
 * Trash, restore and approved purge for CMS entries (blueprint §10, Chapter 38 protected source).
 *
 * Policy, taken from the blueprint and existing product rules:
 * - Deleting an entry moves it to trash with a reason; nothing in trash expires by age.
 * - Restore returns the entry to DRAFT (unpublished) after a slug check.
 * - Permanent deletion is a separate purge request over an exact manifest of trashed entries. It
 *   needs an independent owner/admin approval; the approval expires after one hour (the product's
 *   existing approval lifetime, unifiedMigrationAuthority). A single-owner exception is allowed
 *   only when the website has no other owner/admin and the requester authenticated within the last
 *   15 minutes (the identity module's fresh-session window).
 * - Execution re-checks authority, expiry and that every manifest entry is unchanged.
 */
import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit.service.js";
import { verifyProjectAccess } from "../../modules/data-platform/common/project-access.js";

export const PURGE_APPROVAL_TTL_MS = 60 * 60 * 1000;
export const FRESH_AUTH_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_ROLES = ["OWNER", "ADMIN"];

type ManifestItem = { entryId: string; updatedAt: string };

function manifestHash(items: ManifestItem[]) {
  return crypto.createHash("sha256").update(JSON.stringify(items)).digest("hex");
}

/** Every user who administers a website: the owner plus OWNER/ADMIN collaborators and members. */
export async function listWebsiteAdministrators(websiteId: string): Promise<Set<string>> {
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: {
      userId: true,
      collaborators: { where: { permission: { in: ADMIN_ROLES } }, select: { userId: true } },
      team: { select: { members: { where: { role: { in: ADMIN_ROLES } }, select: { userId: true } } } },
      workspace: { select: { members: { where: { role: { in: ADMIN_ROLES } }, select: { userId: true } } } },
      organization: { select: { members: { where: { role: { in: ADMIN_ROLES } }, select: { userId: true } } } },
    },
  });
  if (!website) return new Set();
  return new Set(
    [
      website.userId,
      ...website.collaborators.map((c) => c.userId),
      ...(website.team?.members ?? []).map((m) => m.userId),
      ...(website.workspace?.members ?? []).map((m) => m.userId),
      ...(website.organization?.members ?? []).map((m) => m.userId),
    ].filter(Boolean) as string[]
  );
}

async function requireAdministrator(websiteId: string, userId: string) {
  const access = await verifyProjectAccess(websiteId, userId);
  if (!access.canAdminister) {
    throw new AppError("Only website owners and admins can manage permanent deletion", 403, "FORBIDDEN");
  }
  return access;
}

/** Moves an entry to trash. Members who can edit content may trash; a reason is required. */
export async function trashEntry(entry: { id: string; postTypeId: string; websiteId: string }, userId: string, input: { reason?: unknown; expectedUpdatedAt?: unknown }) {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) throw new AppError("A reason is required to move content to trash", 400, "REASON_REQUIRED");

  const current = await prisma.customEntry.findUnique({ where: { id: entry.id } });
  if (!current || current.deletedAt) throw new AppError("Entry not found", 404, "NOT_FOUND");
  if (typeof input.expectedUpdatedAt === "string" && new Date(input.expectedUpdatedAt).getTime() !== current.updatedAt.getTime()) {
    throw new AppError("The entry changed since you loaded it", 409, "VERSION_CONFLICT");
  }

  const trashed = await prisma.customEntry.update({
    where: { id: entry.id },
    data: { deletedAt: new Date(), deletedById: userId, deleteReason: reason.slice(0, 500) },
  });
  await recordAuditLog({
    userId,
    action: "CMS_ENTRY_TRASHED",
    targetResource: `cms_entry:${entry.id}`,
    details: { websiteId: entry.websiteId, postTypeId: entry.postTypeId, reason, previousStatus: current.status },
  });
  return trashed;
}

/** Restores a trashed entry as an unpublished draft, refusing a slug that is now in use. */
export async function restoreEntry(entry: { id: string; postTypeId: string; websiteId: string }, userId: string) {
  const current = await prisma.customEntry.findUnique({ where: { id: entry.id } });
  if (!current) throw new AppError("Entry not found", 404, "NOT_FOUND");
  if (!current.deletedAt) throw new AppError("Entry is not in trash", 409, "NOT_IN_TRASH");
  if (current.slug) {
    const clash = await prisma.customEntry.findFirst({
      where: { postTypeId: current.postTypeId, slug: current.slug, deletedAt: null, NOT: { id: current.id } },
    });
    if (clash) {
      throw new AppError(`Another entry now uses the slug "${current.slug}"; change it before restoring`, 409, "SLUG_CONFLICT");
    }
  }
  const restored = await prisma.customEntry.update({
    where: { id: entry.id },
    data: { deletedAt: null, deletedById: null, deleteReason: null, status: "DRAFT" },
  });
  await recordAuditLog({
    userId,
    action: "CMS_ENTRY_RESTORED",
    targetResource: `cms_entry:${entry.id}`,
    details: { websiteId: entry.websiteId, postTypeId: entry.postTypeId, restoredAs: "DRAFT" },
  });
  return restored;
}

export interface PurgeRequestInput {
  entryIds?: unknown;
  reason?: unknown;
  singleOwnerException?: unknown;
}

export async function createPurgeRequest(websiteId: string, userId: string, authTime: Date | null, input: PurgeRequestInput) {
  await requireAdministrator(websiteId, userId);
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) throw new AppError("A reason is required for permanent deletion", 400, "REASON_REQUIRED");
  const entryIds = Array.isArray(input.entryIds) ? [...new Set(input.entryIds.filter((id): id is string => typeof id === "string"))] : [];
  if (entryIds.length === 0 || entryIds.length > 500) {
    throw new AppError("Select between 1 and 500 trashed entries", 400, "INVALID_MANIFEST");
  }

  const entries = await prisma.customEntry.findMany({
    where: { id: { in: entryIds }, postType: { websiteId } },
    select: { id: true, deletedAt: true, updatedAt: true },
  });
  if (entries.length !== entryIds.length) throw new AppError("Some entries were not found on this website", 404, "NOT_FOUND");
  const notTrashed = entries.filter((e) => !e.deletedAt).map((e) => e.id);
  if (notTrashed.length > 0) {
    throw new AppError("Only entries in trash can be purged", 409, "NOT_IN_TRASH");
  }

  const singleOwnerException = input.singleOwnerException === true;
  if (singleOwnerException) {
    const admins = await listWebsiteAdministrators(websiteId);
    admins.delete(userId);
    if (admins.size > 0) {
      throw new AppError("Another owner or admin can approve this purge, so the single-owner exception does not apply", 409, "INDEPENDENT_APPROVER_AVAILABLE");
    }
    if (!authTime || Date.now() - authTime.getTime() > FRESH_AUTH_WINDOW_MS) {
      throw new AppError("Sign in again within the last 15 minutes to use the single-owner exception", 401, "REAUTHENTICATION_REQUIRED");
    }
  }

  const manifest: ManifestItem[] = entries
    .map((e) => ({ entryId: e.id, updatedAt: e.updatedAt.toISOString() }))
    .sort((a, b) => a.entryId.localeCompare(b.entryId));
  const now = new Date();
  const request = await prisma.contentPurgeRequest.create({
    data: {
      websiteId,
      manifest,
      manifestHash: manifestHash(manifest),
      reason: reason.slice(0, 500),
      requestedById: userId,
      singleOwnerException,
      status: singleOwnerException ? "APPROVED" : "PENDING_APPROVAL",
      approvedById: singleOwnerException ? userId : null,
      approvedAt: singleOwnerException ? now : null,
      expiresAt: new Date(now.getTime() + PURGE_APPROVAL_TTL_MS),
    },
  });
  await recordAuditLog({
    userId,
    action: "CMS_PURGE_REQUESTED",
    targetResource: `content_purge_request:${request.id}`,
    details: { websiteId, entries: manifest.length, reason, singleOwnerException },
  });
  return request;
}

async function loadRequest(requestId: string) {
  const request = await prisma.contentPurgeRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new AppError("Purge request not found", 404, "NOT_FOUND");
  return request;
}

async function expireIfNeeded(request: { id: string; status: string; expiresAt: Date }) {
  if ((request.status === "PENDING_APPROVAL" || request.status === "APPROVED") && request.expiresAt.getTime() <= Date.now()) {
    await prisma.contentPurgeRequest.update({ where: { id: request.id }, data: { status: "EXPIRED" } });
    throw new AppError("This purge request has expired; create a new one", 409, "APPROVAL_EXPIRED");
  }
}

/** An independent owner/admin approves; the approval is valid for one hour. */
export async function approvePurgeRequest(requestId: string, userId: string) {
  const request = await loadRequest(requestId);
  try {
    await requireAdministrator(request.websiteId, userId);
  } catch (err: any) {
    if (err?.statusCode === 404) throw new AppError("Purge request not found", 404, "NOT_FOUND");
    throw err;
  }
  await expireIfNeeded(request);
  if (request.status !== "PENDING_APPROVAL") throw new AppError(`Request is ${request.status}`, 409, "INVALID_STATE");
  if (request.requestedById === userId) {
    throw new AppError("The approver must be someone other than the requester", 403, "INDEPENDENT_APPROVER_REQUIRED");
  }
  const now = new Date();
  const approved = await prisma.contentPurgeRequest.update({
    where: { id: request.id },
    data: { status: "APPROVED", approvedById: userId, approvedAt: now, expiresAt: new Date(now.getTime() + PURGE_APPROVAL_TTL_MS) },
  });
  await recordAuditLog({
    userId,
    action: "CMS_PURGE_APPROVED",
    targetResource: `content_purge_request:${request.id}`,
    details: { websiteId: request.websiteId, requestedById: request.requestedById },
  });
  return approved;
}

/**
 * Executes an approved purge. Authority, expiry and every manifest entry are re-checked inside the
 * transaction; if any entry was restored or changed, nothing is deleted.
 */
export async function executePurgeRequest(requestId: string, userId: string) {
  const request = await loadRequest(requestId);
  try {
    await requireAdministrator(request.websiteId, userId);
  } catch (err: any) {
    if (err?.statusCode === 404) throw new AppError("Purge request not found", 404, "NOT_FOUND");
    throw err;
  }
  await expireIfNeeded(request);
  if (request.status !== "APPROVED") throw new AppError(`Request is ${request.status}`, 409, "INVALID_STATE");
  if (userId !== request.requestedById && userId !== request.approvedById) {
    throw new AppError("Only the requester or approver can execute this purge", 403, "FORBIDDEN");
  }

  const manifest = request.manifest as ManifestItem[];
  if (manifestHash(manifest) !== request.manifestHash) {
    throw new AppError("The purge manifest does not match its recorded hash", 409, "MANIFEST_CHANGED");
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const claimed = await tx.contentPurgeRequest.updateMany({
      where: { id: request.id, status: "APPROVED" },
      data: { status: "EXECUTING" },
    });
    if (claimed.count !== 1) throw new AppError("This purge request is already being executed", 409, "INVALID_STATE");

    const current = await tx.customEntry.findMany({
      where: { id: { in: manifest.map((m) => m.entryId) }, postType: { websiteId: request.websiteId } },
      select: { id: true, deletedAt: true, updatedAt: true },
    });
    const byId = new Map(current.map((e) => [e.id, e]));
    const changed = manifest.filter((m) => {
      const e = byId.get(m.entryId);
      return !e || !e.deletedAt || e.updatedAt.toISOString() !== m.updatedAt;
    });
    if (changed.length > 0) {
      throw new AppError(
        `${changed.length} entr${changed.length === 1 ? "y was" : "ies were"} restored or changed after approval; nothing was purged`,
        409,
        "MANIFEST_CHANGED"
      );
    }
    const result = await tx.customEntry.deleteMany({ where: { id: { in: manifest.map((m) => m.entryId) }, deletedAt: { not: null } } });
    await tx.contentPurgeRequest.update({ where: { id: request.id }, data: { status: "EXECUTED", executedAt: new Date() } });
    return result.count;
  });

  await recordAuditLog({
    userId,
    action: "CMS_ENTRIES_PURGED",
    targetResource: `content_purge_request:${request.id}`,
    details: { websiteId: request.websiteId, purgedEntries: deleted, approvedById: request.approvedById, singleOwnerException: request.singleOwnerException },
  });
  return { purged: deleted };
}

export async function listPurgeRequests(websiteId: string) {
  return prisma.contentPurgeRequest.findMany({ where: { websiteId }, orderBy: { createdAt: "desc" }, take: 50 });
}
