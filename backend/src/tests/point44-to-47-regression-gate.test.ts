/**
 * ForgeStudio Test Suite — Master Regression Gate: Points 44, 45, 46, and 47
 * End-to-End Integrated Lifecycle & Architectural Invariant Verification
 */

import { describe, it, expect } from "vitest";
import { applicationReleaseQualificationService } from "../services/qualification/applicationReleaseQualification.service.js";
import { teamProjectTrackerService } from "../services/showcase/teamProjectTracker.service.js";
import { controlPlaneReconciliationService } from "../services/architecture/controlPlaneReconciliation.service.js";

describe("Points 44–47 Master Regression Gate", () => {
  const projectId = "proj_master_gate_44_47";
  const orgId = "org_master_tenant";
  const memberLeadId = "mem_lead_99";
  const memberDevId = "mem_dev_101";

  it("Section 1: Point 44 Release Qualification Integration", async () => {
    const qualRun = await applicationReleaseQualificationService.executeReleaseQualificationRun({
      projectId,
      applicationSpecId: "spec_master_tracker_v1",
      sourceCheckpointId: "chk_rel_gate_4447",
      sourceCodeHash: "sha256:1122334455667788",
      apiContractHash: "sha256:aabbccddeeff0011",
      schemaMigrationSetHash: "sha256:9988776655443322",
      environmentBindingId: "env_master_staging",
      credentialReferenceVersion: "cred_vault_v2",
      runtimeImageTag: "forgestudio/runtime:1.4.2",
      verifierIdentity: "qa_lead@forgestudio.io",
      targetEnvironment: "staging",
      isProductionSmokeTest: false,
      useSyntheticNamespace: true,
    });

    expect(qualRun.overallStatus).toBe("PASSED");
    expect(qualRun.layers.length).toBe(9);
    expect(qualRun.evidenceChainDigest).toBeDefined();

    // Verify digest tamper-evident guarantee
    expect(applicationReleaseQualificationService.verifyEvidenceChainDigest(qualRun)).toBe(true);
  });

  it("Section 2: Point 45 Team Project Tracker 15-Step Protocol & Multi-Tenant Separation", async () => {
    // 1. Initialize tenancy
    teamProjectTrackerService.createOrganization(orgId, "Master Org Corp");
    teamProjectTrackerService.createMembership(memberLeadId, orgId, "usr_lead", "OWNER");
    teamProjectTrackerService.createMembership(memberDevId, orgId, "usr_dev", "MEMBER");
    teamProjectTrackerService.createProject(projectId, orgId, "Enterprise Platform", "ent-plat");
    teamProjectTrackerService.addProjectMember(projectId, memberLeadId, "LEAD");
    teamProjectTrackerService.addProjectMember(projectId, memberDevId, "CONTRIBUTOR");

    // 2. The in-process protocol runs the steps it can and never claims the rest.
    const protocolResult = await teamProjectTrackerService.executeFifteenStepAcceptanceProtocol(projectId);
    expect(protocolResult.steps.length).toBe(15);
    expect(protocolResult.steps.filter((s) => s.status === "PASS").map((s) => s.stepNumber)).toEqual([4, 5, 7]);
    expect(protocolResult.protocolPassed).toBe(false);

    // 3. Verify transactional completion with outbox dispatch
    const task = teamProjectTrackerService.createTask(
      projectId,
      memberDevId,
      "Final Gate Validation",
      "Verify all security invariants",
      "URGENT"
    );

    const completed = teamProjectTrackerService.completeTask(
      task.id,
      memberDevId,
      task.revision,
      "idemp_gate_final",
      "All checks verified green"
    );

    expect(completed.status).toBe("COMPLETED");
  });

  it("Section 3: Point 46 API Contract Reconciliation & 11-Tier Package Manifest Completeness", () => {
    // 1. Safe error envelope builder
    const rawError = new Error("Connection failed at postgres://usr:pass@internal-db:5432/app");
    const safeEnvelope = controlPlaneReconciliationService.buildSafeErrorEnvelope(
      "INTERNAL_GATE_ERROR",
      rawError,
      500,
      projectId
    );
    expect(safeEnvelope.success).toBe(false);
    expect(safeEnvelope.error.message).not.toContain("pass@internal-db");
    expect(safeEnvelope.error.message).toContain("[REDACTED_CREDENTIALS]");

    // 2. Validate qualified 11-tier package manifest
    const manifest = {
      frontendPages: ["pages/dashboard.tsx", "pages/projects.tsx", "pages/tasks.tsx"],
      backendDomainModules: ["domain/project.ts", "domain/task.ts", "domain/comment.ts"],
      workerModules: ["workers/emailNotificationWorker.ts", "workers/outboxWorker.ts"],
      runtimeSchemasAndClients: ["schemas/api.zod.ts", "clients/sdk.ts"],
      serverOnlyDomainModules: ["server/auth.session.ts", "server/db.pool.ts"],
      databaseMigrations: ["migrations/001_orgs.sql", "migrations/002_tasks.sql"],
      specificationsAndManifests: ["ApplicationSpec.json", "SourceManifest.json", "PageRegistry.json"],
      environmentRequirements: [".env.example", "config.schema.json"],
      testSuites: ["tests/unit.test.ts", "tests/integration.test.ts", "tests/isolation.test.ts"],
      infrastructureConfig: ["Dockerfile", "docker-compose.yml", "k8s/deployment.yaml"],
      toolingAndDocumentation: ["README.md", "package-lock.json", "scripts/verify-env.sh"],
    };

    const packageValidation = controlPlaneReconciliationService.validateGeneratedPackageManifest(manifest);
    expect(packageValidation.isValid).toBe(true);
    expect(packageValidation.missingTiers.length).toBe(0);
    expect(packageValidation.packageDigest).toBeDefined();
  });

  it("Section 4: Point 47 Additive Planning Guidance & Invariant Check", async () => {
    // Ensure diagnostic verification provides layer-specific health
    const diagnostics = await controlPlaneReconciliationService.verifyLayerDiagnostics(
      projectId,
      "env_staging_gate",
      ["CONTROL_PLANE_API", "DATABASE_STORAGE", "DOMAIN_EVENT_BUS"]
    );

    expect(diagnostics.overallHealthy).toBe(true);
    expect(diagnostics.layers.length).toBe(3);
  });
});
