import { AppError } from "../../../utils/app-error.js";
import { canUserAccessResource } from "../../permission.service.js";
import { db } from "./db.js";
import { getConnectionState, verifyWebsiteOwnership } from "./connection.js";
import { parseWordPressContentToElements } from "../transformer.service.js";
import { recordAuditLog } from "./auditLog.js";
import { sendSignedWordPressRequest } from "./signedRequest.js";

// WordPress pages: list, read, import, create, update, delete, duplicate (title / slug helpers) and reorder.
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

export interface WordPressPageDTO {
  id: number;
  date: string;
  modified: string;
  slug: string;
  status: "draft" | "publish" | "pending" | "private" | "trash";
  type: string;
  link: string;
  title: string;
  content: string;
  excerpt: string;
  author: number | null;
  parent: number;
  menuOrder: number;
  template: string;
  forgePageId?: string | null;
}

export interface WordPressPagesListResult {
  success: boolean;
  pages: WordPressPageDTO[];
  pagination: {
    total: number;
    totalPages: number;
    page: number;
    perPage: number;
  };
}

/**
 * List WordPress Pages
 */
export async function listWordPressPages(
  websiteId: string,
  userId: string,
  query?: { search?: string; status?: string; parent?: number; author?: number; page?: number; perPage?: number }
): Promise<WordPressPagesListResult> {
  const website = await verifyWebsiteOwnership(websiteId, userId);
  const userAccess = await canUserAccessResource(userId, websiteId, "*", "VIEW");
  if (!userAccess) {
    throw new AppError("Forbidden: Insufficient permissions to view WordPress pages.", 403, "FORBIDDEN");
  }

  const connection = await getConnectionState(websiteId);
  if (connection.status === "DISCONNECTED") {
    throw new AppError("WordPress site is disconnected.", 400, "WORDPRESS_CONNECTION_DISCONNECTED");
  }
  if (connection.status === "REVOKED") {
    throw new AppError("WordPress connection token has been revoked.", 400, "WORDPRESS_CONNECTION_REVOKED");
  }
  if (connection.status !== "CONNECTED") {
    throw new AppError("WordPress site is not connected.", 400, "WORDPRESS_NOT_CONNECTED");
  }

  const queryParams = new URLSearchParams();
  if (query?.search) queryParams.append("search", query.search);
  if (query?.status) queryParams.append("status", query.status);
  if (query?.parent !== undefined) queryParams.append("parent", query.parent.toString());
  if (query?.author !== undefined) queryParams.append("author", query.author.toString());
  if (query?.page) queryParams.append("page", query.page.toString());
  if (query?.perPage) queryParams.append("perPage", query.perPage.toString());

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
  const remoteRes = await sendSignedWordPressRequest(
    connection.siteUrl,
    `/pages${queryString}`,
    "GET",
    connection.apiKeyHash
  );

  if (remoteRes?.success === false && remoteRes?.error) {
    throw new AppError(
      remoteRes.error.message || "Failed to retrieve WordPress pages.",
      remoteRes.error.code === "WORDPRESS_PAGE_NOT_FOUND" ? 404 : 502,
      remoteRes.error.code || "WORDPRESS_PAGE_FETCH_FAILED"
    );
  }

  const data = remoteRes?.data || remoteRes || {};
  const pages: WordPressPageDTO[] = Array.isArray(data.pages) ? data.pages : [];
  const pagination = data.pagination || {
    total: pages.length,
    totalPages: 1,
    page: query?.page || 1,
    perPage: query?.perPage || 20,
  };

  try {
    await recordAuditLog(userId, "WORDPRESS_PAGES_LISTED", websiteId, {
      count: pages.length,
      status: query?.status || "any",
    });
  } catch (err) {}

  return {
    success: true,
    pages,
    pagination,
  };
}

/**
 * Get Single WordPress Page by ID
 */
