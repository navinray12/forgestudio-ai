import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { tenantScopeOf } from "../middlewares/tenantScope.middleware.js";
import { getWebsiteRecord, putWebsiteRecord, type WebsiteRecord } from "../services/websiteRecords.service.js";
import { SYSTEM_PERMISSIONS } from "../services/ownerExperience/dynamicPermissionEngine.service.js";
import {
  scrubSensitiveDraftContent,
  type LocalDraftSnapshot,
} from "../services/ownerExperience/privacySafeDraftRecovery.service.js";

/**
 * Owner experience (blueprint §11). Recovery drafts are durable, private to the session user and
 * scoped to a website that user belongs to.
 *
 * Not exposed:
 * - /view, /permissions: the permission engine evaluates OWNER/ADMIN/DESIGNER/… roles, but the
 *   session carries the platform role (USER, ADMIN, …) and no mapping from website membership to
 *   an engine role exists, so the answer would not reflect what the user can actually do.
 * - /roles/custom: custom roles live in process memory and no authorization path consumes them.
 * - /editor-state/*: a process-local state machine that a client can move to LIVE_VERIFIED
 *   without anything being published. The publish authority is deployments + publishing.service.
 * - /journeys/execute: runs scripted journeys against that same in-memory state and reports them
 *   as PASSED acceptance results.
 */
const draftId = z.string().trim().min(1).max(80);

const draftInput = z.object({
  draftId: draftId.default("main-editor"),
  clientVersion: z.number().int().min(1),
  content: z.record(z.string(), z.unknown()),
});

const recoveryQuery = z.object({ serverVersion: z.coerce.number().int().min(1) });

type StoredDraft = Omit<LocalDraftSnapshot, "createdAt" | "updatedAt">;

const toDraft = (record: WebsiteRecord<StoredDraft>): LocalDraftSnapshot => ({
  ...record.data,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

/** A draft is addressed by its owner as well as its id, so one user can never read another's. */
const draftKey = (userId: string, id: string) => `${userId}:${id}`;

export async function getPermissionCatalog(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, permissions: SYSTEM_PERMISSIONS });
  } catch (error) {
    next(error);
  }
}

export async function storeLocalDraftHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = tenantScopeOf(res);
    const userId: string = res.locals.user.id;
    const input = draftInput.parse(req.body);
    const content = scrubSensitiveDraftContent(input.content);
    const { record, outcome } = await putWebsiteRecord<StoredDraft>({
      scope,
      kind: "LOCAL_DRAFT",
      key: draftKey(userId, input.draftId),
      data: {
        draftId: input.draftId,
        userId,
        workspaceId: scope.tenantId,
        websiteId: scope.websiteId,
        clientVersion: input.clientVersion,
        content,
        isQuarantined: false,
        isServerAcknowledged: false, // a recovery copy is never a saved document
      },
      request: { clientVersion: input.clientVersion, content },
      userId,
    });
    res.status(outcome === "CREATED" ? 201 : 200).json({
      success: true,
      draft: toDraft(record),
      idempotentReplay: outcome === "REPLAYED",
    });
  } catch (error) {
    next(error);
  }
}

export async function evaluateLocalDraftHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = tenantScopeOf(res);
    const id = draftId.parse(req.params.draftId);
    const { serverVersion } = recoveryQuery.parse(req.query);
    const record = await getWebsiteRecord<StoredDraft>(scope, "LOCAL_DRAFT", draftKey(res.locals.user.id, id));
    if (!record) {
      res.json({ success: true, eligibleForRecovery: false, isStale: false, serverVersion, localVersion: 0, actionRequired: "NONE" });
      return;
    }
    const isStale = serverVersion > record.data.clientVersion;
    res.json({
      success: true,
      eligibleForRecovery: true,
      isStale,
      serverVersion,
      localVersion: record.data.clientVersion,
      actionRequired: isStale ? "CONFLICT_RESOLUTION_REQUIRED" : "RESTORE_SAFE",
      draft: toDraft(record),
    });
  } catch (error) {
    next(error);
  }
}
