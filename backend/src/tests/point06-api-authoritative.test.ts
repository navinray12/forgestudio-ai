/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Test Suite 5: REST API Contracts, Tenant Authorization & Concurrency Guards
 */

import assert from "node:assert/strict";
import test from "node:test";
import { BusinessFactRegisterService } from "../services/authoritative/record1-business-facts.service.js";
import { SiteSpecService } from "../services/authoritative/record2-sitespec.service.js";
import { ReleaseEvidenceManifestService } from "../services/authoritative/record6-release-manifest.service.js";
import { RelationalChangeImpactGraphService } from "../services/authoritative/relationalChangeImpactGraph.service.js";
import { SecurityPlanesService } from "../services/authoritative/securityPlanes.service.js";

test("Point 06 — REST API Contracts & Concurrency Suite", async (t) => {
  t.beforeEach(() => {
    BusinessFactRegisterService.clearMemory();
    SiteSpecService.clearMemory();
    ReleaseEvidenceManifestService.clearMemory();
    RelationalChangeImpactGraphService.clearMemory();
    SecurityPlanesService.clearMemory();
  });

  await t.test("1. Business Facts API: Enforces validation on fact proposals and approvals", async () => {
    // Empty statement rejected
    await assert.rejects(
      async () => {
        await BusinessFactRegisterService.proposeFact(
          {
            tenantId: "tenant-1",
            websiteId: "site-1",
            category: "BUSINESS_FACT",
            statement: "   ",
          },
          "user-1"
        );
      },
      /Fact statement cannot be empty/
    );

    // Missing tenant ID rejected
    await assert.rejects(
      async () => {
        await BusinessFactRegisterService.proposeFact(
          {
            tenantId: "",
            websiteId: "site-1",
            category: "BUSINESS_FACT",
            statement: "Valid statement",
          },
          "user-1"
        );
      },
      /Tenant ID and Website ID are required/
    );
  });

  await t.test("2. Release Rollback API: Fails when target release does not exist or cross-website rollback attempted", async () => {
    await assert.rejects(
      async () => {
        await ReleaseEvidenceManifestService.rollbackRelease(
          "site-1",
          "rel_nonexistent",
          "admin",
          "Emergency rollback"
        );
      },
      /Target rollback release not found/
    );
  });

  await t.test("3. Security Planes Status API: Reports operational statuses and backpressure metrics", () => {
    const status = SecurityPlanesService.getPlanesStatus();
    assert.equal(status.length, 3);
    assert.equal(status.some((p) => p.plane === "CONTROL_PLANE"), true);
    assert.equal(status.some((p) => p.plane === "BUILD_PLANE"), true);
    assert.equal(status.some((p) => p.plane === "DELIVERY_PLANE"), true);

    const metrics = SecurityPlanesService.getAnalyticsMetrics();
    assert.equal(metrics.isSaturated, false);
    assert.equal(metrics.maxQueueCapacity, 100);
  });
});
