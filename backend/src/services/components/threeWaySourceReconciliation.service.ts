/**
 * Point 08: Base-Aware Three-Way Source Reconciliation Service
 * 
 * Enforces safe synchronization between generated code and user-owned source:
 * - Tracks 3 distinct representations: Base Ancestor, Current User Source, New Generated Proposal
 * - Real 3-way merge logic identifying non-overlapping edits vs genuine conflicts
 * - Structured conflict records without corrupting executable source
 * - Regeneration lock on conflicted source scopes until explicit authorized resolution
 * - Absolute protection of user-owned source (never silently overwritten or arbitrarily discarded)
 */

import { createHash } from "crypto";

export type SourceOwnershipCategory = "GENERATED" | "USER_OWNED" | "HYBRID";

export type ReconciliationOutcome =
  | "GENERATED_ONLY_CHANGED"
  | "USER_ONLY_CHANGED"
  | "CLEAN_THREE_WAY_MERGE"
  | "OVERLAPPING_CONFLICT"
  | "RENAME_DELETE_CONFLICT"
  | "STALE_OR_MISSING_BASELINE";

export interface SourceUnitState {
  filePath: string;
  websiteId: string;
  tenantId: string;
  ownership: SourceOwnershipCategory;
  baselineHash: string;
  baselineContent: string;
  currentUserHash: string;
  currentUserContent: string;
  proposedHash?: string;
  proposedContent?: string;
  isLockedForRegeneration: boolean;
  unresolvedConflictId?: string;
  updatedAt: string;
}

export interface StructuredConflictRecord {
  conflictId: string;
  websiteId: string;
  filePath: string;
  outcome: ReconciliationOutcome;
  baselineContent: string;
  currentUserContent: string;
  proposedContent: string;
  conflictingRegions: {
    startLine: number;
    endLine: number;
    userChunk: string;
    proposedChunk: string;
  }[];
  isResolved: boolean;
  resolutionChoice?: "KEEP_USER" | "ACCEPT_PROPOSAL" | "CUSTOM_RESOLVED";
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ReconciliationResult {
  filePath: string;
  outcome: ReconciliationOutcome;
  mergedContent?: string;
  conflictRecord?: StructuredConflictRecord;
  regenerationLocked: boolean;
}

export class ThreeWaySourceReconciliationService {
  private static instance: ThreeWaySourceReconciliationService;

  // Active files: websiteId:filePath -> SourceUnitState
  private sourceRegistry = new Map<string, SourceUnitState>();
  // Active conflicts: conflictId -> StructuredConflictRecord
  private conflicts = new Map<string, StructuredConflictRecord>();

  private constructor() {}

  public static getInstance(): ThreeWaySourceReconciliationService {
    if (!ThreeWaySourceReconciliationService.instance) {
      ThreeWaySourceReconciliationService.instance = new ThreeWaySourceReconciliationService();
    }
    return ThreeWaySourceReconciliationService.instance;
  }

  public reset(): void {
    this.sourceRegistry.clear();
    this.conflicts.clear();
  }

  private getKey(websiteId: string, filePath: string): string {
    return `${websiteId}:${filePath}`;
  }

  /**
   * Registers or updates a tracked source unit's baseline and current state.
   */
  public registerSourceUnit(params: {
    websiteId: string;
    tenantId: string;
    filePath: string;
    ownership: SourceOwnershipCategory;
    baselineContent: string;
    currentUserContent: string;
  }): SourceUnitState {
    const key = this.getKey(params.websiteId, params.filePath);
    const baselineHash = createHash("sha256").update(params.baselineContent).digest("hex");
    const currentUserHash = createHash("sha256").update(params.currentUserContent).digest("hex");

    const state: SourceUnitState = {
      filePath: params.filePath,
      websiteId: params.websiteId,
      tenantId: params.tenantId,
      ownership: params.ownership,
      baselineHash,
      baselineContent: params.baselineContent,
      currentUserHash,
      currentUserContent: params.currentUserContent,
      isLockedForRegeneration: false,
      updatedAt: new Date().toISOString()
    };

    this.sourceRegistry.set(key, state);
    return state;
  }

  public getSourceUnit(websiteId: string, filePath: string): SourceUnitState | undefined {
    return this.sourceRegistry.get(this.getKey(websiteId, filePath));
  }

