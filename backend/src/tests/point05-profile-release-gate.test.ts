/**
 * ForgeStudio Execution Blueprint v2.1 — Point 05: Executable Capability Contract
 * Test Suite 3: Profile-Aware Mandatory Release Gate (CAP-119)
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateProfileReleaseGate,
  registerReleaseException,
} from "../services/capabilities/releaseGate.js";
import {
  recordEvidence,
  invalidateCapabilityEvidence,
} from "../services/capabilities/evidenceRegistry.js";
import { resolveProfileCapabilities } from "../services/capabilities/capabilityManifest.js";

test("Point 05 — Profile-Aware Mandatory Release Gate Suite", async (t) => {
  await t.test("1. Profile Capability Invariant: Foundation (F) is mandatory for every profile recipe", () => {
    const profServices = resolveProfileCapabilities("PROFESSIONAL_SERVICES");
    const commerce = resolveProfileCapabilities("COMMERCE_CATALOGUE");
    const editorial = resolveProfileCapabilities("EDITORIAL_PUBLISHER");

    // All recipes must mandate all 64 Foundation caps
    assert.equal(profServices.mandatoryCaps.length, 64);
    assert.equal(commerce.mandatoryCaps.length, 64);
    assert.equal(editorial.mandatoryCaps.length, 64);

    // Business module omissions: Professional Services omits commerce (CAP-101)
    assert.ok(profServices.omittedCaps.includes("CAP-101"));
    // Commerce profile activates CAP-101
    assert.ok(commerce.activeCaps.includes("CAP-101"));
  });

  await t.test("2. Zero-Tolerance Release Gate: Missing or stale evidence strictly blocks publishing", () => {
    // Invalidate evidence for a mandatory foundation cap (e.g. CAP-003)
    invalidateCapabilityEvidence("CAP-003", "Test invalidation for release gate verification");

    const assessment = evaluateProfileReleaseGate("site-gate-1", "PROFESSIONAL_SERVICES", []);
    assert.equal(assessment.canPublish, false, "Must block publishing when mandatory CAP lacks fresh evidence");
    assert.equal(assessment.decision, "BLOCKED");
    assert.ok(assessment.summary.criticalFailures >= 1);
    assert.ok(assessment.blockers.some((b) => b.includes("CAP-003")), "Blockers must list CAP-003");

    // Re-verify evidence to restore health
    recordEvidence({
      capId: "CAP-003",
      type: "AUTOMATED_TEST",
      artifactReference: "backend/src/tests/document-contracts.ts",
      verificationScope: "Document tree schema validation re-tested",
      environment: "CI_TEST_RUNNER",
      result: "PASSED",
      freshnessDaysLimit: 30,
    });
  });

  await t.test("3. Non-Waivable Security Gates: Strictly forbids exceptions on core security/consent gates", () => {
    // CAP-006: Tenant isolation (Non-waivable!)
    assert.throws(
      () =>
        registerReleaseException({
          capId: "CAP-006",
          scope: "DEPLOYMENT",
          approvedBy: "security-auditor@example.dev",
          reason: "Bypass tenant isolation for demo",
          mitigation: "Manual check",
          durationDays: 7,
        }),
      /non-waivable security\/consent gate/,
      "Must forbid granting release exceptions on tenant isolation"
    );

    // CAP-043: Durable lead acceptance (Non-waivable!)
    assert.throws(
      () =>
        registerReleaseException({
          capId: "CAP-043",
          scope: "DEPLOYMENT",
          approvedBy: "vp-product@example.dev",
          reason: "Bypass lead durability",
          mitigation: "Log to console",
          durationDays: 7,
        }),
      /non-waivable security\/consent gate/,
      "Must forbid granting release exceptions on durable leads"
    );
  });

  await t.test("4. Restricted Exception Lifecycle: Grants valid exception and enforces expiration threshold", () => {
    // Grant exception for a non-security foundation capability (e.g. CAP-022 Web Fonts)
    const activeException = registerReleaseException({
      capId: "CAP-022",
      scope: "DEPLOYMENT_STAGING",
      approvedBy: "design-director@example.dev",
      reason: "Temporary CDN font outage; falling back to system fonts",
      mitigation: "System font stack configured in global CSS",
      durationDays: 14,
    });

    assert.ok(activeException.id.startsWith("exc-"));
    assert.equal(activeException.isExpired, false);

    // Simulate an expired exception (durationDays: -1)
    const expiredException = registerReleaseException({
      capId: "CAP-025",
      scope: "DEPLOYMENT_STAGING",
      approvedBy: "theme-lead@example.dev",
      reason: "Old exception",
      mitigation: "None",
      durationDays: -1, // Expired immediately!
    });

    // Check expiration evaluated
    const expiryDate = new Date(expiredException.expiresAt);
    assert.ok(new Date() > expiryDate, "Exception must be expired");
  });

  await t.test("5. Profile Cleanliness: Unused B modules do not block releases for unneeded profiles", () => {
    // CAP-101 (Commerce) is NOT applicable to PROFESSIONAL_SERVICES
    const assessment = evaluateProfileReleaseGate("site-gate-2", "PROFESSIONAL_SERVICES", []);
    // Ensure CAP-101 is NOT listed as a blocker for PROFESSIONAL_SERVICES
    assert.equal(
      assessment.blockers.some((b) => b.includes("CAP-101")),
      false,
      "Inactive B modules must not block releases on profiles where they are not required"
    );
  });
});
