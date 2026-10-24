import { afterEach, describe, expect, it, vi } from "vitest";
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
