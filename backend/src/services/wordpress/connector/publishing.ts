import { AppError } from "../../../utils/app-error.js";
import { transformPageToHTML, transformPageToWordPress } from "../transformer.service.js";
import type { TransformedHtmlPage, TransformedWordPressPage } from "../transformer.service.js";
import { assertSafeUrl } from "../../../utils/ssrf.guard.js";
import { canUserAccessResource } from "../../permission.service.js";
import { createRevision } from "../../revision.service.js";
import { db } from "./db.js";
import { getConnectionByWebsiteId, getWordPressStatus } from "./connection.js";
import { getPageMapping, getWebsitePageMappings, upsertPageMapping } from "./pageMappings.js";
import { getWebsiteById } from "../../website.service.js";
import { getWordPressSiteHealth } from "./siteDiagnostics.js";
import { prisma } from "../../../config/prisma.js";
import { publishLocks } from "./publishLocks.js";
import { recordAuditLog } from "./auditLog.js";
import { sendSignedWordPressRequest } from "./signedRequest.js";

// Publishing: site publish / sync, page publish (HTML / Gutenberg) with reconciliation, publish status and
// previews.
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

export interface WordPressSyncResult {
  success: boolean;
  siteUrl: string;
  primaryPageUrl: string;
  syncedPagesCount: number;
  syncedMediaCount: number;
  pageMappings: Array<{ forgePageId: string; wpPostId: number; wpPostSlug: string; wpPostUrl: string }>;
}

/**
 * Publish candidate website pages to WordPress destination.
 *
 * Invariant: Uses durable ForgeStudio Page ID <-> WordPress Post ID mapping.
 * Updates existing remote posts when mapping exists; creates new remote posts when mapping is absent.
 */