export async function getWordPressPage(
  websiteId: string,
  pageId: number,
  userId: string
): Promise<{ success: boolean; page: WordPressPageDTO }> {
  await verifyWebsiteOwnership(websiteId, userId);
  const userAccess = await canUserAccessResource(userId, websiteId, "*", "VIEW");
  if (!userAccess) {
    throw new AppError("Forbidden: Insufficient permissions to view WordPress page.", 403, "FORBIDDEN");
  }

  const connection = await getConnectionState(websiteId);
  if (connection.status === "DISCONNECTED") {
    throw new AppError("WordPress site is disconnected.", 400, "WORDPRESS_CONNECTION_DISCONNECTED");
  }
  if (connection.status === "REVOKED") {
    throw new AppError("WordPress connection token has been revoked.", 400, "WORDPRESS_CONNECTION_REVOKED");
  }

  const remoteRes = await sendSignedWordPressRequest(
    connection.siteUrl,
    `/pages/${pageId}`,
    "GET",
    connection.apiKeyHash
  );

  if (remoteRes?.success === false || remoteRes?.error) {
    throw new AppError(
      remoteRes?.error?.message || `WordPress Page with ID ${pageId} not found.`,
      404,
      remoteRes?.error?.code || "WORDPRESS_PAGE_NOT_FOUND"
    );
  }

  const pageDto: WordPressPageDTO = remoteRes.data || remoteRes;
  if (!pageDto || !pageDto.id) {
    throw new AppError(`WordPress Page with ID ${pageId} not found.`, 404, "WORDPRESS_PAGE_NOT_FOUND");
  }

  try {
    await recordAuditLog(userId, "WORDPRESS_PAGE_VIEWED", websiteId, {
      wpPageId: pageId,
      slug: pageDto.slug,
    });
  } catch (err) {}

  return {
    success: true,
    page: pageDto,
  };
}

/**
 * F-501 / F-502 — Import WordPress Page to ForgeStudio Visual Editor
 */
export async function importWordPressPageToForge(
  websiteId: string,
  pageId: number,
  userId: string
) {
  const pageRes = await getWordPressPage(websiteId, pageId, userId);
  const wpPage = pageRes.page;

  const pageTitle = typeof wpPage.title === "object" ? (wpPage.title as any)?.rendered || (wpPage.title as any)?.raw || "WordPress Page" : wpPage.title || "WordPress Page";
  const rawContent = typeof wpPage.content === "object" ? (wpPage.content as any)?.rendered || (wpPage.content as any)?.raw || "" : wpPage.content || "";
  const slug = wpPage.slug || `wp-page-${pageId}`;

  const elements = parseWordPressContentToElements(rawContent);

  const forgePageId = `wp_page_${pageId}`;

  try {
    if (db?.wordPressPageMapping?.upsert) {
      await db.wordPressPageMapping.upsert({
        where: {
          websiteId_wordpressPageId: {
            websiteId,
            wordpressPageId: pageId,
          },
        },
        update: {
          forgePageId,
          wordpressSlug: slug,
          lastSyncedAt: new Date(),
        },
        create: {
          websiteId,
          wordpressPageId: pageId,
          forgePageId,
          wordpressSlug: slug,
          lastSyncedAt: new Date(),
        },
      });
    }
  } catch (err: any) {
    // Non-blocking fallback
  }

  try {
    await recordAuditLog(userId, "WORDPRESS_PAGE_IMPORTED", websiteId, {
      wpPageId: pageId,
      slug,
      elementCount: elements.length,
    });
  } catch (err) {}

  return {
    success: true,
    websiteId,
    wordpressPageId: pageId,
    forgePageId,
    pageTitle,
    slug,
    status: wpPage.status || "publish",
    elements,
    pageSettings: {
      title: pageTitle,
      slug,
      status: wpPage.status || "publish",
    },
  };
}

/**
 * Create WordPress Page
 */
