/**
 * Regression guard: project-level authorization of the MCP handlers in project.controller.ts.
 *
 *  F-34  mcpJsonRpcHandler     (POST /:id/mcp/rpc)      must authorize before executing JSON-RPC.
 *  F-51  listMcpServersHandler (GET  /:id/mcp/servers)  must authorize before listing servers.
 *
 * The real getForgeProjectById from forgeProject.service.ts runs against a mocked Prisma client, so
 * these tests exercise the real ownership/membership check. The MCP services are mocked; they must
 * never be reached when authorization fails.
 *
 * Isolation: the controller and forgeProject.service.ts are parsed first, and each of their static and
 * dynamic imports must resolve to a vi.mock'd module or to an explicitly side-effect-free one. If not,
 * nothing is imported and every test FAILS.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAst } from "rolldown/parseAst";
import { AppError } from "../../utils/app-error.js";

const TEST_FILE = fileURLToPath(import.meta.url);
const SRC = resolve(dirname(TEST_FILE), "../..");
const CONTROLLER_FILE = resolve(SRC, "controllers/project.controller.ts");
const PROJECT_SERVICE_FILE = resolve(SRC, "services/project/forgeProject.service.ts");

const h = vi.hoisted(() => {
  const stubs = (...names: string[]) => Object.fromEntries(names.map((n) => [n, vi.fn()]));
  return {
    stubs,
    prisma: {
      website: { findUnique: vi.fn() },
      forgeProject: { findUnique: vi.fn(), update: vi.fn() },
      workspaceMember: { findUnique: vi.fn() },
    },
    getForgeProjectById: vi.fn(),
    listServers: vi.fn(),
    handleJsonRpc: vi.fn(),
  };
});

// Static imports of project.controller.ts and forgeProject.service.ts.
vi.mock("express", () => ({}));
vi.mock("../../config/prisma.js", () => ({ prisma: h.prisma, pgPool: {} }));
vi.mock("../../services/project/forgeProject.service.js", () => ({
  ...h.stubs("createForgeProject", "getOrCreateProjectForWebsite", "updateForgeProject",
    "transitionProjectLifecycle", "listForgeProjects", "cloneForgeProject", "syncProjectFromWebsite"),
  getForgeProjectById: h.getForgeProjectById,
}));
vi.mock("../../services/project/forgeFilesystem.service.js", () => h.stubs("writeFile", "readFile", "deleteFile",
  "moveOrRenameFile", "getProjectFileTree", "getFileRevisions", "createProjectSnapshot", "listProjectSnapshots", "listFiles"));
vi.mock("../../services/codeGenerator.service.js", () => h.stubs("buildZipFromFiles"));
vi.mock("../../services/project/forgeManifest.service.js", () => h.stubs("getProjectManifest", "updateProjectManifest"));
vi.mock("../../services/compiler/unifiedCompiler.service.js", () => h.stubs("compileAndSyncProject"));
vi.mock("../../services/compiler/visualCodeSync.service.js", () => h.stubs("syncVisualElementToSource", "syncSourceToVisualWebsite"));
vi.mock("../../services/generator/index.js", () => h.stubs("createGenerationPlan", "executeGeneration", "regenerateScope"));
vi.mock("../../services/workspace/workspaceCheckpoints.service.js", () => h.stubs("recordCheckpoint",
  "findCommittedChangeSet", "getCheckpointState", "listCheckpointsAfter", "kindForSyncStatus", "updateProjectMetadataAtomic"));
vi.mock("../../services/compiler/pageRegistry.js", () => h.stubs("buildSyncBaseline", "buildPageRegistry",
  "parseEditorDocument", "toProjectFramework", "createPageLifecycle", "renameOrMovePage", "retirePageReversible", "restorePageDraft"));
vi.mock("../../services/project/projectPages.service.js", () => h.stubs("listProjectPages", "createProjectPage",
  "updateProjectPage", "deleteProjectPage", "PageImportError"));
vi.mock("../../services/preview/sourcePreview.service.js", () => h.stubs("buildSourcePreview"));
vi.mock("../../services/compiler/roundTripContract.service.js", () => h.stubs("RoundTripContractService"));
vi.mock("../../services/benchmark/referenceProjectBenchmark.service.js", () => h.stubs("ReferenceProjectBenchmarkService"));
vi.mock("../../services/generator/dynamicSourcePlanner.service.js", () => h.stubs("DynamicSourcePlannerService"));
vi.mock("../../services/generator/safeCleanupEngine.service.js", () => h.stubs("SafeCleanupEngineService"));
vi.mock("../../services/generator/dataModelGenerator.service.js", () => h.stubs("DataModelGeneratorService"));
vi.mock("../../services/generator/externalDatabaseIntrospection.service.js", () => h.stubs("ExternalDatabaseIntrospectionService"));
vi.mock("../../services/api/contractFirstApiGenerator.service.js", () => ({ contractFirstApiGenerator: {} }));
vi.mock("../../services/auth/applicationAuth.service.js", () => ({ applicationAuth: {} }));
vi.mock("../../services/auth/unifiedExecutionAuthorization.service.js", () => ({ unifiedExecutionAuthorization: {} }));
vi.mock("../../services/database/databaseStudioViews.service.js", () => ({ databaseStudioViews: {} }));
vi.mock("../../services/environment/environmentBinding.service.js", () => ({
  environmentBindingService: {}, ...h.stubs("requireEnvironmentClass", "toPublicBinding"),
}));
vi.mock("../../services/audit.service.js", () => h.stubs("recordAuditLog"));
vi.mock("../../services/cms/contentLifecycle.service.js", () => ({ FRESH_AUTH_WINDOW_MS: 300_000 }));
vi.mock("../../services/environment/targetResolution.service.js", () => ({ targetResolutionService: {} }));
vi.mock("../../services/migration/unifiedMigrationAuthority.service.js", () => ({ unifiedMigrationAuthority: {} }));
vi.mock("../../services/qualification/applicationReleaseQualification.service.js", () => ({ applicationReleaseQualificationService: {} }));
vi.mock("../../services/architecture/controlPlaneReconciliation.service.js", () => ({ controlPlaneReconciliationService: {} }));

// Dynamic `await import(...)` targets of the controller and of forgeProject.service.ts.
vi.mock("../../services/compiler/canvasEditPlanner.js", () => ({}));
vi.mock("../../services/dependency/forgeDependency.service.js", () => ({}));
vi.mock("../../services/runtime/forgeSandbox.service.js", () => ({}));
vi.mock("../../services/build/forgeBuild.service.js", () => ({}));
vi.mock("../../services/preview/forgePreview.service.js", () => ({}));
vi.mock("../../services/terminal/forgeTerminal.service.js", () => ({}));
vi.mock("../../services/debug/forgeDebug.service.js", () => ({}));
vi.mock("../../services/hosting/forgeHosting.service.js", () => ({}));
vi.mock("../../services/hosting/forgeCicd.service.js", () => ({}));
vi.mock("../../services/hosting/forgeDomain.service.js", () => ({}));
vi.mock("../../services/git/forgeGit.service.js", () => ({}));
vi.mock("../../services/git/forgeGithub.service.js", () => ({}));
vi.mock("../../services/cli/forgeCli.service.js", () => ({}));
vi.mock("../../modules/ai/gateway/aiGateway.service.js", () => ({}));
vi.mock("../../modules/ai/tools/toolExecution.service.js", () => ({}));
vi.mock("../../modules/ai/coding/codingAgent.service.js", () => ({}));
vi.mock("../../modules/ai/creator/aiCreator.service.js", () => ({}));
vi.mock("../../modules/ai/website/websiteAgent.service.js", () => ({}));
vi.mock("../../modules/ai/mcp/mcpRegistry.service.js", () => ({ mcpRegistryService: { listServers: h.listServers } }));
vi.mock("../../modules/ai/mcp/mcpServer.service.js", () => ({ forgeMcpServerService: { handleJsonRpc: h.handleJsonRpc } }));
vi.mock("../../modules/ai/mcp/mcpClient.service.js", () => ({}));
vi.mock("../../services/authoritative/applicationSpec.service.js", () => ({}));

/** Modules allowed to load for real because they have no imports and no module-level side effects. */
const SIDE_EFFECT_FREE = new Set([resolve(SRC, "utils/app-error.js"), "node:crypto"]);

