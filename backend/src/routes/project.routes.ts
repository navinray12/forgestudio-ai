import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  createProjectHandler,
  getProjectHandler,
  getProjectByWebsiteHandler,
  listProjectsHandler,
  updateProjectHandler,
  transitionLifecycleHandler,
  cloneProjectHandler,
  getFileTreeHandler,
  readFileHandler,
  writeFileHandler,
  deleteFileHandler,
  moveFileHandler,
  getFileRevisionsHandler,
  createSnapshotHandler,
  listSnapshotsHandler,
  getManifestHandler,
  updateManifestHandler,
  compileProjectHandler,
  syncVisualToCodeHandler,
  syncCodeToVisualHandler,
  generateReactProjectHandler,
  generateNextJsProjectHandler,
  getGenerationPlanHandler,
  regenerateScopeHandler,
  getWorkspaceStateHandler,
  saveWorkspaceStateHandler,
  getDependenciesHandler,
  installDependencyHandler,
  removeDependencyHandler,
  explainDependencyAiHandler,
  getRuntimeStatusHandler,
  executeSandboxHandler,
  stopSandboxProcessHandler,
  triggerBuildHandler,
  listBuildsHandler,
  createPreviewSessionHandler,
  updatePreviewViewportHandler,
  logPreviewConsoleHandler,
  createTerminalHandler,
  executeTerminalHandler,
  getTerminalTasksHandler,
  startDebugSessionHandler,
  setBreakpointHandler,
  removeBreakpointHandler,
  stepDebugHandler,
  askAiDebugHandler,
  detectRuntimeHandler,
  createDeploymentHandler,
  promoteDeploymentHandler,
  rollbackDeploymentHandler,
  listDeploymentsHandler,
  getDeploymentHandler,
  executeDeploymentHealthCheckHandler,
  createPipelineRunHandler,
  listPipelinesHandler,
  getPipelineHandler,
  approvePipelineGateHandler,
  rerunPipelineHandler,
  cancelPipelineHandler,
  checkDomainAvailabilityHandler,
  connectDomainHandler,
  listDomainsHandler,
  configureDnsHandler,
  verifyDomainOwnershipHandler,
  bindDomainDeploymentHandler,
  detachDomainHandler,
  initGitHandler,
  getGitStatusHandler,
  stageGitFilesHandler,
  unstageGitFilesHandler,
  commitGitHandler,
  listGitBranchesHandler,
  createGitBranchHandler,
  switchGitBranchHandler,
  deleteGitBranchHandler,
  getGitDiffHandler,
  getGitHistoryHandler,
  mergeGitBranchHandler,
  resolveGitConflictHandler,
  abortGitMergeHandler,
  rebaseGitHandler,
  listGitStashesHandler,
  createGitStashHandler,
  applyGitStashHandler,
  dropGitStashHandler,
  cherryPickGitHandler,
  listGitTagsHandler,
  createGitTagHandler,
  deleteGitTagHandler,
  getGitGraphHandler,
  connectGithubHandler,
  importGithubHandler,
  createGithubRepoHandler,
  fetchGithubRemoteHandler,
  pullGithubRemoteHandler,
  pushGithubRemoteHandler,
  syncGithubBranchHandler,
  createGithubPrHandler,
  listGithubPrsHandler,
  getGithubPrDetailsHandler,
  updateGithubPrHandler,
  getGithubChecksHandler,
  githubWebhookHandler,
  executeCliHandler,
  aiGatewayCompleteHandler,
  aiGatewayModelsHandler,
  aiGatewayHealthHandler,
  aiGatewayByokHandler,
  aiGatewayUsageHandler,
  listToolsHandler,
  executeToolHandler,
  resolveToolApprovalHandler,
  createCodingSessionHandler,
  generateCodingPlanHandler,
  executeCodingPlanHandler,
  aiCreatorPlanHandler,
  aiCreatorGenerateHandler,
  aiCreatorRegenerateHandler,
  aiWebsiteAuditHandler,
  aiWebsiteFixHandler,
  listMcpServersHandler,
  registerMcpServerHandler,
  mcpJsonRpcHandler,
  mcpInvokeToolHandler,
  mcpScaffoldHandler,
} from "../controllers/project.controller.js";

const router = Router();

// All project routes require authentication
router.use(requireAuth);

// Custom Domains (Global Availability Lookup)
router.get("/domains/availability", checkDomainAvailabilityHandler);

// GitHub Import & Webhooks (Module 17)
router.post("/github/import", importGithubHandler);
router.post("/github/webhook", githubWebhookHandler);

// Forge CLI Remote Automation (Module 18)
router.post("/cli/execute", executeCliHandler);

