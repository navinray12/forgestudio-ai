/**
 * Regression guard: route table and middleware placement of project.routes.ts, and its mounts in
 * app.ts.
 *
 * Neither file is imported (both pull in Prisma, services and app bootstrap). Their source is
 * parsed instead, and the result is compared with golden snapshots captured at commit 703dffc.
 * Update a snapshot only for an intentional routing change.
 *
 * Snapshot line format: `METHOD /subpath -> handler[, handler...]`, in registration order.
 * The single `USE` line is router-level middleware. Routes registered by the migration-step
 * `for...of` loop are expanded per step.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseAst } from "rolldown/parseAst";

const ROUTES_PATH = fileURLToPath(new URL("../../routes/project.routes.ts", import.meta.url));
const APP_PATH = fileURLToPath(new URL("../../app.ts", import.meta.url));

/** project.routes.ts: every router call, in registration order. */
const EXPECTED_ROUTER_CALLS = [
  "USE requireAuth",
  "GET /domains/availability -> checkDomainAvailabilityHandler",
  "POST /github/import -> importGithubHandler",
  "POST /github/webhook -> githubWebhookHandler",
  "POST /cli/execute -> executeCliHandler",
  "POST / -> createProjectHandler",
  "GET / -> listProjectsHandler",
  "GET /website/:websiteId -> getProjectByWebsiteHandler",
  "GET /:id -> getProjectHandler",
  "PATCH /:id -> updateProjectHandler",
  "POST /:id/lifecycle -> transitionLifecycleHandler",
  "POST /:id/clone -> cloneProjectHandler",
  "GET /:id/files -> getFileTreeHandler",
  "GET /:id/files/content -> readFileHandler",
  "POST /:id/files -> writeFileHandler",
  "DELETE /:id/files -> deleteFileHandler",
  "POST /:id/files/move -> moveFileHandler",
  "GET /:id/files/:fileId/revisions -> getFileRevisionsHandler",
  "POST /:id/snapshots -> createSnapshotHandler",
  "GET /:id/snapshots -> listSnapshotsHandler",
  "GET /:id/manifest -> getManifestHandler",
  "POST /:id/application-spec/revisions -> commitProjectApplicationSpecHandler",
  "GET /:id/application-spec/:applicationId -> getProjectApplicationSpecHandler",
  "PUT /:id/manifest -> updateManifestHandler",
  "POST /:id/compile -> compileProjectHandler",
  "POST /:id/sync/visual-to-code -> syncVisualToCodeHandler",
  "POST /:id/sync/visual-to-code/plan -> planVisualToCodeHandler",
  "POST /:id/sync/code-to-visual -> syncCodeToVisualHandler",
  "GET /:id/workspace/checkpoint -> getWorkspaceCheckpointHandler",
  "GET /:id/workspace/checkpoints -> listWorkspaceCheckpointsHandler",
  "GET /:id/roundtrip/compatibility -> getRoundTripCompatibilityHandler",
  "POST /:id/roundtrip/classify -> classifyConstructHandler",
  "POST /:id/pages/lifecycle/create -> createPageLifecycleHandler",
  "POST /:id/pages/lifecycle/move -> movePageLifecycleHandler",
  "POST /:id/pages/lifecycle/retire -> retirePageLifecycleHandler",
  "POST /:id/pages/lifecycle/restore -> restorePageLifecycleHandler",
  "POST /benchmark/reference-suite -> runReferenceBenchmarkHandler",
  "POST /:id/benchmark/reference-suite -> runReferenceBenchmarkHandler",
  "POST /:id/generator/plan-symbols -> planSymbolsHandler",
  "POST /:id/generator/evaluate-regeneration -> evaluateRegenerationHandler",
  "POST /:id/generator/cleanup-plan -> createCleanupPlanHandler",
  "POST /:id/generator/apply-cleanup -> applyCleanupPlanHandler",
  "GET /:id/app-generation-templates -> listAppGenerationTemplatesHandler",
  "GET /:id/app-generations -> listAppGenerationsHandler",
  "POST /:id/app-generations -> createAppGenerationHandler",
  "GET /:id/app-generations/:runId -> getAppGenerationHandler",
  "GET /:id/app-generations/:runId/source-verification -> verifyAppGenerationSourceHandler",
  "POST /:id/app-generations/:runId/retry -> retryAppGenerationHandler",
  "POST /:id/data-model/build-spec -> buildDomainModelSpecHandler",
  "POST /:id/data-model/validate-mutation -> validateDataMutationHandler",
  "POST /:id/database/introspect -> introspectExternalDatabaseHandler",
  "POST /:id/api/contract-first/generate -> generateContractFirstApiHandler",
  "POST /:id/auth/application/bootstrap -> bootstrapApplicationAuthHandler",
  "POST /:id/auth/unified/authorize -> evaluateUnifiedAuthorizationHandler",
  "GET /:id/database/studio/views/:viewName -> getDatabaseStudioViewHandler",
  "POST /:id/database/studio/views/:viewName -> getDatabaseStudioViewHandler",
  "GET /:id/environment/bindings -> resolveEnvironmentBindingHandler",
  "GET /:id/environment/bindings/list -> listEnvironmentBindingsHandler",
  "PUT /:id/environment/bindings/:environment -> registerEnvironmentBindingHandler",
  "DELETE /:id/environment/bindings/:environment -> retireEnvironmentBindingHandler",
  "POST /:id/environment/pools/resolve -> resolveTargetPoolHandler",
  "POST /:id/database/migrations/unified-execute -> executeUnifiedMigrationHandler",
  "POST /:id/architecture/package/validate -> validateGeneratedPackageHandler",
  "GET /:id/architecture/control-plane/diagnostics -> verifyControlPlaneDiagnosticsHandler",
  "GET /:id/pages -> listPagesHandler",
  "POST /:id/pages -> createPageHandler",
  "PATCH /:id/pages/:pageId -> updatePageHandler",
  "DELETE /:id/pages/:pageId -> deletePageHandler",
  "GET /:id/preview/source -> getSourcePreviewHandler",
  "POST /:id/generate/react -> generateReactProjectHandler",
  "POST /:id/generate/next -> generateNextJsProjectHandler",
  "GET /:id/generate/plan -> getGenerationPlanHandler",
  "POST /:id/generate/scope -> regenerateScopeHandler",
  "GET /:id/export/zip -> exportProjectZipHandler",
  "GET /:id/workspace-state -> getWorkspaceStateHandler",
  "PUT /:id/workspace-state -> saveWorkspaceStateHandler",
  "GET /:id/dependencies -> getDependenciesHandler",
  "POST /:id/dependencies/install -> installDependencyHandler",
  "DELETE /:id/dependencies/remove -> removeDependencyHandler",
  "POST /:id/dependencies/explain-ai -> explainDependencyAiHandler",
  "GET /:id/runtime/status -> getRuntimeStatusHandler",
  "POST /:id/runtime/execute -> executeSandboxHandler",
  "POST /:id/runtime/stop -> stopSandboxProcessHandler",
  "POST /:id/builds -> triggerBuildHandler",
  "GET /:id/builds -> listBuildsHandler",
  "POST /:id/preview/session -> createPreviewSessionHandler",
  "PATCH /:id/preview/session/:token/viewport -> updatePreviewViewportHandler",
  "POST /:id/preview/session/:token/console -> logPreviewConsoleHandler",
  "POST /:id/terminal/sessions -> createTerminalHandler",
  "POST /:id/terminal/sessions/:sessionId/execute -> executeTerminalHandler",
  "GET /:id/terminal/tasks -> getTerminalTasksHandler",
  "POST /:id/debug/session -> startDebugSessionHandler",
  "POST /:id/debug/session/:sessionId/breakpoints -> setBreakpointHandler",
  "DELETE /:id/debug/session/:sessionId/breakpoints/:bpId -> removeBreakpointHandler",
  "POST /:id/debug/session/:sessionId/step -> stepDebugHandler",
  "POST /:id/debug/session/:sessionId/ask-ai -> askAiDebugHandler",
  "GET /:id/runtime/detect -> detectRuntimeHandler",
  "POST /:id/deployments -> createDeploymentHandler",
  "GET /:id/deployments -> listDeploymentsHandler",
  "GET /:id/deployments/:deploymentId -> getDeploymentHandler",
  "POST /:id/deployments/promote -> promoteDeploymentHandler",
  "POST /:id/deployments/rollback -> rollbackDeploymentHandler",
  "POST /:id/deployments/:deploymentId/health -> executeDeploymentHealthCheckHandler",
  "POST /:id/pipelines -> createPipelineRunHandler",
  "GET /:id/pipelines -> listPipelinesHandler",
  "GET /:id/pipelines/:pipelineId -> getPipelineHandler",
  "POST /:id/pipelines/:pipelineId/approve -> approvePipelineGateHandler",
  "POST /:id/pipelines/:pipelineId/rerun -> rerunPipelineHandler",
  "POST /:id/pipelines/:pipelineId/cancel -> cancelPipelineHandler",
  "POST /:id/domains/connect -> connectDomainHandler",
  "GET /:id/domains -> listDomainsHandler",
  "POST /:id/domains/:domainId/dns/configure -> configureDnsHandler",
  "POST /:id/domains/:domainId/verify -> verifyDomainOwnershipHandler",
  "POST /:id/domains/:domainId/bind -> bindDomainDeploymentHandler",
  "DELETE /:id/domains/:domainId -> detachDomainHandler",
  "POST /:id/git/init -> initGitHandler",
  "GET /:id/git/status -> getGitStatusHandler",
  "POST /:id/git/stage -> stageGitFilesHandler",
  "POST /:id/git/unstage -> unstageGitFilesHandler",
  "POST /:id/git/commit -> commitGitHandler",
  "GET /:id/git/branches -> listGitBranchesHandler",
  "POST /:id/git/branches -> createGitBranchHandler",
  "POST /:id/git/branches/switch -> switchGitBranchHandler",
  "DELETE /:id/git/branches/:branchName -> deleteGitBranchHandler",
  "GET /:id/git/diff -> getGitDiffHandler",
  "GET /:id/git/history -> getGitHistoryHandler",
  "POST /:id/git/merge -> mergeGitBranchHandler",
  "POST /:id/git/conflicts/resolve -> resolveGitConflictHandler",
  "POST /:id/git/merge/abort -> abortGitMergeHandler",
  "POST /:id/git/rebase -> rebaseGitHandler",
  "GET /:id/git/stashes -> listGitStashesHandler",
  "POST /:id/git/stashes -> createGitStashHandler",
  "POST /:id/git/stashes/:index/apply -> applyGitStashHandler",
  "DELETE /:id/git/stashes/:index -> dropGitStashHandler",
  "POST /:id/git/cherry-pick -> cherryPickGitHandler",
  "GET /:id/git/tags -> listGitTagsHandler",
  "POST /:id/git/tags -> createGitTagHandler",
  "DELETE /:id/git/tags/:name -> deleteGitTagHandler",
  "GET /:id/git/graph -> getGitGraphHandler",
  "POST /:id/github/connect -> connectGithubHandler",
  "POST /:id/github/create-repo -> createGithubRepoHandler",
  "POST /:id/github/fetch -> fetchGithubRemoteHandler",
  "POST /:id/github/pull -> pullGithubRemoteHandler",
  "POST /:id/github/push -> pushGithubRemoteHandler",
  "GET /:id/github/sync -> syncGithubBranchHandler",
  "POST /:id/github/pulls -> createGithubPrHandler",
  "GET /:id/github/pulls -> listGithubPrsHandler",
  "GET /:id/github/pulls/:prNumber -> getGithubPrDetailsHandler",
  "PATCH /:id/github/pulls/:prNumber -> updateGithubPrHandler",
  "GET /:id/github/commits/:commitHash/checks -> getGithubChecksHandler",
  "POST /:id/ai/complete -> aiGatewayCompleteHandler",
  "GET /ai/models -> aiGatewayModelsHandler",
  "GET /ai/health -> aiGatewayHealthHandler",
  "POST /:id/ai/byok -> aiGatewayByokHandler",
  "GET /:id/ai/usage -> aiGatewayUsageHandler",
  "GET /:id/ai/tools -> listToolsHandler",
  "POST /:id/ai/tools/execute -> executeToolHandler",
  "POST /:id/ai/tools/approve -> resolveToolApprovalHandler",
  "POST /:id/ai/coding/session -> createCodingSessionHandler",
  "POST /:id/ai/coding/plan -> generateCodingPlanHandler",
  "POST /:id/ai/coding/execute -> executeCodingPlanHandler",
  "POST /ai/creator/plan -> aiCreatorPlanHandler",
  "POST /ai/creator/generate -> aiCreatorGenerateHandler",
  "POST /:id/ai/creator/regenerate -> aiCreatorRegenerateHandler",
  "GET /:id/ai/website/audit -> aiWebsiteAuditHandler",
  "POST /:id/ai/website/fix -> aiWebsiteFixHandler",
  "GET /:id/mcp/servers -> listMcpServersHandler",
  "POST /:id/mcp/servers -> registerMcpServerHandler",
  "POST /:id/mcp/rpc -> mcpJsonRpcHandler",
  "POST /:id/mcp/invoke -> mcpInvokeToolHandler",
  "GET /mcp/scaffold -> mcpScaffoldHandler",
  "POST /:id/ai/context -> assembleContextHandler",
  "GET /:id/ai/context/:snapshotId -> getContextSnapshotHandler",
  "POST /:id/ai/memories -> createMemoryHandler",
  "GET /:id/ai/memories -> listMemoriesHandler",
  "GET /:id/ai/memories/:memoryId -> getMemoryHandler",
  "PATCH /:id/ai/memories/:memoryId -> updateMemoryHandler",
  "POST /:id/ai/memories/:memoryId/revoke -> revokeMemoryHandler",
  "POST /:id/ai/plans -> generatePlanHandler",
  "GET /:id/ai/plans/:planId -> getPlanHandler",
  "POST /:id/ai/plans/:planId/approve -> approvePlanHandler",
  "POST /:id/ai/plans/:planId/reject -> rejectPlanHandler",
  "POST /:id/ai/architecture/analyze -> analyzeArchitectureHandler",
  "GET /:id/ai/architecture/snapshot -> getArchitectureSnapshotHandler",
  "GET /:id/ai/architecture/findings -> listArchitectureFindingsHandler",
  "POST /:id/ai/tasks -> createTaskHandler",
  "GET /:id/ai/tasks -> listTasksHandler",
  "GET /:id/ai/tasks/:taskId -> getTaskHandler",
  "POST /:id/ai/tasks/:taskId/run -> startRunHandler",
  "GET /:id/ai/runs/:runId -> getRunHandler",
  "POST /:id/ai/runs/:runId/pause -> pauseRunHandler",
  "POST /:id/ai/runs/:runId/resume -> resumeRunHandler",
  "POST /:id/ai/runs/:runId/cancel -> cancelRunHandler",
  "POST /:id/ai/runs/:runId/retry -> retryRunHandler",
  "GET /:id/ai/runs/:runId/compare/:otherRunId -> compareRunsHandler",
  "GET /:id/ai/runs/:runId/events -> getRunEventsHandler",
  "GET /:id/ai/runs/:runId/events/stream -> streamRunEventsHandler",
  "GET /:id/ai/runs/:runId/artifacts -> listArtifactsHandler",
  "GET /:id/database -> getDatabaseHandler",
  "GET /:id/database/list -> listDatabasesHandler",
  "POST /:id/database/branch -> branchDatabaseHandler",
  "GET /:id/database/:databaseId/tables -> listTablesHandler",
  "GET /:id/database/:databaseId/tables/:tableName/schema -> getTableSchemaHandler",
  "POST /:id/database/:databaseId/tables -> createTableHandler",
  "PATCH /:id/database/:databaseId/tables/:tableName -> alterTableHandler",
  "DELETE /:id/database/:databaseId/tables/:tableName -> dropTableHandler",
  "GET /:id/database/:databaseId/introspect -> introspectSchemaHandler",
  "POST /:id/database/:databaseId/backups -> createBackupHandler",
  "GET /:id/database/:databaseId/backups -> listBackupsHandler",
  "POST /:id/database/:databaseId/backups/:backupId/restore -> restoreBackupHandler",
  "GET /:id/database/:databaseId/metrics -> getDatabaseMetricsHandler",
  "GET /:id/database/:databaseId/migrations -> listMigrationsHandler",
  "POST /:id/database/:databaseId/migrations/:migrationId/apply -> applyMigrationHandler",
  "POST /:id/database/:databaseId/migrations/:migrationId/rollback -> rollbackMigrationHandler",
  "POST /:id/database/:databaseId/migrations/plan -> planMigrationHandler",
  "POST /:id/database/:databaseId/migrations/baseline -> adoptMigrationBaselineHandler",
  "POST /:id/database/:databaseId/migrations/:migrationId/preflight -> migrationStepHandler(\"preflight\")",
  "POST /:id/database/:databaseId/migrations/:migrationId/rehearse -> migrationStepHandler(\"rehearse\")",
  "POST /:id/database/:databaseId/migrations/:migrationId/approve -> migrationStepHandler(\"approve\")",
  "POST /:id/database/:databaseId/migrations/:migrationId/execute -> migrationStepHandler(\"execute\")",
  "POST /:id/database/:databaseId/migrations/:migrationId/reconcile -> migrationStepHandler(\"reconcile\")",
  "POST /:id/database/:databaseId/migrations/:migrationId/retry -> migrationStepHandler(\"retry\")",
  "POST /:id/database/:databaseId/migrations/:migrationId/cancel -> migrationStepHandler(\"cancel\")",
  "GET /:id/database/:databaseId/tables/:tableName/data -> getTableDataHandler",
  "POST /:id/database/:databaseId/tables/:tableName/data -> insertRowHandler",
  "PATCH /:id/database/:databaseId/tables/:tableName/data -> updateRowHandler",
  "DELETE /:id/database/:databaseId/tables/:tableName/data -> deleteRowHandler",
  "POST /:id/database/:databaseId/sql -> executeSqlQueryHandler",
  "POST /:id/database/:databaseId/explain -> explainQueryHandler",
  "GET /:id/database/:databaseId/history -> getQueryHistoryHandler",
  "POST /:id/database/:databaseId/tables/:tableName/seed -> seedTableDataHandler",
  "GET /:id/database/:databaseId/tables/:tableName/export -> exportTableDataHandler",
  "GET /:id/database/:databaseId/api/configs -> getApiConfigsHandler",
  "PATCH /:id/database/:databaseId/api/configs/:tableName -> updateApiConfigHandler",
  "GET /:id/database/:databaseId/api/openapi.json -> generateOpenApiSpecHandler",
  "GET /:id/database/:databaseId/api/client.ts -> generateTypedClientHandler",
  "GET /:id/data/:tableName -> handleListRowsHandler",
  "GET /:id/data/:tableName/:rowId -> handleGetRowHandler",
  "POST /:id/data/:tableName -> handleCreateRowHandler",
  "PATCH /:id/data/:tableName/:rowId -> handleUpdateRowHandler",
  "DELETE /:id/data/:tableName/:rowId -> handleDeleteRowHandler",
  "POST /:id/storage/buckets -> createBucketHandler",
  "GET /:id/storage/buckets -> listBucketsHandler",
  "GET /:id/storage/buckets/:bucketName -> getBucketHandler",
  "DELETE /:id/storage/buckets/:bucketName -> deleteBucketHandler",
  "POST /:id/storage/buckets/:bucketName/objects -> uploadObjectHandler",
  "GET /:id/storage/buckets/:bucketName/objects/:key/download -> downloadObjectHandler",
  "GET /:id/storage/buckets/:bucketName/objects -> listObjectsHandler",
  "DELETE /:id/storage/buckets/:bucketName/objects/:key -> deleteObjectHandler",
  "POST /:id/storage/buckets/:bucketName/signed-url -> generateSignedUrlHandler",
  "GET /:id/runtime/functions -> RuntimePlatformController.listFunctions",
  "POST /:id/runtime/functions -> RuntimePlatformController.createFunction",
  "GET /:id/runtime/functions/:fnId -> RuntimePlatformController.getFunction",
  "PATCH /:id/runtime/functions/:fnId -> RuntimePlatformController.updateFunction",
  "DELETE /:id/runtime/functions/:fnId -> RuntimePlatformController.deleteFunction",
  "POST /:id/runtime/functions/:fnId/invoke -> RuntimePlatformController.invokeFunction",
  "GET /:id/runtime/functions/:fnId/logs -> RuntimePlatformController.getFunctionLogs",
  "GET /:id/runtime/queues -> RuntimePlatformController.listQueues",
  "POST /:id/runtime/queues -> RuntimePlatformController.createQueue",
  "GET /:id/runtime/queues/:queueId/metrics -> RuntimePlatformController.getQueueMetrics",
  "GET /:id/runtime/queues/:queueId/jobs -> RuntimePlatformController.listJobs",
  "POST /:id/runtime/queues/:queueId/jobs -> RuntimePlatformController.enqueueJob",
  "POST /:id/runtime/queues/:queueId/jobs/:jobId/replay -> RuntimePlatformController.replayDlqJob",
  "GET /:id/runtime/schedules -> RuntimePlatformController.listSchedules",
  "POST /:id/runtime/schedules -> RuntimePlatformController.createSchedule",
  "POST /:id/runtime/schedules/:scheduleId/trigger -> RuntimePlatformController.triggerSchedule",
  "DELETE /:id/runtime/schedules/:scheduleId -> RuntimePlatformController.deleteSchedule",
  "GET /:id/runtime/schedules/:scheduleId/history -> RuntimePlatformController.getScheduleHistory",
  "GET /:id/runtime/topics -> RuntimePlatformController.listTopics",
  "POST /:id/runtime/topics -> RuntimePlatformController.createTopic",
  "POST /:id/runtime/topics/:topicId/publish -> RuntimePlatformController.publishEvent",
  "GET /:id/runtime/subscriptions -> RuntimePlatformController.listSubscriptions",
  "POST /:id/runtime/subscriptions -> RuntimePlatformController.createSubscription",
  "GET /:id/runtime/webhooks/deliveries -> RuntimePlatformController.listWebhookDeliveries",
  "GET /:id/runtime/channels -> RuntimePlatformController.listChannels",
  "POST /:id/runtime/channels -> RuntimePlatformController.createChannel",
  "POST /:id/runtime/channels/:channel/join -> RuntimePlatformController.joinChannel",
  "POST /:id/runtime/channels/:channel/broadcast -> RuntimePlatformController.broadcastMessage",
  "GET /:id/runtime/channels/:channel/presence -> RuntimePlatformController.getChannelPresence",
  "GET /:id/runtime/channels/:channel/messages -> RuntimePlatformController.getChannelMessages",
  "GET /:id/runtime/kv/namespaces -> RuntimePlatformController.listKvNamespaces",
  "POST /:id/runtime/kv/namespaces -> RuntimePlatformController.createKvNamespace",
  "GET /:id/runtime/kv/:namespace/keys -> RuntimePlatformController.listKvKeys",
  "GET /:id/runtime/kv/:namespace/keys/:key -> RuntimePlatformController.getKvKey",
  "PUT /:id/runtime/kv/:namespace/keys/:key -> RuntimePlatformController.setKvKey",
  "DELETE /:id/runtime/kv/:namespace/keys/:key -> RuntimePlatformController.deleteKvKey",
  "POST /:id/runtime/kv/:namespace/invalidate-tag -> RuntimePlatformController.invalidateKvTag",
  "GET /:id/runtime/gateway/routes -> RuntimePlatformController.listGatewayRoutes",
  "POST /:id/runtime/gateway/routes -> RuntimePlatformController.createGatewayRoute",
  "DELETE /:id/runtime/gateway/routes/:routeId -> RuntimePlatformController.deleteGatewayRoute",
  "ALL /:id/runtime/gateway/dispatch/*splat -> RuntimePlatformController.dispatchGatewayRequest",
  "GET /:id/runtime/schemas -> RuntimePlatformController.listSchemas",
  "POST /:id/runtime/schemas -> RuntimePlatformController.registerSchema",
  "GET /:id/quality/tests/suites -> QualityPlatformController.listTestSuites",
  "POST /:id/quality/tests/suites/discover -> QualityPlatformController.discoverTestSuites",
  "POST /:id/quality/tests/run -> QualityPlatformController.runTests",
  "GET /:id/quality/tests/runs -> QualityPlatformController.listTestRuns",
  "GET /:id/quality/api/collections -> QualityPlatformController.listCollections",
  "POST /:id/quality/api/collections -> QualityPlatformController.createCollection",
  "GET /:id/quality/api/collections/:collId/requests -> QualityPlatformController.listRequests",
  "POST /:id/quality/api/collections/:collId/requests -> QualityPlatformController.createRequest",
  "POST /:id/quality/api/requests/:reqId/execute -> QualityPlatformController.executeRequest",
  "POST /:id/quality/api/collections/:collId/run -> QualityPlatformController.runCollection",
  "POST /:id/quality/api/collections/import-openapi -> QualityPlatformController.importOpenApi",
  "GET /:id/quality/devtools/state -> QualityPlatformController.getDevToolsState",
  "POST /:id/quality/devtools/console -> QualityPlatformController.ingestConsoleLog",
  "POST /:id/quality/devtools/network -> QualityPlatformController.ingestNetworkTrace",
  "POST /:id/quality/devtools/dom -> QualityPlatformController.updateDomTree",
  "POST /:id/quality/devtools/vitals -> QualityPlatformController.updateWebVitals",
  "POST /:id/quality/devtools/storage -> QualityPlatformController.updateStorage",
  "POST /:id/quality/devtools/snapshot -> QualityPlatformController.captureSnapshot",
  "GET /:id/quality/devtools/snapshots -> QualityPlatformController.listSnapshots",
  "POST /:id/quality/devtools/analyze-ai -> QualityPlatformController.analyzeErrorWithAi",
  "GET /:id/devops/previews -> DevOpsPlatformController.listPreviewEnvironments",
  "POST /:id/devops/previews -> DevOpsPlatformController.createPreviewEnvironment",
  "GET /:id/devops/previews/:envId -> DevOpsPlatformController.getPreviewEnvironment",
  "POST /:id/devops/previews/:envId/deploy -> DevOpsPlatformController.deployPreviewEnvironment",
  "POST /:id/devops/previews/:envId/extend-ttl -> DevOpsPlatformController.extendPreviewTtl",
  "DELETE /:id/devops/previews/:envId -> DevOpsPlatformController.teardownPreviewEnvironment",
  "POST /:id/devops/previews/:envId/promote -> DevOpsPlatformController.promotePreviewEnvironment",
  "POST /:id/devops/observability/logs -> DevOpsPlatformController.ingestLog",
  "GET /:id/devops/observability/logs -> DevOpsPlatformController.queryLogs",
  "POST /:id/devops/observability/spans -> DevOpsPlatformController.recordSpan",
  "GET /:id/devops/observability/traces/:traceId -> DevOpsPlatformController.getTrace",
  "GET /:id/devops/observability/metrics -> DevOpsPlatformController.getApmMetrics",
  "GET /:id/devops/observability/issues -> DevOpsPlatformController.listIssues",
  "PATCH /:id/devops/observability/issues/:issueId -> DevOpsPlatformController.updateIssueStatus",
  "POST /:id/devops/observability/issues/:issueId/diagnose -> DevOpsPlatformController.diagnoseIssue",
  "POST /:id/devops/security/scan -> DevOpsPlatformController.runSecurityScan",
  "GET /:id/devops/security/latest -> DevOpsPlatformController.getLatestScan",
  "GET /:id/devops/security/scans -> DevOpsPlatformController.listScans",
  "POST /:id/devops/security/remediate -> DevOpsPlatformController.generateAiRemediation",
  "GET /:id/devops/flags -> DevOpsPlatformController.listFlags",
  "POST /:id/devops/flags -> DevOpsPlatformController.createFlag",
  "GET /:id/devops/flags/:key -> DevOpsPlatformController.getFlag",
  "PATCH /:id/devops/flags/:key -> DevOpsPlatformController.updateFlag",
  "POST /:id/devops/flags/:key/toggle -> DevOpsPlatformController.toggleFlag",
  "DELETE /:id/devops/flags/:key -> DevOpsPlatformController.deleteFlag",
  "POST /:id/devops/flags/evaluate -> DevOpsPlatformController.evaluateFlags",
  "GET /:id/devops/config -> DevOpsPlatformController.listConfigs",
  "PUT /:id/devops/config -> DevOpsPlatformController.setConfig",
  "DELETE /:id/devops/config/:key -> DevOpsPlatformController.deleteConfig",
  "POST /:id/intelligence/optimization/audit -> IntelligencePlatformController.runOptimizationAudit",
  "GET /:id/intelligence/optimization/latest -> IntelligencePlatformController.getLatestAudit",
  "GET /:id/intelligence/optimization/audits -> IntelligencePlatformController.listAudits",
  "POST /:id/intelligence/optimization/patch/:recId -> IntelligencePlatformController.generateAiOptimizationPatch",
  "POST /:id/intelligence/checkpoints -> IntelligencePlatformController.createCheckpoint",
  "GET /:id/intelligence/checkpoints -> IntelligencePlatformController.listCheckpoints",
  "GET /:id/intelligence/checkpoints/:checkpointId -> IntelligencePlatformController.getCheckpoint",
  "GET /:id/intelligence/checkpoints/:checkpointId/diff -> IntelligencePlatformController.diffCheckpointWithWorkspace",
  "POST /:id/intelligence/checkpoints/:checkpointId/rollback -> IntelligencePlatformController.rollbackToCheckpoint",
  "POST /:id/intelligence/checkpoints/:checkpointId/restore-file -> IntelligencePlatformController.restoreSingleFile",
  "GET /:id/intelligence/checkpoints/:checkpointId/export -> IntelligencePlatformController.exportDisasterRecoveryBundle",
  "POST /:id/intelligence/checkpoints/import -> IntelligencePlatformController.importDisasterRecoveryBundle",
  "GET /:id/intelligence/architecture/graph -> IntelligencePlatformController.getArchitectureGraph",
  "GET /:id/collaboration/sessions -> DeveloperPlatformController.getActiveSessions",
  "POST /:id/collaboration/heartbeat -> DeveloperPlatformController.heartbeatSession",
  "DELETE /:id/collaboration/sessions/:sessionId -> DeveloperPlatformController.closeSession",
  "POST /:id/collaboration/conflict/detect -> DeveloperPlatformController.detectFileConflict",
  "POST /:id/collaboration/conflict/resolve -> DeveloperPlatformController.resolveFileConflict",
  "GET /:id/collaboration/comments -> DeveloperPlatformController.listComments",
  "POST /:id/collaboration/comments -> DeveloperPlatformController.createComment",
  "POST /:id/collaboration/comments/:commentId/reply -> DeveloperPlatformController.replyComment",
  "POST /:id/collaboration/comments/:commentId/resolve -> DeveloperPlatformController.resolveComment",
  "GET /:id/collaboration/reviews -> DeveloperPlatformController.listReviews",
  "POST /:id/collaboration/reviews -> DeveloperPlatformController.createReview",
  "POST /:id/collaboration/reviews/:reviewId/decision -> DeveloperPlatformController.submitReviewDecision",
  "POST /:id/collaboration/preview-sessions -> DeveloperPlatformController.createPreviewSession",
  "GET /:id/collaboration/preview-sessions/:sessionId -> DeveloperPlatformController.getPreviewSession",
  "GET /:id/collaboration/timeline -> DeveloperPlatformController.getActivityTimeline",
  "GET /:id/extensions -> DeveloperPlatformController.listPlugins",
  "POST /:id/extensions/install -> DeveloperPlatformController.installPlugin",
  "POST /:id/extensions/:pluginId/enable -> DeveloperPlatformController.enablePlugin",
  "POST /:id/extensions/:pluginId/disable -> DeveloperPlatformController.disablePlugin",
  "DELETE /:id/extensions/:pluginId -> DeveloperPlatformController.uninstallPlugin",
  "POST /:id/extensions/hooks/execute -> DeveloperPlatformController.executePluginHook",
  "POST /:id/extensions/tools/execute -> DeveloperPlatformController.executePluginAiTool",
  "POST /:id/import/start -> DeveloperPlatformController.startImport",
  "GET /:id/import/jobs/:jobId -> DeveloperPlatformController.getImportStatus",
  "POST /:id/import/jobs/:jobId/commit -> DeveloperPlatformController.commitImport",
  "GET /:id/monorepo/graph -> DeveloperPlatformController.discoverMonorepo",
  "POST /:id/monorepo/affected -> DeveloperPlatformController.getAffectedPackages",
  "POST /:id/monorepo/deploy-plan -> DeveloperPlatformController.generateCoordinatedDeployPlan",
  "GET /:id/containers/dockerfile -> DeveloperPlatformController.getDockerfile",
  "POST /:id/containers/dockerfile/generate -> DeveloperPlatformController.generateDockerfile",
  "POST /:id/containers/build -> DeveloperPlatformController.buildContainer",
  "POST /:id/containers/run -> DeveloperPlatformController.runContainer",
  "GET /:id/containers -> DeveloperPlatformController.listContainers",
  "DELETE /:id/containers/:runId -> DeveloperPlatformController.stopContainer",
  "GET /:id/containers/compose -> DeveloperPlatformController.getCompose",
  "POST /:id/infra/kubernetes/generate -> DeveloperPlatformController.generateKubernetes",
  "POST /:id/infra/terraform/generate -> DeveloperPlatformController.generateTerraform",
  "GET /:id/infra/validate -> DeveloperPlatformController.validateInfrastructure",
  "GET /:id/intelligence/symbols -> CodeIntelligenceController.getSymbols",
  "GET /:id/intelligence/definition -> CodeIntelligenceController.getDefinition",
  "GET /:id/intelligence/references -> CodeIntelligenceController.getReferences",
  "GET /:id/intelligence/files/:fileId -> CodeIntelligenceController.getFileDependencies",
  "POST /:id/intelligence/index -> CodeIntelligenceController.indexProject",
  "GET /:id/intelligence/status -> CodeIntelligenceController.getStatus",
  "GET /:id/knowledge-graph/query -> KnowledgeGraphController.queryGraph",
  "POST /:id/knowledge-graph/query -> KnowledgeGraphController.queryGraph",
  "POST /:id/knowledge-graph/build -> KnowledgeGraphController.buildGraph",
  "GET /:id/knowledge-graph -> KnowledgeGraphController.getGraph",
  "GET /:id/design-system/tokens -> DesignSystemPlatformController.getTokens",
  "POST /:id/design-system/tokens -> DesignSystemPlatformController.setToken",
  "DELETE /:id/design-system/tokens/:category/:name -> DesignSystemPlatformController.deleteToken",
  "GET /:id/design-system/tokens/compile -> DesignSystemPlatformController.compileTokens",
  "POST /:id/design-system/tokens/apply -> DesignSystemPlatformController.applyTokens",
  "POST /:id/components/discover -> DesignSystemPlatformController.discoverComponents",
  "GET /:id/components -> DesignSystemPlatformController.listComponents",
  "GET /:id/components/:componentId -> DesignSystemPlatformController.getComponent",
  "GET /:id/components/:componentId/export -> DesignSystemPlatformController.exportComponent",
  "GET /templates -> DesignSystemPlatformController.listTemplates",
  "POST /:id/templates/:templateId/scaffold -> DesignSystemPlatformController.scaffoldTemplate",
];

