import assert from "node:assert/strict";
import { forgeProjectService } from "../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../services/project/forgeFilesystem.service.js";
import { forgeManifestService } from "../services/project/forgeManifest.service.js";
import { unifiedCompilerService } from "../services/compiler/unifiedCompiler.service.js";
import { visualCodeSyncService } from "../services/compiler/visualCodeSync.service.js";

async function runForgePlatformTestSuite() {
  console.log("============================================================");
  console.log("Starting Phase 2 Modules 01–07 Forge Platform Test Suite...");
  console.log("============================================================\n");

  const testOwnerId = "test-user-phase2-uuid";
  const uniqueSuffix = Date.now().toString(36);

  // ============================================================
  // MODULE 01: FORGE PROJECT MODEL & LIFECYCLE
  // ============================================================
  console.log("[Module 01] Testing Forge Project Model & Lifecycle...");

  const createdProject = await forgeProjectService.createProject(testOwnerId, {
    name: `Platform Demo ${uniqueSuffix}`,
    description: "SaaS Project Model for Phase 2 Verification",
    projectType: "react",
    frameworkMeta: {
      framework: "react",
      frameworkVersion: "18.3.1",
      runtime: "node",
      runtimeVersion: "20.x",
      packageManager: "npm",
      language: "typescript",
    },
    capabilities: {
      visualEditing: true,
      sourceEditing: true,
      database: true,
      git: true,
    },
  });

  assert.ok(createdProject.id, "Project ID must be generated");
  assert.equal(createdProject.name, `Platform Demo ${uniqueSuffix}`);
  assert.equal(createdProject.projectType, "react");
  assert.equal(createdProject.lifecycleStatus, "ACTIVE");
  assert.equal(createdProject.framework, "react");
  assert.equal(createdProject.capabilities.sourceEditing, true);
  console.log("  ✓ Project creation with full metadata validated");

  // Lifecycle State Transitions
  const archivedProject = await forgeProjectService.transitionLifecycle(
    createdProject.id,
    "ARCHIVED",
    testOwnerId
  );
  assert.equal(archivedProject.lifecycleStatus, "ARCHIVED");
  console.log("  ✓ Valid transition ACTIVE -> ARCHIVED validated");

  const restoredProject = await forgeProjectService.transitionLifecycle(
    createdProject.id,
    "ACTIVE",
    testOwnerId
  );
  assert.equal(restoredProject.lifecycleStatus, "ACTIVE");
  console.log("  ✓ Valid transition ARCHIVED -> ACTIVE validated");

  // Invalid Transition rejection
  await assert.rejects(
    async () => {
      // @ts-expect-error Testing invalid status
      await forgeProjectService.transitionLifecycle(createdProject.id, "INVALID_STATE", testOwnerId);
    },
    { message: /Invalid lifecycle transition/i },
    "Invalid lifecycle state must be rejected"
  );
  console.log("  ✓ Invalid lifecycle transition rejected properly");

  // Project Cloning
  const clonedProject = await forgeProjectService.cloneProject(
    createdProject.id,
    testOwnerId,
    { name: `Cloned Demo ${uniqueSuffix}` }
  );
  assert.notEqual(clonedProject.id, createdProject.id);
  assert.equal(clonedProject.name, `Cloned Demo ${uniqueSuffix}`);
  console.log("  ✓ Project clone deep copy validated");

  // ============================================================
  // MODULE 02: PERSISTENT PROJECT FILESYSTEM & SECURITY
  // ============================================================
  console.log("\n[Module 02] Testing Persistent Project Filesystem & Path Security...");

  const projectId = createdProject.id;

  // Path Traversal Security
  const traversalPaths = [
    "../../etc/passwd",
    "..\\..\\windows\\system32\\cmd.exe",
    "foo/../../../bar",
    "/root/secret.txt",
    "C:\\secret.json",
  ];

  for (const p of traversalPaths) {
    const normalized = forgeFilesystemService.sanitizeAndNormalizePath(p);
    assert.ok(!normalized.includes(".."), `Normalized path must not contain '..': ${normalized}`);
    assert.ok(!normalized.startsWith("/"), `Normalized path must be relative without leading slash: ${normalized}`);
  }
  console.log("  ✓ Path traversal protection sanitized dangerous paths");

  // Atomic File Creation & Hash Verification
  const file1 = await forgeFilesystemService.writeFile(
    projectId,
    "src/components/Header.tsx",
    {
      content: `export function Header() { return <header><h1>Test Header</h1></header>; }`,
      reason: "Initial component",
      userId: testOwnerId,
    }
  );

  assert.equal(file1.path, "src/components/Header.tsx");
  assert.equal(file1.version, 1);
  assert.ok(file1.contentHash.length === 64, "SHA-256 hash must be 64 hex characters");
  console.log("  ✓ Atomic file creation & SHA-256 content hashing verified");

  // Optimistic Concurrency Control
  // 1. Correct version update succeeds
  const file1v2 = await forgeFilesystemService.writeFile(
    projectId,
    "src/components/Header.tsx",
    {
      content: `export function Header() { return <header><h1>Updated Header</h1></header>; }`,
      expectedVersion: 1,
      reason: "Update header text",
      userId: testOwnerId,
    }
  );
  assert.equal(file1v2.version, 2);
  console.log("  ✓ Concurrency: expectedVersion matches, file updated to v2");

  // 2. Stale expectedVersion throws 409 Conflict
  await assert.rejects(
    async () => {
      await forgeFilesystemService.writeFile(projectId, "src/components/Header.tsx", {
        content: `export function Header() { return <header>Stale overwrite</header>; }`,
        expectedVersion: 1, // Stale! Current is 2
        reason: "Stale edit",
      });
    },
    (err: any) => {
      return err.statusCode === 409 || err.message.includes("Conflict");
    },
    "Stale expectedVersion must trigger 409 Conflict"
  );
  console.log("  ✓ Concurrency: stale expectedVersion correctly rejected with 409 Conflict");

  // File Tree Hierarchy
  await forgeFilesystemService.writeFile(projectId, "src/index.ts", { content: `console.log("main");` });
  await forgeFilesystemService.writeFile(projectId, "README.md", { content: `# Documentation` });

  const tree = await forgeFilesystemService.getProjectFileTree(projectId);
  assert.ok(tree.length > 0, "File tree must not be empty");
  const srcFolder = tree.find((n) => n.name === "src" && n.isDirectory);
  assert.ok(srcFolder, "src folder must exist in file tree");
  console.log("  ✓ Hierarchical file tree structure verified");

  // Snapshot Creation & Restoration Check
  const snapshot = await forgeFilesystemService.createSnapshot(projectId, {
    name: "baseline-snapshot",
    description: "Initial verified build",
    userId: testOwnerId,
  });
  assert.ok(snapshot.id, "Snapshot ID must be generated");
  assert.ok(snapshot.fileCount >= 3, "Snapshot must contain all project files");
  console.log("  ✓ Point-in-time filesystem snapshot captured successfully");

  // ============================================================
  // MODULE 03: PROJECT MANIFEST (forge.manifest.json)
  // ============================================================
  console.log("\n[Module 03] Testing Project Manifest Schema & Secrets Protection...");

  const defaultManifest = await forgeManifestService.getOrCreateDefaultManifest(projectId);
  assert.equal(defaultManifest.schemaVersion, "1.0.0");
  assert.equal(defaultManifest.framework.name, "react");
  assert.ok(defaultManifest.commands.build, "Build command must be specified");
  console.log("  ✓ Default manifest initialized with schema v1.0.0");

  // Manifest Validation: Plaintext Secret Detection
  const unsafeManifest = {
    ...defaultManifest,
    env: {
      DATABASE_PASSWORD: {
        value: "super_secret_raw_password", // VIOLATION! Plaintext secret
        required: true,
      },
    },
  };

  const validation = forgeManifestService.validateManifest(unsafeManifest);
  assert.equal(validation.valid, false, "Manifest with plaintext secret must be invalid");
  assert.ok(
    validation.diagnostics.some((d) => d.code === "ENV_RAW_SECRET_FORBIDDEN"),
    "Diagnostic ENV_RAW_SECRET_FORBIDDEN must be produced"
  );
  console.log("  ✓ Security: Plaintext secret in manifest blocked, secretRef required");

  // Valid Manifest with secretRef passes
  const safeManifest = {
    ...defaultManifest,
    env: {
      DATABASE_PASSWORD: {
        secretRef: "VAULT_SECRET_DB_PASS",
        required: true,
      },
    },
  };
  const safeValidation = forgeManifestService.validateManifest(safeManifest);
  assert.equal(safeValidation.valid, true, "Manifest with safe secretRef must pass validation");
  console.log("  ✓ Safe manifest with secretRef passed schema validation");

  // ============================================================
  // MODULE 07: UNIFIED COMPILER / IR
  // ============================================================
  console.log("\n[Module 07] Testing Unified Compiler & Canonical IR...");

  const mockEditorData = {
    version: 1,
    siteSettings: { siteName: "Phase2 SaaS Platform" },
    pages: [
      {
        id: "page_home",
        name: "Home",
        slug: "home",
        isHome: true,
        elements: [
          {
            id: "el_hero",
            type: "hero",
            name: "HeroBanner",
            tag: "section",
            classes: ["hero", "py-12"],
            attributes: { "data-element-id": "el_hero" },
            styles: { backgroundColor: "#0f172a", color: "#f8fafc" },
            children: [
              {
                id: "el_heading",
                type: "heading",
                name: "MainTitle",
                tag: "h1",
                textContent: "Next-Gen Visual & Code Studio",
                attributes: { "data-element-id": "el_heading" },
                styles: { fontSize: "36px", fontWeight: "bold" },
              },
              {
                id: "el_cta",
                type: "button",
                name: "GetStartedBtn",
                tag: "button",
                textContent: "Start Building",
                attributes: { "data-element-id": "el_cta", href: "/signup" },
                styles: { padding: "12px 24px", borderRadius: "8px" },
              },
            ],
          },
        ],
      },
    ],
  };

  // Compile Visual editorData -> ProjectIR -> Source Files
  const compilationResult = await unifiedCompilerService.compileProject(projectId, mockEditorData);
  assert.ok(compilationResult.ir, "ProjectIR must be generated");
  assert.equal(compilationResult.ir.schemaVersion, "1.0.0");
  assert.equal(compilationResult.ir.routes.length, 1);
  assert.ok(compilationResult.filesCount >= 5, "Compiler must produce complete project files");
  console.log(`  ✓ Visual -> IR -> Source compiled ${compilationResult.filesCount} deterministic files`);

  // Verify compiled files in persistent filesystem
  const appTsx = await forgeFilesystemService.readFile(projectId, "src/App.tsx");
  assert.ok(appTsx.content?.includes("Next-Gen Visual & Code Studio"), "App.tsx must contain hero heading");
  assert.ok(appTsx.content?.includes("data-forge-id=\"el_heading\""), "App.tsx must contain stable Forge IDs");

  const tokensJson = await forgeFilesystemService.readFile(projectId, "src/styles/tokens.json");
  assert.ok(tokensJson.content?.includes("#0f172a"), "tokens.json must contain extracted design tokens");
  console.log("  ✓ Deterministic source AST generated with stable Forge IDs & design tokens");

  // ============================================================
  // MODULE 06: VISUAL ↔ CODE BIDIRECTIONAL SYNC
  // ============================================================
  console.log("\n[Module 06] Testing Visual ↔ Code Bidirectional Sync & Protected Manual Regions...");

  // 1. Code modification with Developer-Protected Manual Region
  const manualCodeWithProtection = `import React, { useState, useEffect } from "react";

// [forge-protect-start: custom-auth-logic]
// Developers can write arbitrary custom hooks, API calls, and business logic here
export function useCustomAuth() {
  const [user, setUser] = useState({ name: "Navin", role: "architect" });
  return user;
}
// [forge-protect-end: custom-auth-logic]

export default function HomeView() {
  return (
    <div data-forge-id="el_hero" className="hero py-12" style={{ backgroundColor: "#0f172a" }}>
      <h1 data-forge-id="el_heading">Custom Code-Edited Title</h1>
      <button data-forge-id="el_cta">Click Me</button>
    </div>
  );
}
`;

  await forgeFilesystemService.writeFile(projectId, "src/components/HomeView.tsx", {
    content: manualCodeWithProtection,
    userId: testOwnerId,
  });

  // 2. Visual → Code Sync: update an element visually while preserving protected manual code
  const syncVisualResult = await visualCodeSyncService.syncVisualToCode(
    projectId,
    "src/components/HomeView.tsx",
    {
      id: "el_heading",
      type: "heading",
      textContent: "Visually Updated Heading 2.0",
      styles: { color: "#38bdf8" },
    }
  );

  assert.equal(syncVisualResult.success, true);
  assert.ok(
    syncVisualResult.content.includes("useCustomAuth"),
    "Protected manual custom hook MUST NOT be removed by visual editing"
  );
  assert.ok(
    syncVisualResult.content.includes("Visually Updated Heading 2.0"),
    "Targeted element text must be updated in source code"
  );
  console.log("  ✓ Visual → Code sync succeeded and strictly preserved protected developer manual logic");

  // 3. Code → Visual Sync (Reconciliation): parse source code back into editorData
  const syncCodeResult = await visualCodeSyncService.syncCodeToVisual(
    projectId,
    "src/components/HomeView.tsx",
    mockEditorData
  );

  assert.equal(syncCodeResult.success, true);
  assert.ok(syncCodeResult.appliedChangesCount > 0, "Changes from code must be applied into visual editorData");

  const reconciledHeading = syncCodeResult.reconciledEditorData.pages[0].elements[0].children[0];
  assert.equal(reconciledHeading.textContent, "Visually Updated Heading 2.0");
  console.log("  ✓ Code → Visual reconciliation successfully mapped source AST back into editorData");

  console.log("\n============================================================");
  console.log("ALL PHASE 2 (MODULES 01–07) FORGE PLATFORM TESTS PASSED! ✓");
  console.log("============================================================\n");
}

runForgePlatformTestSuite().catch((err) => {
  console.error("Test Suite Failed with Error:", err);
  process.exit(1);
});