export async function createWordPressPage(
  websiteId: string,
  userId: string,
  data: {
    title: string;
    slug?: string;
    content?: string;
    status?: string;
    parent?: number;
    menuOrder?: number;
    template?: string;
    excerpt?: string;
    forgePageId?: string;
  }
): Promise<{ success: boolean; page: WordPressPageDTO }> {
  await verifyWebsiteOwnership(websiteId, userId);
  
  const targetStatus = data.status || "draft";
  const isPublishing = targetStatus === "publish";

  if (isPublishing) {
    const canPublish = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
    if (!canPublish) {
      throw new AppError("Forbidden: You do not have permission to publish WordPress pages.", 403, "WORDPRESS_PAGE_PUBLISH_FORBIDDEN");
    }
  } else {
    const canEdit = await canUserAccessResource(userId, websiteId, "*", "EDIT");
    if (!canEdit) {
      throw new AppError("Forbidden: You do not have permission to create WordPress pages.", 403, "FORBIDDEN");
    }
  }

  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    throw new AppError("Page title is required.", 400, "WORDPRESS_PAGE_INVALID_TITLE");
  }

  const allowedStatuses = ["draft", "publish", "pending", "private"];
  if (!allowedStatuses.includes(targetStatus)) {
    throw new AppError(`Invalid page status '${targetStatus}'. Allowed: ${allowedStatuses.join(", ")}`, 400, "WORDPRESS_PAGE_INVALID_STATUS");
  }

  const connection = await getConnectionState(websiteId);
  if (connection.status === "DISCONNECTED") {
    throw new AppError("WordPress site is disconnected.", 400, "WORDPRESS_CONNECTION_DISCONNECTED");
  }
  if (connection.status === "REVOKED") {
    throw new AppError("WordPress connection token has been revoked.", 400, "WORDPRESS_CONNECTION_REVOKED");
  }

  const remoteRes = await sendSignedWordPressRequest(
    connection.siteUrl,
    "/pages",
    "POST",
    connection.apiKeyHash,
    {
      title: data.title.trim(),
      slug: data.slug ? data.slug.trim() : undefined,
      content: data.content || "",
      status: targetStatus,
      parent: data.parent !== undefined ? data.parent : 0,
      menuOrder: data.menuOrder !== undefined ? data.menuOrder : 0,
      template: data.template || "default",
      excerpt: data.excerpt || "",
      forgePageId: data.forgePageId || undefined,
    }
  );

  if (remoteRes?.success === false || remoteRes?.error) {
    const code = remoteRes?.error?.code || "WORDPRESS_PAGE_CREATE_FAILED";
    const msg = remoteRes?.error?.message || "Failed to create WordPress page.";
    throw new AppError(msg, code === "WORDPRESS_PAGE_INVALID_PARENT" ? 400 : 502, code);
  }

  const createdPage: WordPressPageDTO = remoteRes.data || remoteRes;

  // Track mapping in database if forgePageId is attached
  if (data.forgePageId && createdPage.id && db?.wordPressPageMapping?.upsert) {
    try {
      await db.wordPressPageMapping.upsert({
        where: {
          websiteId_forgePageId: {
            websiteId,
            forgePageId: data.forgePageId,
          },
        },
        update: {
          wpPostId: createdPage.id,
          wpPostSlug: createdPage.slug,
          wpPostUrl: createdPage.link,
          lastSyncedAt: new Date(),
        },
        create: {
          websiteId,
          forgePageId: data.forgePageId,
          wpPostId: createdPage.id,
          wpPostSlug: createdPage.slug,
          wpPostUrl: createdPage.link,
          lastSyncedAt: new Date(),
        },
      });
    } catch (dbErr) {}
  }

  try {
    await recordAuditLog(userId, "WORDPRESS_PAGE_CREATED", websiteId, {
      wpPageId: createdPage.id,
      title: createdPage.title,
      slug: createdPage.slug,
      status: createdPage.status,
    });
  } catch (err) {}

  return {
    success: true,
    page: createdPage,
  };
}

/**
 * Update WordPress Page
 */
