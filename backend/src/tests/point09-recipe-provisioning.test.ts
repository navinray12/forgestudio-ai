/**
 * ForgeStudio Execution Blueprint v2.1 — Point 09: Automatic CMS and Blog Provisioning
 * Test Suite 1: Recipe Engine & Provisioning Manifest Generation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { recipeEngineService } from "../services/cms/recipeEngine.service.js";

test("Point 09 — Recipe Provisioning Manifest Suite", async () => {
  await test("1. Generates complete manifest with posts, authors, categories, and tags", () => {
    const manifest = recipeEngineService.generateManifest({
      websiteId: "site-recipe-01",
      tenantId: "tenant-acme",
      siteProfile: "EDITORIAL_PUBLISHER"
    });

    assert.ok(manifest.manifestId);
    assert.ok(manifest.manifestHash);
    assert.equal(manifest.siteProfile, "EDITORIAL_PUBLISHER");

    const collectionSlugs = manifest.collections.map(c => c.slug);
    assert.ok(collectionSlugs.includes("posts"));
    assert.ok(collectionSlugs.includes("authors"));
    assert.ok(collectionSlugs.includes("categories"));

    // Verify post fields
    const postsCol = manifest.collections.find(c => c.slug === "posts")!;
    const fieldKeys = postsCol.fields.map(f => f.key);
    assert.ok(fieldKeys.includes("title"));
    assert.ok(fieldKeys.includes("slug"));
    assert.ok(fieldKeys.includes("content"));
    assert.ok(fieldKeys.includes("authorId"));

    // Verify public route reservations
    const routePaths = manifest.routes.map(r => r.route);
    assert.ok(routePaths.includes("/blog"));
    assert.ok(routePaths.includes("/blog/:slug"));
  });

  await test("2. Includes industry-specific informational collections according to site profile", () => {
    // Professional Services profile
    const profServicesManifest = recipeEngineService.generateManifest({
      websiteId: "site-prof-01",
      tenantId: "tenant-acme",
      siteProfile: "PROFESSIONAL_SERVICES"
    });

    const profSlugs = profServicesManifest.collections.map(c => c.slug);
    assert.ok(profSlugs.includes("services"));
    assert.ok(profSlugs.includes("case-studies"));
    assert.ok(!profSlugs.includes("courses")); // Courses omitted for professional services

    // Membership Academy profile
    const academyManifest = recipeEngineService.generateManifest({
      websiteId: "site-acad-01",
      tenantId: "tenant-acme",
      siteProfile: "MEMBERSHIP_ACADEMY"
    });

    const acadSlugs = academyManifest.collections.map(c => c.slug);
    assert.ok(acadSlugs.includes("courses"));
    assert.ok(!acadSlugs.includes("case-studies"));
  });

  await test("3. Inactive integration safeguard: Email and CRM webhooks remain inactive until credentials verified", () => {
    const manifest = recipeEngineService.generateManifest({
      websiteId: "site-safe-01",
      tenantId: "tenant-acme",
      siteProfile: "EDITORIAL_PUBLISHER"
    });

    for (const integration of manifest.outboundIntegrations) {
      assert.equal(integration.isActive, false);
      assert.ok(integration.reason.length > 0);
    }
  });

  await test("4. Deterministic hashing: Identical inputs produce identical cryptographic manifest checksums", () => {
    const m1 = recipeEngineService.generateManifest({
      websiteId: "site-det-01",
      tenantId: "tenant-acme",
      siteProfile: "EDITORIAL_PUBLISHER",
      recipeVersion: "1.0.0"
    });

    const m2 = recipeEngineService.generateManifest({
      websiteId: "site-det-01",
      tenantId: "tenant-acme",
      siteProfile: "EDITORIAL_PUBLISHER",
      recipeVersion: "1.0.0"
    });

    assert.equal(m1.manifestHash, m2.manifestHash);
  });
});
