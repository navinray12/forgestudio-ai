/**
 * Regression guard: public export surface of project.controller.ts.
 *
 * The controller imports Prisma and several services at module load, so this test never imports
 * it. It parses the source with a TypeScript-aware parser and compares the exports against a
 * golden list captured at commit 703dffc (167 exports: 166 Express handlers + the
 * migrationStepHandler factory). Update the golden list only for an intentional API change.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseAst } from "rolldown/parseAst";

const CONTROLLER_PATH = fileURLToPath(new URL("../../controllers/project.controller.ts", import.meta.url));

/** Async `(req: Request, res: Response, next: NextFunction)` handlers, in source order. */
const EXPECTED_HANDLERS = [
  "createProjectHandler",
  "getProjectHandler",
  "getProjectByWebsiteHandler",
  "listProjectsHandler",
  "updateProjectHandler",
  "transitionLifecycleHandler",
  "cloneProjectHandler",
  "getFileTreeHandler",
  "readFileHandler",
  "writeFileHandler",
  "deleteFileHandler",
  "moveFileHandler",
  "getFileRevisionsHandler",
  "createSnapshotHandler",
  "listSnapshotsHandler",
  "getManifestHandler",
  "updateManifestHandler",
  "compileProjectHandler",
  "syncVisualToCodeHandler",
  "planVisualToCodeHandler",
  "getWorkspaceCheckpointHandler",
  "listWorkspaceCheckpointsHandler",
  "getRoundTripCompatibilityHandler",
  "classifyConstructHandler",
  "createPageLifecycleHandler",
  "movePageLifecycleHandler",
  "retirePageLifecycleHandler",
  "restorePageLifecycleHandler",
  "runReferenceBenchmarkHandler",
  "planSymbolsHandler",
  "evaluateRegenerationHandler",
  "createCleanupPlanHandler",
  "applyCleanupPlanHandler",
  "buildDomainModelSpecHandler",
  "validateDataMutationHandler",
  "introspectExternalDatabaseHandler",
  "generateContractFirstApiHandler",
  "bootstrapApplicationAuthHandler",
  "evaluateUnifiedAuthorizationHandler",
  "getDatabaseStudioViewHandler",
  "resolveEnvironmentBindingHandler",
  "listEnvironmentBindingsHandler",
  "registerEnvironmentBindingHandler",
  "retireEnvironmentBindingHandler",
  "resolveTargetPoolHandler",
  "executeUnifiedMigrationHandler",
  "planMigrationHandler",
  "adoptMigrationBaselineHandler",
  "runReleaseQualificationHandler",
  "getReleaseQualificationRecordHandler",
  "validateGeneratedPackageHandler",
  "verifyControlPlaneDiagnosticsHandler",
  "syncCodeToVisualHandler",
  "exportProjectZipHandler",
  "generateReactProjectHandler",
  "generateNextJsProjectHandler",
  "getGenerationPlanHandler",
  "regenerateScopeHandler",
  "listPagesHandler",
  "createPageHandler",
  "updatePageHandler",
  "deletePageHandler",
  "getSourcePreviewHandler",
  "getWorkspaceStateHandler",
  "saveWorkspaceStateHandler",
  "getDependenciesHandler",
  "installDependencyHandler",
  "removeDependencyHandler",
  "explainDependencyAiHandler",
  "getRuntimeStatusHandler",
  "executeSandboxHandler",
  "stopSandboxProcessHandler",
  "triggerBuildHandler",
  "listBuildsHandler",
  "createPreviewSessionHandler",
  "updatePreviewViewportHandler",
  "logPreviewConsoleHandler",
  "createTerminalHandler",
  "executeTerminalHandler",
  "getTerminalTasksHandler",
  "startDebugSessionHandler",
  "setBreakpointHandler",
  "removeBreakpointHandler",
  "stepDebugHandler",
  "askAiDebugHandler",
  "detectRuntimeHandler",
  "createDeploymentHandler",
  "promoteDeploymentHandler",
  "rollbackDeploymentHandler",
  "listDeploymentsHandler",
  "getDeploymentHandler",
  "executeDeploymentHealthCheckHandler",
  "createPipelineRunHandler",
  "listPipelinesHandler",
  "getPipelineHandler",
  "approvePipelineGateHandler",
  "rerunPipelineHandler",
  "cancelPipelineHandler",
  "checkDomainAvailabilityHandler",
  "connectDomainHandler",
  "listDomainsHandler",
  "configureDnsHandler",
  "verifyDomainOwnershipHandler",
  "bindDomainDeploymentHandler",
  "detachDomainHandler",
  "initGitHandler",
  "getGitStatusHandler",
  "stageGitFilesHandler",
  "unstageGitFilesHandler",
  "commitGitHandler",
  "listGitBranchesHandler",
  "createGitBranchHandler",
  "switchGitBranchHandler",
  "deleteGitBranchHandler",
  "getGitDiffHandler",
  "getGitHistoryHandler",
  "mergeGitBranchHandler",
  "resolveGitConflictHandler",
  "abortGitMergeHandler",
  "rebaseGitHandler",
  "listGitStashesHandler",
  "createGitStashHandler",
  "applyGitStashHandler",
  "dropGitStashHandler",
  "cherryPickGitHandler",
  "listGitTagsHandler",
  "createGitTagHandler",
  "deleteGitTagHandler",
  "getGitGraphHandler",
  "connectGithubHandler",
  "importGithubHandler",
  "createGithubRepoHandler",
  "fetchGithubRemoteHandler",
  "pullGithubRemoteHandler",
  "pushGithubRemoteHandler",
  "syncGithubBranchHandler",
  "createGithubPrHandler",
  "listGithubPrsHandler",
  "getGithubPrDetailsHandler",
  "updateGithubPrHandler",
  "getGithubChecksHandler",
  "githubWebhookHandler",
  "executeCliHandler",
  "aiGatewayCompleteHandler",
  "aiGatewayModelsHandler",
  "aiGatewayHealthHandler",
  "aiGatewayByokHandler",
  "aiGatewayUsageHandler",
  "listToolsHandler",
  "executeToolHandler",
  "resolveToolApprovalHandler",
  "createCodingSessionHandler",
  "generateCodingPlanHandler",
  "executeCodingPlanHandler",
  "aiCreatorPlanHandler",
  "aiCreatorGenerateHandler",
  "aiCreatorRegenerateHandler",
  "aiWebsiteAuditHandler",
  "aiWebsiteFixHandler",
  "listMcpServersHandler",
  "registerMcpServerHandler",
  "mcpJsonRpcHandler",
  "mcpInvokeToolHandler",
  "mcpScaffoldHandler",
  "commitProjectApplicationSpecHandler",
  "getProjectApplicationSpecHandler",
] as const;

