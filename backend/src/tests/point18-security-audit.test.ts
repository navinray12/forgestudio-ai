/**
 * ForgeStudio Execution Blueprint v2.1 — Point 18 Automated Test Suite
 * Security, Privacy, Audit and Abuse Resistance
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ThreatModelMatrixService } from "../services/securityAudit/threatModelMatrix.service.ts";
import { SecurityPlanesAuthorizationService } from "../services/securityAudit/securityPlanesAuthorization.service.ts";
import { SsrfNetworkQuarantineService } from "../services/securityAudit/ssrfNetworkQuarantine.service.ts";
import { DataPolicyRetentionRedactionService } from "../services/securityAudit/dataPolicyRetentionRedaction.service.ts";
import { DurableAuditDenialLedgerService } from "../services/securityAudit/durableAuditDenialLedger.service.ts";

describe("Point 18 — Security, Privacy, Audit and Abuse Resistance", () => {
  it("should provide a 13-vector threat model mapped to OWASP ASVS v4.0", () => {
    const model = ThreatModelMatrixService.getThreatModel();
    assert.equal(model.threats.length, 13);
    assert.ok(model.asvsVersion.includes("OWASP ASVS"));
    assert.ok(model.threats.some((t) => t.id === "THREAT_02_CROSS_TENANT_SUBSTITUTION"));
    assert.ok(model.threats.some((t) => t.id === "THREAT_04_SSRF_DNS_REBINDING"));
  });

  it("should enforce server-side tenant scoping and reject client tenant ID substitution", () => {
    // 1. Normal resolution
    const session = { userId: "user_01", verifiedTenantId: "tenant_alpha", role: "TENANT_MEMBER" };
    const ctx = SecurityPlanesAuthorizationService.resolveSecurityContext(session);
    assert.equal(ctx.plane, "TENANT_MEMBER");
    assert.equal(ctx.tenantId, "tenant_alpha");

    // 2. Client header attempts cross-tenant substitution
    assert.throws(
      () => SecurityPlanesAuthorizationService.resolveSecurityContext(session, "tenant_beta"),
      /Cross-tenant substitution attempt detected/
    );

    // 3. PostgreSQL RLS verification with non-superuser role
    const recordAlpha = { id: "rec_1", tenantId: "tenant_alpha" };
    const recordBeta = { id: "rec_2", tenantId: "tenant_beta" };
    assert.equal(SecurityPlanesAuthorizationService.verifyPostgresRlsQueryContract(ctx, recordAlpha), true);
    assert.equal(SecurityPlanesAuthorizationService.verifyPostgresRlsQueryContract(ctx, recordBeta), false);
  });

  it("should block SSRF attempts to loopback, private networks, and cloud metadata", () => {
    // Blocked endpoints
    const ssrfLoopback = SsrfNetworkQuarantineService.validateOutboundUrl("http://localhost:8080/admin");
    assert.equal(ssrfLoopback.allowed, false);

    const ssrfPrivateIp = SsrfNetworkQuarantineService.validateOutboundUrl("http://192.168.1.50/internal");
    assert.equal(ssrfPrivateIp.allowed, false);

    const ssrfMetadata = SsrfNetworkQuarantineService.validateOutboundUrl("http://169.254.169.254/latest/meta-data/");
    assert.equal(ssrfMetadata.allowed, false);

    const ssrfScheme = SsrfNetworkQuarantineService.validateOutboundUrl("file:///etc/passwd");
    assert.equal(ssrfScheme.allowed, false);

    // Allowed public endpoint
    const validPublic = SsrfNetworkQuarantineService.validateOutboundUrl("https://api.sendgrid.com/v3/mail/send");
    assert.equal(validPublic.allowed, true);
  });

  it("should deeply redact passwords, secrets, PII, and credit cards across logs and traces", () => {
    const sensitivePayload = {
      user: "alice",
      email: "alice@corporate.com",
      phone: "+15551234567",
      password: "SuperSecretPassword123!",
      apiKey: "sk-live-1234567890abcdef",
      creditCard: "4111111111111111",
      normalInfo: "Public blog post",
    };

    const redacted = DataPolicyRetentionRedactionService.redactObjectDeep(sensitivePayload);
    assert.equal(redacted.password, "[REDACTED_PASSWORD]");
    assert.equal(redacted.apiKey, "[REDACTED_API_KEY]");
    assert.equal(redacted.email, "[REDACTED_EMAIL]");
    assert.equal(redacted.phone, "[REDACTED_PHONE]");
    assert.equal(redacted.creditCard, "[REDACTED_CREDIT_CARD]");
    assert.equal(redacted.normalInfo, "Public blog post");
  });

  it("should append audit records to tamper-evident cryptographic hash chain and log durable denials", () => {
    // 1. Append valid audit mutations
    DurableAuditDenialLedgerService.appendAuditRecord("tenant_alpha", "user_01", "ARTICLE_PUBLISHED", "SUCCESS");
    DurableAuditDenialLedgerService.appendAuditRecord("tenant_alpha", "user_01", "LEAD_QUALIFIED", "SUCCESS");

    // 2. Verify hash chain integrity
    const check1 = DurableAuditDenialLedgerService.verifyAuditChainIntegrity();
    assert.equal(check1.intact, true);
    assert.ok(check1.verifiedCount >= 2);

    // 3. Log out-of-transaction durable denial
    const denial = DurableAuditDenialLedgerService.logDurableDenial(
      "user_attacker",
      "EXPORT_DATABASE",
      "PERMISSION_DENIED",
      "User lacks export_database permission",
      "10.0.0.1",
      "tenant_alpha"
    );
    assert.equal(denial.denialCode, "PERMISSION_DENIED");

    // Hash chain continues to be valid
    const check2 = DurableAuditDenialLedgerService.verifyAuditChainIntegrity();
    assert.equal(check2.intact, true);
  });

  it("should enforce tenant quotas and pause abuse without purging protected source or leads", () => {
    const quotaResult = DurableAuditDenialLedgerService.checkQuotaAndAbuse(
      "tenant_alpha",
      "AI_TOKENS",
      1000000,
      500000 // Limit exceeded!
    );
    assert.equal(quotaResult.permitted, false);
    assert.equal(quotaResult.pausedForAbuse, true);
    assert.ok(quotaResult.reason?.includes("Protected source and leads preserved"));
  });
});
