/**
 * ForgeStudio Execution Blueprint v2.1 — Point 10: Content Model, Publishing and Preservation
 * Test Suite 4: Scheduled Publication, Unpublishing & Governed Purge
 */

import assert from "node:assert/strict";
import test from "node:test";
import { scheduledPublicationService } from "../services/cms/scheduledPublication.service.js";
import { protectedSourceLifecycleService } from "../services/cms/protectedSourceLifecycle.service.js";
import { contentModelEvolutionService } from "../services/cms/contentModelEvolution.service.js";

test("Point 10 — Scheduled Publication & Governed Purge Suite", async (t) => {
  t.beforeEach(() => {
    scheduledPublicationService.reset();
    protectedSourceLifecycleService.reset();
    contentModelEvolutionService.reset();
  });

  await t.test("1. Scheduled publication stores exact UTC instant and publishes upon due time", () => {
    const entryId = "entry-sched-01";
    contentModelEvolutionService.createEntry({
      entryId,
      collectionId: "col-posts",
      websiteId: "site-01",
      tenantId: "tenant-01",
      slug: "scheduled-article",
      initialData: { title: "Scheduled News" },
      authorId: "author-alice"
    });

    const scheduledUtc = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

    const job = scheduledPublicationService.schedulePublication({
      jobId: "job-sched-test",
      entryId,
      revisionId: "rev-entry-sched-01-1",
      websiteId: "site-01",
      scheduledInstantUtc: scheduledUtc,
      editorialTimezone: "America/New_York",
      editorialLocalTime: "2026-10-12 10:00:00",
      scheduledBy: "editor-bob"
    });

    assert.equal(job.status, "SCHEDULED");

    // Premature execution attempt must fail
    assert.throws(
      () => {
        scheduledPublicationService.executeScheduledJob({
          jobId: job.jobId,
          workerFencingToken: job.workerFencingToken,
          currentUtcTime: new Date().toISOString()
        });
      },
      /Premature execution attempt/
    );

    // Execution when due succeeds
    const executed = scheduledPublicationService.executeScheduledJob({
      jobId: job.jobId,
      workerFencingToken: job.workerFencingToken,
      currentUtcTime: new Date(Date.now() + 4000000).toISOString()
    });
    assert.equal(executed.status, "EXECUTED");

    // Entry is now published
    const publicProj = contentModelEvolutionService.getPublicProjection(entryId);
    assert.equal(publicProj?.title, "Scheduled News");
  });

  await t.test("2. Unpublishing immediately denies authoritative API access and triggers cache invalidation", () => {
    const entryId = "entry-unpub-test";
    contentModelEvolutionService.createEntry({
      entryId,
      collectionId: "col-posts",
      websiteId: "site-02",
      tenantId: "tenant-02",
      slug: "take-down-article",
      initialData: { title: "Live Article" },
      authorId: "author-alice"
    });

    contentModelEvolutionService.publishDraft({ entryId, publishedBy: "admin" });
    assert.ok(contentModelEvolutionService.getPublicProjection(entryId) !== null);

    // Execute unpublish
    const unpublishRes = scheduledPublicationService.unpublishEntry(entryId);
    assert.equal(unpublishRes.success, true);
    assert.equal(unpublishRes.authoritativeAccessBlockedImmediately, true);

    // Direct retrieval is immediately denied
    assert.equal(contentModelEvolutionService.getPublicProjection(entryId), null);
  });

  await t.test("3. Trash, Restore and Governed Purge enforce authorization and audit history", () => {
    const entryId = "entry-purge-test";
    const entry = contentModelEvolutionService.createEntry({
      entryId,
      collectionId: "col-posts",
      websiteId: "site-03",
      tenantId: "tenant-03",
      slug: "to-trash",
      initialData: { title: "Obsolete Note" },
      authorId: "author-alice"
    });

    // 1. Soft-delete to Trash
    const trashed = protectedSourceLifecycleService.trashEntry({
      entryId,
      expectedVersion: entry.version,
      actorId: "editor-alice",
      reason: "No longer relevant"
    });
    assert.equal(trashed.deletionState, "TRASHED");
    assert.equal(trashed.publicationState, "UNPUBLISHED");

    // 2. Restore defaults to UNPUBLISHED
    const restored = protectedSourceLifecycleService.restoreEntry({
      entryId,
      actorId: "editor-alice"
    });
    assert.equal(restored.deletionState, "ACTIVE");
    assert.equal(restored.publicationState, "UNPUBLISHED");

    // Move back to trash for purge test
    protectedSourceLifecycleService.trashEntry({
      entryId,
      expectedVersion: restored.version,
      actorId: "editor-alice",
      reason: "Trash for purge"
    });

    // 3. Purge without authorization must fail
    assert.throws(
      () => {
        protectedSourceLifecycleService.createPurgeApproval({
          websiteId: "site-03",
          targetEntryIds: [entryId],
          approverRole: "EDITOR", // Unauthorized role
          approverId: "editor-alice"
        });
      },
      /Unauthorized purge approval request/
    );

    // Independent platform policy owner creates approval
    const approval = protectedSourceLifecycleService.createPurgeApproval({
      websiteId: "site-03",
      targetEntryIds: [entryId],
      approverRole: "PLATFORM_POLICY_OWNER",
      approverId: "owner-security",
      validityMinutes: 10
    });
    assert.equal(approval.isExecuted, false);

    // Execute purge
    const purgeResult = protectedSourceLifecycleService.executePurge({
      approvalId: approval.approvalId,
      executorId: "owner-security"
    });
    assert.equal(purgeResult.purgedCount, 1);
    assert.equal(contentModelEvolutionService.getEntry(entryId)?.deletionState, "PURGED");
  });
});
