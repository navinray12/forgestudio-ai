/**
 * ForgeStudio Execution Blueprint v2.1 — Point 17 Automated Test Suite
 * Release Integrity, Evidence and Change Safety
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DurableReleaseController } from "../services/releaseIntegrity/durableReleaseController.service.ts";
import { MandatoryReleaseGatesService } from "../services/releaseIntegrity/mandatoryReleaseGates.service.ts";
import { ReleasePassportService } from "../services/releaseIntegrity/releasePassportService.service.ts";

describe("Point 17 — Release Integrity, Evidence and Change Safety", () => {
  it("should enforce the 8-state release lifecycle and legal state transitions", () => {
    const candidate = DurableReleaseController.requestRelease(
      "tenant_alpha",
      "web_01",
      1,
      "sha256_bundle_v1",
      { sourceDigest: "s1", contentDigest: "c1", policyDigest: "p1", schemaDigest: "m1" },
      "lead_dev"
    );
    assert.equal(candidate.state, "REQUESTED");
    assert.equal(candidate.immutableArtifactDigest, "sha256_bundle_v1");

    // Legal forward transitions
    const planned = DurableReleaseController.transitionState(candidate.releaseId, "PLANNED", 1);
    assert.equal(planned.state, "PLANNED");

    const building = DurableReleaseController.transitionState(candidate.releaseId, "BUILDING", 2);
    assert.equal(building.state, "BUILDING");

    const verifying = DurableReleaseController.transitionState(candidate.releaseId, "VERIFYING", 3);
    assert.equal(verifying.state, "VERIFYING");

    const verified = DurableReleaseController.transitionState(candidate.releaseId, "VERIFIED", 4);
    assert.equal(verified.state, "VERIFIED");

    const staged = DurableReleaseController.transitionState(candidate.releaseId, "STAGED", 5);
    assert.equal(staged.state, "STAGED");

    // Illegal skip transition directly from STAGED to LIVE_VERIFIED without PROMOTING
    assert.throws(
      () => DurableReleaseController.transitionState(candidate.releaseId, "LIVE_VERIFIED", 6),
      /Illegal transition/
    );
  });

  it("should reject stale workers using worker fencing tokens", () => {
    const candidate = DurableReleaseController.requestRelease(
      "tenant_alpha",
      "web_01",
      2,
      "sha256_bundle_v2",
      { sourceDigest: "s2", contentDigest: "c2", policyDigest: "p2", schemaDigest: "m2" },
      "lead_dev"
    );
    // Transition to PLANNED increments fencingToken to 2
    DurableReleaseController.transitionState(candidate.releaseId, "PLANNED", 1);

    // Stale worker with token 1 tries to transition
    assert.throws(
      () => DurableReleaseController.transitionState(candidate.releaseId, "BUILDING", 1),
      /Stale worker fencing token/
    );
  });

  it("should enforce Compare-And-Swap (CAS) on active promotion and reject mutated artifacts", () => {
    const candidate = DurableReleaseController.requestRelease(
      "tenant_alpha",
      "web_promo",
      1,
      "sha256_exact_immutable_digest",
      { sourceDigest: "s1", contentDigest: "c1", policyDigest: "p1", schemaDigest: "m1" },
      "lead_dev"
    );
    DurableReleaseController.transitionState(candidate.releaseId, "PLANNED", 1);
    DurableReleaseController.transitionState(candidate.releaseId, "BUILDING", 2);
    DurableReleaseController.transitionState(candidate.releaseId, "VERIFYING", 3);
    DurableReleaseController.transitionState(candidate.releaseId, "VERIFIED", 4);

    // 1. Mutated artifact digest rejected!
    assert.throws(
      () => DurableReleaseController.promoteToActive(candidate.releaseId, null, "sha256_tampered_or_regenerated"),
      /Artifact digest mismatch/
    );

    // Reset candidate for successful CAS test
    const candidate2 = DurableReleaseController.requestRelease(
      "tenant_alpha",
      "web_promo_2",
      1,
      "sha256_valid_digest",
      { sourceDigest: "s1", contentDigest: "c1", policyDigest: "p1", schemaDigest: "m1" },
      "lead_dev"
    );
    DurableReleaseController.transitionState(candidate2.releaseId, "PLANNED", 1);
    DurableReleaseController.transitionState(candidate2.releaseId, "BUILDING", 2);
    DurableReleaseController.transitionState(candidate2.releaseId, "VERIFYING", 3);
    DurableReleaseController.transitionState(candidate2.releaseId, "VERIFIED", 4);

    // 2. CAS Conflict: expected previous release is wrong
    assert.throws(
      () => DurableReleaseController.promoteToActive(candidate2.releaseId, "rel_non_existent", "sha256_valid_digest"),
      /CAS conflict/
    );

    // 3. Successful CAS promotion
    const promoted = DurableReleaseController.promoteToActive(candidate2.releaseId, null, "sha256_valid_digest");
    assert.equal(promoted.state, "LIVE_VERIFIED");
    assert.equal(promoted.originLiveState, "ORIGIN_LIVE");
  });

  it("should evaluate 12 mandatory release gates and prevent waiving the security/privacy gate", () => {
    // Missing evidence fails gates
    const evalFail = MandatoryReleaseGatesService.evaluateAllMandatoryGates({
      releaseId: "rel_test",
      websiteId: "web_01",
      tenantId: "tenant_alpha",
      artifactDigest: "sha256_bundle",
      targetProfile: "MANAGED_DECLARATIVE",
      evidenceObservations: {}, // no observations
    });
    assert.equal(evalFail.allPassed, false);
    assert.equal(evalFail.failedGateIds.length, 12);

    // Attempting to waive Security & Privacy gate 06 is strictly rejected
    const evalWaiveSecurity = MandatoryReleaseGatesService.evaluateAllMandatoryGates({
      releaseId: "rel_test",
      websiteId: "web_01",
      tenantId: "tenant_alpha",
      artifactDigest: "sha256_bundle",
      targetProfile: "MANAGED_DECLARATIVE",
      evidenceObservations: {},
      waivedExceptions: {
        GATE_06_AUTH_TENANT_PRIVACY: {
          approver: "bad_actor",
          expiryDate: "2026-12-31",
          mitigation: "Will fix later",
        },
      },
    });
    assert.ok(evalWaiveSecurity.failedGateIds.includes("GATE_06_AUTH_TENANT_PRIVACY"));
  });

  it("should issue trusted release passports and reject customer self-attestation", () => {
    const attestations = MandatoryReleaseGatesService.MANDATORY_GATES.map((g) => ({
      gateId: g.id,
      gateName: g.name,
      result: "PASSED" as const,
      runnerIdentity: "TRUSTED_VERIFIER_RUNNER",
      evaluatedAt: new Date().toISOString(),
      testCoverageScope: "FULL_REGRESSION_FLOOR",
      unresolvedRisks: [],
      evidenceDigest: `sha256_${g.id}`,
    }));

    // Customer script rejected from self-issuing
    assert.throws(
      () => ReleasePassportService.issueReleasePassport(
        "rel_sample",
        "web_01",
        "tenant_alpha",
        "sha256_artifact",
        attestations,
        "CUSTOMER_SCRIPT" as any
      ),
      /Customer-controlled scripts are not authorized/
    );

    // Trusted platform verifier issues valid signed passport
    const passport = ReleasePassportService.issueReleasePassport(
      "rel_sample",
      "web_01",
      "tenant_alpha",
      "sha256_artifact",
      attestations,
      "TRUSTED_PLATFORM_VERIFIER"
    );
    assert.equal(passport.passedAllMandatoryGates, true);
    assert.ok(passport.trustedVerifierSignature);

    const verified = ReleasePassportService.verifyPassport(passport);
    assert.equal(verified, true);
  });

  it("should perform safe code rollback while preserving newly committed business leads", () => {
    const rollbackResult = DurableReleaseController.rollbackCodeOnly("web_01", "rel_known_good");
    assert.equal(rollbackResult.rolledBackTo, "rel_known_good");
    assert.equal(rollbackResult.preservedLeadsContract, true);
  });
});
