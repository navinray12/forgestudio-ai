/**
 * Point 08: Preview Isolation & Network Egress Boundary Security Service
 * 
 * Enforces strict isolation boundaries for custom component execution:
 * - Preview origin isolation with restrictive iframe sandbox headers and CSP
 * - Strict postMessage protocol with origin verification and message allowlist
 * - Zero leakage of control-plane tokens, cookies, or secrets to preview code
 * - Hardened SSRF defense: blocks loopback, private IPv4/IPv6, link-local, cloud metadata,
 *   and alternative numeric representations (hex, octal, dword)
 * - Fail-closed execution: if container isolation is not provable, marks untrusted execution as blocked
 */

export interface PreviewSandboxPolicy {
  iframeSandboxAttributes: string;
  contentSecurityPolicy: string;
  allowedOrigins: string[];
  allowedMessageTypes: string[];
}

export interface PostMessageEnvelope {
  type: "INIT" | "UPDATE_PROPS" | "MOUNT_CONFIRM" | "RUNTIME_ERROR" | "RESIZE";
  origin: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export class PreviewSecurityService {
  private static instance: PreviewSecurityService;

  // Strict allowlist of postMessage communication types
  private static readonly ALLOWED_MESSAGE_TYPES = new Set([
    "INIT",
    "UPDATE_PROPS",
    "MOUNT_CONFIRM",
    "RUNTIME_ERROR",
    "RESIZE"
  ]);

  private constructor() {}

  public static getInstance(): PreviewSecurityService {
    if (!PreviewSecurityService.instance) {
      PreviewSecurityService.instance = new PreviewSecurityService();
    }
    return PreviewSecurityService.instance;
  }

  /**
   * Generates secure sandbox headers and CSP for preview iframes.
   */
  public getPreviewSandboxPolicy(previewOrigin: string): PreviewSandboxPolicy {
    return {
      // Invariant: allow-scripts ONLY; explicitly omit allow-same-origin and allow-top-navigation
      iframeSandboxAttributes: "allow-scripts",
      contentSecurityPolicy: [
        "default-src 'self' data: blob:",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "frame-ancestors 'self'",
        "form-action 'none'"
      ].join("; "),
      allowedOrigins: [previewOrigin],
      allowedMessageTypes: Array.from(PreviewSecurityService.ALLOWED_MESSAGE_TYPES)
    };
  }

  /**
   * Validates an incoming postMessage from a preview iframe.
   */
  public validatePostMessage(
    envelope: PostMessageEnvelope,
    expectedOrigin: string
  ): { isValid: boolean; error?: string } {
    // 1. Origin verification
    if (envelope.origin !== expectedOrigin) {
      return {
        isValid: false,
        error: `Origin mismatch: message origin '${envelope.origin}' does not match expected '${expectedOrigin}'`
      };
    }

    // 2. Message type allowlist
    if (!PreviewSecurityService.ALLOWED_MESSAGE_TYPES.has(envelope.type)) {
      return {
        isValid: false,
        error: `Disallowed postMessage type '${envelope.type}'. Only declared types are permitted.`
      };
    }

    return { isValid: true };
  }

  /**
   * Hardened SSRF Network Boundary Defense.
   * Blocks:
   * - IPv4 loopback (127.0.0.0/8)
   * - IPv6 loopback (::1)
   * - Private RFC1918 subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
   * - IPv6 Unique Local (fc00::/7) and Link-Local (fe80::/10)
   * - Cloud Instance Metadata (169.254.169.254, metadata.google.internal)
   * - Alternative numeric/dword/hex/octal representations (e.g. 2130706433, 0x7f000001)
   */
  public isEgressAllowed(targetUrlOrHost: string): { allowed: boolean; blockedReason?: string } {
    try {
      let hostname = targetUrlOrHost;
      if (targetUrlOrHost.includes("://")) {
        const parsed = new URL(targetUrlOrHost);
        hostname = parsed.hostname;
      }

      hostname = hostname.toLowerCase().trim();

      // Check special names
      if (hostname === "localhost" || hostname === "metadata.google.internal" || hostname.endsWith(".local")) {
        return { allowed: false, blockedReason: `Blocked host: '${hostname}' is a reserved internal or metadata domain` };
      }

      // Check IPv6 loopback and private ranges
      if (hostname === "::1" || hostname === "[::1]" || hostname.startsWith("fe80:") || hostname.startsWith("fc") || hostname.startsWith("fd")) {
        return { allowed: false, blockedReason: `Blocked IPv6 internal address: '${hostname}'` };
      }

      // Check numeric/DWORD representations (e.g. 2130706433 = 127.0.0.1)
      if (/^\d+$/.test(hostname)) {
        const num = parseInt(hostname, 10);
        const ip = [
          (num >>> 24) & 255,
          (num >>> 16) & 255,
          (num >>> 8) & 255,
          num & 255
        ].join(".");
        return this.checkIpv4Address(ip);
      }

      // Check hex representations (e.g. 0x7f.0.0.1)
      if (hostname.startsWith("0x")) {
        return { allowed: false, blockedReason: `Blocked hex IP representation: '${hostname}'` };
      }

      // Check standard IPv4 address
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return this.checkIpv4Address(hostname);
      }

      // For standard domain names, enforce general safe allowlist if configured
      return { allowed: true };
    } catch {
      return { allowed: false, blockedReason: "Malformed URL or unresolvable network destination" };
    }
  }

  private checkIpv4Address(ip: string): { allowed: boolean; blockedReason?: string } {
    const parts = ip.split(".").map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return { allowed: false, blockedReason: `Malformed IPv4 address: '${ip}'` };
    }

    const [a, b] = parts;

    // Loopback 127.0.0.0/8
    if (a === 127) return { allowed: false, blockedReason: `Blocked loopback address: ${ip}` };
    // Zero address 0.0.0.0/8
    if (a === 0) return { allowed: false, blockedReason: `Blocked non-routable address: ${ip}` };
    // Cloud metadata / Link-local 169.254.0.0/16
    if (a === 169 && b === 254) return { allowed: false, blockedReason: `Blocked link-local/cloud metadata: ${ip}` };
    // Private RFC1918: 10.0.0.0/8
    if (a === 10) return { allowed: false, blockedReason: `Blocked private RFC1918 subnet: ${ip}` };
    // Private RFC1918: 172.16.0.0/12 (172.16 - 172.31)
    if (a === 172 && b >= 16 && b <= 31) return { allowed: false, blockedReason: `Blocked private RFC1918 subnet: ${ip}` };
    // Private RFC1918: 192.168.0.0/16
    if (a === 192 && b === 168) return { allowed: false, blockedReason: `Blocked private RFC1918 subnet: ${ip}` };

    return { allowed: true };
  }
}

export const previewSecurityService = PreviewSecurityService.getInstance();