export async function updateWordPressPage(
  websiteId: string,
  pageId: number,
  userId: string,
  data: {
    title?: string;
    slug?: string;
    content?: string;
    status?: string;
    parent?: number;
    menuOrder?: number;
    template?: string;
    excerpt?: string;
    forgePageId?: string;
  }
): Promise<{ success: boolean; page: WordPressPageDTO }> {
  await verifyWebsiteOwnership(websiteId, userId);

  if (data.status === "publish") {
    const canPublish = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
    if (!canPublish) {
      throw new AppError("Forbidden: You do not have permission to publish WordPress pages.", 403, "WORDPRESS_PAGE_PUBLISH_FORBIDDEN");
    }
  } else {
    const canEdit = await canUserAccessResource(userId, websiteId, "*", "EDIT");
    if (!canEdit) {
      throw new AppError("Forbidden: You do not have permission to update WordPress pages.", 403, "FORBIDDEN");
    }
  }

  if (data.parent !== undefined && data.parent === pageId) {
    throw new AppError("A page cannot be its own parent.", 400, "WORDPRESS_PAGE_INVALID_PARENT");
  }

  const connection = await getConnectionState(websiteId);
  if (connection.status === "DISCONNECTED") {
    throw new AppError("WordPress site is disconnected.", 400, "WORDPRESS_CONNECTION_DISCONNECTED");
  }
  if (connection.status === "REVOKED") {
    throw new AppError("WordPress connection token has been revoked.", 400, "WORDPRESS_CONNECTION_REVOKED");
  }

  const remoteRes = await sendSignedWordPressRequest(
    connection.siteUrl,
    `/pages/${pageId}`,
    "PUT",
    connection.apiKeyHash,
    data
  );

  if (remoteRes?.success === false || remoteRes?.error) {
    const code = remoteRes?.error?.code || "WORDPRESS_PAGE_UPDATE_FAILED";
    const msg = remoteRes?.error?.message || `Failed to update WordPress Page ID ${pageId}.`;
    const statusCode = code === "WORDPRESS_PAGE_NOT_FOUND" ? 404 : (code === "WORDPRESS_PAGE_INVALID_PARENT" ? 400 : 502);
    throw new AppError(msg, statusCode, code);
  }

  const updatedPage: WordPressPageDTO = remoteRes.data || remoteRes;

  if (data.forgePageId && updatedPage.id && db?.wordPressPageMapping?.upsert) {
    try {
      await db.wordPressPageMapping.upsert({
        where: {
          websiteId_forgePageId: {
            websiteId,
            forgePageId: data.forgePageId,
          },
        },
        update: {
          wpPostId: updatedPage.id,
          wpPostSlug: updatedPage.slug,
          wpPostUrl: updatedPage.link,
          lastSyncedAt: new Date(),
        },
        create: {
          websiteId,
          forgePageId: data.forgePageId,
          wpPostId: updatedPage.id,
          wpPostSlug: updatedPage.slug,
          wpPostUrl: updatedPage.link,
          lastSyncedAt: new Date(),
        },
      });
    } catch (dbErr) {}
  }

  try {
    await recordAuditLog(userId, "WORDPRESS_PAGE_UPDATED", websiteId, {
      wpPageId: updatedPage.id,
      title: updatedPage.title,
      slug: updatedPage.slug,
      status: updatedPage.status,
    });
  } catch (err) {}

  return {
    success: true,
    page: updatedPage,
  };
}

/**
 * Delete / Trash WordPress Page
 */
