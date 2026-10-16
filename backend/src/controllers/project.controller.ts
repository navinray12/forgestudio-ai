import { Request, Response, NextFunction } from "express";
import {
  createForgeProject,
  getForgeProjectById,
  getOrCreateProjectForWebsite,
  updateForgeProject,
  transitionProjectLifecycle,
  listForgeProjects,
  cloneForgeProject,
} from "../services/project/forgeProject.service.js";
import {
  writeFile,
  readFile,
  deleteFile,
  moveOrRenameFile,
  getProjectFileTree,
  getFileRevisions,
  createProjectSnapshot,
  listProjectSnapshots,
  listFiles,
} from "../services/project/forgeFilesystem.service.js";
import { buildZipFromFiles } from "../services/codeGenerator.service.js";
import {
  getProjectManifest,
  updateProjectManifest,
} from "../services/project/forgeManifest.service.js";
import {
  compileAndSyncProject,
} from "../services/compiler/unifiedCompiler.service.js";
import {
  syncVisualElementToSource,
  syncSourceToVisualWebsite,
} from "../services/compiler/visualCodeSync.service.js";
import {
  createGenerationPlan,
  executeGeneration,
  regenerateScope,
} from "../services/generator/index.js";
import {
  recordCheckpoint,
  findCommittedChangeSet,
  getCheckpointState,
  listCheckpointsAfter,
  kindForSyncStatus,
} from "../services/workspace/workspaceCheckpoints.service.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { buildSyncBaseline, buildPageRegistry, parseEditorDocument, toProjectFramework } from "../services/compiler/pageRegistry.js";
import {
  listProjectPages,
  createProjectPage,
  updateProjectPage,
  deleteProjectPage,
  PageImportError,
} from "../services/project/projectPages.service.js";
import { buildSourcePreview } from "../services/preview/sourcePreview.service.js";
import { RoundTripContractService } from "../services/compiler/roundTripContract.service.js";
import {
  createPageLifecycle,
  renameOrMovePage,
  retirePageReversible,
  restorePageDraft,
} from "../services/compiler/pageRegistry.js";
import { ReferenceProjectBenchmarkService } from "../services/benchmark/referenceProjectBenchmark.service.js";
import { DynamicSourcePlannerService } from "../services/generator/dynamicSourcePlanner.service.js";
import { SafeCleanupEngineService } from "../services/generator/safeCleanupEngine.service.js";
import { DataModelGeneratorService } from "../services/generator/dataModelGenerator.service.js";
import { ExternalDatabaseIntrospectionService } from "../services/generator/externalDatabaseIntrospection.service.js";
import { contractFirstApiGenerator } from "../services/api/contractFirstApiGenerator.service.js";
import { applicationAuth } from "../services/auth/applicationAuth.service.js";
import { unifiedExecutionAuthorization } from "../services/auth/unifiedExecutionAuthorization.service.js";
import { databaseStudioViews } from "../services/database/databaseStudioViews.service.js";
import {
  environmentBindingService,
  requireEnvironmentClass,
  toPublicBinding,
} from "../services/environment/environmentBinding.service.js";
import { recordAuditLog } from "../services/audit.service.js";
import { FRESH_AUTH_WINDOW_MS } from "../services/cms/contentLifecycle.service.js";
import { targetResolutionService } from "../services/environment/targetResolution.service.js";
import { unifiedMigrationAuthority } from "../services/migration/unifiedMigrationAuthority.service.js";
import { applicationReleaseQualificationService } from "../services/qualification/applicationReleaseQualification.service.js";
import { controlPlaneReconciliationService } from "../services/architecture/controlPlaneReconciliation.service.js";
import { getAuthUser } from "./project/shared.js";



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