/** Route count per method, excluding the USE line. */
const EXPECTED_METHOD_COUNTS = { GET: 155, POST: 215, PATCH: 12, DELETE: 25, PUT: 5, ALL: 1 };
const EXPECTED_ROUTE_COUNT = 413;

/**
 * Literal routes made unreachable by an earlier parameterised route on the same method.
 * Current behaviour, recorded rather than endorsed: GET /templates is served by getProjectHandler.
 */
const EXPECTED_SHADOWED = ["GET /templates <= GET /:id"];

/** app.ts: every mount under the /api/projects and /api/v1/projects prefixes, in order. */
const EXPECTED_PROJECT_PREFIX_MOUNTS = [
  "USE /api/v1/projects -> projectRoutes",
  "USE /api/projects -> projectRoutes",
  "USE /api/v1/projects/:projectId/storage -> storageRoutes",
  "USE /api/projects/:projectId/storage -> storageRoutes",
  "USE /api/v1/projects/:projectId/database -> databaseRoutes",
  "USE /api/projects/:projectId/database -> databaseRoutes",
  "USE /api/v1/projects/:projectId/studio -> studioRoutes",
  "USE /api/projects/:projectId/studio -> studioRoutes",
  "USE /api/v1/projects/:projectId/sdk -> sdkRoutes",
  "USE /api/projects/:projectId/sdk -> sdkRoutes",
];

