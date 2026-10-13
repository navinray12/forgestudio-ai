/**
 * ForgeStudio Test Suite — Master Regression Gate: Points 40, 41, 42, and 43
 * End-to-End Integrated Lifecycle Verification
 */

import { describe, it, expect } from "vitest";
import { contractFirstApiGenerator } from "../services/api/contractFirstApiGenerator.service.js";
import { applicationAuth } from "../services/auth/applicationAuth.service.js";
import { unifiedExecutionAuthorization } from "../services/auth/unifiedExecutionAuthorization.service.js";
import { databaseStudioViews } from "../services/database/databaseStudioViews.service.js";
import { EnvironmentBindingService } from "../services/environment/environmentBinding.service.js";
import { TargetResolutionService } from "../services/environment/targetResolution.service.js";
import { MemoryEnvironmentBindingStore } from "./helpers/memoryBindingStore.js";
import { unifiedMigrationAuthority } from "../services/migration/unifiedMigrationAuthority.service.js";
import { ApplicationSpec } from "../services/authoritative/applicationSpec.service.js";

describe("Points 40–43 Master Regression Gate", () => {
  const projectId = "proj_gate_40_43";
  const applicationId = "app_gate_40_43";
  const tenantId = "tenant_enterprise";

  const appSpec: ApplicationSpec = {
    schemaVersion: "1.0.0",
    applicationId,
    projectId,
    tenantId,
    revision: 1,
    parentRevision: 0,
    frameworkProfile: "node-express",
    identityStrategy: "MULTI_TENANT_ROW",
    requirementIds: ["REQ-GATE-40", "REQ-GATE-41", "REQ-GATE-42", "REQ-GATE-43"],
    entities: [
      {
        id: "ent_account",
        name: "Account",
        physicalTableName: "app_accounts",
        isSoftDeletable: true,
        isAudited: true,
        fields: [
          {
            id: "fld_acc_id",
            name: "id",
            physicalColumnName: "id",
            type: "uuid",
            isNullable: false,
            sensitivity: "PUBLIC",
            visibility: "READ_ONLY",
            lifecycleOwnership: "SYSTEM",
          },
          {
            id: "fld_acc_balance",
            name: "balanceCents",
            physicalColumnName: "balance_cents",
            type: "number",
            isNullable: false,
            sensitivity: "INTERNAL",
            visibility: "READ_WRITE",
            lifecycleOwnership: "USER",
          },
        ],
      },
    ],
    relationships: [],
    operations: [
      {
        id: "op_get_account",
        name: "getAccount",
        type: "QUERY",
        method: "GET",
        routePath: "/api/accounts/:id",
        summary: "Get account details",
        targetEntityId: "ent_account",
        requiredScopes: ["read:accounts"],
        transactionBoundary: "NONE",
        requiresIdempotencyKey: false,
        declaredSideEffects: [],
      },
      {
        id: "op_create_account",
        name: "createAccount",
        type: "MUTATION",
        method: "POST",
        routePath: "/api/accounts",
        summary: "Create account",
        targetEntityId: "ent_account",
        requiredScopes: ["write:accounts"],
        transactionBoundary: "ATOMIC_TRANSACTION",
        requiresIdempotencyKey: true,
        declaredSideEffects: ["AUDIT_LOG"],
      },
    ],
    actors: [
      {
        id: "act_owner",
        name: "Account Owner",
        description: "Primary authorized actor",
        assignedRoles: ["OWNER"],
        isDefault: true,
      },
    ],
    policies: [],
    frontendBindings: [],
    jobs: [],
    retentionPolicies: [],
    acceptanceContracts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Binding persistence is verified separately on PostgreSQL (environment-bindings.integration.test.ts).
  const environmentBindingService = new EnvironmentBindingService(new MemoryEnvironmentBindingStore());
  const targetResolutionService = new TargetResolutionService(environmentBindingService);

  it("executes unified end-to-end lifecycle across Points 40, 41, 42, and 43", async () => {
    // -------------------------------------------------------------------------
    // Phase 1 (Point 40): Contract-First API & Identity Verification
    // -------------------------------------------------------------------------
    const apiArtifacts = contractFirstApiGenerator.generateContractFirstArtifacts(appSpec);
    expect(apiArtifacts.openApiSpec.openapi).toBe("3.1.0");
    expect(apiArtifacts.frontendClient.stateTypesSource).toContain("SUCCESS_COMMITTED");

    // Fresh-host unseeded identity
    const freshHost = applicationAuth.initializeFreshHost(applicationId);
    expect(freshHost.accountsSeeded).toBe(0);

    const { user } = applicationAuth.registerUser(
      applicationId,
      tenantId,
      "treasurer@enterprise.com",
      "RobustEnterprisePassword456!",
      "FINANCE"
    );
    expect(user.email).toBe("treasurer@enterprise.com");

    const login = applicationAuth.loginUser(applicationId, "treasurer@enterprise.com", "RobustEnterprisePassword456!");
    const sessionVerification = applicationAuth.verifySession(login.token);
    expect(sessionVerification.valid).toBe(true);

    const sanitizedPublicConfig = applicationAuth.buildSanitizedPublicConfig(
      applicationId,
      "https://api.enterprise.cloud",
      ["accounts"]
    );
    expect(sanitizedPublicConfig.authAudience).toBe("APPLICATION_END_USER");

    // Unified authorization check
    const authDecision = unifiedExecutionAuthorization.evaluateAuthorization({
      transport: "HTTP_ENDPOINT",
      subject: {
        userId: user.id,
        tenantId,
        applicationId,
        roles: ["FINANCE"],
        scopes: ["read:accounts"],
      },
      targetTenantId: tenantId,
      requestedFields: ["id", "balanceCents", "passwordHash"],
    });
    expect(authDecision.allowed).toBe(true);
    expect(authDecision.permittedDatabaseRole).toBe("runtime_app");
    expect(authDecision.maskedFields).toContain("passwordHash");

    // -------------------------------------------------------------------------
    // Phase 2 (Point 42): Environment Bindings, Secrets & Isolation
    // -------------------------------------------------------------------------
    const devBinding = await environmentBindingService.registerBinding(projectId, applicationId, "DEVELOPMENT", {
      secretRef: `vault:keys:${projectId}:dev_db`,
    });
    expect(devBinding.protectionLevel).toBe("SANDBOX");

    const prodBinding = await environmentBindingService.registerBinding(projectId, applicationId, "PRODUCTION", {
      secretRef: `vault:keys:${projectId}:prod_db`,
      stepUpVerified: true,
    });
    expect(prodBinding.protectionLevel).toBe("RESTRICTED_PRODUCTION");

    // Target pool resolution
    const devPool = await targetResolutionService.resolveTargetPool(projectId, "DEVELOPMENT", "runtime");
    expect(devPool.status).toBe("ACTIVE");

    // Credential rotation with obsolete pool draining
    const rotatedDevBinding = await environmentBindingService.registerBinding(projectId, applicationId, "DEVELOPMENT", {
      secretRef: `vault:keys:${projectId}:dev_db_v2`,
    });
    const drainedResult = await targetResolutionService.rotateCredentialsAndDrain(rotatedDevBinding);
    expect(drainedResult.drainedPoolKeys.length).toBeGreaterThan(0);

    // Scratch database verification
    const scratchDb = targetResolutionService.verifyShadowDatabase({
      targetId: "scratch_99",
      environment: "DEVELOPMENT",
      isDisposable: true,
      endpoint: "scratch.internal:5432",
    });
    expect(scratchDb.isDisposable).toBe(true);

    // -------------------------------------------------------------------------
    // Phase 3 (Point 41): One Consistent Database Schema Studio Views
    // -------------------------------------------------------------------------
    const overview = databaseStudioViews.getOverviewView(projectId, "DEVELOPMENT");
    expect(overview.viewName).toBe("Overview");

    const modelDesigner = databaseStudioViews.getModelDesignerView(projectId, "DEVELOPMENT");
    expect(modelDesigner.viewName).toBe("Model Designer");

    const relationships = databaseStudioViews.getRelationshipView(projectId, "DEVELOPMENT");
    expect(relationships.viewName).toBe("Relationship View");

    const schemaInspector = databaseStudioViews.getSchemaInspectorView(projectId, "DEVELOPMENT");
    expect(schemaInspector.viewName).toBe("Schema Inspector");

    const changePlanner = databaseStudioViews.getChangePlannerView(projectId, "PRODUCTION", [
      { type: "ADD_COLUMN", description: "Add currency code" },
    ]);
    expect(changePlanner.impactClassification).toBe("SAFE_ADDITIVE");

    const migrationHistory = databaseStudioViews.getMigrationHistoryView(projectId, "DEVELOPMENT");
    expect(migrationHistory.viewName).toBe("Migration History");

    const dataBrowserProd = databaseStudioViews.getDataBrowserView(projectId, "PRODUCTION", "app_accounts");
    expect(dataBrowserProd.isReadOnlyByDefault).toBe(true);

    const apiExplorer = databaseStudioViews.getApiBindingExplorerView(projectId, "DEVELOPMENT");
    expect(apiExplorer.viewName).toBe("API/Binding Explorer");

    const envsView = databaseStudioViews.getEnvironmentsView(projectId);
    expect(envsView.environments.length).toBe(3);

    const recoveryView = databaseStudioViews.getRecoveryView(projectId, "DEVELOPMENT");
    expect(recoveryView.verifiedBackups.length).toBeGreaterThan(0);

    // Field rename preservation
    const renamePreserve = databaseStudioViews.renameFieldSafely("ent_account", "fld_acc_balance", "balance_cents", "balance_minor");
    expect(renamePreserve.isDestructive).toBe(false);

    // -------------------------------------------------------------------------
    // Phase 4 (Point 43): Unified Migration Authority & Upgrade Lifecycle
    // -------------------------------------------------------------------------
    const namespace = `ns_${projectId}`;
    unifiedMigrationAuthority.claimNamespaceAuthority(namespace, "FORGE_MANAGED");

    const migPlan = unifiedMigrationAuthority.createMigrationPlan(
      projectId,
      devBinding.bindingId,
      namespace,
      "FORGE_MANAGED",
      [
        "CREATE TABLE app_accounts (id uuid primary key, balance_cents int NOT NULL);",
        "CREATE INDEX CONCURRENTLY idx_acc_balance ON app_accounts (balance_cents);",
      ]
    );
    expect(migPlan.state).toBe("planned");

    const rehearsals = unifiedMigrationAuthority.rehearseMigrationPlan(migPlan.planId);
    expect(rehearsals.state).toBe("rehearsed");

    unifiedMigrationAuthority.approveMigrationPlan(migPlan.planId, user.id);
    const migExec = unifiedMigrationAuthority.executeMigrationPlan(migPlan.planId);
    expect(migExec.state).toBe("applied");

    // Uncertain outcome reconciliation
    const reconciliation = unifiedMigrationAuthority.reconcileUncertainOutcome(migPlan.planId, [
      migPlan.targetSchemaHash,
    ]);
    expect(reconciliation.reconciledState).toBe("applied");
  });
});
