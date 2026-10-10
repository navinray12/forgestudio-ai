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
  listPagesHandler,
  createPageHandler,
  updatePageHandler,
  deletePageHandler,
  getSourcePreviewHandler,
  syncVisualToCodeHandler,
  syncCodeToVisualHandler,
  generateReactProjectHandler,
  generateNextJsProjectHandler,
  getGenerationPlanHandler,
  regenerateScopeHandler,
  exportProjectZipHandler,
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
import {
  assembleContextHandler,
  getContextSnapshotHandler,
  createMemoryHandler,
  listMemoriesHandler,
  getMemoryHandler,
  updateMemoryHandler,
  revokeMemoryHandler,
  generatePlanHandler,
  getPlanHandler,
  approvePlanHandler,
  rejectPlanHandler,
  analyzeArchitectureHandler,
  getArchitectureSnapshotHandler,
  listArchitectureFindingsHandler,
  createTaskHandler,
  listTasksHandler,
  getTaskHandler,
  startRunHandler,
  getRunHandler,
  pauseRunHandler,
  resumeRunHandler,
  cancelRunHandler,
  retryRunHandler,
  compareRunsHandler,
  getRunEventsHandler,
  streamRunEventsHandler,
  listArtifactsHandler,
} from "../controllers/aiPlatform.controller.js";
import {
  getDatabaseHandler,
  listDatabasesHandler,
  branchDatabaseHandler,
  listTablesHandler,
  getTableSchemaHandler,
  createTableHandler,
  alterTableHandler,
  dropTableHandler,
  introspectSchemaHandler,
  createBackupHandler,
  listBackupsHandler,
  restoreBackupHandler,
  getDatabaseMetricsHandler,
  listMigrationsHandler,
  applyMigrationHandler,
  rollbackMigrationHandler,
  getTableDataHandler,
  insertRowHandler,
  updateRowHandler,
  deleteRowHandler,
  executeSqlQueryHandler,
  explainQueryHandler,
  getQueryHistoryHandler,
  seedTableDataHandler,
  exportTableDataHandler,
  getApiConfigsHandler,
  updateApiConfigHandler,
  generateOpenApiSpecHandler,
  generateTypedClientHandler,
  handleListRowsHandler,
  handleGetRowHandler,
  handleCreateRowHandler,
  handleUpdateRowHandler,
  handleDeleteRowHandler,
  createBucketHandler,
  listBucketsHandler,
  getBucketHandler,
  deleteBucketHandler,
  uploadObjectHandler,
  downloadObjectHandler,
  listObjectsHandler,
  deleteObjectHandler,
  generateSignedUrlHandler,
} from "../controllers/dataPlatform.controller.js";
import { RuntimePlatformController } from "../controllers/runtimePlatform.controller.js";
import { QualityPlatformController } from "../controllers/qualityPlatform.controller.js";
import { DevOpsPlatformController } from "../controllers/devopsPlatform.controller.js";
import { IntelligencePlatformController } from "../controllers/intelligencePlatform.controller.js";
import { DeveloperPlatformController } from "../controllers/developerPlatform.controller.js";
import { CodeIntelligenceController } from "../modules/code-intelligence/codeIntelligence.controller.js";
import { KnowledgeGraphController } from "../modules/knowledge-graph/knowledgeGraph.controller.js";
import { DesignSystemPlatformController } from "../modules/design-system/designSystem.controller.js";

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

// Visual pages (registry, routes and their source files) & preview of the persisted source
router.get("/:id/pages", listPagesHandler);
router.post("/:id/pages", createPageHandler);
router.patch("/:id/pages/:pageId", updatePageHandler);
router.delete("/:id/pages/:pageId", deletePageHandler);
router.get("/:id/preview/source", getSourcePreviewHandler);

// Project Generators (Modules 08 & 09)
router.post("/:id/generate/react", generateReactProjectHandler);
router.post("/:id/generate/next", generateNextJsProjectHandler);
router.get("/:id/generate/plan", getGenerationPlanHandler);
router.post("/:id/generate/scope", regenerateScopeHandler);
router.get("/:id/export/zip", exportProjectZipHandler);

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

