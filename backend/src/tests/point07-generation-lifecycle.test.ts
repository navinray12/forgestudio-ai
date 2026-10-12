/**
 * ForgeStudio Execution Blueprint v2.1 — Point 07: Reliable Generation & Controlled AI Assistance
 * Test Suite 1: Generation Workflow & State Machine Lifecycle
 */

import assert from "node:assert/strict";
import test from "node:test";
import { generationJobStateMachine } from "../services/generation/generationJobStateMachine.service.js";
import { generationEngineService } from "../services/generation/generationEngine.service.js";

test("Point 07 — Generation Workflow & Lifecycle Suite", async (t) => {
  t.beforeEach(() => {
    generationEngineService.reset();
  });

  await t.test("1. Enforces strict legal state transition order and rejects invalid state jumps", () => {
    const job = generationJobStateMachine.createJob({
      jobId: "job-state-test-01",
      websiteId: "site-01",
      tenantId: "tenant-acme"
    });

    assert.equal(job.currentState, "REQUESTED");
    assert.equal(job.activeReleaseBlocked, true);

    // Illegal jump: REQUESTED -> PUBLISHED must be rejected
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

    // Legal transition: REQUESTED -> AUTHORIZED
    const authorized = generationJobStateMachine.transitionState({
      jobId: job.jobId,
      targetState: "AUTHORIZED",
      workerFencingToken: job.workerFencingToken
    });
    assert.equal(authorized.currentState, "AUTHORIZED");
    assert.equal(authorized.version, 2);

    // Legal transition: AUTHORIZED -> BUDGET_RESERVED
    const reserved = generationJobStateMachine.transitionState({
      jobId: job.jobId,
      targetState: "BUDGET_RESERVED",
      workerFencingToken: job.workerFencingToken
    });
    assert.equal(reserved.currentState, "BUDGET_RESERVED");
  });

  await t.test("2. Fencing tokens and worker leases prevent stale workers from mutating job", () => {
    const job = generationJobStateMachine.createJob({
      jobId: "job-fencing-test",
      websiteId: "site-02",
      tenantId: "tenant-acme"
    });

    const staleToken = job.workerFencingToken; // Token 1

    // New worker acquires lease, bumping token to 2
    const lease = generationJobStateMachine.acquireWorkerLease(job.jobId);
    assert.equal(lease.fencingToken, 2);

    // Stale worker attempts transition using old token 1
    assert.throws(
      () => {
        generationJobStateMachine.transitionState({
          jobId: job.jobId,
          targetState: "AUTHORIZED",
          workerFencingToken: staleToken
        });
      },
      /Fencing token mismatch: worker provided 1, active token is 2/
    );

    // Active worker succeeds with token 2
    const updated = generationJobStateMachine.transitionState({
      jobId: job.jobId,
      targetState: "AUTHORIZED",
      workerFencingToken: lease.fencingToken
    });
    assert.equal(updated.currentState, "AUTHORIZED");
  });

  await t.test("3. Cancelled jobs reject further state transitions and block active release promotion", () => {
    const job = generationJobStateMachine.createJob({
      jobId: "job-cancel-test",
      websiteId: "site-03",
      tenantId: "tenant-acme"
    });

    generationJobStateMachine.cancelJob(job.jobId, "User cancelled operation");
    const cancelled = generationJobStateMachine.getJob(job.jobId);
    assert.equal(cancelled.isCancelled, true);
    assert.equal(cancelled.currentState, "CANCELLED");
    assert.equal(cancelled.activeReleaseBlocked, true);

    // Cannot transition cancelled job
    assert.throws(
      () => {
        generationJobStateMachine.transitionState({
          jobId: job.jobId,
          targetState: "AUTHORIZED",
          workerFencingToken: cancelled.workerFencingToken
        });
      },
      /Job job-cancel-test is cancelled; further transitions rejected/
    );
  });

  await t.test("4. Full generation pipeline enforces authorization and budget reservation before AI execution", async () => {
    const websiteId = "site-full-pipeline";
    const tenantId = "tenant-007";

    const { job, reservation, snapshot } = await generationEngineService.initiateGeneration({
      jobId: "job-pipeline-01",
      websiteId,
      tenantId,
      callerRole: "OWNER",
      brief: {
        purpose: "Modern SaaS Website",
        targetAudience: "B2B Enterprises",
        requiredRoutes: ["/", "/contact"],
        selectedProfile: "STANDARD_COMMERCE"
      }
    });

    assert.equal(job.currentState, "BINDINGS_RESOLVED");
    assert.equal(reservation.status, "RESERVED");
    assert.ok(reservation.reservedAmountCents > 0);
    assert.ok(snapshot.snapshotHash.length > 0);
  });
});
