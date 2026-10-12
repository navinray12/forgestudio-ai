/**
 * Point 07: Generation Job State Machine Service
 * 
 * Enforces a durable, validated lifecycle for website generation jobs:
 * - Legal states and validated transitions
 * - Fencing tokens and worker leases to eliminate stale release promotion
 * - Explicit cancellation and timeout handling
 * - Isolation between failed candidates and published releases
 */

export type GenerationJobState =
  | "REQUESTED"
  | "AUTHORIZED"
  | "BUDGET_RESERVED"
  | "INPUTS_SNAPSHOTTED"
  | "BRIEF_VALIDATED"
  | "CAPABILITIES_RESOLVED"
  | "SITESPEC_NORMALIZED"
  | "BINDINGS_RESOLVED"
  | "CANDIDATE_GENERATED"
  | "CANDIDATE_BUILT"
  | "VALIDATING"
  | "REPAIRING"
  | "READY_FOR_RELEASE"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED"
  | "BUDGET_EXHAUSTED";

export interface StateTransitionRecord {
  fromState: GenerationJobState;
  toState: GenerationJobState;
  timestamp: string;
  workerFencingToken: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface GenerationJobRecord {
  jobId: string;
  websiteId: string;
  tenantId: string;
  currentState: GenerationJobState;
  previousState?: GenerationJobState;
  version: number;
  workerFencingToken: number;
  leaseExpiresAt: number;
  isCancelled: boolean;
  idempotencyKey?: string;
  candidateId?: string;
  activeReleaseBlocked: boolean;
  publishedReleaseId?: string;
  inputSnapshotHash?: string;
  history: StateTransitionRecord[];
  createdAt: string;
  updatedAt: string;
}

export class GenerationJobStateMachine {
  private static instance: GenerationJobStateMachine;
  private jobs = new Map<string, GenerationJobRecord>();
  private idempotencyIndex = new Map<string, string>(); // idempotencyKey -> jobId

  // Explicit allowed transition graph
  private static readonly ALLOWED_TRANSITIONS: Record<GenerationJobState, GenerationJobState[]> = {
    REQUESTED: ["AUTHORIZED", "FAILED", "CANCELLED"],
    AUTHORIZED: ["BUDGET_RESERVED", "FAILED", "CANCELLED"],
    BUDGET_RESERVED: ["INPUTS_SNAPSHOTTED", "FAILED", "CANCELLED", "BUDGET_EXHAUSTED"],
    INPUTS_SNAPSHOTTED: ["BRIEF_VALIDATED", "FAILED", "CANCELLED"],
    BRIEF_VALIDATED: ["CAPABILITIES_RESOLVED", "FAILED", "CANCELLED"],
    CAPABILITIES_RESOLVED: ["SITESPEC_NORMALIZED", "FAILED", "CANCELLED"],
    SITESPEC_NORMALIZED: ["BINDINGS_RESOLVED", "FAILED", "CANCELLED"],
    BINDINGS_RESOLVED: ["CANDIDATE_GENERATED", "FAILED", "CANCELLED", "BUDGET_EXHAUSTED"],
    CANDIDATE_GENERATED: ["CANDIDATE_BUILT", "FAILED", "CANCELLED"],
    CANDIDATE_BUILT: ["VALIDATING", "FAILED", "CANCELLED"],
    VALIDATING: ["READY_FOR_RELEASE", "REPAIRING", "FAILED", "CANCELLED"],
    REPAIRING: ["CANDIDATE_GENERATED", "VALIDATING", "FAILED", "CANCELLED", "BUDGET_EXHAUSTED"],
    READY_FOR_RELEASE: ["PUBLISHED", "FAILED", "CANCELLED"],
    PUBLISHED: [], // Terminal
    FAILED: [], // Terminal
    CANCELLED: [], // Terminal
    BUDGET_EXHAUSTED: [] // Terminal
  };

  private constructor() {}

  public static getInstance(): GenerationJobStateMachine {
    if (!GenerationJobStateMachine.instance) {
      GenerationJobStateMachine.instance = new GenerationJobStateMachine();
    }
    return GenerationJobStateMachine.instance;
  }

  /**
   * Reset in-memory jobs (for deterministic test fixture isolation).
   */
  public reset(): void {
    this.jobs.clear();
    this.idempotencyIndex.clear();
  }

