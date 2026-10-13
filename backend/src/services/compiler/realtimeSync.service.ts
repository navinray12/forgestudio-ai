/**
 * ForgeStudio Execution Blueprint v2.1 — Point 34
 * Real-Time Bidirectional Synchronization Service
 *
 * Implements:
 * 1. Semantic visual-to-code operations pipeline (drag, property_update, text_edit, insert, remove, reorder)
 *    with operation/change-set IDs and echo suppression per view/session.
 * 2. AST targeted updates preserving untouched and source-owned regions.
 * 3. Independent buffer revisions and saved file revisions.
 * 4. 9-state save and recovery state machine:
 *    LOCAL_CHANGES, SAVING, DRAFT_SAVED, SYNCHRONIZED, INVALID_SOURCE, CONFLICT,
 *    PROJECTION_DELAYED_FAILED, PREVIEW_READY, RELEASE_VERIFIED.
 * 5. Three-way semantic reconciliation for nonoverlapping edits.
 * 6. Conflict records persistence and resolution (CODE_WINS, VISUAL_WINS, MANUAL_MERGE, DUPLICATE_AS_DRAFT).
 * 7. Undo stack as inverse operations against actor history.
 * 8. Reconnect resumption from sequence numbers with event gap detection and bounded offline queues.
 */

import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import { prisma } from "../../config/prisma.js";
import { WorkspaceCoordinatorService, WorkspaceCheckpoint } from "../workspace/workspaceCoordinator.service.js";
import { updateJsxElementViaAst, validateSourceSyntax, syncVisualElementToSource } from "./visualCodeSync.service.js";
import { findCommittedChangeSet, recordCheckpoint, reconcileUnannouncedChanges } from "../workspace/workspaceCheckpoints.service.js";
import { readFile as readProjectFile } from "../project/forgeFilesystem.service.js";
import type { JsxMutation, JsxMutationCode } from "./jsxAstMutation.js";

const db = prisma as any;

export type VisualSemanticOpType =
  | "DRAG"
  | "PROPERTY_UPDATE"
  | "TEXT_EDIT"
  | "INSERT"
  | "REMOVE"
  | "REORDER";

export type SaveStateMachineState =
  | "LOCAL_CHANGES"
  | "SAVING"
  | "DRAFT_SAVED"
  | "SYNCHRONIZED"
  | "INVALID_SOURCE"
  | "CONFLICT"
  | "PROJECTION_DELAYED_FAILED"
  | "PREVIEW_READY"
  | "RELEASE_VERIFIED";

export interface VisualOperationPayload {
  projectId: string;
  pageId: string;
  nodeId: string;
  operationType: VisualSemanticOpType;
  propertyKey?: string;
  newValue?: any;
  oldValue?: any;
  reorderIndex?: number;
  parentNodeId?: string;
  baseCheckpointId: string;
  expectedRevision: number;
  actorId: string;
  tenantId: string;
  operationId: string;
  viewId: string; // Used for multi-tab / session echo suppression
}

export interface CommittedOperationResult {
  operationId: string;
  success: boolean;
  /** True only when the operation changed the source and the change was committed. */
  sourceChanged: boolean;
  /** Why the edit was not applied (see JsxMutationCode); absent when it was. */
  rejectionCode?: JsxMutationCode;
  sequenceNumber: number;
  committedFileHashes: Record<string, string>;
  committedRevision: number;
  changedRanges: Array<{ filePath: string; startLine: number; endLine: number }>;
  pageRegistryRevision: number;
  checkpointId: string;
  echoSuppressedForViews: string[];
  syncStatus: SaveStateMachineState;
  diagnostics: Array<{ severity: "info" | "warn" | "error"; message: string }>;
}

export interface ConflictRecord {
  conflictId: string;
  projectId: string;
  baseCheckpointId: string;
  visualProposal: any;
  codeProposal: any;
  affectedNodes: string[];
  affectedFiles: string[];
  affectedRanges: Array<{ filePath: string; lineRange: [number, number] }>;
  reason: string;
  resolutionChoices: Array<"CODE_WINS" | "VISUAL_WINS" | "MANUAL_MERGE" | "DUPLICATE_AS_DRAFT">;
  authorId: string;
  status: "OPEN" | "RESOLVED";
  resolvedAt?: string;
  chosenResolution?: "CODE_WINS" | "VISUAL_WINS" | "MANUAL_MERGE" | "DUPLICATE_AS_DRAFT";
  mergedResult?: any;
}

