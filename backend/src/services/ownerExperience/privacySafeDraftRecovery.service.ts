import { AppError } from "../../utils/app-error.js";
import { redactSensitiveData } from "./authoritativeAuthorization.service.js";

export interface LocalDraftSnapshot {
  draftId: string;
  userId: string;
  workspaceId: string;
  websiteId: string;
  clientVersion: number;
  content: any;
  createdAt: string;
  updatedAt: string;
  isQuarantined: boolean;
  quarantineReason?: string;
  isServerAcknowledged: boolean; // MUST ALWAYS BE FALSE FOR LOCAL RECOVERY COPIES
}

export interface DraftRecoveryCheckResult {
  eligibleForRecovery: boolean;
  isStale: boolean;
  serverVersion: number;
  localVersion: number;
  actionRequired: "RESTORE_SAFE" | "CONFLICT_RESOLUTION_REQUIRED" | "REAUTHENTICATION_REQUIRED" | "NONE";
  draft?: LocalDraftSnapshot;
}

// In-memory local draft recovery store (keyed by userId:workspaceId:websiteId:draftId)
const localDraftStore = new Map<string, LocalDraftSnapshot>();

function buildDraftKey(userId: string, workspaceId: string, websiteId: string, draftId: string): string {
  return `${userId}:${workspaceId}:${websiteId}:${draftId}`;
}

// ---------------------------------------------------------------------------
// 1. Scrub Sensitive Data from Draft Content
// ---------------------------------------------------------------------------
export function scrubSensitiveDraftContent(content: any): any {
  if (!content || typeof content !== "object") return content;

  // Deep clone and redact sensitive attributes
  const scrubbed = redactSensitiveData(content);

  // If content contains form submissions or user lead records, strip PII
  if (scrubbed.formSubmissions) {
    scrubbed.formSubmissions = []; // Never persist raw inbound leads in browser local draft caches
  }
  if (scrubbed.secrets) {
    scrubbed.secrets = {};
  }
  return scrubbed;
}

// ---------------------------------------------------------------------------
// 2. Draft Storage & Recovery Functions
// ---------------------------------------------------------------------------

/**
 * Stores a client-side recovery snapshot safely.
 * Strips secrets, marks isServerAcknowledged = false, scopes strictly to tenant.
 */
export function storeLocalRecoveryDraft(params: {
  userId: string;
  workspaceId: string;
  websiteId: string;
  draftId: string;
  clientVersion: number;
  content: any;
}): LocalDraftSnapshot {
  const { userId, workspaceId, websiteId, draftId, clientVersion, content } = params;

  if (!userId || !workspaceId || !websiteId || !draftId) {
    throw new AppError("All tenancy scopes required for draft recovery", 400, "BAD_REQUEST");
  }

  const cleanContent = scrubSensitiveDraftContent(content);
  const key = buildDraftKey(userId, workspaceId, websiteId, draftId);

  const snapshot: LocalDraftSnapshot = {
    draftId,
    userId,
    workspaceId,
    websiteId,
    clientVersion,
    content: cleanContent,
    createdAt: localDraftStore.get(key)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isQuarantined: false,
    isServerAcknowledged: false, // Invariant: Local recovery copies are NEVER labeled server-saved
  };

  localDraftStore.set(key, snapshot);
  return snapshot;
}

/**
 * Checks recovery eligibility against current server state.
 * Detects stale local drafts and requires conflict resolution if server is newer.
 */
export function evaluateDraftRecovery(params: {
  userId: string;
  workspaceId: string;
  websiteId: string;
  draftId: string;
  serverVersion: number;
  isUserReauthenticated?: boolean;
}): DraftRecoveryCheckResult {
  const { userId, workspaceId, websiteId, draftId, serverVersion, isUserReauthenticated = true } = params;
  const key = buildDraftKey(userId, workspaceId, websiteId, draftId);
  const draft = localDraftStore.get(key);

  if (!draft) {
    return {
      eligibleForRecovery: false,
      isStale: false,
      serverVersion,
      localVersion: 0,
      actionRequired: "NONE",
    };
  }

  // Quarantine check (e.g. shared device or logged out)
  if (draft.isQuarantined && !isUserReauthenticated) {
    return {
      eligibleForRecovery: false,
      isStale: false,
      serverVersion,
      localVersion: draft.clientVersion,
      actionRequired: "REAUTHENTICATION_REQUIRED",
      draft,
    };
  }

  // Stale detection: if server version has advanced past local draft version
  const isStale = serverVersion > draft.clientVersion;

  return {
    eligibleForRecovery: true,
    isStale,
    serverVersion,
    localVersion: draft.clientVersion,
    actionRequired: isStale ? "CONFLICT_RESOLUTION_REQUIRED" : "RESTORE_SAFE",
    draft,
  };
}

/**
 * Quarantines drafts on user logout or account switch on shared devices.
 */
export function quarantineUserDrafts(userId: string, reason = "User logged out or switched accounts") {
  for (const [key, draft] of localDraftStore.entries()) {
    if (draft.userId === userId) {
      draft.isQuarantined = true;
      draft.quarantineReason = reason;
      localDraftStore.set(key, draft);
    }
  }
}

/**
 * Clears expired or unquarantined drafts upon successful publication.
 */
export function purgeRecoveredDraft(userId: string, workspaceId: string, websiteId: string, draftId: string) {
  const key = buildDraftKey(userId, workspaceId, websiteId, draftId);
  localDraftStore.delete(key);
}
