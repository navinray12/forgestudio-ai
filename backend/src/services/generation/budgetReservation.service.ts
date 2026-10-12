/**
 * Point 07: Generation Budget Reservation Service
 * 
 * Enforces strict financial bounding and upfront cost control:
 * - Upfront cost estimation and atomic reservation before provider invocation
 * - Per-job maximum spend and tenant policy ceilings
 * - Accurate reconciliation of estimated, reported, and actual costs
 * - Release of unused reservations upon job completion/failure
 * - Explicit budget exhaustion with candidate preservation
 * - Platform policy owner authorization required for budget overrides
 */

export interface ModelPricing {
  provider: string;
  modelId: string;
  promptCostPer1kTokensCents: number;
  completionCostPer1kTokensCents: number;
  fixedCallCostCents: number;
}

export interface BudgetReservationRecord {
  reservationId: string;
  jobId: string;
  websiteId: string;
  tenantId: string;
  estimatedCostCents: number;
  reservedAmountCents: number;
  reportedCostCents: number;
  actualSettledCostCents: number;
  status: "RESERVED" | "SETTLED" | "EXHAUSTED" | "RELEASED" | "OVERRIDDEN";
  overrideReason?: string;
  overriddenBy?: string;
  tokensConsumed: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  createdAt: string;
  settledAt?: string;
}

export interface TenantBudgetLimits {
  tenantId: string;
  monthlyLimitCents: number;
  currentSpendCents: number;
  perJobMaxSpendCents: number;
}

export class BudgetReservationService {
  private static instance: BudgetReservationService;

  // Active reservations map: reservationId -> BudgetReservationRecord
  private reservations = new Map<string, BudgetReservationRecord>();
  // Job reservation index: jobId -> reservationId
  private jobReservationIndex = new Map<string, string>();

  // Tenant budget state
  private tenantLimits = new Map<string, TenantBudgetLimits>();

  // Versioned model pricing catalog
  private pricingCatalog: Map<string, ModelPricing> = new Map([
    ["gemini-1.5-pro", { provider: "google", modelId: "gemini-1.5-pro", promptCostPer1kTokensCents: 0.125, completionCostPer1kTokensCents: 0.5, fixedCallCostCents: 0 }],
    ["gemini-1.5-flash", { provider: "google", modelId: "gemini-1.5-flash", promptCostPer1kTokensCents: 0.015, completionCostPer1kTokensCents: 0.06, fixedCallCostCents: 0 }],
    ["claude-3-5-sonnet", { provider: "anthropic", modelId: "claude-3-5-sonnet", promptCostPer1kTokensCents: 0.3, completionCostPer1kTokensCents: 1.5, fixedCallCostCents: 0 }],
    ["gpt-4o", { provider: "openai", modelId: "gpt-4o", promptCostPer1kTokensCents: 0.25, completionCostPer1kTokensCents: 1.0, fixedCallCostCents: 0 }]
  ]);

  private constructor() {}

  public static getInstance(): BudgetReservationService {
    if (!BudgetReservationService.instance) {
      BudgetReservationService.instance = new BudgetReservationService();
    }
    return BudgetReservationService.instance;
  }

  public reset(): void {
    this.reservations.clear();
    this.jobReservationIndex.clear();
    this.tenantLimits.clear();
  }

  public setTenantLimits(limits: TenantBudgetLimits): void {
    this.tenantLimits.set(limits.tenantId, { ...limits });
  }

  public getTenantLimits(tenantId: string): TenantBudgetLimits {
    const existing = this.tenantLimits.get(tenantId);
    if (existing) return existing;
    const defaultLimits: TenantBudgetLimits = {
      tenantId,
      monthlyLimitCents: 50000, // $500 default
      currentSpendCents: 0,
      perJobMaxSpendCents: 500 // $5 per job default
    };
    this.tenantLimits.set(tenantId, defaultLimits);
    return defaultLimits;
  }

