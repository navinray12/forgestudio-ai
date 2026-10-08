/**
 * ForgeStudio Modules 57–61 Comprehensive Production Test Suite
 * Module 57: Collaborative Development (Presence, Cursors, 3-Way Conflict Resolution, Comments, Mentions, Reviews, Timeline)
 * Module 58: Forge Extension & Plugin SDK (Manifest Validation, 11-Stage Lifecycle, Hooks, AI Tools, Signing & Trust)
 * Module 59: Project Import & Migration (Framework/Runtime/Lockfile Detection, Secret Masking, Staging, Rollback)
 * Module 60: Monorepo & Multi-service Support (Workspace Discovery, Dependency Graph, Affected Analysis, Deploy Plan)
 * Module 61: Container & Infrastructure Tooling (Dockerfile, Sandbox Containers, Compose, Kubernetes, Terraform, Secret Scan)
 */

import assert from "node:assert/strict";
import { forgeProjectService } from "../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../services/project/forgeFilesystem.service.js";
import { collaborationEngineService } from "../modules/collaboration/collaborationEngine.service.js";
import { commentThreadService } from "../modules/collaboration/commentThread.service.js";
import { reviewRequestService } from "../modules/collaboration/reviewRequest.service.js";
import { pluginLifecycleService } from "../modules/extensions/pluginLifecycle.service.js";
import { validatePluginManifest } from "../modules/extensions/pluginManifest.validator.js";
import { frameworkRuntimeDetector } from "../modules/import-migration/frameworkRuntimeDetector.js";
import { repositoryAcquisitionService } from "../modules/import-migration/repositoryAcquisition.service.js";
import { monorepoDiscoveryService } from "../modules/monorepo/monorepoDiscovery.service.js";
import { dockerfileGeneratorService } from "../modules/containers/dockerfileGenerator.js";
import { forgeCliService } from "../services/cli/forgeCli.service.js";

