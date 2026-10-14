/**
 * Point 28 — Decision Register and Risk Controls Test Suite
 *
 * Verifies:
 * - Decision Register (D-01 through D-12) coverage and role assignments
 * - Decision freshness / expiry validation (blocks expired accepted risks)
 * - 10 Release-Blocking Launch Risk evaluations (blocks promotions on critical defects)
 * - Integration with IntegratedPublishingReleaseService.coordinatePromotion (aborts promotion on launch risks)
 */

import { DecisionRegisterRiskControlsService } from '../services/decisionGovernance/decisionRegisterRiskControls.service';
import { IntegratedPublishingReleaseService } from '../services/publishing/integratedPublishingRelease.service';
import { DurableReleaseController } from '../services/releaseIntegrity/durableReleaseController.service';

export async function runPoint28Tests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      failed++;
      errors.push(msg);
      throw new Error(`Assertion failed: ${msg}`);
    }
    passed++;
  }

  // --------------------------------------------------------------------------
  // Test 1: Decision Register Complete Coverage (D-01 through D-12)
  // --------------------------------------------------------------------------
  try {
    const decisions = DecisionRegisterRiskControlsService.getAllDecisions();
    assert(decisions.length === 12, 'Point 28: Exactly 12 architectural decisions defined (D-01 to D-12)');

    const d03 = DecisionRegisterRiskControlsService.getDecision('D-03');
    assert(d03 !== undefined, 'Point 28: D-03 Express vs Nest decision present');
    assert(d03?.statement.includes('Express 5.x'), 'Point 28: D-03 maintains Express 5.x platform host');

    const d05 = DecisionRegisterRiskControlsService.getDecision('D-05');
    assert(d05?.statement.includes('deleteMany eliminated'), 'Point 28: D-05 mandates non-destructive CMS deletion semantics');

    const d06 = DecisionRegisterRiskControlsService.getDecision('D-06');
    assert(d06?.statement.includes('fails closed'), 'Point 28: D-06 mandates fail-closed custom code execution');

    // Invariant: all decisions have declared role owners, no fabricated personal names
    const anyFabricatedNames = decisions.some(d => d.actualNamedOwner !== null);
    assert(!anyFabricatedNames, 'Point 28: No unconfirmed employee names fabricated');
  } catch (err: any) {
    // recorded
  }

  // --------------------------------------------------------------------------
  // Test 2: Decision Freshness & Unresolved Decision Validation
  // --------------------------------------------------------------------------
  try {
    const validation = DecisionRegisterRiskControlsService.validateDecisionsFreshness();
    assert(validation.expiredDecisions.length === 0, 'Point 28: Zero expired decisions currently active');
    // D-01 is explicitly in PROPOSED_UNRESOLVED status awaiting commercial buyer validation
    assert(validation.unresolvedDecisions.length === 1, 'Point 28: Exactly 1 decision (D-01) transparently unresolved');
    assert(validation.unresolvedDecisions[0].includes('D-01'), 'Point 28: Accurately identifies D-01 as unresolved');
  } catch (err: any) {
    // recorded
  }

  // --------------------------------------------------------------------------
  // Test 3: 10 Release-Blocking Launch Risks Evaluation
  // --------------------------------------------------------------------------
  try {
    const baseCleanChecks = {
      hasTenantMixing: false,
      hasProhibitedDataCollection: false,
      hasKnownSourceLoss: false,
      hasFalseAcceptedLeadState: false,
      hasCorruptedCandidateDigest: false,
      hasFailedMandatorySecurityGate: false,
      hasUnqualifiedUntrustedCodeExecution: false,
      hasUnapprovedDestructiveMigration: false,
      hasFalselyAdvertisedFeature: false,
      hasMissingPortabilityEvidence: false
    };

    // Case A: Clean checks pass
    const cleanResult = DecisionRegisterRiskControlsService.evaluateReleaseBlockingRisks(baseCleanChecks);
    assert(cleanResult.isReleaseBlocked === false, 'Point 28: Clean release candidate is not blocked');
    assert(cleanResult.blockingReasons.length === 0, 'Point 28: Zero blocking reasons on clean candidate');

    // Case B: Tenant mixing blocks release immediately
    const tenantMixingResult = DecisionRegisterRiskControlsService.evaluateReleaseBlockingRisks({
      ...baseCleanChecks,
      hasTenantMixing: true
    });
    assert(tenantMixingResult.isReleaseBlocked === true, 'Point 28: Tenant mixing blocks release');
    assert(tenantMixingResult.blockingReasons.some(r => r.includes('tenant mixing')), 'Point 28: Records tenant mixing blocking reason');

    // Case C: False accepted lead state blocks release
    const falseLeadResult = DecisionRegisterRiskControlsService.evaluateReleaseBlockingRisks({
      ...baseCleanChecks,
      hasFalseAcceptedLeadState: true
    });
    assert(falseLeadResult.isReleaseBlocked === true, 'Point 28: False accepted lead state blocks release');
    assert(falseLeadResult.blockingReasons.some(r => r.includes('False accepted-lead state')), 'Point 28: Records false lead reason');

    // Case D: Multiple critical defects report all blocking reasons
    const multiDefectResult = DecisionRegisterRiskControlsService.evaluateReleaseBlockingRisks({
      ...baseCleanChecks,
      hasCorruptedCandidateDigest: true,
      hasUnapprovedDestructiveMigration: true
    });
    assert(multiDefectResult.isReleaseBlocked === true, 'Point 28: Multiple defects block release');
    assert(multiDefectResult.blockingReasons.length === 2, 'Point 28: Reports both blocking reasons');
  } catch (err: any) {
    // recorded
  }

  // --------------------------------------------------------------------------
  // Test 4: Integration with Release Promotion Engine (Blocks Promotion on Launch Risk)
  // --------------------------------------------------------------------------
  try {
    // Create candidate in DurableReleaseController
    const candidate = DurableReleaseController.createCandidate({
      websiteId: 'site-rel-test',
      tenantId: 'tenant-rel-test',
      sourceCommit: 'commit-abc',
      sourceManifestDigest: 'sha256-src-man',
      artifactDigest: 'sha256-expected-artifact-hash'
    });

    const cleanObservations: Record<string, { passed: boolean }> = {
      GATE_01_SPEC_COMPLETENESS: { passed: true },
      GATE_02_TYPE_CHECK_DEPS: { passed: true },
      GATE_03_REPRODUCIBLE_BUILD: { passed: true },
      GATE_04_SOURCE_PRESERVATION: { passed: true },
      GATE_05_CONTENT_DB_MIGRATION: { passed: true },
      GATE_06_AUTH_TENANT_PRIVACY: { passed: true },
      GATE_07_FUNCTIONAL_JOURNEYS: { passed: true },
      GATE_08_ACCESSIBILITY: { passed: true },
      GATE_09_ROUTES_SEO_STATUS: { passed: true },
      GATE_10_PERFORMANCE_BUDGET: { passed: true },
      GATE_11_STAGING_DEST_PROBES: { passed: true },
      GATE_12_EXPORT_COMPATIBILITY: { passed: true }
    };

    // Attempt promotion with mismatched artifact digest -> Point 28 release blocking risk must abort promotion
    let promotionBlocked = false;
    try {
      IntegratedPublishingReleaseService.coordinatePromotion(
        candidate.id,
        null,
        'sha256-MISMATCHED-TAMPERED-DIGEST', // Injected corrupted digest
        cleanObservations
      );
    } catch (promErr: any) {
      promotionBlocked = promErr.code === 'RELEASE_BLOCKING_RISK_TRIGGERED';
    }

    assert(promotionBlocked === true, 'Point 28: Release promotion engine aborts on release-blocking launch risk');
  } catch (err: any) {
    // recorded
  }

  return { passed, failed, errors };
}
