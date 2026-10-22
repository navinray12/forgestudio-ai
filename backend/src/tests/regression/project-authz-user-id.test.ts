/**
 * Regression guard: getForgeProjectById must fail closed for non-privileged users whose id is
 * empty, missing or malformed (previously `user.id && ...` skipped every ownership/membership check).
 *
 * The real getForgeProjectById from forgeProject.service.ts runs against a mocked Prisma client.
 *
 * Out of scope, recorded as current behaviour rather than endorsed (separate policy questions):
 *  - privileged roles (ADMIN, SUPER_ADMIN, PLATFORM_ADMIN) are allowed even with an empty id;
 *  - a call with no user at all returns the project unchecked (used by internal callers).
 *
 * Isolation: forgeProject.service.ts is parsed first, and each of its static and dynamic imports must
 * resolve to a vi.mock'd module or to an explicitly side-effect-free one. If not, nothing is imported
 * and every test FAILS.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAst } from "rolldown/parseAst";
import { AppError } from "../../utils/app-error.js";

const TEST_FILE = fileURLToPath(import.meta.url);
const SRC = resolve(dirname(TEST_FILE), "../..");
const PROJECT_SERVICE_FILE = resolve(SRC, "services/project/forgeProject.service.ts");

const h = vi.hoisted(() => ({
  prisma: {
    forgeProject: { findUnique: vi.fn() },
    workspaceMember: { findUnique: vi.fn() },
  },
}));

// Static and dynamic imports of forgeProject.service.ts.
vi.mock("../../config/prisma.js", () => ({ prisma: h.prisma, pgPool: {} }));
vi.mock("../../services/audit.service.js", () => ({ recordAuditLog: vi.fn() }));
vi.mock("../../services/compiler/pageRegistry.js", () => ({ buildSyncBaseline: vi.fn(), toProjectFramework: vi.fn() }));
vi.mock("../../services/compiler/unifiedCompiler.service.js", () => ({}));
vi.mock("../../services/project/forgeFilesystem.service.js", () => ({}));
vi.mock("../../services/workspace/workspaceCheckpoints.service.js", () => ({}));

/** Modules allowed to load for real because they have no imports and no module-level side effects. */
const SIDE_EFFECT_FREE = new Set([resolve(SRC, "utils/app-error.js"), "node:crypto"]);

const toKey = (from: string, specifier: string) => (specifier.startsWith(".") ? resolve(dirname(from), specifier) : specifier);

