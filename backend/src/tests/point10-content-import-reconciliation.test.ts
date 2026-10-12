/**
 * ForgeStudio Execution Blueprint v2.1 — Point 10: Content Model, Publishing and Preservation
 * Test Suite 5: Content Import Reconciliation & Coordinated Publication Manifests
 */

import assert from "node:assert/strict";
import test from "node:test";
import { contentImportReconciliationService } from "../services/cms/contentImportReconciliation.service.js";
import { coordinatedPublicationManifestService } from "../services/cms/coordinatedPublicationManifest.service.js";

test("Point 10 — Content Import Reconciliation & Release Manifest Suite", async () => {
  await test("1. Import dry-run preview verifies omitted rows are strictly NEVER deleted", () => {
    const existingSlugs = ["post-alpha", "post-beta", "post-gamma"];

    // Import payload only contains post-alpha and a new post-delta. post-beta and post-gamma are omitted!
    const rows = [
      { rowNumber: 1, sourceKey: "crm-101", slug: "post-alpha", fields: { title: "Alpha Updated" } },
      { rowNumber: 2, sourceKey: "crm-102", slug: "post-delta", fields: { title: "Delta New" } }
    ];

    const preview = contentImportReconciliationService.previewImport({
      importBatchId: "batch-dry-run-01",
      websiteId: "site-imp-01",
      collectionId: "col-posts",
      rows,
      existingSlugs
    });

    assert.equal(preview.canProceed, true);
    assert.equal(preview.newEntriesCount, 1);
    assert.equal(preview.updatedEntriesCount, 1);
    // Invariant: Omitted rows deleted count MUST be exactly 0!
    assert.equal(preview.omittedRowsDeletedCount, 0);
    assert.equal(preview.existingEntriesPreservedCount, 3);
  });

  await test("2. Import dry-run detects duplicate source keys and blocks execution", () => {
    const rows = [
      { rowNumber: 1, sourceKey: "crm-dup", slug: "slug-one", fields: { title: "One" } },
      { rowNumber: 2, sourceKey: "crm-dup", slug: "slug-two", fields: { title: "Two" } } // Duplicate key!
    ];

    const preview = contentImportReconciliationService.previewImport({
      importBatchId: "batch-dup-01",
      websiteId: "site-dup-01",
      collectionId: "col-posts",
      rows,
      existingSlugs: []
    });

    assert.equal(preview.canProceed, false);
    assert.ok(preview.rowResults.some(r => r.status === "DUPLICATE_KEY"));
  });

  await test("3. Coordinated publication manifest pins exact content, schema, layout, and component contracts", () => {
    const manifest = coordinatedPublicationManifestService.assembleManifest({
      websiteId: "site-coord-01",
      tenantId: "tenant-coord",
      targetReleaseId: "rel-prod-v1",
      contentRevisionIds: {
        "entry-post-01": "rev-entry-post-01-2",
        "entry-post-02": "rev-entry-post-02-1"
      },
      componentContractHashes: {
        Button: "hash-btn-v1",
        HeroSection: "hash-hero-v1"
      }
    });

    assert.ok(manifest.manifestId);
    assert.ok(manifest.manifestChecksum);
    assert.equal(manifest.targetReleaseId, "rel-prod-v1");
    assert.equal(manifest.contentRevisionIds["entry-post-01"], "rev-entry-post-01-2");
    assert.equal(manifest.componentContractHashes["Button"], "hash-btn-v1");
  });
});