// ========================================================
// AI Engineering Platform (Modules 37–42)
// ========================================================

// Module 37: AI Context Engine
router.post("/:id/ai/context", assembleContextHandler);
router.get("/:id/ai/context/:snapshotId", getContextSnapshotHandler);

// Module 38: AI Project Memory
router.post("/:id/ai/memories", createMemoryHandler);
router.get("/:id/ai/memories", listMemoriesHandler);
router.get("/:id/ai/memories/:memoryId", getMemoryHandler);
router.patch("/:id/ai/memories/:memoryId", updateMemoryHandler);
router.post("/:id/ai/memories/:memoryId/revoke", revokeMemoryHandler);

// Module 39: AI Planning Agent
router.post("/:id/ai/plans", generatePlanHandler);
router.get("/:id/ai/plans/:planId", getPlanHandler);
router.post("/:id/ai/plans/:planId/approve", approvePlanHandler);
router.post("/:id/ai/plans/:planId/reject", rejectPlanHandler);

// Module 40: AI Architecture Agent
router.post("/:id/ai/architecture/analyze", analyzeArchitectureHandler);
router.get("/:id/ai/architecture/snapshot", getArchitectureSnapshotHandler);
router.get("/:id/ai/architecture/findings", listArchitectureFindingsHandler);

// Module 42: Agent Task / Run Manager
router.post("/:id/ai/tasks", createTaskHandler);
router.get("/:id/ai/tasks", listTasksHandler);
router.get("/:id/ai/tasks/:taskId", getTaskHandler);
router.post("/:id/ai/tasks/:taskId/run", startRunHandler);
router.get("/:id/ai/runs/:runId", getRunHandler);
router.post("/:id/ai/runs/:runId/pause", pauseRunHandler);
router.post("/:id/ai/runs/:runId/resume", resumeRunHandler);
router.post("/:id/ai/runs/:runId/cancel", cancelRunHandler);
router.post("/:id/ai/runs/:runId/retry", retryRunHandler);
router.get("/:id/ai/runs/:runId/compare/:otherRunId", compareRunsHandler);
router.get("/:id/ai/runs/:runId/events", getRunEventsHandler);
router.get("/:id/ai/runs/:runId/events/stream", streamRunEventsHandler);
router.get("/:id/ai/runs/:runId/artifacts", listArtifactsHandler);

// ========================================================
// Forge Data Platform (Modules 25–28)
// ========================================================

// Module 25: Forge Database
router.get("/:id/database", getDatabaseHandler);
router.get("/:id/database/list", listDatabasesHandler);
router.post("/:id/database/branch", branchDatabaseHandler);
router.get("/:id/database/:databaseId/tables", listTablesHandler);
router.get("/:id/database/:databaseId/tables/:tableName/schema", getTableSchemaHandler);
router.post("/:id/database/:databaseId/tables", createTableHandler);
router.patch("/:id/database/:databaseId/tables/:tableName", alterTableHandler);
router.delete("/:id/database/:databaseId/tables/:tableName", dropTableHandler);
router.get("/:id/database/:databaseId/introspect", introspectSchemaHandler);
router.post("/:id/database/:databaseId/backups", createBackupHandler);
router.get("/:id/database/:databaseId/backups", listBackupsHandler);
router.post("/:id/database/:databaseId/backups/:backupId/restore", restoreBackupHandler);
router.get("/:id/database/:databaseId/metrics", getDatabaseMetricsHandler);
router.get("/:id/database/:databaseId/migrations", listMigrationsHandler);
router.post("/:id/database/:databaseId/migrations/:migrationId/apply", applyMigrationHandler);
router.post("/:id/database/:databaseId/migrations/:migrationId/rollback", rollbackMigrationHandler);