const parse = (path: string) => parseAst(readFileSync(path, "utf8"), { lang: "ts", sourceType: "module" }, path) as any;
const routesAst = parse(ROUTES_PATH);
const appAst = parse(APP_PATH);

function handlerLabel(arg: any, loopVar?: string, loopValue?: string): string {
  if (arg.type === "Identifier") return arg.name;
  if (arg.type === "MemberExpression" && arg.object.type === "Identifier" && !arg.computed) {
    return `${arg.object.name}.${arg.property.name}`;
  }
  if (
    arg.type === "CallExpression" && arg.callee.type === "Identifier" &&
    arg.arguments.length === 1 && arg.arguments[0].type === "Identifier" && arg.arguments[0].name === loopVar
  ) {
    return `${arg.callee.name}(${JSON.stringify(loopValue)})`;
  }
  return `UNRECOGNIZED<${arg.type}>`;
}

function isRouterCall(statement: any): boolean {
  const e = statement?.expression;
  return statement?.type === "ExpressionStatement" && e?.type === "CallExpression" &&
    e.callee.type === "MemberExpression" && e.callee.object.type === "Identifier" && e.callee.object.name === "router";
}

function describeRouterCall(call: any, path: string, loopVar?: string, loopValue?: string): string {
  const method = call.callee.property.name.toUpperCase();
  const handlers = call.arguments.slice(1).map((a: any) => handlerLabel(a, loopVar, loopValue)).join(", ");
  return `${method} ${path} -> ${handlers}`;
}

