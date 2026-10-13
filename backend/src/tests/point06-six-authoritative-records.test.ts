/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Test Suite 1: The Six Authoritative Records Invariants & Integrity
 */

import assert from "node:assert/strict";
import test from "node:test";
import { BusinessPolicyLedgerService } from "../services/authoritative/record5-business-ledgers.service.js";
import { ReleaseEvidenceManifestService } from "../services/authoritative/record6-release-manifest.service.js";

test("Point 06 — Six Authoritative Records Integrity Suite", async (t) => {
  t.beforeEach(() => {
    BusinessPolicyLedgerService.clearMemory();
    ReleaseEvidenceManifestService.clearMemory();
  });

  // --------------------------------------------------------------------------
  // Record 1: Business Brief and Fact/Offer Register
  // --------------------------------------------------------------------------
  await t.test("5. Record 5: Durable lead acceptance is idempotent and protected from suppression overwrite", async () => {
    // 1. Submit lead
    const { lead: lead1, isDuplicate: dup1 } = await BusinessPolicyLedgerService.acceptDurableLead({
      websiteId: "site-101",
      tenantId: "tenant-acme",
      formId: "contact_form",
      idempotencyKey: "idemp_lead_999",
      payload: { name: "Bob Customer", email: "bob@example.com", message: "Inquiry about services" },
    });

    assert.equal(lead1.status, "ACCEPTED_DURABLE");
    assert.equal(dup1, false);

    // 2. Retry with same idempotency key (network retry)
    const { lead: lead2, isDuplicate: dup2 } = await BusinessPolicyLedgerService.acceptDurableLead({
      websiteId: "site-101",
      tenantId: "tenant-acme",
      formId: "contact_form",
      idempotencyKey: "idemp_lead_999",
      payload: { name: "Bob Customer", email: "bob@example.com", message: "Inquiry about services" },
    });

    assert.equal(lead2.leadId, lead1.leadId);
    assert.equal(dup2, true, "Network retries with identical idempotency key must return existing lead");

    // 3. Add to suppression opt-out ledger
    BusinessPolicyLedgerService.addSuppression({
      tenantId: "tenant-acme",
      subjectIdentifier: "bob@example.com",
      reason: "GDPR_ERASURE_REQUEST",
    });

    // 4. Subsequent lead submission from suppressed email is marked SUPPRESSED
    const { lead: suppressedLead } = await BusinessPolicyLedgerService.acceptDurableLead({
      websiteId: "site-101",
      tenantId: "tenant-acme",
      formId: "contact_form",
      idempotencyKey: "idemp_lead_1000",
      payload: { name: "Bob Customer", email: "bob@example.com", message: "Another attempt" },
    });

    assert.equal(suppressedLead.status, "SUPPRESSED");
  });

  // --------------------------------------------------------------------------
  // Record 6: Release and Evidence Manifest
  // --------------------------------------------------------------------------
  await t.test("6. Record 6: Release manifest pins exact inputs and supports safe rollback", async () => {
    const candidate = await ReleaseEvidenceManifestService.assembleCandidateManifest({
      websiteId: "site-101",
      tenantId: "tenant-acme",
      environment: "PRODUCTION",
      siteSpecVersion: 3,
      siteSpecDigest: "digest_sitespec_v3",
      businessFactRevision: 2,
      businessFactDigest: "digest_facts_v2",
      sourceManifestRevision: 1,
      sourceManifestHash: "hash_source_v1",
      contentSchemaVersions: { col_team: 1 },
      contentSnapshotHash: "hash_cms_snap_v1",
      capabilityManifestVersion: "1.0.0",
      profile: "PROFESSIONAL_SERVICES",
      artifacts: {
        bundleHash: "hash_bundle_123",
        cssHash: "hash_css_456",
        htmlHash: "hash_html_789",
        overallDeployHash: "hash_deploy_master",
      },
      actorId: "dev_lead",
    });

    assert.equal(candidate.status, "CANDIDATE");
    assert.equal(candidate.pinnedInputs.siteSpecVersion, 3);
    assert.equal(candidate.pinnedInputs.businessFactRevision, 2);

    // Publish candidate
    const published = await ReleaseEvidenceManifestService.publishCandidate(candidate.releaseId, "vp_engineering");
    assert.equal(published.status, "PUBLISHED");

    const active = await ReleaseEvidenceManifestService.getActiveRelease("site-101", "PRODUCTION");
    assert.equal(active?.releaseId, candidate.releaseId);

    // Rollback back to target (or previous)
    const rollbackRes = await ReleaseEvidenceManifestService.rollbackRelease(
      "site-101",
      candidate.releaseId,
      "vp_engineering",
      "Re-verifying rollback target recovery"
    );

    assert.equal(rollbackRes.success, true);
    assert.equal(rollbackRes.activeRelease.releaseId, candidate.releaseId);
  });
});
