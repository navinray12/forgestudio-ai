import { AppError } from "../../utils/app-error.js";

export type TruthfulEditorState =
  | "UNSAVED"
  | "SAVING"
  | "DRAFT_ACKNOWLEDGED"
  | "CONFLICT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PARTIALLY_PROPAGATED"
  | "LIVE_VERIFIED"
  | "FAILED";

export interface ConflictSnapshot {
  conflictId: string;
  websiteId: string;
  scope: string; // e.g. "document" or element ID
  clientDocumentVersion: number;
  serverDocumentVersion: number;
  clientContent: any;
  serverContent: any;
  conflictDetectedAt: string;
  autoRegenerationLocked: boolean;
  status: "ACTIVE" | "RESOLVED";
}

export interface EditorLifecycleRecord {
  websiteId: string;
  currentState: TruthfulEditorState;
  documentVersion: number;
  lastAcknowledgedAt?: string;
  scheduledPublishUtc?: string;
  activeConflict?: ConflictSnapshot;
  lastFailureReason?: string;
  history: Array<{
    fromState: TruthfulEditorState;
    toState: TruthfulEditorState;
    timestamp: string;
    actorId?: string;
    reason?: string;
  }>;
}

// In-memory lifecycle store for active editor sessions
const editorSessionRecords = new Map<string, EditorLifecycleRecord>();

// ---------------------------------------------------------------------------
// 1. Legal State Transition Matrix
// ---------------------------------------------------------------------------
const LEGAL_TRANSITIONS: Record<TruthfulEditorState, TruthfulEditorState[]> = {
  UNSAVED: ["SAVING", "FAILED"],
  SAVING: ["DRAFT_ACKNOWLEDGED", "CONFLICT", "FAILED"],
  DRAFT_ACKNOWLEDGED: ["UNSAVED", "SAVING", "PENDING_APPROVAL", "APPROVED", "FAILED"],
  CONFLICT: ["SAVING", "DRAFT_ACKNOWLEDGED", "FAILED"],
  PENDING_APPROVAL: ["APPROVED", "DRAFT_ACKNOWLEDGED", "FAILED"],
  APPROVED: ["SCHEDULED", "PUBLISHING", "DRAFT_ACKNOWLEDGED", "FAILED"],
  SCHEDULED: ["PUBLISHING", "APPROVED", "FAILED"],
  PUBLISHING: ["PARTIALLY_PROPAGATED", "LIVE_VERIFIED", "FAILED"],
  PARTIALLY_PROPAGATED: ["LIVE_VERIFIED", "FAILED"],
  LIVE_VERIFIED: ["UNSAVED", "SAVING", "DRAFT_ACKNOWLEDGED"],
  FAILED: ["UNSAVED", "SAVING", "DRAFT_ACKNOWLEDGED"],
};

// ---------------------------------------------------------------------------
// 2. Lifecycle Engine
// ---------------------------------------------------------------------------

export function getOrCreateEditorSession(websiteId: string, initialVersion = 1): EditorLifecycleRecord {
  let record = editorSessionRecords.get(websiteId);
  if (!record) {
    record = {
      websiteId,
      currentState: "DRAFT_ACKNOWLEDGED",
      documentVersion: initialVersion,
      lastAcknowledgedAt: new Date().toISOString(),
      history: [
        {
          fromState: "UNSAVED",
          toState: "DRAFT_ACKNOWLEDGED",
          timestamp: new Date().toISOString(),
          reason: "Initial session established",
        },
      ],
    };
    editorSessionRecords.set(websiteId, record);
  }
  return record;
}

/**
 * Validates and transitions editor state truthfully.
 */
export function transitionEditorState(params: {
  websiteId: string;
  targetState: TruthfulEditorState;
  actorId?: string;
  reason?: string;
  failureReason?: string;
  scheduledUtc?: string;
}): EditorLifecycleRecord {
  const { websiteId, targetState, actorId, reason, failureReason, scheduledUtc } = params;
  const record = getOrCreateEditorSession(websiteId);

  const allowedNext = LEGAL_TRANSITIONS[record.currentState];
  if (!allowedNext.includes(targetState)) {
    throw new AppError(
      `Illegal editor state transition from ${record.currentState} to ${targetState}`,
      409,
      "ILLEGAL_STATE_TRANSITION"
    );
  }

  const fromState = record.currentState;
  record.currentState = targetState;

  if (targetState === "DRAFT_ACKNOWLEDGED") {
    record.lastAcknowledgedAt = new Date().toISOString();
    record.lastFailureReason = undefined;
  } else if (targetState === "FAILED" && failureReason) {
    record.lastFailureReason = failureReason;
  } else if (targetState === "SCHEDULED" && scheduledUtc) {
    record.scheduledPublishUtc = scheduledUtc;
  }

  record.history.push({
    fromState,
    toState: targetState,
    timestamp: new Date().toISOString(),
    actorId,
    reason: reason || failureReason,
  });

  return record;
}