/** Router calls in registration order. Anything the extractor cannot read shows up as UNRECOGNIZED. */
function extractRouterCalls(): string[] {
  const out: string[] = [];
  for (const s of routesAst.body) {
    if (isRouterCall(s)) {
      const call = s.expression;
      if (call.callee.property.name === "use") {
        out.push(`USE ${call.arguments.map((a: any) => handlerLabel(a)).join(", ")}`);
      } else {
        const p = call.arguments[0];
        out.push(describeRouterCall(call, p.type === "Literal" ? p.value : `UNRECOGNIZED<${p.type}>`));
      }
    } else if (s.type === "ForOfStatement") {
      const loopVar = s.left.declarations?.[0]?.id?.name;
      const iterable = s.right.type === "TSAsExpression" ? s.right.expression : s.right;
      const body = s.body.type === "BlockStatement" ? s.body.body : [s.body];
      if (iterable.type !== "ArrayExpression" || !body.every(isRouterCall)) {
        out.push(`UNRECOGNIZED<ForOfStatement@${s.start}>`);
        continue;
      }
      for (const el of iterable.elements) {
        for (const st of body) {
          const call = st.expression;
          const t = call.arguments[0];
          const path = t.type === "TemplateLiteral"
            ? t.quasis.map((q: any, i: number) => q.value.cooked + (i < t.expressions.length ? el.value : "")).join("")
            : `UNRECOGNIZED<${t.type}>`;
          out.push(describeRouterCall(call, path, loopVar, el.value));
        }
      }
    } else if (s.type === "ExpressionStatement") {
      out.push(`UNRECOGNIZED<ExpressionStatement@${s.start}>`);
    } else if (!["ImportDeclaration", "VariableDeclaration", "ExportDefaultDeclaration"].includes(s.type)) {
      out.push(`UNRECOGNIZED<${s.type}@${s.start}>`);
    }
  }
  return out;
}