export interface InverseOperation {
  inverseOpId: string;
  originalOperationId: string;
  actorId: string;
  projectId: string;
  pageId: string;
  nodeId: string;
  inverseType: VisualSemanticOpType;
  revertPayload: any;
  timestamp: string;
}

/** The part of an editor operation that describes the edit itself. */
export type SemanticOperation = Pick<VisualOperationPayload, "operationType" | "propertyKey" | "newValue" | "reorderIndex" | "parentNodeId">;

export interface DurableOperationInput {
  projectId: string;
  websiteId?: string | null;
  actorId: string;
  /** Client-generated; a repeat with the same ID returns the stored acknowledgement. */
  operationId: string;
  viewId?: string;
  filePath: string;
  elementId: string;
  /** Either an explicit mutation or a semantic editor operation. */
  mutation?: JsxMutation;
  operation?: SemanticOperation;
  /** The file version the edit was made against. */
  expectedRevision: number;
}

export interface OperationAck {
  operationId: string;
  /**
   * applied: the source changed and a checkpoint was recorded. unchanged: the source already
   * matched. rejected: the edit is not acceptable (see code). conflict: the file is at another
   * version (see version). error: the server could not complete the operation.
   */
  status: "applied" | "unchanged" | "rejected" | "conflict" | "error";
  filePath: string;
  elementId: string;
  viewId?: string;
  /** The file version after the operation (for a conflict: the current version). */
  version?: number;
  /** Sequence of the checkpoint recorded for an applied operation. */
  sequence?: number | null;
  code?: string;
  message?: string;
  changedRange?: { startLine: number; endLine: number };
  replayed?: boolean;
}

/**
 * NOTE: the Maps below, and WorkspaceCoordinatorService's in-memory revision store used by
 * processVisualOperation, are process-local. They back the single-process simulation exercised by
 * the Point 34 unit tests and the reference benchmark only. The live path is
 * commitDurableOperation: file versions, checkpoints, sequence numbers and idempotency all live in
 * PostgreSQL, so it holds no state of its own and survives a restart.
 */
