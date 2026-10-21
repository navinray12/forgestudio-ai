import { AppError } from "../../../utils/app-error.js";
import { canUserAccessResource } from "../../permission.service.js";
import { db } from "./db.js";
import { getWebsiteById } from "../../website.service.js";
import { prisma } from "../../../config/prisma.js";
import { recordAuditLog } from "./auditLog.js";
import { sendSignedWordPressRequest } from "./signedRequest.js";

// Site information and site health diagnostics.
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

export interface WordPressSiteInfoDTO {
  success: boolean;
  general: {
    siteUrl: string;
    homeUrl: string;
    wordpressVersion: string;
    locale: string;
    language: string;
    timezone: string;
    restApiStatus: "AVAILABLE" | "UNAVAILABLE";
    multisiteStatus: "SINGLE_SITE" | "MULTISITE" | "UNKNOWN";
  };
  connector: {
    connectorVersion: string;
    apiVersion: string;
    status: string;
    lastVerifiedAt: string | null;
    lastSyncedAt: string | null;
    responseTimeMs: number;
  };
  theme: {
    name: string;
    version: string;
    themeType: "BLOCK" | "CLASSIC" | "UNKNOWN";
    parentTheme: string | null;
  };
  capabilities: string[];
  retrievedAt: string;
}

/**
 * F-488: Site Information Engine
 * Retrieves verified technical site information from the connected WordPress installation.
 */
export async function getWordPressSiteInformation(websiteId: string, userId: string): Promise<WordPressSiteInfoDTO> {
  // 1. Authenticate user & check website access
  await getWebsiteById(websiteId, userId);
  const canView = await canUserAccessResource(userId, websiteId, "*", "VIEW");
  if (!canView) {
    throw new AppError("You do not have permission to view site information.", 403, "FORBIDDEN");
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

  // 3. Connection State Check (Fail-closed for DISCONNECTED or REVOKED)
  if (connection.status === "REVOKED") {
    throw new AppError("WordPress connection has been revoked.", 400, "WORDPRESS_CONNECTION_REVOKED");
  }

  if (connection.status === "DISCONNECTED") {
    throw new AppError("WordPress connection is disconnected.", 400, "WORDPRESS_CONNECTION_DISCONNECTED");
  }

  // 4. Remote GET /site-info request with high-precision latency measurement
  const startTime = Date.now();
  let remoteRes: any = null;
  try {
    remoteRes = await sendSignedWordPressRequest(
      connection.siteUrl,
      "/site-info",
      "GET",
      connection.apiKeyHash
    );
  } catch (err: any) {
    // Fallback attempt to GET /status if /site-info isn't available on older plugin versions
    try {
      remoteRes = await sendSignedWordPressRequest(
        connection.siteUrl,
        "/status",
        "GET",
        connection.apiKeyHash
      );
    } catch (fallbackErr: any) {
      throw new AppError(`Failed to retrieve site information from WordPress: ${err.message}`, 502, "WORDPRESS_SITE_UNREACHABLE");
    }
  }
  const responseTimeMs = Date.now() - startTime;

  // 5. Validate & Sanitize Remote Response
  const rawData = remoteRes?.data || remoteRes || {};
  const general = rawData.general || {};
  const connectorMeta = rawData.connector || {};
  const theme = rawData.theme || {};

  // Sanitize Site URL
  let verifiedSiteUrl = connection.siteUrl;
  try {
    const rawUrl = general.siteUrl || connection.siteUrl;
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      verifiedSiteUrl = parsed.origin + parsed.pathname.replace(/\/$/, "");
    }
  } catch (e) {}

  let verifiedHomeUrl = verifiedSiteUrl;
  try {
    const rawHome = general.homeUrl || verifiedSiteUrl;
    const parsed = new URL(rawHome);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      verifiedHomeUrl = parsed.origin + parsed.pathname.replace(/\/$/, "");
    }
  } catch (e) {}

  const wpVersion = typeof general.wordpressVersion === "string" ? general.wordpressVersion : (rawData.wordpressVersion || "WordPress 6.x");
  const locale = typeof general.locale === "string" ? general.locale : "en_US";
  const language = typeof general.language === "string" ? general.language : "English";
  const timezone = typeof general.timezone === "string" ? general.timezone : "UTC+00:00";
  const restApiStatus = general.restApiStatus === "UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";
  const multisiteStatus = general.multisiteStatus === "MULTISITE" ? "MULTISITE" : (general.multisiteStatus === "SINGLE_SITE" ? "SINGLE_SITE" : "SINGLE_SITE");

  const connectorVersion = connectorMeta.connectorVersion || rawData.pluginVersion || connection.pluginVersion || "1.0.0";
  const apiVersion = connectorMeta.apiVersion || rawData.apiVersion || connection.apiVersion || "v1";
  const connectionStatus = connection.status || "CONNECTED";
  const lastVerifiedAt = connection.lastVerifiedAt ? new Date(connection.lastVerifiedAt).toISOString() : new Date().toISOString();
  const lastSyncedAt = connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toISOString() : null;

  const themeName = typeof theme.name === "string" ? theme.name : "Active Theme";
  const themeVersion = typeof theme.version === "string" ? theme.version : "1.0.0";
  const themeType = theme.themeType === "BLOCK" ? "BLOCK" : (theme.themeType === "CLASSIC" ? "CLASSIC" : "CLASSIC");
  const parentTheme = typeof theme.parentTheme === "string" ? theme.parentTheme : null;

  const rawCaps = Array.isArray(rawData.capabilities) ? rawData.capabilities : (Array.isArray(general.capabilities) ? general.capabilities : ["pages", "media", "publishing", "gutenberg", "webhooks", "menus"]);
  const safeCapabilities: string[] = Array.from(new Set(rawCaps.filter((c: any) => typeof c === "string"))) as string[];

  return {
    success: true,
    general: {
      siteUrl: verifiedSiteUrl,
      homeUrl: verifiedHomeUrl,
      wordpressVersion: wpVersion,
      locale,
      language,
      timezone,
      restApiStatus,
      multisiteStatus,
    },
    connector: {
      connectorVersion,
      apiVersion,
      status: connectionStatus,
      lastVerifiedAt,
      lastSyncedAt,
      responseTimeMs,
    },
    theme: {
      name: themeName,
      version: themeVersion,
      themeType,
      parentTheme,
    },
    capabilities: safeCapabilities,
    retrievedAt: new Date().toISOString(),
  };
}

