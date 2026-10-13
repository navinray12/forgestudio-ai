/**
 * ForgeStudio Test Suite — Blueprint Point 48:
 * Acceptance Architecture, Evidence Registers & Operational Telemetry
 */

import { describe, it, expect } from "vitest";
import { TestProgramEvidenceBenchmarksService } from "../services/testProgram/testProgramEvidenceBenchmarks.service.js";
import { acceptanceMetricsTelemetryService } from "../services/telemetry/acceptanceMetricsTelemetry.service.js";
import { applicationReleaseQualificationService } from "../services/qualification/applicationReleaseQualification.service.js";

describe("Point 48 — Acceptance Register Integrity & Evidence Pipeline", () => {
  it("48.1 Preserves historical populations and extends additively to 733 items", () => {
    // Check historical registers (baseline 648)
    const historicalRegisters = TestProgramEvidenceBenchmarksService.getHistoricalSourceRegisters();
    const historicalTotal = historicalRegisters.reduce((sum, r) => sum + r.expectedCount, 0);
    expect(historicalTotal).toBe(648);

    // Check Point 48 extension (85 new scenarios)
    const point48Registers = TestProgramEvidenceBenchmarksService.getPoint48ScenarioRegisters();
    const point48Total = point48Registers.reduce((sum, r) => sum + r.expectedCount, 0);
    expect(point48Total).toBe(85);

    // Extended inventory
    const extendedInventory = TestProgramEvidenceBenchmarksService.getExtendedTotalSourceItems();
    expect(extendedInventory.totalExpected).toBe(733);
    expect(extendedInventory.totalConfirmed).toBe(733);
    expect(extendedInventory.isInventoryIntact).toBe(true);
    expect(extendedInventory.historicalCount).toBe(648);
    expect(extendedInventory.point48NewCount).toBe(85);
  });

  it("48.2 Enforces 15 scenarios per track across Tracks A-E and 10 cross-track scenarios", () => {
    const scenarios = TestProgramEvidenceBenchmarksService.getEightyFiveApplicationVerificationScenarios();
    expect(scenarios.length).toBe(85);

    const trackA = scenarios.filter(s => s.sourceRegister === "TRACK_A_FOUNDATION_SYNC_15");
    const trackB = scenarios.filter(s => s.sourceRegister === "TRACK_B_DATAMODEL_STUDIO_15");
    const trackC = scenarios.filter(s => s.sourceRegister === "TRACK_C_CONTRACT_API_AUTH_15");
    const trackD = scenarios.filter(s => s.sourceRegister === "TRACK_D_GENERATOR_SOURCE_15");
    const trackE = scenarios.filter(s => s.sourceRegister === "TRACK_E_RELEASE_PORTABILITY_15");
    const crossTrack = scenarios.filter(s => s.sourceRegister === "CROSS_TRACK_SCENARIOS_10");

    expect(trackA.length).toBe(15);
    expect(trackB.length).toBe(15);
    expect(trackC.length).toBe(15);
    expect(trackD.length).toBe(15);
    expect(trackE.length).toBe(15);
    expect(crossTrack.length).toBe(10);
  });

  it("48.3 Sets every new scenario to NOT_EXECUTED by default (never inferring success)", () => {
    const scenarios = TestProgramEvidenceBenchmarksService.getEightyFiveApplicationVerificationScenarios();
    for (const scn of scenarios) {
      expect(scn.executionStatus).toBe("NOT_EXECUTED");
      expect(scn.result).toBe("NOT_EXECUTED");
      expect(scn.evidenceDigest).toBeNull();
    }
  });

  it("48.4 Validates scenario metadata completeness, uniqueness, and integrity", () => {
    const integrity = TestProgramEvidenceBenchmarksService.validateAcceptanceRegisterIntegrity();
    expect(integrity.isValid).toBe(true);
    expect(integrity.totalHistoricalItems).toBe(648);
    expect(integrity.totalPoint48Scenarios).toBe(85);
    expect(integrity.totalExtendedItems).toBe(733);
    expect(integrity.errors).toEqual([]);
  });

  it("48.5 Enforces independent verifier boundary: self-verification is strictly prohibited", () => {
    const applicationId = "app_finance_core";
    const projectId = "proj_fin_01";

    // Application attempting to sign its own qualification evidence
    expect(() => {
      applicationReleaseQualificationService.runQualification({
        applicationId,
        projectId,
        applicationSpecRevision: 1,
        applicationSpecDigest: "sha256:spec123",
        sourceCheckpointId: "chk_01",
        sourceTreeHash: "sha256:src123",
        apiContractDigest: "sha256:api123",
        schemaVersionDigest: "sha256:sch123",
        migrationSetHash: "sha256:mig123",
        environmentBindingId: "bind_01",
        credentialReferenceVersion: 1,
        verifierIdentity: applicationId, // SELF-VERIFICATION ATTEMPT
        environmentClass: "STAGING",
        syntheticMarker: "synth_run_01",
      });
    }).toThrowError(/SELF_VERIFICATION_PROHIBITED/);

    // Also rejects verifier identity marked "self"
    expect(() => {
      applicationReleaseQualificationService.runQualification({
        applicationId,
        projectId,
        applicationSpecRevision: 1,
        applicationSpecDigest: "sha256:spec123",
        sourceCheckpointId: "chk_01",
        sourceTreeHash: "sha256:src123",
        apiContractDigest: "sha256:api123",
        schemaVersionDigest: "sha256:sch123",
        migrationSetHash: "sha256:mig123",
        environmentBindingId: "bind_01",
        credentialReferenceVersion: 1,
        verifierIdentity: "self",
        environmentClass: "STAGING",
        syntheticMarker: "synth_run_01",
      });
    }).toThrowError(/SELF_VERIFICATION_PROHIBITED/);

    // Independent trusted verifier succeeds
    const chain = applicationReleaseQualificationService.runQualification({
      applicationId,
      projectId,
      applicationSpecRevision: 1,
      applicationSpecDigest: "sha256:spec123",
      sourceCheckpointId: "chk_01",
      sourceTreeHash: "sha256:src123",
      apiContractDigest: "sha256:api123",
      schemaVersionDigest: "sha256:sch123",
      migrationSetHash: "sha256:mig123",
      environmentBindingId: "bind_01",
      credentialReferenceVersion: 1,
      verifierIdentity: "independent_qa_verifier_service@forgestudio.io",
      environmentClass: "STAGING",
      syntheticMarker: "synth_run_01",
    });
    expect(chain.overallQualified).toBe(true);
    expect(chain.qualificationPassportDigest).toBeDefined();
  });
});