/** Modules this file loads for real; each one's imports are checked before anything is imported. */
const REAL_MODULES = [CONTROLLER_FILE, PROJECT_SERVICE_FILE];

const toKey = (from: string, specifier: string) => (specifier.startsWith(".") ? resolve(dirname(from), specifier) : specifier);

function viMockedModules(): Set<string> {
  const self = readFileSync(TEST_FILE, "utf8");
  return new Set([...self.matchAll(/^vi\.mock\("([^"]+)"/gm)].map((m) => toKey(TEST_FILE, m[1])));
}

function importsOf(file: string): { specifiers: string[]; nonLiteralDynamic: number } {
  const ast = parseAst(readFileSync(file, "utf8"), { lang: "ts", sourceType: "module" }, file) as any;
  const specifiers: string[] = [];
  let nonLiteralDynamic = 0;
  const walk = (node: any): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.type === "ImportDeclaration" || node.type === "ExportAllDeclaration" ||
      (node.type === "ExportNamedDeclaration" && node.source)) specifiers.push(node.source.value);
    if (node.type === "ImportExpression") {
      if (node.source.type === "Literal" && typeof node.source.value === "string") specifiers.push(node.source.value);
      else nonLiteralDynamic++;
    }
    for (const key of Object.keys(node)) walk(node[key]);
  };
  walk(ast);
  return { specifiers, nonLiteralDynamic };
}

