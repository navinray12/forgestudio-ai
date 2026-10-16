/**
 * Regression guard: HTTP read contract of getProjectHandler (project.controller.ts).
 *
 * Isolation: every module the controller imports, statically or through `await import(...)`, is
 * replaced with a vi.mock factory, so no real service, Prisma client, pg pool, filesystem or network
 * code is loaded. The only real dependency is utils/app-error.js, which has no imports and no side
 * effects. Before the controller is imported, its source is parsed and every import specifier is
 * checked against the mocked set; the controller is never loaded if an unmocked import appears.
 *
 * Project data is disposable in-memory fixtures. getForgeProjectById is MOCKED with a stand-in that
 * imitates its access rules, only to feed the handler realistic success, 403 and 404 outcomes.
 * These tests verify the handler's contract (what it forwards, sends and propagates). They do NOT
 * verify that the real getForgeProjectById enforces authorization; see project-write-contract
 * layer B for tests that run the real helper.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseAst } from "rolldown/parseAst";
import { AppError } from "../../utils/app-error.js";

const CONTROLLER_PATH = fileURLToPath(new URL("../../controllers/project.controller.ts", import.meta.url));

const h = vi.hoisted(() => {
  const stubs = (...names: string[]) => Object.fromEntries(names.map((n) => [n, vi.fn()]));
  return {
    stubs,
    prisma: {
      website: { findUnique: vi.fn() },
      forgeProject: { findUnique: vi.fn() },
    },
    getForgeProjectById: vi.fn(),
    syncProjectFromWebsite: vi.fn(),
  };
});

// Static imports of project.controller.ts, as specifiers relative to the controller.
vi.mock("express", () => ({}));
vi.mock("../../config/prisma.js", () => ({ prisma: h.prisma }));
vi.mock("../../services/project/forgeProject.service.js", () => ({
  ...h.stubs("createForgeProject", "getOrCreateProjectForWebsite", "updateForgeProject",
    "transitionProjectLifecycle", "listForgeProjects", "cloneForgeProject"),
  getForgeProjectById: h.getForgeProjectById,
  syncProjectFromWebsite: h.syncProjectFromWebsite,
}));
vi.mock("../../services/project/forgeFilesystem.service.js", () => h.stubs("writeFile", "readFile", "deleteFile",
  "moveOrRenameFile", "getProjectFileTree", "getFileRevisions", "createProjectSnapshot", "listProjectSnapshots", "listFiles"));
vi.mock("../../services/codeGenerator.service.js", () => h.stubs("buildZipFromFiles"));
vi.mock("../../services/project/forgeManifest.service.js", () => h.stubs("getProjectManifest", "updateProjectManifest"));
vi.mock("../../services/compiler/unifiedCompiler.service.js", () => h.stubs("compileAndSyncProject"));
vi.mock("../../services/compiler/visualCodeSync.service.js", () => h.stubs("syncVisualElementToSource", "syncSourceToVisualWebsite"));
vi.mock("../../services/generator/index.js", () => h.stubs("createGenerationPlan", "executeGeneration", "regenerateScope"));
vi.mock("../../services/workspace/workspaceCheckpoints.service.js", () => h.stubs("recordCheckpoint",
  "findCommittedChangeSet", "getCheckpointState", "listCheckpointsAfter", "kindForSyncStatus"));
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

// Dynamic `await import(...)` targets of the controller. None is used by getProjectHandler except
// forgeProject.service.js (mocked above); each is mocked so no handler can reach real code.
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

/** Controller-relative specifiers covered by the vi.mock calls above. Keep in sync with them. */
const MOCKED_SPECIFIERS = new Set([
  "express",
  "../config/prisma.js",
  "../services/project/forgeProject.service.js",
  "../services/project/forgeFilesystem.service.js",
  "../services/codeGenerator.service.js",
  "../services/project/forgeManifest.service.js",
  "../services/compiler/unifiedCompiler.service.js",
  "../services/compiler/visualCodeSync.service.js",
  "../services/generator/index.js",
  "../services/workspace/workspaceCheckpoints.service.js",
  "../services/compiler/pageRegistry.js",
  "../services/project/projectPages.service.js",
  "../services/preview/sourcePreview.service.js",
  "../services/compiler/roundTripContract.service.js",
  "../services/benchmark/referenceProjectBenchmark.service.js",
  "../services/generator/dynamicSourcePlanner.service.js",
  "../services/generator/safeCleanupEngine.service.js",
  "../services/generator/dataModelGenerator.service.js",
  "../services/generator/externalDatabaseIntrospection.service.js",
  "../services/api/contractFirstApiGenerator.service.js",
  "../services/auth/applicationAuth.service.js",
  "../services/auth/unifiedExecutionAuthorization.service.js",
  "../services/database/databaseStudioViews.service.js",
  "../services/environment/environmentBinding.service.js",
  "../services/audit.service.js",
  "../services/cms/contentLifecycle.service.js",
  "../services/environment/targetResolution.service.js",
  "../services/migration/unifiedMigrationAuthority.service.js",
  "../services/qualification/applicationReleaseQualification.service.js",
  "../services/architecture/controlPlaneReconciliation.service.js",
  "../services/compiler/canvasEditPlanner.js",
  "../services/dependency/forgeDependency.service.js",
  "../services/runtime/forgeSandbox.service.js",
  "../services/build/forgeBuild.service.js",
  "../services/preview/forgePreview.service.js",
  "../services/terminal/forgeTerminal.service.js",
  "../services/debug/forgeDebug.service.js",
  "../services/hosting/forgeHosting.service.js",
  "../services/hosting/forgeCicd.service.js",
  "../services/hosting/forgeDomain.service.js",
  "../services/git/forgeGit.service.js",
  "../services/git/forgeGithub.service.js",
  "../services/cli/forgeCli.service.js",
  "../modules/ai/gateway/aiGateway.service.js",
  "../modules/ai/tools/toolExecution.service.js",
  "../modules/ai/coding/codingAgent.service.js",
  "../modules/ai/creator/aiCreator.service.js",
  "../modules/ai/website/websiteAgent.service.js",
  "../modules/ai/mcp/mcpRegistry.service.js",
  "../modules/ai/mcp/mcpServer.service.js",
  "../modules/ai/mcp/mcpClient.service.js",
  "../services/authoritative/applicationSpec.service.js",
]);

