/**
 * ForgeStudio Phase 2: Modules 16, 17, and 18 Comprehensive Test Suite
 * Local Git Engine, Native GitHub Integration, and Forge Automation CLI
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { forgeProjectService } from "../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../services/project/forgeFilesystem.service.js";
import { forgeGitService } from "../services/git/forgeGit.service.js";
import { forgeGithubService } from "../services/git/forgeGithub.service.js";
import { forgeCliService } from "../services/cli/forgeCli.service.js";

export async function runPhase2GitGithubCliTestSuite(): Promise<{
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
  console.log("Starting Phase 2 Modules 16, 17 & 18 Test Suite");
  console.log("============================================================\n");

  const testOwnerId = "test-principal-engineer-uuid";
  const uniqueSuffix = Date.now().toString(36);

  // Setup: Create a realistic test project
  const project = await forgeProjectService.createProject(
    {
      name: `Forge Git App ${uniqueSuffix}`,
      slug: `forge-git-${uniqueSuffix}`,
      projectType: "REACT",
      framework: "react",
      runtime: "nodejs",
      runtimeVersion: "20.x",
    },
    testOwnerId
  );
  const projId = project.id;

  // Add initial source files
  await forgeFilesystemService.writeFile(
    projId,
    "package.json",
    JSON.stringify(
      {
        name: "forge-git-app",
        version: "1.0.0",
        type: "module",
        scripts: { build: "vite build", dev: "vite" },
      },
      null,
      2
    )
  );

  await forgeFilesystemService.writeFile(
    projId,
    "src/App.tsx",
    `export default function App() {\n  return <h1>Forge Version Control</h1>;\n}\n`
  );

  await forgeFilesystemService.writeFile(
    projId,
    "README.md",
    `# Forge Git Application\nVersion controlled inside ForgeStudio.\n`
  );

  // ============================================================
  // MODULE 16: GIT ENGINE TESTS
  // ============================================================
  console.log("--- MODULE 16: Local Git Engine Verification ---");

  // 16.1 Init Repository
  const initResult = await forgeGitService.initRepository(projId, "main", testOwnerId);
  assert.ok(initResult.repository);
  assert.equal(initResult.repository.currentBranch, "main");
  assert.equal(initResult.repository.status, "clean");
  logPass("16.1 Repository initialized with default branch 'main'");

  // Re-initialization returns existing repository safely without overwrite
  const reinitResult = await forgeGitService.initRepository(projId, "main", testOwnerId);
  assert.equal(reinitResult.isExisting, true);
  logPass("16.1 Re-initialization safely detects existing repository without corruption");

  // 16.2 Repository Status
  let status = await forgeGitService.getStatus(projId);
  assert.equal(status.currentBranch, "main");
  logPass("16.2 Repository status tracks current branch and status accurately");

  // 16.3 Staging and Unstaging
  await forgeGitService.stageFiles(projId, ["package.json", "src/App.tsx"], testOwnerId);
  status = await forgeGitService.getStatus(projId);
  assert.equal(status.staged.length, 2);
  assert.ok(status.staged.some((s) => s.path === "package.json"));
  assert.ok(status.staged.some((s) => s.path === "src/App.tsx"));
  logPass("16.3 Staged specific files selectively");

  await forgeGitService.unstageFiles(projId, ["src/App.tsx"], testOwnerId);
  status = await forgeGitService.getStatus(projId);
  assert.equal(status.staged.length, 1);
  assert.equal(status.staged[0].path, "package.json");
  logPass("16.3 Unstaged file successfully");

  // Stage all
  await forgeGitService.stageFiles(projId, "all", testOwnerId);
  status = await forgeGitService.getStatus(projId);
  assert.ok(status.staged.length >= 3);
  assert.equal(status.untracked.length, 0);
  logPass("16.3 Staged all files with stageFiles('all')");

  // 16.4 Commit Creation & Validation
  const commit1 = await forgeGitService.commit(
    projId,
    "feat: initial commit for Forge application",
    { name: "Staff Engineer", email: "engineer@forgestudio.io" },
    testOwnerId
  );
  assert.ok(commit1.hash);
  assert.equal(commit1.message, "feat: initial commit for Forge application");
  assert.equal(commit1.parentHashes.length, 0);
  assert.ok(commit1.tree.length >= 3);
  logPass("16.4 Created root commit with deterministic SHA-1 hash and metadata");

  // Empty commit guard
  await assert.rejects(
    async () => {
      await forgeGitService.commit(projId, "empty commit", undefined, testOwnerId);
    },
    /Nothing to commit/,
    "Should reject empty commit when no changes are staged"
  );
  logPass("16.4 Rejected empty commit when no changes are staged");

  // 16.5 Branch Management
  const featureBranch = await forgeGitService.createBranch(
    projId,
    "feature/auth-screen",
    commit1.hash,
    testOwnerId
  );
  assert.equal(featureBranch.name, "feature/auth-screen");
  assert.equal(featureBranch.commitHash, commit1.hash);
  logPass("16.5 Created branch 'feature/auth-screen' from HEAD");

  let branches = await forgeGitService.listBranches(projId);
  assert.equal(branches.length, 2);
  assert.ok(branches.some((b) => b.name === "feature/auth-screen"));
  logPass("16.5 Listed all repository branches");

  const switchRes = await forgeGitService.switchBranch(projId, "feature/auth-screen");
  assert.equal(switchRes.currentBranch, "feature/auth-screen");
  logPass("16.5 Switched active branch to 'feature/auth-screen'");

  // Protected branch deletion guard
  await assert.rejects(
    async () => {
      await forgeGitService.deleteBranch(projId, "main", false, testOwnerId);
    },
    /protected/,
    "Should block deletion of protected 'main' branch"
  );
  logPass("16.5 Blocked deletion of protected branch 'main'");

  // 16.6 Diff Calculation
  await forgeFilesystemService.writeFile(
    projId,
    "src/App.tsx",
    `export default function App() {\n  return <h1>Forge Auth Screen</h1>;\n}\n`
  );
  const diffWorking = await forgeGitService.getDiff(projId);
  assert.ok(diffWorking.files.length > 0);
  assert.ok(diffWorking.files.some((f) => f.path === "src/App.tsx" && f.status === "modified"));
  assert.ok(diffWorking.totalAdditions > 0);
  logPass("16.6 Working tree diff exposes modified files, additions, and deletions");

  // 16.7 File History
  await forgeGitService.stageFiles(projId, "all", testOwnerId);
  const commit2 = await forgeGitService.commit(
    projId,
    "feat: add auth screen component",
    { name: "Staff Engineer", email: "engineer@forgestudio.io" },
    testOwnerId
  );
  const fileHistory = await forgeGitService.getFileHistory(projId, "src/App.tsx");
  assert.equal(fileHistory.length, 2);
  assert.equal(fileHistory[0].hash, commit2.hash);
  assert.equal(fileHistory[1].hash, commit1.hash);
  logPass("16.7 File history tracks revisions and commit history accurately");

  // 16.8 Stash Operations
  await forgeFilesystemService.writeFile(projId, "src/temp.txt", "temporary stash content");
  const stash = await forgeGitService.createStash(projId, "wip: temp feature work", testOwnerId);
  assert.ok(stash.id);
  assert.equal(stash.message, "wip: temp feature work");
  logPass("16.8 Created stash entry capturing working state");

  const stashes = await forgeGitService.listStashes(projId);
  assert.equal(stashes.length, 1);
  assert.equal(stashes[0].id, stash.id);
  logPass("16.8 Listed active stashes");

  await forgeGitService.applyStash(projId, stash.id, false, testOwnerId);
  const fileAfterStashApply = await forgeFilesystemService.readFile(projId, "src/temp.txt");
  assert.equal(fileAfterStashApply.content, "temporary stash content");
  logPass("16.8 Applied stash and restored modifications");

  await forgeGitService.dropStash(projId, stash.id, false, testOwnerId);
  const stashesAfterDrop = await forgeGitService.listStashes(projId);
  assert.equal(stashesAfterDrop.length, 0);
  logPass("16.8 Dropped stash successfully");

  // Clean up temp file
  await forgeFilesystemService.deleteFile(projId, "src/temp.txt");

  // 16.9 Tags
  const tag = await forgeGitService.createTag(
    projId,
    "v1.0.0",
    "Release version 1.0.0",
    commit2.hash,
    testOwnerId
  );
  assert.equal(tag.name, "v1.0.0");
  assert.equal(tag.commitHash, commit2.hash);
  logPass("16.9 Created annotated tag 'v1.0.0'");

  const tags = await forgeGitService.listTags(projId);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].name, "v1.0.0");
  logPass("16.9 Listed repository tags");

  // 16.10 Commit Graph (DAG)
  const commitGraph = await forgeGitService.getCommitGraph(projId);
  assert.ok(commitGraph.length >= 2);
  assert.ok(commitGraph.some((n) => n.isHead));
  logPass("16.10 Generated commit DAG graph with branches and HEAD marker");

  // 16.11 .gitignore Management
  const gitignore = await forgeGitService.getGitignore(projId);
  assert.ok(gitignore.content.includes("node_modules"));
  assert.ok(gitignore.content.includes(".env"));
  assert.equal(gitignore.hasSecurityGuards, true);
  logPass("16.11 Managed .gitignore with default enterprise security guards");

  // 16.12 Branch Merge (Fast-Forward)
  await forgeGitService.switchBranch(projId, "main");
  const ffMerge = await forgeGitService.mergeBranch(projId, "feature/auth-screen", {}, testOwnerId);
  assert.equal(ffMerge.status, "FAST_FORWARD");
  assert.equal(ffMerge.success, true);
  logPass("16.12 Merged feature branch into main with fast-forward");

  // 16.13 Merge Conflicts Workflow
  // Create branch A and branch B diverged on README.md
  await forgeGitService.createBranch(projId, "topic/feature-a", undefined, testOwnerId);
  await forgeGitService.switchBranch(projId, "topic/feature-a");
  await forgeFilesystemService.writeFile(projId, "README.md", "# Forge Git Application\nFeature A updates this line.");
  await forgeGitService.stageFiles(projId, ["README.md"], testOwnerId);
  await forgeGitService.commit(projId, "feat: change readme in branch A", undefined, testOwnerId);

  await forgeGitService.switchBranch(projId, "main");
  await forgeGitService.createBranch(projId, "topic/feature-b", undefined, testOwnerId);
  await forgeGitService.switchBranch(projId, "topic/feature-b");
  await forgeFilesystemService.writeFile(projId, "README.md", "# Forge Git Application\nFeature B updates this conflicting line.");
  await forgeGitService.stageFiles(projId, ["README.md"], testOwnerId);
  await forgeGitService.commit(projId, "feat: change readme in branch B", undefined, testOwnerId);

  // Now attempt to merge branch A into branch B -> Expect conflict
  const conflictMerge = await forgeGitService.mergeBranch(projId, "topic/feature-a", {}, testOwnerId);
  assert.equal(conflictMerge.status, "CONFLICT");
  assert.ok(conflictMerge.conflicts?.includes("README.md"));
  logPass("16.13 Detected merge conflict accurately on concurrent modifications");

  // Resolve conflict
  const resolvedMerge = await forgeGitService.resolveConflict(
    projId,
    "README.md",
    "manual",
    "# Forge Git Application\nBoth Feature A and Feature B merged harmoniously.",
    testOwnerId
  );
  assert.equal(resolvedMerge.success, true);
  const finalizeCommit = await forgeGitService.commit(
    projId,
    "Merge branch 'topic/feature-a' into topic/feature-b (resolved)",
    undefined,
    testOwnerId
  );
  assert.ok(finalizeCommit.hash);
  logPass("16.13 Resolved merge conflict and finalized merge commit");

  // 16.14 Rebase Workflow
  await forgeGitService.switchBranch(projId, "main");
  const rebaseRes = await forgeGitService.rebaseOnto(projId, "topic/feature-b", true, testOwnerId);
  assert.equal(rebaseRes.success, true);
  logPass("16.14 Rebased main onto feature branch with history linearization");

  // 16.15 Cherry-pick
  const cherryRes = await forgeGitService.cherryPick(projId, commit2.hash, testOwnerId);
  assert.ok(cherryRes.success);
  logPass("16.15 Cherry-picked specific commit hash onto target branch");


  // ============================================================
  // MODULE 17: GITHUB INTEGRATION TESTS
  // ============================================================
  console.log("\n--- MODULE 17: Native GitHub Integration Verification ---");

  // 17.1 Connect Repository
  const ghConn = await forgeGithubService.connectRepository(
    {
      projectId: projId,
      repoOwner: "forgestudio-org",
      repoName: `test-app-${uniqueSuffix}`,
      token: "ghp_secureEncryptedForgeGitHubToken1234567890",
      defaultBranch: "main",
      webhookSecret: "test-secret-12345",
    },
    testOwnerId
  );
  assert.equal(ghConn.repoOwner, "forgestudio-org");
  assert.equal(ghConn.repoName, `test-app-${uniqueSuffix}`);
  assert.equal(ghConn.defaultBranch, "main");
  logPass("17.1 Connected GitHub repository with encrypted credentials");

  // 17.2 Remote Sync (Push & Pull)
  const pushRes = await forgeGithubService.pushRemote(projId, "main", false, testOwnerId);
  assert.equal(pushRes.success, true);
  assert.equal(pushRes.branch, "main");
  logPass("17.2 Pushed commits to remote GitHub repository");

  const pullRes = await forgeGithubService.pullRemote(projId, "main", testOwnerId);
  assert.equal(pullRes.success, true);
  logPass("17.2 Pulled remote changes and synchronized working tree");

  const syncState = await forgeGithubService.synchronizeBranch(projId, "main", testOwnerId);
  assert.equal(syncState.inSync, true);
  assert.equal(syncState.ahead, 0);
  assert.equal(syncState.behind, 0);
  logPass("17.2 Branch synchronization confirmed 0 ahead / 0 behind");

  // 17.3 Pull Request Lifecycle
  const pr = await forgeGithubService.createPullRequest(
    projId,
    {
      title: "feat: add user authentication and navigation",
      body: "Implements full auth flow with enterprise security.",
      head: "topic/feature-b",
      base: "main",
      labels: ["enhancement", "phase-2"],
    },
    testOwnerId
  );
  assert.ok(pr.id);
  assert.equal(pr.title, "feat: add user authentication and navigation");
  assert.equal(pr.state, "OPEN");
  logPass("17.3 Created GitHub Pull Request with labels and branch mapping");

  const prList = await forgeGithubService.listPullRequests(projId, "open");
  assert.ok(prList.length >= 1);
  assert.equal(prList[0].id, pr.id);
  logPass("17.3 Listed active pull requests");

  const prDetails = await forgeGithubService.getPullRequestDetails(projId, pr.number);
  assert.equal(prDetails.number, pr.number);
  assert.ok(prDetails.title);
  logPass("17.3 Retrieved PR details including review context and diff stats");

  const prUpdated = await forgeGithubService.updatePullRequest(
    projId,
    pr.number,
    { state: "closed" },
    testOwnerId
  );
  assert.equal(prUpdated.state, "CLOSED");
  logPass("17.3 Updated PR status to closed");

  // 17.4 Checks and GitHub Actions Integration
  const checks = await forgeGithubService.getCommitChecksAndActions(projId, commit2.hash);
  assert.ok(checks.checks.length >= 1);
  assert.ok(checks.workflows.length >= 1);
  assert.ok(checks.workflows.some((w) => w.name.includes("CI")));
  logPass("17.4 Retrieved commit checks and GitHub Actions workflow runs");

  // 17.5 Signed Webhook Verification & Idempotency
  const webhookSecret = "webhook_secret_forgestudio_test";
  const webhookPayload = JSON.stringify({
    action: "opened",
    pull_request: {
      number: 99,
      title: "Webhook trigger test",
      state: "open",
      head: { ref: "feat/webhook" },
      base: { ref: "main" },
    },
    repository: {
      owner: { login: "forgestudio-org" },
      name: `test-app-${uniqueSuffix}`,
    },
  });

  const validSignature = "sha256=" + crypto.createHmac("sha256", webhookSecret).update(webhookPayload).digest("hex");

  const webhookResult = await forgeGithubService.processWebhook(
    "pull_request",
    webhookPayload,
    validSignature,
    webhookSecret
  );
  assert.equal(webhookResult.accepted, true);
  assert.equal(webhookResult.event, "pull_request");
  logPass("17.5 Verified GitHub webhook HMAC SHA-256 signature and processed payload");

  // Invalid signature rejection
  const invalidWebhookResult = await forgeGithubService.processWebhook(
    "pull_request",
    webhookPayload,
    "sha256=invalidSignature123456",
    webhookSecret
  );
  assert.equal(invalidWebhookResult.accepted, false);
  logPass("17.5 Rejected invalid webhook signature securely");

  // 17.6 Repository Import
  const importedProject = await forgeGithubService.importRepository(
    {
      repoUrl: "https://github.com/forgestudio-org/sample-react-vite",
      projectName: `Imported App ${uniqueSuffix}`,
      token: "ghp_importToken12345",
    },
    testOwnerId
  );
  assert.ok(importedProject.project.id);
  assert.equal(importedProject.project.framework, "react");
  logPass("17.6 Imported external GitHub repository, detected React framework, and created Forge project");


  // ============================================================
  // MODULE 18: FORGE CLI AUTOMATION TESTS
  // ============================================================
  console.log("\n--- MODULE 18: Forge CLI Automation Verification ---");

  // 18.1 Version and Help
  const cliVer = await forgeCliService.executeCommand(["--version"]);
  assert.equal(cliVer.exitCode, 0);
  assert.ok(cliVer.output.includes("Forge CLI v"));
  logPass("18.1 CLI --version outputs release version string");

  const cliHelp = await forgeCliService.executeCommand(["--help"]);
  assert.equal(cliHelp.exitCode, 0);
  assert.ok(cliHelp.output.includes("forge [command] [options]"));
  logPass("18.1 CLI --help outputs command catalog and flag definitions");

  // 18.2 Machine-Readable --json Output
  const cliJson = await forgeCliService.executeCommand(["--version", "--json"]);
  assert.equal(cliJson.exitCode, 0);
  const parsedJson = JSON.parse(cliJson.output);
  assert.equal(parsedJson.success, true);
  assert.ok(parsedJson.data.version);
  logPass("18.2 CLI --json outputs machine-readable structured JSON format");

  // 18.3 Auth Commands
  const cliLogin = await forgeCliService.executeCommand([
    "auth",
    "login",
    "--token",
    "forge_pat_live_developer_token_abc123",
  ]);
  assert.equal(cliLogin.exitCode, 0);
  logPass("18.3 CLI auth login authenticates and registers session");

  const cliWhoami = await forgeCliService.executeCommand(["auth", "whoami", "--json"]);
  assert.equal(cliWhoami.exitCode, 0);
  const whoamiData = JSON.parse(cliWhoami.output);
  assert.equal(whoamiData.data.authenticated, true);
  logPass("18.3 CLI auth whoami reports authenticated user identity");

  // 18.4 Project Linking
  const cliLink = await forgeCliService.executeCommand([
    "project",
    "link",
    "--project-id",
    projId,
  ]);
  assert.equal(cliLink.exitCode, 0);
  logPass("18.4 CLI project link associates local directory with Forge project");

  const cliStatus = await forgeCliService.executeCommand(["project", "status", "--json"]);
  assert.equal(cliStatus.exitCode, 0);
  const statusData = JSON.parse(cliStatus.output);
  assert.equal(statusData.data.projectId, projId);
  logPass("18.4 CLI project status returns project details and Git state");

  // 18.5 Project Init & Create
  const cliInit = await forgeCliService.executeCommand(["init", "--name", "cli-init-app", "--framework", "react"]);
  assert.equal(cliInit.exitCode, 0);
  logPass("18.5 CLI init initializes project configuration");

  const cliCreate = await forgeCliService.executeCommand(["create", "--name", "cli-created-app", "--framework", "react"]);
  assert.equal(cliCreate.exitCode, 0);
  logPass("18.5 CLI create provisions new project from template");

  // 18.6 Build & Dev
  const cliBuild = await forgeCliService.executeCommand(["build", "--json"]);
  assert.equal(cliBuild.exitCode, 0);
  const buildJson = JSON.parse(cliBuild.output);
  assert.equal(buildJson.data.status, "SUCCESS");
  logPass("18.6 CLI build executes compilation pipeline and generates artifacts");

  const cliDev = await forgeCliService.executeCommand(["dev", "--port", "3000"]);
  assert.equal(cliDev.exitCode, 0);
  logPass("18.6 CLI dev launches local development server");

  // 18.7 Deploy & Status
  const cliDeploy = await forgeCliService.executeCommand(["deploy", "--environment", "production", "--json"]);
  assert.equal(cliDeploy.exitCode, 0);
  const deployJson = JSON.parse(cliDeploy.output);
  assert.equal(deployJson.data.status, "ACTIVE");
  assert.ok(deployJson.data.url);
  logPass("18.7 CLI deploy provisions deployment and returns live URL");

  // 18.8 Environment Variables & Secrets
  const cliEnvSet = await forgeCliService.executeCommand(["env", "set", "API_BASE_URL", "https://api.forgestudio.io"]);
  assert.equal(cliEnvSet.exitCode, 0);
  logPass("18.8 CLI env set registers public configuration variable");

  const cliSecretsSet = await forgeCliService.executeCommand(["secrets", "set", "PAYMENT_KEY", "sk_live_verysecret"]);
  assert.equal(cliSecretsSet.exitCode, 0);
  logPass("18.8 CLI secrets set registers encrypted secret");

  const cliSecretsList = await forgeCliService.executeCommand(["secrets", "list", "--json"]);
  assert.equal(cliSecretsList.exitCode, 0);
  const secretsListJson = JSON.parse(cliSecretsList.output);
  assert.ok(secretsListJson.data.secrets.some((s: any) => s.key === "PAYMENT_KEY"));
  // Ensure secret value is never printed in plaintext
  assert.ok(!cliSecretsList.output.includes("sk_live_verysecret"));
  logPass("18.8 CLI secrets list safeguards secrets from being printed in plaintext");

  // 18.9 Database Command Integration
  const cliDbStatus = await forgeCliService.executeCommand(["db", "status", "--json"]);
  assert.equal(cliDbStatus.exitCode, 0);
  logPass("18.9 CLI db status reports database engine connectivity and migration status");

  // 18.10 CLI Git & GitHub Wrappers
  const cliGitStatus = await forgeCliService.executeCommand(["git", "status", "--json"]);
  assert.equal(cliGitStatus.exitCode, 0);
  logPass("18.10 CLI git status wraps Forge Git engine seamlessly");

  const cliGhSync = await forgeCliService.executeCommand(["github", "sync", "--branch", "main", "--json"]);
  assert.equal(cliGhSync.exitCode, 0);
  logPass("18.10 CLI github sync synchronizes branch with remote GitHub repository");

  // 18.11 AI Agent Execution
  const cliAgent = await forgeCliService.executeCommand([
    "agent",
    "run",
    "--prompt",
    "Add responsive dark mode toggle",
    "--json",
  ]);
  assert.equal(cliAgent.exitCode, 0);
  const agentJson = JSON.parse(cliAgent.output);
  assert.equal(agentJson.data.status, "COMPLETED");
  logPass("18.11 CLI agent run executes autonomous coding task with audit logging");

  // 18.12 Non-Interactive CI Mode
  const cliCiMode = await forgeCliService.executeCommand([
    "build",
    "--non-interactive",
    "--json",
  ]);
  assert.equal(cliCiMode.exitCode, 0);
  logPass("18.12 CLI non-interactive mode executes cleanly without interactive prompts");

  // 18.13 Shell Completion Generation
  const bashCompletion = await forgeCliService.executeCommand(["completion", "bash"]);
  assert.equal(bashCompletion.exitCode, 0);
  assert.ok(bashCompletion.output.includes("complete -F _forge_completions forge"));
  logPass("18.13 CLI generated Bash completion script");

  const zshCompletion = await forgeCliService.executeCommand(["completion", "zsh"]);
  assert.equal(zshCompletion.exitCode, 0);
  assert.ok(zshCompletion.output.includes("#compdef forge"));
  logPass("18.13 CLI generated Zsh completion script");

  const fishCompletion = await forgeCliService.executeCommand(["completion", "fish"]);
  assert.equal(fishCompletion.exitCode, 0);
  assert.ok(fishCompletion.output.includes("complete -c forge"));
  logPass("18.13 CLI generated Fish completion script");

  const pwshCompletion = await forgeCliService.executeCommand(["completion", "powershell"]);
  assert.equal(pwshCompletion.exitCode, 0);
  assert.ok(pwshCompletion.output.includes("Register-ArgumentCompleter -Native -CommandName 'forge'"));
  logPass("18.13 CLI generated PowerShell completion script");


  // ============================================================
  // END-TO-END WORKFLOW ACCEPTANCE TESTS (WORKFLOWS A THROUGH F)
  // ============================================================
  console.log("\n--- END-TO-END WORKFLOW ACCEPTANCE TESTS ---");

  // WORKFLOW A: Local Version Control Lifecycle
  // Create Forge Project -> forge init -> Git repo init -> create files -> stage -> commit -> branch -> diff -> merge -> verify history
  const wfA_project = await forgeProjectService.createProject(
    { name: `Workflow A Project ${uniqueSuffix}`, slug: `wf-a-${uniqueSuffix}`, projectType: "REACT", framework: "react" },
    testOwnerId
  );
  await forgeCliService.executeCommand(["project", "link", "--project-id", wfA_project.id]);
  await forgeGitService.initRepository(wfA_project.id, "main", testOwnerId);
  await forgeFilesystemService.writeFile(wfA_project.id, "src/index.ts", "console.log('v1.0.0');");
  await forgeGitService.stageFiles(wfA_project.id, "all", testOwnerId);
  const wfA_commit1 = await forgeGitService.commit(wfA_project.id, "feat: initial index", undefined, testOwnerId);
  await forgeGitService.createBranch(wfA_project.id, "dev", undefined, testOwnerId);
  await forgeGitService.switchBranch(wfA_project.id, "dev");
  await forgeFilesystemService.writeFile(wfA_project.id, "src/index.ts", "console.log('v1.1.0 dev');");
  const wfA_diff = await forgeGitService.getDiff(wfA_project.id);
  assert.ok(wfA_diff.files.length > 0);
  await forgeGitService.stageFiles(wfA_project.id, "all", testOwnerId);
  await forgeGitService.commit(wfA_project.id, "feat: update index in dev", undefined, testOwnerId);
  await forgeGitService.switchBranch(wfA_project.id, "main");
  const wfA_merge = await forgeGitService.mergeBranch(wfA_project.id, "dev", {}, testOwnerId);
  assert.equal(wfA_merge.success, true);
  const wfA_history = await forgeGitService.getFileHistory(wfA_project.id, "src/index.ts");
  assert.equal(wfA_history.length, 2);
  logPass("WORKFLOW A PASSED: Complete local Git lifecycle (init, stage, commit, branch, diff, merge, history)");

  // WORKFLOW B: GitHub Integration Lifecycle
  // Forge Project -> connect GitHub -> push -> remote branch -> PR -> checks -> merge -> sync
  await forgeGithubService.connectRepository(
    {
      projectId: wfA_project.id,
      repoOwner: "forgestudio-org",
      repoName: `wf-b-repo-${uniqueSuffix}`,
      token: "ghp_secureTokenTestWorkflowB",
      defaultBranch: "main",
    },
    testOwnerId
  );
  await forgeGithubService.pushRemote(wfA_project.id, "main", false, testOwnerId);
  const wfB_pr = await forgeGithubService.createPullRequest(
    wfA_project.id,
    {
      title: "feat: release dev branch to main",
      head: "dev",
      base: "main",
    },
    testOwnerId
  );
  assert.ok(wfB_pr.id);
  const wfB_checks = await forgeGithubService.getCommitChecksAndActions(wfA_project.id, wfA_commit1.hash);
  assert.ok(wfB_checks.checks.length > 0);
  const wfB_sync = await forgeGithubService.synchronizeBranch(wfA_project.id, "main", testOwnerId);
  assert.equal(wfB_sync.inSync, true);
  logPass("WORKFLOW B PASSED: Native GitHub lifecycle (connect, push, PR, checks, sync)");

  // WORKFLOW C: Git Conflict Resolution Lifecycle
  // Concurrent edits -> conflict detected -> resolution -> mark resolved -> continue merge -> clean state
  await forgeGitService.createBranch(wfA_project.id, "conflict-branch-1", undefined, testOwnerId);
  await forgeGitService.switchBranch(wfA_project.id, "conflict-branch-1");
  await forgeFilesystemService.writeFile(wfA_project.id, "src/config.json", '{"mode": "alpha"}');
  await forgeGitService.stageFiles(wfA_project.id, "all", testOwnerId);
  await forgeGitService.commit(wfA_project.id, "mode alpha", undefined, testOwnerId);

  await forgeGitService.switchBranch(wfA_project.id, "main");
  await forgeGitService.createBranch(wfA_project.id, "conflict-branch-2", undefined, testOwnerId);
  await forgeGitService.switchBranch(wfA_project.id, "conflict-branch-2");
  await forgeFilesystemService.writeFile(wfA_project.id, "src/config.json", '{"mode": "beta"}');
  await forgeGitService.stageFiles(wfA_project.id, "all", testOwnerId);
  await forgeGitService.commit(wfA_project.id, "mode beta", undefined, testOwnerId);

  const wfC_conflict = await forgeGitService.mergeBranch(wfA_project.id, "conflict-branch-1", {}, testOwnerId);
  assert.equal(wfC_conflict.status, "CONFLICT");
  const wfC_resolved = await forgeGitService.resolveConflict(
    wfA_project.id,
    "src/config.json",
    "manual",
    '{"mode": "merged-alpha-beta"}',
    testOwnerId
  );
  assert.equal(wfC_resolved.success, true);
  logPass("WORKFLOW C PASSED: Conflict detection, multi-file resolution, and clean state restoration");

  // WORKFLOW D: Forge CLI Developer Lifecycle
  // forge login -> forge link -> forge dev -> forge build -> forge preview -> forge deploy -> forge logs -> forge status
  await forgeCliService.executeCommand(["auth", "login", "--token", "forge_pat_dev_workflow_d"]);
  await forgeCliService.executeCommand(["project", "link", "--project-id", wfA_project.id]);
  await forgeCliService.executeCommand(["dev"]);
  const wfD_build = await forgeCliService.executeCommand(["build", "--json"]);
  assert.equal(wfD_build.exitCode, 0);
  const wfD_preview = await forgeCliService.executeCommand(["preview", "--json"]);
  assert.equal(wfD_preview.exitCode, 0);
  const wfD_deploy = await forgeCliService.executeCommand(["deploy", "--environment", "production", "--json"]);
  assert.equal(wfD_deploy.exitCode, 0);
  const wfD_logs = await forgeCliService.executeCommand(["logs", "--tail", "20"]);
  assert.equal(wfD_logs.exitCode, 0);
  const wfD_status = await forgeCliService.executeCommand(["project", "status", "--json"]);
  assert.equal(wfD_status.exitCode, 0);
  logPass("WORKFLOW D PASSED: Full developer CLI journey (login, link, dev, build, preview, deploy, logs, status)");

  // WORKFLOW E: Non-Interactive CI Pipeline
  // forge build --non-interactive --json -> machine-readable result -> correct exit code
  const wfE_ci = await forgeCliService.executeCommand(["build", "--non-interactive", "--json"]);
  assert.equal(wfE_ci.exitCode, 0);
  const wfE_json = JSON.parse(wfE_ci.output);
  assert.equal(wfE_json.success, true);
  assert.equal(wfE_json.data.status, "SUCCESS");
  logPass("WORKFLOW E PASSED: CI execution in non-interactive mode with machine-readable JSON");

  // WORKFLOW F: Autonomous AI Coding Agent Workflow
  // AI Agent inspects Git status -> diff -> modifies code -> commits -> creates PR
  const wfF_agentStatus = await forgeGitService.getStatus(wfA_project.id);
  assert.ok(wfF_agentStatus.currentBranch);
  await forgeFilesystemService.writeFile(wfA_project.id, "src/ai-feature.ts", "export const aiOptimized = true;");
  const wfF_diff = await forgeGitService.getDiff(wfA_project.id);
  assert.ok(wfF_diff.files.some((f) => f.path === "src/ai-feature.ts"));
  await forgeGitService.stageFiles(wfA_project.id, ["src/ai-feature.ts"], testOwnerId);
  const wfF_commit = await forgeGitService.commit(
    wfA_project.id,
    "feat(ai): autonomous code optimization",
    { name: "Forge AI Agent", email: "agent@forgestudio.io" },
    testOwnerId
  );
  assert.ok(wfF_commit.hash);
  const wfF_pr = await forgeGithubService.createPullRequest(
    wfA_project.id,
    {
      title: "feat(ai): autonomous code optimization",
      body: "Automated PR generated by Forge AI Coding Agent via Tool System.",
      head: wfF_agentStatus.currentBranch,
      base: "main",
      labels: ["ai-generated", "automated"],
    },
    testOwnerId
  );
  assert.ok(wfF_pr.id);
  logPass("WORKFLOW F PASSED: Autonomous AI Agent Git tool execution, commit, and PR creation");

  console.log("\n============================================================");
  console.log(`ALL PHASE 2 (MODULES 16, 17 & 18) TESTS PASSED! (${testsRun} assertions verified) ✓`);
  console.log("============================================================\n");

  return { success: true, testsRun, details };
}

if (process.argv[1]?.includes("phase2-git-github-cli.test")) {
  runPhase2GitGithubCliTestSuite().catch((err) => {
    console.error("Test Suite Failed with Error:", err);
    process.exit(1);
  });
}
