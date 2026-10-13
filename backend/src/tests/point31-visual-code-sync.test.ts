/**
 * ForgeStudio Execution Blueprint v2.1 — Points 31 & 33
 * Regression Test Suite: Visual Editor ↔ Code Workspace Synchronization
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  updateJsxElementViaAst,
  syncVisualElementToSource,
  CodeOwnershipBoundary,
} from "../services/compiler/visualCodeSync.service.js";
import {
  WorkspaceCoordinatorService,
  CommitProposal,
} from "../services/workspace/workspaceCoordinator.service.js";

describe("Point 31 — Visual Editor ↔ Code Synchronization & AST Precision", () => {
  it("surgically updates text of a static JSX element via AST without regex corruption", () => {
    const originalCode = `import React from "react";
export function Hero() {
  return (
    <div className="hero-container">
      <h1 data-forge-id="el_heading_1">Original Heading</h1>
      <p data-forge-id="el_desc_1">Original Description</p>
    </div>
  );
}`;

    const result = updateJsxElementViaAst(originalCode, "el_heading_1", "Updated Dynamic Title");
    expect(result.updated).toBe(true);
    expect(result.content).toContain('<h1 data-forge-id="el_heading_1">Updated Dynamic Title</h1>');
    expect(result.content).toContain('<p data-forge-id="el_desc_1">Original Description</p>');
  });

  it("preserves source-owned dynamic expressions and refuses to overwrite them", () => {
    const codeWithExpression = `import React from "react";
export function ProductCard({ item }) {
  return (
    <div className="card">
      <h2 data-forge-id="el_title">{item.title}</h2>
      <span data-forge-id="el_price">$99</span>
    </div>
  );
}`;

    const result = updateJsxElementViaAst(codeWithExpression, "el_title", "Static Overwrite Attempt");
    expect(result.updated).toBe(false);
    expect(result.diagnostic).toContain("source-owned dynamic expressions");
    // Original code is preserved intact!
    expect(result.content).toContain("<h2 data-forge-id=\"el_title\">{item.title}</h2>");
  });

  it("enforces expected revision and rejects stale updates with REVISION_CONFLICT", async () => {
    const proposal1: CommitProposal = {
      projectId: "proj_test_sync",
      tenantId: "tenant_alpha",
      actorId: "usr_alice",
      source: "CODE_EDITOR",
      expectedRevision: 1,
      commitMessage: "First valid edit",
      changes: {
        sourceFiles: [{ path: "src/App.tsx", content: "export default function App() { return <div>1</div>; }" }],
      },
    };

    const res1 = await WorkspaceCoordinatorService.commitChange(proposal1);
    expect(res1.success).toBe(true);
    expect(res1.revision).toBe(2);

    // Stale concurrent update using expectedRevision: 1 should fail!
    const staleProposal: CommitProposal = {
      projectId: "proj_test_sync",
      tenantId: "tenant_alpha",
      actorId: "usr_bob",
      source: "VISUAL_EDITOR",
      expectedRevision: 1, // Stale!
      commitMessage: "Stale concurrent edit",
      changes: {
        sourceFiles: [{ path: "src/App.tsx", content: "export default function App() { return <div>Stale</div>; }" }],
      },
    };

    const staleRes = await WorkspaceCoordinatorService.commitChange(staleProposal);
    expect(staleRes.success).toBe(false);
    expect(staleRes.status).toBe("CONFLICT");
    expect(staleRes.conflicts[0].reason).toContain("Revision conflict");
  });

  it("preserves invalid syntax drafts as durable drafts without advancing semantic canvas checkpoint", async () => {
    const invalidProposal: CommitProposal = {
      projectId: "proj_test_draft",
      tenantId: "tenant_alpha",
      actorId: "usr_alice",
      source: "CODE_EDITOR",
      expectedRevision: 1,
      commitMessage: "WIP with syntax error",
      changes: {
        sourceFiles: [
          {
            path: "src/Bad.tsx",
            content: "export function Broken() { return <<< INVALID >>>; }",
          },
        ],
      },
    };

    const result = await WorkspaceCoordinatorService.commitChange(invalidProposal);
    expect(result.success).toBe(true);
    expect(result.status).toBe("INVALID_DRAFT");
    expect(result.checkpoint.isSemanticValid).toBe(false);

    // Canvas continues to reference the last valid semantic checkpoint!
    const canvasCheckpoint = WorkspaceCoordinatorService.getLastValidSemanticCheckpoint("proj_test_draft");
    expect(canvasCheckpoint).toBeDefined();
  });

  it("enforces ownership boundaries: Visual Editor cannot overwrite server logic", async () => {
    const violationProposal: CommitProposal = {
      projectId: "proj_test_boundary",
      tenantId: "tenant_alpha",
      actorId: "usr_designer",
      source: "VISUAL_EDITOR",
      expectedRevision: 1,
      commitMessage: "Malicious or mistaken backend overwrite",
      changes: {
        sourceFiles: [
          {
            path: "server/api.ts",
            content: "malicious code",
            ownership: "SOURCE_OWNED",
          },
        ],
      },
    };

    await expect(WorkspaceCoordinatorService.commitChange(violationProposal)).rejects.toThrow(
      /Ownership boundary violation/
    );
  });
});
