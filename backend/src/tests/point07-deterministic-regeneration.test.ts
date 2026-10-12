/**
 * ForgeStudio Execution Blueprint v2.1 — Point 07: Reliable Generation & Controlled AI Assistance
 * Test Suite 5: AI-Independent Deterministic Regeneration
 */

import assert from "node:assert/strict";
import test from "node:test";
import { deterministicRegenerationService } from "../services/generation/deterministicRegeneration.service.js";
import { record2SiteSpecService } from "../services/authoritative/record2-sitespec.service.js";
import { record1BusinessFactsService } from "../services/authoritative/record1-business-facts.service.js";

test("Point 07 — Deterministic Regeneration Suite", async () => {
  await test("1. Saved site regenerates completely with zero AI provider calls", async () => {
    const websiteId = "site-offline-regen";
    const tenantId = "tenant-offline";

    // Setup saved SiteSpec in Record 2
    record2SiteSpecService.saveSiteSpec({
      websiteId,
      revision: 1,
      pages: [
        { route: "/", title: "Home", components: [{ type: "Hero", props: { title: "Offline Site" } }] }
      ],
      designTokens: { primaryColor: "#10b981" },
      updatedAt: new Date().toISOString()
    });

    // Execute deterministic regeneration with AI disabled
    const result = await deterministicRegenerationService.regenerateOffline({
      websiteId,
      tenantId,
      targetEnvironment: "production"
    });

    assert.equal(result.success, true);
    assert.equal(result.aiCallsAttempted, 0);
    assert.equal(result.offlineVerified, true);
    assert.ok(result.artifactHash);
  });

  await test("2. Fails cleanly with actionable diagnostic if saved SiteSpec is missing", async () => {
    const result = await deterministicRegenerationService.regenerateOffline({
      websiteId: "site-nonexistent",
      tenantId: "tenant-offline"
    });

    assert.equal(result.success, false);
    assert.equal(result.aiCallsAttempted, 0);
    assert.ok(result.diagnostics.some(d => d.includes("SiteSpec record missing")));
  });
});
