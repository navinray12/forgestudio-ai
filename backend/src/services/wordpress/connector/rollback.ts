import { AppError } from "../../../utils/app-error.js";
import { transformPageToWordPress } from "../transformer.service.js";
import type { TransformedWordPressPage } from "../transformer.service.js";
import { canUserAccessResource } from "../../permission.service.js";
import { createRevision } from "../../revision.service.js";
import { db } from "./db.js";
import { getConnectionByWebsiteId } from "./connection.js";
import { getPageMapping, upsertPageMapping } from "./pageMappings.js";
import { getWebsiteById } from "../../website.service.js";
import { prisma } from "../../../config/prisma.js";
import { publishLocks } from "./publishLocks.js";
import { recordAuditLog } from "./auditLog.js";
import { sendSignedWordPressRequest } from "./signedRequest.js";

// Publish rollback: rollback targets and rollback execution.
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

/* ============================================================================
 * F-497 — WORDPRESS PUBLISH ROLLBACK ENGINE
 * ============================================================================ */

export interface WordPressRollbackTargetDTO {
  snapshotId: string;
  publishedAt: string;
  wordpressPageId: number;
  title: string;
  sourceVersion: number;
  status: string;
  slug: string;
  elementCount?: number;
}

export interface WordPressRollbackResultDTO {
  success: boolean;
  operation: "ROLLBACK";
  snapshotId: string;
  websiteId: string;
  forgeStudioPageId: string;
  wordpressPageId: number;
  publishedAt: string;
  status: string;
  url: string;
  contentState: "CURRENT" | "CHANGES_PENDING";
  warnings: Array<{ field?: string; message: string; severity?: string }>;
}

/**
 * Retrieve previous successful publish snapshots for a page.
 */