// Module 26: Database Studio
router.get("/:id/database/:databaseId/tables/:tableName/data", getTableDataHandler);
router.post("/:id/database/:databaseId/tables/:tableName/data", insertRowHandler);
router.patch("/:id/database/:databaseId/tables/:tableName/data", updateRowHandler);
router.delete("/:id/database/:databaseId/tables/:tableName/data", deleteRowHandler);
router.post("/:id/database/:databaseId/sql", executeSqlQueryHandler);
router.post("/:id/database/:databaseId/explain", explainQueryHandler);
router.get("/:id/database/:databaseId/history", getQueryHistoryHandler);
router.post("/:id/database/:databaseId/tables/:tableName/seed", seedTableDataHandler);
router.get("/:id/database/:databaseId/tables/:tableName/export", exportTableDataHandler);

// Module 27: Data / API Layer
router.get("/:id/database/:databaseId/api/configs", getApiConfigsHandler);
router.patch("/:id/database/:databaseId/api/configs/:tableName", updateApiConfigHandler);
router.get("/:id/database/:databaseId/api/openapi.json", generateOpenApiSpecHandler);
router.get("/:id/database/:databaseId/api/client.ts", generateTypedClientHandler);

// Project Application Data REST APIs
router.get("/:id/data/:tableName", handleListRowsHandler);
router.get("/:id/data/:tableName/:rowId", handleGetRowHandler);
router.post("/:id/data/:tableName", handleCreateRowHandler);
router.patch("/:id/data/:tableName/:rowId", handleUpdateRowHandler);
router.delete("/:id/data/:tableName/:rowId", handleDeleteRowHandler);

// Module 28: Object Storage
router.post("/:id/storage/buckets", createBucketHandler);
router.get("/:id/storage/buckets", listBucketsHandler);
router.get("/:id/storage/buckets/:bucketName", getBucketHandler);
router.delete("/:id/storage/buckets/:bucketName", deleteBucketHandler);
router.post("/:id/storage/buckets/:bucketName/objects", uploadObjectHandler);
router.get("/:id/storage/buckets/:bucketName/objects/:key/download", downloadObjectHandler);
router.get("/:id/storage/buckets/:bucketName/objects", listObjectsHandler);
router.delete("/:id/storage/buckets/:bucketName/objects/:key", deleteObjectHandler);
router.post("/:id/storage/buckets/:bucketName/signed-url", generateSignedUrlHandler);

// Modules 46–52: Application Runtime Platform
// Module 46: Serverless Functions
router.get("/:id/runtime/functions", RuntimePlatformController.listFunctions);
router.post("/:id/runtime/functions", RuntimePlatformController.createFunction);
router.get("/:id/runtime/functions/:fnId", RuntimePlatformController.getFunction);
router.patch("/:id/runtime/functions/:fnId", RuntimePlatformController.updateFunction);
router.delete("/:id/runtime/functions/:fnId", RuntimePlatformController.deleteFunction);
router.post("/:id/runtime/functions/:fnId/invoke", RuntimePlatformController.invokeFunction);
router.get("/:id/runtime/functions/:fnId/logs", RuntimePlatformController.getFunctionLogs);

// Module 47: Background Jobs & Queue
router.get("/:id/runtime/queues", RuntimePlatformController.listQueues);
router.post("/:id/runtime/queues", RuntimePlatformController.createQueue);
router.get("/:id/runtime/queues/:queueId/metrics", RuntimePlatformController.getQueueMetrics);
router.get("/:id/runtime/queues/:queueId/jobs", RuntimePlatformController.listJobs);
router.post("/:id/runtime/queues/:queueId/jobs", RuntimePlatformController.enqueueJob);
router.post("/:id/runtime/queues/:queueId/jobs/:jobId/replay", RuntimePlatformController.replayDlqJob);

