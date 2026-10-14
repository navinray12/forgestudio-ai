/**
 * ForgeStudio Execution Blueprint v2.1 — Point 04: What Every Generated Website Must Contain
 * Test Suite 1: Website Operating Contract & Truthful Claims Verification
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  WEBSITE_CONTRACT_VERSION,
  WebsiteOperatingContract,
  PageContract,
  extractContractFromEditorData,
  validateWebsiteOperatingContract,
} from "../services/websites/websiteContract.js";
import {
  resolveAction,
  auditWebsiteActions,
  executeWorkingAction,
  AUTHORIZED_PUBLIC_COMMANDS,
  AUTHORIZED_OWNER_COMMANDS,
} from "../services/websites/workingActionEngine.js";
import {
  evaluateClaimStatus,
  createManagedClaim,
  reviewClaim,
  validateClaimsForRelease,
  scanContentForUnbackedClaims,
} from "../services/websites/claimsEvidence.service.js";

test("Point 04 — Website Operating Contract & Page Specification", async (t) => {
  await t.test("1. Operating Contract Invariants: Requires root identity, owner, and home page", () => {
    const invalidContract: WebsiteOperatingContract = {
      contractVersion: WEBSITE_CONTRACT_VERSION,
      websiteId: "",
      websiteName: "Test Site",
      ownerId: "",
      tenantScope: {},
      pages: [],
      capabilities: [],
      unusedCollectionsHidden: true,
      workingActionAudit: {
        totalActions: 0,
        workingRoutesCount: 0,
        workingCommandsCount: 0,
        explicitUnavailableCount: 0,
        deadOrBrokenActionsCount: 0,
      },
      operationalStatesSupported: ["LOADING", "SUCCESS"],
      offlineResilience: {
        worksWithoutLiveAi: true,
        worksWithoutChat: true,
        worksWithoutTracking: true,
        worksWithoutVideo: true,
        worksWithoutAnimation: true,
      },
      claimsAudit: {
        totalClaims: 0,
        approvedFactsCount: 0,
        evidenceAttachedCount: 0,
        awaitingReviewCount: 0,
        unsupportedClaimsCount: 0,
        hasBlockingUnsupportedClaims: false,
      },
      generatedAt: new Date().toISOString(),
    };

    const res = validateWebsiteOperatingContract(invalidContract);
    assert.equal(res.valid, false, "Contract missing websiteId, ownerId, and pages must fail validation");
    assert.ok(res.errors.some((e) => e.field === "websiteId"));
    assert.ok(res.errors.some((e) => e.field === "ownerId"));
    assert.ok(res.errors.some((e) => e.field === "pages"));
  });

  await t.test("2. Route Uniqueness & Dead Action Detection: Intercepts duplicate routes and '#' dead links", () => {
    const contractWithErrors: WebsiteOperatingContract = {
      contractVersion: WEBSITE_CONTRACT_VERSION,
      websiteId: "site-101",
      websiteName: "Duplicate Route Site",
      ownerId: "owner-101",
      tenantScope: { workspaceId: "ws-1" },
      pages: [
        {
          id: "p1",
          route: "/",
          purpose: "HOME",
          title: "Home",
          templateRef: "standard",
          reviewState: "APPROVED",
          primaryAction: {
            id: "act-1",
            label: "Explore",
            actionType: "ROUTE",
            destination: "#", // Dead link defect!
          },
          actions: [],
          claims: [],
          seoPolicy: { title: "Home", metaDescription: "Home desc", noIndex: false },
          revision: "rev-1",
          isHome: true,
        },
        {
          id: "p2",
          route: "/", // Duplicate route!
          purpose: "OFFERING_DETAIL",
          title: "Duplicate Home",
          templateRef: "standard",
          reviewState: "DRAFT",
          actions: [],
          claims: [],
          seoPolicy: { title: "Dup", metaDescription: "Dup desc", noIndex: true },
          revision: "rev-1",
        },
      ],
      capabilities: [],
      unusedCollectionsHidden: true,
      workingActionAudit: {
        totalActions: 1,
        workingRoutesCount: 0,
        workingCommandsCount: 0,
        explicitUnavailableCount: 0,
        deadOrBrokenActionsCount: 1, // 1 dead action
      },
      operationalStatesSupported: ["LOADING", "SUCCESS"],
      offlineResilience: {
        worksWithoutLiveAi: true,
        worksWithoutChat: true,
        worksWithoutTracking: true,
        worksWithoutVideo: true,
        worksWithoutAnimation: true,
      },
      claimsAudit: {
        totalClaims: 0,
        approvedFactsCount: 0,
        evidenceAttachedCount: 0,
        awaitingReviewCount: 0,
        unsupportedClaimsCount: 0,
        hasBlockingUnsupportedClaims: false,
      },
      generatedAt: new Date().toISOString(),
    };

    const res = validateWebsiteOperatingContract(contractWithErrors);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.ruleId === "ROUTE_UNIQUE"), "Must flag duplicate route");
    assert.ok(res.errors.some((e) => e.ruleId === "ACTION_NO_DEAD_LINKS"), "Must flag '#' dead link on primary action");
    assert.ok(res.errors.some((e) => e.ruleId === "WORKING_ACTIONS_ALL"), "Must flag deadOrBrokenActionsCount > 0");
  });

  await t.test("3. Working-Action Resolution: Resolves routes, commands, and explicit unavailable states", () => {
    const availableRoutes = ["/", "/about", "/contact"];

    // A. Valid route
    const validRoute = resolveAction(
      { id: "a1", label: "Contact Us", actionType: "ROUTE", destination: "/contact" },
      availableRoutes
    );
    assert.equal(validRoute.resolvedType, "ROUTE");
    assert.equal(validRoute.isExecutable, true);

    // B. Dead link ('#')
    const deadLink = resolveAction(
      { id: "a2", label: "Dead Action", actionType: "ROUTE", destination: "#" },
      availableRoutes
    );
    assert.equal(deadLink.resolvedType, "UNAVAILABLE");
    assert.equal(deadLink.isExecutable, false);
    assert.ok(deadLink.explanation?.includes("inert"));

    // C. Non-existent route
    const brokenRoute = resolveAction(
      { id: "a3", label: "Missing Page", actionType: "ROUTE", destination: "/pricing" },
      availableRoutes
    );
    assert.equal(brokenRoute.resolvedType, "UNAVAILABLE");
    assert.equal(brokenRoute.isExecutable, false);
    assert.ok(brokenRoute.explanation?.includes("does not exist"));

    // D. Authorized command
    const validCmd = resolveAction(
      { id: "a4", label: "Submit", actionType: "COMMAND", destination: "submit_lead" },
      availableRoutes
    );
    assert.equal(validCmd.resolvedType, "COMMAND");
    assert.equal(validCmd.isExecutable, true);

    // E. Explicit unavailable state
    const unavailableAction = resolveAction(
      {
        id: "a5",
        label: "Live Chat",
        actionType: "UNAVAILABLE",
        destination: "UNAVAILABLE:chat",
        stateReason: "Live chat requires enterprise add-on.",
      },
      availableRoutes
    );
    assert.equal(unavailableAction.resolvedType, "UNAVAILABLE");
    assert.equal(unavailableAction.isExecutable, false);
    assert.equal(unavailableAction.explanation, "Live chat requires enterprise add-on.");
  });

  await t.test("4. Truthful Claims & Evidence Engine: Classification and release gating", () => {
    // A. Evaluate statuses
    const approved = evaluateClaimStatus("Founded in 2018", "ORGANIZATION_IDENTITY", undefined, true, "user-owner");
    assert.equal(approved, "APPROVED_FACT");

    const withEvidence = evaluateClaimStatus("ISO 27001 Certified", "CREDENTIALS_AND_AWARDS", "https://registry.iso.org/cert/12345", false, "auditor-1");
    assert.equal(withEvidence, "EVIDENCE_ATTACHED");

    const unreviewed = evaluateClaimStatus("Industry Leader Award 2025", "CREDENTIALS_AND_AWARDS", "https://awards.org/2025", false, undefined);
    assert.equal(unreviewed, "AWAITING_REVIEW");

    const unsupported = evaluateClaimStatus("Over 100,000,000 satisfied users worldwide", "METRICS_AND_COUNTS", undefined, false, undefined);
    assert.equal(unsupported, "UNSUPPORTED");

    // B. Validate for release
    const validRelease = validateClaimsForRelease([
      { id: "c1", statement: "Founded in 2018", status: "APPROVED_FACT" },
      { id: "c2", statement: "ISO 27001 Certified", status: "EVIDENCE_ATTACHED", evidenceReference: "https://registry.iso.org/cert/12345" },
    ]);
    assert.equal(validRelease.canPublish, true, "Approved facts and evidence-attached claims can publish");

    const blockedRelease = validateClaimsForRelease([
      { id: "c1", statement: "Founded in 2018", status: "APPROVED_FACT" },
      { id: "c3", statement: "Voted #1 Platform", status: "UNSUPPORTED" },
    ]);
    assert.equal(blockedRelease.canPublish, false, "Unsupported claims must strictly block release");
    assert.ok(blockedRelease.blockers.some((b) => b.includes("Unsupported claim")));
  });

  await t.test("5. Action Execution Machine: Refuses unauthorized commands and rejects invalid inputs", async () => {
    // Public visitor attempting owner command
    const refusal = await executeWorkingAction(
      {
        actionId: "act-admin",
        type: "COMMAND",
        destination: "publish_release",
        actorRole: "PUBLIC_VISITOR",
      },
      {}
    );
    assert.equal(refusal.success, false);
    assert.equal(refusal.state, "REFUSAL");

    // Validation failure on bad email
    const valFail = await executeWorkingAction(
      {
        actionId: "act-submit",
        type: "COMMAND",
        destination: "submit_lead",
        payload: { email: "not-an-email" },
        actorRole: "PUBLIC_VISITOR",
      },
      {
        handleCommand: async () => ({ success: true }),
      }
    );
    assert.equal(valFail.success, false);
    assert.equal(valFail.state, "VALIDATION_FAILURE");

    // Outage state reporting
    const outageRes = await executeWorkingAction(
      {
        actionId: "act-submit",
        type: "COMMAND",
        destination: "submit_lead",
        payload: { email: "client@example.com" },
        actorRole: "PUBLIC_VISITOR",
      },
      {
        checkOutage: () => true,
      }
    );
    assert.equal(outageRes.success, false);
    assert.equal(outageRes.state, "OUTAGE");
    assert.equal(outageRes.canRetry, true);
  });
});
