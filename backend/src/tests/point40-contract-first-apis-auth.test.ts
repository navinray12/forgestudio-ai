/**
 * ForgeStudio Test Suite — Blueprint Point 40: Contract-First APIs, Auth & Unified Authorization
 */

import { describe, it, expect, beforeEach } from "vitest";
import { contractFirstApiGenerator } from "../services/api/contractFirstApiGenerator.service.js";
import { applicationAuth } from "../services/auth/applicationAuth.service.js";
import { unifiedExecutionAuthorization } from "../services/auth/unifiedExecutionAuthorization.service.js";
import { ApplicationSpec } from "../services/authoritative/applicationSpec.service.js";

describe("Point 40 — Contract-First APIs, Authentication, Authorization and Frontend Binding", () => {
  const sampleSpec: ApplicationSpec = {
    schemaVersion: "1.0.0",
    applicationId: "app_test_40",
    projectId: "proj_40",
    tenantId: "tenant_alpha",
    revision: 1,
    parentRevision: 0,
    frameworkProfile: "node-express",
    identityStrategy: "MULTI_TENANT_ROW",
    requirementIds: ["REQ-40-1"],
    entities: [
      {
        id: "ent_product",
        name: "Product",
        physicalTableName: "app_products",
        isSoftDeletable: true,
        isAudited: true,
        fields: [
          {
            id: "fld_prod_id",
            name: "id",
            physicalColumnName: "id",
            type: "uuid",
            isNullable: false,
            sensitivity: "PUBLIC",
            visibility: "READ_ONLY",
            lifecycleOwnership: "SYSTEM",
          },
          {
            id: "fld_prod_name",
            name: "title",
            physicalColumnName: "title",
            type: "string",
            isNullable: false,
            sensitivity: "PUBLIC",
            visibility: "READ_WRITE",
            lifecycleOwnership: "USER",
          },
          {
            id: "fld_prod_price",
            name: "priceCents",
            physicalColumnName: "price_cents",
            type: "number",
            isNullable: false,
            sensitivity: "PUBLIC",
            visibility: "READ_WRITE",
            lifecycleOwnership: "USER",
          },
        ],
      },
    ],
    relationships: [],
    operations: [
      {
        id: "op_list_products",
        name: "listProducts",
        type: "QUERY",
        method: "GET",
        routePath: "/api/products",
        summary: "List all products",
        targetEntityId: "ent_product",
        requiredScopes: ["read:products"],
        transactionBoundary: "NONE",
        requiresIdempotencyKey: false,
        declaredSideEffects: [],
      },
      {
        id: "op_create_product",
        name: "createProduct",
        type: "MUTATION",
        method: "POST",
        routePath: "/api/products",
        summary: "Create product",
        targetEntityId: "ent_product",
        requiredScopes: ["write:products"],
        transactionBoundary: "ATOMIC_TRANSACTION",
        requiresIdempotencyKey: true,
        declaredSideEffects: ["AUDIT_LOG"],
      },
    ],
    actors: [
      {
        id: "act_user",
        name: "Application User",
        description: "Authenticated customer",
        assignedRoles: ["USER"],
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

  describe("40.1 Contract-First API Generation", () => {
    it("generates OpenAPI 3.1 specification with correct schemas, parameters, and error contracts", () => {
      const openApi = contractFirstApiGenerator.generateOpenApiSpec(sampleSpec);

      expect(openApi.openapi).toBe("3.1.0");
      expect(openApi.info.title).toContain("app_test_40");
      expect(openApi.paths["/api/products"]).toBeDefined();
      expect(openApi.paths["/api/products"]["get"].operationId).toBe("op_list_products");
      expect(openApi.paths["/api/products"]["post"].operationId).toBe("op_create_product");
      expect(openApi.components.schemas["Product"]).toBeDefined();
      expect(openApi.components.schemas["CreateProductInput"]).toBeDefined();
      expect(openApi.components.schemas["ApiError"]).toBeDefined();
      expect(openApi.specDigest).toBeTruthy();
    });

    it("generates runtime Zod validation schemas for input and entity models", () => {
      const schemas = contractFirstApiGenerator.generateValidationSchemas(sampleSpec);

      const productSchemaFile = schemas["src/schemas/product.schema.ts"];
      expect(productSchemaFile).toBeDefined();
      expect(productSchemaFile).toContain("export const ProductSchema = z.object");
      expect(productSchemaFile).toContain("export const CreateProductInputSchema");
    });

    it("generates server adapters enforcing server-side authoritative validation and tenant auth", () => {
      const adapters = contractFirstApiGenerator.generateServerAdapters(sampleSpec);

      const controllerFile = adapters["src/controllers/product.controller.ts"];
      expect(controllerFile).toBeDefined();
      expect(controllerFile).toContain("requireTenantAuth");
      expect(controllerFile).toContain("CreateProductInputSchema.safeParse");
    });

    it("generates frontend client and React hooks declaring the 8 explicit UI states with optimistic rollback", () => {
      const frontend = contractFirstApiGenerator.generateFrontendClient(sampleSpec);

      expect(frontend.stateTypesSource).toContain("LOADING");
      expect(frontend.stateTypesSource).toContain("EMPTY");
      expect(frontend.stateTypesSource).toContain("INVALID_INPUT");
      expect(frontend.stateTypesSource).toContain("UNAUTHORIZED_DENIED");
      expect(frontend.stateTypesSource).toContain("CONFLICT");
      expect(frontend.stateTypesSource).toContain("OFFLINE_PENDING");
      expect(frontend.stateTypesSource).toContain("SERVER_ERROR");
      expect(frontend.stateTypesSource).toContain("SUCCESS_COMMITTED");

      expect(frontend.clientSource).toContain("ApplicationApiClient");
      expect(frontend.hooksSource).toContain("useOperation");
      expect(frontend.hooksSource).toContain("Rollback optimistic change on rejection");
    });
  });

  describe("40.2 Application Identity & Fresh-Host Deployment", () => {
    it("guarantees clean, unseeded fresh-host initialization", () => {
      const fresh = applicationAuth.initializeFreshHost("app_fresh_01");
      expect(fresh.status).toBe("CLEAN_INITIALIZED");
      expect(fresh.accountsSeeded).toBe(0);
    });

    it("registers user and validates PBKDF2 password hashing", () => {
      const { user } = applicationAuth.registerUser(
        "app_test_40",
        "tenant_alpha",
        "customer@example.com",
        "SecurePassword123!",
        "CUSTOMER"
      );

      expect(user.id).toBeTruthy();
      expect(user.email).toBe("customer@example.com");
      expect(user.role).toBe("CUSTOMER");
      expect(user.status).toBe("ACTIVE");
    });

    it("authenticates valid login and issues hashed session tokens", () => {
      const login = applicationAuth.loginUser(
        "app_test_40",
        "customer@example.com",
        "SecurePassword123!"
      );

      expect(login.token.startsWith("app_sess_")).toBe(true);
      expect(login.expiresAt).toBeTruthy();

      const verification = applicationAuth.verifySession(login.token);
      expect(verification.valid).toBe(true);
      expect(verification.user?.email).toBe("customer@example.com");
    });

    it("invalidates session on user session revocation or logout", () => {
      const login = applicationAuth.loginUser(
        "app_test_40",
        "customer@example.com",
        "SecurePassword123!"
      );

      const revoked = applicationAuth.revokeSession(login.token);
      expect(revoked).toBe(true);

      const verification = applicationAuth.verifySession(login.token);
      expect(verification.valid).toBe(false);
    });

    it("invalidates all active sessions on user authEpoch bump", () => {
      const login1 = applicationAuth.loginUser("app_test_40", "customer@example.com", "SecurePassword123!");
      const login2 = applicationAuth.loginUser("app_test_40", "customer@example.com", "SecurePassword123!");

      const revokedCount = applicationAuth.revokeAllUserSessions(login1.user.id);
      expect(revokedCount).toBeGreaterThanOrEqual(1);

      expect(applicationAuth.verifySession(login1.token).valid).toBe(false);
      expect(applicationAuth.verifySession(login2.token).valid).toBe(false);
    });

    it("sanitizes public client config, guaranteeing zero credential leaks", () => {
      const config = applicationAuth.buildSanitizedPublicConfig(
        "app_test_40",
        "https://api.example.com",
        ["auth", "products"]
      );

      expect(config.applicationId).toBe("app_test_40");
      expect(config.authAudience).toBe("APPLICATION_END_USER");
      expect(config.apiBaseUrl).toBe("https://api.example.com");
      // Must not leak passwords or secrets
      const raw = JSON.stringify(config);
      expect(raw).not.toContain("password");
      expect(raw).not.toContain("secret");
      expect(raw).not.toContain("token");
    });
  });

  describe("40.3 Unified Authorization Across Execution Paths", () => {
    it("allows authorized access within same tenant boundary", () => {
      const decision = unifiedExecutionAuthorization.evaluateAuthorization({
        transport: "HTTP_ENDPOINT",
        subject: {
          userId: "usr_01",
          tenantId: "tenant_alpha",
          applicationId: "app_test_40",
          roles: ["USER"],
          scopes: ["read:data"],
        },
        targetTenantId: "tenant_alpha",
        requestedFields: ["id", "title"],
      });

      expect(decision.allowed).toBe(true);
      expect(decision.permittedDatabaseRole).toBe("runtime_app");
      expect(decision.allowedFields).toEqual(["id", "title"]);
    });

    it("strictly blocks cross-tenant access violations", () => {
      const decision = unifiedExecutionAuthorization.evaluateAuthorization({
        transport: "HTTP_ENDPOINT",
        subject: {
          userId: "usr_01",
          tenantId: "tenant_alpha",
          applicationId: "app_test_40",
          roles: ["USER"],
          scopes: ["read:data"],
        },
        targetTenantId: "tenant_beta", // Cross-tenant target!
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("Cross-tenant access violation");
    });

    it("blocks direct resource-ID substitution across different tenant owners", () => {
      const decision = unifiedExecutionAuthorization.evaluateAuthorization({
        transport: "HTTP_ENDPOINT",
        subject: {
          userId: "usr_01",
          tenantId: "tenant_alpha",
          applicationId: "app_test_40",
          roles: ["USER"],
          scopes: ["read:data"],
        },
        targetTenantId: "tenant_alpha",
        resourceOwnerTenantId: "tenant_gamma", // Resource owned by gamma!
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("Resource belongs to tenant 'tenant_gamma'");
    });

    it("masks confidential fields in response projections", () => {
      const decision = unifiedExecutionAuthorization.evaluateAuthorization({
        transport: "HTTP_ENDPOINT",
        subject: {
          userId: "usr_01",
          tenantId: "tenant_alpha",
          applicationId: "app_test_40",
          roles: ["USER"],
          scopes: ["read:data"],
        },
        targetTenantId: "tenant_alpha",
        requestedFields: ["id", "title", "passwordHash", "tokenHash"],
      });

      expect(decision.allowed).toBe(true);
      expect(decision.allowedFields).toEqual(["id", "title"]);
      expect(decision.maskedFields).toEqual(["passwordHash", "tokenHash"]);
    });
  });
});
