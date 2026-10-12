/**
 * Point 07: Bounded Repair Controller Service
 * 
 * Enforces strictly bounded and authorized repairs:
 * - Default maximum 2 repair attempts per candidate
 * - Only PLATFORM_POLICY_OWNER role can modify repair limit
 * - Enforces per-attempt budget verification
 * - Forbids test suppression, baseline rewriting, security weakening, or direct publishing
 * - Preserves failed candidates, diagnostics, and keeps active release pointer unchanged
 */

import { budgetReservationService } from "./budgetReservation.service.js";
import { generationDiagnosticsService } from "./generationDiagnostics.service.js";
import { typedPatchContractService, type TypedPatchProposal } from "./typedPatchContract.service.js";

export interface RepairAttemptRecord {
  attemptNumber: number;
  candidateId: string;
  jobId: string;
  patchApplied?: TypedPatchProposal;
  costCents: number;
  outcome: "SUCCESS" | "FAILED" | "REJECTED_UNSAFE" | "BUDGET_EXHAUSTED";
  diagnosticsCount: number;
  timestamp: string;
}

export interface CandidateRepairState {
  candidateId: string;
  jobId: string;
  websiteId: string;
  tenantId: string;
  maxAllowedAttempts: number;
  currentAttemptCount: number;
  attempts: RepairAttemptRecord[];
  isTerminal: boolean;
  finalStatus?: "REPAIRED" | "UNREPAIRABLE_LIMIT_REACHED" | "UNREPAIRABLE_UNSAFE" | "BUDGET_EXHAUSTED";
}

export class BoundedRepairController {
  private static instance: BoundedRepairController;
  public static readonly DEFAULT_MAX_ATTEMPTS = 2;

  // Platform policy configuration (owner-only configurable)
  private maxAttemptsPolicy: number = BoundedRepairController.DEFAULT_MAX_ATTEMPTS;

  // Active repair states: candidateId -> CandidateRepairState
  private repairStates = new Map<string, CandidateRepairState>();

  private constructor() {}

  public static getInstance(): BoundedRepairController {
    if (!BoundedRepairController.instance) {
      BoundedRepairController.instance = new BoundedRepairController();
    }
    return BoundedRepairController.instance;
  }

  public reset(): void {
    this.repairStates.clear();
    this.maxAttemptsPolicy = BoundedRepairController.DEFAULT_MAX_ATTEMPTS;
  }

  /**
   * Only PLATFORM_POLICY_OWNER is authorized to modify the global repair attempt limit.
   */
  public updatePlatformRepairLimitPolicy(params: {
    newLimit: number;
    callerRole: string;
    actorId: string;
    auditReason: string;
  }): number {
    if (params.callerRole !== "PLATFORM_POLICY_OWNER") {
      throw new Error(
        `Unauthorized configuration attempt: role '${params.callerRole}' cannot change platform repair limit. Requires PLATFORM_POLICY_OWNER.`
      );
    }

    if (params.newLimit < 0 || params.newLimit > 5) {
      throw new Error(`Invalid repair limit ${params.newLimit}. Must be between 0 and 5.`);
    }

    this.maxAttemptsPolicy = params.newLimit;
    return this.maxAttemptsPolicy;
  }

  public getPlatformRepairLimit(): number {
    return this.maxAttemptsPolicy;
  }

  /**
   * Initializes repair state for a candidate.
   */
  public initRepairState(params: {
    candidateId: string;
    jobId: string;
    websiteId: string;
    tenantId: string;
  }): CandidateRepairState {
    const state: CandidateRepairState = {
      candidateId: params.candidateId,
      jobId: params.jobId,
      websiteId: params.websiteId,
      tenantId: params.tenantId,
      maxAllowedAttempts: this.maxAttemptsPolicy,
      currentAttemptCount: 0,
      attempts: [],
      isTerminal: false
    };

    this.repairStates.set(params.candidateId, state);
    return state;
  }

  public getRepairState(candidateId: string): CandidateRepairState {
    const state = this.repairStates.get(candidateId);
    if (!state) {
      throw new Error(`Repair state not found for candidate ${candidateId}`);
    }
    return state;
  }

  /**
   * Evaluates if candidate is eligible for another repair attempt.
   */
  public isEligibleForRepair(candidateId: string): {
    eligible: boolean;
    remainingAttempts: number;
    reason?: string;
  } {
    const state = this.getRepairState(candidateId);
    const remainingAttempts = state.maxAllowedAttempts - state.currentAttemptCount;

    if (remainingAttempts <= 0) {
      return {
        eligible: false,
        remainingAttempts: 0,
        reason: `Maximum repair attempt limit (${state.maxAllowedAttempts}) reached.`
      };
    }

    if (state.isTerminal) {
      return {
        eligible: false,
        remainingAttempts: 0,
        reason: `Repair state is already terminal (${state.finalStatus}).`
      };
    }

    // Check budget availability
    const reservation = budgetReservationService.getReservation(state.jobId);
    if (reservation && (reservation.reservedAmountCents - reservation.reportedCostCents <= 0)) {
      return {
        eligible: false,
        remainingAttempts,
        reason: "Budget exhausted: remaining reserved spend is zero."
      };
    }

    return {
      eligible: true,
      remainingAttempts
    };
  }

