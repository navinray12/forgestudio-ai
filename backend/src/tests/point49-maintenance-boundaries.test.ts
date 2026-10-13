/**
 * ForgeStudio Test Suite — Blueprint Point 49:
 * Evidence and Maintenance Boundaries Verification (A21-R1 through A21-R10)
 */

import { describe, it, expect } from "vitest";
import { MaintenanceBoundariesService } from "../services/architecture/maintenanceBoundaries.service.js";

describe("Point 49 — Maintenance Boundaries Verification (A21-R1 through A21-R10)", () => {
  it("49.1 A21-R1: Validates AST surgical edits and protects user code regions", () => {
    // Compliant edit preserving markers
    const compliant = MaintenanceBoundariesService.validateAstSurgicalEdit({
      originalCode: "import React from 'react';\n/* FORGE:CUSTOM_LOGIC_START */\nconst custom = 42;\n/* FORGE:CUSTOM_LOGIC_END */\nexport default custom;",
      modifiedCode: "import React from 'react';\n/* FORGE:CUSTOM_LOGIC_START */\nconst custom = 42;\n/* FORGE:CUSTOM_LOGIC_END */\nexport default custom;\n// Added footer",
      hasProtectedRegions: true,
    });
    expect(compliant.compliant).toBe(true);

    // Violation: marker removed
    const violated = MaintenanceBoundariesService.validateAstSurgicalEdit({
      originalCode: "import React from 'react';\n/* FORGE:CUSTOM_LOGIC_START */\nconst custom = 42;\n/* FORGE:CUSTOM_LOGIC_END */",
      modifiedCode: "import React from 'react';\nexport default function App() { return <div>Replaced!</div>; }",
      hasProtectedRegions: true,
    });
    expect(violated.compliant).toBe(false);
    expect(violated.violations[0]).toContain("A21-R1");
  });

  it("49.2 A21-R2: Validates routing conventions and prevents route collisions", () => {
    // Compliant: pure App Router
    const compliant = MaintenanceBoundariesService.validateRoutingConventions({
      targetProfile: "MANAGED_DECLARATIVE",
      registeredPaths: ["app/page.tsx", "app/about/page.tsx", "app/pricing/page.tsx"],
    });
    expect(compliant.compliant).toBe(true);

    // Violation: mixed app/ and pages/ routes
    const violatedMixed = MaintenanceBoundariesService.validateRoutingConventions({
      targetProfile: "MANAGED_DECLARATIVE",
      registeredPaths: ["app/page.tsx", "pages/about.tsx"],
    });
    expect(violatedMixed.compliant).toBe(false);
    expect(violatedMixed.violations[0]).toContain("A21-R2");

    // Violation: slug collision
    const violatedCollision = MaintenanceBoundariesService.validateRoutingConventions({
      targetProfile: "MANAGED_DECLARATIVE",
      registeredPaths: ["app/about/page.tsx", "app/about/page.tsx"],
    });
    expect(violatedCollision.compliant).toBe(false);
  });

  it("49.3 A21-R3: Enforces pinned framework and Prisma versions matrix", () => {
    // Compliant dependencies
    const compliant = MaintenanceBoundariesService.validateFrameworkVersionCompliance({
      "next": "14.2.5",
      "react": "18.3.1",
      "prisma": "5.19.1",
      "@prisma/client": "5.19.1",
      "typescript": "5.5.4",
    });
    expect(compliant.compliant).toBe(true);

    // Violation: Next.js upgraded to major 15 without migration gate
    const violated = MaintenanceBoundariesService.validateFrameworkVersionCompliance({
      "next": "15.0.1",
      "react": "19.0.0",
      "prisma": "5.19.1",
    });
    expect(violated.compliant).toBe(false);
    expect(violated.violations.length).toBeGreaterThanOrEqual(1);
  });

  it("49.4 A21-R4: Strictly prohibits inferring multi-tenancy from search_path alone", () => {
    // Violation: uses search_path only
    const violated = MaintenanceBoundariesService.validateTenantAuthorizationPolicy({
      usesSearchPathOnly: true,
      rlsEnabled: false,
      tenantIdScoped: false,
      credentialsScoped: false,
    });
    expect(violated.compliant).toBe(false);
    expect(violated.violations[0]).toContain("A21-R4");

    // Compliant: RLS + tenantId scoped
    const compliant = MaintenanceBoundariesService.validateTenantAuthorizationPolicy({
      usesSearchPathOnly: false,
      rlsEnabled: true,
      tenantIdScoped: true,
      credentialsScoped: true,
    });
    expect(compliant.compliant).toBe(true);
  });

  it("49.5 A21-R5: Prohibits executing nontransactional DDL inside transaction blocks", () => {
    const concurrentSql = "CREATE INDEX CONCURRENTLY idx_users_email ON users(email);";

    // Violation: executed inside transaction block
    const violated = MaintenanceBoundariesService.validateNontransactionalDdl(concurrentSql, true);
    expect(violated.compliant).toBe(false);
    expect(violated.violations[0]).toContain("A21-R5");

    // Compliant: executed outside transaction block
    const compliant = MaintenanceBoundariesService.validateNontransactionalDdl(concurrentSql, false);
    expect(compliant.compliant).toBe(true);
  });

  it("49.6 A21-R6: Enforces strict separation between platform sessions and tenant app tokens", () => {
    // Violation: tenant application token accessing platform admin API
    const violated = MaintenanceBoundariesService.validateSessionTokenBoundary({
      tokenAudience: "TENANT_APPLICATION",
      requestedEndpointType: "PLATFORM_ADMIN",
    });
    expect(violated.compliant).toBe(false);
    expect(violated.violations[0]).toContain("A21-R6");

    // Compliant: platform session on admin API
    const compliant = MaintenanceBoundariesService.validateSessionTokenBoundary({
      tokenAudience: "FORGE_STUDIO_PLATFORM",
      requestedEndpointType: "PLATFORM_ADMIN",
    });
    expect(compliant.compliant).toBe(true);
  });

  it("49.7 A21-R7: Rejects treating dated competitor intelligence as fresh without evidence", () => {
    // Violation: dated 2023 claim with no fresh verification report
    const violated = MaintenanceBoundariesService.validateCompetitorEvidenceFreshness({
      topic: "wix-studio-ast-parity",
      lastInspectedDate: "2023-08-15",
      hasFreshVerificationReport: false,
      currentCodeRevision: "483dbfb183bf71d957f7c0b465466dcea9b82706",
    });
    expect(violated.compliant).toBe(false);
    expect(violated.violations[0]).toContain("A21-R7");

    // Compliant: fresh revalidated evidence
    const compliant = MaintenanceBoundariesService.validateCompetitorEvidenceFreshness({
      topic: "wix-studio-ast-parity",
      lastInspectedDate: "2026-10-12",
      hasFreshVerificationReport: true,
      currentCodeRevision: "483dbfb183bf71d957f7c0b465466dcea9b82706",
    });
    expect(compliant.compliant).toBe(true);
  });

  it("49.8 Comprehensive evaluation confirms all 10 maintenance boundaries pass baseline check", () => {
    const evaluation = MaintenanceBoundariesService.evaluateAllBoundaries();
    expect(evaluation.allCompliant).toBe(true);
    expect(evaluation.results.length).toBe(10);

    const boundaryIds = evaluation.results.map(r => r.boundaryId);
    expect(boundaryIds).toContain("A21-R1");
    expect(boundaryIds).toContain("A21-R2");
    expect(boundaryIds).toContain("A21-R3");
    expect(boundaryIds).toContain("A21-R4");
    expect(boundaryIds).toContain("A21-R5");
    expect(boundaryIds).toContain("A21-R6");
    expect(boundaryIds).toContain("A21-R7");
    expect(boundaryIds).toContain("A21-R8");
    expect(boundaryIds).toContain("A21-R9");
    expect(boundaryIds).toContain("A21-R10");
  });
});