export async function deleteWordPressPage(
  websiteId: string,
  pageId: number,
  userId: string,
  force: boolean = false
): Promise<{ success: boolean; deleted: boolean; id: number; force: boolean }> {
  await verifyWebsiteOwnership(websiteId, userId);
  const canDelete = await canUserAccessResource(userId, websiteId, "*", "DELETE");
  if (!canDelete) {
    throw new AppError("Forbidden: Insufficient permissions to delete WordPress page.", 403, "FORBIDDEN");
  }

  const connection = await getConnectionState(websiteId);
  if (connection.status === "DISCONNECTED") {
    throw new AppError("WordPress site is disconnected.", 400, "WORDPRESS_CONNECTION_DISCONNECTED");
  }
  if (connection.status === "REVOKED") {
    throw new AppError("WordPress connection token has been revoked.", 400, "WORDPRESS_CONNECTION_REVOKED");
  }

  const remoteRes = await sendSignedWordPressRequest(
    connection.siteUrl,
    `/pages/${pageId}?force=${force ? "true" : "false"}`,
    "DELETE",
    connection.apiKeyHash
  );

  if (remoteRes?.success === false || remoteRes?.error) {
    const code = remoteRes?.error?.code || "WORDPRESS_PAGE_DELETE_FAILED";
    const msg = remoteRes?.error?.message || `Failed to delete WordPress Page ID ${pageId}.`;
    const statusCode = code === "WORDPRESS_PAGE_NOT_FOUND" ? 404 : 502;
    throw new AppError(msg, statusCode, code);
  }

  if (force && db?.wordPressPageMapping?.deleteMany) {
    try {
      await db.wordPressPageMapping.deleteMany({
        where: {
          websiteId,
          wpPostId: pageId,
        },
      });
    } catch (dbErr) {}
  }

  try {
    await recordAuditLog(
      userId,
      force ? "WORDPRESS_PAGE_DELETED" : "WORDPRESS_PAGE_TRASHED",
      websiteId,
      { wpPageId: pageId, force }
    );
  } catch (err) {}

  return {
    success: true,
    deleted: true,
    id: pageId,
    force,
  };
}

/**
 * Helper: Generate deterministic duplicate title
 */
export function generateDuplicateTitle(sourceTitle: string): string {
  const trimmed = (sourceTitle || "Untitled Page").trim();
  const copyMatch = trimmed.match(/^(.*?)\s+Copy(?:\s+(\d+))?$/i);
  if (copyMatch) {
    const baseTitle = copyMatch[1];
    const currentNum = copyMatch[2] ? parseInt(copyMatch[2], 10) : 1;
    return `${baseTitle} Copy ${currentNum + 1}`;
  }
  return `${trimmed} Copy`;
}

/**
 * Helper: Generate unique URL slug for duplicate page
 */
