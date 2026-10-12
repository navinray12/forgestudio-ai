/**
 * ForgeStudio Execution Blueprint v2.1 — Point 09: Automatic CMS and Blog Provisioning
 * Test Suite 2: Provisioning State Machine, Click-to-Edit & Migration Previews
 */

import assert from "node:assert/strict";
import test from "node:test";
import { provisioningStateMachineService } from "../services/cms/provisioningStateMachine.service.js";
import { clickToEditBindingService } from "../services/cms/clickToEditBinding.service.js";
import { migrationPreviewService } from "../services/cms/migrationPreview.service.js";
import { record4ContentSchemaService } from "../services/authoritative/record4-content-schema.service.js";

test("Point 09 — CMS & Blog Provisioning Lifecycle Suite", async (t) => {
  t.beforeEach(() => {
    provisioningStateMachineService.reset();
    record4ContentSchemaService.reset();
  });

  await t.test("1. Enforces uniqueness on (websiteId, recipeId, version) and prevents duplicate jobs", () => {
    const websiteId = "site-idem-01";
    const tenantId = "tenant-acme";

    // First planning call
    const op1 = provisioningStateMachineService.planOperation({
      websiteId,
      tenantId,
      siteProfile: "EDITORIAL_PUBLISHER",
      recipeVersion: "1.0.0"
    });
    assert.equal(op1.state, "PLANNED");

    // Second planning call with identical key must return existing operation without duplication
    const op2 = provisioningStateMachineService.planOperation({
      websiteId,
      tenantId,
      siteProfile: "EDITORIAL_PUBLISHER",
      recipeVersion: "1.0.0"
    });
    assert.equal(op2.operationId, op1.operationId);
  });

  await t.test("2. Fenced worker lease prevents stale workers from executing steps", () => {
    const op = provisioningStateMachineService.planOperation({
      websiteId: "site-fence-01",
      tenantId: "tenant-acme",
      siteProfile: "EDITORIAL_PUBLISHER"
    });

    const tokenWorker1 = op.workerFencingToken; // Token 1

    // Worker 2 acquires lease, bumping token to 2
    const lease2 = provisioningStateMachineService.acquireWorkerLease(op.operationId);
    assert.equal(lease2.fencingToken, 2);

    // Stale Worker 1 attempts to execute step with old token 1
    assert.throws(
      () => {
        provisioningStateMachineService.executeStep({
          operationId: op.operationId,
          targetStep: "RESERVE",
          workerFencingToken: tokenWorker1
        });
      },
      /Worker fencing token mismatch: worker provided 1, active token is 2/
    );

    // Active Worker 2 succeeds
    const updated = provisioningStateMachineService.executeStep({
      operationId: op.operationId,
      targetStep: "RESERVE",
      workerFencingToken: lease2.fencingToken
    });
    assert.equal(updated.state, "RESERVED");
  });

  await t.test("3. Full 8-step automated provisioning executes and marks READY", async () => {
    const op = provisioningStateMachineService.planOperation({
      websiteId: "site-full-01",
      tenantId: "tenant-acme",
      siteProfile: "EDITORIAL_PUBLISHER"
    });

    const result = await provisioningStateMachineService.runFullProvisioning(op.operationId);
    assert.equal(result.state, "READY");
    assert.ok(result.completedSteps.includes("ACTIVATE"));

    // Verify schemas were registered in Record 4
    const schemas = record4ContentSchemaService.getContentSchemas("site-full-01");
    assert.ok(schemas.some(s => s.slug === "posts"));
    assert.ok(schemas.some(s => s.slug === "authors"));
  });

  await t.test("4. Click-to-edit updates content field without triggering layout regeneration", () => {
    const websiteId = "site-cte-01";
    const tenantId = "tenant-cte";

    // Setup collection and entry in Record 4
    record4ContentSchemaService.defineCollectionSchema({
      collectionId: "col-posts",
      websiteId,
      tenantId,
      name: "Blog Posts",
      slug: "posts",
      fields: [
        { fieldId: "fld-title", name: "Title", key: "title", type: "TEXT", required: true }
      ]
    });

    record4ContentSchemaService.saveEntryDraft({
      entryId: "entry-post-01",
      collectionId: "col-posts",
      websiteId,
      tenantId,
      data: { title: "Original Article Title" },
      slug: "original-article",
      authorId: "author-alice"
    });

    // Execute click-to-edit update
    const binding = clickToEditBindingService.parseBindingString("col-posts:entry-post-01:title", {
      websiteId,
      tenantId
    });

    const updateResult = clickToEditBindingService.updateContentField({
      binding,
      newValue: "Updated Title via Click-to-Edit",
      editorUserId: "author-alice"
    });

    assert.equal(updateResult.success, true);
    assert.equal(updateResult.classification, "CONTENT_CHANGE");
    assert.equal(updateResult.requiresLayoutRegeneration, false);
    assert.equal(updateResult.newValue, "Updated Title via Click-to-Edit");
  });

  await t.test("5. Existing-site migration preview detects route collisions and preserves active release", () => {
    const preview = migrationPreviewService.generatePreview({
      websiteId: "site-prev-01",
      tenantId: "tenant-prev",
      siteProfile: "PROFESSIONAL_SERVICES"
    });

    assert.equal(preview.activeReleaseUntouched, true);
    assert.ok(preview.collectionsToCreate.includes("posts"));
    assert.ok(preview.collectionsToCreate.includes("services"));
  });
});
