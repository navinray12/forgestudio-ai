/**
 * ForgeStudio Execution Blueprint v2.1 — Point 08: Component Contracts, Design Fidelity and Source Ownership
 * Test Suite 6: Component Support States & Behavioral Review Release Gate
 */

import assert from "node:assert/strict";
import test from "node:test";
import { componentSupportStateService } from "../services/components/componentSupportState.service.js";
import { behavioralReviewGateService } from "../services/components/behavioralReviewGate.service.js";

test("Point 08 — Component Support States & Behavioral Review Gate Suite", async () => {
  await test("1. Unsupported or policy-blocked component blocks release (never silently degrades to empty container)", () => {
    // 1. Policy blocked
    const evalBlocked = componentSupportStateService.evaluateSupportState({
      instanceId: "inst-01",
      componentId: "Button",
      pageRoute: "/",
      props: { label: "Click" },
      target: "NEXTJS",
      isPolicyApproved: false
    });

    assert.equal(evalBlocked.state, "BLOCKED_BY_POLICY");
    assert.equal(evalBlocked.isReleaseBlocked, true);
    assert.ok(evalBlocked.diagnostics.some(d => d.code === "COMPONENT_BLOCKED_BY_POLICY"));

    // 2. Unsupported for target
    const evalUnsupported = componentSupportStateService.evaluateSupportState({
      instanceId: "inst-02",
      componentId: "ContactForm",
      pageRoute: "/contact",
      props: { formTitle: "Contact" },
      target: "STATIC_HTML" // ContactForm not supported on static html
    });

    assert.equal(evalUnsupported.state, "UNSUPPORTED_FOR_TARGET");
    assert.equal(evalUnsupported.isReleaseBlocked, true);

    // Release gate verification across candidate instances
    const gateCheck = componentSupportStateService.verifyReleaseEligibility([evalBlocked, evalUnsupported]);
    assert.equal(gateCheck.canRelease, false);
    assert.equal(gateCheck.blockingEvaluations.length, 2);
  });

  await test("2. Missing configuration / credentials marks CONFIGURATION_REQUIRED and blocks release", () => {
    const evalConfig = componentSupportStateService.evaluateSupportState({
      instanceId: "inst-03",
      componentId: "ContactForm",
      pageRoute: "/contact",
      props: { formTitle: "Contact" }, // Missing required deliveryWebhookUrl
      target: "NEXTJS"
    });

    assert.equal(evalConfig.state, "CONFIGURATION_REQUIRED");
    assert.equal(evalConfig.isReleaseBlocked, true);
    assert.ok(evalConfig.diagnostics.some(d => d.code === "MISSING_REQUIRED"));
  });

  await test("3. Visual-only approval CANNOT authorize business logic changes without behavioral test evidence", () => {
    const detectedChanges = behavioralReviewGateService.detectBusinessLogicChanges({
      filePath: "src/components/Checkout.tsx",
      beforeSource: "export const Checkout = () => <button>View</button>;",
      afterSource: "export const Checkout = () => <button onClick={() => processPayment()}>Pay</button>;"
    });

    assert.equal(detectedChanges.length, 1);
    assert.equal(detectedChanges[0].category, "PAYMENT_COMMERCE");
    assert.equal(detectedChanges[0].requiredTestContract, "ContractTest_PaymentCommerce");

    // Attempting release with visual approval only (no behavioral tests)
    const reviewResult = behavioralReviewGateService.reviewReleaseChanges({
      candidateId: "cand-test-01",
      detectedChanges,
      submittedEvidence: [],
      isVisuallyApprovedOnly: true
    });

    assert.equal(reviewResult.isReleaseApproved, false);
    assert.ok(reviewResult.blockingReasons.some(r => r.includes("Visual-only approval rejected")));
    assert.ok(reviewResult.blockingReasons.some(r => r.includes("Missing behavioral test evidence")));
  });

  await test("4. Passing behavioral test evidence authorizes release of business logic changes", () => {
    const detectedChanges = behavioralReviewGateService.detectBusinessLogicChanges({
      filePath: "src/components/Contact.tsx",
      beforeSource: "export const Contact = () => <div>Info</div>;",
      afterSource: "export const Contact = () => <form onSubmit={handleSubmit}><button>Send</button></form>;"
    });

    assert.equal(detectedChanges.length, 1);
    assert.equal(detectedChanges[0].category, "ACTION_DELIVERY");
    assert.equal(detectedChanges[0].requiredTestContract, "ContractTest_FormDelivery");

    // Provide verified passing test evidence
    const reviewResult = behavioralReviewGateService.reviewReleaseChanges({
      candidateId: "cand-test-02",
      detectedChanges,
      submittedEvidence: [{
        testContractName: "ContractTest_FormDelivery",
        targetCandidateId: "cand-test-02",
        status: "PASSED",
        executedAt: new Date().toISOString(),
        assertionCount: 4
      }],
      isVisuallyApprovedOnly: false
    });

    assert.equal(reviewResult.isReleaseApproved, true);
    assert.equal(reviewResult.blockingReasons.length, 0);
  });
});
