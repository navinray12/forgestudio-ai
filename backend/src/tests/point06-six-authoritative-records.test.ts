/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Test Suite 1: The Six Authoritative Records Invariants & Integrity
 */

import assert from "node:assert/strict";
import test from "node:test";
import { BusinessFactRegisterService } from "../services/authoritative/record1-business-facts.service.js";
import { SiteSpecService } from "../services/authoritative/record2-sitespec.service.js";
import { SourceManifestService } from "../services/authoritative/record3-source-manifest.service.js";
import { ContentSchemaRecordService } from "../services/authoritative/record4-content-schema.service.js";
import { BusinessPolicyLedgerService } from "../services/authoritative/record5-business-ledgers.service.js";
import { ReleaseEvidenceManifestService } from "../services/authoritative/record6-release-manifest.service.js";

test("Point 06 — Six Authoritative Records Integrity Suite", async (t) => {
  t.beforeEach(() => {
    BusinessFactRegisterService.clearMemory();
    SiteSpecService.clearMemory();
    SourceManifestService.clearMemory();
    ContentSchemaRecordService.clearMemory();
    BusinessPolicyLedgerService.clearMemory();
    ReleaseEvidenceManifestService.clearMemory();
  });

  // --------------------------------------------------------------------------
  // Record 1: Business Brief and Fact/Offer Register
  // --------------------------------------------------------------------------
  await t.test("1. Record 1: AI-generated facts remain PROPOSED until explicit authorized approval", async () => {
    // AI proposes a pricing offer
    const aiProposedFact = await BusinessFactRegisterService.proposeFact(
      {
        tenantId: "tenant-acme",
        websiteId: "site-101",
        category: "PRICE_AUTHORITY",
        statement: "Enterprise Plan starts at $499/mo",
        source: "AI_PROPOSAL",
        isPublic: true,
        pricingAuthority: {
          amount: 499,
          currency: "USD",
          billingInterval: "MONTHLY",
          validFrom: new Date().toISOString(),
          enquiryOnly: false,
        },
      },
      "ai_assistant"
    );

    assert.equal(aiProposedFact.approvalState, "PROPOSED");
    assert.equal(aiProposedFact.source, "AI_PROPOSAL");
    assert.equal(aiProposedFact.version, 1);

    // Public delivery must NOT expose unapproved proposed facts
    const publicFactsBeforeApproval = await BusinessFactRegisterService.getApprovedFacts("tenant-acme", "site-101", { publicOnly: true });
    assert.equal(publicFactsBeforeApproval.length, 0, "Unapproved proposed facts must not appear in public delivery");

    // Accountable owner approves the fact with pricing confirmation
    const approvedFact = await BusinessFactRegisterService.approveFact({
      tenantId: "tenant-acme",
      websiteId: "site-101",
      factId: aiProposedFact.id,
      actorId: "owner_jane",
      notes: "Reviewed and approved pricing sheet with commercial team",
      pricingApproval: {
        approvedAmount: 499,
        currency: "USD",
      },
    });

    assert.equal(approvedFact.approvalState, "APPROVED");
    assert.equal(approvedFact.approvedBy, "owner_jane");
    assert.equal(approvedFact.version, 2);

    // Public delivery now includes approved fact, but excludes internal notes
    const publicFactsAfterApproval = await BusinessFactRegisterService.getApprovedFacts("tenant-acme", "site-101", { publicOnly: true });
    assert.equal(publicFactsAfterApproval.length, 1);
    assert.equal(publicFactsAfterApproval[0].statement, "Enterprise Plan starts at $499/mo");
    assert.equal(publicFactsAfterApproval[0].history.length, 0, "Internal audit history must not leak to public bundle");
  });

  // --------------------------------------------------------------------------
  // Record 2: SiteSpec
  // --------------------------------------------------------------------------
  await t.test("2. Record 2: SiteSpec optimistic concurrency prevents lost updates & converts editorData losslessly", async () => {
    const editorDataBaseline = {
      version: 1,
      homePageId: "page_home",
      pages: [
        {
          id: "page_home",
          name: "Home",
          slug: "/",
          isHome: true,
          elements: [
            { id: "hero_heading", type: "heading", content: "Welcome to Acme" },
            { id: "cta_contact", type: "button", content: "Get Started", href: "/contact" },
          ],
        },
        {
          id: "page_contact",
          name: "Contact",
          slug: "/contact",
          isHome: false,
          elements: [
            { id: "form_leads", type: "form" },
          ],
        },
      ],
      siteSettings: { profile: "PROFESSIONAL_SERVICES" },
    };

    // Convert legacy editorData to SiteSpec
    const siteSpec = SiteSpecService.convertEditorDataToSiteSpec("site-101", "tenant-acme", editorDataBaseline, "owner_jane");
    assert.equal(siteSpec.routes.length, 2);
    assert.equal(siteSpec.pages.length, 2);
    assert.equal(siteSpec.version, 1);
    assert.ok(siteSpec.digestHash.length > 0);

    // Convert back to editorData (lossless round-trip)
    const backToEditor = SiteSpecService.convertSiteSpecToEditorData(siteSpec);
    assert.equal(backToEditor.pages.length, 2);
    assert.equal(backToEditor.homePageId, "page_home");

    // Save initial revision to store
    await SiteSpecService.createRevision("site-101", "tenant-acme", siteSpec, "owner_jane");

    // Client A and Client B both hold version 1. Client A updates to version 2:
    await SiteSpecService.createRevision(
      "site-101",
      "tenant-acme",
      siteSpec,
      "client_a",
      1 // expected parent version = 1
    );

    // Stale Client B attempts to save based on stale parent version 1:
    await assert.rejects(
      async () => {
        await SiteSpecService.createRevision(
          "site-101",
          "tenant-acme",
          siteSpec,
          "client_b_stale",
          1 // Stale! Current version is now 2
        );
      },
      /Optimistic concurrency violation/,
      "Must reject stale save with optimistic concurrency violation"
    );
  });

  // --------------------------------------------------------------------------
  // Record 3: Source Manifest
  // --------------------------------------------------------------------------
  await t.test("3. Record 3: Source Manifest enforces file ownership and prevents overwriting protected code", async () => {
    // Register developer custom component marked SOURCE_OWNED_PROTECTED
    const customCode = `
      import React, { useState } from 'react';
      export function CustomCalculator() {
        const [val, setVal] = useState(10);
        return <div>Custom Math: {val * 2}</div>;
      }
    `;

    const file = await SourceManifestService.registerSourceFile("site-101", "tenant-acme", {
      path: "src/components/CustomCalculator.tsx",
      content: customCode,
      ownership: "SOURCE_OWNED_PROTECTED",
      role: "SHARED_COMPONENT",
      actorId: "dev_bob",
    });

    assert.equal(file.ownership, "SOURCE_OWNED_PROTECTED");
    assert.equal(file.isProtected, true);
    assert.ok(file.contentHash.length > 0);

    // Visual editor attempts to overwrite this protected file with VISUAL_OWNED markup:
    await assert.rejects(
      async () => {
        await SourceManifestService.registerSourceFile("site-101", "tenant-acme", {
          path: "src/components/CustomCalculator.tsx",
          content: `<div>Accidental visual overwrite</div>`,
          ownership: "VISUAL_OWNED",
          role: "SHARED_COMPONENT",
          actorId: "visual_editor",
        });
      },
      /Source Preservation Violation/,
      "Visual edits must never overwrite protected developer source code"
    );
  });

  // --------------------------------------------------------------------------
  // Record 4: Content and Schema Records
  // --------------------------------------------------------------------------
  await t.test("4. Record 4: CMS schema evolution detects breaking changes & isolates draft from published entries", async () => {
    // 1. Define initial schema
    const { schema } = await ContentSchemaRecordService.defineCollectionSchema({
      websiteId: "site-101",
      tenantId: "tenant-acme",
      name: "Team Members",
      slug: "team",
      fields: [
        { fieldId: "f_name", name: "Full Name", key: "fullName", type: "TEXT", required: true },
        { fieldId: "f_bio", name: "Biography", key: "bio", type: "TEXT", required: false },
      ],
    });

    assert.equal(schema.schemaVersion, 1);

    // 2. Create entry draft
    const entry = await ContentSchemaRecordService.saveEntryDraft({
      collectionId: schema.collectionId,
      websiteId: "site-101",
      tenantId: "tenant-acme",
      slug: "dr-smith",
      data: { fullName: "Dr. Alice Smith", bio: "Senior Researcher" },
      actorId: "author_mark",
    });

    // Public query before publishing must return 0 entries
    const publicBefore = await ContentSchemaRecordService.getPublicEntries(schema.collectionId);
    assert.equal(publicBefore.length, 0, "Draft entries must not be visible to public queries");

    // 3. Publish the entry
    await ContentSchemaRecordService.publishEntry(entry.entryId, entry.currentDraftRevisionId, "reviewer_jane");
    const publicAfter = await ContentSchemaRecordService.getPublicEntries(schema.collectionId);
    assert.equal(publicAfter.length, 1);
    assert.equal(publicAfter[0].data.fullName, "Dr. Alice Smith");

    // 4. Evolve schema with a breaking change (add required field without default value)
    const { impactReport } = await ContentSchemaRecordService.defineCollectionSchema({
      collectionId: schema.collectionId,
      websiteId: "site-101",
      tenantId: "tenant-acme",
      name: "Team Members",
      slug: "team",
      fields: [
        { fieldId: "f_name", name: "Full Name", key: "fullName", type: "TEXT", required: true },
        { fieldId: "f_email", name: "Email Address", key: "email", type: "TEXT", required: true }, // Breaking: newly required without default!
      ],
    });

    assert.ok(impactReport?.isBreaking, "Schema evolution must detect breaking changes");
    assert.ok(impactReport?.details.some((d) => d.includes("email")));
  });

  // --------------------------------------------------------------------------
  // Record 5: Business Ledgers (Durable Lead Acceptance & Consent)
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