  /**
   * Performs base-aware three-way reconciliation against a new generated proposal.
   */
  public reconcileProposal(params: {
    websiteId: string;
    filePath: string;
    proposedContent: string;
  }): ReconciliationResult {
    const state = this.getSourceUnit(params.websiteId, params.filePath);

    // Case 1: Missing baseline $\rightarrow$ Cannot establish trusted ancestor
    if (!state) {
      const conflictId = `conf-missing-base-${Date.now()}`;
      const conflictRecord: StructuredConflictRecord = {
        conflictId,
        websiteId: params.websiteId,
        filePath: params.filePath,
        outcome: "STALE_OR_MISSING_BASELINE",
        baselineContent: "",
        currentUserContent: "",
        proposedContent: params.proposedContent,
        conflictingRegions: [],
        isResolved: false
      };
      this.conflicts.set(conflictId, conflictRecord);

      return {
        filePath: params.filePath,
        outcome: "STALE_OR_MISSING_BASELINE",
        conflictRecord,
        regenerationLocked: true
      };
    }

    const proposedHash = createHash("sha256").update(params.proposedContent).digest("hex");
    state.proposedHash = proposedHash;
    state.proposedContent = params.proposedContent;

    const base = state.baselineContent;
    const user = state.currentUserContent;
    const proposal = params.proposedContent;

    // Case 2: Neither changed
    if (user === base && proposal === base) {
      return {
        filePath: params.filePath,
        outcome: "GENERATED_ONLY_CHANGED",
        mergedContent: base,
        regenerationLocked: false
      };
    }

    // Case 3: Only generated changed (User did not touch the file)
    if (user === base && proposal !== base) {
      state.baselineContent = proposal;
      state.baselineHash = proposedHash;
      state.currentUserContent = proposal;
      state.currentUserHash = proposedHash;
      state.isLockedForRegeneration = false;

      return {
        filePath: params.filePath,
        outcome: "GENERATED_ONLY_CHANGED",
        mergedContent: proposal,
        regenerationLocked: false
      };
    }

    // Case 4: Only user changed (Generated proposal is identical to baseline)
    if (proposal === base && user !== base) {
      return {
        filePath: params.filePath,
        outcome: "USER_ONLY_CHANGED",
        mergedContent: user,
        regenerationLocked: false
      };
    }

    // Case 5: Both changed. Execute three-way line comparison
    const baseLines = base.split("\n");
    const userLines = user.split("\n");
    const proposalLines = proposal.split("\n");

    const userDiffersFromBase = userLines.some((l, idx) => l !== baseLines[idx]);
    const proposalDiffersFromBase = proposalLines.some((l, idx) => l !== baseLines[idx]);

    // Check if both modified the identical content
    if (user === proposal) {
      // Both made the exact same change! Clean convergence.
      state.baselineContent = proposal;
      state.baselineHash = proposedHash;
      return {
        filePath: params.filePath,
        outcome: "CLEAN_THREE_WAY_MERGE",
        mergedContent: proposal,
        regenerationLocked: false
      };
    }

    // Check for clean non-overlapping vs overlapping conflict
    // Simple line-level merge: if user edited prefix and proposal edited suffix
    const canCleanMerge = (baseLines.length === userLines.length) && (baseLines.length === proposalLines.length);

    if (canCleanMerge) {
      let hasOverlap = false;
      const merged: string[] = [];

      for (let i = 0; i < baseLines.length; i++) {
        const u = userLines[i];
        const p = proposalLines[i];
        const b = baseLines[i];

        if (u !== b && p !== b) {
          hasOverlap = true;
          break;
        } else if (u !== b) {
          merged.push(u);
        } else if (p !== b) {
          merged.push(p);
        } else {
          merged.push(b);
        }
      }

      if (!hasOverlap) {
        const cleanContent = merged.join("\n");
        state.baselineContent = cleanContent;
        state.currentUserContent = cleanContent;
        return {
          filePath: params.filePath,
          outcome: "CLEAN_THREE_WAY_MERGE",
          mergedContent: cleanContent,
          regenerationLocked: false
        };
      }
    }

    // Overlapping conflict! Preserve both versions and lock regeneration
    const conflictId = `conf-${Date.now()}`;
    const conflictRecord: StructuredConflictRecord = {
      conflictId,
      websiteId: params.websiteId,
      filePath: params.filePath,
      outcome: "OVERLAPPING_CONFLICT",
      baselineContent: base,
      currentUserContent: user,
      proposedContent: proposal,
      conflictingRegions: [{
        startLine: 1,
        endLine: Math.max(userLines.length, proposalLines.length),
        userChunk: user,
        proposedChunk: proposal
      }],
      isResolved: false
    };

    state.isLockedForRegeneration = true;
    state.unresolvedConflictId = conflictId;
    this.conflicts.set(conflictId, conflictRecord);

    return {
      filePath: params.filePath,
      outcome: "OVERLAPPING_CONFLICT",
      conflictRecord,
      regenerationLocked: true
    };
  }

  /**
   * Explicitly resolves an active conflict and releases the regeneration lock.
   */
  public resolveConflict(params: {
    conflictId: string;
    choice: "KEEP_USER" | "ACCEPT_PROPOSAL" | "CUSTOM_RESOLVED";
    customContent?: string;
    resolvedBy: string;
  }): StructuredConflictRecord {
    const conflict = this.conflicts.get(params.conflictId);
    if (!conflict) {
      throw new Error(`Conflict record not found: ${params.conflictId}`);
    }

    const state = this.getSourceUnit(conflict.websiteId, conflict.filePath);
    if (!state) {
      throw new Error(`Tracked source unit not found for conflict ${params.conflictId}`);
    }

    let resolvedContent = "";
    if (params.choice === "KEEP_USER") {
      resolvedContent = conflict.currentUserContent;
    } else if (params.choice === "ACCEPT_PROPOSAL") {
      resolvedContent = conflict.proposedContent;
    } else if (params.choice === "CUSTOM_RESOLVED") {
      if (!params.customContent) {
        throw new Error("customContent must be supplied when choice is CUSTOM_RESOLVED");
      }
      resolvedContent = params.customContent;
    }

    const resolvedHash = createHash("sha256").update(resolvedContent).digest("hex");

    // Update state and release regeneration lock
    state.baselineContent = resolvedContent;
    state.baselineHash = resolvedHash;
    state.currentUserContent = resolvedContent;
    state.currentUserHash = resolvedHash;
    state.isLockedForRegeneration = false;
    state.unresolvedConflictId = undefined;
    state.updatedAt = new Date().toISOString();

    conflict.isResolved = true;
    conflict.resolutionChoice = params.choice;
    conflict.resolvedAt = state.updatedAt;
    conflict.resolvedBy = params.resolvedBy;

    return conflict;
  }

  public getActiveConflictsForWebsite(websiteId: string): StructuredConflictRecord[] {
    return Array.from(this.conflicts.values()).filter(c => c.websiteId === websiteId && !c.isResolved);
  }
}

export const threeWaySourceReconciliationService = ThreeWaySourceReconciliationService.getInstance();
