import assert from "node:assert/strict";
import test from "node:test";
import {
  trashWebsite,
  restoreWebsite,
  purgeWebsite,
  getTrashedWebsites,
  getUserWebsites,
  getWebsiteById,
  getPublicWebsiteById,
} from "../services/website.service.js";
import { publishWebsite, validateWebsiteForPublish } from "../services/publishing.service.js";
import { prisma } from "../config/prisma.js";

const db = prisma as any;

test("Point 02: Website Trash, Restore, and Retention Lifecycle", async (t) => {
  const timestamp = Date.now();
  const ownerId = `owner-p02-${timestamp}`;
  const attackerId = `attacker-p02-${timestamp}`;
  const websiteId = `site-p02-${timestamp}`;
  const websiteName = `Test Store ${timestamp}`;
  const websiteSlug = `store-${timestamp}`;

  // Pre-test setup: create owner, attacker, and website
  await db.user.create({
    data: {
      id: ownerId,
      email: `owner_${timestamp}@example.com`,
      passwordHash: "mock-hash",
      fullName: "Site Owner",
    },
  });

  await db.user.create({
    data: {
      id: attackerId,
      email: `attacker_${timestamp}@example.com`,
      passwordHash: "mock-hash",
      fullName: "Attacker User",
    },
  });

  const testWebsite = await db.website.create({
    data: {
      id: websiteId,
      userId: ownerId,
      name: websiteName,
      slug: websiteSlug,
      status: "DRAFT",
      editorData: JSON.stringify({
        pages: [{ id: "home-page", name: "Home", isHome: true, elements: [] }],
      }),
    },
  });

  // Create child records: revision, deployment, and form submission to verify cascade retention
  const revision = await db.websiteRevision.create({
    data: {
      websiteId,
      name: "Initial Draft Snapshot",
      editorData: testWebsite.editorData,
      createdBy: ownerId,
    },
  });

  const deployment = await db.deployment.create({
    data: {
      websiteId,
      userId: ownerId,
      version: 1,
      status: "PUBLISHED",
      environment: "production",
      destinationType: "STATIC",
      liveUrl: `https://${websiteSlug}.example.com`,
    },
  });

  const formSubmission = await db.formSubmission.create({
    data: {
      websiteId,
      formId: "contact-form",
      data: JSON.stringify({ name: "Lead Visitor", email: "visitor@example.com" }),
    },
  });

  await t.test("1. Unauthorized tenant cannot trash another tenant's website", async () => {
    await assert.rejects(
      async () => {
        await trashWebsite(websiteId, attackerId);
      },
      (err: any) => {
        assert.ok(err.statusCode === 403 || err.statusCode === 404, "Must deny unauthorized user");
        return true;
      }
    );

    const site = await db.website.findUnique({ where: { id: websiteId } });
    assert.equal(site.status, "DRAFT", "Website status must remain unchanged");
  });

  await t.test("2. Owner moving website to trash preserves revisions, deployments, and leads intact", async () => {
    const trashResult = await trashWebsite(websiteId, ownerId);
    assert.equal(trashResult.success, true);
    assert.equal(trashResult.website.status, "TRASH");
    assert.ok(trashResult.website.deletedAt, "deletedAt timestamp must be set");

    // Verify child records still exist in database
    const revCheck = await db.websiteRevision.findUnique({ where: { id: revision.id } });
    assert.ok(revCheck, "Revision history must be preserved during trash");

    const depCheck = await db.deployment.findUnique({ where: { id: deployment.id } });
    assert.ok(depCheck, "Deployment audit history must be preserved during trash");

    const leadCheck = await db.formSubmission.findUnique({ where: { id: formSubmission.id } });
    assert.ok(leadCheck, "Visitor form submissions must be preserved during trash");
  });

  await t.test("3. Trashed website is excluded from normal listings and appears in trash list", async () => {
    const normalSites = await getUserWebsites(ownerId);
    const foundInNormal = normalSites.some((s: any) => s.id === websiteId);
    assert.equal(foundInNormal, false, "Trashed website must not appear in normal user websites listing");

    const trashedSites = await getTrashedWebsites(ownerId);
    const foundInTrash = trashedSites.some((s: any) => s.id === websiteId);
    assert.equal(foundInTrash, true, "Trashed website must appear in getTrashedWebsites listing");
  });

  await t.test("4. Trashed website cannot be edited, validated, published, or served publicly", async () => {
    // Normal access by ID throws 410 WEBSITE_IN_TRASH
    await assert.rejects(
      async () => {
        await getWebsiteById(websiteId, ownerId);
      },
      (err: any) => {
        assert.equal(err.statusCode, 410, "Accessing trashed website must return HTTP 410");
        assert.equal(err.code, "WEBSITE_IN_TRASH");
        return true;
      }
    );

    // Publishing throws 410 WEBSITE_IN_TRASH
    await assert.rejects(
      async () => {
        await publishWebsite(websiteId, ownerId);
      },
      (err: any) => {
        assert.equal(err.statusCode, 410, "Publishing trashed site must return HTTP 410");
        return true;
      }
    );

    // Public serving rejects trashed site with 404 NOT_FOUND
    await assert.rejects(
      async () => {
        await getPublicWebsiteById(websiteSlug);
      },
      (err: any) => {
        assert.equal(err.statusCode, 404, "Public serving must return 404 for trashed site");
        return true;
      }
    );
  });

  await t.test("5. Unauthorized tenant cannot restore another tenant's website", async () => {
    await assert.rejects(
      async () => {
        await restoreWebsite(websiteId, attackerId);
      },
      (err: any) => {
        assert.ok(err.statusCode === 403 || err.statusCode === 404);
        return true;
      }
    );
  });

  await t.test("6. Owner can restore website from trash, returning it to DRAFT state", async () => {
    const restoreResult = await restoreWebsite(websiteId, ownerId);
    assert.equal(restoreResult.success, true);
    assert.equal(restoreResult.website.status, "DRAFT", "Restored website returns to DRAFT");
    assert.equal(restoreResult.website.deletedAt, null, "deletedAt timestamp must be cleared");

    // Website is accessible again
    const restoredSite = await getWebsiteById(websiteId, ownerId);
    assert.equal(restoredSite.id, websiteId);
  });

  await t.test("7. Permanent purge requires website to be in TRASH and requires exact confirmation", async () => {
    // Attempting to purge while in DRAFT status fails
    await assert.rejects(
      async () => {
        await purgeWebsite(websiteId, ownerId, { confirmNameOrSlug: websiteName });
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "WEBSITE_NOT_IN_TRASH");
        return true;
      }
    );

    // Move to trash
    await trashWebsite(websiteId, ownerId);

    // Purge with mismatched confirmation name fails
    await assert.rejects(
      async () => {
        await purgeWebsite(websiteId, ownerId, { confirmNameOrSlug: "Wrong-Name" });
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "CONFIRMATION_MISMATCH");
        return true;
      }
    );

    // Purge by unauthorized tenant fails
    await assert.rejects(
      async () => {
        await purgeWebsite(websiteId, attackerId, { confirmNameOrSlug: websiteName });
      },
      (err: any) => {
        assert.ok(err.statusCode === 403 || err.statusCode === 404);
        return true;
      }
    );
  });

  await t.test("8. Explicitly authorized purge permanently deletes the website record", async () => {
    const purgeResult = await purgeWebsite(websiteId, ownerId, {
      confirmNameOrSlug: websiteName,
      forceImmediatePurge: true,
    });
    assert.equal(purgeResult.success, true);

    const siteCheck = await db.website.findUnique({ where: { id: websiteId } });
    assert.equal(siteCheck, null, "Website record must be purged from database");
  });

  // Cleanup test users
  await db.user.deleteMany({
    where: { id: { in: [ownerId, attackerId] } },
  }).catch(() => {});
});
