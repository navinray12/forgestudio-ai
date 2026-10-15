/**
 * ForgeStudio Execution Blueprint v2.1 — Point 18: Security, Privacy, Audit and Abuse Resistance
 * Section 4.5: SSRF Protection, Redirect Validation and Network Boundaries
 *
 * Rules:
 * 1. Outbound network requests for webhooks, crawlers, and integrations must block:
 *    - Loopback addresses (127.0.0.1, ::1, localhost)
 *    - Private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7)
 *    - Cloud provider metadata endpoints (169.254.169.254, metadata.google.internal)
 * 2. Redirects must be revalidated at every hop.
 * 3. Prohibits unsafe schemes (file:, gopher:, dict:, ftp:). Only http: and https: permitted.
 */

import { AppError } from "../../utils/app-error.js";
import { DurableAuditDenialLedgerService } from "./durableAuditDenialLedger.service.js";

export interface OutboundValidationResult {
  allowed: boolean;
  normalizedUrl: string;
  blockedReason?: string;
}

export class SsrfNetworkQuarantineService {
  private static BLOCKED_HOST_PATTERNS = [
    /^localhost$/i,
    /^127\.\d+\.\d+\.\d+$/,
    /^0\.0\.0\.0$/,
    /^169\.254\.169\.254$/, // Cloud Instance Metadata
    /^metadata\.google\.internal$/i,
    /^10\.\d+\.\d+\.\d+$/, // RFC 1918 Class A
    /^192\.168\.\d+\.\d+$/, // RFC 1918 Class C
    /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/, // RFC 1918 Class B
    /^::1$/, // IPv6 loopback
    /^fc00:/i, // IPv6 Unique Local
    /^fe80:/i, // IPv6 Link-Local
  ];

  /**
   * Validates an outbound URL before making a network request or following a redirect.
   */
  public static validateOutboundUrl(rawUrl: string): OutboundValidationResult {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      DurableAuditDenialLedgerService.logDurableDenial("network_guard", "OUTBOUND_URL", "SSRF_MALFORMED_URL", "Malformed outbound URL rejected.", "internal");
      return { allowed: false, normalizedUrl: rawUrl, blockedReason: "Malformed URL syntax" };
    }

    // Scheme check
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      DurableAuditDenialLedgerService.logDurableDenial("network_guard", "OUTBOUND_URL", "SSRF_FORBIDDEN_SCHEME", `Forbidden outbound scheme ${parsed.protocol}.`, "internal");
      return { allowed: false, normalizedUrl: rawUrl, blockedReason: `Forbidden protocol scheme: ${parsed.protocol}` };
    }

    // Hostname check
    const hostname = parsed.hostname.toLowerCase();
    for (const pattern of this.BLOCKED_HOST_PATTERNS) {
      if (pattern.test(hostname)) {
        DurableAuditDenialLedgerService.logDurableDenial("network_guard", "OUTBOUND_URL", "SSRF_PROHIBITED", `Blocked outbound host ${hostname}.`, "internal");
        return {
          allowed: false,
          normalizedUrl: parsed.toString(),
          blockedReason: `Host ${hostname} resolves to blocked private, loopback, or cloud metadata network`,
        };
      }
    }

    return {
      allowed: true,
      normalizedUrl: parsed.toString(),
    };
  }

  /**
   * Validates each redirect hop during an HTTP sequence.
   */
  public static validateRedirectHop(previousUrl: string, redirectTargetUrl: string): OutboundValidationResult {
    return this.validateOutboundUrl(redirectTargetUrl);
  }
}