/** Names bound by import declarations in project.routes.ts. */
function importedNames(): Set<string> {
  const names = new Set<string>();
  for (const s of routesAst.body) {
    if (s.type === "ImportDeclaration") s.specifiers.forEach((sp: any) => names.add(sp.local.name));
  }
  return names;
}

function walk(node: any, visit: (n: any) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, visit)); return; }
  if (typeof node.type === "string") visit(node);
  for (const key of Object.keys(node)) if (key !== "parent") walk(node[key], visit);
}

/** app.ts `app.use(...)` calls whose path is, or includes, an /api[/v1]/projects prefix. */
function extractProjectPrefixMounts(): string[] {
  const out: string[] = [];
  const prefix = /^\/api(\/v1)?\/projects(\/|$)/;
  walk(appAst, (n) => {
    if (n.type !== "CallExpression" || n.callee.type !== "MemberExpression") return;
    if (n.callee.object.name !== "app" || n.callee.property.name !== "use") return;
    const first = n.arguments[0];
    const paths: string[] = first?.type === "Literal" ? [first.value]
      : first?.type === "ArrayExpression" ? first.elements.map((e: any) => e.value) : [];
    if (!paths.some((p) => typeof p === "string" && prefix.test(p))) return;
    const rest = n.arguments.slice(1).map((a: any) => (a.type === "Identifier" ? a.name : `UNRECOGNIZED<${a.type}>`));
    out.push(`USE ${paths.join(",")} -> ${rest.join(", ")}`);
  });
  return out;
}

