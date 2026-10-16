/**
 * Regression guard: HTTP write contract of updateProjectHandler (project.controller.ts).
 *
 * Two layers, kept separate on purpose:
 *
 *  A. Handler contract (service MOCKED). updateForgeProject is a vi.fn returning or rejecting with
 *     fixed values. These tests verify only how the handler forwards input and propagates the
 *     outcome. They say nothing about whether authorization is enforced.
 *
 *  B. Authorization enforcement (service REAL). The handler calls the real updateForgeProject from
 *     forgeProject.service.ts, which calls the real getForgeProjectById. Only the Prisma client and
 *     the audit/page-registry dependencies are mocked, so these tests exercise the real access check
 *     against in-memory database rows.
 *
 * Isolation: every module that is loaded for real (the controller and forgeProject.service.ts) is
 * parsed first, and each of its static and dynamic imports must resolve to a vi.mock'd module or to
 * an explicitly side-effect-free one. If not, nothing is imported and every test FAILS.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAst } from "rolldown/parseAst";
import { AppError } from "../../utils/app-error.js";

const TEST_FILE = fileURLToPath(import.meta.url);
const TEST_DIR = dirname(TEST_FILE);
const SRC = resolve(TEST_DIR, "../..");
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
    updateForgeProject: vi.fn(),
    recordAuditLog: vi.fn(),
  };
});

// Static imports of project.controller.ts and forgeProject.service.ts.
vi.mock("express", () => ({}));
vi.mock("../../config/prisma.js", () => ({ prisma: h.prisma, pgPool: {} }));
vi.mock("../../services/project/forgeProject.service.js", () => ({
  ...h.stubs("createForgeProject", "getForgeProjectById", "getOrCreateProjectForWebsite",
    "transitionProjectLifecycle", "listForgeProjects", "cloneForgeProject", "syncProjectFromWebsite"),
  updateForgeProject: h.updateForgeProject,
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
vi.mock("../../services/audit.service.js", () => ({ recordAuditLog: h.recordAuditLog }));
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
vi.mock("../../modules/ai/mcp/mcpRegistry.service.js", () => ({}));
vi.mock("../../modules/ai/mcp/mcpServer.service.js", () => ({}));
vi.mock("../../modules/ai/mcp/mcpClient.service.js", () => ({}));
vi.mock("../../services/authoritative/applicationSpec.service.js", () => ({}));

/** Modules allowed to load for real because they have no imports and no module-level side effects. */
const SIDE_EFFECT_FREE = new Set([resolve(SRC, "utils/app-error.js"), "node:crypto"]);

/** Modules this file loads for real; each one's imports are checked before anything is imported. */
const REAL_MODULES = [CONTROLLER_FILE, PROJECT_SERVICE_FILE];

const toKey = (from: string, specifier: string) => (specifier.startsWith(".") ? resolve(dirname(from), specifier) : specifier);