export function generateDuplicateSlug(sourceSlug: string, existingSlugs: string[] = []): string {
  let baseSlug = (sourceSlug || "page").trim().toLowerCase().replace(/[^\w-]/g, "");
  const copyMatch = baseSlug.match(/^(.*?)-copy(?:-(\d+))?$/i);
  if (copyMatch) {
    const base = copyMatch[1];
    const currentNum = copyMatch[2] ? parseInt(copyMatch[2], 10) : 1;
    baseSlug = `${base}-copy-${currentNum + 1}`;
  } else {
    baseSlug = `${baseSlug}-copy`;
  }

  let candidateSlug = baseSlug;
  let counter = 2;
  while (existingSlugs.includes(candidateSlug)) {
    candidateSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  return candidateSlug;
}

/**
 * Duplicate WordPress Page (F-491)
 */
export async function duplicateWordPressPage(
  websiteId: string,
  pageId: number,
  userId: string,
  options?: {
    customTitle?: string;
    customSlug?: string;
  }
): Promise<{ success: boolean; page: WordPressPageDTO; sourcePageId: number }> {
  // 1. Validate website ownership
  await verifyWebsiteOwnership(websiteId, userId);

  // 2. Validate EDIT capability
  const canEdit = await canUserAccessResource(userId, websiteId, "*", "EDIT");
  if (!canEdit) {
    throw new AppError("Forbidden: Insufficient permissions to duplicate WordPress page.", 403, "FORBIDDEN");
  }

  // 3. Connection state validation
  const connection = await getConnectionState(websiteId);
  if (connection.status === "DISCONNECTED") {
    throw new AppError("WordPress site is disconnected.", 400, "WORDPRESS_CONNECTION_DISCONNECTED");
  }
  if (connection.status === "REVOKED") {
    throw new AppError("WordPress connection token has been revoked.", 400, "WORDPRESS_CONNECTION_REVOKED");
  }

  // 4. Fetch source WordPress page
  const sourceRes = await getWordPressPage(websiteId, pageId, userId);
  if (!sourceRes?.success || !sourceRes?.page) {
    throw new AppError(`Source WordPress Page with ID ${pageId} not found.`, 404, "WORDPRESS_PAGE_NOT_FOUND");
  }
  const sourcePage = sourceRes.page;

  // 5. Fetch existing pages to verify unique slug
  let existingSlugs: string[] = [];
  try {
    const listRes = await listWordPressPages(websiteId, userId, { perPage: 100 });
    if (listRes?.pages) {
      existingSlugs = listRes.pages.map((p) => p.slug);
    }
  } catch (err) {}

  // 6. Generate Title & Slug
  const newTitle = options?.customTitle || generateDuplicateTitle(sourcePage.title);
  const newSlug = options?.customSlug || generateDuplicateSlug(sourcePage.slug, existingSlugs);

  // 7. Validate parent page if source has parent > 0
  let targetParent = 0;
  if (sourcePage.parent && sourcePage.parent > 0) {
    try {
      const parentCheck = await getWordPressPage(websiteId, sourcePage.parent, userId);
      if (parentCheck?.success && parentCheck?.page) {
        targetParent = sourcePage.parent;
      }
    } catch (parentErr) {
      targetParent = 0; // Fallback to root parent if source parent no longer exists
    }
  }

  // 8. Create new WordPress Page via Remote API (ALWAYS as 'draft')
  const remoteRes = await sendSignedWordPressRequest(
    connection.siteUrl,
    "/pages",
    "POST",
    connection.apiKeyHash,
    {
      title: newTitle,
      slug: newSlug,
      content: sourcePage.content || "",
      status: "draft", // Always default duplicate to draft
      parent: targetParent,
      menuOrder: 0, // Reset menu order to default placement
      template: sourcePage.template || "default",
      excerpt: sourcePage.excerpt || "",
    }
  );

  if (remoteRes?.success === false || remoteRes?.error) {
    const code = remoteRes?.error?.code || "WORDPRESS_PAGE_DUPLICATE_FAILED";
    const msg = remoteRes?.error?.message || "Failed to create remote WordPress page duplicate.";
    throw new AppError(msg, 502, code);
  }

  const createdDuplicate: WordPressPageDTO = remoteRes.data || remoteRes;

  // 9. Atomic DB Mapping creation & recovery cleanup
  let mappingCreated = false;
  if (db?.wordPressPageMapping?.create) {
    try {
      await db.wordPressPageMapping.create({
        data: {
          websiteId,
          wpPostId: createdDuplicate.id,
          wpPostSlug: createdDuplicate.slug,
          wpPostUrl: createdDuplicate.link,
          lastSyncedAt: new Date(),
        },
      });
      mappingCreated = true;
    } catch (dbErr) {
      // Partial failure recovery: attempt to trash the newly created remote page to avoid orphan remote post
      try {
        await sendSignedWordPressRequest(
          connection.siteUrl,
          `/pages/${createdDuplicate.id}?force=true`,
          "DELETE",
          connection.apiKeyHash
        );
      } catch (cleanupErr) {
        console.error("Failed to clean up remote duplicate page after mapping DB failure:", cleanupErr);
      }
      throw new AppError(
        "Failed to create database mapping for duplicate page. Remote page creation was rolled back.",
        500,
        "WORDPRESS_MAPPING_CREATE_FAILED"
      );
    }
  }

  // 10. Record Audit Log
  try {
    await recordAuditLog(userId, "WORDPRESS_PAGE_DUPLICATED", websiteId, {
      sourceWpPageId: pageId,
      newWpPageId: createdDuplicate.id,
      sourceSlug: sourcePage.slug,
      newSlug: createdDuplicate.slug,
      status: "draft",
    });
  } catch (auditErr) {}

  return {
    success: true,
    page: createdDuplicate,
    sourcePageId: pageId,
  };
}

export interface ReorderWordPressPageOptions {
  targetPageId?: number;
  position?: "BEFORE" | "AFTER" | "FIRST" | "LAST";
  parentId?: number;
}

/**
 * F-492: Reorder WordPress Pages (menuOrder & parent hierarchy)
 */
export async function reorderWordPressPage(
  websiteId: string,
  pageId: number,
  userId: string,
  options: ReorderWordPressPageOptions = {}
): Promise<{ success: boolean; pages: WordPressPageDTO[] }> {
  // 1. Verify Website Ownership & Tenant Isolation
  await verifyWebsiteOwnership(websiteId, userId);

  // 2. Verify RBAC Capability (EDIT required)
  const canEdit = await canUserAccessResource(userId, websiteId, "*", "EDIT");
  if (!canEdit) {
    throw new AppError("Forbidden: Insufficient permissions to reorder WordPress pages.", 403, "FORBIDDEN");
  }

  // 3. Verify Connection State
  const connection = await db.wordPressConnection.findUnique({
    where: { websiteId },
  });

  if (!connection) {
    throw new AppError("WordPress connection not configured.", 404, "WORDPRESS_CONNECTION_NOT_FOUND");
  }

  const connState = connection.status;
  if (connState === "DISCONNECTED") {
    throw new AppError("WordPress site is disconnected.", 400, "WORDPRESS_CONNECTION_DISCONNECTED");
  }
  if (connState === "REVOKED") {
    throw new AppError("WordPress connection token has been revoked.", 400, "WORDPRESS_CONNECTION_REVOKED");
  }

  // 4. Fetch All Current Remote Pages
  const allPagesRes = await listWordPressPages(websiteId, userId, { perPage: 100 });
  const allPages: WordPressPageDTO[] = allPagesRes.pages || [];

  // 5. Find Source Page
  const sourcePage = allPages.find((p) => p.id === pageId);
  if (!sourcePage) {
    throw new AppError(`WordPress page ${pageId} not found.`, 404, "WORDPRESS_PAGE_NOT_FOUND");
  }

  // 6. Target Parent Resolution & Cycle Check
  const oldParentId = sourcePage.parent || 0;
  const targetParentId = options.parentId !== undefined ? Number(options.parentId) : oldParentId;

  if (targetParentId > 0) {
    const parentPage = allPages.find((p) => p.id === targetParentId);
    if (!parentPage) {
      throw new AppError(`Target parent page ${targetParentId} not found.`, 400, "WORDPRESS_PAGE_INVALID_PARENT");
    }

    // Self-parent prevention
    if (targetParentId === pageId) {
      throw new AppError("Cannot set a page as its own parent.", 400, "WORDPRESS_PAGE_INVALID_PARENT");
    }

    // Ancestor cycle prevention
    let currAncestorId = targetParentId;
    const visited = new Set<number>();
    while (currAncestorId > 0) {
      if (currAncestorId === pageId) {
        throw new AppError("Circular hierarchy detected: cannot set parent to a descendant page.", 400, "WORDPRESS_PAGE_INVALID_PARENT");
      }
      if (visited.has(currAncestorId)) break;
      visited.add(currAncestorId);
      const ancestor = allPages.find((p) => p.id === currAncestorId);
      currAncestorId = ancestor ? ancestor.parent : 0;
    }
  }

  // 7. Calculate New Sibling Order in Target Parent Group
  const targetSiblings = allPages
    .filter((p) => (p.parent || 0) === targetParentId && p.id !== pageId)
    .sort((a, b) => (a.menuOrder ?? 0) - (b.menuOrder ?? 0) || a.id - b.id);

  const position = options.position || (options.targetPageId ? "AFTER" : "LAST");
  const targetPageId = options.targetPageId ? Number(options.targetPageId) : undefined;

  let insertIndex = targetSiblings.length; // Default LAST

  if (position === "FIRST") {
    insertIndex = 0;
  } else if (position === "LAST") {
    insertIndex = targetSiblings.length;
  } else if (targetPageId !== undefined) {
    const tIdx = targetSiblings.findIndex((p) => p.id === targetPageId);
    if (tIdx === -1) {
      throw new AppError(`Target page ${targetPageId} not found under parent ${targetParentId}.`, 404, "WORDPRESS_PAGE_NOT_FOUND");
    }
    insertIndex = position === "BEFORE" ? tIdx : tIdx + 1;
  }

  // Insert source page at computed index
  const newTargetSiblings = [...targetSiblings];
  newTargetSiblings.splice(insertIndex, 0, {
    ...sourcePage,
    parent: targetParentId,
  });

  // Collect updates for target parent group
  interface OrderUpdate {
    pageId: number;
    oldMenuOrder: number;
    newMenuOrder: number;
    oldParent: number;
    newParent: number;
  }

  const updatesToApply: OrderUpdate[] = [];

  newTargetSiblings.forEach((page, idx) => {
    const desiredMenuOrder = idx;
    const desiredParent = targetParentId;
    const currentMenuOrder = page.id === pageId ? sourcePage.menuOrder : page.menuOrder;
    const currentParent = page.id === pageId ? oldParentId : page.parent;

    if (currentMenuOrder !== desiredMenuOrder || currentParent !== desiredParent) {
      updatesToApply.push({
        pageId: page.id,
        oldMenuOrder: currentMenuOrder,
        newMenuOrder: desiredMenuOrder,
        oldParent: currentParent,
        newParent: desiredParent,
      });
    }
  });

  // Re-normalize old parent group if parent changed
  if (oldParentId !== targetParentId) {
    const oldSiblings = allPages
      .filter((p) => (p.parent || 0) === oldParentId && p.id !== pageId)
      .sort((a, b) => (a.menuOrder ?? 0) - (b.menuOrder ?? 0) || a.id - b.id);

    oldSiblings.forEach((page, idx) => {
      if (page.menuOrder !== idx) {
        // Only push if not already in updatesToApply
        if (!updatesToApply.some((u) => u.pageId === page.id)) {
          updatesToApply.push({
            pageId: page.id,
            oldMenuOrder: page.menuOrder,
            newMenuOrder: idx,
            oldParent: oldParentId,
            newParent: oldParentId,
          });
        }
      }
    });
  }

  // 8. Atomic Batch Execution with Rollback Recovery
  const appliedUpdates: OrderUpdate[] = [];

  for (const update of updatesToApply) {
    try {
      const updatePayload: any = {
        menuOrder: update.newMenuOrder,
      };
      if (update.oldParent !== update.newParent) {
        updatePayload.parent = update.newParent;
      }

      const remoteRes = await sendSignedWordPressRequest(
        connection.siteUrl,
        `/pages/${update.pageId}`,
        "PATCH",
        connection.apiKeyHash,
        updatePayload
      );

      if (remoteRes?.success === false || remoteRes?.error) {
        throw new Error(remoteRes?.error?.message || `Failed to update page ${update.pageId}`);
      }

      appliedUpdates.push(update);
    } catch (err: any) {
      console.error(`Reorder batch update failed on page ${update.pageId}. Initiating rollback...`, err);

      // Rollback applied updates
      for (const applied of appliedUpdates) {
        try {
          const rollbackPayload: any = {
            menuOrder: applied.oldMenuOrder,
          };
          if (applied.oldParent !== applied.newParent) {
            rollbackPayload.parent = applied.oldParent;
          }
          await sendSignedWordPressRequest(
            connection.siteUrl,
            `/pages/${applied.pageId}`,
            "PATCH",
            connection.apiKeyHash,
            rollbackPayload
          );
        } catch (rollbackErr) {
          console.error(`Rollback failed for page ${applied.pageId}:`, rollbackErr);
        }
      }

      throw new AppError(
        "Failed to reorder WordPress pages. Multi-page remote updates were rolled back.",
        500,
        "WORDPRESS_PAGE_REORDER_FAILED"
      );
    }
  }

  // 9. Record Audit Log
  try {
    await recordAuditLog(userId, "WORDPRESS_PAGE_REORDERED", websiteId, {
      pageId,
      oldParentId,
      newParentId: targetParentId,
      position,
      targetPageId: targetPageId || null,
      affectedPageIds: updatesToApply.map((u) => u.pageId),
      status: "success",
    });
  } catch (auditErr) {}

  // 10. Fetch & Return Authoritative Refreshed List from WordPress
  return await listWordPressPages(websiteId, userId, { perPage: 100 });
}