/** Non-async factory that returns an async Express handler for one migration step. */
const FACTORY_NAME = "migrationStepHandler";
const FACTORY_STEPS = ["preflight", "rehearse", "approve", "execute", "reconcile", "retry", "cancel"];

const EXPECTED_EXPORT_COUNT = 167;
const HANDLER_PARAMS = [
  ["req", "Request"],
  ["res", "Response"],
  ["next", "NextFunction"],
];

const ast = parseAst(readFileSync(CONTROLLER_PATH, "utf8"), { lang: "ts", sourceType: "module" }, "project.controller.ts");

/** Every exported name, whatever the export form, so additions of any kind are caught. */
function collectExportNames(): string[] {
  const names: string[] = [];
  for (const node of ast.body as any[]) {
    if (node.type === "ExportDefaultDeclaration") names.push("default");
    else if (node.type === "ExportAllDeclaration") names.push(`* from ${node.source.value}`);
    else if (node.type === "ExportNamedDeclaration") {
      const decl = node.declaration;
      if (decl?.type === "VariableDeclaration") decl.declarations.forEach((d: any) => names.push(d.id.name));
      else if (decl?.id) names.push(decl.id.name);
      for (const spec of node.specifiers ?? []) names.push(spec.exported.name ?? spec.exported.value);
    }
  }
  return names;
}

/** Exported function declarations keyed by name. */
function exportedFunctions(): Map<string, any> {
  const fns = new Map<string, any>();
  for (const node of ast.body as any[]) {
    if (node.type === "ExportNamedDeclaration" && node.declaration?.type === "FunctionDeclaration") {
      fns.set(node.declaration.id.name, node.declaration);
    }
  }
  return fns;
}

function paramShape(params: any[]): string[][] {
  return params.map((p) => [p.name, p.typeAnnotation?.typeAnnotation?.typeName?.name]);
}

describe("project.controller.ts public exports", () => {
  const actual = collectExportNames();
  const expected = [...EXPECTED_HANDLERS, FACTORY_NAME];

  it("golden list is internally consistent", () => {
    expect(expected).toHaveLength(EXPECTED_EXPORT_COUNT);
    expect(new Set(expected).size).toBe(EXPECTED_EXPORT_COUNT);
  });

  it("exports exactly the expected names (none missing, none added, no duplicates)", () => {
    const actualSet = new Set(actual);
    const expectedSet = new Set<string>(expected);
    expect(expected.filter((n) => !actualSet.has(n)), "missing exports").toEqual([]);
    expect(actual.filter((n) => !expectedSet.has(n)), "unexpected exports").toEqual([]);
    expect(actual).toHaveLength(EXPECTED_EXPORT_COUNT);
  });

  it("every handler is an async function declaration taking (req: Request, res: Response, next: NextFunction)", () => {
    const fns = exportedFunctions();
    const wrong = EXPECTED_HANDLERS.filter((name) => {
      const fn = fns.get(name);
      return !fn || fn.async !== true || fn.generator || JSON.stringify(paramShape(fn.params)) !== JSON.stringify(HANDLER_PARAMS);
    });
    expect(wrong, "handlers with wrong kind or signature").toEqual([]);
  });

  it("migrationStepHandler is a sync factory over the seven migration steps returning an async handler", () => {
    const fn = exportedFunctions().get(FACTORY_NAME);
    expect(fn, "factory must be an exported function declaration").toBeDefined();
    expect(fn.async).toBe(false);
    expect(fn.generator).toBe(false);

    expect(fn.params).toHaveLength(1);
    expect(fn.params[0].name).toBe("step");
    const stepType = fn.params[0].typeAnnotation?.typeAnnotation;
    expect(stepType?.type).toBe("TSUnionType");
    expect(stepType.types.map((t: any) => t.literal?.value)).toEqual(FACTORY_STEPS);

    const returned = fn.body.body.filter((s: any) => s.type === "ReturnStatement");
    expect(returned).toHaveLength(1);
    const handler = returned[0].argument;
    expect(handler?.type).toBe("ArrowFunctionExpression");
    expect(handler.async).toBe(true);
    expect(paramShape(handler.params)).toEqual(HANDLER_PARAMS);
  });
});