/** Absolute paths (or bare names) passed to vi.mock in this file. */
function viMockedModules(): Set<string> {
  const self = readFileSync(TEST_FILE, "utf8");
  return new Set([...self.matchAll(/^vi\.mock\("([^"]+)"/gm)].map((m) => toKey(TEST_FILE, m[1])));
}

/** Static and dynamic import specifiers of a source file, plus a count of non-literal import(). */
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

/** Problems that make loading the real modules unsafe; empty when isolation holds. */
/**
 * Reviewed module-level declaration allowed in extracted controller modules: a `const` whose value
 * is another binding (`const db = prisma as any;`, `const X = IMPORTED;`). Evaluating it has no side
 * effects; calls, `new`, object literals and `let`/`var` are still rejected.
 */
const isBindingAlias = (s: any): boolean => s.type === "VariableDeclaration" && s.kind === "const" &&
  s.declarations.every((d: any) => d.id.type === "Identifier" && (d.init?.type === "Identifier" ||
    (d.init?.type === "TSAsExpression" && d.init.expression.type === "Identifier" && d.init.typeAnnotation.type === "TSAnyKeyword")));

/** Modules split out of project.controller.ts; loaded for real, so their imports are checked too. */
const PROJECT_CONTROLLER_DIR = resolve(SRC, "controllers/project");

/** Top-level statements other than imports, exports and function declarations (i.e. side effects). */
function topLevelSideEffects(file: string): number {
  const ast = parseAst(readFileSync(file, "utf8"), { lang: "ts", sourceType: "module" }, file) as any;
  return ast.body.filter((s: any) => !(s.type === "ImportDeclaration" || s.type === "FunctionDeclaration" || isBindingAlias(s) ||
    (s.type === "ExportNamedDeclaration" && (s.source || s.declaration?.type === "FunctionDeclaration")))).length;
}

function isolationProblems(): string[] {
  const mocked = viMockedModules();
  const problems: string[] = [];
  const queue = [...REAL_MODULES];
  const seen = new Set<string>();
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const { specifiers, nonLiteralDynamic } = importsOf(file);
    const keys = [...new Set(specifiers.map((s) => toKey(file, s)))];
    const local = keys.filter((k) => dirname(k) === PROJECT_CONTROLLER_DIR);
    queue.push(...local.map((k) => k.replace(/.js$/, ".ts")));
    const unmocked = keys.filter((k) => !local.includes(k) && !mocked.has(k) && !SIDE_EFFECT_FREE.has(k));
    const name = file.slice(SRC.length + 1);
    if (dirname(file) === PROJECT_CONTROLLER_DIR && topLevelSideEffects(file)) problems.push(`${name}: top-level statements with side effects`);
    if (unmocked.length) problems.push(`${name}: unmocked imports ${unmocked.map((k) => k.replace(SRC, "src")).join(", ")}`);
    if (nonLiteralDynamic) problems.push(`${name}: ${nonLiteralDynamic} non-literal dynamic import(s)`);
  }
  return problems;
}

type Ctrl = typeof import("../../controllers/project.controller.js");
type ProjectService = typeof import("../../services/project/forgeProject.service.js");
let updateProjectHandler: Ctrl["updateProjectHandler"];
let realUpdateForgeProject: ProjectService["updateForgeProject"];

// An isolation problem must FAIL every test, never skip it: beforeAll only records it (and imports
// nothing), and beforeEach rethrows it so each test fails individually.
let isolationError: Error | undefined;

beforeAll(async () => {
  const problems = isolationProblems();
  if (problems.length) {
    isolationError = new Error(`Refusing to load modules: ${problems.join("; ")}`);
    return;
  }
  ({ updateProjectHandler } = await import("../../controllers/project.controller.js"));
  // Real service module; its own imports still resolve to the vi.mock'd modules above.
  ({ updateForgeProject: realUpdateForgeProject } =
    await vi.importActual<ProjectService>("../../services/project/forgeProject.service.js"));
});

beforeEach(() => {
  if (isolationError) throw isolationError;
  vi.clearAllMocks();
  h.updateForgeProject.mockReset();
  h.prisma.forgeProject.findUnique.mockReset();
  h.prisma.forgeProject.update.mockReset();
  h.prisma.workspaceMember.findUnique.mockReset();
  h.recordAuditLog.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------------------------
// Disposable fixtures
// ---------------------------------------------------------------------------------------------
const OWNER = { id: "user-owner", role: "USER" };
const OUTSIDER = { id: "user-outsider", role: "USER" };
const MEMBER = { id: "user-member", role: "USER" };

const ROWS: Record<string, any> = {
  "project-owned": { id: "project-owned", ownerId: OWNER.id, workspaceId: null, name: "Owned", settings: { a: 1 } },
  "project-other": { id: "project-other", ownerId: "user-someone-else", workspaceId: null, name: "Other" },
  "project-workspace": { id: "project-workspace", ownerId: "user-someone-else", workspaceId: "ws-1", name: "Shared" },
  "project-deleted": { id: "project-deleted", ownerId: OWNER.id, workspaceId: null, deletedAt: new Date("2026-01-01T00:00:00Z") },
};

function call(params: { id: string }, body: Record<string, unknown>, user?: object) {
  const req: any = { params, body };
  const res: any = { locals: user ? { user } : {} };
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  const next = vi.fn();
  return { req, res, next, run: () => updateProjectHandler(req, res, next) };
}

function expectForwardedError(c: ReturnType<typeof call>, status: number, code: string, message: string) {
  expect(c.next).toHaveBeenCalledOnce();
  const err = c.next.mock.calls[0][0];
  expect(err).toBeInstanceOf(AppError);
  expect(err).toMatchObject({ statusCode: status, code, message });
  expect(c.res.status).not.toHaveBeenCalled();
  expect(c.res.json).not.toHaveBeenCalled();
}

describe("updateProjectHandler isolation", () => {
  it("every import of the controller and forgeProject.service is mocked or side-effect free", () => {
    expect(isolationProblems()).toEqual([]);
  });
});

describe("A. updateProjectHandler handler contract (service mocked; does not verify authorization)", () => {
  it("success: forwards (projectId, user, body) and responds 200 { success: true, project }", async () => {
    const updated = { id: "project-owned", name: "Renamed" };
    h.updateForgeProject.mockResolvedValue(updated);
    const body = { name: "Renamed" };
    const c = call({ id: "project-owned" }, body, OWNER);
    await c.run();
    expect(h.updateForgeProject).toHaveBeenCalledExactlyOnceWith("project-owned", OWNER, body);
    expect(c.res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith({ success: true, project: updated });
    expect(c.next).not.toHaveBeenCalled();
  });

  it("service rejection (403) is forwarded to next unchanged and nothing is sent", async () => {
    const denial = new AppError("You do not have permission to view this project", 403, "FORBIDDEN");
    h.updateForgeProject.mockRejectedValue(denial);
    const c = call({ id: "project-other" }, { name: "x" }, OUTSIDER);
    await c.run();
    expect(c.next).toHaveBeenCalledExactlyOnceWith(denial);
    expect(c.res.status).not.toHaveBeenCalled();
  });

  it("service rejection (404) is forwarded to next unchanged and nothing is sent", async () => {
    const missing = new AppError("Project not found", 404, "NOT_FOUND");
    h.updateForgeProject.mockRejectedValue(missing);
    const c = call({ id: "project-missing" }, { name: "x" }, OWNER);
    await c.run();
    expect(c.next).toHaveBeenCalledExactlyOnceWith(missing);
    expect(c.res.status).not.toHaveBeenCalled();
  });

  it("missing user: forwards a plain Error('Unauthorized') and never calls the service (current behaviour)", async () => {
    const c = call({ id: "project-owned" }, { name: "x" });
    await c.run();
    expect(c.next).toHaveBeenCalledOnce();
    const err = c.next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AppError);
    expect(err.message).toBe("Unauthorized");
    expect(h.updateForgeProject).not.toHaveBeenCalled();
    expect(c.res.status).not.toHaveBeenCalled();
  });
});

describe("B. updateProjectHandler authorization enforcement (real service + real getForgeProjectById; Prisma mocked)", () => {
  beforeEach(() => {
    h.updateForgeProject.mockImplementation((...args: Parameters<ProjectService["updateForgeProject"]>) => realUpdateForgeProject(...args));
    h.prisma.forgeProject.findUnique.mockImplementation(async ({ where }: any) => ROWS[where.id] ?? null);
    h.prisma.forgeProject.update.mockImplementation(async ({ where, data }: any) => ({ ...ROWS[where.id], ...data }));
    h.prisma.workspaceMember.findUnique.mockResolvedValue(null);
  });

  it("owner: row is updated, audit recorded, and 200 { success: true, project } returns the updated row", async () => {
    const c = call({ id: "project-owned" }, { name: "  Renamed  ", settings: { b: 2 } }, OWNER);
    await c.run();
    expect(c.next).not.toHaveBeenCalled();
    expect(h.prisma.forgeProject.update).toHaveBeenCalledOnce();
    const { where, data } = h.prisma.forgeProject.update.mock.calls[0][0];
    expect(where).toEqual({ id: "project-owned" });
    expect(data).toMatchObject({ name: "Renamed", settings: { a: 1, b: 2 } });
    expect(data.lastActivityAt).toBeInstanceOf(Date);
    expect(h.recordAuditLog).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      userId: OWNER.id, action: "project.updated", targetResource: "project:project-owned",
    }));
    expect(c.res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith({ success: true, project: { ...ROWS["project-owned"], ...data } });
  });

  it("workspace member of a non-owned project: update is allowed", async () => {
    h.prisma.workspaceMember.findUnique.mockResolvedValue({ workspaceId: "ws-1", userId: MEMBER.id });
    const c = call({ id: "project-workspace" }, { name: "Shared 2" }, MEMBER);
    await c.run();
    expect(h.prisma.workspaceMember.findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { workspaceId_userId: { workspaceId: "ws-1", userId: MEMBER.id } },
    });
    expect(h.prisma.forgeProject.update).toHaveBeenCalledOnce();
    expect(c.res.status).toHaveBeenCalledExactlyOnceWith(200);
  });

  it.each([
    ["another user's project (no workspace)", "project-other"],
    ["a workspace project the user is not a member of", "project-workspace"],
  ])("cross-project write to %s: 403 FORBIDDEN, no update and no audit entry", async (_label, id) => {
    const c = call({ id }, { name: "hijack" }, OUTSIDER);
    await c.run();
    expectForwardedError(c, 403, "FORBIDDEN", "You do not have permission to view this project");
    expect(h.prisma.forgeProject.update).not.toHaveBeenCalled();
    expect(h.recordAuditLog).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown id", "project-does-not-exist"],
    ["a soft-deleted project", "project-deleted"],
  ])("%s: 404 NOT_FOUND, no update and no audit entry", async (_label, id) => {
    const c = call({ id }, { name: "x" }, OWNER);
    await c.run();
    expectForwardedError(c, 404, "NOT_FOUND", "Project not found");
    expect(h.prisma.forgeProject.update).not.toHaveBeenCalled();
    expect(h.recordAuditLog).not.toHaveBeenCalled();
  });
});