function isolationProblems(): string[] {
  const mocked = viMockedModules();
  const problems: string[] = [];
  for (const file of REAL_MODULES) {
    const { specifiers, nonLiteralDynamic } = importsOf(file);
    const unmocked = [...new Set(specifiers.map((s) => toKey(file, s)))]
      .filter((k) => !mocked.has(k) && !SIDE_EFFECT_FREE.has(k));
    const name = file.slice(SRC.length + 1);
    if (unmocked.length) problems.push(`${name}: unmocked imports ${unmocked.map((k) => k.replace(SRC, "src")).join(", ")}`);
    if (nonLiteralDynamic) problems.push(`${name}: ${nonLiteralDynamic} non-literal dynamic import(s)`);
  }
  return problems;
}

type Ctrl = typeof import("../../controllers/project.controller.js");
type ProjectService = typeof import("../../services/project/forgeProject.service.js");
let ctrl: Ctrl;
let realGetForgeProjectById: ProjectService["getForgeProjectById"];

// An isolation problem must FAIL every test, never skip it: beforeAll only records it (and imports
// nothing), and beforeEach rethrows it so each test fails individually.
let isolationError: Error | undefined;

beforeAll(async () => {
  const problems = isolationProblems();
  if (problems.length) {
    isolationError = new Error(`Refusing to load modules: ${problems.join("; ")}`);
    return;
  }
  ctrl = await import("../../controllers/project.controller.js");
  ({ getForgeProjectById: realGetForgeProjectById } =
    await vi.importActual<ProjectService>("../../services/project/forgeProject.service.js"));
});

// ---------------------------------------------------------------------------------------------
// Disposable fixtures
// ---------------------------------------------------------------------------------------------
const OWNER = { id: "user-owner", role: "USER" };
const MEMBER = { id: "user-member", role: "USER" };
const OUTSIDER = { id: "user-outsider", role: "USER" };

const ROWS: Record<string, any> = {
  "project-owned": { id: "project-owned", ownerId: OWNER.id, workspaceId: null },
  "project-workspace": { id: "project-workspace", ownerId: "user-someone-else", workspaceId: "ws-1" },
  "project-other": { id: "project-other", ownerId: "user-someone-else", workspaceId: null },
};
const MEMBERSHIPS = new Set(["ws-1:user-member"]);

const SERVERS = [{ id: "mcp-1", name: "Server" }];
const RPC_BODY = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "read_file", arguments: { filePath: "a.ts" } } };
const RPC_RESULT = { jsonrpc: "2.0", id: 1, result: { content: [] } };