/** Imports allowed to load for real: no imports of their own and no module-level side effects. */
const REAL_SPECIFIERS = new Set(["../utils/app-error.js"]);

/** Every import specifier in the controller: static declarations and any `import(...)` expression. */
function controllerImportSpecifiers(): { all: string[]; nonLiteralDynamic: number } {
  const src = readFileSync(CONTROLLER_PATH, "utf8");
  const ast = parseAst(src, { lang: "ts", sourceType: "module" }, "project.controller.ts") as any;
  const all: string[] = [];
  let nonLiteralDynamic = 0;
  const walk = (node: any): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.type === "ImportDeclaration" || node.type === "ExportAllDeclaration" ||
      (node.type === "ExportNamedDeclaration" && node.source)) all.push(node.source.value);
    if (node.type === "ImportExpression") {
      if (node.source.type === "Literal" && typeof node.source.value === "string") all.push(node.source.value);
      else nonLiteralDynamic++;
    }
    for (const key of Object.keys(node)) walk(node[key]);
  };
  walk(ast);
  return { all, nonLiteralDynamic };
}

/** Controller-relative specifiers that this file actually passes to vi.mock. */
function viMockedSpecifiers(): Set<string> {
  const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
  return new Set([...self.matchAll(/^vi\.mock\("([^"]+)"/gm)].map((m) => (m[1].startsWith("../../") ? `../${m[1].slice(6)}` : m[1])));
}

/** Problems that make importing the controller unsafe; empty when isolation holds. */
function isolationProblems(): string[] {
  const { all, nonLiteralDynamic } = controllerImportSpecifiers();
  const mocked = viMockedSpecifiers();
  const problems: string[] = [];
  const unmocked = [...new Set(all.filter((s) => !MOCKED_SPECIFIERS.has(s) && !REAL_SPECIFIERS.has(s)))];
  const listedNotMocked = [...MOCKED_SPECIFIERS].filter((s) => !mocked.has(s));
  if (unmocked.length) problems.push(`unmocked imports: ${unmocked.join(", ")}`);
  if (listedNotMocked.length) problems.push(`listed without a vi.mock call: ${listedNotMocked.join(", ")}`);
  if (nonLiteralDynamic) problems.push(`non-literal dynamic imports: ${nonLiteralDynamic}`);
  return problems;
}

type Ctrl = typeof import("../../controllers/project.controller.js");
let getProjectHandler: Ctrl["getProjectHandler"];

// ---------------------------------------------------------------------------------------------
// Disposable fixtures
// ---------------------------------------------------------------------------------------------
const OWNER = { id: "user-owner", role: "USER" };
const MEMBER = { id: "user-member", role: "USER" };
const OUTSIDER = { id: "user-outsider", role: "USER" };

const PROJECTS: Record<string, any> = {
  "project-owned": { id: "project-owned", ownerId: OWNER.id, workspaceId: null, websiteId: null, name: "Owned" },
  "project-other": { id: "project-other", ownerId: "user-someone-else", workspaceId: null, websiteId: null, name: "Other" },
  "project-workspace": { id: "project-workspace", ownerId: "user-someone-else", workspaceId: "ws-1", websiteId: null, name: "Shared" },
  "project-linked": { id: "project-linked", ownerId: OWNER.id, workspaceId: null, websiteId: "site-1", name: "Linked" },
  "project-deleted": { id: "project-deleted", ownerId: OWNER.id, workspaceId: null, websiteId: null, deletedAt: new Date("2026-01-01T00:00:00Z") },
};
const WORKSPACE_MEMBERS = new Set(["ws-1:user-member"]);

/** Mirrors the access rules of getForgeProjectById over the fixtures above. */
async function fixtureGetForgeProjectById(projectId: string, user?: { id?: string; role?: string }) {
  const project = PROJECTS[projectId];
  if (!project || project.deletedAt) throw new AppError("Project not found", 404, "NOT_FOUND");
  if (!user) return project;
  const privileged = ["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(user.role || "");
  if (!privileged && user.id && project.ownerId !== user.id) {
    if (!project.workspaceId || !WORKSPACE_MEMBERS.has(`${project.workspaceId}:${user.id}`)) {
      throw new AppError("You do not have permission to view this project", 403, "FORBIDDEN");
    }
  }
  return project;
}

function call(params: { id: string }, user?: object, via: "locals" | "req" = "locals") {
  const req: any = { params, ...(via === "req" && user ? { user } : {}) };
  const res: any = { locals: via === "locals" && user ? { user } : {} };
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  const next = vi.fn();
  return { req, res, next, run: () => getProjectHandler(req, res, next) };
}

// An isolation problem must FAIL every test, never skip it. A throwing beforeAll would mark the tests
// as skipped, so beforeAll only records the problem (and never imports the controller), and
// beforeEach rethrows it, which fails each test individually.
let isolationError: Error | undefined;

beforeAll(async () => {
  const problems = isolationProblems();
  if (problems.length) {
    isolationError = new Error(`Refusing to import controller: ${problems.join("; ")}`);
    return;
  }
  ({ getProjectHandler } = await import("../../controllers/project.controller.js"));
});

beforeEach(() => {
  if (isolationError) throw isolationError;
  vi.clearAllMocks();
  h.getForgeProjectById.mockImplementation(fixtureGetForgeProjectById);
  h.prisma.website.findUnique.mockResolvedValue(null);
  h.prisma.forgeProject.findUnique.mockResolvedValue(null);
});

describe("getProjectHandler isolation", () => {
  it("every controller import is mocked by a vi.mock call or explicitly side-effect free", () => {
    expect(isolationProblems()).toEqual([]);
  });

  it("the real dependency (app-error) has no imports of its own", () => {
    const src = readFileSync(fileURLToPath(new URL("../../utils/app-error.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/\bimport\b/);
  });
});

describe("getProjectHandler read contract", () => {
  it("owner: 200 { success: true, project } and the authenticated user is passed to the access check", async () => {
    const c = call({ id: "project-owned" }, OWNER);
    await c.run();
    expect(h.getForgeProjectById).toHaveBeenCalledExactlyOnceWith("project-owned", OWNER);
    expect(c.res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith({ success: true, project: PROJECTS["project-owned"] });
    expect(c.next).not.toHaveBeenCalled();
    expect(h.prisma.website.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to req.user when res.locals.user is absent", async () => {
    const c = call({ id: "project-owned" }, OWNER, "req");
    await c.run();
    expect(h.getForgeProjectById).toHaveBeenCalledExactlyOnceWith("project-owned", OWNER);
    expect(c.res.status).toHaveBeenCalledWith(200);
  });

  it("workspace member of a non-owned project: 200", async () => {
    const c = call({ id: "project-workspace" }, MEMBER);
    await c.run();
    expect(c.res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith({ success: true, project: PROJECTS["project-workspace"] });
    expect(c.next).not.toHaveBeenCalled();
  });

  it("linked website: syncs from the site and returns the re-read project with visualSync", async () => {
    const site = { id: "site-1" };
    const fresh = { ...PROJECTS["project-linked"], name: "Linked (fresh)" };
    const visualSync = { status: "synced" };
    h.prisma.website.findUnique.mockResolvedValue(site);
    h.prisma.forgeProject.findUnique.mockResolvedValue(fresh);
    h.syncProjectFromWebsite.mockResolvedValue(visualSync);

    const c = call({ id: "project-linked" }, OWNER);
    await c.run();
    expect(h.prisma.website.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: "site-1" } });
    expect(h.syncProjectFromWebsite).toHaveBeenCalledExactlyOnceWith(PROJECTS["project-linked"], site, OWNER);
    expect(h.prisma.forgeProject.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: "project-linked" } });
    expect(c.res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith({ success: true, project: { ...fresh, visualSync } });
  });

  it("linked website that no longer exists: 200 with the stored project and no sync", async () => {
    const c = call({ id: "project-linked" }, OWNER);
    await c.run();
    expect(h.syncProjectFromWebsite).not.toHaveBeenCalled();
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith({ success: true, project: PROJECTS["project-linked"] });
  });
});

describe("getProjectHandler access denial and unknown projects", () => {
  it.each([
    ["another user's project", "project-other"],
    ["a workspace project the user is not a member of", "project-workspace"],
  ])("cross-project access to %s: forwards 403 FORBIDDEN to next and sends nothing", async (_label, id) => {
    const c = call({ id }, OUTSIDER);
    await c.run();
    expect(c.next).toHaveBeenCalledOnce();
    const err = c.next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ statusCode: 403, code: "FORBIDDEN", message: "You do not have permission to view this project" });
    expect(c.res.status).not.toHaveBeenCalled();
    expect(c.res.json).not.toHaveBeenCalled();
    expect(h.prisma.website.findUnique).not.toHaveBeenCalled();
    expect(h.syncProjectFromWebsite).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown id", "project-does-not-exist"],
    ["a soft-deleted project", "project-deleted"],
  ])("%s: forwards 404 NOT_FOUND to next and sends nothing", async (_label, id) => {
    const c = call({ id }, OWNER);
    await c.run();
    expect(c.next).toHaveBeenCalledOnce();
    expect(c.next.mock.calls[0][0]).toMatchObject({ statusCode: 404, code: "NOT_FOUND", message: "Project not found" });
    expect(c.next.mock.calls[0][0]).toBeInstanceOf(AppError);
    expect(c.res.status).not.toHaveBeenCalled();
    expect(c.res.json).not.toHaveBeenCalled();
  });

  it("no authenticated user: forwards a plain Error('Unauthorized') before any lookup (current behaviour)", async () => {
    const c = call({ id: "project-owned" });
    await c.run();
    expect(c.next).toHaveBeenCalledOnce();
    const err = c.next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AppError);
    expect(err.message).toBe("Unauthorized");
    expect(h.getForgeProjectById).not.toHaveBeenCalled();
    expect(c.res.status).not.toHaveBeenCalled();
  });
});