  /**
   * Estimates maximum generation spend based on task, model, and expected tokens.
   */
  public estimateCost(params: {
    modelId: string;
    expectedPromptTokens?: number;
    expectedCompletionTokens?: number;
    maxRepairAttempts?: number;
  }): number {
    const pricing = this.pricingCatalog.get(params.modelId) || {
      provider: "unknown",
      modelId: params.modelId,
      promptCostPer1kTokensCents: 0.25,
      completionCostPer1kTokensCents: 1.0,
      fixedCallCostCents: 0
    };

    const promptTokens = params.expectedPromptTokens ?? 4000;
    const completionTokens = params.expectedCompletionTokens ?? 2000;
    const baseCostCents = 
      (promptTokens / 1000) * pricing.promptCostPer1kTokensCents +
      (completionTokens / 1000) * pricing.completionCostPer1kTokensCents +
      pricing.fixedCallCostCents;

    // Allocate margin for up to N repairs (default 2 repairs = 3x total budget max)
    const repairMultiplier = 1 + (params.maxRepairAttempts ?? 2);
    return Math.ceil(baseCostCents * repairMultiplier);
  }

  /**
   * Atomically reserves budget for a generation job before any provider is invoked.
   */
  public reserveBudget(params: {
    reservationId: string;
    jobId: string;
    websiteId: string;
    tenantId: string;
    estimatedCostCents: number;
    userRole?: string;
  }): BudgetReservationRecord {
    // Check if reservation already exists for this job (idempotent)
    const existingReservationId = this.jobReservationIndex.get(params.jobId);
    if (existingReservationId) {
      return this.reservations.get(existingReservationId)!;
    }

    const tenantLimits = this.getTenantLimits(params.tenantId);

    // Enforce per-job maximum spend
    if (params.estimatedCostCents > tenantLimits.perJobMaxSpendCents) {
      throw new Error(
        `Estimated generation cost (${params.estimatedCostCents} cents) exceeds per-job limit (${tenantLimits.perJobMaxSpendCents} cents)`
      );
    }

    // Enforce tenant monthly budget ceiling
    if (tenantLimits.currentSpendCents + params.estimatedCostCents > tenantLimits.monthlyLimitCents) {
      throw new Error(
        `Tenant budget ceiling exceeded: current spend (${tenantLimits.currentSpendCents} cents) + estimated cost (${params.estimatedCostCents} cents) > limit (${tenantLimits.monthlyLimitCents} cents)`
      );
    }

    const reservation: BudgetReservationRecord = {
      reservationId: params.reservationId,
      jobId: params.jobId,
      websiteId: params.websiteId,
      tenantId: params.tenantId,
      estimatedCostCents: params.estimatedCostCents,
      reservedAmountCents: params.estimatedCostCents,
      reportedCostCents: 0,
      actualSettledCostCents: 0,
      status: "RESERVED",
      tokensConsumed: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      createdAt: new Date().toISOString()
    };

    // Hold reservation against tenant spend
    tenantLimits.currentSpendCents += params.estimatedCostCents;

    this.reservations.set(params.reservationId, reservation);
    this.jobReservationIndex.set(params.jobId, params.reservationId);

    return reservation;
  }

  /**
   * Records provider usage incrementally during job execution or repairs.
   */
  public recordUsage(params: {
    jobId: string;
    promptTokens: number;
    completionTokens: number;
    modelId: string;
  }): { currentSpentCents: number; remainingReservedCents: number; isExhausted: boolean } {
    const reservationId = this.jobReservationIndex.get(params.jobId);
    if (!reservationId) {
      throw new Error(`No active budget reservation for job ${params.jobId}`);
    }
    const reservation = this.reservations.get(reservationId)!;

    const pricing = this.pricingCatalog.get(params.modelId) || {
      provider: "unknown",
      modelId: params.modelId,
      promptCostPer1kTokensCents: 0.25,
      completionCostPer1kTokensCents: 1.0,
      fixedCallCostCents: 0
    };

    const callCostCents = 
      (params.promptTokens / 1000) * pricing.promptCostPer1kTokensCents +
      (params.completionTokens / 1000) * pricing.completionCostPer1kTokensCents +
      pricing.fixedCallCostCents;

    reservation.tokensConsumed.promptTokens += params.promptTokens;
    reservation.tokensConsumed.completionTokens += params.completionTokens;
    reservation.tokensConsumed.totalTokens += (params.promptTokens + params.completionTokens);

    reservation.reportedCostCents += callCostCents;
    const remainingReservedCents = reservation.reservedAmountCents - reservation.reportedCostCents;
    const isExhausted = remainingReservedCents <= 0;

    if (isExhausted) {
      reservation.status = "EXHAUSTED";
    }

    return {
      currentSpentCents: reservation.reportedCostCents,
      remainingReservedCents: Math.max(0, remainingReservedCents),
      isExhausted
    };
  }

