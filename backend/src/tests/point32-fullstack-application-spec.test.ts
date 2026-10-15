/**
 * ForgeStudio Execution Blueprint v2.1 — Points 31 & 32
 * Regression Test Suite: ApplicationSpec & Real Full-Stack Generation Pipeline
 */

import { describe, it, expect } from "vitest";
import {
  ApplicationSpec,
  ApplicationSpecService,
} from "../services/authoritative/applicationSpec.service.js";

describe("Point 32 — ApplicationSpec Domain Contract & Real Generator", () => {

  it("rejects invalid physical tables, index references, enum values and fractional revisions", () => {
    const spec: ApplicationSpec = {
      schemaVersion: "1.0.0", applicationId: "app_model_safe", projectId: "project_model",
      tenantId: "tenant_model", revision: 1.5, parentRevision: -1,
      frameworkProfile: "react-vite", identityStrategy: "SINGLE_TENANT_DEDICATED",
      requirementIds: [], entities: [
        {
          id: "ent_first", name: "First", physicalTableName: "shared_table",
          isSoftDeletable: true, isAudited: true,
          fields: [
            { id: "fld_kind", name: "kind", physicalColumnName: "kind", type: "enum",
              isNullable: false, sensitivity: "INTERNAL", visibility: "READ_WRITE",
              lifecycleOwnership: "USER", enumOptions: ["OPEN", "OPEN"] },
          ],
          indexes: [
            { name: "idx_kind", fields: ["does_not_exist"], isUnique: false },
            { name: "idx_kind", fields: ["kind", "kind"], isUnique: false },
          ],
        },
        {
          id: "ent_second", name: "Second", physicalTableName: "SHARED_TABLE",
          isSoftDeletable: true, isAudited: true,
          fields: [
            { id: "fld_bad", name: "bad", physicalColumnName: "bad; DROP TABLE x", type: "string",
              isNullable: false, sensitivity: "INTERNAL", visibility: "READ_WRITE",
              lifecycleOwnership: "USER" },
          ],
        },
      ],
      relationships: [], operations: [], actors: [], policies: [],
      frontendBindings: [], jobs: [], retentionPolicies: [], acceptanceContracts: [],
      createdAt: "2026-10-14T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z",
    };
    const validation = ApplicationSpecService.validateApplicationSpec(spec);
    expect(validation.valid).toBe(false);
    for (const fragment of [
      "revision must be a positive integer", "parentRevision must be a non-negative integer",
      "Duplicate physical table", "invalid physical column identifier", "enumOptions",
      "unknown field", "duplicate or invalid index name", "distinct, non-empty fields",
    ]) {
      expect(validation.errors.some((message) => message.includes(fragment)), fragment).toBe(true);
    }

    const safe: ApplicationSpec = {
      ...spec, revision: 1, parentRevision: 0,
      entities: [{
        ...spec.entities[0], physicalTableName: "tasks",
        fields: [{ ...spec.entities[0].fields[0], enumOptions: ["OPEN", "DONE"] }],
        indexes: [{ name: "idx_kind", fields: ["kind"], isUnique: false }],
      }],
    };
    expect(ApplicationSpecService.validateApplicationSpec(safe).valid).toBe(true);
  });

  it("rejects non-genesis first revisions and cross-tenant/project revision hijacks", async () => {
    const spec: ApplicationSpec = {
      schemaVersion: "1.0.0", applicationId: "app_ownership_v21", projectId: "project_original",
      tenantId: "tenant_original", revision: 1, parentRevision: 0,
      frameworkProfile: "react-vite", identityStrategy: "SINGLE_TENANT_DEDICATED",
      requirementIds: [], entities: [], relationships: [], operations: [], actors: [],
      policies: [], frontendBindings: [], jobs: [], retentionPolicies: [],
      acceptanceContracts: [], createdAt: "2026-10-14T00:00:00Z",
      updatedAt: "2026-10-14T00:00:00Z",
    };
    await expect(ApplicationSpecService.commitRevision({
      ...spec, applicationId: "app_invalid_initial_v21", revision: 7, parentRevision: 6,
    })).rejects.toThrow(/initial application revision/);
    await expect(ApplicationSpecService.commitRevision({
      ...spec, applicationId: "app_invalid_parent_v21", parentRevision: 9,
    })).rejects.toThrow(/initial application revision/);
    await ApplicationSpecService.commitRevision(spec);
    await expect(ApplicationSpecService.commitRevision({
      ...spec, revision: 2, parentRevision: 1, tenantId: "tenant_attacker",
    })).rejects.toThrow(/cannot change its project or tenant/);
    await expect(ApplicationSpecService.commitRevision({
      ...spec, revision: 2, parentRevision: 1, projectId: "project_attacker",
    })).rejects.toThrow(/cannot change its project or tenant/);
    await expect(ApplicationSpecService.commitRevision({
      ...spec, revision: 2, parentRevision: 0,
    })).rejects.toThrow(/Revision conflict/);
    const committed = await ApplicationSpecService.commitRevision({
      ...spec, revision: 2, parentRevision: 1,
    });
    expect(committed.revision).toBe(2);
    expect(ApplicationSpecService.getLatestSpec(spec.applicationId)?.tenantId).toBe("tenant_original");
  });


  it("rejects unresolved policy, binding, model and tenant references", () => {
    const spec: ApplicationSpec = {
      schemaVersion: "1.0.0", applicationId: "app_references", projectId: "project_refs",
      tenantId: "tenant_refs", revision: 1, parentRevision: 0,
      frameworkProfile: "react-vite", identityStrategy: "MULTI_TENANT_ROW",
      requirementIds: [], entities: [{
        id: "ent_tasks", name: "Tasks", physicalTableName: "tasks",
        isSoftDeletable: true, isAudited: true,
        fields: [
          { id: "fld_title", name: "title", physicalColumnName: "title", type: "string",
            isNullable: false, sensitivity: "PUBLIC", visibility: "READ_WRITE", lifecycleOwnership: "USER" },
          { id: "fld_title2", name: "Title", physicalColumnName: "title", type: "string",
            isNullable: true, sensitivity: "PUBLIC", visibility: "READ_WRITE", lifecycleOwnership: "USER" },
        ],
      }], relationships: [{
        id: "rel_missing", name: "broken_relation", sourceEntityId: "ent_tasks",
        targetEntityId: "ent_tasks", type: "ONE_TO_MANY",
        foreignKeyField: "unknown_field", cascadeRule: "RESTRICT_NO_ACTION",
      }],
      operations: [{
        id: "op_tasks", name: "tasks", type: "QUERY", method: "GET", routePath: "/tasks",
        summary: "Get tasks", targetEntityId: "ent_missing", requiredScopes: [],
        transactionBoundary: "NONE", requiresIdempotencyKey: false, declaredSideEffects: [],
      }],
      actors: [], policies: [{
        id: "pol_tasks", name: "task_access", actorId: "actor_missing",
        resourceEntityId: "ent_missing", effect: "ALLOW", actions: ["READ"],
      }],
      frontendBindings: [{ id: "binding_tasks", operationId: "op_missing",
        hookName: "useTasks", targetRoutePath: "/tasks" }],
      jobs: [], retentionPolicies: [{
        entityId: "ent_missing", retentionDays: 30,
        archiveStrategy: "ANONYMIZE", legalBasis: "test",
      }],
      acceptanceContracts: [], createdAt: "2026-10-14T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z",
    };
    const result = ApplicationSpecService.validateApplicationSpec(spec);
    expect(result.valid).toBe(false);
    for (const fragment of [
      "Duplicate field name", "Duplicate physical column", "foreignKeyField",
      "must declare a tenantId", "unknown actorId", "unknown resourceEntityId",
      "unknown operationId", "unknown targetEntityId", "unknown entityId",
    ]) {
      expect(result.errors.some((error) => error.includes(fragment)), fragment).toBe(true);
    }
  });

  it("binds the digest to security policy, field defaults and retention behavior", () => {
    const base = {
      schemaVersion: "1.0.0", applicationId: "app_digest", projectId: "project_digest",
      tenantId: "tenant_digest", revision: 1, parentRevision: 0,
      frameworkProfile: "react-vite" as const, identityStrategy: "SINGLE_TENANT_DEDICATED" as const,
      requirementIds: ["REQ-1"], entities: [{
        id: "ent_item", name: "Item", physicalTableName: "items",
        isSoftDeletable: true, isAudited: true,
        fields: [{
          id: "fld_name", name: "name", physicalColumnName: "name",
          type: "string" as const, isNullable: false, defaultValue: "A",
          sensitivity: "INTERNAL" as const, visibility: "READ_WRITE" as const,
          lifecycleOwnership: "USER" as const,
        }],
      }],
      relationships: [], operations: [], actors: [],
      policies: [{
        id: "policy_item", name: "item_access", actorId: "actor_1",
        resourceEntityId: "ent_item", effect: "ALLOW" as const, actions: ["READ" as const],
      }],
      frontendBindings: [], jobs: [],
      retentionPolicies: [{
        entityId: "ent_item", retentionDays: 30,
        archiveStrategy: "ANONYMIZE" as const, legalBasis: "test",
      }],
      acceptanceContracts: [], createdAt: "2026-10-14T00:00:00Z",
      updatedAt: "2026-10-14T00:00:00Z",
    };
    const original = ApplicationSpecService.computeDigest(base);
    expect(ApplicationSpecService.computeDigest({
      ...base, policies: [{ ...base.policies[0], effect: "DENY" }],
    })).not.toBe(original);
    expect(ApplicationSpecService.computeDigest({
      ...base, retentionPolicies: [{ ...base.retentionPolicies[0], retentionDays: 90 }],
    })).not.toBe(original);
    expect(ApplicationSpecService.computeDigest({
      ...base, entities: [{ ...base.entities[0], fields: [{
        ...base.entities[0].fields[0], defaultValue: "B",
      }] }],
    })).not.toBe(original);
    const reordered = { ...base, tenantId: base.tenantId, projectId: base.projectId };
    expect(ApplicationSpecService.computeDigest(reordered)).toBe(original);
  });

  it("does not let returned or caller-owned objects mutate committed application revisions", async () => {
    const spec: ApplicationSpec = {
      schemaVersion: "1.0.0", applicationId: "app_snapshot_v21",
      projectId: "project_snapshot", tenantId: "tenant_snapshot",
      revision: 1, parentRevision: 0, frameworkProfile: "react-vite",
      identityStrategy: "SINGLE_TENANT_DEDICATED", requirementIds: [],
      entities: [], relationships: [], operations: [], actors: [], policies: [],
      frontendBindings: [], jobs: [], retentionPolicies: [], acceptanceContracts: [],
      createdAt: "2026-10-14T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z",
    };
    const result = await ApplicationSpecService.commitRevision(spec);
    const digest = result.digest;
    spec.requirementIds.push("MUTATED_ORIGINAL");
    result.spec.requirementIds.push("MUTATED_RESPONSE");
    const retrieved = ApplicationSpecService.getLatestSpec(spec.applicationId);
    expect(retrieved?.requirementIds).toEqual([]);
    expect(retrieved && ApplicationSpecService.computeDigest(retrieved)).toBe(digest);
    if (retrieved) retrieved.requirementIds.push("MUTATED_READ");
    expect(ApplicationSpecService.getLatestSpec(spec.applicationId)?.requirementIds).toEqual([]);
  });

  it("validates that ApplicationSpec enforces stable ent_ and fld_ prefixes", () => {
    const invalidSpec: ApplicationSpec = {
      schemaVersion: "1.0.0",
      applicationId: "app_1",
      projectId: "proj_1",
      tenantId: "tenant_1",
      revision: 1,
      parentRevision: 0,
      frameworkProfile: "react-vite",
      identityStrategy: "MULTI_TENANT_ROW",
      requirementIds: ["REQ-1"],
      entities: [
        {
          id: "bad_entity_id", // Missing ent_ prefix!
          name: "Item",
          physicalTableName: "items",
          isSoftDeletable: true,
          isAudited: true,
          fields: [
            {
              id: "bad_field", // Missing fld_ prefix!
              name: "title",
              physicalColumnName: "title",
              type: "string",
              isNullable: false,
              sensitivity: "PUBLIC",
              visibility: "READ_WRITE",
              lifecycleOwnership: "GENERATED",
            },
          ],
        },
      ],
      relationships: [],
      operations: [],
      actors: [],
      policies: [],
      frontendBindings: [],
      jobs: [],
      retentionPolicies: [],
      acceptanceContracts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = ApplicationSpecService.validateApplicationSpec(invalidSpec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Must start with 'ent_'"))).toBe(true);
    expect(result.errors.some((e) => e.includes("starting with 'fld_'"))).toBe(true);
  });

  it("strictly rejects ApplicationSpec containing raw passwords or secret credentials", () => {
    const leakedSpec: ApplicationSpec = {
      schemaVersion: "1.0.0",
      applicationId: "app_1",
      projectId: "proj_1",
      tenantId: "tenant_1",
      revision: 1,
      parentRevision: 0,
      frameworkProfile: "react-vite",
      identityStrategy: "MULTI_TENANT_ROW",
      requirementIds: ["REQ-1"],
      entities: [
        {
          id: "ent_user",
          name: "User",
          physicalTableName: "users",
          isSoftDeletable: true,
          isAudited: true,
          fields: [
            {
              id: "fld_secret",
              name: "password",
              defaultValue: "password = 'SuperSecret123!'", // Raw credential embedded!
              physicalColumnName: "password_hash",
              type: "string",
              isNullable: false,
              sensitivity: "RESTRICTED_PII",
              visibility: "WRITE_ONLY",
              lifecycleOwnership: "USER",
            },
          ],
        },
      ],
      relationships: [],
      operations: [],
      actors: [],
      policies: [],
      frontendBindings: [],
      jobs: [],
      retentionPolicies: [],
      acceptanceContracts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = ApplicationSpecService.validateApplicationSpec(leakedSpec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("never contain raw credentials"))).toBe(true);
  });
});
