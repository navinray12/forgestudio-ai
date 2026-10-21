import { AppError } from "../../../utils/app-error.js";
import crypto from "crypto";
import net from "net";
import { parseJsonEgress, safeEgressRequest } from "../../../platform/integrations/safe-egress.js";

// Security core: WordPress URL validation / SSRF policy and HMAC-signed requests to the connector plugin
// through safeEgressRequest (timeout, size and port limits).
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

/**
 * Validates, normalizes, and checks a WordPress URL against SSRF vulnerabilities.
 */
export function validateAndNormalizeWordPressUrl(urlStr: string): string {
  if (!urlStr || typeof urlStr !== "string") {
    throw new AppError("A valid WordPress site URL is required.", 400, "WORDPRESS_URL_INVALID");
  }

  let trimmed = urlStr.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    trimmed = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    throw new AppError("Invalid WordPress site URL structure.", 400, "WORDPRESS_URL_INVALID");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError("WordPress site URL must use HTTP or HTTPS protocol.", 400, "WORDPRESS_URL_INVALID");
  }

  const hostname = parsed.hostname.toLowerCase();

  const allowLocal =
    process.env.ALLOW_LOCAL_WEBHOOKS === "true" ||
    process.env.ALLOW_LOCAL_WORDPRESS === "true" ||
    process.env.NODE_ENV === "development";

  if (!allowLocal) {
    // SSRF Protection: Block loopback, private ranges, cloud metadata endpoints
    const forbiddenHosts = ["localhost", "127.0.0.1", "::1", "0.0.0.0", "[::]", "169.254.169.254", "metadata.google.internal"];
    if (
      forbiddenHosts.includes(hostname) ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".lan")
    ) {
      throw new AppError("URL points to a restricted target (SSRF Protection).", 400, "WORDPRESS_URL_INVALID");
    }

    if (net.isIP(hostname)) {
      if (
        hostname.startsWith("127.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("169.254.") ||
        hostname.startsWith("192.168.") ||
        (hostname.startsWith("172.") && (() => {
          const parts = hostname.split(".");
          const second = parseInt(parts[1], 10);
          return second >= 16 && second <= 31;
        })()) ||
        hostname === "::1" ||
        hostname.startsWith("fe80:") ||
        hostname.startsWith("fc00:") ||
        hostname.startsWith("fd00:")
      ) {
        throw new AppError("URL points to a private network target (SSRF Protection).", 400, "WORDPRESS_URL_INVALID");
      }
    }
  }

  // Normalize: remove trailing slash
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, "");
}

export async function sendSignedWordPressRequest(
  siteUrl: string,
  endpointPath: string,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  apiKeyHash: string,
  bodyData?: any
): Promise<any> {
  const cleanUrl = validateAndNormalizeWordPressUrl(siteUrl);
  const targetUrl = `${cleanUrl}/wp-json/forgestudio/v1${endpointPath}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const rawBody = bodyData ? JSON.stringify(bodyData) : "";
  const signature = crypto.createHmac("sha256", apiKeyHash).update(rawBody).digest("hex");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-ForgeStudio-Timestamp": timestamp,
    "X-ForgeStudio-Signature": signature,
    "X-ForgeStudio-Token": apiKeyHash,
    "User-Agent": "ForgeStudio-WordPress/2.0",
  };

  try {
    const response = await safeEgressRequest({
      url: targetUrl,
      method,
      headers,
      body: method !== "GET" ? rawBody : undefined,
      timeoutMs: 4000,
      maxResponseBytes: 2 * 1024 * 1024,
      allowedPorts: process.env.NODE_ENV === "production" ? [443] : [443, 80],
      allowHttp: process.env.NODE_ENV !== "production",
    });
    if (response.status < 200 || response.status >= 300) {
      return { success: false, status: response.status, message: `HTTP error ${response.status}` };
    }
    return parseJsonEgress<any>(response);
  } catch (err: any) {
    return { success: false, message: err?.message || "Remote destination unreachable", code: err?.code };
  }
}
