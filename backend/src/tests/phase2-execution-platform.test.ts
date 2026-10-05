import assert from "node:assert/strict";
import { forgeProjectService } from "../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../services/project/forgeFilesystem.service.js";
import { forgeDependencyService } from "../services/dependency/forgeDependency.service.js";
import { forgeSandboxService } from "../services/runtime/forgeSandbox.service.js";
import { forgeBuildService } from "../services/build/forgeBuild.service.js";
import { forgePreviewService } from "../services/preview/forgePreview.service.js";
import { forgeTerminalService } from "../services/terminal/forgeTerminal.service.js";
import { forgeDebugService } from "../services/debug/forgeDebug.service.js";

async function runPhase2ExecutionPlatformTestSuite() {
  console.log("============================================================");
  console.log("Starting Phase 2 Modules 10–15 Execution Platform Test Suite");
  console.log("============================================================\n");

  const testOwnerId = "test-user-exec-p2-uuid";
  const uniqueSuffix = Date.now().toString(36);

  // Setup Base Project
  const project = await forgeProjectService.createProject(testOwnerId, {
    name: `Execution Platform Demo ${uniqueSuffix}`,
    projectType: "react",
    frameworkMeta: {
      framework: "react",
      frameworkVersion: "19.0.0",
      runtime: "node",
      runtimeVersion: "20.x",
      packageManager: "npm",
      language: "typescript",
    },
  });

  const projectId = project.id;
  assert.ok(projectId, "Project ID must exist");

  // Create baseline source files
  await forgeFilesystemService.writeFile(projectId, "package.json", {
    content: JSON.stringify(
      {
        name: "test-exec-app",
        version: "0.1.0",
        dependencies: {
          react: "^19.0.0",
          "react-dom": "^19.0.0",
          tailwindcss: "^3.4.0",
        },
        devDependencies: {
          typescript: "^5.6.0",
          vite: "^5.4.0",
        },
      },
      null,
      2
    ),
  });

  await forgeFilesystemService.writeFile(projectId, "src/App.tsx", {
    content: `export default function App() { return <h1>Execution App</h1>; }`,
  });

  // ============================================================
  // MODULE 10: DEPENDENCY MANAGER
  // ============================================================
  console.log("[Module 10] Testing Dependency Manager...");

  // 1. Package Manager Detection
  const detected = await forgeDependencyService.detectPackageManager(projectId);
  assert.equal(detected.packageManager, "npm");
  console.log("  ✓ Detected package manager from project config");

  // 2. Semver Update Analysis
  const patchCheck = forgeDependencyService.analyzeSemverUpdate("1.0.0", "1.0.1");
  assert.equal(patchCheck.updateType, "patch");
  assert.equal(patchCheck.isBreaking, false);

  const majorCheck = forgeDependencyService.analyzeSemverUpdate("18.2.0", "19.0.0");
  assert.equal(majorCheck.updateType, "major");
  assert.equal(majorCheck.isBreaking, true);
  console.log("  ✓ Semantic version analysis correctly flags breaking major upgrades");

  // 3. Install Dependency & Lockfile Consistency
  const installRes = await forgeDependencyService.installDependency(projectId, "lucide-react", {
    version: "0.475.0",
    isDev: false,
    authorId: testOwnerId,
  });
  assert.equal(installRes.success, true);
  assert.equal(installRes.package, "lucide-react");

  const pkgJsonAfterInstall = await forgeFilesystemService.readFile(projectId, "package.json");
  assert.ok(pkgJsonAfterInstall.content?.includes("lucide-react"), "package.json must contain installed dependency");

  const lockfile = await forgeFilesystemService.readFile(projectId, "package-lock.json");
  assert.ok(lockfile.content?.includes("lucide-react@^0.475.0"), "Lockfile must preserve installed package entry");
  console.log("  ✓ Dependency install successfully updated package.json and lockfile");

  // 4. Dependency Analysis & Tree
  const analysis = await forgeDependencyService.analyzeDependencies(projectId);
  assert.ok(analysis.directDependencies.length >= 4, "Must list all direct dependencies");
  assert.equal(analysis.licenseViolations.length, 0, "MIT/ISC packages have no license violations");

  const tree = await forgeDependencyService.getDependencyTree(projectId);
  assert.ok(tree.length >= 4, "Dependency tree must contain direct dependencies");
  console.log("  ✓ Full dependency analysis and tree calculation verified");

  // 5. AI Dependency Failure Explanation
  const aiExplanation = forgeDependencyService.explainDependencyFailureWithAI({
    errorMessage: "Conflicting peer dependencies",
    analysis: {
      ...analysis,
      peerConflicts: [
        {
          package: "old-library",
          requiredPeer: "react",
          requiredVersion: "^18.0.0",
          installedVersion: "^19.0.0",
          conflictReason: "old-library requires react@^18.0.0, but project uses ^19.0.0",
        },
      ],
    },
  });
  assert.ok(aiExplanation.diagnosis.includes("Peer Dependency Incompatibility"));
  assert.ok(aiExplanation.recommendedActions.length > 0);
  console.log("  ✓ AI dependency failure explanation generated structured actionable recommendations");

  // ============================================================
  // MODULE 11: SANDBOX / RUNTIME
  // ============================================================
  console.log("\n[Module 11] Testing Sandbox & Runtime Isolation...");

  // 1. SSRF Network Target Validation
  assert.equal(forgeSandboxService.isSafeNetworkTarget("https://registry.npmjs.org"), true);
  assert.equal(forgeSandboxService.isSafeNetworkTarget("http://127.0.0.1:8080"), false);
  assert.equal(forgeSandboxService.isSafeNetworkTarget("http://localhost:3000"), false);
  assert.equal(forgeSandboxService.isSafeNetworkTarget("http://169.254.169.254/latest/meta-data"), false);
  assert.equal(forgeSandboxService.isSafeNetworkTarget("http://192.168.1.1/secret"), false);
  console.log("  ✓ SSRF protection strictly blocked private loopback, RFC 1918, and metadata endpoints");

  // 2. Path Traversal Working Directory Escape Protection
  await assert.rejects(
    async () => {
      await forgeSandboxService.executeInSandbox({
        projectId,
        command: "ls",
        cwd: "../../../etc",
      });
    },
    { message: /Sandbox path escape forbidden/i },
    "Sandbox must reject working directory traversal"
  );
  console.log("  ✓ Sandbox path escape attempts rejected");

  // 3. Secret Masking in Execution Logs
  const unmaskedLog = "Connecting to database with secret password P@ssw0rd999! and api key SECRET_KEY_12345";
  const maskedLog = forgeSandboxService.maskSecretsInLog(unmaskedLog, ["P@ssw0rd999!", "SECRET_KEY_12345"]);
  assert.ok(!maskedLog.includes("P@ssw0rd999!"), "Secret password must be redacted");
  assert.ok(!maskedLog.includes("SECRET_KEY_12345"), "Secret API key must be redacted");
  assert.ok(maskedLog.includes("***[REDACTED_SECRET]***"), "Redaction marker must be present");
  console.log("  ✓ Secret masking in execution logs verified");

  // 4. Sandbox Execution & Port Discovery
  const sandboxExec = await forgeSandboxService.executeInSandbox({
    projectId,
    command: "npm run dev",
    userId: testOwnerId,
    secrets: ["MY_TOKEN_ABC"],
  });
  assert.equal(sandboxExec.exitCode, 0);
  assert.equal(sandboxExec.discoveredPort, 5173);
  assert.ok(sandboxExec.stdout.includes("Fast Refresh"), "Output must contain dev server logs");
  console.log("  ✓ Sandboxed command execution & dynamic port discovery verified (port 5173)");

  // ============================================================
  // MODULE 12: BUILD SYSTEM
  // ============================================================
  console.log("\n[Module 12] Testing Build System & Deterministic Artifacts...");

  const buildResult = await forgeBuildService.runProjectBuild({
    projectId,
    buildMode: "production",
    userId: testOwnerId,
  });

  assert.equal(buildResult.status, "SUCCESS");
  assert.ok(buildResult.stages.length >= 6, "Must execute all 6 build pipeline stages");
  assert.ok(buildResult.artifact, "Production artifact must be produced");
  assert.ok(buildResult.artifact?.contentHash.length === 64, "Artifact SHA-256 hash must be 64 hex chars");
  assert.equal(buildResult.reproducibility.packageManager, "npm");
  console.log(`  ✓ Multi-stage build completed successfully (Artifact: ${buildResult.artifact?.name})`);

  // Build Failure Classification Check
  await forgeFilesystemService.writeFile(projectId, "src/App.tsx", {
    content: `export default function App() { return <div>{SYNTAX_ERROR_TRIGGER}</div>; }`,
  });

  const failedBuild = await forgeBuildService.runProjectBuild({
    projectId,
    buildMode: "production",
  });
  assert.equal(failedBuild.status, "FAILED");
  assert.equal(failedBuild.canRetry, false, "Deterministic syntax errors must be classified as non-retryable");
  assert.ok(failedBuild.diagnostics.length > 0, "Must produce structured diagnostics");
  console.log("  ✓ Compiler diagnostic extracted and failure classified as non-retryable syntax error");

  // Restore clean App.tsx
  await forgeFilesystemService.writeFile(projectId, "src/App.tsx", {
    content: `export default function App() { return <h1>Execution App</h1>; }`,
  });

  // ============================================================
  // MODULE 13: LIVE PREVIEW
  // ============================================================
  console.log("\n[Module 13] Testing Live Preview & Viewports...");

  const previewSession = await forgePreviewService.createPreviewSession(projectId, {
    viewport: { preset: "desktop", width: 1280, height: 800 },
    route: "/dashboard",
  });

  assert.ok(previewSession.sessionToken.length >= 32, "Cryptographic session token must be generated");
  assert.equal(previewSession.status, "ACTIVE");
  assert.equal(previewSession.viewport.preset, "desktop");

  // Viewport update
  const updatedSession = await forgePreviewService.updatePreviewViewport(previewSession.sessionToken, {
    preset: "mobile",
    width: 375,
    height: 667,
  });
  assert.equal(updatedSession.viewport.preset, "mobile");
  assert.equal(updatedSession.viewport.width, 375);

  // Element Inspection Jump-to-Source
  const elementInspection = await forgePreviewService.resolveInspectedElementSource(projectId, "el_hero");
  assert.equal(elementInspection.sourceFile, "src/App.tsx");
  assert.equal(elementInspection.line, 14);

  // Console capture
  forgePreviewService.appendPreviewConsoleMessage(previewSession.sessionToken, {
    type: "warn",
    text: "React state updated after component unmounted",
    sourceFile: "src/App.tsx",
    lineNumber: 12,
  });
  const sessionWithLogs = forgePreviewService.getPreviewSessionByToken(previewSession.sessionToken);
  assert.ok(sessionWithLogs.consoleLogs.some((l) => l.message.includes("React state updated")));
  console.log("  ✓ Preview session, viewport resize, element inspection, and console interception verified");

  // ============================================================
  // MODULE 14: TERMINAL
  // ============================================================
  console.log("\n[Module 14] Testing Terminal & Permission Gates...");

  const termSession = await forgeTerminalService.createTerminalSession(projectId, "Test Terminal");
  assert.ok(termSession.id);
  assert.equal(termSession.status, "ACTIVE");

  // 1. Permission Gate: Dangerous Command Blocked
  const blockedCommand = await forgeTerminalService.executeTerminalCommand(
    termSession.id,
    "rm -rf /",
    { confirmedByUser: false }
  );
  assert.equal(blockedCommand.requiresConfirmation, true, "Dangerous command must trigger permission gate");
  console.log("  ✓ Dangerous command 'rm -rf /' caught by security permission gate");

  // 2. Safe Command Execution
  const safeCommand = await forgeTerminalService.executeTerminalCommand(
    termSession.id,
    "npm test",
    { userId: testOwnerId }
  );
  assert.equal(safeCommand.exitCode, 0);
  assert.ok(safeCommand.output.includes("Tests: 5 passed"), "Command output must be captured");

  // 3. Manifest Task Shortcuts
  const tasks = await forgeTerminalService.getManifestTasks(projectId);
  assert.ok(tasks.some((t) => t.name === "dev" || t.name === "build"));
  console.log("  ✓ Terminal command execution and manifest task discovery verified");

  // ============================================================
  // MODULE 15: DEBUGGING
  // ============================================================
  console.log("\n[Module 15] Testing Debugging & AI Assistant...");

  const debugSession = await forgeDebugService.startDebugSession(projectId, "fullstack");
  assert.ok(debugSession.id);
  assert.equal(debugSession.status, "PAUSED");
  assert.ok(debugSession.callStack.length >= 2, "Call stack must contain active frames");
  assert.ok(debugSession.variables.length >= 2, "Scope variables must be populated");

  // Secret Masking in Variable Inspector
  const authVar = debugSession.variables.find((v) => v.name === "authToken");
  assert.equal(authVar?.value, "***[REDACTED_SECRET]***", "Sensitive tokens in debugger must be masked");

  // Breakpoints
  const bp = await forgeDebugService.setBreakpoint(debugSession.id, {
    file: "src/App.tsx",
    line: 18,
    condition: "items.length > 5",
  });
  assert.ok(bp.id);
  assert.equal(bp.line, 18);
  assert.equal(bp.condition, "items.length > 5");

  // Step Over Control
  const initialLine = debugSession.currentFrame?.line || 12;
  const steppedSession = forgeDebugService.stepOver(debugSession.id);
  assert.equal(steppedSession.currentFrame?.line, initialLine + 1);
  console.log("  ✓ Debugging step over, call stack, breakpoints, and variable inspection verified");

  // Ask AI to Debug
  const aiDebugReport = forgeDebugService.askAiToDebug({
    sessionId: debugSession.id,
    errorMessage: "TypeError: Cannot read properties of undefined (reading 'title')",
    sourceFile: "src/App.tsx",
    line: 12,
  });
  assert.ok(aiDebugReport.rootCause.includes("null reference or unresolved async promise"));
  assert.ok(aiDebugReport.suggestedPatch.replacementCode.includes("res.ok ?"));
  console.log("  ✓ AI debugging assistant successfully diagnosed root cause and generated verified patch");

  console.log("\n============================================================");
  console.log("ALL PHASE 2 (MODULES 10–15) EXECUTION PLATFORM TESTS PASSED! ✓");
  console.log("============================================================\n");
}

runPhase2ExecutionPlatformTestSuite().catch((err) => {
  console.error("Test Suite Failed with Error:", err);
  process.exit(1);
});