export async function publishToWordPress(
  websiteId: string,
  userId: string,
  _deploymentId: string,
  candidateSnapshot?: any
): Promise<WordPressSyncResult> {
  // 1. Verify active connection
  const statusRes = await getWordPressStatus(websiteId, userId);
  if (!statusRes.isConnected || !statusRes.connection) {
    throw new AppError("WordPress connection is not active or verified.", 400, "WORDPRESS_NOT_CONNECTED");
  }

  const connection = statusRes.connection;
  let connectionFull: any = null;
  if (db?.wordPressConnection?.findUnique) {
    connectionFull = await db.wordPressConnection.findUnique({ where: { websiteId } });
  } else {
    const rows: any[] = await prisma.$queryRaw`
      SELECT * FROM wordpress_connections WHERE "websiteId" = ${websiteId}::uuid
    `;
    connectionFull = rows[0];
  }

  const apiKeyHash = connectionFull?.apiKeyHash || "";
  let snapshot = candidateSnapshot;
  if (!snapshot) {
    const ws = await getWebsiteById(websiteId, userId);
    snapshot = typeof ws.editorData === "string" ? JSON.parse(ws.editorData) : (ws.editorData || {});
  }

  const siteSettings = snapshot.siteSettings || {};
  const globalStyles = snapshot.globalStyles || {};

  const pages = Array.isArray(snapshot.pages) ? [...snapshot.pages] : [];
  if (pages.length === 0) {
    // Single page fallback
    pages.push({
      id: "page-home",
      name: "Home",
      slug: "/",
      isHome: true,
      elements: snapshot.elements || [],
    });
  }

  const existingMappings = await getWebsitePageMappings(websiteId);
  const mappingMap = new Map<string, any>();
  for (const m of existingMappings) {
    mappingMap.set(m.forgePageId, m);
  }

  const syncedMappings: Array<{ forgePageId: string; wpPostId: number; wpPostSlug: string; wpPostUrl: string }> = [];
  let mediaCount = 0;

  const payloadPagesToSync: any[] = [];

  // 2. Process each page through transformer & destination adapter
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const transformed: TransformedWordPressPage = transformPageToWordPress(page, siteSettings, globalStyles);

    mediaCount += transformed.mediaReferences.length;

    const existingMapping = mappingMap.get(page.id);
    let wpPostId: number = existingMapping ? existingMapping.wpPostId : 1000 + existingMappings.length + i + 1;
    let wpPostSlug = transformed.slug;

    if (existingMapping) {
      wpPostId = existingMapping.wpPostId;
    } else {
      wpPostId = 1000 + existingMappings.length + i + 1;
    }

    // Live HTTPS REST dispatch to WordPress connector plugin if reachable
    try {
      const restEndpoint = `${connection.siteUrl}/wp-json/forgestudio/v1/pages`;
      assertSafeUrl(restEndpoint, "WordPress REST Endpoint");
      const res = await fetch(restEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forge-Api-Key": (connection as any).apiKeyHash || "fs_test_token",
          "User-Agent": "ForgeStudio-Connector/1.0",
        },
        body: JSON.stringify({
          pageId: page.id,
          title: transformed.title,
          slug: transformed.slug,
          contentHtml: transformed.contentHtml,
          customCss: transformed.customCss,
          gutenbergBlocks: transformed.gutenbergBlocks,
          yoastMeta: transformed.yoastMeta,
          rankMathMeta: transformed.rankMathMeta,
          elementorData: transformed.elementorData,
          updatePostId: existingMapping ? existingMapping.wpPostId : undefined,
        }),
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const remoteRes: any = await res.json();
        if (remoteRes?.postId) {
          wpPostId = remoteRes.postId;
        }
      }
    } catch (fetchErr: any) {
      if (process.env.FORGESTUDIO_WP_STRICT_SYNC === "true") {
        throw new AppError("WordPress host unreachable during strict sync", 502, "WP_HOST_UNREACHABLE");
      }
      // Remote host offline or mock environment: fallback to deterministic ID
    }

    payloadPagesToSync.push({
      forgePageId: page.id,
      wpPostId: existingMapping ? wpPostId : undefined,
      title: transformed.title,
      slug: wpPostSlug,
      content: transformed.content,
      status: transformed.status,
    });

    const wpPostUrl = `${connection.siteUrl}/${wpPostSlug === "home" ? "" : wpPostSlug}`;

    // Persist durable mapping
    await upsertPageMapping(websiteId, page.id, wpPostId, wpPostSlug, wpPostUrl);

    syncedMappings.push({
      forgePageId: page.id,
      wpPostId,
      wpPostSlug,
      wpPostUrl,
    });
  }

  // Remote REST Sync
  await sendSignedWordPressRequest(
    connection.siteUrl,
    "/publish",
    "POST",
    apiKeyHash,
    { pages: payloadPagesToSync }
  );

  // Update lastSyncedAt on connection
  const now = new Date();
  if (db?.wordPressConnection?.update) {
    await db.wordPressConnection.update({
      where: { websiteId },
      data: { lastSyncedAt: now },
    });
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE wordpress_connections SET "lastSyncedAt" = $1, "updatedAt" = NOW() WHERE "websiteId" = $2::uuid`,
      now,
      websiteId
    );
  }

  const primaryPageUrl = syncedMappings[0]?.wpPostUrl || connection.siteUrl;

  return {
    success: true,
    siteUrl: connection.siteUrl,
    primaryPageUrl,
    syncedPagesCount: syncedMappings.length,
    syncedMediaCount: mediaCount,
    pageMappings: syncedMappings,
  };
}

export type WordPressPublishState =
  | "NEVER_PUBLISHED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "DRAFT"
  | "FAILED"
  | "STALE"
  | "REMOTE_MISSING"
  | "DISCONNECTED"
  | "UNKNOWN";

export interface WordPressPublishStatusDTO {
  forgeStudioPageId: string;
  websiteId: string;
  state: WordPressPublishState;
  wordpressPageId?: number;
  wordpressUrl?: string;
  lastPublishAttemptAt?: string;
  lastPublishedAt?: string;
  lastPublishStatus?: "SUCCESS" | "FAILED" | "IN_PROGRESS" | string;
  sourceUpdatedAt?: string;
  publishedSourceUpdatedAt?: string;
  contentState: "CURRENT" | "CHANGES_PENDING" | "UNKNOWN";
  remoteState: "EXISTS" | "MISSING" | "UNKNOWN";
  errorCode?: string;
  errorMessage?: string;
  warnings?: Array<{ field?: string; message: string; severity?: string }>;
}

export interface PublishWordPressOptions {
  pageId?: string;
  wordpressPageId?: number;
  title?: string;
  slug?: string;
  status?: "draft" | "publish" | "private" | string;
  content?: string;
  excerpt?: string;
  template?: string;
  format?: "html" | "gutenberg" | string;
  mode?: "html" | "gutenberg" | string;
  includeStyles?: boolean;
  includeResponsiveStyles?: boolean;
  assetStrategy?: string;
  metadata?: any;
  publishId?: string;
  sourceVersion?: string;
}

export interface PublishWordPressResult {
  success: boolean;
  websiteId: string;
  forgeStudioPageId: string;
  wordpressPageId: number;
  action: "CREATED" | "UPDATED";
  status: string;
  title: string;
  slug: string;
  url: string;
  publishedAt: string;
  snapshotId?: string;
  sourceVersion?: number;
  publishingFormat?: string;
  htmlHash?: string;
  gutenbergHash?: string;
  stats?: {
    htmlSizeBytes: number;
    cssSizeBytes: number;
    assetCount: number;
    sanitizationWarnings: string[];
  };
  blockStats?: any;
  warnings: Array<{ field?: string; message: string; severity?: string }>;
}

/**
 * Helper to query last publish audit information for a page
 */
export async function getLastPublishAuditInfo(websiteId: string, forgePageId: string) {
  try {
    if (db?.auditLog?.findMany) {
      const logs = await db.auditLog.findMany({
        where: {
          targetResource: `website:${websiteId}`,
          action: { in: ["WORDPRESS_PUBLISH_STARTED", "WORDPRESS_PUBLISH_SUCCEEDED", "WORDPRESS_PUBLISH_FAILED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      const pageLogs = logs.filter((l: any) => l.details?.pageId === forgePageId || !l.details?.pageId);
      const lastAttempt = pageLogs[0];
      const lastSuccess = pageLogs.find((l: any) => l.action === "WORDPRESS_PUBLISH_SUCCEEDED");
      const lastFailure = pageLogs.find((l: any) => l.action === "WORDPRESS_PUBLISH_FAILED");

      return {
        lastAttemptAt: lastAttempt?.createdAt ? new Date(lastAttempt.createdAt).toISOString() : undefined,
        lastSuccessAt: lastSuccess?.createdAt ? new Date(lastSuccess.createdAt).toISOString() : undefined,
        lastFailureAt: lastFailure?.createdAt ? new Date(lastFailure.createdAt).toISOString() : undefined,
        lastFailureCode: lastFailure?.details?.errorCode,
        lastFailureMessage: lastFailure?.details?.errorMessage,
        isLastFailed: lastAttempt?.action === "WORDPRESS_PUBLISH_FAILED",
      };
    }
  } catch (e) {}
  return {};
}

/**
 * F-496: Production-grade WordPress Publish Status Determination Engine
 */
export async function getWordPressPublishStatus(
  websiteId: string,
  pageId: string,
  userId: string
): Promise<WordPressPublishStatusDTO> {
  const startTime = Date.now();

  // 1. Authenticated User & Website Ownership
  const website = await getWebsiteById(websiteId, userId);

  // 2. RBAC Permission Check (Requires VIEW capability)
  const canView = await canUserAccessResource(userId, websiteId, "*", "VIEW");
  if (!canView) {
    throw new AppError("Forbidden: Insufficient permissions to view publish status.", 403, "WORDPRESS_PUBLISH_STATUS_PERMISSION_DENIED");
  }

  // 3. Document Retrieval & Page Verification
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
    if (found) {
      targetPage = found;
    } else {
      throw new AppError(`Page '${pageId}' not found in website document.`, 404, "WORDPRESS_PUBLISH_STATUS_PAGE_NOT_FOUND");
    }
  }

  const forgeStudioPageId = targetPage.id || "home";

  // 4. Check Page Mapping (Step 5)
  const mapping = await getPageMapping(websiteId, forgeStudioPageId);
  const lockKey = `${websiteId}:${forgeStudioPageId}`;
  const isPublishing = publishLocks.has(lockKey);

  // If no mapping exists:
  if (!mapping) {
    if (isPublishing) {
      return {
        forgeStudioPageId,
        websiteId,
        state: "PUBLISHING",
        contentState: "UNKNOWN",
        remoteState: "UNKNOWN",
      };
    }
    await recordAuditLog(userId, "WORDPRESS_PUBLISH_STATUS_CHECKED", websiteId, {
      forgePageId: forgeStudioPageId,
      state: "NEVER_PUBLISHED",
      remoteState: "UNKNOWN",
      contentState: "CURRENT",
      durationMs: Date.now() - startTime,
    });
    return {
      forgeStudioPageId,
      websiteId,
      state: "NEVER_PUBLISHED",
      contentState: "CURRENT",
      remoteState: "UNKNOWN",
    };
  }

  // If active publish operation in progress:
  if (isPublishing) {
    return {
      forgeStudioPageId,
      websiteId,
      state: "PUBLISHING",
      wordpressPageId: mapping.wpPostId,
      wordpressUrl: mapping.wpPostUrl,
      lastPublishedAt: mapping.lastSyncedAt ? new Date(mapping.lastSyncedAt).toISOString() : undefined,
      contentState: "CHANGES_PENDING",
      remoteState: "UNKNOWN",
    };
  }

  // 5. Connection Check (Step 7)
  const connection = await getConnectionByWebsiteId(websiteId);
  if (!connection || connection.status !== "CONNECTED") {
    const errorCode = "WORDPRESS_PUBLISH_STATUS_NOT_CONNECTED";
    const errorMessage = connection?.status === "REVOKED"
      ? "WordPress connection has been revoked."
      : "WordPress site is disconnected.";

    await recordAuditLog(userId, "WORDPRESS_PUBLISH_STATUS_CHECKED", websiteId, {
      forgePageId: forgeStudioPageId,
      wordpressPageId: mapping.wpPostId,
      state: "DISCONNECTED",
      remoteState: "UNKNOWN",
      contentState: "UNKNOWN",
      durationMs: Date.now() - startTime,
    });

    return {
      forgeStudioPageId,
      websiteId,
      state: "DISCONNECTED",
      wordpressPageId: mapping.wpPostId,
      wordpressUrl: mapping.wpPostUrl,
      lastPublishedAt: mapping.lastSyncedAt ? new Date(mapping.lastSyncedAt).toISOString() : undefined,
      contentState: "UNKNOWN",
      remoteState: "UNKNOWN",
      errorCode,
      errorMessage,
    };
  }

  // 6. Content Freshness Determination (Step 8 & 9)
  const websiteUpdatedAt = website.updatedAt ? new Date(website.updatedAt) : new Date();
  const pageUpdatedAt = targetPage.updatedAt ? new Date(targetPage.updatedAt) : websiteUpdatedAt;
  const lastSyncedAt = mapping.lastSyncedAt ? new Date(mapping.lastSyncedAt) : new Date(0);

  // Compare source timestamp with published timestamp (with 1s clock tolerance)
  const isStale = pageUpdatedAt.getTime() - lastSyncedAt.getTime() > 1000;
  const contentState: "CURRENT" | "CHANGES_PENDING" | "UNKNOWN" = isStale ? "CHANGES_PENDING" : "CURRENT";

  // Audit history info
  const auditInfo = await getLastPublishAuditInfo(websiteId, forgeStudioPageId);

  // 7. Remote Page Verification (Step 6)
  let remoteState: "EXISTS" | "MISSING" | "UNKNOWN" = "UNKNOWN";
  let remoteErrorCode: string | undefined;
  let remoteErrorMessage: string | undefined;
  const warnings: Array<{ field?: string; message: string; severity?: string }> = [];

  try {
    const remotePage = await sendSignedWordPressRequest(
      connection.siteUrl,
      `/pages/${mapping.wpPostId}`,
      "GET",
      connection.apiKeyHash
    );

    if (remotePage && (remotePage.id || remotePage.id === mapping.wpPostId)) {
      remoteState = "EXISTS";
    } else {
      remoteState = "MISSING";
      remoteErrorCode = "WORDPRESS_PUBLISH_STATUS_REMOTE_MISSING";
      remoteErrorMessage = "Mapped remote WordPress page was not found (404).";
    }
  } catch (err: any) {
    if (err.statusCode === 404 || err.code === "WORDPRESS_PAGE_NOT_FOUND" || err.message?.includes("404")) {
      remoteState = "MISSING";
      remoteErrorCode = "WORDPRESS_PUBLISH_STATUS_REMOTE_MISSING";
      remoteErrorMessage = "Mapped remote WordPress page no longer exists (404).";
    } else {
      // Network failure, timeout, 500 etc (NOT 404)
      remoteState = "UNKNOWN";
      remoteErrorCode = "WORDPRESS_PUBLISH_STATUS_REMOTE_UNAVAILABLE";
      remoteErrorMessage = `Remote WordPress site verification failed: ${err.message}`;
      warnings.push({
        message: `Remote verification notice: ${err.message}`,
        severity: "WARNING",
      });
    }
  }

  // 8. State Machine Resolution (Step 10)
  let state: WordPressPublishState = "PUBLISHED";

  if (remoteState === "MISSING") {
    state = "REMOTE_MISSING";
  } else if (auditInfo.isLastFailed) {
    state = "FAILED";
  } else if (remoteState === "EXISTS" && contentState === "CHANGES_PENDING") {
    state = "STALE";
  } else if (remoteState === "EXISTS" && contentState === "CURRENT") {
    state = "PUBLISHED";
  } else if (remoteState === "UNKNOWN") {
    state = auditInfo.isLastFailed ? "FAILED" : (contentState === "CHANGES_PENDING" ? "STALE" : "UNKNOWN");
  }

  const result: WordPressPublishStatusDTO = {
    forgeStudioPageId,
    websiteId,
    state,
    wordpressPageId: mapping.wpPostId,
    wordpressUrl: mapping.wpPostUrl,
    lastPublishAttemptAt: auditInfo.lastAttemptAt,
    lastPublishedAt: mapping.lastSyncedAt ? new Date(mapping.lastSyncedAt).toISOString() : undefined,
    lastPublishStatus: auditInfo.isLastFailed ? "FAILED" : "SUCCESS",
    sourceUpdatedAt: pageUpdatedAt.toISOString(),
    publishedSourceUpdatedAt: lastSyncedAt.toISOString(),
    contentState,
    remoteState,
    errorCode: remoteErrorCode || auditInfo.lastFailureCode,
    errorMessage: remoteErrorMessage || auditInfo.lastFailureMessage,
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  await recordAuditLog(userId, "WORDPRESS_PUBLISH_STATUS_CHECKED", websiteId, {
    forgePageId: forgeStudioPageId,
    wordpressPageId: mapping.wpPostId,
    state: result.state,
    remoteState: result.remoteState,
    contentState: result.contentState,
    durationMs: Date.now() - startTime,
  });

  return result;
}

/**
 * F-500: Determines whether an error represents an ambiguous network outcome
 * (e.g., timeout, connection reset, socket error) where remote mutation MAY have occurred.
 */
export function isAmbiguousNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || "").toLowerCase();
  const code = String(err.code || err.statusCode || "").toLowerCase();
  return (
    code === "etimedout" ||
    code === "econnreset" ||
    code === "504" ||
    code === "wordpress_timeout" ||
    msg.includes("timeout") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("connection reset") ||
    msg.includes("socket hang up") ||
    msg.includes("network error") ||
    msg.includes("unknown transport result")
  );
}

export interface ReconcileUnmappedPageOptions {
  publishId: string;
  gutenbergHash?: string;
  htmlHash?: string;
  slug: string;
  title: string;
  sourceVersion?: string;
}

/**
 * F-500: Reconciles an unmapped page after an ambiguous network outcome on first POST.
 * Queries the remote WordPress site for matching candidate pages using deterministic signals.
 */
export async function reconcileUnmappedWordPressPage(
  connection: any,
  websiteId: string,
  forgePageId: string,
  opts: ReconcileUnmappedPageOptions
): Promise<{ matched: boolean; page?: any; ambiguous: boolean; candidateCount: number }> {
  try {
    const remoteListRes = await sendSignedWordPressRequest(
      connection.siteUrl,
      `/pages?slug=${encodeURIComponent(opts.slug)}`,
      "GET",
      connection.apiKeyHash
    );

    let candidates: any[] = [];
    if (Array.isArray(remoteListRes)) {
      candidates = remoteListRes;
    } else if (remoteListRes?.pages && Array.isArray(remoteListRes.pages)) {
      candidates = remoteListRes.pages;
    } else if (remoteListRes?.data && Array.isArray(remoteListRes.data)) {
      candidates = remoteListRes.data;
    }

    if (candidates.length === 0) {
      const searchRes = await sendSignedWordPressRequest(
        connection.siteUrl,
        `/pages?search=${encodeURIComponent(forgePageId)}`,
        "GET",
        connection.apiKeyHash
      ).catch(() => null);

      if (Array.isArray(searchRes)) {
        candidates = searchRes;
      } else if (searchRes?.pages && Array.isArray(searchRes.pages)) {
        candidates = searchRes.pages;
      }
    }

    if (candidates.length === 0) {
      return { matched: false, ambiguous: false, candidateCount: 0 };
    }

    const targetHash = opts.gutenbergHash || opts.htmlHash;

    const exactMatches = candidates.filter((p: any) => {
      // Signal A: forgestudio_publish_id match
      if (opts.publishId && (p?.meta?._forgestudio_publish_id === opts.publishId || p?.publishId === opts.publishId)) {
        return true;
      }
      // Signal B: forgePageId + hash match
      const metaForgeId = p?.meta?._forgestudio_page_id || p?.forgePageId;
      const metaHash = p?.meta?._forgestudio_gutenberg_hash || p?.meta?._forgestudio_html_hash || p?.gutenbergHash || p?.htmlHash;

      if (metaForgeId === forgePageId && targetHash && metaHash === targetHash) {
        return true;
      }
      // Signal C: slug match + hash match in content or meta
      if (p.slug === opts.slug && targetHash && (metaHash === targetHash || (p.content?.rendered || p.content || "").includes(targetHash))) {
        return true;
      }
      // Signal D: exact title + exact slug + forgePageId
      if (p.slug === opts.slug && (p.title?.rendered === opts.title || p.title === opts.title) && metaForgeId === forgePageId) {
        return true;
      }
      return false;
    });

    if (exactMatches.length === 1) {
      return { matched: true, page: exactMatches[0], ambiguous: false, candidateCount: 1 };
    } else if (exactMatches.length > 1) {
      return { matched: false, ambiguous: true, candidateCount: exactMatches.length };
    }

    const slugTitleMatches = candidates.filter((p: any) => p.slug === opts.slug && (p.title?.rendered === opts.title || p.title === opts.title));
    if (slugTitleMatches.length === 1) {
      return { matched: true, page: slugTitleMatches[0], ambiguous: false, candidateCount: 1 };
    } else if (slugTitleMatches.length > 1) {
      return { matched: false, ambiguous: true, candidateCount: slugTitleMatches.length };
    }

    return { matched: false, ambiguous: false, candidateCount: 0 };
  } catch (err) {
    return { matched: false, ambiguous: true, candidateCount: 0 };
  }
}

/**
 * F-495 & F-500: Production-grade WordPress Page Publish Engine
 */
export async function publishWordPressPage(
  websiteId: string,
  userId: string,
  options?: PublishWordPressOptions
): Promise<PublishWordPressResult> {
  const startTime = Date.now();

  // 1. Tenant & Website Ownership Check
  const website = await getWebsiteById(websiteId, userId);

  // 2. RBAC Permission Check (Requires PUBLISH capability)
  const canPublish = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
  if (!canPublish) {
    throw new AppError("Forbidden: Insufficient permissions to publish to WordPress.", 403, "WORDPRESS_PUBLISH_PERMISSION_DENIED");
  }

  // 3. Concurrency Lock Check
  const lockKey = `${websiteId}:${options?.pageId || "default"}`;
  if (publishLocks.has(lockKey)) {
    throw new AppError("A publish operation is already in progress for this page.", 409, "WORDPRESS_PUBLISH_IN_PROGRESS");
  }
  publishLocks.add(lockKey);

  try {
    // 4. Audit Log Start
    try {
      await recordAuditLog(userId, "WORDPRESS_PUBLISH_STARTED", websiteId, {
        pageId: options?.pageId,
        targetStatus: options?.status || "publish",
      });
    } catch (e) {}

    // 5. Connection State Check
    const connection = await getConnectionByWebsiteId(websiteId);
    if (!connection || connection.status !== "CONNECTED") {
      const code = connection?.status === "REVOKED"
        ? "WORDPRESS_CONNECTION_REVOKED"
        : "WORDPRESS_PUBLISH_NOT_CONNECTED";
      throw new AppError("WordPress site is not connected or verified.", 400, code);
    }

    // 6. Site Health & Diagnostic Readiness Check (F-489 Reuse)
    const warnings: Array<{ field?: string; message: string; severity?: string }> = [];
    try {
      const health = await getWordPressSiteHealth(websiteId, userId);
      if (health.overallStatus === "CRITICAL" || health.publishingReadiness?.status === "BLOCKED") {
        const blockReason = health.errors?.[0]?.message || "Site health check indicates publishing is blocked.";
        throw new AppError(`WordPress Publish Blocked: ${blockReason}`, 400, "WORDPRESS_PUBLISH_BLOCKED");
      }
      if (health.warnings && health.warnings.length > 0) {
        health.warnings.forEach((w) => {
          warnings.push({ field: w.code, message: w.message, severity: "WARNING" });
        });
      }
    } catch (healthErr: any) {
      if (healthErr.code === "WORDPRESS_PUBLISH_BLOCKED") throw healthErr;
      warnings.push({ message: `Health check advisory notice: ${healthErr.message}`, severity: "INFO" });
    }

    // 7. Authoritative ForgeStudio Document Retrieval
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
    if (options?.pageId) {
      const found = pages.find((p: any) => p.id === options.pageId || p.slug === options.pageId);
      if (found) targetPage = found;
    }

    // 8. Title Validation
    const title = (options?.title || targetPage.name || targetPage.title || website.name || "Untitled Page").trim();
    if (!title) {
      throw new AppError("Page title is required for publishing.", 400, "WORDPRESS_PUBLISH_VALIDATION_FAILED");
    }

    // 9. Status Allowlist Validation
    const allowedStatuses = new Set(["draft", "publish", "private"]);
    const targetStatus = (options?.status || "publish").toLowerCase();
    if (!allowedStatuses.has(targetStatus)) {
      throw new AppError(`Invalid publish status '${options?.status}'. Allowed: draft, publish, private.`, 400, "WORDPRESS_PUBLISH_VALIDATION_FAILED");
    }

    // 10. Document Transformation (F-495 & F-499 Transformer Service Reuse)
    const publishingFormat = (options?.format || options?.mode || "html").toLowerCase();
    let transformedGutenberg: TransformedWordPressPage | null = null;
    let transformedHtml: TransformedHtmlPage | null = null;
    let finalContent = options?.content;
    let finalSlug = "";
    let finalExcerpt = "";

    try {
      if (publishingFormat === "gutenberg") {
        transformedGutenberg = transformPageToWordPress(targetPage, website.siteSettings || {}, website.globalStyles || {});
        if (!finalContent) finalContent = transformedGutenberg.content;
        finalSlug = (options?.slug || targetPage.slug || transformedGutenberg.slug || "page");
        finalExcerpt = options?.excerpt !== undefined ? options.excerpt : transformedGutenberg.excerpt;
      } else {
        transformedHtml = transformPageToHTML(targetPage, website.siteSettings || {}, website.globalStyles || {});
        if (transformedHtml.stats?.sanitizationWarnings?.length > 0) {
          transformedHtml.stats.sanitizationWarnings.forEach((w) => {
            warnings.push({ message: w, severity: "WARNING" });
          });
        }
        if (!finalContent) finalContent = transformedHtml.fullHtml;
        finalSlug = (options?.slug || targetPage.slug || transformedHtml.slug || "page");
        finalExcerpt = options?.excerpt !== undefined ? options.excerpt : "";
      }
    } catch (transformErr: any) {
      throw new AppError(`Document transformation failed: ${transformErr.message}`, 400, "WORDPRESS_PUBLISH_TRANSFORM_FAILED");
    }

    finalSlug = finalSlug
      .toLowerCase()
      .replace(/^\//, "")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-") || "home";
    const finalTemplate = options?.template || "default";

    // 11. Mapping Resolution (Check for existing WordPressPageMapping)
    const existingMappings = await getWebsitePageMappings(websiteId);
    let mapping = existingMappings.find((m: any) => m.forgePageId === targetPage.id);

    if (!mapping && options?.wordpressPageId) {
      mapping = existingMappings.find((m: any) => m.wpPostId === options.wordpressPageId);
    }

    const sourceVersion = options?.sourceVersion || `v1.${Date.now()}`;
    const gutenbergHash = transformedGutenberg?.gutenbergHash || "";
    const htmlHash = transformedHtml?.htmlHash || "";
    const publishId = options?.publishId || `pub_${websiteId}_${targetPage.id}_${gutenbergHash || htmlHash || Date.now()}`;

    // F-500 Ambiguous First-Publish Reconciliation Pre-Check:
    // If no mapping exists locally, query remote site to discover if an interrupted prior POST created the page
    if (!mapping) {
      try {
        const preRec = await reconcileUnmappedWordPressPage(connection, websiteId, targetPage.id, {
          publishId,
          gutenbergHash,
          htmlHash,
          slug: finalSlug,
          title,
          sourceVersion,
        });

        if (preRec.matched && preRec.page) {
          const recoveredWpPostId = Number(preRec.page.id);
          await upsertPageMapping(websiteId, targetPage.id, recoveredWpPostId, preRec.page.slug || finalSlug, preRec.page.link || `${connection.siteUrl}/${finalSlug}`);
          mapping = { forgePageId: targetPage.id, wpPostId: recoveredWpPostId };
        }
      } catch (preRecErr) {
        // Pre-check advisory notice only
      }
    }

    let action: "CREATED" | "UPDATED" = "CREATED";
    let wpPostId: number = 0;
    let remoteRes: any = null;

    if (mapping && mapping.wpPostId) {
      action = "UPDATED";
      wpPostId = mapping.wpPostId;

      try {
        remoteRes = await sendSignedWordPressRequest(
          connection.siteUrl,
          `/pages/${wpPostId}`,
          "PUT",
          connection.apiKeyHash,
          {
            title,
            slug: finalSlug,
            content: finalContent,
            status: targetStatus,
            excerpt: finalExcerpt,
            template: finalTemplate,
            forgePageId: targetPage.id,
            format: publishingFormat,
            publishId,
            gutenbergHash,
            htmlHash,
            sourceVersion,
            meta: {
              _forgestudio_page_id: targetPage.id,
              _forgestudio_gutenberg_hash: gutenbergHash,
              _forgestudio_html_hash: htmlHash,
              _forgestudio_publish_id: publishId,
              _forgestudio_source_version: sourceVersion,
            },
          }
        );
      } catch (remoteErr: any) {
        if (remoteErr?.statusCode === 404 || remoteErr?.message?.includes("404") || remoteErr?.message?.includes("not found")) {
          action = "CREATED";
          // Fall through to POST
        } else {
          throw remoteErr;
        }
      }
    }

    if (!remoteRes) {
      action = "CREATED";
      const postPayload = {
        title,
        slug: finalSlug,
        content: finalContent,
        status: targetStatus,
        excerpt: finalExcerpt,
        template: finalTemplate,
        forgePageId: targetPage.id,
        format: publishingFormat,
        publishId,
        gutenbergHash,
        htmlHash,
        sourceVersion,
        meta: {
          _forgestudio_page_id: targetPage.id,
          _forgestudio_gutenberg_hash: gutenbergHash,
          _forgestudio_html_hash: htmlHash,
          _forgestudio_publish_id: publishId,
          _forgestudio_source_version: sourceVersion,
        },
      };

      try {
        remoteRes = await sendSignedWordPressRequest(
          connection.siteUrl,
          "/pages",
          "POST",
          connection.apiKeyHash,
          postPayload
        );
      } catch (postErr: any) {
        if (isAmbiguousNetworkError(postErr)) {
          // F-500 Ambiguous network outcome during first POST!
          try {
            await recordAuditLog(userId, "WORDPRESS_PUBLISH_RECONCILIATION_STARTED", websiteId, {
              pageId: targetPage.id,
              publishId,
              error: postErr.message,
            });
          } catch (e) {}

          const rec = await reconcileUnmappedWordPressPage(connection, websiteId, targetPage.id, {
            publishId,
            gutenbergHash,
            htmlHash,
            slug: finalSlug,
            title,
            sourceVersion,
          });

          if (rec.matched && rec.page) {
            // Case A: Remote page found & matched!
            remoteRes = rec.page;
            wpPostId = Number(rec.page.id);
            try {
              await recordAuditLog(userId, "WORDPRESS_PUBLISH_RECONCILIATION_SUCCEEDED", websiteId, {
                pageId: targetPage.id,
                wpPostId,
                publishId,
              });
            } catch (e) {}
          } else if (rec.ambiguous || rec.candidateCount > 1) {
            // Case C: Ambiguous or multiple matches -> NEVER POST again!
            try {
              await recordAuditLog(userId, "WORDPRESS_PUBLISH_RECONCILIATION_REQUIRED", websiteId, {
                pageId: targetPage.id,
                publishId,
                candidateCount: rec.candidateCount,
              });
            } catch (e) {}

            throw new AppError(
              "First publish timed out and remote state is ambiguous. Reconciliation required to avoid duplicate pages.",
              504,
              "WORDPRESS_PUBLISH_RECONCILIATION_REQUIRED"
            );
          } else {
            // Case B: Proven no remote page created -> allow retry
            try {
              await recordAuditLog(userId, "WORDPRESS_PUBLISH_RECONCILIATION_FAILED", websiteId, {
                pageId: targetPage.id,
                publishId,
              });
            } catch (e) {}

            throw new AppError(
              "First publish timed out before remote page creation.",
              504,
              "WORDPRESS_PUBLISH_TIMEOUT_NO_MUTATION"
            );
          }
        } else {
          throw postErr;
        }
      }
    }

    if (remoteRes?.success === false || remoteRes?.error) {
      const code = remoteRes?.error?.code || "WORDPRESS_PUBLISH_FAILED";
      const msg = remoteRes?.error?.message || "WordPress publish operation failed.";
      throw new AppError(msg, 502, code);
    }

    const createdOrUpdatedPage = remoteRes?.page || remoteRes?.data || remoteRes || {};
    wpPostId = createdOrUpdatedPage.id || wpPostId;
    const canonicalSlug = createdOrUpdatedPage.slug || finalSlug;
    const canonicalUrl = createdOrUpdatedPage.link || `${connection.siteUrl}/${canonicalSlug === "home" ? "" : canonicalSlug}`;

    // 12. Durable Page Mapping Upsert
    try {
      await upsertPageMapping(websiteId, targetPage.id, wpPostId, canonicalSlug, canonicalUrl);
    } catch (mappingErr: any) {
      try {
        await recordAuditLog(userId, "WORDPRESS_PUBLISH_FAILED", websiteId, {
          forgePageId: targetPage.id,
          wpPostId,
          errorCode: "WORDPRESS_PUBLISH_MAPPING_FAILED",
          errorMessage: mappingErr.message,
        });
      } catch (e) {}

      throw new AppError(
        `Page was published to WordPress (ID ${wpPostId}), but local mapping persistence failed. Synchronize mapping for consistency.`,
        500,
        "WORDPRESS_PUBLISH_MAPPING_FAILED"
      );
    }

    // 13. Update Connection Last Synced Time
    const now = new Date();
    if (db?.wordPressConnection?.update) {
      await db.wordPressConnection.update({
        where: { websiteId },
        data: { lastSyncedAt: now },
      });
    }

    // 14. Create Immutable Publish Snapshot & Audit Logging
    const durationMs = Date.now() - startTime;
    let snapshotId: string | undefined;
    let revisionVersion: number | undefined;

    const contentHash = transformedGutenberg?.gutenbergHash || transformedHtml?.htmlHash;
    const statsPayload = transformedGutenberg?.blockStats || transformedHtml?.stats;

    try {
      const pubRev = await createRevision(websiteId, userId, {
        revisionType: "PUBLISH",
        description: `WordPress Publish (${publishingFormat.toUpperCase()}): ${title} (WP ID: ${wpPostId})`,
        elements: targetPage.elements || [],
        pages,
      });
      snapshotId = pubRev.id;
      revisionVersion = pubRev.version;
    } catch (revErr) {
      console.warn("Could not create PUBLISH revision snapshot:", revErr);
    }

    try {
      await recordAuditLog(userId, "WORDPRESS_PUBLISH_SUCCEEDED", websiteId, {
        forgePageId: targetPage.id,
        wordpressPageId: wpPostId,
        action,
        status: targetStatus,
        url: canonicalUrl,
        durationMs,
        snapshotId,
        publishingFormat,
        htmlHash: contentHash,
        gutenbergHash: transformedGutenberg?.gutenbergHash,
      });
    } catch (e) {}

    return {
      success: true,
      websiteId,
      forgeStudioPageId: targetPage.id,
      wordpressPageId: wpPostId,
      action,
      status: targetStatus,
      title,
      slug: canonicalSlug,
      url: canonicalUrl,
      publishedAt: now.toISOString(),
      snapshotId,
      sourceVersion: revisionVersion,
      publishingFormat,
      htmlHash: contentHash,
      gutenbergHash: transformedGutenberg?.gutenbergHash,
      stats: transformedHtml?.stats,
      blockStats: transformedGutenberg?.blockStats,
      warnings,
    };
  } catch (err: any) {
    try {
      await recordAuditLog(userId, "WORDPRESS_PUBLISH_FAILED", websiteId, {
        pageId: options?.pageId,
        errorCode: err.code || "WORDPRESS_PUBLISH_FAILED",
        errorMessage: err.message,
        durationMs: Date.now() - startTime,
      });
    } catch (e) {}

    throw err;
  } finally {
    publishLocks.delete(lockKey);
  }
}

/**
 * F-499: Generate an HTML preview of the canonical page document without remote mutation.
 */
export async function previewWordPressHtml(
  websiteId: string,
  userId: string,
  pageId?: string
) {
  const website = await getWebsiteById(websiteId, userId);
  const canView = await canUserAccessResource(userId, websiteId, "*", "VIEW");
  if (!canView) {
    throw new AppError("Forbidden: Insufficient permissions to view page preview.", 403, "FORBIDDEN");
  }

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

  const transformedHtml = transformPageToHTML(targetPage, website.siteSettings || {}, website.globalStyles || {});

  return {
    success: true,
    pageId: targetPage.id,
    title: targetPage.name || "Untitled Page",
    slug: targetPage.slug || "home",
    html: transformedHtml.html,
    css: transformedHtml.css,
    fullHtml: transformedHtml.fullHtml,
    htmlHash: transformedHtml.htmlHash,
    stats: transformedHtml.stats,
  };
}

/**
 * F-500: Generate a Gutenberg block preview of the canonical page document without remote mutation.
 */
export async function previewWordPressGutenberg(
  websiteId: string,
  userId: string,
  pageId?: string
) {
  const website = await getWebsiteById(websiteId, userId);
  const canView = await canUserAccessResource(userId, websiteId, "*", "VIEW");
  if (!canView) {
    throw new AppError("Forbidden: Insufficient permissions to view block preview.", 403, "FORBIDDEN");
  }

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

  const transformedGutenberg = transformPageToWordPress(targetPage, website.siteSettings || {}, website.globalStyles || {});

  return {
    success: true,
    pageId: targetPage.id,
    title: targetPage.name || "Untitled Page",
    slug: targetPage.slug || "home",
    content: transformedGutenberg.content,
    gutenbergHash: transformedGutenberg.gutenbergHash,
    blockStats: transformedGutenberg.blockStats,
    blocks: transformedGutenberg.gutenbergBlocks,
  };
}

/**
 * Convenience synchronization wrapper for manual or scheduled sync
 */
export async function syncWordPressPages(
  websiteId: string,
  userId: string,
  snapshot?: any
): Promise<WordPressSyncResult> {
  return publishToWordPress(websiteId, userId, "manual-sync", snapshot);
}