export class RealtimeSyncService {
  /**
   * Applies one visual operation to a persisted source file and records it durably.
   * Idempotency: the checkpoint row carries the operation ID (unique per project).
   * Ordering: the edit is bound to `expectedRevision` by an atomic compare-and-set on the file.
   * Never throws for an operation-level outcome; the acknowledgement says what happened.
   */
  public static async commitDurableOperation(
    input: DurableOperationInput,
    deps: { recordCheckpoint: typeof recordCheckpoint; reconcile: typeof reconcileUnannouncedChanges } = {
      recordCheckpoint,
      reconcile: reconcileUnannouncedChanges,
    }
  ): Promise<OperationAck> {
    const { projectId, operationId, filePath, elementId, viewId } = input;
    const base = { operationId, filePath, elementId, ...(viewId ? { viewId } : {}) };
    const changeSetId = `op:${operationId}`.slice(0, 128);
    const replay = async (): Promise<OperationAck | null> => {
      const committed = await findCommittedChangeSet(projectId, changeSetId);
      return committed ? { ...(committed.response as OperationAck), sequence: committed.checkpoint.sequence, replayed: true } : null;
    };
    const currentVersion = async () => {
      try { return (await readProjectFile(projectId, filePath)).version as number; } catch { return undefined; }
    };

    try {
      const earlier = await replay();
      if (earlier) return earlier;

      const mutation = input.mutation ?? (input.operation ? this.toJsxMutation(input.operation) : null);
      if (!mutation) {
        return { ...base, status: "rejected", code: "UNSUPPORTED", message: "The operation does not describe a supported source edit." };
      }
      if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
        return { ...base, status: "rejected", code: "REVISION_REQUIRED", message: "expectedRevision (the file version the edit was made against) is required." };
      }

      let result;
      try {
        result = await syncVisualElementToSource(projectId, filePath, { id: elementId }, {
          authorId: input.actorId,
          expectedRevision: input.expectedRevision,
          mutation,
        });
      } catch (err: any) {
        if (err instanceof AppError && (err.code === "REVISION_CONFLICT" || err.code === "CONCURRENCY_CONFLICT")) {
          // A concurrent duplicate of this very operation (possibly on another instance) may be
          // committing right now: its file write is done and its checkpoint is about to land.
          for (let attempt = 0; attempt < 4; attempt++) {
            const duplicate = await replay();
            if (duplicate) return duplicate;
            await new Promise((resolve) => setTimeout(resolve, 75));
          }
          return { ...base, status: "conflict", code: "REVISION_CONFLICT", message: err.message, version: await currentVersion() };
        }
        if (err instanceof AppError && err.statusCode < 500) {
          return { ...base, status: "rejected", code: err.code, message: err.message };
        }
        throw err;
      }

      if (!result.updated) {
        if (result.success) return (await replay()) ?? { ...base, status: "unchanged", code: "NO_CHANGE", version: result.version };
        return { ...base, status: "rejected", code: result.code ?? "REJECTED", message: result.diagnostics[0]?.message, version: result.version };
      }

      // The file is written. The checkpoint is what announces the change and makes the operation
      // idempotent, and it is a second statement: if it cannot be recorded now, the change must
      // not stay unannounced. Try again, then fall back to the recovery checkpoint, which any
      // instance also records later for whatever is still missing (see reconcileUnannouncedChanges).
      const ack: OperationAck = { ...base, status: "applied", version: result.version, changedRange: result.changedRange };
      let failure: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const checkpoint = await deps.recordCheckpoint({
            projectId,
            websiteId: input.websiteId ?? null,
            origin: "VISUAL",
            kind: "SOURCE_ONLY",
            filePath,
            message: `Visual ${mutation.type} on ${elementId}`,
            changeSetId,
            response: ack,
            actorId: input.actorId,
          });
          return { ...ack, sequence: checkpoint.sequence };
        } catch (err) {
          failure = err;
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
      console.error("[workspace-sync] checkpoint not recorded after a committed write:", (failure as any)?.message || failure);
      try {
        const recovered = await deps.reconcile(projectId, { graceMs: 0, websiteId: input.websiteId ?? null });
        if (recovered) return { ...ack, sequence: recovered.sequence, code: "CHECKPOINT_RECOVERED" };
      } catch (err: any) {
        console.error("[workspace-sync] recovery checkpoint failed:", err?.message || err);
      }
      // Stored but not yet announced; the gateway's periodic recovery will announce it.
      return { ...ack, status: "error", code: "CHECKPOINT_PENDING", sequence: null, message: "The edit was saved, but it has not been announced to other clients yet." };
    } catch (err: any) {
      console.error("[workspace-sync] operation failed:", err?.message || err);
      // The file may or may not have been written; the client must re-read the file version.
      return { ...base, status: "error", code: "PERSISTENCE_ERROR", message: "The operation could not be completed.", version: await currentVersion() };
    }
  }

  /** Map of project sequence counters: projectId -> currentSequenceNumber */
  private static projectSequences = new Map<string, number>();

  /** Map of committed operations for idempotency: operationId -> CommittedOperationResult */
  private static committedOperations = new Map<string, CommittedOperationResult>();

  /** Map of view acknowledged sequences: viewId -> lastAckSequence */
  private static viewAcknowledgedSequences = new Map<string, number>();

  /** In-memory state machine tracker: projectId -> SaveStateMachineState */
  private static projectSaveStates = new Map<string, SaveStateMachineState>();

  /** Conflict records store: conflictId -> ConflictRecord */
  private static conflictStore = new Map<string, ConflictRecord>();

  /** Undo stack: actorId -> InverseOperation[] */
  private static actorUndoStacks = new Map<string, InverseOperation[]>();

  /** Buffer revision store (independent of saved disk revisions): `${projectId}:${filePath}` -> bufferRevision */
  private static bufferRevisions = new Map<string, number>();

  /** Maximum offline queue limit per client */
  public static readonly MAX_OFFLINE_QUEUE_SIZE = 100;

  /**
   * Get current project sequence number
   */
  public static getProjectSequence(projectId: string): number {
    return this.projectSequences.get(projectId) || 0;
  }

  /**
   * Increment and return project sequence number
   */
  public static nextProjectSequence(projectId: string): number {
    const next = (this.projectSequences.get(projectId) || 0) + 1;
    this.projectSequences.set(projectId, next);
    return next;
  }

  /**
   * Get current state of the Save & Recovery state machine
   */
  public static getSaveState(projectId: string): SaveStateMachineState {
    return this.projectSaveStates.get(projectId) || "SYNCHRONIZED";
  }

  /**
   * Transition Save & Recovery state machine with valid transitions
   */
  public static transitionSaveState(projectId: string, newState: SaveStateMachineState): SaveStateMachineState {
    const validStates: SaveStateMachineState[] = [
      "LOCAL_CHANGES",
      "SAVING",
      "DRAFT_SAVED",
      "SYNCHRONIZED",
      "INVALID_SOURCE",
      "CONFLICT",
      "PROJECTION_DELAYED_FAILED",
      "PREVIEW_READY",
      "RELEASE_VERIFIED",
    ];

    if (!validStates.includes(newState)) {
      throw new AppError(`Invalid state machine transition target: ${newState}`, 400, "INVALID_STATE");
    }

    this.projectSaveStates.set(projectId, newState);
    return newState;
  }

  /**
   * Maintain independent buffer revisions for open editors
   */
  public static getBufferRevision(projectId: string, filePath: string): number {
    const key = `${projectId}:${filePath}`;
    return this.bufferRevisions.get(key) || 1;
  }

  public static incrementBufferRevision(projectId: string, filePath: string): number {
    const key = `${projectId}:${filePath}`;
    const next = (this.bufferRevisions.get(key) || 1) + 1;
    this.bufferRevisions.set(key, next);
    return next;
  }

  /**
   * Maps a semantic editor operation to a source mutation, or null when the payload does not
   * describe one (for example a free-position drag with no target parent or index).
   */
  public static toJsxMutation(payload: SemanticOperation): JsxMutation | null {
    const { operationType, propertyKey, newValue, reorderIndex, parentNodeId } = payload;
    switch (operationType) {
      case "TEXT_EDIT":
        return { type: "SET_TEXT", text: String(newValue ?? "") };
      case "PROPERTY_UPDATE": {
        if (!propertyKey) return null;
        if (["content", "textContent", "text", "buttonText"].includes(propertyKey)) {
          return { type: "SET_TEXT", text: String(newValue ?? "") };
        }
        if (propertyKey === "className" || propertyKey === "classes") {
          const classes = Array.isArray(newValue) ? newValue : String(newValue ?? "").split(/\s+/).filter(Boolean);
          return { type: "SET_CLASSES", classes };
        }
        if (propertyKey === "style" || propertyKey === "styles") {
          return newValue && typeof newValue === "object" ? { type: "SET_STYLE", style: newValue } : null;
        }
        if (propertyKey.startsWith("style.") || propertyKey.startsWith("styles.")) {
          return { type: "SET_STYLE", style: { [propertyKey.slice(propertyKey.indexOf(".") + 1)]: newValue ?? null } };
        }
        return { type: "SET_PROP", name: propertyKey, value: newValue ?? null };
      }
      case "INSERT":
        if (!parentNodeId || !newValue || typeof newValue !== "object") return null;
        return { type: "INSERT", parentId: parentNodeId, index: reorderIndex, element: newValue };
      case "REMOVE":
        return { type: "REMOVE" };
      case "REORDER":
      case "DRAG":
        if (parentNodeId) return { type: "MOVE", parentId: parentNodeId, index: reorderIndex };
        return reorderIndex === undefined ? null : { type: "REORDER", index: reorderIndex };
      default:
        return null;
    }
  }

  /**
   * 2.1 Process Visual-to-Code Semantic Operation
   */
  public static async processVisualOperation(
    payload: VisualOperationPayload,
    filePath: string,
    existingSourceCode: string
  ): Promise<CommittedOperationResult> {
    const {
      projectId,
      pageId,
      nodeId,
      operationType,
      propertyKey,
      newValue,
      oldValue,
      reorderIndex,
      baseCheckpointId,
      expectedRevision,
      actorId,
      tenantId,
      operationId,
      viewId,
    } = payload;

    // 1. Lost response check (Idempotency)
    if (this.committedOperations.has(operationId)) {
      const existing = this.committedOperations.get(operationId)!;
      // Register echo suppression for caller view
      if (!existing.echoSuppressedForViews.includes(viewId)) {
        existing.echoSuppressedForViews.push(viewId);
      }
      return existing;
    }

    // 2. State transition -> SAVING
    this.transitionSaveState(projectId, "SAVING");

    // 3. Expected Revision Check against authoritative Workspace Coordinator
    const currentRevision = WorkspaceCoordinatorService.getCurrentRevision(projectId);
    if (expectedRevision !== currentRevision) {
      this.transitionSaveState(projectId, "CONFLICT");
      const conflictId = `conf_${crypto.randomUUID()}`;
      const conflictRecord: ConflictRecord = {
        conflictId,
        projectId,
        baseCheckpointId,
        visualProposal: payload,
        codeProposal: { currentRevision, filePath },
        affectedNodes: [nodeId],
        affectedFiles: [filePath],
        affectedRanges: [{ filePath, lineRange: [1, 10] }],
        reason: `Expected revision ${expectedRevision} does not match current workspace revision ${currentRevision}`,
        resolutionChoices: ["CODE_WINS", "VISUAL_WINS", "MANUAL_MERGE", "DUPLICATE_AS_DRAFT"],
        authorId: actorId,
        status: "OPEN",
      };
      this.conflictStore.set(conflictId, conflictRecord);

      throw new AppError(
        `Revision conflict: expected revision ${expectedRevision}, current is ${currentRevision}. Conflict ID: ${conflictId}`,
        409,
        "REVISION_CONFLICT"
      );
    }

    // 4. Apply the semantic operation to the source through the AST. Nothing is committed unless
    //    the source actually changed: a rejected or no-op edit is reported as such.
    const mutation = this.toJsxMutation(payload);
    const astResult = mutation
      ? updateJsxElementViaAst(existingSourceCode, String(nodeId), mutation, filePath)
      : {
          updated: false as const,
          content: existingSourceCode,
          code: "UNSUPPORTED" as const,
          diagnostic: `Operation ${operationType} does not describe a supported source edit.`,
        };

    if (!astResult.updated) {
      const noChange = astResult.code === "NO_CHANGE";
      const result: CommittedOperationResult = {
        operationId,
        success: noChange,
        sourceChanged: false,
        rejectionCode: astResult.code,
        sequenceNumber: this.projectSequences.get(projectId) || 0,
        committedFileHashes: {},
        committedRevision: currentRevision,
        changedRanges: [],
        pageRegistryRevision: 1,
        checkpointId: WorkspaceCoordinatorService.getLatestCheckpoint(projectId)?.checkpointId || baseCheckpointId,
        echoSuppressedForViews: [viewId],
        syncStatus: noChange ? "SYNCHRONIZED" : astResult.code === "INVALID_SOURCE" ? "INVALID_SOURCE" : "LOCAL_CHANGES",
        diagnostics: [{ severity: noChange ? "info" : "error", message: astResult.diagnostic || "The edit was not applied." }],
      };
      this.committedOperations.set(operationId, result);
      this.transitionSaveState(projectId, result.syncStatus);
      return result;
    }

    const modifiedCode = astResult.content;
    const changedRanges = [{ filePath, startLine: astResult.changedRange!.startLine, endLine: astResult.changedRange!.endLine }];

    // 5. Commit through authoritative WorkspaceCoordinatorService
    const commitResult = await WorkspaceCoordinatorService.commitChange({
      projectId,
      tenantId,
      actorId,
      source: "VISUAL_EDITOR",
      expectedRevision,
      idempotencyKey: operationId,
      commitMessage: `Visual ${operationType} on node ${nodeId}`,
      changes: {
        sourceFiles: [
          {
            path: filePath,
            content: modifiedCode,
            ownership: "VISUAL_COMPOSITION",
          },
        ],
      },
    });

    const seq = this.nextProjectSequence(projectId);
    this.viewAcknowledgedSequences.set(viewId, seq);

    const fileHash = crypto.createHash("sha256").update(modifiedCode).digest("hex");
    const result: CommittedOperationResult = {
      operationId,
      success: commitResult.success,
      sourceChanged: commitResult.success,
      sequenceNumber: seq,
      committedFileHashes: { [filePath]: fileHash },
      committedRevision: commitResult.revision,
      changedRanges,
      pageRegistryRevision: 1,
      checkpointId: commitResult.checkpoint.checkpointId,
      echoSuppressedForViews: [viewId],
      syncStatus: commitResult.success ? "SYNCHRONIZED" : "CONFLICT",
      diagnostics: commitResult.diagnostics,
    };

    // 6. Record inverse operation on actor undo stack (Layout undo never rolls back DB transactions)
    const inverse: InverseOperation = {
      inverseOpId: `inv_${crypto.randomUUID()}`,
      originalOperationId: operationId,
      actorId,
      projectId,
      pageId,
      nodeId,
      inverseType: operationType === "REMOVE" ? "INSERT" : operationType === "INSERT" ? "REMOVE" : operationType,
      revertPayload: {
        propertyKey,
        newValue: oldValue,
        oldValue: newValue,
      },
      timestamp: new Date().toISOString(),
    };

    const stack = this.actorUndoStacks.get(actorId) || [];
    stack.push(inverse);
    this.actorUndoStacks.set(actorId, stack);

    // Cache committed operation for idempotency
    this.committedOperations.set(operationId, result);
    this.transitionSaveState(projectId, result.syncStatus);

    return result;
  }

  /**
   * 2.4 Undo operation as inverse operation
   */
  public static async undoOperation(
    projectId: string,
    actorId: string,
    filePath: string,
    currentSourceCode: string
  ): Promise<{ success: boolean; undoneOperation?: InverseOperation; committedResult?: CommittedOperationResult }> {
    const stack = this.actorUndoStacks.get(actorId);
    if (!stack || stack.length === 0) {
      return { success: false };
    }

    const inverse = stack.pop()!;
    const opId = `undo_${crypto.randomUUID()}`;
    const currentRev = WorkspaceCoordinatorService.getCurrentRevision(projectId);

    const committed = await this.processVisualOperation(
      {
        projectId,
        pageId: inverse.pageId,
        nodeId: inverse.nodeId,
        operationType: inverse.inverseType,
        propertyKey: inverse.revertPayload.propertyKey,
        newValue: inverse.revertPayload.newValue,
        oldValue: inverse.revertPayload.oldValue,
        baseCheckpointId: WorkspaceCoordinatorService.getLatestCheckpoint(projectId)?.checkpointId || "base",
        expectedRevision: currentRev,
        actorId,
        tenantId: actorId,
        operationId: opId,
        viewId: `undo_view_${actorId}`,
      },
      filePath,
      currentSourceCode
    );

    return {
      // The inverse may be rejected like any other edit; it is not reported as undone unless it was accepted.
      success: committed.success,
      undoneOperation: inverse,
      committedResult: committed,
    };
  }

  /**
   * 2.4 Three-way semantic reconciliation for non-overlapping edits
   */
  public static reconcileThreeWay(
    base: string,
    visualModified: string,
    codeModified: string
  ): {
    success: boolean;
    hasConflict: boolean;
    mergedText: string;
    conflictingSections?: Array<{ base: string; visual: string; code: string }>;
  } {
    // If one side made no changes, the other side wins cleanly
    if (visualModified === base) {
      return { success: true, hasConflict: false, mergedText: codeModified };
    }
    if (codeModified === base) {
      return { success: true, hasConflict: false, mergedText: visualModified };
    }
    if (visualModified === codeModified) {
      return { success: true, hasConflict: false, mergedText: visualModified };
    }

    // Line-level non-overlapping reconciliation
    const baseLines = base.split("\n");
    const visualLines = visualModified.split("\n");
    const codeLines = codeModified.split("\n");

    const visualDiffersFromBase = visualLines.some((l, idx) => baseLines[idx] !== l);
    const codeDiffersFromBase = codeLines.some((l, idx) => baseLines[idx] !== l);

    // If both touched the exact same file, check if their changed regions overlap
    // Simple robust structural check
    if (visualDiffersFromBase && codeDiffersFromBase) {
      // Inspect if both touched different lines
      if (baseLines.length === visualLines.length && baseLines.length === codeLines.length) {
        let overlap = false;
        const merged: string[] = [];
        for (let i = 0; i < baseLines.length; i++) {
          const vChange = visualLines[i] !== baseLines[i];
          const cChange = codeLines[i] !== baseLines[i];
          if (vChange && cChange && visualLines[i] !== codeLines[i]) {
            overlap = true;
            break;
          } else if (vChange) {
            merged.push(visualLines[i]);
          } else if (cChange) {
            merged.push(codeLines[i]);
          } else {
            merged.push(baseLines[i]);
          }
        }

        if (!overlap) {
          return { success: true, hasConflict: false, mergedText: merged.join("\n") };
        }
      }

      return {
        success: false,
        hasConflict: true,
        mergedText: base,
        conflictingSections: [{ base, visual: visualModified, code: codeModified }],
      };
    }

    return {
      success: true,
      hasConflict: false,
      mergedText: visualDiffersFromBase ? visualModified : codeModified,
    };
  }

  /**
   * Conflict Resolution API
   */
  public static resolveConflict(
    conflictId: string,
    resolution: "CODE_WINS" | "VISUAL_WINS" | "MANUAL_MERGE" | "DUPLICATE_AS_DRAFT",
    resolvedBy: string,
    mergedContent?: any
  ): ConflictRecord {
    const conflict = this.conflictStore.get(conflictId);
    if (!conflict) {
      throw new AppError(`Conflict record ${conflictId} not found`, 404, "NOT_FOUND");
    }

    conflict.status = "RESOLVED";
    conflict.chosenResolution = resolution;
    conflict.resolvedAt = new Date().toISOString();
    conflict.mergedResult = mergedContent;

    return conflict;
  }

  /**
   * Reconnect Resumption: check last acknowledged sequence and detect gaps
   */
  public static handleClientReconnect(
    projectId: string,
    viewId: string,
    lastAcknowledgedSequence: number
  ): {
    needsFullResync: boolean;
    currentProjectSequence: number;
    missedSequenceCount: number;
    lastValidSemanticCheckpoint: WorkspaceCheckpoint | null;
  } {
    const currentSeq = this.getProjectSequence(projectId);
    const missed = Math.max(0, currentSeq - lastAcknowledgedSequence);
    const lastValid = WorkspaceCoordinatorService.getLastValidSemanticCheckpoint(projectId);

    // If gap is greater than 0, return resync requirements
    return {
      needsFullResync: missed > 0,
      currentProjectSequence: currentSeq,
      missedSequenceCount: missed,
      lastValidSemanticCheckpoint: lastValid,
    };
  }

  /**
   * Enforce bounded offline queue policies
   */
  public static validateOfflineQueue(queue: Array<{ operationType: string; isDeployment?: boolean; isSchemaMutation?: boolean }>): {
    valid: boolean;
    error?: string;
  } {
    if (queue.length > this.MAX_OFFLINE_QUEUE_SIZE) {
      return {
        valid: false,
        error: `Offline queue exceeds maximum allowed size of ${this.MAX_OFFLINE_QUEUE_SIZE} operations.`,
      };
    }

    // Never replay production deployments, credential changes, or schema mutations from offline queue
    for (const item of queue) {
      if (item.isDeployment) {
        return { valid: false, error: "Production deployments cannot be queued offline." };
      }
      if (item.isSchemaMutation) {
        return { valid: false, error: "Database schema mutations cannot be replayed from offline queue." };
      }
    }

    return { valid: true };
  }
}
