import { AppError } from "../../../utils/app-error.js";
import { canUserAccessResource } from "../../permission.service.js";
import { getConnectionByWebsiteId } from "./connection.js";
import { getWebsiteById } from "../../website.service.js";
import path from "path";
import { recordAuditLog } from "./auditLog.js";
import { sendSignedWordPressRequest } from "./signedRequest.js";

// WordPress media: file validation, upload, list, read, metadata update and delete.
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

export interface WordPressMediaDTO {
  id: number;
  title: string;
  filename: string;
  mimeType: string;
  url: string;
  sourceUrl?: string;
  date?: string;
  modified?: string;
  width?: number;
  height?: number;
  filesize?: number;
  altText?: string;
  caption?: string;
  description?: string;
  author?: number | null;
  status?: string;
}

export interface UploadWordPressMediaOptions {
  title?: string;
  altText?: string;
  caption?: string;
  description?: string;
}

/**
 * Validate file payload: size, magic bytes signature, path traversal, extension allowlist
 */
export function validateMediaFile(fileBuffer: Buffer, originalFilename: string, declaredMimeType: string): string {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  if (!fileBuffer || fileBuffer.length === 0) {
    throw new AppError("Media file is empty.", 400, "WORDPRESS_MEDIA_INVALID_FILE");
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new AppError("File size exceeds maximum allowed limit of 10MB.", 400, "WORDPRESS_MEDIA_FILE_TOO_LARGE");
  }

  // Sanitization against path traversal and null byte injection
  if (originalFilename.includes("..") || originalFilename.includes("\0") || /[\/\\]/.test(originalFilename)) {
    throw new AppError("Invalid or dangerous filename detected.", 400, "WORDPRESS_MEDIA_INVALID_FILE");
  }

  const cleanFilename = path.basename(originalFilename).replace(/[\0\r\n\t]/g, "").trim();
  const extMatch = cleanFilename.lastIndexOf(".");
  if (extMatch === -1) {
    throw new AppError("File missing extension.", 400, "WORDPRESS_MEDIA_UNSUPPORTED_TYPE");
  }

  const ext = cleanFilename.substring(extMatch + 1).toLowerCase();
  const allowedExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "pdf"]);
  const dangerousExtensions = new Set(["php", "phtml", "php3", "php4", "php5", "phps", "phar", "exe", "sh", "bat", "cmd", "js", "html", "htm", "svg"]);

  if (dangerousExtensions.has(ext) || !allowedExtensions.has(ext)) {
    throw new AppError(`File type '.${ext}' is not supported or disallowed. Allowed: JPG, PNG, GIF, WEBP, PDF.`, 400, "WORDPRESS_MEDIA_UNSUPPORTED_TYPE");
  }

  // Magic Byte / Signature Validation
  if (ext === "jpg" || ext === "jpeg") {
    if (fileBuffer.length < 3 || fileBuffer[0] !== 0xFF || fileBuffer[1] !== 0xD8 || fileBuffer[2] !== 0xFF) {
      throw new AppError("File content signature does not match JPEG format.", 400, "WORDPRESS_MEDIA_INVALID_FILE");
    }
  } else if (ext === "png") {
    if (fileBuffer.length < 4 || fileBuffer[0] !== 0x89 || fileBuffer[1] !== 0x50 || fileBuffer[2] !== 0x4E || fileBuffer[3] !== 0x47) {
      throw new AppError("File content signature does not match PNG format.", 400, "WORDPRESS_MEDIA_INVALID_FILE");
    }
  } else if (ext === "gif") {
    if (fileBuffer.length < 3 || fileBuffer[0] !== 0x47 || fileBuffer[1] !== 0x49 || fileBuffer[2] !== 0x46) {
      throw new AppError("File content signature does not match GIF format.", 400, "WORDPRESS_MEDIA_INVALID_FILE");
    }
  } else if (ext === "webp") {
    const riff = fileBuffer.subarray(0, 4).toString("utf8");
    const webp = fileBuffer.subarray(8, 12).toString("utf8");
    if (riff !== "RIFF" || webp !== "WEBP") {
      throw new AppError("File content signature does not match WEBP format.", 400, "WORDPRESS_MEDIA_INVALID_FILE");
    }
  } else if (ext === "pdf") {
    const pdfHeader = fileBuffer.subarray(0, 4).toString("utf8");
    if (pdfHeader !== "%PDF") {
      throw new AppError("File content signature does not match PDF format.", 400, "WORDPRESS_MEDIA_INVALID_FILE");
    }
  }

  return cleanFilename;
}

