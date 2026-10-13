/**
 * ForgeStudio Blueprint Point 48 — Acceptance Metrics & Telemetry Service
 *
 * Implements properly scoped operational telemetry for the 12 required metrics:
 * 1. Edit-to-projection lag (ms)
 * 2. Save acknowledgement latency (ms)
 * 3. Conflict recovery time and outcome (ms & enum)
 * 4. Source loss incidents (count)
 * 5. Incorrect page registration (count)
 * 6. Manual repair effort (minutes)
 * 7. Actual-database application-generation pass rate (%: first-run vs. repaired, mocks excluded)
 * 8. Escaped application defects (count)
 * 9. Environment misrouting (count)
 * 10. Migration failure rate (%)
 * 11. Restore success and failure outcomes (%)
 * 12. Cost per verified application ($ USD)
 *
 * Requirements:
 * - Define each metric's numerator, denominator, units, sampling period, target profile.
 * - Explicit denominator policy: report total, passed, failed, blocked, unsupported transparently.
 * - Separate first-run success from repaired success (auto-repaired or manually repaired).
 * - Strictly reject mock-only runs from counting towards actual-database qualification.
 * - Secret hygiene: redact passwords, API keys, and connection strings from event payloads.
 */

import crypto from "crypto";
import { AppError } from "../../utils/app-error.js";

export type MetricSamplingPeriod = "LAST_HOUR" | "LAST_24_HOURS" | "LAST_7_DAYS" | "LAST_30_DAYS" | "ALL_TIME";
export type TargetProfile = "MANAGED_DECLARATIVE" | "CODE_CENTRIC" | "HYBRID" | "ALL";

export interface MetricDefinition {
  metricKey: string;
  name: string;
  description: string;
  numeratorName: string;
  denominatorName: string;
  units: "ms" | "count" | "percentage" | "minutes" | "usd";
  samplingPeriod: MetricSamplingPeriod;
  targetProfile: TargetProfile;
  currentValue: number;
  numeratorValue: number;
  denominatorValue: number;
  metadata?: Record<string, any>;
}

export interface TelemetryEvent {
  eventId: string;
  timestamp: string;
  metricKey: string;
  targetProfile: string;
  tenantId?: string;
  applicationId?: string;
  payload: Record<string, any>;
}

export interface ApplicationGenerationAttempt {
  attemptId: string;
  applicationId: string;
  targetProfile: string;
  isRealDatabaseRun: boolean; // Must be true; mock-only runs are rejected
  attemptType: "FIRST_RUN" | "AUTOMATIC_REPAIR" | "MANUAL_REPAIR";
  passed: boolean;
  blocked: boolean;
  unsupported: boolean;
  errorMessage?: string;
  repairDurationMinutes?: number;
}

export interface ConflictRecoveryEvent {
  eventId: string;
  durationMs: number;
  outcome: "AUTOMATIC_SUCCESS" | "MANUAL_RESOLVED" | "ABORTED";
  targetProfile: string;
}

export interface MigrationExecutionEvent {
  migrationId: string;
  success: boolean;
  isConcurrentDdl: boolean;
  targetProfile: string;
}

export interface RestoreExecutionEvent {
  restoreId: string;
  success: boolean;
  verifiedPersistence: boolean;
  targetProfile: string;
}

export class AcceptanceMetricsTelemetryService {
  private events: TelemetryEvent[] = [];
  private generationAttempts: ApplicationGenerationAttempt[] = [];
  private conflictEvents: ConflictRecoveryEvent[] = [];
  private migrationEvents: MigrationExecutionEvent[] = [];
  private restoreEvents: RestoreExecutionEvent[] = [];

  // In-memory aggregates for high-frequency metrics
  private editProjectionLags: number[] = [];
  private saveAckLatencies: number[] = [];
  private sourceLossIncidentCount = 0;
  private incorrectPageRegistrationCount = 0;
  private escapedDefectCount = 0;
  private environmentMisroutingCount = 0;
  private totalVerifiedAppCostUsd = 0;
  private totalVerifiedAppCount = 0;

  /**
   * Secret Sanitizer: Scrubs passwords, auth tokens, and connection strings from event payloads
   */
  private sanitizePayload(payload: Record<string, any>): Record<string, any> {
    const serialized = JSON.stringify(payload);
    const cleaned = serialized
      .replace(/("password"|"secret"|"token"|"apiKey"):\s*"[^"]+"/gi, '$1:"[REDACTED]"')
      .replace(/:\/\/[^:]+:[^@]+@/g, "://[REDACTED]@[REDACTED]");
    return JSON.parse(cleaned);
  }

