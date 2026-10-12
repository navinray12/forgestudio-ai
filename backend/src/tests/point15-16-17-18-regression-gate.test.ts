/**
 * ForgeStudio Execution Blueprint v2.1 — Points 15, 16, 17, 18 Cross-Point Integration & Regression Gate
 *
 * Verifies end-to-end coherence across:
 * - Point 05: Capability & Release Gates
 * - Point 06: Authoritative Records 1 to 6
 * - Point 11: Dynamic Permissions & Authorization
 * - Point 12: Forms, Leads & Atomic Submission
 * - Point 13: Consent, Attribution & Conversion Truth
 * - Point 14: Search Quality, SEO & Offer Registers
 * - Point 15: Workflows, Communication & Experiments
 * - Point 16: Hosting Profiles & Portable Exports
 * - Point 17: Release Controller, Passport & Mandatory Gates
 * - Point 18: Security Planes, SSRF & Tamper-Evident Audit
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VersionedWorkflowEngine } from "../services/workflowsCommunication/workflowEngine.service.ts";
import { PreActionPolicyValidator } from "../services/workflowsCommunication/preActionPolicyValidator.service.ts";
import { CommunicationAdaptersService } from "../services/workflowsCommunication/communicationAdapters.service.ts";
import { HostingProfilesEngine } from "../services/hostingExport/hostingProfilesEngine.service.ts";
import { PortableExportPackageService } from "../services/hostingExport/portableExportPackage.service.ts";
import { DurableReleaseController } from "../services/releaseIntegrity/durableReleaseController.service.ts";
import { MandatoryReleaseGatesService } from "../services/releaseIntegrity/mandatoryReleaseGates.service.ts";
import { ReleasePassportService } from "../services/releaseIntegrity/releasePassportService.service.ts";
import { SecurityPlanesAuthorizationService } from "../services/securityAudit/securityPlanesAuthorization.service.ts";
import { SsrfNetworkQuarantineService } from "../services/securityAudit/ssrfNetworkQuarantine.service.ts";
import { DurableAuditDenialLedgerService } from "../services/securityAudit/durableAuditDenialLedger.service.ts";

describe("Points 15, 16, 17, 18 — Cross-Point Integration & Regression Gate", () => {
  it("Journey 1: Form Lead -> Workflow Trigger -> Policy Revalidation -> Transactional Delivery", async () => {
    // 1. Lead is created (Point 12 / Record 5)
    const tenantId = "tenant_enterprise";
    const leadEmail = "executive@acme.com";

    // 2. Pre-action policy check revalidated immediately before sending transactional acknowledgement (Point 15)
    const policyDecision = PreActionPolicyValidator.revalidatePreAction({
      tenantId,
      leadId: "lead_ent_001",
      recipientIdentifier: leadEmail,
      channel: "EMAIL",
      templateId: "tmpl_quote_ack",
      templateVersion: 1,
      isTransactional: true,
      actionCostUsd: 0.01,
      remainingWorkflowBudgetUsd: 10.0,
      workflowStatus: "PUBLISHED",
      actorId: "system_workflow_worker",
      actorPermissions: ["communications:send_transactional"],
    });
    assert.equal(policyDecision.permitted, true);

    // 3. Dispatch through communication adapter with delivery state machine (Point 15)
    const receipt = await CommunicationAdaptersService.dispatchMessage({
      tenantId,
      recipient: leadEmail,
      channel: "EMAIL",
      intent: "TRANSACTIONAL",
      body: "We have received your enterprise enquiry.",
      idempotencyKey: "idemp_ack_001",
    });
    assert.equal(receipt.status, "ACCEPTED_BY_PROVIDER");

    // 4. Audit ledger records mutation into cryptographic hash chain (Point 18)
    const auditRecord = DurableAuditDenialLedgerService.appendAuditRecord(
      tenantId,
      "system_workflow_worker",
      "WORKFLOW_TRANSACTIONAL_EMAIL_DISPATCHED",
      "SUCCESS"
    );
    assert.ok(auditRecord.recordHash);
  });

  it("Journey 2: Portable Full Stack Export -> Checksum Verification -> Secret Exclusion", () => {
    // 1. Export manifest generated (Point 16)
    const manifest = PortableExportPackageService.generateExportManifest(
      "tenant_enterprise",
      "web_enterprise_01",
      "PORTABLE_FULL_STACK"
    );
    assert.equal(manifest.targetProfile, "PORTABLE_FULL_STACK");

    // 2. Verified package hash integrity (Point 16)
    const integrityValid = PortableExportPackageService.verifyPackageIntegrity(manifest);
    assert.equal(integrityValid, true);

    // 3. Platform secrets strictly excluded (Point 16 / Point 18)
    assert.equal(manifest.excludedPlatformSecrets.includes("FORGE_MASTER_API_KEY"), true);

    // 4. Qualifications confirm smoke tests pass (Point 16)
    const qualification = HostingProfilesEngine.qualifyPortableFullStack("web_enterprise_01");
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.evidence.smokeTestsPassed.acceptAndPersistLead, true);
  });

  it("Journey 3: Candidate Build -> 12 Release Gates -> Trusted Passport -> Promotion -> Code Rollback", () => {
    const tenantId = "tenant_enterprise";
    const websiteId = "web_enterprise_01";
    const artifactDigest = "sha256_bundle_verified_v1";

    // 1. Request release candidate in state REQUESTED (Point 17)
    const candidate = DurableReleaseController.requestRelease(
      tenantId,
      websiteId,
      1,
      artifactDigest,
      { sourceDigest: "s1", contentDigest: "c1", policyDigest: "p1", schemaDigest: "m1" },
      "lead_architect"
    );
    assert.equal(candidate.state, "REQUESTED");

    // 2. Step through legal state transitions to VERIFYING
    DurableReleaseController.transitionState(candidate.releaseId, "PLANNED", 1);
    DurableReleaseController.transitionState(candidate.releaseId, "BUILDING", 2);
    DurableReleaseController.transitionState(candidate.releaseId, "VERIFYING", 3);

    // 3. Evaluate 12 mandatory release gates (Point 17)
    const observations: Record<string, { passed: boolean }> = {};
    MandatoryReleaseGatesService.MANDATORY_GATES.forEach((g) => {
      observations[g.id] = { passed: true };
    });

    const gateEval = MandatoryReleaseGatesService.evaluateAllMandatoryGates({
      releaseId: candidate.releaseId,
      websiteId,
      tenantId,
      artifactDigest,
      targetProfile: "MANAGED_DECLARATIVE",
      evidenceObservations: observations,
    });
    assert.equal(gateEval.allPassed, true);
    assert.equal(gateEval.attestations.length, 12);

    // 4. Issue cryptographic release passport signed by trusted verifier (Point 17)
    const passport = ReleasePassportService.issueReleasePassport(
      candidate.releaseId,
      websiteId,
      tenantId,
      artifactDigest,
      gateEval.attestations,
      "TRUSTED_PLATFORM_VERIFIER"
    );
    assert.equal(passport.passedAllMandatoryGates, true);
    assert.equal(ReleasePassportService.verifyPassport(passport), true);

    // 5. Transition to VERIFIED and STAGED
    DurableReleaseController.transitionState(candidate.releaseId, "VERIFIED", 4);
    DurableReleaseController.transitionState(candidate.releaseId, "STAGED", 5);

    // 6. Promote candidate to LIVE_VERIFIED via CAS
    const promoted = DurableReleaseController.promoteToActive(candidate.releaseId, null, artifactDigest);
    assert.equal(promoted.state, "LIVE_VERIFIED");

    // 7. Perform code-only rollback while preserving newly committed business leads (Point 17 / Point 12)
    const rollback = DurableReleaseController.rollbackCodeOnly(websiteId, candidate.releaseId);
    assert.equal(rollback.preservedLeadsContract, true);
  });

  it("Journey 4: Cross-Tenant Protection -> SSRF Defense -> Audit Chain Integrity", () => {
    // 1. Cross-tenant substitution blocked (Point 18)
    const session = { userId: "dev_01", verifiedTenantId: "tenant_enterprise", role: "TENANT_MEMBER" };
    assert.throws(
      () => SecurityPlanesAuthorizationService.resolveSecurityContext(session, "tenant_competitor"),
      /Cross-tenant substitution attempt detected/
    );

    // 2. SSRF attack on cloud metadata blocked (Point 18)
    const ssrfCheck = SsrfNetworkQuarantineService.validateOutboundUrl("http://169.254.169.254/latest/meta-data/iam");
    assert.equal(ssrfCheck.allowed, false);

    // 3. Durable denial is recorded out-of-transaction (Point 18)
    const denial = DurableAuditDenialLedgerService.logDurableDenial(
      "dev_01",
      "METADATA_PROBE",
      "SSRF_PROHIBITED",
      "Attempted access to AWS/GCP metadata endpoint",
      "10.0.0.2",
      "tenant_enterprise"
    );
    assert.equal(denial.denialCode, "SSRF_PROHIBITED");

    // 4. Entire cryptographic audit chain verified intact (Point 18)
    const chainIntegrity = DurableAuditDenialLedgerService.verifyAuditChainIntegrity();
    assert.equal(chainIntegrity.intact, true);
    assert.ok(chainIntegrity.verifiedCount >= 3);
  });
});