  /**
   * Settles reservation once job finishes or fails: reconciles actual cost and releases unused budget.
   */
  public settleReservation(jobId: string): BudgetReservationRecord {
    const reservationId = this.jobReservationIndex.get(jobId);
    if (!reservationId) {
      throw new Error(`No reservation found to settle for job ${jobId}`);
    }
    const reservation = this.reservations.get(reservationId)!;
    if (reservation.status === "SETTLED" || reservation.status === "RELEASED") {
      return reservation;
    }

    const tenantLimits = this.getTenantLimits(reservation.tenantId);
    const actualCostCents = Math.ceil(reservation.reportedCostCents);
    const unusedReservedCents = reservation.reservedAmountCents - actualCostCents;

    // Refund unused portion back to tenant budget
    if (unusedReservedCents > 0) {
      tenantLimits.currentSpendCents = Math.max(0, tenantLimits.currentSpendCents - unusedReservedCents);
    }

    reservation.actualSettledCostCents = actualCostCents;
    reservation.status = "SETTLED";
    reservation.settledAt = new Date().toISOString();

    return reservation;
  }

  /**
   * Release reservation entirely (e.g. if job was cancelled before any provider invocation).
   */
  public releaseReservation(jobId: string): BudgetReservationRecord {
    const reservationId = this.jobReservationIndex.get(jobId);
    if (!reservationId) {
      throw new Error(`No reservation found to release for job ${jobId}`);
    }
    const reservation = this.reservations.get(reservationId)!;

    const tenantLimits = this.getTenantLimits(reservation.tenantId);
    tenantLimits.currentSpendCents = Math.max(0, tenantLimits.currentSpendCents - reservation.reservedAmountCents);

    reservation.actualSettledCostCents = 0;
    reservation.status = "RELEASED";
    reservation.settledAt = new Date().toISOString();

    return reservation;
  }

  /**
   * Platform policy owner budget override.
   */
  public overrideBudget(params: {
    jobId: string;
    additionalAmountCents: number;
    callerRole: string;
    reason: string;
    actorId: string;
  }): BudgetReservationRecord {
    // Invariant: ONLY platform policy owner can override budget
    if (params.callerRole !== "PLATFORM_POLICY_OWNER") {
      throw new Error(
        `Unauthorized budget override: caller role ${params.callerRole} is not PLATFORM_POLICY_OWNER`
      );
    }

    const reservationId = this.jobReservationIndex.get(params.jobId);
    if (!reservationId) {
      throw new Error(`No reservation found for job ${params.jobId}`);
    }
    const reservation = this.reservations.get(reservationId)!;

    reservation.reservedAmountCents += params.additionalAmountCents;
    reservation.status = "OVERRIDDEN";
    reservation.overrideReason = params.reason;
    reservation.overriddenBy = params.actorId;

    const tenantLimits = this.getTenantLimits(reservation.tenantId);
    tenantLimits.currentSpendCents += params.additionalAmountCents;

    return reservation;
  }

  public getReservation(jobId: string): BudgetReservationRecord | undefined {
    const reservationId = this.jobReservationIndex.get(jobId);
    if (!reservationId) return undefined;
    return this.reservations.get(reservationId);
  }
}

export const budgetReservationService = BudgetReservationService.getInstance();
