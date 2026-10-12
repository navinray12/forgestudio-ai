/**
 * ForgeStudio Execution Blueprint v2.1 — Point 07: Reliable Generation & Controlled AI Assistance
 * Test Suite 6: State-Machine Invariants & Model-Checking Tests
 */

import assert from "node:assert/strict";
import test from "node:test";
import { generationJobStateMachine } from "../services/generation/generationJobStateMachine.service.js";
import { budgetReservationService } from "../services/generation/budgetReservation.service.js";
import { generationEngineService } from "../services/generation/generationEngine.service.js";

test("Point 07 — State-Machine Invariants & Model-Checking Suite", async (t) => {
  t.beforeEach(() => {
    generationEngineService.reset();
  });

  await t.test("Invariant A: Stale worker cannot promote candidate to active release", () => {
    const job = generationJobStateMachine.createJob({
      jobId: "job-stale-promo",
      websiteId: "site-stale-01",
      tenantId: "tenant-stale"
    });

    const tokenWorker1 = job.workerFencingToken; // Token 1

    // Worker 2 takes over the job and bumps fencing token
    const lease2 = generationJobStateMachine.acquireWorkerLease(job.jobId);
    assert.equal(lease2.fencingToken, 2);

    // Stale Worker 1 attempts to publish job
    assert.throws(
      () => {
        generationJobStateMachine.transitionState({
          jobId: job.jobId,
          targetState: "PUBLISHED",
          workerFencingToken: tokenWorker1
        });
      },
      /Fencing token mismatch: worker provided 1, active token is 2/
    );
  });

  await t.test("Invariant B: Unverified or failed candidate CANNOT be published", () => {
    const job = generationJobStateMachine.createJob({
      jobId: "job-unverified-promo",
      websiteId: "site-unverified",
      tenantId: "tenant-unverified"
    });

    // Directly attempting to publish while state is REQUESTED or FAILED
    assert.throws(
      () => {
        generationJobStateMachine.transitionState({
          jobId: job.jobId,
          targetState: "PUBLISHED",
          workerFencingToken: job.workerFencingToken
        });
      },
      /Illegal state transition: cannot transition from REQUESTED to PUBLISHED/
    );

    // Transition to FAILED
    generationJobStateMachine.transitionState({
      jobId: job.jobId,
      targetState: "FAILED",
      workerFencingToken: job.workerFencingToken,
      reason: "Validation check failed"
    });

    // Attempting to publish from FAILED
    assert.throws(
      () => {
        generationJobStateMachine.transitionState({
          jobId: job.jobId,
          targetState: "PUBLISHED",
          workerFencingToken: job.workerFencingToken
        });
      },
      /Illegal state transition: cannot transition from FAILED to PUBLISHED/
    );
  });

  await t.test("Invariant C: Idempotent generation request does not duplicate budget reservations", () => {
    const tenantId = "tenant-idempotent";
    budgetReservationService.setTenantLimits({
      tenantId,
      monthlyLimitCents: 10000,
      currentSpendCents: 0,
      perJobMaxSpendCents: 500
    });

    const idempotencyKey = "idem-req-unique-999";

    // Request 1
    const job1 = generationJobStateMachine.createJob({
      jobId: "job-idem-1",
      websiteId: "site-idem",
      tenantId,
      idempotencyKey
    });

    const res1 = budgetReservationService.reserveBudget({
      reservationId: "res-idem-1",
      jobId: job1.jobId,
      websiteId: "site-idem",
      tenantId,
      estimatedCostCents: 200
    });

    const initialSpend = budgetReservationService.getTenantLimits(tenantId).currentSpendCents;
    assert.equal(initialSpend, 200);

    // Replay Request with same idempotency key
    const job2 = generationJobStateMachine.createJob({
      jobId: "job-idem-2", // different jobId requested, but same idempotencyKey!
      websiteId: "site-idem",
      tenantId,
      idempotencyKey
    });

    // Must return original job
    assert.equal(job2.jobId, job1.jobId);

    // Reservation replay must return original reservation without double-charging
    const res2 = budgetReservationService.reserveBudget({
      reservationId: "res-idem-2",
      jobId: job2.jobId,
      websiteId: "site-idem",
      tenantId,
      estimatedCostCents: 200
    });

    assert.equal(res2.reservationId, res1.reservationId);
    assert.equal(budgetReservationService.getTenantLimits(tenantId).currentSpendCents, 200);
  });

  await t.test("Invariant D: Models and untrusted roles cannot publish releases directly", async () => {
    // Model output / patch attempting promotion
    await assert.rejects(
      async () => {
        await generationEngineService.promoteToRelease({
          jobId: "job-test-fake",
          callerRole: "AI_MODEL_PATCH",
          actorId: "model-gemini"
        });
      },
      /Unauthorized promotion: role 'AI_MODEL_PATCH' cannot publish releases/
    );

    // Ordinary viewer attempting promotion
    await assert.rejects(
      async () => {
        await generationEngineService.promoteToRelease({
          jobId: "job-test-fake",
          callerRole: "VIEWER",
          actorId: "viewer-charlie"
        });
      },
      /Unauthorized promotion: role 'VIEWER' cannot publish releases/
    );
  });
});