beforeEach(() => {
  if (isolationError) throw isolationError;
  vi.clearAllMocks();
  h.getForgeProjectById.mockImplementation((...args: Parameters<ProjectService["getForgeProjectById"]>) => realGetForgeProjectById(...args));
  h.prisma.forgeProject.findUnique.mockImplementation(async ({ where }: any) => ROWS[where.id] ?? null);
  h.prisma.workspaceMember.findUnique.mockImplementation(async ({ where }: any) => {
    const { workspaceId, userId } = where.workspaceId_userId;
    return MEMBERSHIPS.has(`${workspaceId}:${userId}`) ? { workspaceId, userId } : null;
  });
  h.listServers.mockResolvedValue(SERVERS);
  h.handleJsonRpc.mockResolvedValue(RPC_RESULT);
});

function call(handler: keyof Ctrl, id: string, user?: object, body?: unknown) {
  const req: any = { params: { id }, body };
  const res: any = { locals: user ? { user } : {} };
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  const next = vi.fn();
  return { req, res, next, run: () => (ctrl[handler] as any)(req, res, next) };
}

/** Each MCP handler, its MCP service spy, how that spy must be called, and the authorized response body. */
const HANDLERS = [
  {
    finding: "F-51",
    handler: "listMcpServersHandler" as const,
    body: undefined,
    service: () => h.listServers,
    expectServiceCall: (id: string) => expect(h.listServers).toHaveBeenCalledExactlyOnceWith(id),
    authorizedResponse: { success: true, servers: SERVERS },
  },
  {
    finding: "F-34",
    handler: "mcpJsonRpcHandler" as const,
    body: RPC_BODY,
    service: () => h.handleJsonRpc,
    expectServiceCall: (id: string) => expect(h.handleJsonRpc).toHaveBeenCalledExactlyOnceWith(RPC_BODY, id),
    authorizedResponse: RPC_RESULT,
  },
];

describe("MCP authorization isolation", () => {
  it("every import of the controller and forgeProject.service is mocked or side-effect free", () => {
    expect(isolationProblems()).toEqual([]);
  });
});

describe.each(HANDLERS)("$finding $handler", ({ handler, body, service, expectServiceCall, authorizedResponse }) => {
  it("project owner: authorized and existing response format preserved", async () => {
    const c = call(handler, "project-owned", OWNER, body);
    await c.run();
    expect(h.getForgeProjectById).toHaveBeenCalledExactlyOnceWith("project-owned", OWNER);
    expectServiceCall("project-owned");
    expect(c.res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith(authorizedResponse);
    expect(c.next).not.toHaveBeenCalled();
  });

  it("workspace member: authorized through the real membership check", async () => {
    const c = call(handler, "project-workspace", MEMBER, body);
    await c.run();
    expect(h.prisma.workspaceMember.findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { workspaceId_userId: { workspaceId: "ws-1", userId: MEMBER.id } },
    });
    expectServiceCall("project-workspace");
    expect(c.res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith(authorizedResponse);
  });

  it.each([
    ["another user's project", "project-other"],
    ["a workspace project the user is not a member of", "project-workspace"],
  ])("cross-project user on %s: 403 FORBIDDEN and the MCP service is never invoked", async (_label, id) => {
    const c = call(handler, id, OUTSIDER, body);
    await c.run();
    expect(c.next).toHaveBeenCalledOnce();
    const err = c.next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(service()).not.toHaveBeenCalled();
    expect(c.res.status).not.toHaveBeenCalled();
    expect(c.res.json).not.toHaveBeenCalled();
  });

  it("unknown project: 404 NOT_FOUND and the MCP service is never invoked", async () => {
    const c = call(handler, "project-does-not-exist", OWNER, body);
    await c.run();
    expect(c.next).toHaveBeenCalledOnce();
    expect(c.next.mock.calls[0][0]).toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    expect(service()).not.toHaveBeenCalled();
    expect(c.res.status).not.toHaveBeenCalled();
  });

  it("missing authenticated user: Error('Unauthorized') before any lookup, MCP service never invoked", async () => {
    const c = call(handler, "project-owned", undefined, body);
    await c.run();
    expect(c.next).toHaveBeenCalledOnce();
    const err = c.next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Unauthorized");
    expect(h.getForgeProjectById).not.toHaveBeenCalled();
    expect(h.prisma.forgeProject.findUnique).not.toHaveBeenCalled();
    expect(service()).not.toHaveBeenCalled();
    expect(c.res.status).not.toHaveBeenCalled();
  });
});