/**
 * Upload Media to WordPress Media Library (F-493)
 */
export async function uploadWordPressMedia(
  websiteId: string,
  userId: string,
  fileBuffer: Buffer,
  originalFilename: string,
  declaredMimeType: string,
  options?: UploadWordPressMediaOptions
): Promise<WordPressMediaDTO> {
  // 1. Tenant & Website Ownership Check
  const website = await getWebsiteById(websiteId, userId);

  // 2. RBAC Capability Check (Requires EDIT capability)
  const canEdit = await canUserAccessResource(userId, websiteId, "*", "EDIT");
  if (!canEdit) {
    throw new AppError("You do not have permission to upload media to WordPress.", 403, "WORDPRESS_MEDIA_PERMISSION_DENIED");
  }

  // 3. Connection & Fail-Closed State Check
  const connection = await getConnectionByWebsiteId(websiteId);
  if (!connection || connection.status !== "CONNECTED") {
    throw new AppError("WordPress site is not connected or authorization was revoked.", 400, "WORDPRESS_MEDIA_NOT_CONNECTED");
  }

  // 4. Input File Security & Signature Validation
  const sanitizedFilename = validateMediaFile(fileBuffer, originalFilename, declaredMimeType);

  // 5. Build Remote Payload
  const base64Data = fileBuffer.toString("base64");
  const payload = {
    filename: sanitizedFilename,
    mimeType: declaredMimeType,
    base64Data,
    title: options?.title || path.basename(sanitizedFilename, path.extname(sanitizedFilename)),
    altText: options?.altText || "",
    caption: options?.caption || "",
    description: options?.description || "",
  };

  // 6. Send Signed Request to Remote WordPress Connector API
  const res = await sendSignedWordPressRequest(
    connection.siteUrl,
    "/media",
    "POST",
    connection.apiKeyHash,
    payload
  );

  if (!res || !res.success || !res.data) {
    const errorCode = res?.error?.code || "WORDPRESS_MEDIA_UPLOAD_FAILED";
    const errorMsg = res?.error?.message || res?.message || "Failed to upload media to WordPress Media Library.";
    throw new AppError(errorMsg, 400, errorCode);
  }

  const mediaDTO: WordPressMediaDTO = {
    id: res.data.id,
    title: res.data.title || payload.title,
    filename: res.data.filename || sanitizedFilename,
    mimeType: res.data.mimeType || declaredMimeType,
    url: res.data.url,
    sourceUrl: res.data.sourceUrl || res.data.url,
    date: res.data.date,
    modified: res.data.modified,
    width: res.data.width,
    height: res.data.height,
    filesize: res.data.filesize || fileBuffer.length,
    altText: res.data.altText,
    caption: res.data.caption,
    description: res.data.description,
  };

  // 7. Audit Logging
  try {
    await recordAuditLog(userId, "WORDPRESS_MEDIA_UPLOADED", websiteId, {
      wordpressMediaId: mediaDTO.id,
      mimeType: mediaDTO.mimeType,
      fileSize: mediaDTO.filesize,
      filename: mediaDTO.filename,
      status: "SUCCESS",
    });
  } catch (auditErr) {}

  return mediaDTO;
}

export interface ListWordPressMediaOptions {
  page?: number;
  perPage?: number;
  search?: string;
  mimeType?: string;
  mediaType?: "image" | "document" | "all";
  order?: "ASC" | "DESC";
  orderby?: "date" | "modified" | "title" | "filename";
}

