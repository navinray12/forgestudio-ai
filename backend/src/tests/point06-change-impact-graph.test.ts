/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Test Suite 2: Relational Change-Impact Graph & Traversal Verification
 */

import assert from "node:assert/strict";
import test from "node:test";
import { RelationalChangeImpactGraphService } from "../services/authoritative/relationalChangeImpactGraph.service.js";

test("Point 06 — Relational Change-Impact Graph Suite", async (t) => {
  t.beforeEach(() => {
    RelationalChangeImpactGraphService.clearMemory();
  });

  await t.test("1. Graph Invariants: Forbids self-dependency cycles and enforces tenant isolation", () => {
    // Self-dependency cycle rejection
    assert.throws(
      () =>
        RelationalChangeImpactGraphService.registerRelationship({
          tenantId: "tenant-acme",
          websiteId: "site-101",
          sourceType: "BUSINESS_FACT",
          sourceId: "fact_100",
          relationType: "BINDS_TO",
          targetType: "BUSINESS_FACT",
          targetId: "fact_100", // Same ID!
        }),
      /Self-referential dependency cycles are forbidden/
    );

    // Missing tenant ID rejection
    assert.throws(
      () =>
        RelationalChangeImpactGraphService.registerRelationship({
          tenantId: "",
          websiteId: "site-101",
          sourceType: "BUSINESS_FACT",
          sourceId: "fact_100",
          relationType: "BINDS_TO",
          targetType: "SITESPEC_PAGE",
          targetId: "page_home",
        }),
      /Tenant ID and Website ID are required/
    );
  });

  await t.test("2. Forward & Reverse Dependency Traversals: Correctly classifies direct and transitive dependents", () => {
    // Build a 3-tier dependency chain:
    // Offer Price (fact_price) -> Landing Page (page_landing) -> Release Manifest (rel_release_1)
    //                                                         -> Test Evidence (evid_seo_1)

    // Tier 1: Fact -> Page
    RelationalChangeImpactGraphService.registerRelationship({
      tenantId: "tenant-acme",
      websiteId: "site-101",
      sourceType: "OFFER_PRICE",
      sourceId: "fact_price_pro",
      relationType: "PROJECTS_PRICE",
      targetType: "SITESPEC_PAGE",
      targetId: "page_landing",
    });

    // Tier 2: Page -> Release
    RelationalChangeImpactGraphService.registerRelationship({
      tenantId: "tenant-acme",
      websiteId: "site-101",
      sourceType: "SITESPEC_PAGE",
      sourceId: "page_landing",
      relationType: "PINS_INPUT_VERSION",
      targetType: "RELEASE_MANIFEST",
      targetId: "rel_active_prod",
    });

    // Tier 2: Page -> Evidence
    RelationalChangeImpactGraphService.registerRelationship({
      tenantId: "tenant-acme",
      websiteId: "site-101",
      sourceType: "SITESPEC_PAGE",
      sourceId: "page_landing",
      relationType: "VALIDATES_RELEASE",
      targetType: "VERIFICATION_EVIDENCE",
      targetId: "evid_price_display_test",
    });

    // Compute change impact when Price changes
    const report = RelationalChangeImpactGraphService.computeChangeImpact({
      tenantId: "tenant-acme",
      websiteId: "site-101",
      originType: "OFFER_PRICE",
      originId: "fact_price_pro",
      oldVersion: 1,
      newVersion: 2,
    });

    // Direct dependent: page_landing (depth 1)
    assert.equal(report.directDependentsCount, 1);
    assert.equal(report.directDependents[0].id, "page_landing");
    assert.equal(report.directDependents[0].depth, 1);

    // Transitive dependents: rel_active_prod, evid_price_display_test (depth 2)
    assert.equal(report.transitiveDependentsCount, 2);
    assert.ok(report.transitiveDependents.some((n) => n.id === "rel_active_prod"));
    assert.ok(report.transitiveDependents.some((n) => n.id === "evid_price_display_test"));

    // Affected releases and stale evidence to rerun
    assert.ok(report.affectedReleases.includes("rel_active_prod"));
    assert.ok(report.staleEvidenceToRerun.includes("evid_price_display_test"));
    assert.equal(report.reapprovalRequired, true, "Price changes require explicit approval renewal");

    // Reverse lookup: Verify page_landing dependencies
    const deps = RelationalChangeImpactGraphService.getDependencies("tenant-acme", "SITESPEC_PAGE", "page_landing");
    assert.equal(deps.length, 1);
    assert.equal(deps[0].sourceId, "fact_price_pro");
  });

  await t.test("3. Cycle Detection: Detects indirect cycles without infinite recursion", () => {
    // Create chain A -> B -> C -> A
    RelationalChangeImpactGraphService.registerRelationship({
      tenantId: "tenant-acme",
      websiteId: "site-101",
      sourceType: "SITESPEC_PAGE",
      sourceId: "page_a",
      relationType: "BINDS_TO",
      targetType: "SITESPEC_PAGE",
      targetId: "page_b",
    });

    RelationalChangeImpactGraphService.registerRelationship({
      tenantId: "tenant-acme",
      websiteId: "site-101",
      sourceType: "SITESPEC_PAGE",
      sourceId: "page_b",
      relationType: "BINDS_TO",
      targetType: "SITESPEC_PAGE",
      targetId: "page_c",
    });

    RelationalChangeImpactGraphService.registerRelationship({
      tenantId: "tenant-acme",
      websiteId: "site-101",
      sourceType: "SITESPEC_PAGE",
      sourceId: "page_c",
      relationType: "BINDS_TO",
      targetType: "SITESPEC_PAGE",
      targetId: "page_a", // Cycle back to A!
    });

    const report = RelationalChangeImpactGraphService.computeChangeImpact({
      tenantId: "tenant-acme",
      websiteId: "site-101",
      originType: "SITESPEC_PAGE",
      originId: "page_a",
    });

    // Must detect cycle cleanly and return report without hanging or exceeding call stack
    assert.ok(report.cyclesDetected.length > 0);
    assert.ok(report.cyclesDetected[0].includes("Cycle detected"));
  });
});