  /**
   * Creates a new generation job with state REQUESTED.
   */
  public createJob(params: {
    jobId: string;
    websiteId: string;
    tenantId: string;
    idempotencyKey?: string;
    leaseDurationMs?: number;
  }): GenerationJobRecord {
    if (params.idempotencyKey && this.idempotencyIndex.has(params.idempotencyKey)) {
      const existingId = this.idempotencyIndex.get(params.idempotencyKey)!;
      return this.getJob(existingId);
    }

    if (this.jobs.has(params.jobId)) {
      throw new Error(`Generation job ${params.jobId} already exists`);
    }

    const now = new Date().toISOString();
    const leaseDuration = params.leaseDurationMs ?? 60000;

    const job: GenerationJobRecord = {
      jobId: params.jobId,
      websiteId: params.websiteId,
      tenantId: params.tenantId,
      currentState: "REQUESTED",
      version: 1,
      workerFencingToken: 1,
      leaseExpiresAt: Date.now() + leaseDuration,
      isCancelled: false,
      idempotencyKey: params.idempotencyKey,
      activeReleaseBlocked: true, // Invariant: candidate cannot touch release until READY_FOR_RELEASE
      history: [
        {
          fromState: "REQUESTED",
          toState: "REQUESTED",
          timestamp: now,
          workerFencingToken: 1,
          reason: "Initial job creation"
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    this.jobs.set(params.jobId, job);
    if (params.idempotencyKey) {
      this.idempotencyIndex.set(params.idempotencyKey, params.jobId);
    }

    return job;
  }

  public getJob(jobId: string): GenerationJobRecord {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Generation job not found: ${jobId}`);
    }
    return job;
  }

  /**
   * Acquires or renews a worker lease, bumping the fencing token.
   */
  public acquireWorkerLease(jobId: string, leaseDurationMs: number = 60000): { fencingToken: number; expiresAt: number } {
    const job = this.getJob(jobId);
    if (job.isCancelled) {
      throw new Error(`Cannot lease cancelled job: ${jobId}`);
    }
    if (this.isTerminalState(job.currentState)) {
      throw new Error(`Cannot lease job in terminal state: ${job.currentState}`);
    }

    job.workerFencingToken += 1;
    job.leaseExpiresAt = Date.now() + leaseDurationMs;
    job.updatedAt = new Date().toISOString();

    return {
      fencingToken: job.workerFencingToken,
      expiresAt: job.leaseExpiresAt
    };
  }

  /**
   * Transitions job to a new state with strict validation of legal transitions and fencing tokens.
   */
  public transitionState(params: {
    jobId: string;
    targetState: GenerationJobState;
    workerFencingToken: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): GenerationJobRecord {
    const job = this.getJob(params.jobId);

    // Invariant 1: Check cancellation
    if (job.isCancelled && params.targetState !== "CANCELLED") {
      throw new Error(`Job ${params.jobId} is cancelled; further transitions rejected`);
    }

    // Invariant 2: Worker fencing token validation (prevents stale worker promotion)
    if (params.workerFencingToken !== job.workerFencingToken) {
      throw new Error(
        `Fencing token mismatch: worker provided ${params.workerFencingToken}, active token is ${job.workerFencingToken}`
      );
    }

    // Invariant 3: Worker lease expiry
    if (Date.now() > job.leaseExpiresAt) {
      throw new Error(`Worker lease expired at ${new Date(job.leaseExpiresAt).toISOString()}`);
    }

    // Invariant 4: Legal state transition graph validation
    const allowed = GenerationJobStateMachine.ALLOWED_TRANSITIONS[job.currentState];
    if (!allowed.includes(params.targetState)) {
      throw new Error(
        `Illegal state transition: cannot transition from ${job.currentState} to ${params.targetState}`
      );
    }

    // Invariant 5: Active release cannot be touched unless validated and READY_FOR_RELEASE
    if (params.targetState === "PUBLISHED" && job.currentState !== "READY_FOR_RELEASE") {
      throw new Error(`Cannot publish job: candidate must pass independent validation first`);
    }

    const previousState = job.currentState;
    job.previousState = previousState;
    job.currentState = params.targetState;
    job.version += 1;
    job.updatedAt = new Date().toISOString();

    if (params.targetState === "READY_FOR_RELEASE") {
      job.activeReleaseBlocked = false;
    } else if (params.targetState === "FAILED" || params.targetState === "CANCELLED" || params.targetState === "BUDGET_EXHAUSTED") {
      job.activeReleaseBlocked = true;
    }

    job.history.push({
      fromState: previousState,
      toState: params.targetState,
      timestamp: job.updatedAt,
      workerFencingToken: params.workerFencingToken,
      reason: params.reason,
      metadata: params.metadata
    });

    return job;
  }

  /**
   * Explicit job cancellation.
   */
  public cancelJob(jobId: string, reason: string = "User requested cancellation"): GenerationJobRecord {
    const job = this.getJob(jobId);
    if (this.isTerminalState(job.currentState)) {
      return job; // already terminal
    }

    job.isCancelled = true;
    job.previousState = job.currentState;
    job.currentState = "CANCELLED";
    job.activeReleaseBlocked = true;
    job.version += 1;
    job.updatedAt = new Date().toISOString();

    job.history.push({
      fromState: job.previousState,
      toState: "CANCELLED",
      timestamp: job.updatedAt,
      workerFencingToken: job.workerFencingToken,
      reason
    });

    return job;
  }

  public isTerminalState(state: GenerationJobState): boolean {
    return state === "PUBLISHED" || state === "FAILED" || state === "CANCELLED" || state === "BUDGET_EXHAUSTED";
  }
}

export const generationJobStateMachine = GenerationJobStateMachine.getInstance();
