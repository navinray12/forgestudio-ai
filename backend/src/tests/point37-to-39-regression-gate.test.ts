import { describe, it, expect } from "vitest";
import { DynamicSourcePlannerService } from "../services/generator/dynamicSourcePlanner.service.js";
import { SafeCleanupEngineService } from "../services/generator/safeCleanupEngine.service.js";
import { DataModelGeneratorService } from "../services/generator/dataModelGenerator.service.js";
import { ExternalDatabaseIntrospectionService } from "../services/generator/externalDatabaseIntrospection.service.js";

describe("Points 37–39 Master Regression Gate", () => {
  it("executes integrated lifecycle: dynamic symbol planning -> data-model security -> safe cleanup", async () => {
    const projectId = "proj_e2e_gate_37_39";
    const tenantId = "tenant_e2e_37_39";

    // 1. Dynamic Source & Symbol Planning (Point 37)
    const items = [
      { id: "mod_1", title: "123 Inventory Tracker" },
      { id: "mod_2", title: "Inventory Tracker" },
    ];
    const symbolMap = DynamicSourcePlannerService.planSymbols(items);
    expect(symbolMap.get("mod_1")?.sanitizedIdentifier).toBe("_123InventoryTracker");
    expect(symbolMap.get("mod_2")?.sanitizedIdentifier).toBe("InventoryTracker");

    // 2. Application Data-Model Specification & Money Handling (Point 39)
    const modelSpec = DataModelGeneratorService.buildDomainModelSpec({
      entityName: "InventoryItem",
      description: "Inventory tracking with cost in minor units",
      moneyFields: [{ name: "unitCost", currency: "USD" }],
    });
    expect(modelSpec.moneySpecs[0].amountFieldName).toBe("unitCostCents");
    expect(modelSpec.justifiedIndexes.some((idx) => idx.columns.includes("tenant_id"))).toBe(true);

    // 4. Secure DTO Mutation Guard (Point 39)
    const validMutation = DataModelGeneratorService.validateIncomingMutation(
      { title: "Widget Pro", unitCostCents: 1500, unitCostCurrency: "USD" },
      modelSpec.dtoContract,
      "CREATE"
    );
    expect(validMutation.isValid).toBe(true);

    const maliciousMutation = DataModelGeneratorService.validateIncomingMutation(
      { title: "Widget Pro", tenantId: "hacked_tenant", status: "ACTIVE" },
      modelSpec.dtoContract,
      "CREATE"
    );
    expect(maliciousMutation.isValid).toBe(false);
    expect(maliciousMutation.rejectedFields).toContain("tenantId");

    // 5. External Database Introspection & Migration Protection (Point 39)
    const introspection = await ExternalDatabaseIntrospectionService.introspectSchema(
      "postgres://user:pass@db.internal:5432/app",
      [`app_inventoryitems`]
    );
    expect(introspection.isReadOnlySnapshot).toBe(true);

    // 6. Safe Cleanup Plan & Apply (Point 37)
    const previousManifestFiles = [
      {
        fileId: "file_old_v1",
        filePath: "src/pages/OldWidget.tsx",
        ownershipClass: "GENERATED" as const,
        recordedBaselineHash: "hash_old_v1",
        currentContentHash: "hash_old_v1",
        isProtected: false,
      },
      {
        fileId: "file_schema",
        filePath: "server/migrations/001_create_items.sql",
        ownershipClass: "GENERATED" as const,
        recordedBaselineHash: "hash_m",
        currentContentHash: "hash_m",
        isProtected: false,
      },
    ];

    // The new generation's manifest no longer contains OldWidget.tsx.
    const plannedPaths = new Set(["src/pages/InventoryItemPage.tsx"]);
    const removalPlan = SafeCleanupEngineService.createRemovalPlan(
      projectId,
      "cp_gate_37_39",
      previousManifestFiles,
      plannedPaths
    );

    // Old widget is stale candidate; SQL migration is strictly protected
    expect(removalPlan.staleCandidates.some((c) => c.filePath === "src/pages/OldWidget.tsx")).toBe(true);
    expect(removalPlan.blockedDeletions.some((b) => b.filePath.includes("001_create_items.sql"))).toBe(true);

    const currentFilesMap = new Map([
      ["src/pages/OldWidget.tsx", { contentHash: "hash_old_v1", isModifiedSince: false }],
    ]);

    const applyResult = SafeCleanupEngineService.applyRemovalPlan(
      removalPlan.manifestId,
      currentFilesMap
    );
    expect(applyResult.success).toBe(true);
    expect(applyResult.removedPaths).toContain("src/pages/OldWidget.tsx");
  });
});
