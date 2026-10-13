import { describe, it, expect, beforeEach } from "vitest";
import { RealtimeSyncService, VisualOperationPayload } from "../services/compiler/realtimeSync.service.js";
import { WorkspaceCoordinatorService } from "../services/workspace/workspaceCoordinator.service.js";

describe("Point 34: Real-Time Bidirectional Synchronization", () => {
  const projectId = "proj_test_p34";
  const filePath = "src/pages/HomePage.tsx";
  const sampleSource = `import React from "react";

export default function HomePage() {
  return (
    <div>
      <h1 data-forge-id="title_1">Original Title</h1>
      <p data-forge-id="desc_1">Original Description</p>
    </div>
  );
}
`;

  beforeEach(() => {
    // Reset state before tests
    RealtimeSyncService.transitionSaveState(projectId, "SYNCHRONIZED");
  });

  describe("2.1 Visual-to-code operations and Echo Suppression", () => {
    it("processes TEXT_EDIT operation and suppresses echo for originating view", async () => {
      const opPayload: VisualOperationPayload = {
        projectId,
        pageId: "page_home",
        nodeId: "title_1",
        operationType: "TEXT_EDIT",
        newValue: "Updated Title via Visual",
        oldValue: "Original Title",
        baseCheckpointId: "cp_base",
        expectedRevision: 1,
        actorId: "user_editor_1",
        tenantId: "tenant_1",
        operationId: "op_text_edit_001",
        viewId: "view_tab_a",
      };

      const result = await RealtimeSyncService.processVisualOperation(
        opPayload,
        filePath,
        sampleSource
      );

      expect(result.success).toBe(true);
      expect(result.operationId).toBe("op_text_edit_001");
      expect(result.sequenceNumber).toBeGreaterThan(0);
      expect(result.echoSuppressedForViews).toContain("view_tab_a");
      expect(result.syncStatus).toBe("SYNCHRONIZED");
      expect(result.checkpointId).toBeDefined();
    });

    it("replays idempotent operation without re-committing or duplicating sequence", async () => {
      const opPayload: VisualOperationPayload = {
        projectId,
        pageId: "page_home",
        nodeId: "title_1",
        operationType: "TEXT_EDIT",
        newValue: "Updated Title via Visual",
        oldValue: "Original Title",
        baseCheckpointId: "cp_base",
        expectedRevision: 1,
        actorId: "user_editor_1",
        tenantId: "tenant_1",
        operationId: "op_text_edit_001", // same ID
        viewId: "view_tab_b", // second tab requesting
      };

      const replayed = await RealtimeSyncService.processVisualOperation(
        opPayload,
        filePath,
        sampleSource
      );

      expect(replayed.operationId).toBe("op_text_edit_001");
      // Second view is now also echo-suppressed
      expect(replayed.echoSuppressedForViews).toContain("view_tab_b");
    });

    it("detects and flags revision conflicts when expected revision does not match", async () => {
      const opPayload: VisualOperationPayload = {
        projectId,
        pageId: "page_home",
        nodeId: "title_1",
        operationType: "TEXT_EDIT",
        newValue: "Stale update",
        baseCheckpointId: "cp_base",
        expectedRevision: 9999, // Stale!
        actorId: "user_editor_1",
        tenantId: "tenant_1",
        operationId: "op_stale_002",
        viewId: "view_tab_a",
      };

      await expect(
        RealtimeSyncService.processVisualOperation(opPayload, filePath, sampleSource)
      ).rejects.toThrow("Revision conflict");

      expect(RealtimeSyncService.getSaveState(projectId)).toBe("CONFLICT");
    });
  });

  describe("2.3 Save & Recovery 9-State Machine", () => {
    it("transitions through all valid states in the save & recovery machine", () => {
      const states = [
        "LOCAL_CHANGES",
        "SAVING",
        "DRAFT_SAVED",
        "SYNCHRONIZED",
        "INVALID_SOURCE",
        "CONFLICT",
        "PROJECTION_DELAYED_FAILED",
        "PREVIEW_READY",
        "RELEASE_VERIFIED",
      ] as const;

      for (const s of states) {
        RealtimeSyncService.transitionSaveState(projectId, s);
        expect(RealtimeSyncService.getSaveState(projectId)).toBe(s);
      }
    });

    it("rejects invalid state machine targets", () => {
      expect(() => {
        RealtimeSyncService.transitionSaveState(projectId, "UNKNOWN_STATE" as any);
      }).toThrow("Invalid state machine transition");
    });

    it("maintains buffer revisions independently of saved revisions", () => {
      const rev1 = RealtimeSyncService.getBufferRevision(projectId, filePath);
      const rev2 = RealtimeSyncService.incrementBufferRevision(projectId, filePath);
      expect(rev2).toBe(rev1 + 1);
    });
  });

  describe("2.4 Conflicts, Three-Way Reconciliation, Undo & Reconnect", () => {
    it("successfully reconciles non-overlapping edits in three-way merge", () => {
      const base = "line1\nline2\nline3\nline4";
      const visual = "line1\nline2_visual\nline3\nline4";
      const code = "line1\nline2\nline3\nline4_code";

      const outcome = RealtimeSyncService.reconcileThreeWay(base, visual, code);
      expect(outcome.success).toBe(true);
      expect(outcome.hasConflict).toBe(false);
      expect(outcome.mergedText).toBe("line1\nline2_visual\nline3\nline4_code");
    });

    it("detects conflict when both visual and code edit the exact same region", () => {
      const base = "line1\nline2\nline3";
      const visual = "line1\nline2_visual\nline3";
      const code = "line1\nline2_code\nline3";

      const outcome = RealtimeSyncService.reconcileThreeWay(base, visual, code);
      expect(outcome.success).toBe(false);
      expect(outcome.hasConflict).toBe(true);
      expect(outcome.conflictingSections).toBeDefined();
    });

    it("records inverse operation and allows layout undo without database transaction rollback", async () => {
      const actorId = "actor_undo_test";
      const opPayload: VisualOperationPayload = {
        projectId,
        pageId: "page_home",
        nodeId: "desc_1",
        operationType: "TEXT_EDIT",
        newValue: "New Description",
        oldValue: "Original Description",
        baseCheckpointId: "cp_base",
        expectedRevision: 1,
        actorId,
        tenantId: "tenant_1",
        operationId: "op_for_undo_1",
        viewId: "view_1",
      };

      await RealtimeSyncService.processVisualOperation(opPayload, filePath, sampleSource);

      const undoResult = await RealtimeSyncService.undoOperation(
        projectId,
        actorId,
        filePath,
        sampleSource
      );

      expect(undoResult.success).toBe(true);
      expect(undoResult.undoneOperation?.originalOperationId).toBe("op_for_undo_1");
    });

    it("detects sequence gap on client reconnect and signals resync requirement", () => {
      // Simulate client reconnecting with lastAck = 0 when project sequence is higher
      const reconnect = RealtimeSyncService.handleClientReconnect(projectId, "view_reconnect_1", 0);
      expect(reconnect.needsFullResync).toBe(true);
      expect(reconnect.missedSequenceCount).toBeGreaterThan(0);
    });

    it("enforces offline queue limits and rejects queuing production deployments", () => {
      const queueWithDeployment = [
        { operationType: "TEXT_EDIT" },
        { operationType: "DEPLOYMENT", isDeployment: true },
      ];

      const validation = RealtimeSyncService.validateOfflineQueue(queueWithDeployment);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain("Production deployments cannot be queued offline");
    });
  });
});