  /**
   * Executes a single controlled repair attempt on a candidate.
   */
  public executeRepairAttempt<T extends Record<string, unknown>>(params: {
    candidateId: string;
    candidateState: T;
    repairPatch: TypedPatchProposal;
    context: {
      currentBaseRevision: number;
      protectedFilePaths: string[];
    };
    simulatedTokenCost?: { promptTokens: number; completionTokens: number; modelId: string };
  }): {
    success: boolean;
    updatedCandidateState?: T;
    attemptRecord: RepairAttemptRecord;
    remainingAttempts: number;
  } {
    const state = this.getRepairState(params.candidateId);
    const eligibility = this.isEligibleForRepair(params.candidateId);

    if (!eligibility.eligible) {
      state.isTerminal = true;
      state.finalStatus = eligibility.reason?.includes("Budget")
        ? "BUDGET_EXHAUSTED"
        : "UNREPAIRABLE_LIMIT_REACHED";

      throw new Error(`Repair attempt rejected: ${eligibility.reason}`);
    }

    // Increment attempt count
    state.currentAttemptCount += 1;
    const attemptNumber = state.currentAttemptCount;

    // 1. Check & record budget consumption for this repair attempt
    let costCents = 0;
    if (params.simulatedTokenCost) {
      const usage = budgetReservationService.recordUsage({
        jobId: state.jobId,
        promptTokens: params.simulatedTokenCost.promptTokens,
        completionTokens: params.simulatedTokenCost.completionTokens,
        modelId: params.simulatedTokenCost.modelId
      });
      costCents = usage.currentSpentCents;
    }

    // 2. Validate repair patch (cannot weaken security, overwrite protected source, suppress tests)
    const patchValidation = typedPatchContractService.validatePatch(params.repairPatch, {
      currentBaseRevision: params.context.currentBaseRevision,
      tenantId: state.tenantId,
      protectedFilePaths: params.context.protectedFilePaths
    });

    if (!patchValidation.isValid) {
      const attemptRecord: RepairAttemptRecord = {
        attemptNumber,
        candidateId: params.candidateId,
        jobId: state.jobId,
        patchApplied: params.repairPatch,
        costCents,
        outcome: "REJECTED_UNSAFE",
        diagnosticsCount: patchValidation.rejectedReasons.length,
        timestamp: new Date().toISOString()
      };
      state.attempts.push(attemptRecord);

      // Record blocking diagnostics for rejected patch
      generationDiagnosticsService.recordDiagnostic({
        diagnosticId: `diag-repair-rejected-${Date.now()}`,
        jobId: state.jobId,
        candidateId: params.candidateId,
        category: "POLICY_COMPLIANCE",
        code: "UNSAFE_REPAIR_PATCH_REJECTED",
        severity: "BLOCKING",
        userFacingMessage: `Repair patch was rejected due to safety violations: ${patchValidation.rejectedReasons.join(", ")}`,
        isRepairable: false,
        suggestedRemediation: "Do not attempt to bypass tests, security rules, or modify protected source.",
        attemptsUsed: state.currentAttemptCount,
        attemptsRemaining: state.maxAllowedAttempts - state.currentAttemptCount
      });

      const remainingAttempts = state.maxAllowedAttempts - state.currentAttemptCount;
      if (remainingAttempts <= 0) {
        state.isTerminal = true;
        state.finalStatus = "UNREPAIRABLE_LIMIT_REACHED";
      }

      return {
        success: false,
        attemptRecord,
        remainingAttempts
      };
    }

    // 3. Apply patch to candidate
    const { updatedCandidate } = typedPatchContractService.applyPatchToCandidate(
      params.candidateState,
      params.repairPatch,
      {
        currentBaseRevision: params.context.currentBaseRevision,
        tenantId: state.tenantId,
        protectedFilePaths: params.context.protectedFilePaths
      }
    );

    const attemptRecord: RepairAttemptRecord = {
      attemptNumber,
      candidateId: params.candidateId,
      jobId: state.jobId,
      patchApplied: params.repairPatch,
      costCents,
      outcome: "SUCCESS",
      diagnosticsCount: 0,
      timestamp: new Date().toISOString()
    };
    state.attempts.push(attemptRecord);

    const remainingAttempts = state.maxAllowedAttempts - state.currentAttemptCount;
    return {
      success: true,
      updatedCandidateState: updatedCandidate,
      attemptRecord,
      remainingAttempts
    };
  }
}

export const boundedRepairController = BoundedRepairController.getInstance();