// Module 48: Scheduler / Cron Engine
router.get("/:id/runtime/schedules", RuntimePlatformController.listSchedules);
router.post("/:id/runtime/schedules", RuntimePlatformController.createSchedule);
router.post("/:id/runtime/schedules/:scheduleId/trigger", RuntimePlatformController.triggerSchedule);
router.delete("/:id/runtime/schedules/:scheduleId", RuntimePlatformController.deleteSchedule);
router.get("/:id/runtime/schedules/:scheduleId/history", RuntimePlatformController.getScheduleHistory);

// Module 49: Event Bus & Webhook Platform
router.get("/:id/runtime/topics", RuntimePlatformController.listTopics);
router.post("/:id/runtime/topics", RuntimePlatformController.createTopic);
router.post("/:id/runtime/topics/:topicId/publish", RuntimePlatformController.publishEvent);
router.get("/:id/runtime/subscriptions", RuntimePlatformController.listSubscriptions);
router.post("/:id/runtime/subscriptions", RuntimePlatformController.createSubscription);
router.get("/:id/runtime/webhooks/deliveries", RuntimePlatformController.listWebhookDeliveries);

// Module 50: Realtime Engine
router.get("/:id/runtime/channels", RuntimePlatformController.listChannels);
router.post("/:id/runtime/channels", RuntimePlatformController.createChannel);
router.post("/:id/runtime/channels/:channel/join", RuntimePlatformController.joinChannel);
router.post("/:id/runtime/channels/:channel/broadcast", RuntimePlatformController.broadcastMessage);
router.get("/:id/runtime/channels/:channel/presence", RuntimePlatformController.getChannelPresence);
router.get("/:id/runtime/channels/:channel/messages", RuntimePlatformController.getChannelMessages);

// Module 51: Cache / KV Layer
router.get("/:id/runtime/kv/namespaces", RuntimePlatformController.listKvNamespaces);
router.post("/:id/runtime/kv/namespaces", RuntimePlatformController.createKvNamespace);
router.get("/:id/runtime/kv/:namespace/keys", RuntimePlatformController.listKvKeys);
router.get("/:id/runtime/kv/:namespace/keys/:key", RuntimePlatformController.getKvKey);
router.put("/:id/runtime/kv/:namespace/keys/:key", RuntimePlatformController.setKvKey);
router.delete("/:id/runtime/kv/:namespace/keys/:key", RuntimePlatformController.deleteKvKey);
router.post("/:id/runtime/kv/:namespace/invalidate-tag", RuntimePlatformController.invalidateKvTag);

// Module 52: API Gateway & Schema Registry
router.get("/:id/runtime/gateway/routes", RuntimePlatformController.listGatewayRoutes);
router.post("/:id/runtime/gateway/routes", RuntimePlatformController.createGatewayRoute);
router.delete("/:id/runtime/gateway/routes/:routeId", RuntimePlatformController.deleteGatewayRoute);
router.all("/:id/runtime/gateway/dispatch/*splat", RuntimePlatformController.dispatchGatewayRequest);
router.get("/:id/runtime/schemas", RuntimePlatformController.listSchemas);
router.post("/:id/runtime/schemas", RuntimePlatformController.registerSchema);

// Modules 43–45: Quality, API Testing & Browser DevTools Platform
// Module 43: Automated Testing Platform
router.get("/:id/quality/tests/suites", QualityPlatformController.listTestSuites);
router.post("/:id/quality/tests/suites/discover", QualityPlatformController.discoverTestSuites);
router.post("/:id/quality/tests/run", QualityPlatformController.runTests);
router.get("/:id/quality/tests/runs", QualityPlatformController.listTestRuns);

// Module 44: API Testing Studio
router.get("/:id/quality/api/collections", QualityPlatformController.listCollections);
router.post("/:id/quality/api/collections", QualityPlatformController.createCollection);
router.get("/:id/quality/api/collections/:collId/requests", QualityPlatformController.listRequests);
router.post("/:id/quality/api/collections/:collId/requests", QualityPlatformController.createRequest);
router.post("/:id/quality/api/requests/:reqId/execute", QualityPlatformController.executeRequest);
router.post("/:id/quality/api/collections/:collId/run", QualityPlatformController.runCollection);
router.post("/:id/quality/api/collections/import-openapi", QualityPlatformController.importOpenApi);

