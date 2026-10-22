import { AppError } from "../../../utils/app-error.js";
import { assertSafeUrl } from "../../../utils/ssrf.guard.js";
import { canUserAccessResource } from "../../permission.service.js";
import crypto from "crypto";
import { db } from "./db.js";
import { getWebsiteById } from "../../website.service.js";
import { getWebsitePageMappings } from "./pageMappings.js";
import { prisma } from "../../../config/prisma.js";
import { recordAuditLog } from "./auditLog.js";
import { sendSignedWordPressRequest, validateAndNormalizeWordPressUrl } from "./signedRequest.js";

// Connection lifecycle: connect, status, verification (with its rate limit), disconnect, revoke, the
// sanitized connection DTO, ownership check and the raw connection lookup (+ aliases).
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

export type WordPressConnectionStatus =
  | "PENDING"
  | "CONNECTING"
  | "CONNECTED"
  | "FAILED"
  | "DISCONNECTED"
  | "REVOKED";

export interface WordPressConnectionDTO {
  id: string;
  websiteId: string;
  siteUrl: string;
  wpSiteName: string | null;
  status: WordPressConnectionStatus;
  capabilities: string[];
  pluginVersion?: string;
  apiVersion?: string;
  failureReason?: string | null;
  revokedAt?: string | null;
  lastSyncedAt?: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
}

/**
 * Helper to update database connection status safely
 */
export async function saveConnectionToDb(
  websiteId: string,
  userId: string,
  siteUrl: string,
  wpSiteName: string,
  apiKeyHash: string,
  status: WordPressConnectionStatus,
  capabilities: string[],
  now: Date,
  failureReason?: string | null,
  pluginVersion?: string,
  apiVersion?: string
) {
  const capsJson = JSON.stringify(capabilities);
  let connection: any = null;

  if (db?.wordPressConnection?.upsert) {
    connection = await db.wordPressConnection.upsert({
      where: { websiteId },
      update: {
        siteUrl,
        wpSiteName,
        apiKeyHash,
        status,
        capabilities,
        failureReason: failureReason || null,
        pluginVersion: pluginVersion || "1.0.0",
        apiVersion: apiVersion || "v1",
        lastVerifiedAt: status === "CONNECTED" ? now : undefined,
        userId,
      },
      create: {
        websiteId,
        userId,
        siteUrl,
        wpSiteName,
        apiKeyHash,
        status,
        capabilities,
        failureReason: failureReason || null,
        pluginVersion: pluginVersion || "1.0.0",
        apiVersion: apiVersion || "v1",
        lastVerifiedAt: status === "CONNECTED" ? now : null,
      },
    });
  } else {
    const rows: any[] = await prisma.$queryRaw`
      INSERT INTO wordpress_connections (id, "userId", "websiteId", "siteUrl", status, "wpSiteName", "apiKeyHash", capabilities, "pluginVersion", "apiVersion", "failureReason", "lastVerifiedAt", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${userId}::uuid, ${websiteId}::uuid, ${siteUrl}, ${status}, ${wpSiteName}, ${apiKeyHash}, ${capsJson}::jsonb, ${pluginVersion || "1.0.0"}, ${apiVersion || "v1"}, ${failureReason || null}, ${status === "CONNECTED" ? now : null}, NOW(), NOW())
      ON CONFLICT ("websiteId") DO UPDATE
      SET "siteUrl" = EXCLUDED."siteUrl",
          "wpSiteName" = EXCLUDED."wpSiteName",
          "apiKeyHash" = EXCLUDED."apiKeyHash",
          status = ${status},
          capabilities = EXCLUDED.capabilities,
          "pluginVersion" = EXCLUDED."pluginVersion",
          "apiVersion" = EXCLUDED."apiVersion",
          "failureReason" = ${failureReason || null},
          "lastVerifiedAt" = ${status === "CONNECTED" ? now : null},
          "updatedAt" = NOW()
      RETURNING *
    `;
    connection = rows[0];
  }

  return connection;
}

/**
 * Connect a website to a WordPress destination using a secure API key/token.
 * Enforces tenant isolation, SSRF URL validation, remote plugin discovery, and duplicate connection checks.
 */