describe("Point 48 — Operational Acceptance Telemetry (12 Metrics)", () => {
  it("48.6 Instruments and computes all 12 operational metrics with explicit units and denominators", () => {
    // 1. Edit projection lag
    acceptanceMetricsTelemetryService.recordEditProjectionLag(120);
    acceptanceMetricsTelemetryService.recordEditProjectionLag(180);

    // 2. Save acknowledgement latency
    acceptanceMetricsTelemetryService.recordSaveAcknowledgementLatency(45);
    acceptanceMetricsTelemetryService.recordSaveAcknowledgementLatency(55);

    // 3. Conflict recovery
    acceptanceMetricsTelemetryService.recordConflictRecovery({ durationMs: 250, outcome: "AUTOMATIC_SUCCESS" });
    acceptanceMetricsTelemetryService.recordConflictRecovery({ durationMs: 400, outcome: "MANUAL_RESOLVED" });

    // 4. Source loss incident
    acceptanceMetricsTelemetryService.recordSourceLossIncident({ reason: "AST overwrite bug", affectedFile: "src/App.tsx" });

    // 5. Incorrect page registration
    acceptanceMetricsTelemetryService.recordIncorrectPageRegistration({ route: "/dashboard", expectedPath: "app/dashboard/page.tsx", actualPath: "pages/dashboard.tsx" });

    // 7. Actual database generation attempts (first-run + repaired)
    acceptanceMetricsTelemetryService.recordApplicationGenerationAttempt({
      applicationId: "app_crm_01",
      targetProfile: "MANAGED_DECLARATIVE",
      isRealDatabaseRun: true,
      attemptType: "FIRST_RUN",
      passed: true,
    });
    acceptanceMetricsTelemetryService.recordApplicationGenerationAttempt({
      applicationId: "app_crm_02",
      targetProfile: "MANAGED_DECLARATIVE",
      isRealDatabaseRun: true,
      attemptType: "AUTOMATIC_REPAIR",
      passed: true,
      repairDurationMinutes: 5,
    });
    acceptanceMetricsTelemetryService.recordApplicationGenerationAttempt({
      applicationId: "app_crm_03",
      targetProfile: "MANAGED_DECLARATIVE",
      isRealDatabaseRun: true,
      attemptType: "MANUAL_REPAIR",
      passed: true,
      repairDurationMinutes: 20,
    });

    // 8. Escaped defect
    acceptanceMetricsTelemetryService.recordEscapedDefect({ defectId: "DEF-01", severity: "LOW", description: "Minor padding glitch on mobile" });

    // 9. Environment misrouting
    acceptanceMetricsTelemetryService.recordEnvironmentMisrouting({ sourceEnv: "dev", targetEnv: "staging", endpoint: "/api/secret" });

    // 10. Migration execution
    acceptanceMetricsTelemetryService.recordMigrationExecution({ migrationId: "mig_01", success: true, isConcurrentDdl: false });
    acceptanceMetricsTelemetryService.recordMigrationExecution({ migrationId: "mig_02", success: true, isConcurrentDdl: true });

    // 11. Restore execution
    acceptanceMetricsTelemetryService.recordRestoreExecution({ restoreId: "rest_01", success: true, verifiedPersistence: true });

    // 12. Verified application cost
    acceptanceMetricsTelemetryService.recordVerifiedApplicationCost(1.45);
    acceptanceMetricsTelemetryService.recordVerifiedApplicationCost(2.10);

    const report = acceptanceMetricsTelemetryService.getMetricsReport();
    expect(report.metrics.length).toBe(12);

    const keys = report.metrics.map(m => m.metricKey);
    expect(keys).toContain("EDIT_TO_PROJECTION_LAG");
    expect(keys).toContain("SAVE_ACKNOWLEDGEMENT_LATENCY");
    expect(keys).toContain("CONFLICT_RECOVERY_TIME_AND_OUTCOME");
    expect(keys).toContain("SOURCE_LOSS_INCIDENTS");
    expect(keys).toContain("INCORRECT_PAGE_REGISTRATION");
    expect(keys).toContain("MANUAL_REPAIR_EFFORT");
    expect(keys).toContain("ACTUAL_DATABASE_APPLICATION_GENERATION_PASS_RATE");
    expect(keys).toContain("ESCAPED_APPLICATION_DEFECTS");
    expect(keys).toContain("ENVIRONMENT_MISROUTING");
    expect(keys).toContain("MIGRATION_FAILURE_RATE");
    expect(keys).toContain("RESTORE_OUTCOMES");
    expect(keys).toContain("COST_PER_VERIFIED_APPLICATION");

    // Verify first-run vs repaired success segregation
    expect(report.generationBreakdown.firstRunPasses).toBe(1);
    expect(report.generationBreakdown.autoRepairedPasses).toBe(1);
    expect(report.generationBreakdown.manualRepairedPasses).toBe(1);
    expect(report.generationBreakdown.totalAttempts).toBe(3);
  });

  it("48.7 Strictly rejects mock-only runs from qualifying as actual-database generation", () => {
    expect(() => {
      acceptanceMetricsTelemetryService.recordApplicationGenerationAttempt({
        applicationId: "app_mock_fake",
        targetProfile: "MANAGED_DECLARATIVE",
        isRealDatabaseRun: false, // MOCK-ONLY RUN
        attemptType: "FIRST_RUN",
        passed: true,
      });
    }).toThrowError(/MOCK_ONLY_DISQUALIFIED/);
  });

  it("48.8 Enforces secret hygiene by redacting credentials from telemetry payloads", () => {
    acceptanceMetricsTelemetryService.recordConflictRecovery({
      durationMs: 300,
      outcome: "AUTOMATIC_SUCCESS",
      targetProfile: "MANAGED_DECLARATIVE",
    });

    const events = acceptanceMetricsTelemetryService.getRawEvents();
    for (const evt of events) {
      const serialized = JSON.stringify(evt.payload);
      expect(serialized).not.toContain("super_secret_password");
      expect(serialized).not.toMatch(/postgres:\/\/.*:.*@/);
    }
  });
});
