import { describe, it, expect } from "vitest";
import {
  DynamicSourcePlannerService,
  SourceOwnershipClass,
} from "../services/generator/dynamicSourcePlanner.service.js";
import { SafeCleanupEngineService } from "../services/generator/safeCleanupEngine.service.js";

describe("Point 37: Dynamic Source Generation and Safe Cleanup", () => {
  describe("2.1 Deterministic File and Symbol Planning", () => {
    it("sanitizes reserved keywords by prefixing with safe fallback", () => {
      const sym1 = DynamicSourcePlannerService.sanitizeSymbolIdentifier("default");
      expect(sym1).toBe("CompDefault");

      const sym2 = DynamicSourcePlannerService.sanitizeSymbolIdentifier("class");
      expect(sym2).toBe("CompClass");

      const sym3 = DynamicSourcePlannerService.sanitizeSymbolIdentifier("import");
      expect(sym3).toBe("CompImport");
    });

    it("sanitizes leading digits and Unicode characters safely", () => {
      // Leading digit
      const symDigit = DynamicSourcePlannerService.sanitizeSymbolIdentifier("123Product");
      expect(symDigit).toBe("_123Product");

      // Unicode accents
      const symUnicode = DynamicSourcePlannerService.sanitizeSymbolIdentifier("Café Spécial");
      expect(symUnicode).toBe("CafeSpecial");

      // Special characters
      const symSpecial = DynamicSourcePlannerService.sanitizeSymbolIdentifier("Header & Footer / Menu");
      expect(symSpecial).toBe("HeaderFooterMenu");
    });

    it("resolves duplicate display title collisions deterministically", () => {
      const items = [
        { id: "node_1", title: "About Us" },
        { id: "node_2", title: "About Us" }, // Duplicate title!
        { id: "node_3", title: "About Us" }, // Third duplicate
      ];

      const planned = DynamicSourcePlannerService.planSymbols(items);
      expect(planned.get("node_1")?.sanitizedIdentifier).toBe("AboutUs");
      expect(planned.get("node_1")?.isCollisionResolved).toBe(false);

      expect(planned.get("node_2")?.sanitizedIdentifier).toBe("AboutUs_2");
      expect(planned.get("node_2")?.isCollisionResolved).toBe(true);

      expect(planned.get("node_3")?.sanitizedIdentifier).toBe("AboutUs_3");
      expect(planned.get("node_3")?.isCollisionResolved).toBe(true);
    });

    it("validates file paths against path traversal, Windows MAX_PATH and case collisions", () => {
      // Path traversal
      const traversal = DynamicSourcePlannerService.validateFilePath("../secret/passwords.txt");
      expect(traversal.valid).toBe(false);
      expect(traversal.error).toContain("Path traversal");

      // Windows MAX_PATH (> 260 chars)
      const longPath = "src/components/" + "very_long_folder_name/".repeat(15) + "Component.tsx";
      const maxPathCheck = DynamicSourcePlannerService.validateFilePath(longPath);
      expect(maxPathCheck.valid).toBe(false);
      expect(maxPathCheck.error).toContain("MAX_PATH");

      // Windows case collision
      const existing = ["src/pages/AboutPage.tsx"];
      const caseColl = DynamicSourcePlannerService.validateFilePath("src/pages/aboutpage.tsx", existing);
      expect(caseColl.valid).toBe(false);
      expect(caseColl.error).toContain("Case sensitivity collision");
    });

    it("resolves grouped import statements with default, named symbols, and aliases", () => {
      const imports = [
        {
          sourceModule: "react",
          importedSymbols: [
            { name: "React", isDefault: true },
            { name: "useState" },
            { name: "useEffect" },
          ],
          isExternal: true,
        },
        {
          sourceModule: "@/components/Button",
          importedSymbols: [{ name: "Button", alias: "PrimaryBtn" }],
          isExternal: false,
        },
      ];

      const resolved = DynamicSourcePlannerService.resolveImportStatements(imports);
      expect(resolved).toContain('import React, { useState, useEffect } from "react";');
      expect(resolved).toContain('import { Button as PrimaryBtn } from "@/components/Button";');
    });
  });

  describe("2.2 Ownership-Aware Regeneration Decision", () => {
    const plannedModule = {
      fileId: "f_1",
      filePath: "src/pages/Home.tsx",
      ownershipClass: "GENERATED" as SourceOwnershipClass,
      symbolPlan: { originalName: "Home", sanitizedIdentifier: "Home", exportType: "default" as const, isCollisionResolved: false },
      imports: [],
      sourceContent: "...",
      contentHash: "hash_new",
      isEntrypoint: true,
      runtimeProfile: "react-vite" as const,
    };

    it("strictly forbids overwriting USER_OWNED or PROTECTED_SOURCE files", () => {
      const decisionUser = DynamicSourcePlannerService.evaluateRegenerationSafety(plannedModule, {
        ownershipClass: "USER_OWNED",
        currentContentHash: "hash_user",
      });
      expect(decisionUser.canRegenerate).toBe(false);
      expect(decisionUser.action).toBe("PRESERVE");

      const decisionProtected = DynamicSourcePlannerService.evaluateRegenerationSafety(plannedModule, {
        ownershipClass: "GENERATED",
        isProtected: true,
        currentContentHash: "hash_prot",
      });
      expect(decisionProtected.canRegenerate).toBe(false);
      expect(decisionProtected.action).toBe("PRESERVE");
    });

    it("flags conflict when GENERATED file current hash diverged from recorded baseline", () => {
      const decisionDiverged = DynamicSourcePlannerService.evaluateRegenerationSafety(plannedModule, {
        ownershipClass: "GENERATED",
        recordedBaselineHash: "hash_baseline_original",
        currentContentHash: "hash_user_modified", // User modified the generated file!
      });

      expect(decisionDiverged.canRegenerate).toBe(false);
      expect(decisionDiverged.action).toBe("CONFLICT");
      expect(decisionDiverged.reason).toContain("differs from baseline");
    });

    it("permits regeneration when GENERATED file matches recorded baseline", () => {
      const decisionClean = DynamicSourcePlannerService.evaluateRegenerationSafety(plannedModule, {
        ownershipClass: "GENERATED",
        recordedBaselineHash: "hash_clean",
        currentContentHash: "hash_clean",
      });

      expect(decisionClean.canRegenerate).toBe(true);
      expect(decisionClean.action).toBe("WRITE");
    });
  });

  describe("2.3 Safe Cleanup Decision Contract", () => {
    it("calculates stale candidates by manifest subtraction without broad directory globs", () => {
      const previousFiles = [
        {
          fileId: "f_old_page",
          filePath: "src/pages/OldPage.tsx",
          ownershipClass: "GENERATED" as SourceOwnershipClass,
          recordedBaselineHash: "h_old",
          currentContentHash: "h_old",
          isProtected: false,
        },
        {
          fileId: "f_migration",
          filePath: "server/migrations/001_init.sql", // Migration!
          ownershipClass: "GENERATED" as SourceOwnershipClass,
          recordedBaselineHash: "h_sql",
          currentContentHash: "h_sql",
          isProtected: false,
        },
        {
          fileId: "f_user",
          filePath: "src/utils/custom.ts", // User-owned!
          ownershipClass: "USER_OWNED" as SourceOwnershipClass,
          recordedBaselineHash: "h_usr",
          currentContentHash: "h_usr",
          isProtected: false,
        },
      ];

      const newPlannedPaths = new Set(["src/pages/HomePage.tsx"]);

      const { eligibleCandidates, blockedCandidates } = SafeCleanupEngineService.calculateStaleCandidates(
        previousFiles,
        newPlannedPaths
      );

      // Only f_old_page is eligible for cleanup
      expect(eligibleCandidates.length).toBe(1);
      expect(eligibleCandidates[0].filePath).toBe("src/pages/OldPage.tsx");

      // Migration and user-owned files are blocked from cleanup!
      expect(blockedCandidates.some((b) => b.filePath.includes("001_init.sql"))).toBe(true);
      expect(blockedCandidates.some((b) => b.filePath.includes("custom.ts"))).toBe(true);
    });

    it("creates a removal manifest and re-verifies file hashes at apply time", () => {
      const previousFiles = [
        {
          fileId: "f_candidate",
          filePath: "src/components/DeadWidget.tsx",
          ownershipClass: "GENERATED" as SourceOwnershipClass,
          recordedBaselineHash: "hash_initial",
          currentContentHash: "hash_initial",
          isProtected: false,
        },
      ];

      const manifest = SafeCleanupEngineService.createRemovalPlan(
        "proj_test",
        "cp_base",
        previousFiles,
        new Set()
      );

      expect(manifest.staleCandidates.length).toBe(1);
      expect(manifest.isApplied).toBe(false);

      // Simulate file modified in between plan creation and apply
      const currentFilesMap = new Map<string, { contentHash: string; isModifiedSince: boolean }>([
        ["src/components/DeadWidget.tsx", { contentHash: "hash_diverged_concurrent", isModifiedSince: true }],
      ]);

      const applyResult = SafeCleanupEngineService.applyRemovalPlan(manifest.manifestId, currentFilesMap);
      // Because hash drifted concurrently, deletion is aborted!
      expect(applyResult.removedPaths.length).toBe(0);
      expect(applyResult.skippedPaths.length).toBe(1);
      expect(applyResult.skippedPaths[0].reason).toContain("concurrently");
    });
  });

  describe("2.4 Atomic Mirror Projection & Asset Retention", () => {
    it("preserves last valid checkpoint when mirror projection fails midway", () => {
      const lastValid = {
        checkpointId: "cp_last_valid",
        projectId: "p_1",
        tenantId: "t_1",
        revision: 2,
        parentCheckpointId: null,
        status: "SYNCHRONIZED" as const,
        siteSpecHash: "",
        applicationSpecHash: "",
        sourceManifestHash: "manifest_hash_valid",
        pageRegistryHash: "",
        schemaPlanHash: "",
        isSemanticValid: true,
        lastValidSemanticCheckpointId: "cp_last_valid",
        committedAt: new Date().toISOString(),
        committedBy: "sys",
        source: "AI_GENERATOR" as const,
        commitMessage: "Last valid",
      };

      const result = SafeCleanupEngineService.completeAtomicMirrorProjection(
        "p_1",
        false, // Failed generation!
        {} as any,
        lastValid,
        []
      );

      expect(result.success).toBe(false);
      expect(result.projectionStatus).toBe("INCOMPLETE_FAILED");
      expect(result.checkpointId).toBe("cp_last_valid");
      expect(result.activeManifestHash).toBe("manifest_hash_valid");
    });
  });
});
