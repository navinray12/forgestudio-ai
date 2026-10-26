import { prisma } from "../config/prisma.js";



const db = prisma as any;

// ---------------------------------------------------------------------------
// Handlers moved to domain modules under ./project/ (re-exported for compatibility)
// ---------------------------------------------------------------------------

export {
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
} from "./project/git.controller.js";

export {
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
} from "./project/github.controller.js";

export {
  executeCliHandler,
} from "./project/cli.controller.js";

export {
  getDependenciesHandler,
  installDependencyHandler,
  removeDependencyHandler,
  explainDependencyAiHandler,
} from "./project/dependency.controller.js";

export {
  getRuntimeStatusHandler,
  executeSandboxHandler,
  stopSandboxProcessHandler,
} from "./project/sandbox.controller.js";

export {
  triggerBuildHandler,
  listBuildsHandler,
} from "./project/build.controller.js";

export {
  createPreviewSessionHandler,
  updatePreviewViewportHandler,
  logPreviewConsoleHandler,
} from "./project/preview.controller.js";

export {
  createTerminalHandler,
  executeTerminalHandler,
  getTerminalTasksHandler,
} from "./project/terminal.controller.js";

export {
  startDebugSessionHandler,
  setBreakpointHandler,
  removeBreakpointHandler,
  stepDebugHandler,
  askAiDebugHandler,
} from "./project/debug.controller.js";

export {
  detectRuntimeHandler,
  createDeploymentHandler,
  promoteDeploymentHandler,
  rollbackDeploymentHandler,
  listDeploymentsHandler,
  getDeploymentHandler,
  executeDeploymentHealthCheckHandler,
} from "./project/hosting.controller.js";

export {
  createPipelineRunHandler,
  listPipelinesHandler,
  getPipelineHandler,
  approvePipelineGateHandler,
  rerunPipelineHandler,
  cancelPipelineHandler,
} from "./project/cicd.controller.js";

export {
  checkDomainAvailabilityHandler,
  connectDomainHandler,
  listDomainsHandler,
  configureDnsHandler,
  verifyDomainOwnershipHandler,
  bindDomainDeploymentHandler,
  detachDomainHandler,
} from "./project/domain.controller.js";

export {
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
} from "./project/ai-platform.controller.js";

export {
  commitProjectApplicationSpecHandler,
  getProjectApplicationSpecHandler,
} from "./project/application-spec.controller.js";

export {
  listMcpServersHandler,
  registerMcpServerHandler,
  mcpJsonRpcHandler,
  mcpInvokeToolHandler,
  mcpScaffoldHandler,
} from "./project/mcp.controller.js";

export {
  getManifestHandler,
  updateManifestHandler,
} from "./project/manifest.controller.js";

export {
  planSymbolsHandler,
  evaluateRegenerationHandler,
  createCleanupPlanHandler,
  applyCleanupPlanHandler,
} from "./project/source-generation.controller.js";

export {
  buildDomainModelSpecHandler,
  validateDataMutationHandler,
  introspectExternalDatabaseHandler,
} from "./project/data-model.controller.js";

export {
  generateContractFirstApiHandler,
  bootstrapApplicationAuthHandler,
  evaluateUnifiedAuthorizationHandler,
} from "./project/contract-api.controller.js";

export {
  getDatabaseStudioViewHandler,
} from "./project/studio-views.controller.js";

export {
  runReleaseQualificationHandler,
  getReleaseQualificationRecordHandler,
} from "./project/release-qualification.controller.js";

export {
  validateGeneratedPackageHandler,
  verifyControlPlaneDiagnosticsHandler,
  syncCodeToVisualHandler,
} from "./project/architecture-reconciliation.controller.js";

export {
  createProjectHandler,
  getProjectHandler,
  getProjectByWebsiteHandler,
  listProjectsHandler,
  updateProjectHandler,
  transitionLifecycleHandler,
  cloneProjectHandler,
} from "./project/identity.controller.js";

export {
  getFileTreeHandler,
  readFileHandler,
  writeFileHandler,
  deleteFileHandler,
  moveFileHandler,
  getFileRevisionsHandler,
  createSnapshotHandler,
  listSnapshotsHandler,
} from "./project/filesystem.controller.js";

export {
  getWorkspaceStateHandler,
  saveWorkspaceStateHandler,
} from "./project/workspace-state.controller.js";

export {
  resolveEnvironmentBindingHandler,
  listEnvironmentBindingsHandler,
  registerEnvironmentBindingHandler,
  retireEnvironmentBindingHandler,
  resolveTargetPoolHandler,
} from "./project/environment-bindings.controller.js";

export {
  executeUnifiedMigrationHandler,
  planMigrationHandler,
  adoptMigrationBaselineHandler,
  migrationStepHandler,
} from "./project/migration.controller.js";

export {
  exportProjectZipHandler,
  generateReactProjectHandler,
  generateNextJsProjectHandler,
  getGenerationPlanHandler,
  regenerateScopeHandler,
} from "./project/generators.controller.js";

export {
  listPagesHandler,
  createPageHandler,
  updatePageHandler,
  deletePageHandler,
  getSourcePreviewHandler,
} from "./project/pages.controller.js";

export {
  compileProjectHandler,
  syncVisualToCodeHandler,
  planVisualToCodeHandler,
} from "./project/compiler-sync.controller.js";

export {
  getWorkspaceCheckpointHandler,
  listWorkspaceCheckpointsHandler,
} from "./project/workspace-checkpoints.controller.js";

export {
  getRoundTripCompatibilityHandler,
  classifyConstructHandler,
} from "./project/round-trip.controller.js";

export {
  createPageLifecycleHandler,
  movePageLifecycleHandler,
  retirePageLifecycleHandler,
  restorePageLifecycleHandler,
} from "./project/page-lifecycle.controller.js";

export {
  runReferenceBenchmarkHandler,
} from "./project/benchmark.controller.js";
