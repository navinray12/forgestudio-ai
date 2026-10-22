/**
 * Regression guard: MCP server trust approval (POST /api/v1/platform/mcp-servers/:id/approve).
 *
 *  - Only a platform session (requirePlatformAuth: audience PLATFORM, OIDC, phishing-resistant,
 *    active user, PLATFORM_ADMIN or SUPER_ADMIN) may call it, and the session's server-side authTime
 *    must be within 15 minutes (requireRecentPlatformReauth).
 *  - Only UNTRUSTED -> VERIFIED is allowed; unknown, disabled, project-less or already-approved
 *    servers are rejected, the registering admin and the project owner cannot approve, and the
 *    endpoint must still satisfy the egress policy.
 *  - Approval is atomic: one transaction locks the server row, conditionally updates it and writes
 *    the audit entry; any failure rolls everything back, and concurrent approvals succeed once.
 *  - An approved server can then be invoked with the existing response contract.
 *
 * The real platform router, requirePlatformAuth, authenticatePlatformSession,
 * requireRecentPlatformReauth, withServiceTransaction, error middleware, registry and client run in
 * an in-process Express app on 127.0.0.1. pgPool is an in-memory fake with transaction semantics
 * (staged writes, COMMIT/ROLLBACK, SELECT ... FOR UPDATE row locks); Prisma and the egress transport
 * are mocked, so no database or external network is used. Before anything is imported, the source of
 * every module loaded for real is parsed and each import must be mocked or explicitly side-effect
 * free; otherwise every test FAILS.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAst } from "rolldown/parseAst";

const TEST_FILE = fileURLToPath(import.meta.url);
const SRC = resolve(dirname(TEST_FILE), "../..");
const ROUTES_FILE = resolve(SRC, "platform/control/routes.ts");

const h = vi.hoisted(() => ({
  prisma: {
    session: { findUnique: vi.fn() },
    forgeMcpServer: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    forgeProject: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    forgeMcpExecution: { create: vi.fn() },
  },
  pgPool: { query: vi.fn(), connect: vi.fn() },
  resolveSafeDestination: vi.fn(),
  safeEgressRequest: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({ prisma: h.prisma, pgPool: h.pgPool }));
vi.mock("../../platform/control/capability-registry.js", () => ({ capabilityRegistry: [], validateCapabilityRegistry: vi.fn() }));
vi.mock("../../platform/control/change.service.js", () => ({
  applyRuntimeChange: vi.fn(), approveRuntimeChange: vi.fn(), createRuntimeChange: vi.fn(), listChanges: vi.fn(),
}));
vi.mock("../../operations/tenant-isolation-preflight.js", () => ({ tenantIsolationPreflight: vi.fn() }));
vi.mock("../../platform/reliability/postgres-queue.js", () => ({
  listDeadLetters: vi.fn(), listReconciliationCases: vi.fn(), replayDeadLetter: vi.fn(), resolveReconciliationCase: vi.fn(),
}));
vi.mock("../../platform/integrations/safe-egress.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../platform/integrations/safe-egress.js")>()),
  resolveSafeDestination: h.resolveSafeDestination,
  safeEgressRequest: h.safeEgressRequest,
}));

// ---------------------------------------------------------------------------------------------
// Isolation guard
// ---------------------------------------------------------------------------------------------
const REAL_MODULES = [
  ROUTES_FILE,
  resolve(SRC, "middlewares/auth.middleware.ts"),
  resolve(SRC, "middlewares/error.middleware.ts"),
  resolve(SRC, "services/platform-session-authentication.ts"),
  resolve(SRC, "services/session-authentication.ts"),
  resolve(SRC, "modules/ai/mcp/mcpRegistry.service.ts"),
  resolve(SRC, "modules/ai/mcp/mcpClient.service.ts"),
  resolve(SRC, "platform/tenancy/tenant-unit-of-work.ts"),
];
/** Loaded for real; no module-level side effects. */
const SIDE_EFFECT_FREE = new Set([
  "express", "zod", "crypto", "node:crypto",
  resolve(SRC, "utils/app-error.js"),
  resolve(SRC, "config/auth.js"),
  resolve(SRC, "config/postgres-failure.js"),
  resolve(SRC, "modules/identity/domain/assurance.js"),
  resolve(SRC, "modules/ai/mcp/mcpTypes.js"),
  resolve(SRC, "middlewares/auth.middleware.js"),
  resolve(SRC, "services/platform-session-authentication.js"),
  resolve(SRC, "services/session-authentication.js"),
  resolve(SRC, "modules/ai/mcp/mcpRegistry.service.js"),
  resolve(SRC, "modules/ai/mcp/mcpClient.service.js"),
  resolve(SRC, "platform/tenancy/tenant-unit-of-work.js"),
]);
const toKey = (from: string, s: string) => (s.startsWith(".") ? resolve(dirname(from), s) : s);

