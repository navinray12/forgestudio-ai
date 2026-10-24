import { afterEach, describe, expect, it, vi } from "vitest";
import dns from "node:dns/promises";
import type { CustomDomain } from "../services/domains/customDomain.service.js";

vi.mock("node:dns/promises", () => ({
  default: {
    resolveCname: vi.fn().mockRejectedValue(new Error("no DNS record")),
    resolve4: vi.fn().mockRejectedValue(new Error("no DNS record")),
    resolveTxt: vi.fn().mockRejectedValue(new Error("no DNS record")),
  },
}));

import {
  initiateSslProvisioning,
  getDomainDiagnosticStatus,
  runDnsPreflightCheck,
  verifyDomainDns,
} from "../services/domains/customDomain.service.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalAllowFallback = process.env.ALLOW_LOCAL_DNS_FALLBACK;
const domain: CustomDomain = {
  domain: "acme-demo.org",
  status: "pending",
  verificationMethod: "TXT",
  verificationToken: "test-owned-token",
  isPrimary: false,
  sslEnabled: false,
  addedAt: "2026-10-24T00:00:00Z",
};

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalAllowFallback === undefined) delete process.env.ALLOW_LOCAL_DNS_FALLBACK;
  else process.env.ALLOW_LOCAL_DNS_FALLBACK = originalAllowFallback;
});

describe("WP-05 honest HTTPS certificate lifecycle", () => {
  it("does not invent a certificate, issuer or auto-renewal from DNS status", () => {
    const diag = getDomainDiagnosticStatus({
      ...domain, status: "active", verifiedAt: "2026-10-24T00:00:00Z",
    });
    expect(diag.sslEnabled).toBe(false);
    expect(diag.sslStatus).toBe("PENDING_DNS");
    expect(diag.sslIssuer).toBeUndefined();
    expect(diag.sslExpiresAt).toBeUndefined();
    expect(diag.autoRenew).toBe(false);
  });

  it("does not permit production DNS verification fallback via environment override", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_LOCAL_DNS_FALLBACK = "true";
    const checked = await runDnsPreflightCheck(domain.domain, domain.verificationToken);
    expect(checked.passed).toBe(false);
  });

  it("rejects CNAME/A-only records as proof of domain ownership in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_LOCAL_DNS_FALLBACK = "true";
    vi.mocked(dns.resolveTxt).mockRejectedValue(new Error("TXT not present"));
    vi.mocked(dns.resolveCname).mockResolvedValue(["cname.forgestudio.app"]);
    vi.mocked(dns.resolve4).mockResolvedValue(["76.76.21.21"]);
    const result = await verifyDomainDns({ ...domain, verificationToken: "x".repeat(40) });
    expect(result.success).toBe(false);
  });

  it("accepts only an exact TXT ownership token rather than substring matching", async () => {
    process.env.NODE_ENV = "production";
    const token = "t".repeat(40);
    vi.mocked(dns.resolveTxt).mockResolvedValue([["prefix" + token + "suffix"]]);
    let result = await verifyDomainDns({ ...domain, verificationToken: token });
    expect(result.success).toBe(false);
    vi.mocked(dns.resolveTxt).mockResolvedValue([[token]]);
    result = await verifyDomainDns({ ...domain, verificationToken: token });
    expect(result).toMatchObject({ success: true, method: "TXT" });
  });

  it("rejects spoofed DNS preflight when routing matches but TXT is absent", async () => {
    process.env.NODE_ENV = "production";
    vi.mocked(dns.resolveTxt).mockRejectedValue(new Error("TXT not present"));
    vi.mocked(dns.resolveCname).mockResolvedValue(["cname.forgestudio.app"]);
    vi.mocked(dns.resolve4).mockResolvedValue(["76.76.21.21"]);
    const checked = await runDnsPreflightCheck(domain.domain, "p".repeat(40));
    expect(checked.cnameValid).toBe(true);
    expect(checked.aRecordValid).toBe(true);
    expect(checked.txtValid).toBe(false);
    expect(checked.passed).toBe(false);
  });

  it("requires an exact complete TXT resource record, including chunked records", async () => {
    process.env.NODE_ENV = "production";
    const token = "p".repeat(40);
    vi.mocked(dns.resolveTxt).mockResolvedValue([["prefix", token], ["unrelated"]]);
    let checked = await runDnsPreflightCheck(domain.domain, token);
    expect(checked.txtValid).toBe(false);
    expect(checked.passed).toBe(false);
    vi.mocked(dns.resolveTxt).mockResolvedValue([[token.slice(0, 20), token.slice(20)]]);
    checked = await runDnsPreflightCheck(domain.domain, token);
    expect(checked.txtValid).toBe(true);
    expect(checked.passed).toBe(true);
    const verified = await verifyDomainDns({ ...domain, verificationToken: token });
    expect(verified).toMatchObject({ success: true, method: "TXT" });
  });

  it("fails closed when no real ACME issuance/edge installer is configured", async () => {
    process.env.NODE_ENV = "development"; // successful local-only DNS fixture
    await expect(initiateSslProvisioning(domain, "website-1"))
      .rejects.toMatchObject({ statusCode: 503, code: "SSL_ISSUANCE_UNAVAILABLE" });
  });

  it("never implies a certificate merely because DNS verification passed", () => {
    const diagnostic = getDomainDiagnosticStatus({
      ...domain, status: "active", sslStatus: "PENDING_DNS", sslEnabled: false,
    });
    expect(diagnostic.sslEnabled).toBe(false);
    expect(diagnostic.sslStatus).not.toBe("ACTIVE");
  });
});
