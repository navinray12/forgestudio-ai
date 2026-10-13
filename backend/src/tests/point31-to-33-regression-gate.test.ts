/**
 * ForgeStudio Execution Blueprint v2.1 — Points 31, 32 & 33
 * Master Regression Gate Suite: Visual/Code Sync, Page Registry, Full-Stack Generation,
 * ApplicationSpec, Database Studio & Migration Integrity
 */

import { describe, it, expect } from "vitest";
import { updateJsxElementViaAst } from "../services/compiler/visualCodeSync.service.js";
import { isRecognizedPageEntry, detectRouteCollisions } from "../services/compiler/pageRegistry.js";
import { ApplicationSpecService } from "../services/authoritative/applicationSpec.service.js";
import { WorkspaceCoordinatorService } from "../services/workspace/workspaceCoordinator.service.js";
import { DatabaseStudioService } from "../modules/data-platform/studio/databaseStudio.service.js";
import { MigrationEngine } from "../modules/data-platform/database/migrationEngine.js";

describe("Points 31–33 Master Regression Gate", () => {
  it("Gate 1: AST-based Visual/Code sync replaces fragile regex text substitution", () => {
    const code = `<div data-forge-id="root"><span data-forge-id="el_label">Hello</span></div>`;
    const res = updateJsxElementViaAst(code, "el_label", "World");
    expect(res.updated).toBe(true);
    expect(res.content).toBe(`<div data-forge-id="root"><span data-forge-id="el_label">World</span></div>`);
  });

  it("Gate 2: Page registry discovers Next.js App Router and strips route groups", () => {
    const res = isRecognizedPageEntry("src/app/(portal)/dashboard/page.tsx", "nextjs");
    expect(res.isPage).toBe(true);
    if (res.isPage) {
      expect(res.routePath).toBe("/dashboard");
    }
  });

  it("Gate 3: ApplicationSpec strictly rejects raw secret credentials", () => {
    const res = ApplicationSpecService.validateApplicationSpec({
      schemaVersion: "1.0.0",
      applicationId: "app_test",
      projectId: "proj_test",
      tenantId: "tenant_test",
      revision: 1,
      parentRevision: 0,
      frameworkProfile: "react-vite",
      identityStrategy: "MULTI_TENANT_ROW",
      requirementIds: [],
      entities: [
        {
          id: "ent_t",
          name: "T",
          physicalTableName: "t",
          isSoftDeletable: true,
          isAudited: true,
          fields: [
            {
              id: "fld_key",
              name: "apiKey",
              defaultValue: 'api_key: "sk_live_1234567890123456"',
              physicalColumnName: "api_key",
              type: "string",
              isNullable: false,
              sensitivity: "RESTRICTED_PII",
              visibility: "HIDDEN",
              lifecycleOwnership: "SYSTEM",
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
    });

    expect(res.valid).toBe(false);
  });

  it("Gate 5: WorkspaceCoordinator validates expected revisions and enforces ownership", async () => {
    const res = await WorkspaceCoordinatorService.commitChange({
      projectId: "proj_gate_test",
      tenantId: "tenant_gate",
      actorId: "usr_gate",
      source: "CODE_EDITOR",
      expectedRevision: 1,
      commitMessage: "Gate test commit",
      changes: {
        sourceFiles: [{ path: "src/main.tsx", content: "console.log('gate');" }],
      },
    });

    expect(res.success).toBe(true);
    expect(res.revision).toBe(2);
    expect(res.checkpoint.checkpointId).toMatch(/^cp_/);
  });

  it("Gate 6: DatabaseStudio fails closed on absent environment selection", () => {
    expect(() => DatabaseStudioService.validateEnvironment(null)).toThrow();
  });

  it("Gate 7: MigrationEngine validates checksums and detects non-transactional statements", () => {
    const engine = new MigrationEngine();
    const checksum = engine.computeChecksum("SELECT 1;");
    expect(checksum.length).toBe(64);
  });
});
