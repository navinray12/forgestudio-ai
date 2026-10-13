/**
 * ForgeStudio Test Suite — Blueprint Point 41: One Consistent Database Schema Studio
 */

import { describe, it, expect } from "vitest";
import { databaseStudioViews } from "../services/database/databaseStudioViews.service.ts";

describe("Point 41 — One Consistent Database Schema Studio", () => {
  const projectId = "proj_studio_41";

  describe("41.1 10 Authoritative Studio Views", () => {
    it("renders View 1: Overview with connectivity, schema version, and drift metrics", () => {
      const view = databaseStudioViews.getOverviewView(projectId, "DEVELOPMENT");
      expect(view.viewName).toBe("Overview");
      expect(view.environment).toBe("DEVELOPMENT");
      expect(view.connectivity.status).toBe("CONNECTED");
      expect(view.schemaDrift.hasDrift).toBe(false);
    });

    it("renders View 2: Model Designer with entities and stable field IDs", () => {
      const view = databaseStudioViews.getModelDesignerView(projectId, "DEVELOPMENT");
      expect(view.viewName).toBe("Model Designer");
      expect(view.entities.length).toBeGreaterThan(0);
      expect(view.entities[0].id.startsWith("ent_")).toBe(true);
      expect(view.entities[0].fields[0].id.startsWith("fld_")).toBe(true);
    });

    it("renders View 3: Relationship View with visual graph and accessible table alternative", () => {
      const view = databaseStudioViews.getRelationshipView(projectId, "DEVELOPMENT");
      expect(view.viewName).toBe("Relationship View");
      expect(view.visualGraph.nodes.length).toBeGreaterThan(0);
      expect(view.accessibleTableAlternative.length).toBeGreaterThan(0);
      expect(view.accessibleTableAlternative[0].cardinality).toBe("ONE_TO_MANY");
    });

    it("renders View 4: Schema Inspector with observed tables, constraints, grants, and RLS", () => {
      const view = databaseStudioViews.getSchemaInspectorView(projectId, "DEVELOPMENT");
      expect(view.viewName).toBe("Schema Inspector");
      expect(view.observedCatalog.tables).toContain("app_users");
      expect(view.observedCatalog.grants.length).toBeGreaterThan(0);
      expect(view.observedCatalog.rowSecurityPolicies.length).toBeGreaterThan(0);
    });

    it("renders View 5: Change Planner with 5 impact classifications and approval requirement", () => {
      const viewSafe = databaseStudioViews.getChangePlannerView(projectId, "DEVELOPMENT", [
        { type: "ADD_COLUMN", description: "Add bio column" },
      ]);
      expect(viewSafe.impactClassification).toBe("SAFE_ADDITIVE");

      const viewDangerous = databaseStudioViews.getChangePlannerView(projectId, "PRODUCTION", [
        { type: "DROP", description: "Drop legacy column" },
      ]);
      expect(viewDangerous.impactClassification).toBe("IRREVERSIBLE_CHANGE");
      expect(viewDangerous.approvalRequirements).toBe("STEP_UP_VERIFICATION_REQUIRED");
    });

    it("renders View 6: Migration History with immutable checksums and recovery actions", () => {
      const view = databaseStudioViews.getMigrationHistoryView(projectId, "DEVELOPMENT");
      expect(view.viewName).toBe("Migration History");
      expect(view.migrationPlans.length).toBeGreaterThan(0);
      expect(view.recoveryActions).toContain("REHEARSE_FORWARD_FIX");
    });

    it("renders View 7: Data Browser enforcing read-only by default on production and domain commands", () => {
      const viewDev = databaseStudioViews.getDataBrowserView(projectId, "DEVELOPMENT", "app_users");
      expect(viewDev.isReadOnlyByDefault).toBe(false);

      const viewProd = databaseStudioViews.getDataBrowserView(projectId, "PRODUCTION", "app_users");
      expect(viewProd.isReadOnlyByDefault).toBe(true);
      expect(viewProd.records[0].passwordHash).toContain("[MASKED_CONFIDENTIAL]");
      expect(viewProd.mutationRouting).toBe("MUTATIONS_ROUTED_THROUGH_DOMAIN_COMMANDS");
    });

    it("renders View 8: API / Binding Explorer with use-case and endpoint mappings", () => {
      const view = databaseStudioViews.getApiBindingExplorerView(projectId, "DEVELOPMENT");
      expect(view.viewName).toBe("API/Binding Explorer");
      expect(view.mappings[0].endpoint).toContain("/api/v1/orders");
      expect(view.mappings[0].connectionTestStatus).toBe("PASS");
    });

    it("renders View 9: Environments with dev, staging, prod bindings and promotion prerequisites", () => {
      const view = databaseStudioViews.getEnvironmentsView(projectId);
      expect(view.environments.length).toBe(3);
      const prod = view.environments.find((e) => e.environmentClass === "PRODUCTION");
      expect(prod?.protectionLevel).toBe("RESTRICTED_PRODUCTION");
      expect(prod?.promotionPrerequisites).toContain("PASS_ALL_GATES");
    });

    it("renders View 10: Recovery with backup references and operator recovery steps", () => {
      const view = databaseStudioViews.getRecoveryView(projectId, "DEVELOPMENT");
      expect(view.viewName).toBe("Recovery");
      expect(view.verifiedBackups.length).toBeGreaterThan(0);
      expect(view.operatorRecoverySteps.length).toBeGreaterThan(0);
    });
  });

  describe("41.2 Production Safeguards & Schema Editing Rules", () => {
    it("fails closed when environment selection is missing or invalid", () => {
      expect(() => databaseStudioViews.getOverviewView(projectId, "")).toThrowError("Explicit environment selection is mandatory");
      expect(() => databaseStudioViews.getOverviewView(projectId, "UNKNOWN")).toThrowError("Invalid environment");
    });

    it("creates a proposal when editing schema, never applying directly to production", () => {
      const proposal = databaseStudioViews.proposeSchemaChange(
        projectId,
        "PRODUCTION",
        ["ALTER TABLE app_orders ADD COLUMN notes text;"],
        "SAFE_ADDITIVE"
      );

      expect(proposal.status).toBe("DRAFT_PROPOSAL");
      expect(proposal.requiresProductionApproval).toBe(true);
      expect(proposal.statements.length).toBe(1);
    });

    it("preserves stable field ID on rename, avoiding destructive drop-and-add", () => {
      const result = databaseStudioViews.renameFieldSafely("ent_orders", "fld_price", "old_price", "new_price");
      expect(result.fieldId).toBe("fld_price");
      expect(result.isDestructive).toBe(false);
      expect(result.sql).toContain('RENAME COLUMN "old_price" TO "new_price"');
    });

    it("restricts expert raw SQL to administrators with bounded limits", () => {
      // Non-admin rejected
      expect(() =>
        databaseStudioViews.executeExpertSql(projectId, "DEVELOPMENT", "SELECT 1;", "USER")
      ).toThrowError("restricted to ADMIN roles");

      // Dangerous statement rejected
      expect(() =>
        databaseStudioViews.executeExpertSql(projectId, "DEVELOPMENT", "DROP DATABASE prod;", "ADMIN")
      ).toThrowError("Dangerous or uncontained SQL statement rejected");

      // Admin allowed within bounded parameters
      const exec = databaseStudioViews.executeExpertSql(projectId, "DEVELOPMENT", "SELECT * FROM app_orders;", "ADMIN");
      expect(exec.executed).toBe(true);
      expect(exec.boundedTimeoutMs).toBe(10_000);
    });
  });
});
