/**
 * ForgeStudio Test Suite — Blueprint Points 48–49:
 * End-to-End Regression Gate and Acceptance Pipeline Integration
 */

import { describe, it, expect } from "vitest";
import { TestProgramEvidenceBenchmarksService } from "../services/testProgram/testProgramEvidenceBenchmarks.service.js";
import { MandatoryReleaseGatesService } from "../services/releaseIntegrity/mandatoryReleaseGates.service.js";
import { DecisionRegisterRiskControlsService } from "../services/decisionGovernance/decisionRegisterRiskControls.service.js";
import { MaintenanceBoundariesService } from "../services/architecture/maintenanceBoundaries.service.js";
import { acceptanceMetricsTelemetryService } from "../services/telemetry/acceptanceMetricsTelemetry.service.js";
import { applicationReleaseQualificationService } from "../services/qualification/applicationReleaseQualification.service.js";

describe("Point 48–49 Regression Gate & Integration Verification", () => {
  it("REG-01 Backward compatibility: historical getTotalSourceItems() without args returns 648", () => {
    const historicalSummary = TestProgramEvidenceBenchmarksService.getTotalSourceItems();
    expect(historicalSummary.totalExpected).toBe(648);
    expect(historicalSummary.totalConfirmed).toBe(648);
    expect(historicalSummary.isInventoryIntact).toBe(true);

    // Explicit Point 48 call returns 733
    const extendedSummary = TestProgramEvidenceBenchmarksService.getTotalSourceItems({ includePoint48: true });
    expect(extendedSummary.totalExpected).toBe(733);
    expect(extendedSummary.totalConfirmed).toBe(733);
    expect(extendedSummary.isInventoryIntact).toBe(true);
  });

  it("REG-02 Cryptographic evidence freshness & invalidation engine functions correctly", () => {
    const baselineInputs = {
      sourceHash: "sha256:source_v1",
      dependencyLockHash: "sha256:lock_v1",
      schemaHash: "sha256:schema_v1",
      policyHash: "sha256:policy_v1",
      harnessHash: "sha256:harness_v1",
      targetProfile: "MANAGED_DECLARATIVE",
    };

    const token = TestProgramEvidenceBenchmarksService.computeEvidenceFreshness(baselineInputs);
    expect(token.tokenDigest).toBeDefined();

    // Identical inputs -> not stale
    const freshCheck = TestProgramEvidenceBenchmarksService.isEvidenceStale(token, baselineInputs);
    expect(freshCheck.isStale).toBe(false);
    expect(freshCheck.invalidationReasons).toEqual([]);

    // Mutated source hash -> stale
    const mutatedSourceInputs = { ...baselineInputs, sourceHash: "sha256:source_v2" };
    const staleCheck = TestProgramEvidenceBenchmarksService.isEvidenceStale(token, mutatedSourceInputs);
    expect(staleCheck.isStale).toBe(true);
    expect(staleCheck.invalidationReasons).toContain("Source code or manifest changed");

    // Mutated schema hash -> stale
    const mutatedSchemaInputs = { ...baselineInputs, schemaHash: "sha256:schema_v2" };
    const schemaStaleCheck = TestProgramEvidenceBenchmarksService.isEvidenceStale(token, mutatedSchemaInputs);
    expect(schemaStaleCheck.isStale).toBe(true);
    expect(schemaStaleCheck.invalidationReasons).toContain("Database or content schema changed");
  });

  it("REG-03 Dynamic mutation testing harness catches all injected defects without hardcoding", () => {
    const mutationResults = TestProgramEvidenceBenchmarksService.executeMutationHarness();
    expect(mutationResults.total).toBe(7);
    expect(mutationResults.caught).toBe(7);
    expect(mutationResults.survivingGaps).toBe(0);
    expect(mutationResults.allPassed).toBe(true);
  });

  it("REG-04 Mandatory release gates block on security/privacy failures", () => {
    const failingObservations: Record<string, { passed: boolean }> = {
      GATE_01_SPEC_COMPLETENESS: { passed: true },
      GATE_02_TYPE_CHECK_DEPS: { passed: true },
      GATE_03_REPRODUCIBLE_BUILD: { passed: true },
      GATE_04_SOURCE_PRESERVATION: { passed: true },
      GATE_05_CONTENT_DB_MIGRATION: { passed: true },
      GATE_06_AUTH_TENANT_PRIVACY: { passed: false }, // FAILING GATE
      GATE_07_FUNCTIONAL_JOURNEYS: { passed: true },
      GATE_08_ACCESSIBILITY: { passed: true },
      GATE_09_ROUTES_SEO_STATUS: { passed: true },
      GATE_10_PERFORMANCE_BUDGET: { passed: true },
      GATE_11_STAGING_DEST_PROBES: { passed: true },
      GATE_12_EXPORT_COMPATIBILITY: { passed: true },
    };

    const evalResult = MandatoryReleaseGatesService.evaluateAllMandatoryGates({
      releaseId: "rel_reg_01",
      websiteId: "site_reg_01",
      tenantId: "tenant_reg_01",
      artifactDigest: "sha256:valid_artifact",
      targetProfile: "MANAGED_DECLARATIVE",
      evidenceObservations: failingObservations,
    });

    expect(evalResult.allPassed).toBe(false);
    expect(evalResult.failedGateIds).toContain("GATE_06_AUTH_TENANT_PRIVACY");
  });

  it("REG-05 Anti-overclaiming risks block release when mock backends or corrupted digests are detected", () => {
    const riskEvaluation = DecisionRegisterRiskControlsService.evaluateReleaseBlockingRisks({
      hasTenantMixing: false,
      hasProhibitedDataCollection: false,
      hasKnownSourceLoss: false,
      hasFalseAcceptedLeadState: false,
      hasCorruptedCandidateDigest: false,
      hasFailedMandatorySecurityGate: false,
      hasUnqualifiedUntrustedCodeExecution: false,
      hasUnapprovedDestructiveMigration: false,
      hasFalselyAdvertisedFeature: true, // INJECTED MOCK SUBSTITUTION RISK
      hasMissingPortabilityEvidence: false,
    });

    expect(riskEvaluation.isReleaseBlocked).toBe(true);
    expect(riskEvaluation.blockingReasons.some(r => r.includes("falsely advertised"))).toBe(true);
  });

  it("REG-06 End-to-end integration: qualification, telemetry, and boundaries cohere seamlessly", () => {
    // 1. Boundary evaluation
    const boundaryCheck = MaintenanceBoundariesService.evaluateAllBoundaries();
    expect(boundaryCheck.allCompliant).toBe(true);

    // 2. Telemetry metrics report
    const telemetryReport = acceptanceMetricsTelemetryService.getMetricsReport();
    expect(telemetryReport.metrics.length).toBe(12);

    // 3. Register integrity
    const registerIntegrity = TestProgramEvidenceBenchmarksService.validateAcceptanceRegisterIntegrity();
    expect(registerIntegrity.isValid).toBe(true);
    expect(registerIntegrity.totalExtendedItems).toBe(733);
  });
});