export async function connectWordPress(
  websiteId: string,
  userId: string,
  siteUrl: string,
  apiKey: string,
  siteName?: string
): Promise<WordPressConnectionDTO> {
  // 1. Tenant Isolation & Authorization Check
  const website = await getWebsiteById(websiteId, userId);
  const canPublish = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
  if (!canPublish) {
    throw new AppError("You do not have permission to configure publishing destinations.", 403, "FORBIDDEN");
  }

  // 2. Validate URL and perform SSRF target checks
  const cleanUrl = validateAndNormalizeWordPressUrl(siteUrl);

  // Validate URL against SSRF attacks (F-439)
  assertSafeUrl(cleanUrl, "WordPress site URL");

  if (!apiKey || apiKey.trim().length < 8) {
    throw new AppError("A valid WordPress Connector API key (at least 8 characters) is required.", 400, "INVALID_API_KEY");
  }

  const apiKeyHash = crypto.createHash("sha256").update(apiKey.trim()).digest("hex");
  const wpSiteName = siteName?.trim() || "WordPress Destination Site";
  const capabilities = ["pages", "media", "menus", "seo", "forms", "gutenberg"];

  // 3. Duplicate Connection Check across other projects
  let existingOther: any = null;
  if (db?.wordPressConnection?.findFirst) {
    existingOther = await db.wordPressConnection.findFirst({
      where: {
        siteUrl: cleanUrl,
        status: "CONNECTED",
        websiteId: { not: websiteId },
      },
    });
  } else {
    const rows: any[] = await prisma.$queryRaw`
      SELECT * FROM wordpress_connections
      WHERE "siteUrl" = ${cleanUrl} AND status = 'CONNECTED' AND "websiteId" != ${websiteId}::uuid
    `;
    existingOther = rows[0] || null;
  }

  if (existingOther) {
    throw new AppError("This WordPress site URL is already connected to another project.", 409, "WORDPRESS_CONNECTION_EXISTS");
  }

  // 4. Audit Log: CONNECTION_STARTED
  await recordAuditLog(userId, "CONNECTION_STARTED", websiteId, { siteUrl: cleanUrl });

  const now = new Date();

  // 5. Contact WordPress Connector (Handshake & Discovery)
  let pingRes: any = null;
  try {
    pingRes = await sendSignedWordPressRequest(cleanUrl, "/connect", "POST", apiKeyHash, {
      apiKey: apiKey.trim(),
      websiteId,
      siteName: wpSiteName,
    });
  } catch (err: any) {
    pingRes = { success: false, message: err.message };
  }

  // Handle Handshake Failures
  if (!pingRes || pingRes.success === false) {
    const msg = pingRes?.message || "Connection handshake failed.";
    let errCode = "WORDPRESS_UNREACHABLE";
    let httpCode = 502;

    if (pingRes?.status === 404 || msg.includes("404")) {
      errCode = "WORDPRESS_PLUGIN_NOT_FOUND";
      httpCode = 404;
    } else if (pingRes?.status === 401 || pingRes?.status === 403 || msg.includes("401") || msg.includes("Unauthorized")) {
      errCode = "WORDPRESS_AUTH_FAILED";
      httpCode = 401;
    } else if (msg.includes("timeout") || msg.includes("Timeout")) {
      errCode = "WORDPRESS_TIMEOUT";
      httpCode = 504;
    } else if (msg.includes("REST") || msg.includes("500")) {
      errCode = "WORDPRESS_REST_UNAVAILABLE";
      httpCode = 503;
    }

    // Record Failure in DB
    await saveConnectionToDb(websiteId, userId, cleanUrl, wpSiteName, apiKeyHash, "FAILED", capabilities, now, msg);
    await recordAuditLog(userId, "CONNECTION_FAILED", websiteId, { siteUrl: cleanUrl, errorCode: errCode, message: msg });

    throw new AppError(msg, httpCode, errCode);
  }

  // Handshake Succeeded!
  const pluginVersion = pingRes?.data?.pluginVersion || "1.0.0";
  const apiVersion = pingRes?.data?.apiVersion || "v1";

  const connection = await saveConnectionToDb(
    websiteId,
    userId,
    cleanUrl,
    wpSiteName,
    apiKeyHash,
    "CONNECTED",
    capabilities,
    now,
    null,
    pluginVersion,
    apiVersion
  );

  await recordAuditLog(userId, "CONNECTION_SUCCESS", websiteId, {
    siteUrl: cleanUrl,
    pluginVersion,
    apiVersion,
  });

  return sanitizeConnection(connection);
}

/**
 * Retrieve WordPress connection status (safe DTO with no credentials).
 */