// Module 45: Browser DevTools & Runtime Inspector
router.get("/:id/quality/devtools/state", QualityPlatformController.getDevToolsState);
router.post("/:id/quality/devtools/console", QualityPlatformController.ingestConsoleLog);
router.post("/:id/quality/devtools/network", QualityPlatformController.ingestNetworkTrace);
router.post("/:id/quality/devtools/dom", QualityPlatformController.updateDomTree);
router.post("/:id/quality/devtools/vitals", QualityPlatformController.updateWebVitals);
router.post("/:id/quality/devtools/storage", QualityPlatformController.updateStorage);
router.post("/:id/quality/devtools/snapshot", QualityPlatformController.captureSnapshot);
router.get("/:id/quality/devtools/snapshots", QualityPlatformController.listSnapshots);
router.post("/:id/quality/devtools/analyze-ai", QualityPlatformController.analyzeErrorWithAi);

// Modules 53–56: DevOps, Observability, Security & Feature Flags Platform
// Module 53: Preview Environment Manager
router.get("/:id/devops/previews", DevOpsPlatformController.listPreviewEnvironments);
router.post("/:id/devops/previews", DevOpsPlatformController.createPreviewEnvironment);
router.get("/:id/devops/previews/:envId", DevOpsPlatformController.getPreviewEnvironment);
router.post("/:id/devops/previews/:envId/deploy", DevOpsPlatformController.deployPreviewEnvironment);
router.post("/:id/devops/previews/:envId/extend-ttl", DevOpsPlatformController.extendPreviewTtl);
router.delete("/:id/devops/previews/:envId", DevOpsPlatformController.teardownPreviewEnvironment);
router.post("/:id/devops/previews/:envId/promote", DevOpsPlatformController.promotePreviewEnvironment);

// Module 54: Developer Observability
router.post("/:id/devops/observability/logs", DevOpsPlatformController.ingestLog);
router.get("/:id/devops/observability/logs", DevOpsPlatformController.queryLogs);
router.post("/:id/devops/observability/spans", DevOpsPlatformController.recordSpan);
router.get("/:id/devops/observability/traces/:traceId", DevOpsPlatformController.getTrace);
router.get("/:id/devops/observability/metrics", DevOpsPlatformController.getApmMetrics);
router.get("/:id/devops/observability/issues", DevOpsPlatformController.listIssues);
router.patch("/:id/devops/observability/issues/:issueId", DevOpsPlatformController.updateIssueStatus);
router.post("/:id/devops/observability/issues/:issueId/diagnose", DevOpsPlatformController.diagnoseIssue);

// Module 55: Application Security Scanning
router.post("/:id/devops/security/scan", DevOpsPlatformController.runSecurityScan);
router.get("/:id/devops/security/latest", DevOpsPlatformController.getLatestScan);
router.get("/:id/devops/security/scans", DevOpsPlatformController.listScans);
router.post("/:id/devops/security/remediate", DevOpsPlatformController.generateAiRemediation);

// Module 56: Feature Flags & Remote Configuration
router.get("/:id/devops/flags", DevOpsPlatformController.listFlags);
router.post("/:id/devops/flags", DevOpsPlatformController.createFlag);
router.get("/:id/devops/flags/:key", DevOpsPlatformController.getFlag);
router.patch("/:id/devops/flags/:key", DevOpsPlatformController.updateFlag);
router.post("/:id/devops/flags/:key/toggle", DevOpsPlatformController.toggleFlag);
router.delete("/:id/devops/flags/:key", DevOpsPlatformController.deleteFlag);
router.post("/:id/devops/flags/evaluate", DevOpsPlatformController.evaluateFlags);
router.get("/:id/devops/config", DevOpsPlatformController.listConfigs);
router.put("/:id/devops/config", DevOpsPlatformController.setConfig);
router.delete("/:id/devops/config/:key", DevOpsPlatformController.deleteConfig);

