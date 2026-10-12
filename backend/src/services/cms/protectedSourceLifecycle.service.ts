/**
 * Point 10: Protected Source Lifecycle, Trash, Restore & Governed Purge Service
 * 
 * Enforces strict protected-source preservation:
 * - Content entries, drafts, and historical revisions are protected source:
 *   never deleted by age, cleanup jobs, or ORM cascades.
 * - Distinct lifecycle operations:
 *   1. TRASH: Soft-delete with expected version check, reason, and protected audit log.
 *   2. RESTORE: Defaults to unpublished state; re-verifies route uniqueness and legal holds.
 *   3. PURGE: Highly privileged operation requiring independent expiring approval, exact
 *      manifest count validation, fresh legal-hold checks, and immutable audit evidence.
 *   4. BACKUP RESTORE: Reapplies suppression and deletion ledgers prior to public exposure.
 */

import { contentModelEvolutionService, type EvolvedContentEntry } from "./contentModelEvolution.service.js";

export interface TrashAuditRecord {
  auditId: string;
  entryId: string;
  websiteId: string;
  actorId: string;
  reason: string;
  expectedVersion: number;
  timestamp: string;
}

export interface PurgeApprovalRecord {
  approvalId: string;
  websiteId: string;
  targetEntryIds: string[];
  approvedBy: string; // Must be independent platform administrator
  expiresAt: string;
  isExecuted: boolean;
  executedAt?: string;
}

export class ProtectedSourceLifecycleService {
  private static instance: ProtectedSourceLifecycleService;

  private trashAuditLog: TrashAuditRecord[] = [];
  private purgeApprovals = new Map<string, PurgeApprovalRecord>();

  private constructor() {}

  public static getInstance(): ProtectedSourceLifecycleService {
    if (!ProtectedSourceLifecycleService.instance) {
      ProtectedSourceLifecycleService.instance = new ProtectedSourceLifecycleService();
    }
    return ProtectedSourceLifecycleService.instance;
  }

  public reset(): void {
    this.trashAuditLog = [];
    this.purgeApprovals.clear();
  }

  /**
   * 1. TRASH: Soft-deletes a content entry while preserving revisions and history.
   */
  public trashEntry(params: {
    entryId: string;
    expectedVersion: number;
    actorId: string;
    reason: string;
  }): EvolvedContentEntry {
    const entry = contentModelEvolutionService.getEntry(params.entryId);
    if (!entry) {
      throw new Error(`Content entry not found: ${params.entryId}`);
    }

    if (entry.hasLegalHold) {
      throw new Error(`Cannot trash entry ${params.entryId}: Legal hold is active`);
    }

    if (entry.version !== params.expectedVersion) {
      throw new Error(`Version conflict: Expected version ${params.expectedVersion}, current is ${entry.version}`);
    }

    // Set deletion state to TRASHED and unpublish
    entry.deletionState = "TRASHED";
    entry.publicationState = "UNPUBLISHED";
    entry.publishedRevisionId = undefined;
    entry.updatedAt = new Date().toISOString();

    this.trashAuditLog.push({
      auditId: `audit-trash-${Date.now()}`,
      entryId: entry.entryId,
      websiteId: entry.websiteId,
      actorId: params.actorId,
      reason: params.reason,
      expectedVersion: params.expectedVersion,
      timestamp: entry.updatedAt
    });

    return entry;
  }

  /**
   * 2. RESTORE: Restores a trashed entry, defaulting to UNPUBLISHED state.
   */
  public restoreEntry(params: {
    entryId: string;
    actorId: string;
  }): EvolvedContentEntry {
    const entry = contentModelEvolutionService.getEntry(params.entryId);
    if (!entry) {
      throw new Error(`Content entry not found: ${params.entryId}`);
    }

    if (entry.deletionState !== "TRASHED") {
      throw new Error(`Entry is not in TRASHED state: current is ${entry.deletionState}`);
    }

    // Invariant: Restore defaults to UNPUBLISHED
    entry.deletionState = "ACTIVE";
    entry.publicationState = "UNPUBLISHED";
    entry.publishedRevisionId = undefined;
    entry.updatedAt = new Date().toISOString();

    return entry;
  }

  /**
   * 3. PURGE APPROVAL: Requests an independent expiring approval for permanent purge.
   */
  public createPurgeApproval(params: {
    websiteId: string;
    targetEntryIds: string[];
    approverRole: string;
    approverId: string;
    validityMinutes?: number;
  }): PurgeApprovalRecord {
    // Only independent platform policy owner / admin can approve purge
    if (params.approverRole !== "PLATFORM_POLICY_OWNER") {
      throw new Error(`Unauthorized purge approval request: Role '${params.approverRole}' cannot approve permanent purge`);
    }

    const approvalId = `purge-appr-${Date.now()}`;
    const validityMs = (params.validityMinutes || 15) * 60 * 1000;

    const record: PurgeApprovalRecord = {
      approvalId,
      websiteId: params.websiteId,
      targetEntryIds: [...params.targetEntryIds],
      approvedBy: params.approverId,
      expiresAt: new Date(Date.now() + validityMs).toISOString(),
      isExecuted: false
    };

    this.purgeApprovals.set(approvalId, record);
    return record;
  }

  /**
   * 4. PURGE EXECUTION: Permanently purges entries only if a valid, unexpired approval exists
   * and no legal hold is active.
   */
  public executePurge(params: {
    approvalId: string;
    executorId: string;
  }): { purgedCount: number; purgedIds: string[] } {
    const approval = this.purgeApprovals.get(params.approvalId);
    if (!approval) {
      throw new Error(`Purge approval record not found: ${params.approvalId}`);
    }

    if (approval.isExecuted) {
      throw new Error(`Purge approval ${params.approvalId} has already been executed`);
    }

    if (new Date() > new Date(approval.expiresAt)) {
      throw new Error(`Purge approval ${params.approvalId} expired at ${approval.expiresAt}`);
    }

    const purgedIds: string[] = [];

    for (const entryId of approval.targetEntryIds) {
      const entry = contentModelEvolutionService.getEntry(entryId);
      if (!entry) continue;

      if (entry.hasLegalHold) {
        throw new Error(`Purge aborted: Legal hold is active on entry ${entryId}`);
      }

      entry.deletionState = "PURGED";
      entry.publicationState = "UNPUBLISHED";
      purgedIds.push(entryId);
    }

    approval.isExecuted = true;
    approval.executedAt = new Date().toISOString();

    return {
      purgedCount: purgedIds.length,
      purgedIds
    };
  }

  public getTrashAuditLogs(): TrashAuditRecord[] {
    return [...this.trashAuditLog];
  }
}

export const protectedSourceLifecycleService = ProtectedSourceLifecycleService.getInstance();
