import { describe, it, expect } from "vitest";
import { DataModelGeneratorService } from "../services/generator/dataModelGenerator.service.js";
import { ExternalDatabaseIntrospectionService } from "../services/generator/externalDatabaseIntrospection.service.js";

describe("Point 39: General-Purpose Application Data-Model Generation", () => {
  describe("4.1 Three-Domain Separation", () => {
    it("strictly blocks generated application domain from accessing platform control-plane directly", () => {
      const platformAttempt = DataModelGeneratorService.validateDomainSeparation(
        "PLATFORM_DOMAIN",
        "forge_platform_users",
        "APP_USER" // Not superuser!
      );

      expect(platformAttempt.isAllowed).toBe(false);
      expect(platformAttempt.error).toContain("platform domain or control-plane tables directly");
    });

    it("prevents private application records from directly writing into public CMS collections", () => {
      const cmsAttempt = DataModelGeneratorService.validateDomainSeparation(
        "APPLICATION_DOMAIN",
        "cms_blog_posts",
        "APP_ADMIN"
      );

      expect(cmsAttempt.isAllowed).toBe(false);
      expect(cmsAttempt.error).toContain("Cross-domain violation");
    });
  });

  describe("4.2 Complete Domain Model Specification & Money Minor Units", () => {
    it("models money fields strictly with integer minor units (cents) and currency codes", () => {
      const spec = DataModelGeneratorService.buildDomainModelSpec({
        entityName: "Product",
        description: "Catalog product with price",
        moneyFields: [{ name: "price", currency: "USD" }],
      });

      expect(spec.moneySpecs.length).toBe(1);
      expect(spec.moneySpecs[0].amountFieldName).toBe("priceCents");
      expect(spec.moneySpecs[0].currencyFieldName).toBe("priceCurrency");
      expect(spec.moneySpecs[0].minorUnits).toBe(2);

      // Verify fields in entity
      const priceCentsField = spec.entity.fields.find((f) => f.name === "priceCents");
      expect(priceCentsField?.type).toBe("number"); // SQL BIGINT/INTEGER
      expect(priceCentsField?.physicalColumnName).toBe("price_cents");
    });

    it("generates explicitly justified indexes with purpose rather than indiscriminate indexing", () => {
      const spec = DataModelGeneratorService.buildDomainModelSpec({
        entityName: "Invoice",
        description: "Billing invoices",
      });

      expect(spec.justifiedIndexes.length).toBeGreaterThan(0);
      for (const idx of spec.justifiedIndexes) {
        expect(idx.purpose).toBeDefined();
        expect(idx.supportedFilters.length).toBeGreaterThan(0);
        expect(idx.columns).toContain("tenant_id"); // Tenant scoping index invariant!
      }

      // Verify DDL reflects indexes
      expect(spec.migrationSql).toContain("CREATE INDEX IF NOT EXISTS");
      expect(spec.migrationSql).toContain("tenant_id");
    });
  });

  describe("4.3 Secure Application CRUD & Server-Owned Fields Protection", () => {
    it("allows valid DTO mutations while strictly rejecting server-owned and unknown fields", () => {
      const { dtoContract } = DataModelGeneratorService.buildDomainModelSpec({
        entityName: "Customer",
        description: "Customer entity",
      });

      // 1. Valid payload
      const validPayload = { title: "Acme Corp" };
      const validCheck = DataModelGeneratorService.validateIncomingMutation(
        validPayload,
        dtoContract,
        "CREATE"
      );
      expect(validCheck.isValid).toBe(true);

      // 2. Malicious payload trying to inject tenantId, status, or arbitrary admin fields
      const maliciousPayload = {
        title: "Malicious Co",
        tenantId: "stolen_tenant_id", // Server-owned!
        status: "ACTIVE", // Server-owned!
        injectedField: "exploit", // Unknown!
      };

      const invalidCheck = DataModelGeneratorService.validateIncomingMutation(
        maliciousPayload,
        dtoContract,
        "CREATE"
      );

      expect(invalidCheck.isValid).toBe(false);
      expect(invalidCheck.rejectedFields).toContain("tenantId");
      expect(invalidCheck.rejectedFields).toContain("status");
      expect(invalidCheck.rejectedFields).toContain("injectedField");
      expect(invalidCheck.error).toContain("unauthorized or server-owned fields");
    });
  });

  describe("4.4 Existing & Externally Managed Database Introspection", () => {
    it("introspects external schema read-only and classifies managed vs external objects", async () => {
      const report = await ExternalDatabaseIntrospectionService.introspectSchema(
        "postgres://user:pass@external.db:5432/crm",
        ["users"] // Only 'users' is managed
      );

      expect(report.isReadOnlySnapshot).toBe(true);
      expect(report.observedTables.length).toBeGreaterThan(0);

      const legacyTable = report.observedTables.find((t) => t.tableName === "legacy_orders");
      expect(legacyTable?.ownership).toBe("EXTERNAL_PRE_EXISTING");

      // Views and extensions classified
      expect(report.observedViews.length).toBeGreaterThan(0);
      expect(report.observedViews[0].supportStatus).toBe("UNSUPPORTED");
      expect(report.observedViews[0].warning).toContain("read-only");
    });

    it("strictly blocks migrations proposing to drop pre-existing external tables or views", async () => {
      const report = await ExternalDatabaseIntrospectionService.introspectSchema(
        "postgres://user:pass@external.db:5432/crm",
        ["users"]
      );

      const dangerousDdl = `
        DROP TABLE "legacy_orders";
        DROP VIEW "v_monthly_sales";
      `;

      const safetyCheck = ExternalDatabaseIntrospectionService.validateMigrationSafetyAgainstExternalObjects(
        dangerousDdl,
        report
      );

      expect(safetyCheck.isSafe).toBe(false);
      expect(safetyCheck.violations.length).toBe(2);
      expect(safetyCheck.violations[0]).toContain("Dangerous DDL");
      expect(safetyCheck.violations[0]).toContain("legacy_orders");
    });
  });
});