export interface WordPressSiteHealthDTO {
  success: boolean;
  overallStatus: "HEALTHY" | "WARNING" | "CRITICAL" | "UNKNOWN";
  score: number;
  checkedAt: string;
  responseTimeMs: number;
  connectivity: {
    status: string;
    latencyMs: number;
    restApiAvailable: boolean;
  };
  authentication: {
    status: string;
    authenticated: boolean;
    permissions: string;
  };
  compatibility: {
    status: "SUPPORTED" | "UNSUPPORTED";
    wordpressVersion: string;
    minimumSupportedVersion: string;
    connectorVersion: string;
    apiVersion: string;
  };
  capabilities: {
    status: string;
    pages: boolean;
    media: boolean;
    publishing: boolean;
    gutenberg: boolean;
    webhooks: boolean;
    menus: boolean;
    acf: boolean;
  };
  publishingReadiness: {
    status: "READY" | "READY_WITH_WARNINGS" | "BLOCKED";
    canPublishPages: boolean;
    canUploadMedia: boolean;
    canUseGutenberg: boolean;
    canUpdateContent: boolean;
  };
  security: {
    status: string;
    https: boolean;
    signatureVerification: boolean;
    authenticationConfigured: boolean;
  };
  warnings: Array<{ code: string; message: string }>;
  errors: Array<{ code: string; message: string }>;
  recommendations: string[];
}

/**
 * F-489: Site Health & Compatibility Diagnostics Engine
 * Evaluates real-time health, reachability, capability grid, and publishing readiness for connected WordPress sites.
 */