// Project Identity & Lifecycle (Module 01)
router.post("/", createProjectHandler);
router.get("/", listProjectsHandler);
router.get("/website/:websiteId", getProjectByWebsiteHandler);
router.get("/:id", getProjectHandler);
router.patch("/:id", updateProjectHandler);
router.post("/:id/lifecycle", transitionLifecycleHandler);
router.post("/:id/clone", cloneProjectHandler);

// Persistent Filesystem (Module 02)
router.get("/:id/files", getFileTreeHandler);
router.get("/:id/files/content", readFileHandler);
router.post("/:id/files", writeFileHandler);
router.delete("/:id/files", deleteFileHandler);
router.post("/:id/files/move", moveFileHandler);
router.get("/:id/files/:fileId/revisions", getFileRevisionsHandler);
router.post("/:id/snapshots", createSnapshotHandler);
router.get("/:id/snapshots", listSnapshotsHandler);

// Project Manifest (Module 03)
router.get("/:id/manifest", getManifestHandler);
router.put("/:id/manifest", updateManifestHandler);

// Unified Compiler / IR & Visual ↔ Code Sync (Modules 06 & 07)
router.post("/:id/compile", compileProjectHandler);
router.post("/:id/sync/visual-to-code", syncVisualToCodeHandler);
router.post("/:id/sync/code-to-visual", syncCodeToVisualHandler);

// Project Generators (Modules 08 & 09)
router.post("/:id/generate/react", generateReactProjectHandler);
router.post("/:id/generate/next", generateNextJsProjectHandler);
router.get("/:id/generate/plan", getGenerationPlanHandler);
router.post("/:id/generate/scope", regenerateScopeHandler);

// Developer Workspace State (Module 04)
router.get("/:id/workspace-state", getWorkspaceStateHandler);
router.put("/:id/workspace-state", saveWorkspaceStateHandler);

// Dependency Manager (Module 10)
router.get("/:id/dependencies", getDependenciesHandler);
router.post("/:id/dependencies/install", installDependencyHandler);
router.delete("/:id/dependencies/remove", removeDependencyHandler);
router.post("/:id/dependencies/explain-ai", explainDependencyAiHandler);

// Sandbox / Runtime (Module 11)
router.get("/:id/runtime/status", getRuntimeStatusHandler);
router.post("/:id/runtime/execute", executeSandboxHandler);
router.post("/:id/runtime/stop", stopSandboxProcessHandler);

// Build System (Module 12)
router.post("/:id/builds", triggerBuildHandler);
router.get("/:id/builds", listBuildsHandler);

// Live Preview (Module 13)
router.post("/:id/preview/session", createPreviewSessionHandler);
router.patch("/:id/preview/session/:token/viewport", updatePreviewViewportHandler);
router.post("/:id/preview/session/:token/console", logPreviewConsoleHandler);

// Terminal (Module 14)
router.post("/:id/terminal/sessions", createTerminalHandler);
router.post("/:id/terminal/sessions/:sessionId/execute", executeTerminalHandler);
router.get("/:id/terminal/tasks", getTerminalTasksHandler);

// Debugging (Module 15)
router.post("/:id/debug/session", startDebugSessionHandler);
router.post("/:id/debug/session/:sessionId/breakpoints", setBreakpointHandler);
router.delete("/:id/debug/session/:sessionId/breakpoints/:bpId", removeBreakpointHandler);
router.post("/:id/debug/session/:sessionId/step", stepDebugHandler);
router.post("/:id/debug/session/:sessionId/ask-ai", askAiDebugHandler);

// Source-Based Hosting (Module 29)
router.get("/:id/runtime/detect", detectRuntimeHandler);
router.post("/:id/deployments", createDeploymentHandler);
router.get("/:id/deployments", listDeploymentsHandler);
router.get("/:id/deployments/:deploymentId", getDeploymentHandler);
router.post("/:id/deployments/promote", promoteDeploymentHandler);
router.post("/:id/deployments/rollback", rollbackDeploymentHandler);
router.post("/:id/deployments/:deploymentId/health", executeDeploymentHealthCheckHandler);

// Automated CI/CD (Module 30)
router.post("/:id/pipelines", createPipelineRunHandler);
router.get("/:id/pipelines", listPipelinesHandler);
router.get("/:id/pipelines/:pipelineId", getPipelineHandler);
router.post("/:id/pipelines/:pipelineId/approve", approvePipelineGateHandler);
router.post("/:id/pipelines/:pipelineId/rerun", rerunPipelineHandler);
router.post("/:id/pipelines/:pipelineId/cancel", cancelPipelineHandler);

