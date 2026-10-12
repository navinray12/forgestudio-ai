import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeAcceptanceJourney } from "../services/ownerExperience/ownerAcceptanceJourneys.service.js";

describe("Point 11 — Owner Acceptance Journeys (1 to 10)", () => {
  const baseOperator = {
    userId: "operator-admin-1",
    role: "ADMIN",
    workspaceId: "ws-acceptance-test",
    websiteId: "site-acceptance-test",
    mfaVerified: true,
    independentApproverId: "approver-dual-custody",
  };

  it("should execute Journey 1: Create a collection and page", async () => {
    const result = await executeAcceptanceJourney(1, baseOperator);
    assert.equal(result.status, "PASSED");
    assert.equal(result.journeyId, "JOURNEY_01_COLLECTION_PAGE");
    assert.equal(result.steps.length, 3);
    assert.ok(result.steps.every((s) => s.status === "PASSED"));
  });

  it("should execute Journey 2: Publish a blog post with role separation", async () => {
    // Test with CONTENT_EDITOR (lacks publish authority)
    const editorOperator = { ...baseOperator, role: "CONTENT_EDITOR" };
    const resultEditor = await executeAcceptanceJourney(2, editorOperator);
    assert.equal(resultEditor.status, "PASSED");
    assert.ok(
      resultEditor.defectsDetected.some((d) => d.id === "DEFECT_PUBLISH_PERMISSION_REQUIRED"),
      "Must flag defect mitigation when editor lacks direct publishing authority"
    );

    // Test with OWNER (holds publish authority)
    const ownerOperator = { ...baseOperator, role: "OWNER" };
    const resultOwner = await executeAcceptanceJourney(2, ownerOperator);
    assert.equal(resultOwner.status, "PASSED");
    assert.ok(resultOwner.steps.every((s) => s.status === "PASSED"));
  });

  it("should execute Journey 3: Resolve a source or content conflict", async () => {
    const result = await executeAcceptanceJourney(3, baseOperator);
    assert.equal(result.status, "PASSED");
    assert.equal(result.journeyId, "JOURNEY_03_RESOLVE_CONFLICT");
    assert.equal(result.steps.length, 3);
  });

  it("should execute Journey 4: Change site navigation", async () => {
    const result = await executeAcceptanceJourney(4, baseOperator);
    assert.equal(result.status, "PASSED");
    assert.equal(result.journeyId, "JOURNEY_04_CHANGE_NAVIGATION");
  });

  it("should execute Journey 5: Replace a media asset", async () => {
    const result = await executeAcceptanceJourney(5, baseOperator);
    assert.equal(result.status, "PASSED");
    assert.equal(result.journeyId, "JOURNEY_05_REPLACE_MEDIA_ASSET");
  });

  it("should execute Journey 6: Build and configure a form", async () => {
    const result = await executeAcceptanceJourney(6, baseOperator);
    assert.equal(result.status, "PASSED");
    assert.equal(result.journeyId, "JOURNEY_06_CONFIGURE_FORM");
  });

  it("should execute Journey 7: Receive and qualify a lead with PII protection", async () => {
    const result = await executeAcceptanceJourney(7, baseOperator);
    assert.equal(result.status, "PASSED");
    assert.equal(result.journeyId, "JOURNEY_07_RECEIVE_QUALIFY_LEAD");
  });

  it("should execute Journey 8: Create a UTM campaign link", async () => {
    const result = await executeAcceptanceJourney(8, baseOperator);
    assert.equal(result.status, "PASSED");
    assert.equal(result.journeyId, "JOURNEY_08_CREATE_UTM_CAMPAIGN");
  });

  it("should execute Journey 9: Pause a workflow or experiment", async () => {
    const result = await executeAcceptanceJourney(9, baseOperator);
    assert.equal(result.status, "PASSED");
    assert.equal(result.journeyId, "JOURNEY_09_PAUSE_WORKFLOW_EXPERIMENT");
  });

  it("should execute Journey 10: Restore a trashed article and inspect blocked release", async () => {
    const result = await executeAcceptanceJourney(10, baseOperator);
    assert.equal(result.status, "PASSED");
    assert.equal(result.journeyId, "JOURNEY_10_RESTORE_TRASH_RELEASE_DIAGNOSTICS");
    assert.equal(result.steps.length, 3);
  });
});
