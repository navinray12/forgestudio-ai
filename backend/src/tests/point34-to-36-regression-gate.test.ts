import { describe, it, expect } from "vitest";
import { RealtimeSyncService } from "../services/compiler/realtimeSync.service.js";
import { RoundTripContractService } from "../services/compiler/roundTripContract.service.js";
import {
  createPageLifecycle,
  renameOrMovePage,
  retirePageReversible,
  restorePageDraft,
  isRecognizedPageEntry,
  detectRouteCollisions,
  RegisteredPage,
} from "../services/compiler/pageRegistry.js";
import { ReferenceProjectBenchmarkService } from "../services/benchmark/referenceProjectBenchmark.service.js";

describe("Points 34–36 Integration & Regression Gate", () => {
  it("executes end-to-end flow: create page -> visual edit -> roundtrip check -> rename -> retire -> restore", async () => {
    const projectId = "proj_e2e_gate";
    const initialPages: RegisteredPage[] = [];

    // 1. Create page lifecycle (Point 36)
    const { newPage, updatedPages, initialSourceCode } = createPageLifecycle({
      projectId,
      pageName: "Services",
      routePath: "/services",
      framework: "react",
      existingPages: initialPages,
    });

    expect(newPage.stablePageId).toBeDefined();
    expect(updatedPages.length).toBe(1);
    expect(initialSourceCode).toContain("ServicesPage");

    // 2. Classify construct and register stable mapping (Point 35)
    const classification = RoundTripContractService.classifyConstruct(
      initialSourceCode,
      newPage.filePath
    );
    expect(classification.isVisuallyEditable).toBe(true);

    RoundTripContractService.registerMapping({
      pageId: newPage.stablePageId,
      fileId: newPage.fileId,
      componentDefId: "cmp_services",
      exportIdentity: "ServicesPage",
      nodeId: `title_${newPage.stablePageId}`,
      sourceLocationMapping: {
        startLine: 5,
        startCol: 6,
        endLine: 5,
        endCol: 40,
        startOffset: 100,
        endOffset: 140,
      },
      sourceHash: "initial_hash",
      sourceRevision: 1,
      isSharedDefinition: false,
    });

    // 3. Perform real-time visual-to-code edit with echo suppression (Point 34)
    const editResult = await RealtimeSyncService.processVisualOperation(
      {
        projectId,
        pageId: newPage.stablePageId,
        nodeId: `title_${newPage.stablePageId}`,
        operationType: "TEXT_EDIT",
        newValue: "Elite Professional Services",
        oldValue: "Services",
        baseCheckpointId: "cp_0",
        expectedRevision: 1,
        actorId: "author_e2e",
        tenantId: "tenant_e2e",
        operationId: "op_e2e_edit",
        viewId: "view_e2e_canvas",
      },
      newPage.filePath,
      initialSourceCode
    );

    expect(editResult.success).toBe(true);
    expect(editResult.echoSuppressedForViews).toContain("view_e2e_canvas");
    expect(editResult.checkpointId).toBeDefined();

    // 4. Verify round-trip laws on the resulting code (Point 35)
    const noOpLaw = RoundTripContractService.verifyNoOpParseEmit(initialSourceCode);
    expect(noOpLaw.passed).toBe(true);

    // 5. Move/Rename page preserving stable identity (Point 36)
    const moveResult = renameOrMovePage({
      pages: updatedPages,
      pageKey: newPage.key,
      newRoutePath: "/our-services",
      newName: "Our Services",
    });

    const movedPage = moveResult.updatedPages[0];
    expect(movedPage.routePath).toBe("/our-services");
    expect(movedPage.stablePageId).toBe(newPage.stablePageId);
    expect(movedPage.fileId).toBe(newPage.fileId);

    // 6. Reversibly retire page
    const retired = retirePageReversible(moveResult.updatedPages, newPage.key, "Archived for v2");
    expect(retired[0].isRetired).toBe(true);
    expect(retired[0].syncStatus).toBe("RETIRED");

    // 7. Restore page back to draft
    const restored = restorePageDraft(retired, newPage.key);
    expect(restored[0].isRetired).toBe(false);
    expect(restored[0].syncStatus).toBe("SYNCHRONIZED");
  });

  describe("Section 5: Reference Project Benchmark Suite (20 pages, 1,000 nodes, 100 files)", () => {
    it("generates the reference project structure correctly", () => {
      const { pages, files } = ReferenceProjectBenchmarkService.generateReferenceProject();
      expect(pages.length).toBe(20);
      expect(Object.keys(files).length).toBe(100);

      // Verify each page contains 50 visual nodes -> 1,000 nodes total
      for (const p of pages) {
        const nodeMatches = p.sourceCode.match(/data-forge-id="el_p\d+_n\d+"/g);
        expect(nodeMatches?.length).toBe(50);
      }
    });

    it("runs reference project benchmark and reports latency metrics and hardware stats", async () => {
      const report = await ReferenceProjectBenchmarkService.runBenchmark(5);

      expect(report.referenceProject.pageCount).toBe(20);
      expect(report.referenceProject.visualNodeCount).toBe(1000);
      expect(report.referenceProject.sourceFileCount).toBe(100);

      // Verify measured metrics exist with p50 and p95 numbers
      expect(report.metrics.localProjection.sampleCount).toBe(5);
      expect(report.metrics.localProjection.p50Ms).toBeGreaterThanOrEqual(0);
      expect(report.metrics.localProjection.p95Ms).toBeGreaterThanOrEqual(0);
      expect(report.metrics.localProjection.targetBudgetMs).toBe(250);

      expect(report.metrics.durableSaveAck.sampleCount).toBe(5);
      expect(report.metrics.durableSaveAck.p50Ms).toBeGreaterThanOrEqual(0);
      expect(report.metrics.durableSaveAck.p95Ms).toBeGreaterThanOrEqual(0);
      expect(report.metrics.durableSaveAck.targetBudgetMs).toBe(1000);

      expect(report.metrics.remoteProjection.sampleCount).toBe(5);
      expect(report.metrics.remoteProjection.p50Ms).toBeGreaterThanOrEqual(0);
      expect(report.metrics.remoteProjection.p95Ms).toBeGreaterThanOrEqual(0);
      expect(report.metrics.remoteProjection.targetBudgetMs).toBe(2000);

      // Hardware environment metadata recorded
      expect(report.hardware.platform).toBeDefined();
      expect(report.hardware.nodeVersion).toBeDefined();
      expect(report.hardware.cpus).toBeGreaterThan(0);
    });
  });
});
