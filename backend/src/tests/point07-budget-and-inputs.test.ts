/**
 * ForgeStudio Execution Blueprint v2.1 — Point 07: Reliable Generation & Controlled AI Assistance
 * Test Suite 2: Budget Reservation & Immutable Input Snapshot
 */

import assert from "node:assert/strict";
import test from "node:test";
import { budgetReservationService } from "../services/generation/budgetReservation.service.js";
import { immutableInputSnapshotService } from "../services/generation/immutableInputSnapshot.service.js";

test("Point 07 — Budget Reservation & Immutable Snapshot Suite", async (t) => {
  t.beforeEach(() => {
    budgetReservationService.reset();
    immutableInputSnapshotService.reset();
  });

  await t.test("1. Budget reservation: Enforces per-job maximum spend ceiling", () => {
    const tenantId = "tenant-budget-test";
    budgetReservationService.setTenantLimits({
      tenantId,
      monthlyLimitCents: 10000,
      currentSpendCents: 0,
      perJobMaxSpendCents: 200 // Max 200 cents ($2) per job
    });

    // Request exceeding per-job limit (300 cents) must fail
    assert.throws(
      () => {
        budgetReservationService.reserveBudget({
          reservationId: "res-exceed",
          jobId: "job-exceed",
          websiteId: "site-01",
          tenantId,
          estimatedCostCents: 300
        });
      },
      /Estimated generation cost \(300 cents\) exceeds per-job limit \(200 cents\)/
    );

    // Request within per-job limit (150 cents) must succeed
    const reservation = budgetReservationService.reserveBudget({
      reservationId: "res-ok",
      jobId: "job-ok",
      websiteId: "site-01",
      tenantId,
      estimatedCostCents: 150
    });
    assert.equal(reservation.status, "RESERVED");
    assert.equal(reservation.reservedAmountCents, 150);
  });

  await t.test("2. Budget settlement: Reconciles actual cost and refunds unused reservation", () => {
    const tenantId = "tenant-settle-test";
    budgetReservationService.setTenantLimits({
      tenantId,
      monthlyLimitCents: 10000,
      currentSpendCents: 0,
      perJobMaxSpendCents: 500
    });

    const reservation = budgetReservationService.reserveBudget({
      reservationId: "res-settle-01",
      jobId: "job-settle-01",
      websiteId: "site-02",
      tenantId,
      estimatedCostCents: 300
    });
    assert.equal(budgetReservationService.getTenantLimits(tenantId).currentSpendCents, 300);

    // Record token usage costing ~100 cents
    budgetReservationService.recordUsage({
      jobId: "job-settle-01",
      promptTokens: 10000,
      completionTokens: 5000,
      modelId: "gemini-1.5-pro"
    });

    // Settle reservation
    const settled = budgetReservationService.settleReservation("job-settle-01");
    assert.equal(settled.status, "SETTLED");
    assert.ok(settled.actualSettledCostCents < 300);
    // Unused portion refunded back to tenant spend
    assert.ok(budgetReservationService.getTenantLimits(tenantId).currentSpendCents < 300);
  });

  await t.test("3. Platform policy owner override: Only PLATFORM_POLICY_OWNER role can override budget", () => {
    const tenantId = "tenant-override-test";
    budgetReservationService.setTenantLimits({
      tenantId,
      monthlyLimitCents: 10000,
      currentSpendCents: 0,
      perJobMaxSpendCents: 400
    });

    budgetReservationService.reserveBudget({
      reservationId: "res-ov-01",
      jobId: "job-ov-01",
      websiteId: "site-03",
      tenantId,
      estimatedCostCents: 100
    });

    // Ordinary user attempt must be rejected
    assert.throws(
      () => {
        budgetReservationService.overrideBudget({
          jobId: "job-ov-01",
          additionalAmountCents: 150,
          callerRole: "USER",
          reason: "Need more tokens",
          actorId: "user-123"
        });
      },
      /Unauthorized budget override: caller role USER is not PLATFORM_POLICY_OWNER/
    );

    // Platform policy owner succeeds
    const overridden = budgetReservationService.overrideBudget({
      jobId: "job-ov-01",
      additionalAmountCents: 150,
      callerRole: "PLATFORM_POLICY_OWNER",
      reason: "Authorized enterprise increase",
      actorId: "owner-alice"
    });
    assert.equal(overridden.status, "OVERRIDDEN");
    assert.equal(overridden.reservedAmountCents, 250);
  });

  await t.test("4. Immutable input snapshot: Captures cryptographic hash and detects source modifications", async () => {
    const websiteId = "site-snap-test";
    const tenantId = "tenant-snap-test";

    const snapshot = await immutableInputSnapshotService.captureSnapshot({
      snapshotId: "snap-01",
      jobId: "job-snap-01",
      websiteId,
      tenantId,
      brief: {
        purpose: "E-Commerce Storefront",
        targetAudience: "Retail Consumers",
        requiredRoutes: ["/", "/products", "/checkout"],
        selectedProfile: "STANDARD_COMMERCE"
      }
    });

    assert.ok(snapshot.snapshotHash);
    assert.equal(snapshot.brief.purpose, "E-Commerce Storefront");
    assert.equal(snapshot.capabilities.profile, "STANDARD_COMMERCE");

    // Preservation check passes for clean source
    const preservation = immutableInputSnapshotService.verifySourcePreservation(snapshot.snapshotId);
    assert.equal(preservation.isClean, true);
  });
});