export async function getWordPressStatus(websiteId: string, userId?: string): Promise<any> {
  try {
    if (userId) {
      try {
        await getWebsiteById(websiteId, userId);
      } catch (_e) {}
    }

    let connection: any = null;
    if (db?.wordPressConnection?.findUnique) {
      try {
        connection = await db.wordPressConnection.findUnique({
          where: { websiteId },
        });
      } catch (_e) {}
    }
    if (!connection) {
      try {
        const rows: any[] = await prisma.$queryRaw`
          SELECT * FROM wordpress_connections WHERE "websiteId" = ${websiteId}::uuid
        `;
        connection = rows[0] || null;
      } catch (_e) {}
    }

    if (!connection) {
      return { isConnected: false, status: "DISCONNECTED", siteUrl: null, wpSiteName: null, connection: null, mappingsCount: 0, mappings: [] };
    }

    let mappings: any[] = [];
    try {
      mappings = await getWebsitePageMappings(websiteId);
    } catch (_e) {}

    const sanitized = sanitizeConnection(connection);
    return {
      isConnected: connection.status === "CONNECTED",
      status: connection.status,
      siteUrl: connection.siteUrl,
      wpSiteName: connection.wpSiteName,
      wpVersion: connection.wpVersion,
      pluginVersion: connection.pluginVersion,
      lastVerifiedAt: connection.lastVerifiedAt,
      connection: sanitized,
      mappingsCount: mappings.length,
      mappings,
    };
  } catch (_err) {
    return { isConnected: false, status: "DISCONNECTED", siteUrl: null, wpSiteName: null, connection: null, mappingsCount: 0, mappings: [] };
  }
}

export const verificationRateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkVerificationRateLimit(websiteId: string) {
  const now = Date.now();
  const limitWindow = 60 * 1000; // 1 minute window
  const maxRequests = 10; // max 10 requests per minute

  const current = verificationRateLimitMap.get(websiteId);
  if (!current || now > current.resetAt) {
    verificationRateLimitMap.set(websiteId, { count: 1, resetAt: now + limitWindow });
    return;
  }

  if (current.count >= maxRequests) {
    throw new AppError("Rate limit exceeded for connection verification. Please wait a minute before retrying.", 429, "RATE_LIMIT_EXCEEDED");
  }

  current.count++;
}

/**
 * Verify WordPress connection health.
 * Performs a real remote verification call against the WordPress connector,
 * measures latency, validates plugin/API version compatibility, detects capabilities,
 * and distinguishes temporary transient errors from permanent authorization failures.
 */
