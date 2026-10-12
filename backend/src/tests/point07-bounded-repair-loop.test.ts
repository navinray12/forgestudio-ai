/**
 * ForgeStudio Execution Blueprint v2.1 — Point 07: Reliable Generation & Controlled AI Assistance
 * Test Suite 4: Bounded Repair Controller & Actionable Diagnostics
 */

import assert from "node:assert/strict";
import test from "node:test";
import { boundedRepairController } from "../services/generation/boundedRepairController.service.js";
import { generationDiagnosticsService } from "../services/generation/generationDiagnostics.service.js";
import { budgetReservationService } from "../services/generation/budgetReservation.service.js";
import type { TypedPatchProposal } from "../services/generation/typedPatchContract.service.js";

test("Point 07 — Bounded Repair Controller & Diagnostics Suite", async (t) => {
  t.beforeEach(() => {
    boundedRepairController.reset();
    generationDiagnosticsService.reset();
    budgetReservationService.reset();
  });

  await t.test("1. Enforces default limit of 2 repair attempts maximum", () => {
    assert.equal(boundedRepairController.getPlatformRepairLimit(), 2);

    const state = boundedRepairController.initRepairState({
      candidateId: "cand-rep-01",
      jobId: "job-rep-01",
      websiteId: "site-rep-01",
      tenantId: "tenant-rep"
    });

    assert.equal(state.maxAllowedAttempts, 2);
    assert.equal(state.currentAttemptCount, 0);

    const eligibility1 = boundedRepairController.isEligibleForRepair("cand-rep-01");
    assert.equal(eligibility1.eligible, true);
    assert.equal(eligibility1.remainingAttempts, 2);
  });

  await t.test("2. Only PLATFORM_POLICY_OWNER can modify the repair attempt limit", () => {
    // Ordinary admin cannot modify platform repair limit
    assert.throws(
      () => {
        boundedRepairController.updatePlatformRepairLimitPolicy({
          newLimit: 4,
          callerRole: "ADMIN",
          actorId: "admin-bob",
          auditReason: "Allow more retries"
        });
      },
      /Unauthorized configuration attempt: role 'ADMIN' cannot change platform repair limit/
    );

    // Platform policy owner succeeds
    const newLimit = boundedRepairController.updatePlatformRepairLimitPolicy({
      newLimit: 3,
      callerRole: "PLATFORM_POLICY_OWNER",
      actorId: "owner-alice",
      auditReason: "Policy update for enterprise batch"
    });
    assert.equal(newLimit, 3);
  });

  await t.test("3. Halts repair loop when attempt limit is exhausted and preserves candidate", () => {
    const candidateId = "cand-rep-limit";
    const jobId = "job-rep-limit";

    budgetReservationService.reserveBudget({
      reservationId: "res-limit",
      jobId,
      websiteId: "site-01",
      tenantId: "tenant-01",
      estimatedCostCents: 500
    });

    boundedRepairController.initRepairState({
      candidateId,
      jobId,
      websiteId: "site-01",
      tenantId: "tenant-01"
    });

    const samplePatch: TypedPatchProposal = {
      patchId: "patch-sample",
      jobId,
      candidateId,
      tenantId: "tenant-01",
      expectedBaseRevision: 1,
      operation: "UPDATE_DESIGN_TOKEN",
      targetRecord: "RECORD2_SITESPEC",
      targetObjectId: "token",
      affectedScope: {},
      payload: { font: "Inter" },
      intendedBehavior: "Update font"
    };

    const dummyState = { token: "value" };
    const context = { currentBaseRevision: 1, protectedFilePaths: [] };

    // Attempt 1: succeeds
    const res1 = boundedRepairController.executeRepairAttempt({
      candidateId,
      candidateState: dummyState,
      repairPatch: samplePatch,
      context
    });
    assert.equal(res1.success, true);
    assert.equal(res1.remainingAttempts, 1);

    // Attempt 2: succeeds
    const res2 = boundedRepairController.executeRepairAttempt({
      candidateId,
      candidateState: dummyState,
      repairPatch: samplePatch,
      context
    });
    assert.equal(res2.success, true);
    assert.equal(res2.remainingAttempts, 0);

    // Attempt 3: REJECTED because max 2 attempts reached!
    assert.throws(
      () => {
        boundedRepairController.executeRepairAttempt({
          candidateId,
          candidateState: dummyState,
          repairPatch: samplePatch,
          context
        });
      },
      /Repair attempt rejected: Maximum repair attempt limit \(2\) reached/
    );
  });

  await t.test("4. Generation diagnostics: Redacts sensitive secrets from user-facing and technical messages", () => {
    const diag = generationDiagnosticsService.recordDiagnostic({
      diagnosticId: "diag-secret-test",
      jobId: "job-sec",
      candidateId: "cand-sec",
      category: "ACTION_DELIVERY",
      code: "API_KEY_EXPOSURE_PREVENTED",
      severity: "BLOCKING",
      userFacingMessage: "Failed connection with api-key: sk-1234567890abcdef1234567890",
      technicalDetails: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID",
      isRepairable: false,
      suggestedRemediation: "Remove hardcoded credentials.",
      attemptsUsed: 1,
      attemptsRemaining: 1
    });

    assert.ok(!diag.userFacingMessage.includes("sk-1234567890abcdef1234567890"));
    assert.ok(diag.userFacingMessage.includes("[REDACTED_SECRET]"));
    assert.ok(!diag.technicalDetails?.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
    assert.ok(diag.technicalDetails?.includes("[REDACTED_SECRET]"));
  });
});