// Modules 62–64: Intelligence, Optimization, Recovery & Architecture Platform
// Module 62: Optimization Engine
router.post("/:id/intelligence/optimization/audit", IntelligencePlatformController.runOptimizationAudit);
router.get("/:id/intelligence/optimization/latest", IntelligencePlatformController.getLatestAudit);
router.get("/:id/intelligence/optimization/audits", IntelligencePlatformController.listAudits);
router.post("/:id/intelligence/optimization/patch/:recId", IntelligencePlatformController.generateAiOptimizationPatch);

// Module 63: Project Snapshot / Checkpoint / Recovery
router.post("/:id/intelligence/checkpoints", IntelligencePlatformController.createCheckpoint);
router.get("/:id/intelligence/checkpoints", IntelligencePlatformController.listCheckpoints);
router.get("/:id/intelligence/checkpoints/:checkpointId", IntelligencePlatformController.getCheckpoint);
router.get("/:id/intelligence/checkpoints/:checkpointId/diff", IntelligencePlatformController.diffCheckpointWithWorkspace);
router.post("/:id/intelligence/checkpoints/:checkpointId/rollback", IntelligencePlatformController.rollbackToCheckpoint);
router.post("/:id/intelligence/checkpoints/:checkpointId/restore-file", IntelligencePlatformController.restoreSingleFile);
router.get("/:id/intelligence/checkpoints/:checkpointId/export", IntelligencePlatformController.exportDisasterRecoveryBundle);
router.post("/:id/intelligence/checkpoints/import", IntelligencePlatformController.importDisasterRecoveryBundle);

// Module 64: Architecture Visualization
router.get("/:id/intelligence/architecture/graph", IntelligencePlatformController.getArchitectureGraph);

// =========================================================================
// Modules 57–61: Standalone Developer Platform Capabilities
// =========================================================================

// Module 57: Collaborative Development
router.get("/:id/collaboration/sessions", DeveloperPlatformController.getActiveSessions);
router.post("/:id/collaboration/heartbeat", DeveloperPlatformController.heartbeatSession);
router.delete("/:id/collaboration/sessions/:sessionId", DeveloperPlatformController.closeSession);
router.post("/:id/collaboration/conflict/detect", DeveloperPlatformController.detectFileConflict);
router.post("/:id/collaboration/conflict/resolve", DeveloperPlatformController.resolveFileConflict);
router.get("/:id/collaboration/comments", DeveloperPlatformController.listComments);
router.post("/:id/collaboration/comments", DeveloperPlatformController.createComment);
router.post("/:id/collaboration/comments/:commentId/reply", DeveloperPlatformController.replyComment);
router.post("/:id/collaboration/comments/:commentId/resolve", DeveloperPlatformController.resolveComment);
router.get("/:id/collaboration/reviews", DeveloperPlatformController.listReviews);
router.post("/:id/collaboration/reviews", DeveloperPlatformController.createReview);
router.post("/:id/collaboration/reviews/:reviewId/decision", DeveloperPlatformController.submitReviewDecision);
router.post("/:id/collaboration/preview-sessions", DeveloperPlatformController.createPreviewSession);
router.get("/:id/collaboration/preview-sessions/:sessionId", DeveloperPlatformController.getPreviewSession);
router.get("/:id/collaboration/timeline", DeveloperPlatformController.getActivityTimeline);

// Module 58: Forge Extension & Plugin SDK
router.get("/:id/extensions", DeveloperPlatformController.listPlugins);
router.post("/:id/extensions/install", DeveloperPlatformController.installPlugin);
router.post("/:id/extensions/:pluginId/enable", DeveloperPlatformController.enablePlugin);
router.post("/:id/extensions/:pluginId/disable", DeveloperPlatformController.disablePlugin);
router.delete("/:id/extensions/:pluginId", DeveloperPlatformController.uninstallPlugin);
router.post("/:id/extensions/hooks/execute", DeveloperPlatformController.executePluginHook);
router.post("/:id/extensions/tools/execute", DeveloperPlatformController.executePluginAiTool);