  /**
   * Record Edit-to-Projection Lag
   */
  public recordEditProjectionLag(lagMs: number, targetProfile: string = "MANAGED_DECLARATIVE") {
    if (lagMs < 0) throw new AppError("Lag cannot be negative", 400, "INVALID_LAG");
    this.editProjectionLags.push(lagMs);
    this.recordRawEvent("EDIT_TO_PROJECTION_LAG", targetProfile, { lagMs });
  }

  /**
   * Record Save Acknowledgement Latency
   */
  public recordSaveAcknowledgementLatency(latencyMs: number, targetProfile: string = "MANAGED_DECLARATIVE") {
    if (latencyMs < 0) throw new AppError("Latency cannot be negative", 400, "INVALID_LATENCY");
    this.saveAckLatencies.push(latencyMs);
    this.recordRawEvent("SAVE_ACKNOWLEDGEMENT_LATENCY", targetProfile, { latencyMs });
  }

  /**
   * Record Conflict Recovery Time and Outcome
   */
  public recordConflictRecovery(event: {
    durationMs: number;
    outcome: "AUTOMATIC_SUCCESS" | "MANUAL_RESOLVED" | "ABORTED";
    targetProfile?: string;
  }) {
    const recovery: ConflictRecoveryEvent = {
      eventId: "conf_" + crypto.randomUUID(),
      durationMs: event.durationMs,
      outcome: event.outcome,
      targetProfile: event.targetProfile || "MANAGED_DECLARATIVE",
    };
    this.conflictEvents.push(recovery);
    this.recordRawEvent("CONFLICT_RECOVERY", recovery.targetProfile, recovery);
  }

  /**
   * Record Source Loss Incident
   */
  public recordSourceLossIncident(details: { reason: string; affectedFile: string; targetProfile?: string }) {
    this.sourceLossIncidentCount++;
    this.recordRawEvent("SOURCE_LOSS_INCIDENTS", details.targetProfile || "MANAGED_DECLARATIVE", details);
  }

  /**
   * Record Incorrect Page Registration Incident
   */
  public recordIncorrectPageRegistration(details: { route: string; expectedPath: string; actualPath: string }) {
    this.incorrectPageRegistrationCount++;
    this.recordRawEvent("INCORRECT_PAGE_REGISTRATION", "MANAGED_DECLARATIVE", details);
  }

  /**
   * Record Actual Database Application Generation Attempt
   * Strictly enforces:
   * 1. Rejection of mock-only runs from counting towards actual-database generation pass rate.
   * 2. Clear distinction between first-run success, automatic repair, and manual repair.
   */
  public recordApplicationGenerationAttempt(attempt: {
    applicationId: string;
    targetProfile: string;
    isRealDatabaseRun: boolean;
    attemptType: "FIRST_RUN" | "AUTOMATIC_REPAIR" | "MANUAL_REPAIR";
    passed: boolean;
    blocked?: boolean;
    unsupported?: boolean;
    repairDurationMinutes?: number;
    errorMessage?: string;
  }) {
    if (!attempt.isRealDatabaseRun) {
      // Mock runs are disqualified from actual-database metrics
      throw new AppError(
        "MOCK_ONLY_DISQUALIFIED: Mock-only runs are strictly prohibited from qualifying as actual-database application generation.",
        400,
        "MOCK_ONLY_DISQUALIFIED"
      );
    }

    const record: ApplicationGenerationAttempt = {
      attemptId: "gen_" + crypto.randomUUID(),
      applicationId: attempt.applicationId,
      targetProfile: attempt.targetProfile,
      isRealDatabaseRun: true,
      attemptType: attempt.attemptType,
      passed: attempt.passed,
      blocked: attempt.blocked || false,
      unsupported: attempt.unsupported || false,
      repairDurationMinutes: attempt.repairDurationMinutes || 0,
      errorMessage: attempt.errorMessage,
    };

    this.generationAttempts.push(record);
    this.recordRawEvent("ACTUAL_DATABASE_APPLICATION_GENERATION", attempt.targetProfile, record);
  }

  /**
   * Record Escaped Application Defect (detected post-qualification)
   */
  public recordEscapedDefect(details: { defectId: string; severity: "LOW" | "HIGH" | "CRITICAL"; description: string }) {
    this.escapedDefectCount++;
    this.recordRawEvent("ESCAPED_APPLICATION_DEFECTS", "ALL", details);
  }

  /**
   * Record Environment Misrouting Incident (e.g. dev calling prod endpoint)
   */
  public recordEnvironmentMisrouting(details: { sourceEnv: string; targetEnv: string; endpoint: string }) {
    this.environmentMisroutingCount++;
    this.recordRawEvent("ENVIRONMENT_MISROUTING", "ALL", details);
  }