export async function getWordPressRollbackTargets(
  websiteId: string,
  pageId: string,
  userId: string
): Promise<WordPressRollbackTargetDTO[]> {
  // 1. Authenticate user & website ownership
  const website = await getWebsiteById(websiteId, userId);

  // 2. RBAC check (PUBLISH or VIEW permission)
  const canPublish = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
  const canView = await canUserAccessResource(userId, websiteId, "*", "VIEW");
  if (!canPublish && !canView) {
    throw new AppError("Forbidden: Insufficient permissions to view rollback targets.", 403, "WORDPRESS_ROLLBACK_PERMISSION_DENIED");
  }

  // 3. Resolve pageId
  let editorData = website.editorData;
  if (typeof editorData === "string") {
    try { editorData = JSON.parse(editorData); } catch { editorData = {}; }
  } else if (!editorData || typeof editorData !== "object") {
    editorData = {};
  }
  const pages = Array.isArray(editorData.pages) && editorData.pages.length > 0
    ? editorData.pages
    : [{ id: "home", name: website.name || "Home", slug: "/", elements: Array.isArray(editorData.elements) ? editorData.elements : [] }];

  let targetPage = pages[0];
  if (pageId && pageId !== "default") {
    const found = pages.find((p: any) => p.id === pageId || p.slug === pageId);
    if (found) targetPage = found;
  }
  const forgePageId = targetPage.id || "home";

  // 4. Check WordPressPageMapping
  const mapping = await getPageMapping(websiteId, forgePageId);
  if (!mapping) {
    return [];
  }

  // 5. Query WebsiteRevisions with revisionType IN ["PUBLISH", "RESTORE"]
  let revisions: any[] = [];
  if (db?.websiteRevision?.findMany) {
    revisions = await db.websiteRevision.findMany({
      where: {
        websiteId,
        revisionType: { in: ["PUBLISH", "RESTORE"] },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    revisions = await prisma.$queryRaw`
      SELECT * FROM website_revisions
      WHERE "websiteId" = ${websiteId}::uuid
      AND "revisionType" IN ('PUBLISH', 'RESTORE')
      ORDER BY "createdAt" DESC
    `;
  }

  const targets: WordPressRollbackTargetDTO[] = [];

  for (const rev of revisions) {
    const rawData = typeof rev.data === "string" ? JSON.parse(rev.data) : (rev.data || {});
    const revPages = Array.isArray(rawData.pages) ? rawData.pages : [];
    const pageInRev = revPages.find((p: any) => p.id === forgePageId || p.slug === targetPage.slug) || (forgePageId === "home" ? rawData : null);

    const elementsList = Array.isArray(pageInRev?.elements)
      ? pageInRev.elements
      : (Array.isArray(rawData.elements) ? rawData.elements : []);

    targets.push({
      snapshotId: rev.id,
      publishedAt: new Date(rev.createdAt).toISOString(),
      wordpressPageId: mapping.wpPostId,
      title: pageInRev?.name || pageInRev?.title || targetPage.name || website.name || "Published Page",
      sourceVersion: rev.version,
      status: "publish",
      slug: mapping.wpPostSlug || targetPage.slug || "home",
      elementCount: elementsList.length,
    });
  }

  return targets;
}

/**
 * Execute WordPress publish rollback to a historical publish snapshot.
 */
export async function rollbackWordPressPage(
  websiteId: string,
  pageId: string,
  userId: string,
  options: { snapshotId: string }
): Promise<WordPressRollbackResultDTO> {
  const startTime = Date.now();

  // 1 & 2. Authenticated user & Website ownership
  const website = await getWebsiteById(websiteId, userId);

  // 3. RBAC Check (Requires PUBLISH capability)
  const canPublish = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
  if (!canPublish) {
    throw new AppError("Forbidden: Insufficient permissions to perform WordPress publish rollback.", 403, "WORDPRESS_ROLLBACK_PERMISSION_DENIED");
  }

  if (!options?.snapshotId) {
    throw new AppError("snapshotId is required for rollback.", 400, "WORDPRESS_ROLLBACK_SNAPSHOT_INVALID");
  }

  // 4. Resolve Page ID
  let editorData = website.editorData;
  if (typeof editorData === "string") {
    try { editorData = JSON.parse(editorData); } catch { editorData = {}; }
  } else if (!editorData || typeof editorData !== "object") {
    editorData = {};
  }
  const pages = Array.isArray(editorData.pages) && editorData.pages.length > 0
    ? editorData.pages
    : [{ id: "home", name: website.name || "Home", slug: "/", elements: Array.isArray(editorData.elements) ? editorData.elements : [] }];

  let targetPage = pages[0];
  if (pageId && pageId !== "default") {
    const found = pages.find((p: any) => p.id === pageId || p.slug === pageId);
    if (found) targetPage = found;
  }
  const forgePageId = targetPage.id || "home";

  // 5. Connection Check
  const connection = await getConnectionByWebsiteId(websiteId);
  if (!connection || connection.status !== "CONNECTED") {
    throw new AppError("WordPress site is not connected or active.", 400, "WORDPRESS_ROLLBACK_NOT_CONNECTED");
  }

  // 6. Mapping Check
  const mapping = await getPageMapping(websiteId, forgePageId);
  if (!mapping || !mapping.wpPostId) {
    throw new AppError(`No WordPress page mapping found for page '${forgePageId}'.`, 404, "WORDPRESS_ROLLBACK_SNAPSHOT_NOT_FOUND");
  }

  // 7, 8, 9, 10. Snapshot Ownership & Validity Check
  let revision: any = null;
  if (db?.websiteRevision?.findUnique) {
    revision = await db.websiteRevision.findUnique({
      where: { id: options.snapshotId },
    });
  } else {
    const rows: any[] = await prisma.$queryRaw`
      SELECT * FROM website_revisions WHERE id = ${options.snapshotId}::uuid
    `;
    revision = rows[0];
  }

  if (!revision || revision.websiteId !== websiteId) {
    throw new AppError("Requested publish snapshot not found or does not belong to this website.", 404, "WORDPRESS_ROLLBACK_SNAPSHOT_NOT_FOUND");
  }

  if (revision.revisionType !== "PUBLISH" && revision.revisionType !== "RESTORE") {
    throw new AppError("Selected revision is not a valid successful publish snapshot.", 400, "WORDPRESS_ROLLBACK_SNAPSHOT_INVALID");
  }

  // 11. Lock Mutex & Remote WordPress Page Existence Check
  const lockKey = `${websiteId}:${forgePageId}`;
  if (publishLocks.has(lockKey)) {
    throw new AppError("A publish or rollback operation is currently in progress for this page.", 409, "WORDPRESS_PUBLISH_IN_PROGRESS");
  }
  publishLocks.add(lockKey);

  try {
    // Record Audit Log: WORDPRESS_ROLLBACK_STARTED
    await recordAuditLog(userId, "WORDPRESS_ROLLBACK_STARTED", websiteId, {
      forgePageId,
      wordpressPageId: mapping.wpPostId,
      snapshotId: options.snapshotId,
      sourceVersion: revision.version,
    });

    // Remote Verification GET /pages/:wpPostId
    let remoteCheck: any = null;
    try {
      remoteCheck = await sendSignedWordPressRequest(
        connection.siteUrl,
        `/pages/${mapping.wpPostId}`,
        "GET",
        connection.apiKeyHash
      );
    } catch (getErr: any) {
      if (getErr?.statusCode === 404 || getErr?.message?.includes("404") || getErr?.message?.includes("not found")) {
        throw new AppError(`Target WordPress page (ID ${mapping.wpPostId}) does not exist on remote site. Cannot rollback a deleted remote page.`, 404, "WORDPRESS_ROLLBACK_REMOTE_MISSING");
      }
      throw new AppError(`Remote WordPress site unavailable during pre-rollback verification: ${getErr.message}`, 502, "WORDPRESS_ROLLBACK_REMOTE_UNAVAILABLE");
    }

    if (remoteCheck?.error && (remoteCheck?.error?.code === "NOT_FOUND" || remoteCheck?.error?.code === "WORDPRESS_PAGE_NOT_FOUND")) {
      throw new AppError(`Target WordPress page (ID ${mapping.wpPostId}) does not exist on remote site.`, 404, "WORDPRESS_ROLLBACK_REMOTE_MISSING");
    }

    // Extract historical target page document from snapshot data
    const snapshotData = typeof revision.data === "string" ? JSON.parse(revision.data) : (revision.data || {});
    const snapshotPages = Array.isArray(snapshotData.pages) ? snapshotData.pages : [];
    let historicalPage = snapshotPages.find((p: any) => p.id === forgePageId || p.slug === targetPage.slug);

    if (!historicalPage) {
      historicalPage = {
        id: forgePageId,
        name: targetPage.name || website.name || "Home",
        slug: targetPage.slug || "/",
        elements: Array.isArray(snapshotData.elements) ? snapshotData.elements : [],
      };
    }

    // Transform historical page JSON
    let transformedHistorical: TransformedWordPressPage;
    try {
      transformedHistorical = transformPageToWordPress(
        historicalPage,
        snapshotData.siteSettings || website.siteSettings || {},
        snapshotData.globalStyles || website.globalStyles || {}
      );
    } catch (tErr: any) {
      throw new AppError(`Failed to transform historical snapshot document: ${tErr.message}`, 400, "WORDPRESS_ROLLBACK_TRANSFORM_FAILED");
    }

    const title = historicalPage.name || historicalPage.title || website.name || "Untitled Page";
    const finalSlug = (targetPage.slug || mapping.wpPostSlug || transformedHistorical.slug || "home")
      .toLowerCase()
      .replace(/^\//, "")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-") || "home";

    // Remote REST Update (PUT /pages/:wpPostId)
    let remoteRes: any = null;
    let isTimeoutOrAmbiguous = false;

    try {
      remoteRes = await sendSignedWordPressRequest(
        connection.siteUrl,
        `/pages/${mapping.wpPostId}`,
        "PUT",
        connection.apiKeyHash,
        {
          title,
          slug: finalSlug,
          content: transformedHistorical.content,
          status: "publish",
          operation: "ROLLBACK",
          sourceSnapshotId: options.snapshotId,
        }
      );
    } catch (putErr: any) {
      if (putErr?.code === "ETIMEDOUT" || putErr?.code === "ECONNRESET" || putErr?.message?.includes("timeout")) {
        isTimeoutOrAmbiguous = true;
      } else {
        throw new AppError(`WordPress API rollback request failed: ${putErr.message}`, 502, "WORDPRESS_ROLLBACK_FAILED");
      }
    }

    if (isTimeoutOrAmbiguous) {
      await recordAuditLog(userId, "WORDPRESS_ROLLBACK_RESULT_UNKNOWN", websiteId, {
        forgePageId,
        wordpressPageId: mapping.wpPostId,
        snapshotId: options.snapshotId,
        sourceVersion: revision.version,
        durationMs: Date.now() - startTime,
        errorCode: "WORDPRESS_ROLLBACK_RESULT_UNKNOWN",
      });

      throw new AppError("Rollback request timed out. The remote WordPress page state is unknown. Perform a status check to verify.", 502, "WORDPRESS_ROLLBACK_RESULT_UNKNOWN");
    }

    if (remoteRes?.success === false || remoteRes?.error) {
      const code = remoteRes?.error?.code || "WORDPRESS_ROLLBACK_FAILED";
      const msg = remoteRes?.error?.message || "WordPress rollback operation failed.";
      throw new AppError(msg, 502, code);
    }

    const updatedWpPage = remoteRes.data || remoteRes;
    const canonicalSlug = updatedWpPage.slug || finalSlug;
    const canonicalUrl = updatedWpPage.link || mapping.wpPostUrl || `${connection.siteUrl}/${canonicalSlug === "home" ? "" : canonicalSlug}`;

    // Create a new RESTORE WebsiteRevision documenting the rollback event
    const now = new Date();
    let restoreRevId: string | undefined;
    try {
      const restoreRev = await createRevision(websiteId, userId, {
        revisionType: "RESTORE",
        description: `Rollback to version v${revision.version} (Snapshot: ${options.snapshotId})`,
        elements: historicalPage.elements || [],
        pages: snapshotPages.length > 0 ? snapshotPages : pages,
      });
      restoreRevId = restoreRev.id;
    } catch (rErr) {
      console.warn("Could not create RESTORE revision checkpoint:", rErr);
    }

    // Update Mapping & Connection lastSyncedAt
    await upsertPageMapping(websiteId, forgePageId, mapping.wpPostId, canonicalSlug, canonicalUrl);
    if (db?.wordPressConnection?.update) {
      await db.wordPressConnection.update({
        where: { websiteId },
        data: { lastSyncedAt: now },
      });
    }

    // Determine content state relative to current working editor draft
    const currentElementsStr = JSON.stringify(targetPage.elements || []);
    const historicalElementsStr = JSON.stringify(historicalPage.elements || []);
    const contentState = currentElementsStr === historicalElementsStr ? "CURRENT" : "CHANGES_PENDING";

    // Record Success Audit Log
    const durationMs = Date.now() - startTime;
    await recordAuditLog(userId, "WORDPRESS_ROLLBACK_SUCCEEDED", websiteId, {
      forgePageId,
      wordpressPageId: mapping.wpPostId,
      snapshotId: options.snapshotId,
      sourceVersion: revision.version,
      restoreRevisionId: restoreRevId,
      operation: "ROLLBACK",
      durationMs,
    });

    return {
      success: true,
      operation: "ROLLBACK",
      snapshotId: options.snapshotId,
      websiteId,
      forgeStudioPageId: forgePageId,
      wordpressPageId: mapping.wpPostId,
      publishedAt: now.toISOString(),
      status: "publish",
      url: canonicalUrl,
      contentState,
      warnings: [],
    };
  } catch (err: any) {
    if (err.code !== "WORDPRESS_ROLLBACK_RESULT_UNKNOWN") {
      try {
        await recordAuditLog(userId, "WORDPRESS_ROLLBACK_FAILED", websiteId, {
          forgePageId,
          snapshotId: options?.snapshotId,
          errorCode: err.code || "WORDPRESS_ROLLBACK_FAILED",
          errorMessage: err.message,
        });
      } catch (e) {}
    }
    throw err;
  } finally {
    publishLocks.delete(lockKey);
  }
}