function parse(file: string) {
  return parseAst(readFileSync(file, "utf8"), { lang: "ts", sourceType: "module" }, file) as any;
}

function isolationProblems(): string[] {
  const self = readFileSync(TEST_FILE, "utf8");
  const mocked = new Set([...self.matchAll(/^vi\.mock\("([^"]+)"/gm)].map((m) => toKey(TEST_FILE, m[1])));
  const problems: string[] = [];
  for (const file of REAL_MODULES) {
    const specifiers: string[] = [];
    let nonLiteral = 0;
    const walk = (n: any): void => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if ((n.type === "ImportDeclaration" && n.importKind !== "type") || n.type === "ExportAllDeclaration" ||
        (n.type === "ExportNamedDeclaration" && n.source)) specifiers.push(n.source.value);
      if (n.type === "ImportExpression") {
        if (n.source.type === "Literal") specifiers.push(n.source.value); else nonLiteral++;
      }
      for (const k of Object.keys(n)) walk(n[k]);
    };
    walk(parse(file));
    const unmocked = [...new Set(specifiers.map((s) => toKey(file, s)))].filter((k) => !mocked.has(k) && !SIDE_EFFECT_FREE.has(k));
    const name = file.slice(SRC.length + 1);
    if (unmocked.length) problems.push(`${name}: unmocked imports ${unmocked.map((k) => k.replace(SRC, "src")).join(", ")}`);
    if (nonLiteral) problems.push(`${name}: ${nonLiteral} non-literal dynamic import(s)`);
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// In-memory PostgreSQL stand-in with transaction semantics
// ---------------------------------------------------------------------------------------------
interface Faults { update?: Error; audit?: Error; updateRowCount?: number }

class FakeDb {
  servers = new Map<string, any>();
  projects = new Map<string, any>();
  audits: any[] = [];
  statements: Array<{ sql: string; params: unknown[] }> = [];
  connects = 0;
  releases = 0;
  commits = 0;
  rollbacks = 0;
  faults: Faults = {};
  /** Hook awaited after a row lock is granted, to hold the lock open while another transaction waits. */
  afterLock: (id: string) => Promise<void> = async () => undefined;
  private locks = new Map<string, Promise<void>>();

  connect = async () => {
    this.connects++;
    const db = this;
    let staged: { servers: Map<string, any>; audits: any[] } | null = null;
    const held: Array<() => void> = [];
    const releaseLocks = () => { while (held.length) held.pop()!(); };
    return {
      async query(sql: string, params: unknown[] = []) {
        const text = sql.replace(/\s+/g, " ").trim();
        db.statements.push({ sql: text, params });
        if (text === "BEGIN") { staged = { servers: new Map(), audits: [] }; return { rows: [], rowCount: 0 }; }
        if (text === "COMMIT") {
          for (const [id, row] of staged!.servers) db.servers.set(id, row);
          db.audits.push(...staged!.audits);
          staged = null; db.commits++; releaseLocks();
          return { rows: [], rowCount: 0 };
        }
        if (text === "ROLLBACK") { staged = null; db.rollbacks++; releaseLocks(); return { rows: [], rowCount: 0 }; }
        if (text.startsWith("SELECT set_config('app.service_role'")) return { rows: [], rowCount: 1 };
        const current = (id: string) => staged?.servers.get(id) ?? db.servers.get(id);
        if (/^SELECT .* FROM forge_mcp_servers WHERE id = \$1::uuid FOR UPDATE$/.test(text)) {
          const id = String(params[0]);
          while (db.locks.has(id)) await db.locks.get(id);
          let unlock!: () => void;
          db.locks.set(id, new Promise<void>((r) => { unlock = () => { db.locks.delete(id); r(); }; }));
          held.push(unlock);
          await db.afterLock(id);
          const row = current(id);
          return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
        }
        if (/^SELECT "ownerId", "deletedAt" FROM forge_projects WHERE id = \$1::uuid$/.test(text)) {
          const row = db.projects.get(String(params[0]));
          return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
        }
        if (/^UPDATE forge_mcp_servers SET "trustLevel" = 'VERIFIED', "updatedAt" = NOW\(\) WHERE id = \$1::uuid AND "trustLevel" = 'UNTRUSTED'$/.test(text)) {
          if (db.faults.update) throw db.faults.update;
          const id = String(params[0]);
          const row = current(id);
          if (db.faults.updateRowCount !== undefined) return { rows: [], rowCount: db.faults.updateRowCount };
          if (!row || row.trustLevel !== "UNTRUSTED") return { rows: [], rowCount: 0 };
          staged!.servers.set(id, { ...row, trustLevel: "VERIFIED", updatedAt: new Date() });
          return { rows: [], rowCount: 1 };
        }
        if (/^INSERT INTO audit_logs \(id, "userId", action, "targetResource", details, "createdAt"\) VALUES \(\$1::uuid, \$2::uuid, 'MCP_SERVER_APPROVED', \$3, \$4::jsonb, NOW\(\)\)$/.test(text)) {
          if (db.faults.audit) throw db.faults.audit;
          staged!.audits.push({ id: params[0], userId: params[1], action: "MCP_SERVER_APPROVED", targetResource: params[2], details: JSON.parse(String(params[3])) });
          return { rows: [], rowCount: 1 };
        }
        throw new Error(`FakeDb: unexpected SQL: ${text}`);
      },
      release() { releaseLocks(); db.releases++; },
    };
  };
}

// ---------------------------------------------------------------------------------------------
// In-process app
// ---------------------------------------------------------------------------------------------
let server: Server | undefined;
let baseUrl = "";
let mcpClientService: typeof import("../../modules/ai/mcp/mcpClient.service.js")["mcpClientService"];
let PLATFORM_COOKIE_NAME = "";
let isolationError: Error | undefined;

beforeAll(async () => {
  const problems = isolationProblems();
  if (problems.length) {
    isolationError = new Error(`Refusing to load platform modules: ${problems.join("; ")}`);
    return;
  }
  const express = (await import("express")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const platformRoutes = (await import("../../platform/control/routes.js")).default;
  const { errorMiddleware } = await import("../../middlewares/error.middleware.js");
  ({ PLATFORM_COOKIE_NAME } = await import("../../services/platform-session-authentication.js"));
  ({ mcpClientService } = await import("../../modules/ai/mcp/mcpClient.service.js"));

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1/platform", platformRoutes);
  app.use(errorMiddleware);
  await new Promise<void>((done) => { server = app.listen(0, "127.0.0.1", () => done()); });
  baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
});

// ---------------------------------------------------------------------------------------------
// Disposable fixtures
// ---------------------------------------------------------------------------------------------
const ids = {
  platformAdmin: "11111111-1111-4111-8111-111111111111",
  superAdmin: "22222222-2222-4222-8222-222222222222",
  tenantAdmin: "33333333-3333-4333-8333-333333333333",
  owner: "44444444-4444-4444-8444-444444444444",
  registrant: "55555555-5555-4555-8555-555555555555",
  project: "66666666-6666-4666-8666-666666666666",
  deletedProject: "77777777-7777-4777-8777-777777777777",
};
const SERVER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

let db: FakeDb;
let sessions: Record<string, any>;

function platformSession(userId: string, role: string, overrides: Record<string, unknown> = {}, userOverrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(), revokedAt: null, expiresAt: new Date(Date.now() + 3_600_000), audience: "PLATFORM",
    authMethod: "oidc", assurance: "phishing-resistant", authEpoch: 1, authTime: new Date(Date.now() - 60_000),
    ...overrides,
    user: { id: userId, role, status: "ACTIVE", authEpoch: 1, ...userOverrides },
  };
}

/** Registers a session row and returns the cookie token that resolves to it. */
function tokenFor(session: any): string {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions[sha256(token)] = session;
  return token;
}
const admin = () => tokenFor(platformSession(ids.platformAdmin, "PLATFORM_ADMIN"));

const untrusted = (overrides: Record<string, unknown> = {}) => ({
  id: SERVER_ID, name: "Analytics", projectId: ids.project, userId: ids.registrant, endpoint: "https://mcp.example.com/rpc",
  trustLevel: "UNTRUSTED", isEnabled: true, authConfigEncrypted: "secret-blob", tools: [], ...overrides,
});

async function approve(serverId: string, token?: string, body: unknown = {}) {
  const res = await fetch(`${baseUrl}/api/v1/platform/mcp-servers/${serverId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Cookie: `${PLATFORM_COOKIE_NAME}=${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() as any };
}

beforeEach(() => {
  if (isolationError) throw isolationError;
  vi.clearAllMocks();
  db = new FakeDb();
  db.servers.set(SERVER_ID, untrusted());
  db.projects.set(ids.project, { id: ids.project, ownerId: ids.owner, deletedAt: null });
  db.projects.set(ids.deletedProject, { id: ids.deletedProject, ownerId: ids.owner, deletedAt: new Date() });
  sessions = {};
  h.pgPool.connect.mockImplementation(db.connect);
  h.prisma.session.findUnique.mockImplementation(async ({ where }: any) => sessions[where.tokenHash] ?? null);
  // The MCP client reads committed server rows through the Prisma fallback delegate.
  h.prisma.forgeMcpServer.findUnique.mockImplementation(async ({ where }: any) => db.servers.get(where.id) ?? null);
  h.prisma.forgeMcpExecution.create.mockResolvedValue({});
  h.resolveSafeDestination.mockResolvedValue({ address: "93.184.216.34", family: 4 });
});

/** Nothing committed, the transaction (if one was opened) rolled back, and every connection released. */
function expectNothingCommitted() {
  expect(db.commits).toBe(0);
  expect(db.audits).toEqual([]);
  expect(db.servers.get(SERVER_ID)?.trustLevel ?? "UNTRUSTED").not.toBe("VERIFIED");
  expect(db.releases).toBe(db.connects);
  expect(h.prisma.forgeMcpServer.update).not.toHaveBeenCalled();
  expect(h.prisma.auditLog.create).not.toHaveBeenCalled();
}

// ---------------------------------------------------------------------------------------------
describe("MCP trust approval isolation and route contract", () => {
  it("every import of the platform router chain is mocked or side-effect free", () => {
    expect(isolationProblems()).toEqual([]);
  });

  it("platform router keeps its existing routes and adds only the approval route", () => {
    const routes: string[] = [];
    for (const s of parse(ROUTES_FILE).body) {
      const e = s.type === "ExpressionStatement" ? s.expression : null;
      if (e?.type === "CallExpression" && e.callee.object?.name === "router" && e.arguments[0]?.type === "Literal") {
        routes.push(`${e.callee.property.name.toUpperCase()} ${e.arguments[0].value}`);
      }
    }
    expect(routes).toEqual([
      "GET /capabilities", "GET /overview", "GET /tenant-isolation/preflight", "GET /dead-letters",
      "POST /dead-letters/:id/replay", "GET /reconciliation", "POST /reconciliation/:id/resolve",
      "GET /changes", "POST /changes", "POST /changes/:id/approve", "POST /changes/:id/apply",
      "POST /mcp-servers/:id/approve",
    ]);
  });
});

describe("authorized platform administrators", () => {
  it.each([
    ["PLATFORM_ADMIN", ids.platformAdmin],
    ["SUPER_ADMIN", ids.superAdmin],
  ])("%s approves UNTRUSTED -> VERIFIED in one committed transaction with its audit entry", async (role, userId) => {
    const res = await approve(SERVER_ID, tokenFor(platformSession(userId, role)));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, server: { id: SERVER_ID, name: "Analytics", projectId: ids.project, trustLevel: "VERIFIED" } });
    expect(JSON.stringify(res.body)).not.toContain("secret-blob");

    expect(db.servers.get(SERVER_ID).trustLevel).toBe("VERIFIED");
    expect(db.audits).toEqual([{
      id: expect.stringMatching(/^[0-9a-f-]{36}$/), userId, action: "MCP_SERVER_APPROVED", targetResource: `mcp-server:${SERVER_ID}`,
      details: { projectId: ids.project, endpoint: "https://mcp.example.com/rpc", from: "UNTRUSTED", to: "VERIFIED" },
    }]);
    expect(db.commits).toBe(1);
    expect(db.rollbacks).toBe(0);
    expect(db.releases).toBe(db.connects);

    // One transaction, in order: BEGIN, service role, lock, project, conditional update, audit, COMMIT.
    const kinds = db.statements.map((s) => s.sql.split(" ").slice(0, 2).join(" "));
    expect(kinds).toEqual(["BEGIN", "SELECT set_config('app.service_role',", "SELECT id,", "SELECT \"ownerId\",", "UPDATE forge_mcp_servers", "INSERT INTO", "COMMIT"]);
    expect(db.statements[1].params).toEqual(["platform-control"]);
    // Parameterised: no identifier or actor value is interpolated into SQL text.
    for (const { sql } of db.statements) {
      expect(sql).not.toContain(SERVER_ID);
      expect(sql).not.toContain(userId);
    }
    expect(h.resolveSafeDestination).toHaveBeenCalledExactlyOnceWith("https://mcp.example.com/rpc", { allowedPorts: [443] });
    // Approval no longer goes through the non-transactional Prisma delegates.
    expect(h.prisma.forgeMcpServer.update).not.toHaveBeenCalled();
    expect(h.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("a client-requested TRUSTED level is ignored: only VERIFIED is ever granted", async () => {
    const res = await approve(SERVER_ID, admin(), { trustLevel: "TRUSTED" });
    expect(res.status).toBe(200);
    expect(db.servers.get(SERVER_ID).trustLevel).toBe("VERIFIED");
  });
});

describe("unauthenticated and unauthorized callers (401 PLATFORM_AUTH_REQUIRED, no transaction)", () => {
  it.each([
    ["no platform cookie", () => undefined],
    ["an unknown token", () => "x".repeat(43)],
    ["a tenant ADMIN (even with a platform-audience session row)", () => tokenFor(platformSession(ids.tenantAdmin, "ADMIN"))],
    ["the project owner (USER)", () => tokenFor(platformSession(ids.owner, "USER"))],
    ["a SUPER_ADMIN using an ordinary tenant session", () => tokenFor(platformSession(ids.superAdmin, "SUPER_ADMIN", { audience: "TENANT" }))],
    ["a PLATFORM_ADMIN signed in with a local password", () => tokenFor(platformSession(ids.platformAdmin, "PLATFORM_ADMIN", { authMethod: "local" }))],
    ["a PLATFORM_ADMIN without phishing-resistant MFA", () => tokenFor(platformSession(ids.platformAdmin, "PLATFORM_ADMIN", { assurance: "mfa" }))],
    ["a revoked platform session", () => tokenFor(platformSession(ids.platformAdmin, "PLATFORM_ADMIN", { revokedAt: new Date() }))],
    ["an expired platform session", () => tokenFor(platformSession(ids.platformAdmin, "PLATFORM_ADMIN", { expiresAt: new Date(Date.now() - 1000) }))],
    ["a suspended PLATFORM_ADMIN", () => tokenFor(platformSession(ids.platformAdmin, "PLATFORM_ADMIN", {}, { status: "SUSPENDED" }))],
    ["a session from before an auth-epoch bump", () => tokenFor(platformSession(ids.platformAdmin, "PLATFORM_ADMIN", {}, { authEpoch: 2 }))],
  ])("%s", async (_label, token) => {
    const res = await approve(SERVER_ID, token());
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: { code: "PLATFORM_AUTH_REQUIRED" } });
    expect(db.connects).toBe(0);
    expectNothingCommitted();
  });

  it("a tenant session token sent as a Bearer header is not accepted", async () => {
    const token = tokenFor(platformSession(ids.superAdmin, "SUPER_ADMIN", { audience: "TENANT" }));
    const res = await fetch(`${baseUrl}/api/v1/platform/mcp-servers/${SERVER_ID}/approve`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    expect(db.connects).toBe(0);
  });

  it.each([
    ["older than 15 minutes", { authTime: new Date(Date.now() - 16 * 60_000) }],
    ["missing", { authTime: null }],
  ])("platform session authentication %s: 403 STEP_UP_REQUIRED, no transaction", async (_label, overrides) => {
    const res = await approve(SERVER_ID, tokenFor(platformSession(ids.platformAdmin, "PLATFORM_ADMIN", overrides)));
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: "STEP_UP_REQUIRED" });
    expect(db.connects).toBe(0);
    expectNothingCommitted();
  });
});

describe("server, project and transition checks (rolled back, nothing committed)", () => {
  it("malformed server id: 404 without opening a transaction", async () => {
    const res = await approve("not-a-uuid", admin());
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "MCP_SERVER_NOT_FOUND" });
    expect(db.connects).toBe(0);
  });

  it.each([
    ["unknown server", null, 404, "MCP_SERVER_NOT_FOUND"],
    ["disabled server", { isEnabled: false }, 409, "MCP_SERVER_DISABLED"],
    ["already VERIFIED", { trustLevel: "VERIFIED" }, 409, "MCP_SERVER_ALREADY_APPROVED"],
    ["already TRUSTED", { trustLevel: "TRUSTED" }, 409, "MCP_SERVER_ALREADY_APPROVED"],
    ["unrecognised trust level", { trustLevel: "SOMETHING_ELSE" }, 409, "MCP_TRUST_TRANSITION_INVALID"],
    ["server without a project", { projectId: null }, 409, "MCP_SERVER_PROJECT_REQUIRED"],
    ["server on a deleted project", { projectId: ids.deletedProject }, 404, "NOT_FOUND"],
    ["server on a missing project", { projectId: "88888888-8888-4888-8888-888888888888" }, 404, "NOT_FOUND"],
    ["admin registered the server", { userId: ids.platformAdmin }, 403, "SEPARATION_OF_DUTIES"],
  ])("%s: %i %s", async (_label, overrides, status, code) => {
    if (overrides === null) db.servers.delete(SERVER_ID); else db.servers.set(SERVER_ID, untrusted(overrides));
    const before = db.servers.get(SERVER_ID)?.trustLevel;
    const res = await approve(SERVER_ID, admin());
    expect(res.status).toBe(status);
    expect(res.body).toMatchObject({ success: false, code });
    expect(db.rollbacks).toBe(1);
    expect(db.commits).toBe(0);
    expect(db.audits).toEqual([]);
    expect(db.servers.get(SERVER_ID)?.trustLevel).toBe(before);
    expect(db.releases).toBe(db.connects);
  });

  it("admin who owns the server's project: 403 SEPARATION_OF_DUTIES", async () => {
    db.projects.get(ids.project).ownerId = ids.platformAdmin;
    const res = await approve(SERVER_ID, admin());
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "SEPARATION_OF_DUTIES" });
    expect(db.rollbacks).toBe(1);
    expectNothingCommitted();
  });

  it("endpoint that no longer satisfies the egress policy: 400, rolled back", async () => {
    const { AppError } = await import("../../utils/app-error.js");
    h.resolveSafeDestination.mockRejectedValue(new AppError("Private destinations are not allowed", 400, "EGRESS_DESTINATION_BLOCKED"));
    const res = await approve(SERVER_ID, admin());
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "EGRESS_DESTINATION_BLOCKED" });
    expect(db.rollbacks).toBe(1);
    expectNothingCommitted();
  });
});

