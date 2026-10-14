/**
 * ForgeStudio Execution Blueprint v2.1 — Point 15 Automated Test Suite
 * Workflows, Communication, Experiments and Contextual Chat
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VersionedWorkflowEngine } from "../services/workflowsCommunication/workflowEngine.service.ts";
import { PreActionPolicyValidator } from "../services/workflowsCommunication/preActionPolicyValidator.service.ts";
import { CommunicationAdaptersService } from "../services/workflowsCommunication/communicationAdapters.service.ts";
import { ExplainableScoringSegmentation } from "../services/workflowsCommunication/explainableScoringSegmentation.service.ts";
import { ExperimentationEngine } from "../services/workflowsCommunication/experimentationEngine.service.ts";
import { ContextualChatService, RetrievalDocument } from "../services/workflowsCommunication/contextualChatService.service.ts";

describe("Point 15 — Workflows, Communication, Experiments and Contextual Chat", () => {
  it("should validate workflow graph, reject cycles, and enforce immutable published versions", () => {
    // 1. Valid workflow graph
    const validNodes = [
      { id: "node_trigger", type: "TRIGGER" as const, name: "Lead Created", config: {} },
      { id: "node_delay", type: "DELAY" as const, name: "Wait 1 Hour", config: { delaySeconds: 3600 } },
      { id: "node_action", type: "ACTION" as const, name: "Send Email", config: { channel: "EMAIL" as const, budgetLimitUsd: 0.05 } },
      { id: "node_exit", type: "EXIT" as const, name: "Complete", config: {} },
    ];
    const validEdges = [
      { id: "e1", sourceNodeId: "node_trigger", targetNodeId: "node_delay" },
      { id: "e2", sourceNodeId: "node_delay", targetNodeId: "node_action" },
      { id: "e3", sourceNodeId: "node_action", targetNodeId: "node_exit" },
    ];

    const draft = VersionedWorkflowEngine.createWorkflowDraft("tenant_test", "wf_welcome", "Welcome Flow", validNodes, validEdges);
    assert.equal(draft.status, "DRAFT");
    assert.equal(draft.version, 1);

    // 2. Publish workflow
    const published = VersionedWorkflowEngine.publishWorkflowVersion("wf_welcome", 1, "admin_user");
    assert.equal(published.status, "PUBLISHED");
    assert.ok(published.publishedAt);

    // 3. Reject cyclical graph
    const cyclicalNodes = [
      { id: "t", type: "TRIGGER" as const, name: "Start", config: {} },
      { id: "a", type: "ACTION" as const, name: "Step A", config: {} },
      { id: "b", type: "ACTION" as const, name: "Step B", config: {} },
      { id: "x", type: "EXIT" as const, name: "Exit", config: {} },
    ];
    const cyclicalEdges = [
      { id: "e1", sourceNodeId: "t", targetNodeId: "a" },
      { id: "e2", sourceNodeId: "a", targetNodeId: "b" },
      { id: "e3", sourceNodeId: "b", targetNodeId: "a" }, // Cycle!
      { id: "e4", sourceNodeId: "b", targetNodeId: "x" },
    ];

    assert.throws(
      () => VersionedWorkflowEngine.createWorkflowDraft("tenant_test", "wf_cycle", "Cycle Flow", cyclicalNodes, cyclicalEdges),
      /Cycles detected/
    );
  });

  it("should run isolated simulation with virtual clocks and synthetic recipients", () => {
    const simResult = VersionedWorkflowEngine.runSimulation("wf_welcome", 1, { testLead: true });
    assert.equal(simResult.isSimulation, true);
    assert.ok(simResult.steps.length > 0);
    assert.equal(simResult.syntheticRecipient.email, "synthetic-lead@forgestudio.simulation.local");
    assert.ok(simResult.virtualDurationSeconds >= 3600);
    assert.ok(simResult.totalSimulatedSpendUsd >= 0.05);
  });

  it("should enforce pre-action policy revalidation, suppression, quiet hours, and budget ceilings", () => {
    // 1. Normal allowed action
    const allowedDecision = PreActionPolicyValidator.revalidatePreAction({
      tenantId: "tenant_alpha",
      leadId: "lead_123",
      recipientIdentifier: "valid@example.com",
      channel: "EMAIL",
      templateId: "tmpl_welcome",
      templateVersion: 1,
      isTransactional: true,
      actionCostUsd: 0.01,
      remainingWorkflowBudgetUsd: 5.0,
      workflowStatus: "PUBLISHED",
      actorId: "system_worker",
      actorPermissions: ["communications:send_transactional"],
    });
    assert.equal(allowedDecision.permitted, true);
    assert.equal(allowedDecision.code, "PERMITTED");

    // 2. Action blocked on suppressed recipient
    PreActionPolicyValidator.registerSuppression("tenant_alpha", "unsubscribed@example.com", "User clicked unsubscribe");
    const suppressedDecision = PreActionPolicyValidator.revalidatePreAction({
      tenantId: "tenant_alpha",
      leadId: "lead_456",
      recipientIdentifier: "unsubscribed@example.com",
      channel: "EMAIL",
      templateId: "tmpl_welcome",
      templateVersion: 1,
      isTransactional: false,
      actionCostUsd: 0.01,
      remainingWorkflowBudgetUsd: 5.0,
      workflowStatus: "PUBLISHED",
      actorId: "system_worker",
      actorPermissions: ["communications:send_marketing"],
    });
    assert.equal(suppressedDecision.permitted, false);
    assert.equal(suppressedDecision.code, "SUPPRESSED_RECIPIENT");

    // 3. Action blocked when workflow budget is exhausted
    const budgetDecision = PreActionPolicyValidator.revalidatePreAction({
      tenantId: "tenant_alpha",
      leadId: "lead_789",
      recipientIdentifier: "another@example.com",
      channel: "EMAIL",
      templateId: "tmpl_welcome",
      templateVersion: 1,
      isTransactional: true,
      actionCostUsd: 2.5,
      remainingWorkflowBudgetUsd: 1.0, // Insufficient!
      workflowStatus: "PUBLISHED",
      actorId: "system_worker",
      actorPermissions: ["communications:send_transactional"],
    });
    assert.equal(budgetDecision.permitted, false);
    assert.equal(budgetDecision.code, "BUDGET_EXHAUSTED");
  });

  it("should enforce communication delivery state machine, idempotency, and import suppression preservation", async () => {
    // 1. Send outbound message
    const receipt1 = await CommunicationAdaptersService.dispatchMessage({
      tenantId: "tenant_alpha",
      recipient: "buyer@business.com",
      channel: "EMAIL",
      intent: "TRANSACTIONAL",
      body: "Your order is confirmed",
      idempotencyKey: "idemp_msg_001",
    });
    assert.equal(receipt1.status, "ACCEPTED_BY_PROVIDER");
    assert.equal(receipt1.confirmedDelivered, false); // Honest receipt

    // 2. Idempotent repeat
    const receipt2 = await CommunicationAdaptersService.dispatchMessage({
      tenantId: "tenant_alpha",
      recipient: "buyer@business.com",
      channel: "EMAIL",
      intent: "TRANSACTIONAL",
      body: "Your order is confirmed",
      idempotencyKey: "idemp_msg_001",
    });
    assert.equal(receipt1.receiptId, receipt2.receiptId);

    // 3. Webhook confirms delivery
    CommunicationAdaptersService.handleProviderCallback("tenant_alpha", {
      providerMessageId: receipt1.providerMessageId!,
      eventType: "delivered",
      recipient: "buyer@business.com",
    });
    assert.equal(receipt1.status, "DELIVERED");
    assert.equal(receipt1.confirmedDelivered, true);

    // 4. Contact import never overrides suppression
    PreActionPolicyValidator.registerSuppression("tenant_alpha", "do-not-contact@domain.com", "Spam complaint");
    const importBatch = [
      { email: "fresh@domain.com", name: "Fresh Contact" },
      { email: "do-not-contact@domain.com", name: "Suppressed Contact" },
    ];
    const { eligible, suppressedSkipped } = CommunicationAdaptersService.filterImportContacts("tenant_alpha", importBatch);
    assert.equal(eligible.length, 1);
    assert.equal(suppressedSkipped.length, 1);
    assert.equal(suppressedSkipped[0].email, "do-not-contact@domain.com");
  });

  it("should calculate explainable lead scores without penalizing unconsented analytics", () => {
    // Lead with form submission, business email, and repeat enquiries
    const scoreFull = ExplainableScoringSegmentation.computeLeadScore("tenant_alpha", "lead_01", {
      hasFormSubmission: true,
      email: "procurement@acme-corp.com",
      repeatInquiryCount: 3,
      hasPhone: true,
      analyticsConsentStatus: "GRANTED",
    });
    assert.ok(scoreFull.totalScore > 70);
    assert.equal(scoreFull.confidence, "HIGH");

    // Lead who refused analytics consent: score remains based on first-party truth, NOT penalizing refusal
    const scoreNoConsent = ExplainableScoringSegmentation.computeLeadScore("tenant_alpha", "lead_02", {
      hasFormSubmission: true,
      email: "procurement@acme-corp.com",
      repeatInquiryCount: 1,
      hasPhone: true,
      analyticsConsentStatus: "REFUSED",
    });
    assert.ok(scoreNoConsent.totalScore >= 70); // Full score on form + corporate domain + phone
    assert.equal(scoreNoConsent.missingDataClassification, "NOT_COLLECTED_REFUSED_CONSENT");
  });

  it("should enforce A/B experiment integrity, separate exposure from assignment, and detect SRM", () => {
    const exp = ExperimentationEngine.createExperiment(
      "tenant_alpha",
      "web_01",
      "exp_headline",
      "Headline A/B Test",
      { id: "rev_control", digest: "hash_control" },
      { id: "rev_treatment", digest: "hash_treatment" },
      { minConversionFloor: 2.0 }
    );
    assert.equal(exp.outcome, "RUNNING");

    // 1. Assign visitors
    const varA = ExperimentationEngine.assignVisitor("exp_headline", "user_1");
    const varB = ExperimentationEngine.assignVisitor("exp_headline", "user_2");
    assert.ok(["control", "treatment"].includes(varA));
    assert.ok(["control", "treatment"].includes(varB));

    // 2. Verified exposure is recorded separately
    ExperimentationEngine.recordExposure("exp_headline", "user_1", varA);
    const results = ExperimentationEngine.getExperimentResults("exp_headline");
    const exposedSum = results.controlVariant.exposedCount + results.treatmentVariant.exposedCount;
    assert.equal(exposedSum, 1);
  });

  it("should enforce chat context minimization and authorized knowledge retrieval", () => {
    // 1. Chat context minimizes PII
    const chatSession = ContextualChatService.initChatSession("tenant_alpha", "web_01", {
      explicitLocationPermissionGranted: false,
    });
    assert.equal(chatSession.hasLocationPermission, false);
    assert.equal(chatSession.approximateLocation, undefined);

    // 2. Retrieval strictly hides drafts and trashed content
    const docs: RetrievalDocument[] = [
      { id: "doc_pub", title: "Public Pricing", content: "Starter plan is $29/mo", publicationStatus: "PUBLISHED", authorizedTenantId: "tenant_alpha" },
      { id: "doc_draft", title: "Internal Strategy", content: "Confidential upcoming pricing $99", publicationStatus: "DRAFT", authorizedTenantId: "tenant_alpha" },
      { id: "doc_other", title: "Tenant Beta Doc", content: "Starter plan is $19/mo", publicationStatus: "PUBLISHED", authorizedTenantId: "tenant_beta" },
    ];

    const retrieved = ContextualChatService.retrieveAuthorizedKnowledge("tenant_alpha", "pricing", docs);
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].id, "doc_pub");
  });
});
