/**
 * ForgeStudio Execution Blueprint v2.1 — Point 04: What Every Generated Website Must Contain
 * Test Suite 3: Core Journeys Resilience & Durable Operations Suite
 */

import assert from "node:assert/strict";
import test from "node:test";
import { provisionNormalSiteBaseline } from "../services/websites/baselineProvisioner.js";
import {
  executeWorkingAction,
  resolveAction,
} from "../services/websites/workingActionEngine.js";
import {
  extractContractFromEditorData,
  validateWebsiteOperatingContract,
} from "../services/websites/websiteContract.js";

test("Point 04 — Core Journeys Resilience & Durable Lead Operations Suite", async (t) => {
  const baseline = provisionNormalSiteBaseline({
    websiteId: "resilience-site-1",
    websiteName: "Resilient Health Advisory",
    ownerId: "owner-resilience-1",
    briefSummary: "Clinical health operations consulting.",
    contactEmail: "contact@resilienthealth.com",
  });

  await t.test("1. Offline & Optional Dependency Isolation: Core journeys work without AI, chat, tracking, or video", () => {
    // Check contract metadata declares offline resilience
    const resilience = baseline.contract.offlineResilience;
    assert.equal(resilience.worksWithoutLiveAi, true, "Core journey must function without live AI connection");
    assert.equal(resilience.worksWithoutChat, true, "Core journey must function without third-party live chat");
    assert.equal(resilience.worksWithoutTracking, true, "Core journey must function without optional tracking cookies");
    assert.equal(resilience.worksWithoutVideo, true, "Core journey must function without video assets");
    assert.equal(resilience.worksWithoutAnimation, true, "Core journey must function without animations");

    // All pages must have static text and semantic tags capable of rendering server-side
    const pages = baseline.editorData.pages as any[];
    for (const page of pages) {
      assert.ok(page.elements && page.elements.length > 0, `Page '${page.name}' must have static elements`);
      // No element should strictly require a runtime streaming AI connection
      for (const el of page.elements) {
        assert.notEqual(el.type, "ai-stream-generator", "Generated page must not depend on live AI stream");
      }
    }
  });

  await t.test("2. Semantic Page Navigation: All links resolve without client JS hydration", () => {
    const nav = baseline.editorData.navigation as Array<{ label: string; href: string }>;
    assert.ok(nav.length >= 3, "Must have header navigation items");

    const availableRoutes = (baseline.editorData.pages as any[]).map((p) => p.slug);

    for (const item of nav) {
      const resolution = resolveAction(
        { id: `nav-${item.label}`, label: item.label, actionType: "ROUTE", destination: item.href },
        availableRoutes
      );
      assert.equal(resolution.resolvedType, "ROUTE", `Nav item '${item.label}' must resolve to valid route`);
      assert.equal(resolution.isExecutable, true);
    }
  });

  await t.test("3. Durable Lead Intake: Form persists lead and handles external delivery outage honestly", async () => {
    // Simulate CRM delivery failure
    let durableStorageWritten = false;
    let externalCrmCalled = false;

    async function handleLeadSubmission(cmd: string, payload?: Record<string, unknown>) {
      if (cmd !== "submit_lead") throw new Error("Unknown command");

      // 1. First step: Durable storage write
      durableStorageWritten = true;

      // 2. Second step: External CRM webhook attempt (fails with simulated outage)
      externalCrmCalled = true;
      throw new Error("CRM endpoint timeout (503 Service Unavailable)");
    }

    // A. Invalid submission (missing email)
    const invalidSubmission = await executeWorkingAction(
      {
        actionId: "form-submit",
        type: "COMMAND",
        destination: "submit_lead",
        payload: { name: "Dr. Smith", message: "Inquiry" }, // missing email!
        actorRole: "PUBLIC_VISITOR",
      },
      { handleCommand: handleLeadSubmission }
    );
    assert.equal(invalidSubmission.success, false);
    assert.equal(invalidSubmission.state, "VALIDATION_FAILURE");
    assert.equal(durableStorageWritten, false, "Invalid payload must not write to DB");

    // B. Submission with CRM outage: must return OUTAGE state, not fake success!
    const outageSubmission = await executeWorkingAction(
      {
        actionId: "form-submit",
        type: "COMMAND",
        destination: "submit_lead",
        payload: { name: "Dr. Smith", email: "dr.smith@clinic.org", message: "Urgent inquiry" },
        actorRole: "PUBLIC_VISITOR",
      },
      { handleCommand: handleLeadSubmission }
    );

    assert.equal(durableStorageWritten, true, "Lead must be written to durable storage before external forward");
    assert.equal(outageSubmission.success, false, "Must not return fake success when CRM fails");
    assert.equal(outageSubmission.state, "OUTAGE");
    assert.equal(outageSubmission.canRetry, true);
    assert.ok(outageSubmission.message.includes("CRM endpoint timeout"));
  });

  await t.test("4. Safe Publishing Gate: Release candidate with dead link cannot silently replace working release", () => {
    // Simulate valid existing editorData
    const validContract = baseline.contract;
    const initialValidation = validateWebsiteOperatingContract(validContract);
    assert.equal(initialValidation.valid, true, "Initial baseline must be valid for publication");

    // Introduce a dead link candidate
    const brokenCandidate = JSON.parse(JSON.stringify(baseline.editorData));
    brokenCandidate.pages[0].elements.push({
      id: "broken-btn",
      type: "button",
      content: "Broken CTA",
      href: "#", // Dead link defect!
    });

    const candidateContract = extractContractFromEditorData(brokenCandidate, {
      websiteId: "resilience-site-1",
      websiteName: "Resilient Health Advisory",
      ownerId: "owner-resilience-1",
    });

    const candidateValidation = validateWebsiteOperatingContract(candidateContract);
    assert.equal(candidateValidation.valid, false, "Candidate with dead button must fail validation");
    assert.ok(
      candidateValidation.errors.some((e) => e.ruleId === "WORKING_ACTIONS_ALL"),
      "Must reject candidate with broken actions to protect working release"
    );
  });
});