describe("atomicity: failures roll back and approvals succeed exactly once", () => {
  it("failed trust update: 500, rolled back, no audit entry, server stays UNTRUSTED", async () => {
    db.faults.update = new Error("update failed");
    const res = await approve(SERVER_ID, admin());
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false });
    expect(res.body).not.toHaveProperty("server");
    expect(db.rollbacks).toBe(1);
    expect(db.servers.get(SERVER_ID).trustLevel).toBe("UNTRUSTED");
    expectNothingCommitted();
  });

  it("failed audit insert: 500, the staged trust update is rolled back", async () => {
    db.faults.audit = new Error("audit insert failed");
    const res = await approve(SERVER_ID, admin());
    expect(res.status).toBe(500);
    expect(db.statements.some((s) => s.sql.startsWith("UPDATE forge_mcp_servers"))).toBe(true);
    expect(db.rollbacks).toBe(1);
    expect(db.servers.get(SERVER_ID).trustLevel).toBe("UNTRUSTED");
    expectNothingCommitted();
  });

  it("conditional update matching no row (state changed underneath): 409, rolled back, no audit", async () => {
    db.faults.updateRowCount = 0;
    const res = await approve(SERVER_ID, admin());
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "MCP_SERVER_ALREADY_APPROVED" });
    expect(db.rollbacks).toBe(1);
    expectNothingCommitted();
  });

  it("concurrent approvals by two administrators: exactly one succeeds, one audit entry", async () => {
    // Hold the first transaction's row lock until the second request is waiting on it.
    let releaseFirst!: () => void;
    const firstHolding = new Promise<void>((r) => { releaseFirst = r; });
    let lockGrants = 0;
    db.afterLock = async () => { if (++lockGrants === 1) await firstHolding; };

    const first = approve(SERVER_ID, admin());
    const second = approve(SERVER_ID, tokenFor(platformSession(ids.superAdmin, "SUPER_ADMIN")));
    await vi.waitFor(() => expect(db.connects).toBe(2));
    await vi.waitFor(() => expect(db.statements.filter((s) => s.sql.includes("FOR UPDATE")).length).toBe(2));
    releaseFirst();
    const results = await Promise.all([first, second]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body).toMatchObject({ code: "MCP_SERVER_ALREADY_APPROVED" });
    expect(db.audits).toHaveLength(1);
    expect(db.commits).toBe(1);
    expect(db.rollbacks).toBe(1);
    expect(db.servers.get(SERVER_ID).trustLevel).toBe("VERIFIED");
    expect(db.releases).toBe(db.connects);
  });

  it.each([5, 20])("%i simultaneous approvals: exactly one success and one audit entry", async (n) => {
    const tokens = Array.from({ length: n }, (_, i) => tokenFor(platformSession(crypto.randomUUID(), i % 2 ? "SUPER_ADMIN" : "PLATFORM_ADMIN")));
    const results = await Promise.all(tokens.map((t) => approve(SERVER_ID, t)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(n - 1);
    expect(db.audits).toHaveLength(1);
    expect(db.commits).toBe(1);
    expect(db.releases).toBe(db.connects);
  });
});