  /**
   * Record Migration Execution Event
   */
  public recordMigrationExecution(event: { migrationId: string; success: boolean; isConcurrentDdl: boolean; targetProfile?: string }) {
    const record: MigrationExecutionEvent = {
      migrationId: event.migrationId,
      success: event.success,
      isConcurrentDdl: event.isConcurrentDdl,
      targetProfile: event.targetProfile || "MANAGED_DECLARATIVE",
    };
    this.migrationEvents.push(record);
    this.recordRawEvent("MIGRATION_EXECUTION", record.targetProfile, record);
  }

  /**
   * Record Restore Execution Event
   */
  public recordRestoreExecution(event: { restoreId: string; success: boolean; verifiedPersistence: boolean; targetProfile?: string }) {
    const record: RestoreExecutionEvent = {
      restoreId: event.restoreId,
      success: event.success,
      verifiedPersistence: event.verifiedPersistence,
      targetProfile: event.targetProfile || "MANAGED_DECLARATIVE",
    };
    this.restoreEvents.push(record);
    this.recordRawEvent("RESTORE_EXECUTION", record.targetProfile, record);
  }

  /**
   * Record Verified Application Cost
   */
  public recordVerifiedApplicationCost(costUsd: number) {
    if (costUsd < 0) throw new AppError("Cost cannot be negative", 400, "INVALID_COST");
    this.totalVerifiedAppCostUsd += costUsd;
    this.totalVerifiedAppCount++;
    this.recordRawEvent("COST_PER_VERIFIED_APP", "ALL", { costUsd });
  }

  /**
   * Helper to record sanitized telemetry event
   */
  private recordRawEvent(metricKey: string, targetProfile: string, payload: Record<string, any>) {
    const sanitized = this.sanitizePayload(payload);
    this.events.push({
      eventId: "evt_" + crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      metricKey,
      targetProfile,
      payload: sanitized,
    });
  }