// Module 59: Project Import & Migration
router.post("/:id/import/start", DeveloperPlatformController.startImport);
router.get("/:id/import/jobs/:jobId", DeveloperPlatformController.getImportStatus);
router.post("/:id/import/jobs/:jobId/commit", DeveloperPlatformController.commitImport);

// Module 60: Monorepo & Multi-service Support
router.get("/:id/monorepo/graph", DeveloperPlatformController.discoverMonorepo);
router.post("/:id/monorepo/affected", DeveloperPlatformController.getAffectedPackages);
router.post("/:id/monorepo/deploy-plan", DeveloperPlatformController.generateCoordinatedDeployPlan);

// Module 61: Container & Infrastructure Tooling
router.get("/:id/containers/dockerfile", DeveloperPlatformController.getDockerfile);
router.post("/:id/containers/dockerfile/generate", DeveloperPlatformController.generateDockerfile);
router.post("/:id/containers/build", DeveloperPlatformController.buildContainer);
router.post("/:id/containers/run", DeveloperPlatformController.runContainer);
router.get("/:id/containers", DeveloperPlatformController.listContainers);
router.delete("/:id/containers/:runId", DeveloperPlatformController.stopContainer);
router.get("/:id/containers/compose", DeveloperPlatformController.getCompose);
router.post("/:id/infra/kubernetes/generate", DeveloperPlatformController.generateKubernetes);
router.post("/:id/infra/terraform/generate", DeveloperPlatformController.generateTerraform);
router.get("/:id/infra/validate", DeveloperPlatformController.validateInfrastructure);

// =========================================================================
// Milestone 1: Features 35 & 36
// =========================================================================

// Module 35: Code Intelligence & Semantic Index
router.get("/:id/intelligence/symbols", CodeIntelligenceController.getSymbols);
router.get("/:id/intelligence/definition", CodeIntelligenceController.getDefinition);
router.get("/:id/intelligence/references", CodeIntelligenceController.getReferences);
router.get("/:id/intelligence/files/:fileId", CodeIntelligenceController.getFileDependencies);
router.post("/:id/intelligence/index", CodeIntelligenceController.indexProject);
router.get("/:id/intelligence/status", CodeIntelligenceController.getStatus);

// Module 36: Repository Knowledge Graph
router.get("/:id/knowledge-graph/query", KnowledgeGraphController.queryGraph);
router.post("/:id/knowledge-graph/query", KnowledgeGraphController.queryGraph);
router.post("/:id/knowledge-graph/build", KnowledgeGraphController.buildGraph);
router.get("/:id/knowledge-graph", KnowledgeGraphController.getGraph);

// =========================================================================
// Milestone A: Features 34, 33, 32
// =========================================================================

// Module 34: Design System Engine
router.get("/:id/design-system/tokens", DesignSystemPlatformController.getTokens);
router.post("/:id/design-system/tokens", DesignSystemPlatformController.setToken);
router.delete("/:id/design-system/tokens/:category/:name", DesignSystemPlatformController.deleteToken);
router.get("/:id/design-system/tokens/compile", DesignSystemPlatformController.compileTokens);
router.post("/:id/design-system/tokens/apply", DesignSystemPlatformController.applyTokens);

// Module 33: Component Registry
router.post("/:id/components/discover", DesignSystemPlatformController.discoverComponents);
router.get("/:id/components", DesignSystemPlatformController.listComponents);
router.get("/:id/components/:componentId", DesignSystemPlatformController.getComponent);
router.get("/:id/components/:componentId/export", DesignSystemPlatformController.exportComponent);

// Module 32: Project Template Engine
router.get("/templates", DesignSystemPlatformController.listTemplates);
router.post("/:id/templates/:templateId/scaffold", DesignSystemPlatformController.scaffoldTemplate);

export default router;