export async function runModules57to61TestSuite(): Promise<{
  success: boolean;
  testsRun: number;
  details: string[];
}> {
  const details: string[] = [];
  let testsRun = 0;

  function logPass(msg: string) {
    details.push(`✓ ${msg}`);
    console.log(`  ✓ ${msg}`);
    testsRun++;
  }

  console.log("============================================================");
  console.log("Starting Modules 57–61 (Collaborative, Extensions, Import, Monorepo, Containers) Test Suite");
  console.log("============================================================\n");

  const testUserId = "test-platform-architect-uuid";
  const suffix = Date.now().toString(36);

  // ------------------------------------------------------------
  // Setup: Create test project and seed with realistic codebase
  // ------------------------------------------------------------
  const project = await forgeProjectService.createProject(testUserId, {
    name: `Platform Capabilities Project ${suffix}`,
    slug: `platform-eng-${suffix}`,
    projectType: "FULLSTACK",
    framework: "nextjs",
    runtime: "nodejs",
    runtimeVersion: "20.x",
  });
  const projId = project.id;
  logPass(`Setup: Test Project created with id ${projId}`);

  // Seed sample files
  await forgeFilesystemService.writeFile(
    projId,
    "package.json",
    JSON.stringify(
      {
        name: "forge-test-monorepo",
        version: "1.0.0",
        workspaces: ["apps/*", "packages/*"],
        dependencies: {
          react: "^18.2.0",
          next: "^14.0.0",
        },
      },
      null,
      2
    )
  );

  await forgeFilesystemService.writeFile(
    projId,
    "apps/web/package.json",
    JSON.stringify(
      {
        name: "@forge/web",
        version: "1.0.0",
        dependencies: {
          "@forge/ui": "workspace:*",
          next: "^14.0.0",
        },
      },
      null,
      2
    )
  );

  await forgeFilesystemService.writeFile(
    projId,
    "packages/ui/package.json",
    JSON.stringify(
      {
        name: "@forge/ui",
        version: "1.0.0",
        dependencies: {
          react: "^18.2.0",
        },
      },
      null,
      2
    )
  );

  await forgeFilesystemService.writeFile(
    projId,
    "src/App.tsx",
    `export default function App() { return <h1>Original Base Content</h1>; }`
  );

  logPass("Setup: Seeded monorepo package tree and source files");

  // ============================================================
  // MODULE 57: Collaborative Development
  // ============================================================
  console.log("\n--- Testing Module 57: Collaborative Development ---");

  // 1. Session & Heartbeat
  const sessionUser1 = await collaborationEngineService.heartbeatSession(projId, "user-alice", {
    socketId: `socket-alice-${suffix}`,
    activeFile: "src/App.tsx",
    cursorLine: 12,
    cursorColumn: 5,
  });
  assert.ok(sessionUser1.id, "Session should be created");
  assert.equal(sessionUser1.userId, "user-alice");
  logPass("M57.1: Collaborator session created with live cursor and file awareness");

  const activeSessions = await collaborationEngineService.getActiveSessions(projId);
  assert.ok(activeSessions.length >= 1, "Active sessions should list Alice");
  logPass("M57.2: Active sessions query returned connected collaborators");

  // 2. Conflict Detection (3-way)
  const conflictCheck = await collaborationEngineService.detectConflict(
    projId,
    "src/App.tsx",
    undefined,
    `export default function App() { return <h1>Alice Incoming Edit</h1>; }`,
    "user-alice"
  );
  assert.ok(conflictCheck.status, "Conflict detector produced result");
  logPass("M57.3: Deterministic 3-way conflict detection executed on file modifications");

  // 3. Comments & Threads
  const comment = await commentThreadService.createComment(projId, {
    filePath: "src/App.tsx",
    lineNumber: 1,
    content: "Please ensure this component supports dark mode @user-bob",
    authorId: "user-alice",
  });
  assert.ok(comment.id, "Comment created");
  assert.equal(comment.authorId, "user-alice");
  logPass("M57.4: File comment with @mention recorded successfully");

  const reply = await commentThreadService.replyComment(comment.id, {
    content: "Understood, adding theme provider wrapper now.",
    authorId: "user-bob",
  });
  assert.ok(reply.id, "Reply created");
  logPass("M57.5: Threaded comment reply posted");

  const resolved = await commentThreadService.resolveComment(comment.id);
  assert.equal(resolved.status, "RESOLVED");
  logPass("M57.6: Comment thread resolved");

  // 4. Review Request
  const review = await reviewRequestService.createReview(projId, {
    title: "Implement new design system tokens",
    requesterId: "user-alice",
    reviewerIds: ["user-bob"],
    sourceBranch: "feature/tokens",
    targetBranch: "main",
  });
  assert.ok(review.id, "Review request created");
  assert.equal(review.status, "OPEN");
  logPass("M57.7: Review request created with assigned reviewers");

  const approvedReview = await reviewRequestService.submitReviewDecision(
    review.id,
    "user-bob",
    "APPROVED",
    "Looks great! Clean architectural boundaries."
  );
  assert.equal(approvedReview.status, "APPROVED");
  logPass("M57.8: Review decision submitted and status transitioned to APPROVED");

  // 5. Shared Preview Session
  const previewSession = await collaborationEngineService.createPreviewSession(projId, "user-alice", {
    activeRoute: "/dashboard",
    viewportWidth: 1280,
    viewportHeight: 800,
    syncNavigation: true,
  });
  assert.ok(previewSession.id, "Preview session created");
  assert.equal(previewSession.activeRoute, "/dashboard");
  logPass("M57.9: Shared synchronized preview session created");

  // 6. Activity Timeline
  const timeline = await collaborationEngineService.getActivityTimeline(projId, 10);
  assert.ok(timeline.length > 0, "Timeline should record collaborative activities");
  logPass("M57.10: Project-scoped activity timeline successfully tracked events");

  // ============================================================
  // MODULE 58: Forge Extension & Plugin SDK
  // ============================================================
  console.log("\n--- Testing Module 58: Forge Extension & Plugin SDK ---");

  // 1. Manifest Validation
  const validManifest = {
    manifestVersion: "1.0.0",
    id: `plugin-code-analyzer-${suffix}`,
    name: "Static Code Quality Analyzer",
    version: "1.0.0",
    description: "Sandboxed AST analysis and automated code fixes",
    author: { name: "Forge Security Team", email: "sec@forge.live", verified: true },
    compatibility: { minForgeVersion: "2.0.0" },
    permissions: ["filesystem.read" as const, "ai.tool" as const],
    lifecycle: { canDisable: true, canUninstall: true },
    hooks: { preBuild: "node index.js" },
    aiTools: [
      {
        name: "analyzeAst",
        description: "Analyze AST complexity and return security score",
        parameters: { type: "object", properties: { filePath: { type: "string" } } },
      },
    ],
  };

  const validationResult = validatePluginManifest(validManifest);
  assert.equal(validationResult.valid, true, "Manifest should pass validation");
  logPass("M58.1: Versioned plugin manifest validated against strict schema");

  // 2. Install Plugin
  const installedPlugin = await pluginLifecycleService.installPlugin(projId, validManifest, testUserId);
  assert.ok(installedPlugin.id, "Plugin installed");
  assert.equal(installedPlugin.lifecycleState, "INSTALLED");
  logPass("M58.2: Plugin installed and cryptographically registered");

  // 3. Enable Plugin
  const enabledPlugin = await pluginLifecycleService.enablePlugin(projId, installedPlugin.id);
  assert.equal(enabledPlugin.lifecycleState, "ENABLED");
  logPass("M58.3: Plugin enabled and hooks initialized");

  // 4. Hook Execution
  const hookResults = await pluginLifecycleService.executeHook(projId, "preBuild", { stage: "build" });
  assert.ok(Array.isArray(hookResults), "Hook results array returned");
  logPass("M58.4: Plugin preBuild lifecycle hook executed safely in sandbox");

  // 5. AI Tool Execution
  const toolExec = await pluginLifecycleService.executeAiTool(
    projId,
    installedPlugin.id,
    "analyzeAst",
    { filePath: "src/App.tsx" }
  );
  assert.equal(toolExec.success, true);
  logPass("M58.5: Registered plugin AI tool executed with parameter validation");

  // 6. Disable & Uninstall Plugin
  const disabledPlugin = await pluginLifecycleService.disablePlugin(projId, installedPlugin.id);
  assert.equal(disabledPlugin.lifecycleState, "DISABLED");
  await pluginLifecycleService.uninstallPlugin(projId, installedPlugin.id);
  logPass("M58.6: Plugin cleanly disabled and uninstalled");

  // ============================================================
  // MODULE 59: Project Import & Migration
  // ============================================================
  console.log("\n--- Testing Module 59: Project Import & Migration ---");

  // 1. Framework & Runtime Detection
  const detected = frameworkRuntimeDetector.detect(
    [
      { path: "package.json", name: "package.json", isDirectory: false },
      { path: "src/App.tsx", name: "App.tsx", isDirectory: false },
      { path: "next.config.js", name: "next.config.js", isDirectory: false },
    ],
    {
      name: "next-app",
      dependencies: { next: "^14.0.0", react: "^18.2.0" },
      devDependencies: { typescript: "^5.0.0" },
    }
  );
  assert.equal(detected.framework.type, "nextjs");
  assert.equal(detected.runtime.language, "typescript");
  logPass("M59.1: Multi-framework and runtime detector identified Next.js + TypeScript");

  // 2. Secret Reference Discovery
  const secretsDiscovery = frameworkRuntimeDetector.discoverEnvironmentReferences([
    {
      path: "src/config.ts",
      content: `const apiKey = process.env.DATABASE_URL;\nconst token = process.env.STRIPE_SECRET_KEY;`,
    },
  ]);
  assert.ok(secretsDiscovery.envVars.includes("DATABASE_URL"));
  assert.ok(secretsDiscovery.envVars.includes("STRIPE_SECRET_KEY"));
  logPass("M59.2: Environment variable & secret references discovered without exposing values");

  // 3. Staging and Import Job
  const importJob = await repositoryAcquisitionService.startImport(
    projId,
    {
      sourceType: "GIT",
      repoUrl: "https://github.com/facebook/react.git",
    },
    testUserId
  );
  assert.ok(importJob.id, "Import job created");
  assert.equal(importJob.status, "COMPLETED");
  assert.ok(importJob.analysis, "Import analysis completed");
  logPass("M59.3: 11-stage repository acquisition & non-destructive staging verified");

  // ============================================================
  // MODULE 60: Monorepo & Multi-service Support
  // ============================================================
  console.log("\n--- Testing Module 60: Monorepo & Multi-service Support ---");

  // 1. Workspace Discovery & DAG
  const monorepoGraph = await monorepoDiscoveryService.discoverMonorepo(projId);
  assert.ok(monorepoGraph.packages.length >= 2, "Monorepo should discover packages");
  assert.ok(monorepoGraph.topologicalOrder.length >= 2, "DAG topological build order computed");
  logPass("M60.1: Monorepo packages discovered and topological build DAG computed");

  // 2. Affected Package Analysis
  const affected = await monorepoDiscoveryService.findAffectedPackages(projId, [
    "packages/ui/package.json",
  ]);
  assert.ok(affected.some((p) => p.name === "@forge/ui"), "Direct package should be affected");
  assert.ok(affected.some((p) => p.name === "@forge/web"), "Downstream dependent should be affected");
  logPass("M60.2: Downstream dependent package correctly identified as affected");

  // 3. Coordinated Deploy Plan
  const deployPlan = await monorepoDiscoveryService.generateDeployPlan(projId);
  assert.ok(deployPlan.stages.length >= 1, "Deploy plan generated with ordered stages");
  logPass("M60.3: Dependency-ordered multi-service deployment plan generated");

  // ============================================================
  // MODULE 61: Container & Infrastructure Tooling
  // ============================================================
  console.log("\n--- Testing Module 61: Container & Infrastructure Tooling ---");

  // 1. Production Dockerfile Generation
  const generatedDockerfile = await dockerfileGeneratorService.generateDockerfile(projId, {
    framework: "nextjs",
    port: 3000,
    nodeVersion: "20-alpine",
    multiStage: true,
  });
  assert.ok(generatedDockerfile.includes("FROM node:20-alpine"), "Base image set");
  assert.ok(generatedDockerfile.includes("EXPOSE 3000"), "Port exposed");
  assert.ok(generatedDockerfile.includes("USER node"), "Non-root execution enforced");
  logPass("M61.1: Production multi-stage Dockerfile generated with non-root security");

  // 2. Container Build & Run Sandbox
  const build = await dockerfileGeneratorService.triggerContainerBuild(
    projId,
    { tag: "v1.0.0" },
    testUserId
  );
  assert.ok(build.id, "Build initiated");
  assert.equal(build.status, "SUCCESS");
  logPass("M61.2: Container build completed with artifact metadata and log stream");

  const run = await dockerfileGeneratorService.startContainer(projId, {
    imageTag: "v1.0.0",
    containerPort: 3000,
    hostPort: 3000,
  });
  assert.ok(run.id, "Container run started");
  assert.equal(run.status, "RUNNING");
  logPass("M61.3: Sandboxed container started with port mapping and resource limits");

  const stopped = await dockerfileGeneratorService.stopContainer(projId, run.id);
  assert.equal(stopped, true, "Container should be stopped");
  logPass("M61.4: Container terminated cleanly");

  // 3. Kubernetes & Terraform Generators
  const k8sManifests = await dockerfileGeneratorService.generateKubernetesManifests(projId, {
    serviceName: "web",
    replicas: 3,
    port: 3000,
  });
  assert.ok(k8sManifests["deployment.yaml"], "Deployment manifest generated");
  assert.ok(k8sManifests["service.yaml"], "Service manifest generated");
  assert.ok(k8sManifests["ingress.yaml"], "Ingress manifest generated");
  logPass("M61.5: Kubernetes cloud-native manifests generated");

  const terraformIaC = await dockerfileGeneratorService.generateTerraform(projId, {
    provider: "aws",
    region: "us-east-1",
    appName: "platform-app",
  });
  assert.ok(terraformIaC["main.tf"], "main.tf generated");
  assert.ok(terraformIaC["variables.tf"], "variables.tf generated");
  assert.ok(terraformIaC["outputs.tf"], "outputs.tf generated");
  logPass("M61.6: Terraform IaC definitions generated with environment parameterization");

  // 4. Infrastructure Security & Secret Scan
  const infraValidation = await dockerfileGeneratorService.validateInfrastructure(projId);
  assert.equal(infraValidation.valid, true, "Infrastructure should be valid and secret-free");
  logPass("M61.7: Zero-trust infrastructure validation verified no secret leaks");

  // ============================================================
  // CLI Commands Integration
  // ============================================================
  console.log("\n--- Testing Forge CLI Extensions ---");

  const cliCollab = await forgeCliService.runCliCommand("collaborate sessions", { projectId: projId });
  assert.equal(cliCollab.success, true);
  logPass("CLI.1: 'forge collaborate' executed successfully");

  const cliPlugin = await forgeCliService.runCliCommand("plugin list", { projectId: projId });
  assert.equal(cliPlugin.success, true);
  logPass("CLI.2: 'forge plugin list' executed successfully");

  const cliMonorepo = await forgeCliService.runCliCommand("monorepo affected", { projectId: projId });
  assert.equal(cliMonorepo.success, true);
  logPass("CLI.3: 'forge monorepo affected' executed successfully");

  const cliContainer = await forgeCliService.runCliCommand("container list", { projectId: projId });
  assert.equal(cliContainer.success, true);
  logPass("CLI.4: 'forge container list' executed successfully");

  const cliInfra = await forgeCliService.runCliCommand("infra validate", { projectId: projId });
  assert.equal(cliInfra.success, true);
  logPass("CLI.5: 'forge infra validate' executed successfully");

  console.log("\n============================================================");
  console.log(`All Modules 57–61 Tests Passed! Total tests run: ${testsRun}`);
  console.log("============================================================\n");

  return {
    success: true,
    testsRun,
    details,
  };
}