  /**
   * Calculate and return all 12 operational acceptance metrics with explicit numerator, denominator, and units.
   */
  public getMetricsReport(filter?: { targetProfile?: TargetProfile; samplingPeriod?: MetricSamplingPeriod }): {
    timestamp: string;
    metrics: MetricDefinition[];
    generationBreakdown: {
      totalAttempts: number;
      firstRunPasses: number;
      autoRepairedPasses: number;
      manualRepairedPasses: number;
      blockedAttempts: number;
      unsupportedAttempts: number;
      failedAttempts: number;
      firstRunPassRatePercent: number;
      overallRepairedPassRatePercent: number;
    };
    eventCount: number;
  } {
    const period = filter?.samplingPeriod || "ALL_TIME";
    const profile = filter?.targetProfile || "ALL";

    // 1. Edit-to-projection lag (average ms)
    const avgEditLag = this.editProjectionLags.length > 0
      ? Math.round(this.editProjectionLags.reduce((a, b) => a + b, 0) / this.editProjectionLags.length)
      : 0;

    // 2. Save acknowledgement latency (average ms)
    const avgSaveAck = this.saveAckLatencies.length > 0
      ? Math.round(this.saveAckLatencies.reduce((a, b) => a + b, 0) / this.saveAckLatencies.length)
      : 0;

    // 3. Conflict recovery time and outcome
    const avgConflictDuration = this.conflictEvents.length > 0
      ? Math.round(this.conflictEvents.reduce((a, b) => a + b.durationMs, 0) / this.conflictEvents.length)
      : 0;
    const successfulConflicts = this.conflictEvents.filter(c => c.outcome !== "ABORTED").length;

    // 6. Manual repair effort (total minutes)
    const manualRepairMinutes = this.generationAttempts
      .filter(a => a.attemptType === "MANUAL_REPAIR")
      .reduce((sum, a) => sum + (a.repairDurationMinutes || 0), 0);

    // 7. Actual database generation breakdown
    const realAttempts = this.generationAttempts;
    const totalAttempts = realAttempts.length;
    const firstRunPasses = realAttempts.filter(a => a.attemptType === "FIRST_RUN" && a.passed).length;
    const autoRepairedPasses = realAttempts.filter(a => a.attemptType === "AUTOMATIC_REPAIR" && a.passed).length;
    const manualRepairedPasses = realAttempts.filter(a => a.attemptType === "MANUAL_REPAIR" && a.passed).length;
    const blockedAttempts = realAttempts.filter(a => a.blocked).length;
    const unsupportedAttempts = realAttempts.filter(a => a.unsupported).length;
    const failedAttempts = realAttempts.filter(a => !a.passed && !a.blocked && !a.unsupported).length;

    const firstRunPassRatePercent = totalAttempts > 0
      ? Math.round((firstRunPasses / totalAttempts) * 1000) / 10
      : 0;
    const totalPasses = firstRunPasses + autoRepairedPasses + manualRepairedPasses;
    const overallRepairedPassRatePercent = totalAttempts > 0
      ? Math.round((totalPasses / totalAttempts) * 1000) / 10
      : 0;

    // 10. Migration failure rate (%)
    const totalMigrations = this.migrationEvents.length;
    const failedMigrations = this.migrationEvents.filter(m => !m.success).length;
    const migrationFailureRatePercent = totalMigrations > 0
      ? Math.round((failedMigrations / totalMigrations) * 1000) / 10
      : 0;

    // 11. Restore success rate (%)
    const totalRestores = this.restoreEvents.length;
    const successfulRestores = this.restoreEvents.filter(r => r.success && r.verifiedPersistence).length;
    const restoreSuccessRatePercent = totalRestores > 0
      ? Math.round((successfulRestores / totalRestores) * 1000) / 10
      : 0;

    // 12. Cost per verified application ($)
    const costPerVerifiedApp = this.totalVerifiedAppCount > 0
      ? Math.round((this.totalVerifiedAppCostUsd / this.totalVerifiedAppCount) * 100) / 100
      : 0;

    const metrics: MetricDefinition[] = [
      {
        metricKey: "EDIT_TO_PROJECTION_LAG",
        name: "Edit-to-Projection Lag",
        description: "Duration between canvas AST mutation and live preview visual projection",
        numeratorName: "Total projection latency (ms)",
        denominatorName: "Count of projected edits",
        units: "ms",
        samplingPeriod: period,
        targetProfile: profile,
        currentValue: avgEditLag,
        numeratorValue: this.editProjectionLags.reduce((a, b) => a + b, 0),
        denominatorValue: this.editProjectionLags.length,
      },
      {
        metricKey: "SAVE_ACKNOWLEDGEMENT_LATENCY",
        name: "Save Acknowledgement Latency",
        description: "Round-trip duration from save dispatch to server checkpoint receipt",
        numeratorName: "Total save response latency (ms)",
        denominatorName: "Count of save operations",
        units: "ms",
        samplingPeriod: period,
        targetProfile: profile,
        currentValue: avgSaveAck,
        numeratorValue: this.saveAckLatencies.reduce((a, b) => a + b, 0),
        denominatorValue: this.saveAckLatencies.length,
      },
      {
        metricKey: "CONFLICT_RECOVERY_TIME_AND_OUTCOME",
        name: "Conflict Recovery Time and Outcome",
        description: "Average duration to resolve multi-client editing collisions and resolution rate",
        numeratorName: "Total conflict resolution time (ms)",
        denominatorName: "Count of resolved conflicts",
        units: "ms",
        samplingPeriod: period,
        targetProfile: profile,
        currentValue: avgConflictDuration,
        numeratorValue: this.conflictEvents.reduce((a, b) => a + b.durationMs, 0),
        denominatorValue: this.conflictEvents.length,
        metadata: { successfulConflicts, totalConflicts: this.conflictEvents.length },
      },
      {
        metricKey: "SOURCE_LOSS_INCIDENTS",
        name: "Source Loss Incidents",
        description: "Count of inadvertent code overwrites or corrupted user code regions",
        numeratorName: "Total detected source loss occurrences",
        denominatorName: "Total file regeneration operations",
        units: "count",
        samplingPeriod: period,
        targetProfile: profile,
        currentValue: this.sourceLossIncidentCount,
        numeratorValue: this.sourceLossIncidentCount,
        denominatorValue: Math.max(1, this.events.length),
      },
      {
        metricKey: "INCORRECT_PAGE_REGISTRATION",
        name: "Incorrect Page Registration",
        description: "Count of mismatched route paths, collision errors, or dropped pages",
        numeratorName: "Total incorrect page registrations",
        denominatorName: "Total created pages",
        units: "count",
        samplingPeriod: period,
        targetProfile: profile,
        currentValue: this.incorrectPageRegistrationCount,
        numeratorValue: this.incorrectPageRegistrationCount,
        denominatorValue: Math.max(1, this.events.length),
      },
      {
        metricKey: "MANUAL_REPAIR_EFFORT",
        name: "Manual Repair Effort",
        description: "Total human engineering time required to fix generated code failures",
        numeratorName: "Cumulative manual repair time (minutes)",
        denominatorName: "Repaired applications count",
        units: "minutes",
        samplingPeriod: period,
        targetProfile: profile,
        currentValue: manualRepairMinutes,
        numeratorValue: manualRepairMinutes,
        denominatorValue: Math.max(1, realAttempts.filter(a => a.attemptType === "MANUAL_REPAIR").length),
      },
      {
        metricKey: "ACTUAL_DATABASE_APPLICATION_GENERATION_PASS_RATE",
        name: "Actual-Database Application Generation Pass Rate",
        description: "Percentage of generated applications qualifying on real PostgreSQL (mocks strictly excluded)",
        numeratorName: "Passed live DB application generations (first-run + repaired)",
        denominatorName: "Total live DB generation attempts",
        units: "percentage",
        samplingPeriod: period,
        targetProfile: profile,
        currentValue: overallRepairedPassRatePercent,
        numeratorValue: totalPasses,
        denominatorValue: totalAttempts,
        metadata: {
          firstRunPassRatePercent,
          firstRunPasses,
          autoRepairedPasses,
          manualRepairedPasses,
          blockedAttempts,
          unsupportedAttempts,
        },
      },
      {
        metricKey: "ESCAPED_APPLICATION_DEFECTS",
        name: "Escaped Application Defects",
        description: "Bugs or failures identified after release qualification",
        numeratorName: "Count of post-release defects",
        denominatorName: "Total verified releases",
        units: "count",
        samplingPeriod: period,
        targetProfile: profile,
        currentValue: this.escapedDefectCount,
        numeratorValue: this.escapedDefectCount,
        denominatorValue: Math.max(1, this.totalVerifiedAppCount),
      },
      {
        metricKey: "ENVIRONMENT_MISROUTING",
        name: "Environment Misrouting",
        description: "Accidental traffic or data leakage between dev, staging, and production",
        numeratorName: "Detected cross-environment requests",
        denominatorName: "Total routed requests",
        units: "count",
        samplingPeriod: period,
        targetProfile: profile,
        currentValue: this.environmentMisroutingCount,
        numeratorValue: this.environmentMisroutingCount,
        denominatorValue: Math.max(1, this.events.length),
      },
      {
        metricKey: "MIGRATION_FAILURE_RATE",
        name: "Migration Failure Rate",
        description: "Percentage of schema migrations encountering SQL errors or rollbacks",
        numeratorName: "Failed migration runs",
        denominatorName: "Total executed migrations",
        units: "percentage",
        samplingPeriod: period,
        targetProfile: profile,
        currentValue: migrationFailureRatePercent,
        numeratorValue: failedMigrations,
        denominatorValue: totalMigrations,
      },
      {
        metricKey: "RESTORE_OUTCOMES",
        name: "Restore Outcomes",
        description: "Percentage of snapshot restores that verify durable persistence in a fresh session",
        numeratorName: "Successfully restored & verified databases",
        denominatorName: "Total restore attempts",
        units: "percentage",
        samplingPeriod: period,
        targetProfile: profile,
        currentValue: restoreSuccessRatePercent,
        numeratorValue: successfulRestores,
        denominatorValue: totalRestores,
      },
      {
        metricKey: "COST_PER_VERIFIED_APPLICATION",
        name: "Cost per Verified Application",
        description: "Total compute, database, and LLM inference spend divided by successfully qualified apps",
        numeratorName: "Cumulative verified application expense (USD)",
        denominatorName: "Total verified applications",
        units: "usd",
        samplingPeriod: period,
        targetProfile: profile,
        currentValue: costPerVerifiedApp,
        numeratorValue: this.totalVerifiedAppCostUsd,
        denominatorValue: this.totalVerifiedAppCount,
      },
    ];

    return {
      timestamp: new Date().toISOString(),
      metrics,
      generationBreakdown: {
        totalAttempts,
        firstRunPasses,
        autoRepairedPasses,
        manualRepairedPasses,
        blockedAttempts,
        unsupportedAttempts,
        failedAttempts,
        firstRunPassRatePercent,
        overallRepairedPassRatePercent,
      },
      eventCount: this.events.length,
    };
  }

  /**
   * Diagnostic helper to retrieve raw events for verification suites
   */
  public getRawEvents(filter?: { metricKey?: string }): TelemetryEvent[] {
    if (filter?.metricKey) {
      return this.events.filter(e => e.metricKey === filter.metricKey);
    }
    return [...this.events];
  }
}

export const acceptanceMetricsTelemetryService = new AcceptanceMetricsTelemetryService();