describe("approved servers are invocable with the existing contract", () => {
  it("UNTRUSTED is refused, then after approval the remote result is returned unchanged", async () => {
    const ctx = { projectId: ids.project, userId: ids.owner };
    await expect(mcpClientService.invokeTool(SERVER_ID, "search", { q: "x" }, ctx)).rejects.toMatchObject({ code: "UNTRUSTED_MCP_SERVER" });
    expect(h.safeEgressRequest).not.toHaveBeenCalled();

    const res = await approve(SERVER_ID, admin());
    expect(res.status).toBe(200);

    const remote = { isError: false, content: [{ type: "text", text: "remote result" }] };
    h.safeEgressRequest.mockResolvedValue({ status: 200, headers: {}, body: Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: 1, result: remote })) });
    await expect(mcpClientService.invokeTool(SERVER_ID, "search", { q: "x" }, ctx)).resolves.toEqual(remote);
    expect(h.safeEgressRequest).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      url: "https://mcp.example.com/rpc", method: "POST", allowedPorts: [443],
    }));
  });

  it("a failed (rolled-back) approval leaves the server uninvocable", async () => {
    db.faults.audit = new Error("audit insert failed");
    await approve(SERVER_ID, admin());
    await expect(mcpClientService.invokeTool(SERVER_ID, "search", {}, { projectId: ids.project })).rejects.toMatchObject({
      code: "UNTRUSTED_MCP_SERVER",
    });
    expect(h.safeEgressRequest).not.toHaveBeenCalled();
  });

  it("approval does not let another project invoke the server", async () => {
    await approve(SERVER_ID, admin());
    await expect(mcpClientService.invokeTool(SERVER_ID, "search", {}, { projectId: ids.deletedProject })).rejects.toMatchObject({
      code: "MCP_SERVER_NOT_FOUND",
    });
    expect(h.safeEgressRequest).not.toHaveBeenCalled();
  });
});