export async function getWordPressSiteHealth(websiteId: string, userId: string): Promise<WordPressSiteHealthDTO> {
  // 1. Authenticate user & check website access
  await getWebsiteById(websiteId, userId);
  const canView = await canUserAccessResource(userId, websiteId, "*", "VIEW");
  if (!canView) {
    throw new AppError("You do not have permission to view site health diagnostics.", 403, "FORBIDDEN");
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

  // 3. Connection State Check (Fail-closed for DISCONNECTED or REVOKED)
  if (connection.status === "REVOKED") {
    throw new AppError("WordPress connection has been revoked.", 400, "WORDPRESS_CONNECTION_REVOKED");
  }

  if (connection.status === "DISCONNECTED") {
    throw new AppError("WordPress connection is disconnected.", 400, "WORDPRESS_CONNECTION_DISCONNECTED");
  }

  // 4. Remote GET /site-health request with high-precision latency measurement
  const startTime = Date.now();
  let remoteRes: any = null;
  try {
    remoteRes = await sendSignedWordPressRequest(
      connection.siteUrl,
      "/site-health",
      "GET",
      connection.apiKeyHash
    );
  } catch (err: any) {
    // Fallback attempt to GET /site-info if /site-health endpoint isn't available on older plugin versions
    try {
      remoteRes = await sendSignedWordPressRequest(
        connection.siteUrl,
        "/site-info",
        "GET",
        connection.apiKeyHash
      );
    } catch (fallbackErr: any) {
      throw new AppError(`Failed to retrieve site health from WordPress: ${err.message}`, 502, "WORDPRESS_SITE_UNREACHABLE");
    }
  }
  const responseTimeMs = Date.now() - startTime;

  const rawData = remoteRes?.data || remoteRes || {};
  const connData = rawData.connectivity || {};
  const authData = rawData.authentication || {};
  const compData = rawData.compatibility || {};
  const capData = rawData.capabilities || {};
  const readData = rawData.publishingReadiness || {};
  const secData = rawData.security || {};

  // Extract core parameters with fallbacks
  const wpVersion = compData.wordpressVersion || rawData.general?.wordpressVersion || connection.wpVersion || "6.2.0";
  const minWpVersion = "5.8.0";
  const isWpSupported = versionCompare(wpVersion, minWpVersion) >= 0;

  const pagesCap = typeof capData.pages === "boolean" ? capData.pages : true;
  const mediaCap = typeof capData.media === "boolean" ? capData.media : true;
  const publishingCap = typeof capData.publishing === "boolean" ? capData.publishing : true;
  const gutenbergCap = typeof capData.gutenberg === "boolean" ? capData.gutenberg : true;
  const webhooksCap = typeof capData.webhooks === "boolean" ? capData.webhooks : true;
  const menusCap = typeof capData.menus === "boolean" ? capData.menus : true;
  const acfCap = typeof capData.acf === "boolean" ? capData.acf : false;

  const canPublishPages = pagesCap && publishingCap;
  const canUploadMedia = mediaCap;
  const isPublishingBlocked = !canPublishPages || !canUploadMedia || !isWpSupported;

  let readinessStatus: "READY" | "READY_WITH_WARNINGS" | "BLOCKED" = readData.status || "READY";
  if (isPublishingBlocked) {
    readinessStatus = "BLOCKED";
  } else if (!gutenbergCap || responseTimeMs > 500) {
    readinessStatus = "READY_WITH_WARNINGS";
  }

  // Calculate deterministic score
  let score = typeof rawData.score === "number" ? rawData.score : 100;
  if (isPublishingBlocked) {
    score = Math.min(score, 50);
  }
  if (!isWpSupported) {
    score -= 30;
  }
  if (responseTimeMs > 500) {
    score -= 10;
  }
  if (!gutenbergCap) {
    score -= 10;
  }
  score = Math.max(0, Math.min(100, score));

  let overallStatus: "HEALTHY" | "WARNING" | "CRITICAL" | "UNKNOWN" = rawData.overallStatus || "HEALTHY";
  if (isPublishingBlocked || !isWpSupported || score < 50) {
    overallStatus = "CRITICAL";
  } else if (score < 90 || readinessStatus === "READY_WITH_WARNINGS" || responseTimeMs > 500) {
    overallStatus = "WARNING";
  }

  // Audit Logging
  try {
    await recordAuditLog(userId, "SITE_HEALTH_CHECK_COMPLETED", websiteId, {
      overallStatus,
      score,
      responseTimeMs,
      readinessStatus,
      wordpressVersion: wpVersion,
    });
  } catch (auditErr) {}

  return {
    success: true,
    overallStatus,
    score,
    checkedAt: new Date().toISOString(),
    responseTimeMs,
    connectivity: {
      status: connData.status || "CONNECTED",
      latencyMs: responseTimeMs,
      restApiAvailable: typeof connData.restApiAvailable === "boolean" ? connData.restApiAvailable : true,
    },
    authentication: {
      status: authData.status || "VALID",
      authenticated: typeof authData.authenticated === "boolean" ? authData.authenticated : true,
      permissions: authData.permissions || "ADMINISTRATOR",
    },
    compatibility: {
      status: isWpSupported ? "SUPPORTED" : "UNSUPPORTED",
      wordpressVersion: wpVersion,
      minimumSupportedVersion: minWpVersion,
      connectorVersion: compData.connectorVersion || connection.pluginVersion || "1.0.0",
      apiVersion: compData.apiVersion || connection.apiVersion || "v1",
    },
    capabilities: {
      status: canPublishPages ? "HEALTHY" : "DEGRADED",
      pages: pagesCap,
      media: mediaCap,
      publishing: publishingCap,
      gutenberg: gutenbergCap,
      webhooks: webhooksCap,
      menus: menusCap,
      acf: acfCap,
    },
    publishingReadiness: {
      status: readinessStatus,
      canPublishPages,
      canUploadMedia,
      canUseGutenberg: gutenbergCap,
      canUpdateContent: pagesCap,
    },
    security: {
      status: secData.status || (connection.siteUrl.startsWith("https://") ? "HEALTHY" : "WARNING"),
      https: typeof secData.https === "boolean" ? secData.https : connection.siteUrl.startsWith("https://"),
      signatureVerification: true,
      authenticationConfigured: true,
    },
    warnings: Array.isArray(rawData.warnings) ? rawData.warnings : [],
    errors: Array.isArray(rawData.errors) ? rawData.errors : (!isWpSupported ? [{ code: "WP_VERSION_OUTDATED", message: `WordPress version ${wpVersion} is below minimum supported ${minWpVersion}` }] : []),
    recommendations: Array.isArray(rawData.recommendations) ? rawData.recommendations : (!gutenbergCap ? ["Enable Gutenberg block editor for enhanced visual layout rendering."] : []),
  };
}

/**
 * Utility: Compare semantic version strings
 */
export function versionCompare(v1: string, v2: string): number {
  const p1 = (v1 || "0").replace(/[^0-9.]/g, "").split(".").map(Number);
  const p2 = (v2 || "0").replace(/[^0-9.]/g, "").split(".").map(Number);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}