// GoDaddy & Custom Domain Automation (Module 31)
router.post("/:id/domains/connect", connectDomainHandler);
router.get("/:id/domains", listDomainsHandler);
router.post("/:id/domains/:domainId/dns/configure", configureDnsHandler);
router.post("/:id/domains/:domainId/verify", verifyDomainOwnershipHandler);
router.post("/:id/domains/:domainId/bind", bindDomainDeploymentHandler);
router.delete("/:id/domains/:domainId", detachDomainHandler);

// Local Version-Control & Git Engine (Module 16)
router.post("/:id/git/init", initGitHandler);
router.get("/:id/git/status", getGitStatusHandler);
router.post("/:id/git/stage", stageGitFilesHandler);
router.post("/:id/git/unstage", unstageGitFilesHandler);
router.post("/:id/git/commit", commitGitHandler);
router.get("/:id/git/branches", listGitBranchesHandler);
router.post("/:id/git/branches", createGitBranchHandler);
router.post("/:id/git/branches/switch", switchGitBranchHandler);
router.delete("/:id/git/branches/:branchName", deleteGitBranchHandler);
router.get("/:id/git/diff", getGitDiffHandler);
router.get("/:id/git/history", getGitHistoryHandler);
router.post("/:id/git/merge", mergeGitBranchHandler);
router.post("/:id/git/conflicts/resolve", resolveGitConflictHandler);
router.post("/:id/git/merge/abort", abortGitMergeHandler);
router.post("/:id/git/rebase", rebaseGitHandler);
router.get("/:id/git/stashes", listGitStashesHandler);
router.post("/:id/git/stashes", createGitStashHandler);
router.post("/:id/git/stashes/:index/apply", applyGitStashHandler);
router.delete("/:id/git/stashes/:index", dropGitStashHandler);
router.post("/:id/git/cherry-pick", cherryPickGitHandler);
router.get("/:id/git/tags", listGitTagsHandler);
router.post("/:id/git/tags", createGitTagHandler);
router.delete("/:id/git/tags/:name", deleteGitTagHandler);
router.get("/:id/git/graph", getGitGraphHandler);

// Native GitHub Integration (Module 17)
router.post("/:id/github/connect", connectGithubHandler);
router.post("/:id/github/create-repo", createGithubRepoHandler);
router.post("/:id/github/fetch", fetchGithubRemoteHandler);
router.post("/:id/github/pull", pullGithubRemoteHandler);
router.post("/:id/github/push", pushGithubRemoteHandler);
router.get("/:id/github/sync", syncGithubBranchHandler);
router.post("/:id/github/pulls", createGithubPrHandler);
router.get("/:id/github/pulls", listGithubPrsHandler);
router.get("/:id/github/pulls/:prNumber", getGithubPrDetailsHandler);
router.patch("/:id/github/pulls/:prNumber", updateGithubPrHandler);
router.get("/:id/github/commits/:commitHash/checks", getGithubChecksHandler);

// AI Provider Gateway (Module 19)
router.post("/:id/ai/complete", aiGatewayCompleteHandler);
router.get("/ai/models", aiGatewayModelsHandler);
router.get("/ai/health", aiGatewayHealthHandler);
router.post("/:id/ai/byok", aiGatewayByokHandler);
router.get("/:id/ai/usage", aiGatewayUsageHandler);

// AI Tool Execution Framework (Module 23)
router.get("/:id/ai/tools", listToolsHandler);
router.post("/:id/ai/tools/execute", executeToolHandler);
router.post("/:id/ai/tools/approve", resolveToolApprovalHandler);

// AI Coding Agent (Module 22)
router.post("/:id/ai/coding/session", createCodingSessionHandler);
router.post("/:id/ai/coding/plan", generateCodingPlanHandler);
router.post("/:id/ai/coding/execute", executeCodingPlanHandler);

// AI Creator (Module 20)
router.post("/ai/creator/plan", aiCreatorPlanHandler);
router.post("/ai/creator/generate", aiCreatorGenerateHandler);
router.post("/:id/ai/creator/regenerate", aiCreatorRegenerateHandler);

// AI Website Agent (Module 21)
router.get("/:id/ai/website/audit", aiWebsiteAuditHandler);
router.post("/:id/ai/website/fix", aiWebsiteFixHandler);

// Model Context Protocol (MCP) (Module 24)
router.get("/:id/mcp/servers", listMcpServersHandler);
router.post("/:id/mcp/servers", registerMcpServerHandler);
router.post("/:id/mcp/rpc", mcpJsonRpcHandler);
router.post("/:id/mcp/invoke", mcpInvokeToolHandler);
router.get("/mcp/scaffold", mcpScaffoldHandler);

export default router;