export interface PaginatedWordPressMediaDTO {
  items: WordPressMediaDTO[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface UpdateWordPressMediaMetadataInput {
  title?: string;
  altText?: string;
  caption?: string;
  description?: string;
}

/**
 * F-494: List WordPress Media with search, filter, sort, pagination
 */
export async function listWordPressMedia(
  websiteId: string,
  userId: string,
  options?: ListWordPressMediaOptions
): Promise<PaginatedWordPressMediaDTO> {
  // 1. Tenant & Website Ownership Check
  const website = await getWebsiteById(websiteId, userId);

  // 2. RBAC Capability Check (Requires VIEW capability)
  const canView = await canUserAccessResource(userId, websiteId, "*", "VIEW");
  if (!canView) {
    throw new AppError("You do not have permission to view WordPress media.", 403, "WORDPRESS_MEDIA_PERMISSION_DENIED");
  }

  // 3. Connection State Check (Fail closed)
  const connection = await getConnectionByWebsiteId(websiteId);
  if (!connection || connection.status !== "CONNECTED") {
    throw new AppError("WordPress site is not connected or authorization was revoked.", 400, "WORDPRESS_MEDIA_NOT_CONNECTED");
  }

  // 4. Sanitize and Bound Query Parameters
  const page = Math.max(1, options?.page || 1);
  const perPage = Math.min(100, Math.max(1, options?.perPage || 20));
  const search = options?.search ? options.search.trim().substring(0, 100) : "";
  const mimeType = options?.mimeType || "";
  const mediaType = options?.mediaType || "all";
  const order = options?.order === "ASC" ? "ASC" : "DESC";

  const orderbyAllowlist: ("date" | "modified" | "title" | "filename")[] = ["date", "modified", "title", "filename"];
  const orderby = orderbyAllowlist.includes(options?.orderby as any) ? options!.orderby! : "date";

  // Build query parameter string for remote endpoint
  const queryParams = new URLSearchParams();
  queryParams.set("page", page.toString());
  queryParams.set("perPage", perPage.toString());
  if (search) queryParams.set("search", search);
  if (mimeType) queryParams.set("mimeType", mimeType);
  if (mediaType && mediaType !== "all") queryParams.set("mediaType", mediaType);
  queryParams.set("order", order);
  queryParams.set("orderby", orderby);

  const endpoint = `/media?${queryParams.toString()}`;

  // 5. Send Signed Request
  const res = await sendSignedWordPressRequest(
    connection.siteUrl,
    endpoint,
    "GET",
    connection.apiKeyHash
  );

  if (!res || !res.success || !res.data) {
    const errorCode = res?.error?.code || "WORDPRESS_MEDIA_LIST_FAILED";
    const errorMsg = res?.error?.message || res?.message || "Failed to retrieve media library from WordPress.";
    throw new AppError(errorMsg, 400, errorCode);
  }

  const items: WordPressMediaDTO[] = (res.data.items || []).map((item: any) => ({
    id: item.id,
    title: item.title || "",
    filename: item.filename || "",
    mimeType: item.mimeType || "application/octet-stream",
    url: item.url || "",
    sourceUrl: item.sourceUrl || item.url || "",
    date: item.date,
    modified: item.modified,
    width: item.width,
    height: item.height,
    filesize: item.filesize,
    altText: item.altText || "",
    caption: item.caption || "",
    description: item.description || "",
    author: item.author,
    status: item.status,
  }));

  const result: PaginatedWordPressMediaDTO = {
    items,
    pagination: {
      page: res.data.pagination?.page || page,
      perPage: res.data.pagination?.perPage || perPage,
      total: res.data.pagination?.total || items.length,
      totalPages: res.data.pagination?.totalPages || 1,
    },
  };

  // 6. Audit Logging
  try {
    await recordAuditLog(userId, "WORDPRESS_MEDIA_LISTED", websiteId, {
      page,
      perPage,
      itemCount: items.length,
      status: "SUCCESS",
    });
  } catch (auditErr) {}

  return result;
}

/**
 * F-494: Get Single WordPress Media Details
 */
export async function getWordPressMedia(
  websiteId: string,
  userId: string,
  mediaId: number
): Promise<WordPressMediaDTO> {
  if (!mediaId || isNaN(mediaId) || mediaId <= 0) {
    throw new AppError("Invalid media ID.", 400, "WORDPRESS_MEDIA_INVALID_ID");
  }

  // 1. Tenant & Ownership Check
  const website = await getWebsiteById(websiteId, userId);

  // 2. RBAC Check
  const canView = await canUserAccessResource(userId, websiteId, "*", "VIEW");
  if (!canView) {
    throw new AppError("You do not have permission to view WordPress media details.", 403, "WORDPRESS_MEDIA_PERMISSION_DENIED");
  }

  // 3. Connection State Check
  const connection = await getConnectionByWebsiteId(websiteId);
  if (!connection || connection.status !== "CONNECTED") {
    throw new AppError("WordPress site is not connected or authorization was revoked.", 400, "WORDPRESS_MEDIA_NOT_CONNECTED");
  }

  // 4. Send Signed Request
  const res = await sendSignedWordPressRequest(
    connection.siteUrl,
    `/media/${mediaId}`,
    "GET",
    connection.apiKeyHash
  );

  if (!res || !res.success || !res.data) {
    if (res?.error?.code === "WORDPRESS_MEDIA_NOT_FOUND" || res?.status === 404) {
      throw new AppError(`WordPress media attachment ID ${mediaId} not found.`, 404, "WORDPRESS_MEDIA_NOT_FOUND");
    }
    const errorCode = res?.error?.code || "WORDPRESS_MEDIA_FETCH_FAILED";
    const errorMsg = res?.error?.message || res?.message || `Failed to fetch WordPress media ID ${mediaId}.`;
    throw new AppError(errorMsg, 400, errorCode);
  }

  const mediaDTO: WordPressMediaDTO = {
    id: res.data.id,
    title: res.data.title || "",
    filename: res.data.filename || "",
    mimeType: res.data.mimeType || "application/octet-stream",
    url: res.data.url || "",
    sourceUrl: res.data.sourceUrl || res.data.url || "",
    date: res.data.date,
    modified: res.data.modified,
    width: res.data.width,
    height: res.data.height,
    filesize: res.data.filesize,
    altText: res.data.altText || "",
    caption: res.data.caption || "",
    description: res.data.description || "",
    author: res.data.author,
    status: res.data.status,
  };

  try {
    await recordAuditLog(userId, "WORDPRESS_MEDIA_VIEWED", websiteId, {
      wordpressMediaId: mediaId,
      status: "SUCCESS",
    });
  } catch (auditErr) {}

  return mediaDTO;
}

/**
 * F-494: Update WordPress Media Metadata (Title, Alt Text, Caption, Description)
 */
export async function updateWordPressMedia(
  websiteId: string,
  userId: string,
  mediaId: number,
  data: UpdateWordPressMediaMetadataInput
): Promise<WordPressMediaDTO> {
  if (!mediaId || isNaN(mediaId) || mediaId <= 0) {
    throw new AppError("Invalid media ID.", 400, "WORDPRESS_MEDIA_INVALID_ID");
  }

  // 1. Tenant & Ownership Check
  const website = await getWebsiteById(websiteId, userId);

  // 2. RBAC Capability Check (Requires EDIT)
  const canEdit = await canUserAccessResource(userId, websiteId, "*", "EDIT");
  if (!canEdit) {
    throw new AppError("You do not have permission to edit WordPress media metadata.", 403, "WORDPRESS_MEDIA_PERMISSION_DENIED");
  }

  // 3. Connection State Check
  const connection = await getConnectionByWebsiteId(websiteId);
  if (!connection || connection.status !== "CONNECTED") {
    throw new AppError("WordPress site is not connected or authorization was revoked.", 400, "WORDPRESS_MEDIA_NOT_CONNECTED");
  }

  // 4. Sanitize and Build Allowlisted Payload
  const payload: Record<string, string> = {};
  if (data.title !== undefined) payload.title = data.title.trim();
  if (data.altText !== undefined) payload.altText = data.altText.trim();
  if (data.caption !== undefined) payload.caption = data.caption.trim();
  if (data.description !== undefined) payload.description = data.description.trim();

  // 5. Send Signed Request
  const res = await sendSignedWordPressRequest(
    connection.siteUrl,
    `/media/${mediaId}`,
    "PUT",
    connection.apiKeyHash,
    payload
  );

  if (!res || !res.success || !res.data) {
    if (res?.error?.code === "WORDPRESS_MEDIA_NOT_FOUND" || res?.status === 404) {
      throw new AppError(`WordPress media attachment ID ${mediaId} not found.`, 404, "WORDPRESS_MEDIA_NOT_FOUND");
    }
    const errorCode = res?.error?.code || "WORDPRESS_MEDIA_UPDATE_FAILED";
    const errorMsg = res?.error?.message || res?.message || `Failed to update media ID ${mediaId}.`;
    throw new AppError(errorMsg, 400, errorCode);
  }

  const updatedDTO: WordPressMediaDTO = {
    id: res.data.id,
    title: res.data.title || "",
    filename: res.data.filename || "",
    mimeType: res.data.mimeType || "application/octet-stream",
    url: res.data.url || "",
    sourceUrl: res.data.sourceUrl || res.data.url || "",
    date: res.data.date,
    modified: res.data.modified,
    width: res.data.width,
    height: res.data.height,
    filesize: res.data.filesize,
    altText: res.data.altText || "",
    caption: res.data.caption || "",
    description: res.data.description || "",
    author: res.data.author,
    status: res.data.status,
  };

  // 6. Audit Logging
  try {
    await recordAuditLog(userId, "WORDPRESS_MEDIA_UPDATED", websiteId, {
      wordpressMediaId: mediaId,
      changedFields: Object.keys(payload),
      status: "SUCCESS",
    });
  } catch (auditErr) {}

  return updatedDTO;
}

/**
 * F-494: Delete WordPress Media Attachment (Trash or Permanent Delete)
 */
export async function deleteWordPressMedia(
  websiteId: string,
  userId: string,
  mediaId: number,
  options?: { force?: boolean }
): Promise<{ deleted: boolean; id: number; force: boolean }> {
  if (!mediaId || isNaN(mediaId) || mediaId <= 0) {
    throw new AppError("Invalid media ID.", 400, "WORDPRESS_MEDIA_INVALID_ID");
  }

  // 1. Tenant & Ownership Check
  const website = await getWebsiteById(websiteId, userId);

  // 2. RBAC Capability Check (Requires DELETE)
  const canDelete = await canUserAccessResource(userId, websiteId, "*", "DELETE");
  if (!canDelete) {
    throw new AppError("You do not have permission to delete WordPress media.", 403, "WORDPRESS_MEDIA_PERMISSION_DENIED");
  }

  // 3. Connection State Check
  const connection = await getConnectionByWebsiteId(websiteId);
  if (!connection || connection.status !== "CONNECTED") {
    throw new AppError("WordPress site is not connected or authorization was revoked.", 400, "WORDPRESS_MEDIA_NOT_CONNECTED");
  }

  const force = options?.force === true;

  // 4. Send Signed Request
  const res = await sendSignedWordPressRequest(
    connection.siteUrl,
    `/media/${mediaId}?force=${force}`,
    "DELETE",
    connection.apiKeyHash
  );

  if (!res || !res.success) {
    if (res?.error?.code === "WORDPRESS_MEDIA_NOT_FOUND" || res?.status === 404) {
      throw new AppError(`WordPress media attachment ID ${mediaId} not found.`, 404, "WORDPRESS_MEDIA_NOT_FOUND");
    }
    const errorCode = res?.error?.code || "WORDPRESS_MEDIA_DELETE_FAILED";
    const errorMsg = res?.error?.message || res?.message || `Failed to delete media ID ${mediaId}.`;
    throw new AppError(errorMsg, 400, errorCode);
  }

  // 5. Audit Logging
  try {
    await recordAuditLog(userId, "WORDPRESS_MEDIA_DELETED", websiteId, {
      wordpressMediaId: mediaId,
      force,
      status: "SUCCESS",
    });
  } catch (auditErr) {}

  return {
    deleted: true,
    id: mediaId,
    force,
  };
}