/**
 * Handles optimistic document persistence.
 * If expected client version does not match server version, enters CONFLICT state,
 * preserving both sides and locking automatic AI regeneration for that scope.
 */
export function processSaveAttempt(params: {
  websiteId: string;
  actorId: string;
  expectedVersion: number;
  serverVersion: number;
  clientContent: any;
  serverContent: any;
}): {
  status: "SAVED" | "CONFLICT";
  record: EditorLifecycleRecord;
  conflict?: ConflictSnapshot;
} {
  const { websiteId, actorId, expectedVersion, serverVersion, clientContent, serverContent } = params;
  const record = getOrCreateEditorSession(websiteId, serverVersion);

  // Transition to SAVING
  transitionEditorState({ websiteId, targetState: "SAVING", actorId, reason: "Persistence in progress" });

  if (expectedVersion !== serverVersion) {
    // Version mismatch: CONFLICT!
    const conflict: ConflictSnapshot = {
      conflictId: `conflict:${websiteId}:${Date.now().toString(36)}`,
      websiteId,
      scope: "document",
      clientDocumentVersion: expectedVersion,
      serverDocumentVersion: serverVersion,
      clientContent,
      serverContent,
      conflictDetectedAt: new Date().toISOString(),
      autoRegenerationLocked: true, // Lock AI auto-regen to prevent corrupted overwrites
      status: "ACTIVE",
    };

    record.activeConflict = conflict;
    transitionEditorState({
      websiteId,
      targetState: "CONFLICT",
      actorId,
      reason: `Optimistic version conflict: expected v${expectedVersion}, found server v${serverVersion}`,
    });

    return { status: "CONFLICT", record, conflict };
  }

  // Version matches: increment version and acknowledge draft
  record.documentVersion = serverVersion + 1;
  record.activeConflict = undefined;
  transitionEditorState({
    websiteId,
    targetState: "DRAFT_ACKNOWLEDGED",
    actorId,
    reason: `Draft acknowledged at revision v${record.documentVersion}`,
  });

  return { status: "SAVED", record };
}

/**
 * Resolves an active conflict using explicit 3-way base-aware choice.
 */
export function resolveEditorConflict(params: {
  websiteId: string;
  actorId: string;
  conflictId: string;
  strategy: "ACCEPT_SERVER" | "FORCE_AUTHORIZED_OVERWRITE" | "MERGE_RESOLVED";
  resolvedContent?: any;
}): EditorLifecycleRecord {
  const { websiteId, actorId, conflictId, strategy, resolvedContent } = params;
  const record = getOrCreateEditorSession(websiteId);

  if (!record.activeConflict || record.activeConflict.conflictId !== conflictId) {
    throw new AppError("No matching active conflict found for this website", 404, "CONFLICT_NOT_FOUND");
  }

  if (record.currentState !== "CONFLICT") {
    throw new AppError("Session is not currently in a CONFLICT state", 409, "INVALID_STATE");
  }

  record.activeConflict.status = "RESOLVED";
  record.activeConflict.autoRegenerationLocked = false; // Unlock auto-regen

  if (strategy === "ACCEPT_SERVER") {
    // Keep server version
    transitionEditorState({
      websiteId,
      targetState: "DRAFT_ACKNOWLEDGED",
      actorId,
      reason: "Conflict resolved: accepted server version",
    });
  } else if (strategy === "FORCE_AUTHORIZED_OVERWRITE" || strategy === "MERGE_RESOLVED") {
    // Increment document version to reflect new resolution
    record.documentVersion += 1;
    transitionEditorState({
      websiteId,
      targetState: "DRAFT_ACKNOWLEDGED",
      actorId,
      reason: `Conflict resolved via ${strategy} at v${record.documentVersion}`,
    });
  }

  record.activeConflict = undefined;
  return record;
}
