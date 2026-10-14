/**
 * ForgeStudio Test Suite — Blueprint Point 46:
 * Reconcile Architecture and API Contracts
 */

import { describe, it, expect } from "vitest";
import { controlPlaneReconciliationService } from "../services/architecture/controlPlaneReconciliation.service.js";

describe("Point 46 — Reconcile Architecture and API Contracts", () => {
  const projectId = "proj_reconcile_46";

  it("46.1 Builds standardized safe error envelopes and sanitizes embedded secrets", () => {
    const rawError = new Error("Failed to connect: postgresql://app_user:ultraSecretPass123@db.prod:5432/main");
    const envelope = controlPlaneReconciliationService.buildSafeErrorEnvelope(
      "DATABASE_CONNECTION_ERROR",
      rawError,
      500,
      "res_db_pool_1"
    );

    expect(envelope.success).toBe(false);
    expect(envelope.error.code).toBe("DATABASE_CONNECTION_ERROR");
    expect(envelope.error.operationId).toMatch(/^op_[a-f0-9]{12}$/);
    expect(envelope.error.affectedResourceId).toBe("res_db_pool_1");
    expect(envelope.error.remediationGuidance).toContain("Transient server or infrastructure error");

    // Must NOT contain sensitive credentials
    expect(envelope.error.message).not.toContain("ultraSecretPass123");
    expect(envelope.error.message).toContain("[REDACTED_CREDENTIALS]");
  });

  it("46.2 Includes concurrency revisions in conflict error envelopes", () => {
    const envelope = controlPlaneReconciliationService.buildSafeErrorEnvelope(
      "STALE_REVISION_CONFLICT",
      "Resource was modified by another operator",
      409,
      "task_9918",
      2,
      4
    );

    expect(envelope.error.code).toBe("STALE_REVISION_CONFLICT");
    expect(envelope.error.expectedRevision).toBe(2);
    expect(envelope.error.actualRevision).toBe(4);
    expect(envelope.error.remediationGuidance).toContain("Reload the latest resource revision");
  });

  it("46.3 Validates generated package manifest completeness across all 11 required tiers", () => {
    const completeManifest = {
      frontendPages: ["pages/index.tsx", "pages/tasks.tsx"],
      backendDomainModules: ["domain/task.service.ts", "domain/project.service.ts"],
      workerModules: ["workers/outboxConsumer.ts"],
      runtimeSchemasAndClients: ["schemas/task.schema.ts", "clients/apiClient.ts"],
      serverOnlyDomainModules: ["server/db.ts", "server/auth.ts"],
      databaseMigrations: ["migrations/001_initial.sql"],
      specificationsAndManifests: ["ApplicationSpec.json", "SourceManifest.json"],
      environmentRequirements: [".env.example", "config.schema.json"],
      testSuites: ["tests/integration.test.ts", "tests/e2e.test.ts"],
      infrastructureConfig: ["Dockerfile", "docker-compose.yml"],
      toolingAndDocumentation: ["README.md", "package-lock.json"],
    };

    const validation = controlPlaneReconciliationService.validateGeneratedPackageManifest(completeManifest);

    expect(validation.isValid).toBe(true);
    expect(validation.missingTiers.length).toBe(0);
    expect(validation.packageDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(validation.errors.length).toBe(0);
  });

  it("46.4 Disqualifies generated package when any required artifact tier is missing or empty", () => {
    const incompleteManifest = {
      frontendPages: ["pages/index.tsx"],
      backendDomainModules: ["domain/task.service.ts"],
      // Missing workers, migrations, tests, etc.
      toolingAndDocumentation: ["README.md"],
    };

    const validation = controlPlaneReconciliationService.validateGeneratedPackageManifest(incompleteManifest);

    expect(validation.isValid).toBe(false);
    expect(validation.missingTiers.length).toBeGreaterThan(0);
    expect(validation.missingTiers).toContain("workerModules");
    expect(validation.missingTiers).toContain("databaseMigrations");
    expect(validation.missingTiers).toContain("testSuites");
    expect(validation.errors[0]).toContain("DISQUALIFIED_PACKAGE_MANIFEST");
  });

  it("46.5 Performs layer-specific diagnostic verification for bound environment", async () => {
    const result = await controlPlaneReconciliationService.verifyLayerDiagnostics(
      projectId,
      "env_staging_east",
      ["CONTROL_PLANE_API", "APPLICATION_RUNTIME", "DATABASE_STORAGE", "DOMAIN_EVENT_BUS"]
    );

    expect(result.projectId).toBe(projectId);
    expect(result.environmentId).toBe("env_staging_east");
    expect(result.overallHealthy).toBe(true);
    expect(result.layers.length).toBe(4);

    for (const layer of result.layers) {
      expect(layer.status).toBe("HEALTHY");
      expect(layer.latencyMs).toBeGreaterThan(0);
      expect(layer.evidence).toBeDefined();
    }
  });
});