/** Literal routes that an earlier route with a parameter (or wildcard) in the same position captures. */
function findShadowed(lines: string[]): string[] {
  const routes = lines.filter((l) => !l.startsWith("USE ")).map((l) => {
    const [method, path] = l.split(" -> ")[0].split(" ");
    return { method, path };
  });
  const captures = (earlier: string, later: string) => {
    const a = earlier.split("/"), b = later.split("/");
    for (let i = 0; i < a.length; i++) {
      if (a[i].startsWith("*")) return true;
      if (i >= b.length) return false;
      if (!a[i].startsWith(":") && a[i] !== b[i]) return false;
    }
    return a.length === b.length;
  };
  const literalUnderParam = (earlier: string, later: string) => {
    const b = later.split("/");
    return earlier.split("/").some((seg, k) => seg.startsWith(":") && b[k] !== undefined && !b[k].startsWith(":"));
  };
  const out: string[] = [];
  routes.forEach((r, i) => {
    const hit = routes.slice(0, i).find((e) =>
      (e.method === r.method || e.method === "ALL") && e.path !== r.path &&
      captures(e.path, r.path) && literalUnderParam(e.path, r.path));
    if (hit) out.push(`${r.method} ${r.path} <= ${hit.method} ${hit.path}`);
  });
  return out;
}