function isolationProblems(): string[] {
  const self = readFileSync(TEST_FILE, "utf8");
  const mocked = new Set([...self.matchAll(/^vi\.mock\("([^"]+)"/gm)].map((m) => toKey(TEST_FILE, m[1])));
  const ast = parseAst(readFileSync(PROJECT_SERVICE_FILE, "utf8"), { lang: "ts", sourceType: "module" }, PROJECT_SERVICE_FILE) as any;
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
  const unmocked = [...new Set(specifiers.map((s) => toKey(PROJECT_SERVICE_FILE, s)))]
    .filter((k) => !mocked.has(k) && !SIDE_EFFECT_FREE.has(k));
  const problems: string[] = [];
  if (unmocked.length) problems.push(`unmocked imports ${unmocked.map((k) => k.replace(SRC, "src")).join(", ")}`);
  if (nonLiteralDynamic) problems.push(`${nonLiteralDynamic} non-literal dynamic import(s)`);
  return problems;
}

type ProjectService = typeof import("../../services/project/forgeProject.service.js");
let getForgeProjectById: ProjectService["getForgeProjectById"];

// An isolation problem must FAIL every test, never skip it.
let isolationError: Error | undefined;

beforeAll(async () => {
  const problems = isolationProblems();
  if (problems.length) {
    isolationError = new Error(`Refusing to load forgeProject.service: ${problems.join("; ")}`);
    return;
  }
  ({ getForgeProjectById } = await import("../../services/project/forgeProject.service.js"));
});

// ---------------------------------------------------------------------------------------------
// Disposable fixtures
// ---------------------------------------------------------------------------------------------
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

const ROWS: Record<string, any> = {
  "project-solo": { id: "project-solo", ownerId: OWNER_ID, workspaceId: null },
  "project-workspace": { id: "project-workspace", ownerId: OWNER_ID, workspaceId: "ws-1" },
  "project-ownerless": { id: "project-ownerless", ownerId: null, workspaceId: null },
  "project-ownerless-undefined": { id: "project-ownerless-undefined", workspaceId: null },
};
const MEMBERSHIPS = new Set([`ws-1:${MEMBER_ID}`]);

beforeEach(() => {
  if (isolationError) throw isolationError;
  vi.clearAllMocks();
  h.prisma.forgeProject.findUnique.mockImplementation(async ({ where }: any) => ROWS[where.id] ?? null);
  h.prisma.workspaceMember.findUnique.mockImplementation(async ({ where }: any) => {
    const { workspaceId, userId } = where.workspaceId_userId;
    return MEMBERSHIPS.has(`${workspaceId}:${userId}`) ? { workspaceId, userId } : null;
  });
});

async function expectForbidden(projectId: string, user: any) {
  const err = await getForgeProjectById(projectId, user).then(
    (project) => { throw new Error(`expected 403, but access was granted to ${JSON.stringify(project)}`); },
    (e) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect(err).toMatchObject({ statusCode: 403, code: "FORBIDDEN", message: "You do not have permission to view this project" });
}

const INVALID_IDS: Array<[string, unknown]> = [
  ["empty string", ""],
  ["undefined", undefined],
  ["null", null],
  ["zero", 0],
  ["false", false],
  ["number", 42],
  ["object", {}],
  ["array", []],
];

describe("getForgeProjectById user-id isolation", () => {
  it("every import of forgeProject.service is mocked or side-effect free", () => {
    expect(isolationProblems()).toEqual([]);
  });
});

describe("getForgeProjectById fails closed for non-privileged users with invalid ids", () => {
  it.each(INVALID_IDS)("id %s on a project without a workspace: 403 FORBIDDEN", async (_label, id) => {
    await expectForbidden("project-solo", { id, role: "USER" });
  });

  it.each(INVALID_IDS)("id %s on a workspace project: 403 FORBIDDEN without a membership lookup", async (_label, id) => {
    await expectForbidden("project-workspace", { id, role: "USER" });
    expect(h.prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });

  it("user object without an id property: 403 FORBIDDEN", async () => {
    await expectForbidden("project-solo", { role: "USER" });
  });

  it("user with no role and an empty id: 403 FORBIDDEN", async () => {
    await expectForbidden("project-solo", { id: "" });
  });

  it.each([
    ["ownerId null", "project-ownerless"],
    ["ownerId absent", "project-ownerless-undefined"],
  ])("project with %s and a user with an undefined id: 403 FORBIDDEN", async (_label, projectId) => {
    await expectForbidden(projectId, { id: undefined, role: "USER" });
  });

  it("whitespace-only id: 403 FORBIDDEN", async () => {
    await expectForbidden("project-solo", { id: "   ", role: "USER" });
  });

  it("unknown project with an invalid id: still 404 NOT_FOUND (lookup order unchanged)", async () => {
    await expect(getForgeProjectById("project-missing", { id: "", role: "USER" })).rejects.toMatchObject({
      statusCode: 404, code: "NOT_FOUND",
    });
  });
});

describe("getForgeProjectById behaviour that must not change", () => {
  it("owner with a valid id: allowed", async () => {
    await expect(getForgeProjectById("project-solo", { id: OWNER_ID, role: "USER" })).resolves.toBe(ROWS["project-solo"]);
  });

  it("workspace member with a valid id: allowed through the membership lookup", async () => {
    await expect(getForgeProjectById("project-workspace", { id: MEMBER_ID, role: "USER" })).resolves.toBe(ROWS["project-workspace"]);
    expect(h.prisma.workspaceMember.findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { workspaceId_userId: { workspaceId: "ws-1", userId: MEMBER_ID } },
    });
  });

  it("valid non-owner, non-member id: 403 FORBIDDEN", async () => {
    await expectForbidden("project-workspace", { id: "33333333-3333-4333-8333-333333333333", role: "USER" });
  });

  // Separate policy question: privileged roles are not gated on the id. Recorded, not endorsed.
  it.each(["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"])("%s with an empty id: still allowed (admin policy unchanged)", async (role) => {
    await expect(getForgeProjectById("project-solo", { id: "", role })).resolves.toBe(ROWS["project-solo"]);
  });

  // Separate policy question: internal callers pass no user and get the project unchecked. Recorded, not endorsed.
  it("no user argument: returns the project unchecked (internal-call behaviour unchanged)", async () => {
    await expect(getForgeProjectById("project-solo")).resolves.toBe(ROWS["project-solo"]);
    expect(h.prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });
});
