import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveWorkspaceView,
  type ExperienceLevel,
} from "../services/ownerExperience/progressiveDisclosure.service.js";
import {
  getOrCreateEditorSession,
  transitionEditorState,
  processSaveAttempt,
  resolveEditorConflict,
} from "../services/ownerExperience/truthfulEditorState.service.js";
import {
  storeLocalRecoveryDraft,
  evaluateDraftRecovery,
  quarantineUserDrafts,
  scrubSensitiveDraftContent,
} from "../services/ownerExperience/privacySafeDraftRecovery.service.js";

describe("Point 11 — Progressive Disclosure, Truthful States & Local Recovery", () => {
  it("should generate progressive-disclosure views without mutating server permissions", () => {
    // 1. Resolve Simple Owner view
    const simpleManifest = resolveWorkspaceView({
      userRole: "CLIENT",
      requestedLevel: "SIMPLE_OWNER",
      overviewStats: {
        newLeadsCount: 5,
        overdueLeadsCount: 1,
        publicationFailuresCount: 0,
      },
    });

    assert.equal(simpleManifest.experienceLevel, "SIMPLE_OWNER");
    // Verify developer items (e.g. component contracts) are hidden in simple view
    const designItemsSimple = simpleManifest.navigation.design_pages;
    assert.ok(
      !designItemsSimple.some((i) => i.id === "nav:design:contracts"),
      "Advanced contract items must be hidden from Simple Owner view"
    );

    // 2. Client attempts to request DESIGN_DEVELOPER view
    const escalatedView = resolveWorkspaceView({
      userRole: "CLIENT",
      requestedLevel: "DESIGN_DEVELOPER", // Client is not eligible for dev view
    });
    // Invariant: User is constrained to eligible levels, view does not grant developer permissions!
    assert.equal(
      escalatedView.experienceLevel,
      "SIMPLE_OWNER",
      "Client must be bounded to eligible Simple Owner level"
    );
    assert.equal(escalatedView.features.canEditSourceCode, false);

    // 3. Developer view exposes advanced areas
    const devManifest = resolveWorkspaceView({
      userRole: "DEVELOPER",
      requestedLevel: "DESIGN_DEVELOPER",
    });
    assert.equal(devManifest.experienceLevel, "DESIGN_DEVELOPER");
    const designItemsDev = devManifest.navigation.design_pages;
    assert.ok(
      designItemsDev.some((i) => i.id === "nav:design:contracts"),
      "Developer view must expose component contracts"
    );
  });

  it("should populate all 8 workspace areas with authoritative non-fabricated data", () => {
    const manifest = resolveWorkspaceView({
      userRole: "ADMIN",
      requestedLevel: "DESIGN_DEVELOPER",
      overviewStats: {
        newLeadsCount: 12,
        overdueLeadsCount: 3,
        publicationFailuresCount: 1,
        spendingSummary: {
          currentSpendUnits: 450,
          budgetLimitUnits: 500,
          alertThresholdReached: true,
        },
      },
    });

    // Check all 8 areas exist
    const areas = [
      "overview_tasks",
      "design_pages",
      "content_media",
      "leads_conversations",
      "growth_campaigns",
      "search_measurement",
      "publish_operations",
      "governance",
    ] as const;

    for (const area of areas) {
      assert.ok(manifest.navigation[area], `Area ${area} must be present`);
      assert.ok(manifest.navigation[area].length > 0, `Area ${area} must contain navigation items`);
    }

    // Check actionable tasks generated from real stats
    assert.equal(manifest.overview.newLeadsCount, 12);
    assert.equal(manifest.overview.overdueLeadsCount, 3);
    assert.equal(manifest.overview.publicationFailuresCount, 1);
    assert.ok(
      manifest.overview.prioritizedTasks.some((t) => t.id === "task:pub_failure"),
      "Must generate prioritized task for publication failure"
    );
    assert.ok(
      manifest.overview.prioritizedTasks.some((t) => t.id === "task:overdue_leads"),
      "Must generate prioritized task for overdue leads"
    );
  });

  it("should enforce truthful 11-state editor lifecycle and reject illegal transitions", () => {
    const websiteId = "site-lifecycle-test";
    const session = getOrCreateEditorSession(websiteId, 1);
    assert.equal(session.currentState, "DRAFT_ACKNOWLEDGED");

    // Legal: DRAFT_ACKNOWLEDGED -> SAVING
    transitionEditorState({ websiteId, targetState: "SAVING", actorId: "user-1" });
    assert.equal(session.currentState, "SAVING");

    // Legal: SAVING -> DRAFT_ACKNOWLEDGED
    transitionEditorState({ websiteId, targetState: "DRAFT_ACKNOWLEDGED", actorId: "user-1" });
    assert.equal(session.currentState, "DRAFT_ACKNOWLEDGED");

    // Illegal: DRAFT_ACKNOWLEDGED -> LIVE_VERIFIED directly (cannot skip publishing gate!)
    assert.throws(
      () => {
        transitionEditorState({ websiteId, targetState: "LIVE_VERIFIED", actorId: "user-1" });
      },
      (err: any) => err.code === "ILLEGAL_STATE_TRANSITION",
      "Must reject skipping publishing pipeline"
    );
  });

  it("should preserve both versions on conflict and lock AI auto-regeneration", () => {
    const websiteId = "site-conflict-test";

    // Attempt save with stale client version (client = v1, server = v2)
    const result = processSaveAttempt({
      websiteId,
      actorId: "editor-1",
      expectedVersion: 1,
      serverVersion: 2,
      clientContent: { headline: "Client Local Version" },
      serverContent: { headline: "Server Confirmed Version" },
    });

    assert.equal(result.status, "CONFLICT");
    assert.equal(result.record.currentState, "CONFLICT");
    assert.ok(result.conflict, "Conflict snapshot must be populated");
    assert.equal(result.conflict?.autoRegenerationLocked, true, "AI auto-regen must be locked");
    assert.equal(result.conflict?.clientContent.headline, "Client Local Version");
    assert.equal(result.conflict?.serverContent.headline, "Server Confirmed Version");

    // Resolve conflict via MERGE_RESOLVED
    const resolved = resolveEditorConflict({
      websiteId,
      actorId: "editor-1",
      conflictId: result.conflict.conflictId,
      strategy: "MERGE_RESOLVED",
      resolvedContent: { headline: "Resolved Combined Headline" },
    });

    assert.equal(resolved.currentState, "DRAFT_ACKNOWLEDGED");
    assert.equal(resolved.documentVersion, 3, "Version must increment after resolution");
    assert.equal(resolved.activeConflict, undefined);
  });

  it("should scrub sensitive secrets and form PII from local draft recovery snapshots", () => {
    const dirtyContent = {
      pageTitle: "Homepage",
      apiKey: "secret-key-12345",
      password: "admin-password",
      formSubmissions: [{ name: "Customer Lead", email: "lead@example.com" }],
    };

    const clean = scrubSensitiveDraftContent(dirtyContent);
    assert.equal(clean.pageTitle, "Homepage");
    assert.equal(clean.apiKey, "[REDACTED]");
    assert.equal(clean.password, "[REDACTED]");
    assert.equal(clean.formSubmissions.length, 0, "Form submissions must be stripped from local draft");
  });

  it("should detect stale local recovery drafts and quarantine on user switch", () => {
    const userId = "user-alice";
    const workspaceId = "ws-1";
    const websiteId = "site-recovery-test";
    const draftId = "draft-main";

    // 1. Store local draft at clientVersion = 1
    const stored = storeLocalRecoveryDraft({
      userId,
      workspaceId,
      websiteId,
      draftId,
      clientVersion: 1,
      content: { heroTitle: "Unsaved Work" },
    });
    assert.equal(stored.isServerAcknowledged, false, "Local draft must never be marked server-acknowledged");

    // 2. Server is at v1 -> safe to restore
    const safeCheck = evaluateDraftRecovery({
      userId,
      workspaceId,
      websiteId,
      draftId,
      serverVersion: 1,
    });
    assert.equal(safeCheck.eligibleForRecovery, true);
    assert.equal(safeCheck.isStale, false);
    assert.equal(safeCheck.actionRequired, "RESTORE_SAFE");

    // 3. Server has advanced to v3 -> stale local draft, requires conflict resolution
    const staleCheck = evaluateDraftRecovery({
      userId,
      workspaceId,
      websiteId,
      draftId,
      serverVersion: 3,
    });
    assert.equal(staleCheck.isStale, true);
    assert.equal(staleCheck.actionRequired, "CONFLICT_RESOLUTION_REQUIRED");

    // 4. Quarantine drafts on user logout (shared device protection)
    quarantineUserDrafts(userId, "Logout on shared terminal");
    const quarantinedCheck = evaluateDraftRecovery({
      userId,
      workspaceId,
      websiteId,
      draftId,
      serverVersion: 1,
      isUserReauthenticated: false,
    });
    assert.equal(quarantinedCheck.eligibleForRecovery, false);
    assert.equal(quarantinedCheck.actionRequired, "REAUTHENTICATION_REQUIRED");
  });
});
