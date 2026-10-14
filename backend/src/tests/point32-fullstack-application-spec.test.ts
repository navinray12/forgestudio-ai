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
