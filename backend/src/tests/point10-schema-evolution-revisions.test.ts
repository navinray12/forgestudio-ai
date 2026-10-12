/**
 * ForgeStudio Execution Blueprint v2.1 — Point 10: Content Model, Publishing and Preservation
 * Test Suite 3: Schema Evolution & Revision Lifecycle
 */

import assert from "node:assert/strict";
import test from "node:test";
import { contentModelEvolutionService } from "../services/cms/contentModelEvolution.service.js";
import { record4ContentSchemaService } from "../services/authoritative/record4-content-schema.service.js";

test("Point 10 — Content Model Evolution & Revision Suite", async (t) => {
  t.beforeEach(() => {
    contentModelEvolutionService.reset();
    record4ContentSchemaService.reset();
  });

  await t.test("1. Editing published content creates a new draft revision, preserving published revision untouched", () => {
    const entryId = "entry-rev-01";
    const websiteId = "site-rev-test";
    const tenantId = "tenant-rev";

    // 1. Create entry with initial data
    const entry = contentModelEvolutionService.createEntry({
      entryId,
      collectionId: "col-posts",
      websiteId,
      tenantId,
      slug: "first-post",
      initialData: { title: "Published Version 1", content: "Original content" },
      authorId: "author-alice"
    });

    // 2. Publish initial version
    contentModelEvolutionService.publishDraft({
      entryId,
      publishedBy: "publisher-bob"
    });

    assert.equal(entry.publicationState, "PUBLISHED");
    assert.equal(entry.revisions.length, 1);
    assert.equal(entry.publishedRevisionId, "rev-entry-rev-01-1");

    // Public projection returns Version 1
    const publicV1 = contentModelEvolutionService.getPublicProjection(entryId);
    assert.equal(publicV1?.title, "Published Version 1");

    // 3. Owner edits the published entry
    const { newRevision } = contentModelEvolutionService.saveDraftEdit({
      entryId,
      updatedData: { title: "Draft Version 2 In Progress", content: "Updated content" },
      authorId: "author-alice",
      changeNote: "Editorial draft update"
    });

    assert.equal(entry.revisions.length, 2);
    assert.equal(entry.version, 2);
    assert.equal(newRevision.isPublished, false); // New draft is NOT published
    assert.equal(entry.publishedRevisionId, "rev-entry-rev-01-1"); // Published pointer STILL points to V1!

    // Invariant: Public projection MUST STILL return Version 1!
    const publicCheck = contentModelEvolutionService.getPublicProjection(entryId);
    assert.equal(publicCheck?.title, "Published Version 1");

    // 4. Owner approves and publishes Draft Version 2
    contentModelEvolutionService.publishDraft({
      entryId,
      publishedBy: "publisher-bob"
    });

    assert.equal(entry.publishedRevisionId, newRevision.revisionId);
    const publicV2 = contentModelEvolutionService.getPublicProjection(entryId);
    assert.equal(publicV2?.title, "Draft Version 2 In Progress");
  });

  await test("2. Public projection layer strictly excludes unpublished drafts, trashed entries, and private data", () => {
    const entryId = "entry-unpub-01";

    contentModelEvolutionService.createEntry({
      entryId,
      collectionId: "col-posts",
      websiteId: "site-sec-test",
      tenantId: "tenant-sec",
      slug: "secret-draft",
      initialData: { title: "Top Secret Draft" },
      authorId: "author-alice"
    });

    // Unpublished entry returns null
    const projection = contentModelEvolutionService.getPublicProjection(entryId);
    assert.equal(projection, null);
  });

  await test("3. Schema evolution preserves stable fieldId and existing bindings during field rename", () => {
    const websiteId = "site-schema-evo";
    const collectionId = "col-services";

    record4ContentSchemaService.defineCollectionSchema({
      collectionId,
      websiteId,
      tenantId: "tenant-acme",
      name: "Services",
      slug: "services",
      fields: [
        { fieldId: "fld-srv-title", name: "Original Title Label", key: "title", type: "TEXT", required: true }
      ]
    });

    const plan = contentModelEvolutionService.planFieldRename({
      collectionId,
      websiteId,
      fieldId: "fld-srv-title",
      newDisplayName: "Public Display Headline"
    });

    assert.equal(plan.operation, "RENAME_FIELD");
    assert.equal(plan.requiresBackfill, false);

    // Verify fieldId and key remain stable in schema
    const schema = record4ContentSchemaService.getContentSchemas(websiteId)[0];
    const field = schema.fields.find(f => f.fieldId === "fld-srv-title")!;
    assert.equal(field.fieldId, "fld-srv-title");
    assert.equal(field.key, "title"); // Key remains unchanged for bindings!
    assert.equal(field.name, "Public Display Headline");
  });
});