describe("project.routes.ts route integrity", () => {
  const actual = extractRouterCalls();
  const routeLines = actual.filter((l) => !l.startsWith("USE "));

  it("every router call is recognised by the extractor", () => {
    expect(actual.filter((l) => l.includes("UNRECOGNIZED"))).toEqual([]);
  });

  it("router-level requireAuth is the first and only middleware, registered before every route", () => {
    expect(actual.filter((l) => l.startsWith("USE "))).toEqual(["USE requireAuth"]);
    expect(actual[0]).toBe("USE requireAuth");
  });

  it("matches the golden route table exactly, including registration order", () => {
    const actualSet = new Set(actual);
    const expectedSet = new Set(EXPECTED_ROUTER_CALLS);
    expect.soft(EXPECTED_ROUTER_CALLS.filter((l) => !actualSet.has(l)), "missing router calls").toEqual([]);
    expect.soft(actual.filter((l) => !expectedSet.has(l)), "unexpected router calls").toEqual([]);
    expect(actual).toEqual(EXPECTED_ROUTER_CALLS);
  });

  it("route count and per-method counts match the source-derived snapshot", () => {
    expect(routeLines).toHaveLength(EXPECTED_ROUTE_COUNT);
    const counts: Record<string, number> = {};
    for (const l of routeLines) counts[l.split(" ")[0]] = (counts[l.split(" ")[0]] ?? 0) + 1;
    expect(counts).toEqual(EXPECTED_METHOD_COUNTS);
  });

  it("has no per-route middleware and no duplicate method+path registrations", () => {
    expect(routeLines.filter((l) => l.split(" -> ")[1].includes(","))).toEqual([]);
    const keys = routeLines.map((l) => l.split(" -> ")[0]);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it("every handler references a name imported into the routes file", () => {
    const imported = importedNames();
    const unresolved = routeLines
      .map((l) => l.split(" -> ")[1])
      .filter((h) => !imported.has(h.split(/[.(]/)[0]));
    expect(unresolved).toEqual([]);
  });

  it("shadowed literal routes match the recorded set", () => {
    expect(findShadowed(actual)).toEqual(EXPECTED_SHADOWED);
  });

  it("exports the router as the default export", () => {
    const def = routesAst.body.find((s: any) => s.type === "ExportDefaultDeclaration");
    expect(def?.declaration?.type).toBe("Identifier");
    expect(def?.declaration?.name).toBe("router");
  });
});

describe("app.ts project route mounts", () => {
  const mounts = extractProjectPrefixMounts();

  it("mounts under /api/projects and /api/v1/projects match the golden order", () => {
    expect(mounts).toEqual(EXPECTED_PROJECT_PREFIX_MOUNTS);
  });

  it("projectRoutes is mounted on both prefixes with no mount-level middleware", () => {
    expect(mounts.filter((m) => m.endsWith("-> projectRoutes"))).toEqual([
      "USE /api/v1/projects -> projectRoutes",
      "USE /api/projects -> projectRoutes",
    ]);
  });

  it("projectRoutes is mounted before the nested project routers, so its requireAuth runs first for them", () => {
    const firstNested = mounts.findIndex((m) => /\/projects\/:projectId\//.test(m));
    const lastProjectRoutes = mounts.map((m) => m.endsWith("-> projectRoutes")).lastIndexOf(true);
    expect(lastProjectRoutes).toBeGreaterThanOrEqual(0);
    expect(lastProjectRoutes).toBeLessThan(firstNested);
  });

  it("projectRoutes is imported from ./routes/project.routes.js", () => {
    const imp = appAst.body.find((s: any) =>
      s.type === "ImportDeclaration" && s.specifiers.some((sp: any) => sp.local.name === "projectRoutes"));
    expect(imp?.source.value).toBe("./routes/project.routes.js");
    expect(imp?.specifiers[0].type).toBe("ImportDefaultSpecifier");
  });
});