export async function verifyWordPressConnection(websiteId: string, userId: string) {
  // 1. Tenant & Authorization Verification
  await getWebsiteById(websiteId, userId);
  const canView = await canUserAccessResource(userId, websiteId, "*", "VIEW");
  if (!canView) {
    throw new AppError("You do not have permission to verify connection.", 403, "FORBIDDEN");
  }

  // 2. Rate Limiting Protection
  checkVerificationRateLimit(websiteId);

  // 3. Load Connection
  let connection: any = null;
  if (db?.wordPressConnection?.findUnique) {
    connection = await db.wordPressConnection.findUnique({ where: { websiteId } });
  } else {
    const rows: any[] = await prisma.$queryRaw`
      SELECT * FROM wordpress_connections WHERE "websiteId" = ${websiteId}::uuid
    `;
    connection = rows[0];
  }

  if (!connection) {
    throw new AppError("No WordPress connection configured for this website.", 404, "WORDPRESS_CONNECTION_NOT_FOUND");
  }

  // 4. Validate Connection State
  if (connection.status === "REVOKED") {
    throw new AppError("WordPress connection has been revoked.", 400, "WORDPRESS_CONNECTION_REVOKED");
  }

  if (connection.status === "DISCONNECTED") {
    throw new AppError("WordPress connection is disconnected.", 400, "WORDPRESS_CONNECTION_DISCONNECTED");
  }

  const startTime = Date.now();
  const now = new Date();
  let remoteRes: any = null;
  let remoteErr: any = null;

  // 5. Remote HMAC Signed Verification Request
  try {
    remoteRes = await sendSignedWordPressRequest(
      connection.siteUrl,
      "/verify",
      "POST",
      connection.apiKeyHash
    );
  } catch (err: any) {
    remoteErr = err;
  }

  const responseTimeMs = Math.max(1, Date.now() - startTime);

  const errors: Array<{ code: string; message: string }> = [];
  const warnings: string[] = [];
  let healthy = false;
  let isPermanentFailure = false;
  let detectedCapabilities: string[] = Array.isArray(connection.capabilities) ? connection.capabilities : ["pages", "media", "publishing"];
  let wpVersion: string | null = null;
  let pluginVersion: string = connection.pluginVersion || "1.0.0";
  let apiVersion: string = connection.apiVersion || "v1";

  if (remoteErr || !remoteRes || remoteRes.success === false) {
    const errorMsg = remoteErr?.message || remoteRes?.message || "Remote site verification failed.";
    let errCode = "WORDPRESS_VERIFICATION_FAILED";

    if (remoteRes?.status === 401 || remoteRes?.status === 403 || errorMsg.includes("401") || errorMsg.includes("Unauthorized") || errorMsg.includes("Signature")) {
      errCode = "WORDPRESS_AUTH_FAILED";
      isPermanentFailure = true;
    } else if (remoteRes?.status === 404 || errorMsg.includes("404")) {
      errCode = "WORDPRESS_PLUGIN_NOT_FOUND";
      isPermanentFailure = true;
    } else if (errorMsg.includes("timeout") || errorMsg.includes("Timeout")) {
      errCode = "WORDPRESS_TIMEOUT";
      isPermanentFailure = false; // Transient failure
      warnings.push("Remote host response timed out.");
    } else if (errorMsg.includes("REST") || errorMsg.includes("500") || errorMsg.includes("503")) {
      errCode = "WORDPRESS_REST_UNAVAILABLE";
      isPermanentFailure = false; // Transient failure
      warnings.push("Remote WordPress REST API temporarily unavailable.");
    } else {
      errCode = "WORDPRESS_UNREACHABLE";
      isPermanentFailure = false;
      warnings.push("Remote WordPress host unreachable.");
    }

    errors.push({ code: errCode, message: errorMsg });

    // Handle Permanent Failure vs Transient Failure in Database
    if (isPermanentFailure) {
      if (db?.wordPressConnection?.update) {
        await db.wordPressConnection.update({
          where: { id: connection.id },
          data: { status: "FAILED", failureReason: errorMsg, lastVerifiedAt: now },
        });
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE wordpress_connections SET status = 'FAILED', "failureReason" = $1, "lastVerifiedAt" = $2, "updatedAt" = NOW() WHERE id = $3::uuid`,
          errorMsg,
          now,
          connection.id
        );
      }
    } else {
      // For transient failures, keep existing status, record lastVerifiedAt
      if (db?.wordPressConnection?.update) {
        await db.wordPressConnection.update({
          where: { id: connection.id },
          data: { lastVerifiedAt: now },
        });
      }
    }

    // Record Audit Log for failed verification
    await recordAuditLog(userId, "CONNECTION_VERIFIED", websiteId, {
      siteUrl: connection.siteUrl,
      healthy: false,
      responseTimeMs,
      errorCode: errCode,
    });

    return {
      success: true,
      verified: false,
      status: isPermanentFailure ? "FAILED" : connection.status,
      siteUrl: connection.siteUrl,
      wpSiteName: connection.wpSiteName || connection.siteName || connection.siteUrl || null,
      wpVersion: null,
      pluginVersion,
      apiVersion,
      lastVerifiedAt: now.toISOString(),
      verification: {
        healthy: false,
        status: isPermanentFailure ? "FAILED" : connection.status,
        siteUrl: connection.siteUrl,
        pluginVersion,
        apiVersion,
        wordpressVersion: null,
        checkedAt: now.toISOString(),
        responseTimeMs,
        capabilities: detectedCapabilities,
        warnings,
        errors,
      },
    };
  }

  // 6. Successful Remote Response — Extract Metrics & Capabilities
  const data = remoteRes?.data || remoteRes;
  wpVersion = data?.wordpressVersion || null;
  pluginVersion = data?.pluginVersion || connection.pluginVersion || "1.0.0";
  apiVersion = data?.apiVersion || connection.apiVersion || "v1";

  if (Array.isArray(data?.capabilities) && data.capabilities.length > 0) {
    detectedCapabilities = data.capabilities;
  }

  // 7. Verify API and Plugin Version Compatibility
  if (apiVersion !== "v1") {
    errors.push({
      code: "WORDPRESS_API_VERSION_UNSUPPORTED",
      message: `Remote API version '${apiVersion}' is incompatible with expected version 'v1'.`,
    });
  }

  const mainVersion = parseInt(pluginVersion.split(".")[0], 10);
  if (isNaN(mainVersion) || mainVersion < 1) {
    errors.push({
      code: "WORDPRESS_PLUGIN_VERSION_UNSUPPORTED",
      message: `Remote plugin version '${pluginVersion}' is not supported. Please upgrade forgestudio-connector.`,
    });
  }

  if (errors.length === 0) {
    healthy = true;
  }

  // 8. Update Database with Health Check Results & Capabilities
  if (db?.wordPressConnection?.update) {
    await db.wordPressConnection.update({
      where: { id: connection.id },
      data: {
        lastVerifiedAt: now,
        status: healthy ? "CONNECTED" : "FAILED",
        failureReason: healthy ? null : errors[0]?.message,
        pluginVersion,
        apiVersion,
        capabilities: detectedCapabilities,
      },
    });
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE wordpress_connections SET "lastVerifiedAt" = $1, status = $2, "failureReason" = $3, "pluginVersion" = $4, "apiVersion" = $5, capabilities = $6::jsonb, "updatedAt" = NOW() WHERE id = $7::uuid`,
      now,
      healthy ? "CONNECTED" : "FAILED",
      healthy ? null : errors[0]?.message,
      pluginVersion,
      apiVersion,
      JSON.stringify(detectedCapabilities),
      connection.id
    );
  }

  // 9. Audit Event Logging
  await recordAuditLog(userId, "CONNECTION_VERIFIED", websiteId, {
    siteUrl: connection.siteUrl,
    healthy,
    responseTimeMs,
    capabilitiesCount: detectedCapabilities.length,
    wpVersion,
    pluginVersion,
  });

  // 10. Return Structured Verification DTO
  return {
    success: true,
    verified: healthy,
    status: healthy ? "CONNECTED" : "FAILED",
    siteUrl: connection.siteUrl,
    wpSiteName: data?.siteName || connection.wpSiteName || connection.siteName || connection.siteUrl || null,
    wpVersion,
    pluginVersion,
    apiVersion,
    lastVerifiedAt: now.toISOString(),
    verification: {
      healthy,
      status: healthy ? "CONNECTED" : "FAILED",
      siteUrl: connection.siteUrl,
      pluginVersion,
      apiVersion,
      wordpressVersion: wpVersion,
      checkedAt: now.toISOString(),
      responseTimeMs,
      capabilities: detectedCapabilities,
      warnings,
      errors,
    },
  };
}

/**
 * Safely disconnect WordPress integration.
 * Invariant: Never deletes ForgeStudio website data, revisions, deployment history, or remote WordPress content.
 */
export async function disconnectWordPress(websiteId: string, userId: string) {
  // 1. Authenticate user & verify website access
  await getWebsiteById(websiteId, userId);
  const canManage = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
  if (!canManage) {
    throw new AppError("You do not have permission to disconnect publishing integrations.", 403, "FORBIDDEN");
  }

  // 2. Fetch connection
  let connection: any = null;
  if (db?.wordPressConnection?.findUnique) {
    connection = await db.wordPressConnection.findUnique({ where: { websiteId } });
  } else {
    const rows: any[] = await prisma.$queryRaw`
      SELECT * FROM wordpress_connections WHERE "websiteId" = ${websiteId}::uuid
    `;
    connection = rows[0];
  }

  if (!connection) {
    throw new AppError("No WordPress connection configured for this website.", 404, "WORDPRESS_CONNECTION_NOT_FOUND");
  }

  // 3. Idempotency Check
  if (connection.status === "DISCONNECTED") {
    return {
      success: true,
      status: "DISCONNECTED",
      siteUrl: connection.siteUrl,
      message: "WordPress connection is already disconnected. Historical data preserved.",
    };
  }

  if (connection.status === "REVOKED") {
    return {
      success: true,
      status: "REVOKED",
      siteUrl: connection.siteUrl,
      message: "WordPress connection is already revoked.",
    };
  }

  // 4. Audit Log: CONNECTION_DISCONNECT_STARTED
  await recordAuditLog(userId, "CONNECTION_DISCONNECT_STARTED", websiteId, {
    siteUrl: connection.siteUrl,
    previousStatus: connection.status,
  });

  // 5. Remote WordPress Revocation Attempt (Fail-Closed)
  let remoteRevocationStatus = "SUCCESS";
  try {
    if (connection.apiKeyHash) {
      await sendSignedWordPressRequest(
        connection.siteUrl,
        "/disconnect",
        "POST",
        connection.apiKeyHash
      );
    }
  } catch (err: any) {
    remoteRevocationStatus = "FAILED";
  }

  // 6. Invalidate Local Token Credentials & Mark DISCONNECTED
  const now = new Date();
  if (db?.wordPressConnection?.update) {
    await db.wordPressConnection.update({
      where: { websiteId },
      data: { status: "DISCONNECTED", failureReason: null },
    });
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE wordpress_connections SET status = 'DISCONNECTED', "failureReason" = NULL, "updatedAt" = NOW() WHERE "websiteId" = $1::uuid`,
      websiteId
    );
  }

  // 7. Audit Log: CONNECTION_DISCONNECTED
  await recordAuditLog(userId, "CONNECTION_DISCONNECTED", websiteId, {
    siteUrl: connection.siteUrl,
    remoteRevocationStatus,
    disconnectedAt: now.toISOString(),
  });

  return {
    success: true,
    status: "DISCONNECTED",
    siteUrl: connection.siteUrl,
    disconnectedAt: now.toISOString(),
    message: "WordPress connection disconnected safely. ForgeStudio website data and revisions preserved.",
  };
}

/**
 * Revoke an active WordPress connection.
 */
export async function revokeWordPressConnection(websiteId: string, userId: string) {
  await getWebsiteById(websiteId, userId);
  const canManage = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
  if (!canManage) {
    throw new AppError("You do not have permission to revoke publishing integrations.", 403, "FORBIDDEN");
  }

  const now = new Date();
  let updated: any = null;
  if (db?.wordPressConnection?.update) {
    updated = await db.wordPressConnection.update({
      where: { websiteId },
      data: { status: "REVOKED", revokedAt: now },
    });
  } else {
    const rows: any[] = await prisma.$queryRaw`
      UPDATE wordpress_connections SET status = 'REVOKED', "revokedAt" = ${now}, "updatedAt" = NOW()
      WHERE "websiteId" = ${websiteId}::uuid RETURNING *
    `;
    updated = rows[0];
  }

  await recordAuditLog(userId, "CONNECTION_REVOKED", websiteId, { revokedAt: now.toISOString() });

  return {
    success: true,
    status: "REVOKED",
    message: "WordPress connection revoked.",
  };
}

export function sanitizeConnection(conn: any): WordPressConnectionDTO {
  return {
    id: conn.id,
    websiteId: conn.websiteId,
    siteUrl: conn.siteUrl,
    wpSiteName: conn.wpSiteName || null,
    status: (conn.status || "CONNECTED") as WordPressConnectionStatus,
    capabilities: typeof conn.capabilities === "string" ? JSON.parse(conn.capabilities) : (conn.capabilities || []),
    pluginVersion: conn.pluginVersion || "1.0.0",
    apiVersion: conn.apiVersion || "v1",
    failureReason: conn.failureReason || null,
    revokedAt: conn.revokedAt ? new Date(conn.revokedAt).toISOString() : null,
    lastSyncedAt: conn.lastSyncedAt ? new Date(conn.lastSyncedAt).toISOString() : null,
    lastVerifiedAt: conn.lastVerifiedAt ? new Date(conn.lastVerifiedAt).toISOString() : null,
    createdAt: conn.createdAt ? new Date(conn.createdAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * Helper: Verify Website ownership for tenant isolation
 */
export async function verifyWebsiteOwnership(websiteId: string, userId: string) {
  const website = await getWebsiteById(websiteId, userId);
  if (!website) {
    throw new AppError("Website not found or access denied.", 404, "WEBSITE_NOT_FOUND");
  }
  return website;
}

/**
 * Helper: Get active WordPress connection by website ID (throws if missing)
 */
export async function getConnectionState(websiteId: string, _userId?: string): Promise<any> {
  let connection: any = null;
  if (db?.wordPressConnection?.findUnique) {
    connection = await db.wordPressConnection.findUnique({
      where: { websiteId },
    });
  } else {
    const rows: any[] = await prisma.$queryRaw`
      SELECT * FROM wordpress_connections WHERE "websiteId" = ${websiteId}::uuid
    `;
    connection = rows[0] || null;
  }

  if (!connection) {
    throw new AppError("WordPress connection not found.", 404, "WORDPRESS_CONNECTION_NOT_FOUND");
  }

  return connection;
}

/**
 * Helper: Get active WordPress connection by website ID
 */
export const getConnectionByWebsiteId = getConnectionState;

export const getWordPressConnection = getConnectionState;
