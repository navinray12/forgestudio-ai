/**
 * Persistent environment bindings (blueprint §42.1, WP-17) on real PostgreSQL through the real app:
 * restart durability, tenant isolation, duplicates and concurrency, secret-reference protection,
 * production step-up, lifecycle, no-fallback lookups and store failure.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/environment-bindings.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

describe.skipIf(!optedIn)("Environment binding persistence (real app, disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const { createForgeProject } = await import("../services/project/forgeProject.service.js");
  const bindings = await import("../services/environment/environmentBinding.service.js");
  const { default: app } = await import("../app.js");

  const marker = randomUUID().slice(0, 8);
  const tokens: Record<string, string> = {};
  const ids: Record<"owner" | "wsAdmin" | "wsMember" | "outsider", string> = {} as any;
  let workspaceId = "";
  let projectA = ""; // owner's project, in a workspace
  let projectB = ""; // outsider's project
  let server: Server;
  let base = "";

  async function api(method: string, route: string, who: string | null, body?: unknown) {
    const res = await fetch(`${base}/api/projects${route}`, {
      method,
      headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: res.status, json, text };
  }
  const code = (r: { json: any }) => r.json?.code ?? r.json?.error?.code;
  const q = async (sql: string, params: unknown[] = []) => (await pgPool.query(sql, params)).rows;
  const SECRET = `vault:keys:${marker}:dev_db_primary`;

  async function session(name: string, userId: string, authTime: Date) {
    const token = `bind-${name}-${randomUUID()}`;
    await prisma.session.create({
      data: {
        userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000),
        authEpoch: 1, audience: "TENANT", authTime, authMethod: "local", lastUsedAt: new Date(),
      },
    });
    tokens[name] = token;
  }

  beforeAll(async () => {
    await ensureDatabaseTables();
    for (const role of ["owner", "wsAdmin", "wsMember", "outsider"] as const) {
      const user = await prisma.user.create({
        data: { fullName: `Bind ${role}`, email: `bind-${role}-${marker}@example.test`, status: "ACTIVE", authEpoch: 1 } as any,
      });
      ids[role] = user.id;
      await session(role, user.id, new Date(Date.now() - 1000));
    }
    await session("owner-stale", ids.owner, new Date(Date.now() - 60 * 60 * 1000));
    // The database requires a workspace to be created together with its OWNER member.
    workspaceId = (await prisma.workspace.create({
      data: {
        name: `Bind ${marker}`, slug: `bind-${marker}`, ownerId: ids.owner,
        members: { create: [{ userId: ids.owner, role: "OWNER" }, { userId: ids.wsAdmin, role: "ADMIN" }, { userId: ids.wsMember, role: "MEMBER" }] },
      },
    })).id;
    projectA = (await createForgeProject({ name: `Bind A ${marker}`, ownerId: ids.owner, workspaceId } as any)).id;
    projectB = (await createForgeProject({ name: `Bind B ${marker}`, ownerId: ids.outsider } as any)).id;
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    if (server) await new Promise((r) => server.close(r));
    await pgPool.query(`DELETE FROM forge_projects WHERE id = ANY($1::uuid[])`, [[projectA, projectB].filter(Boolean)]).catch(() => undefined);
    if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  });

  it("never resolves an unregistered environment, creates nothing on lookup and has no default", async () => {
    expect((await api("GET", `/${projectA}/environment/bindings?environment=DEVELOPMENT`, null)).status).toBe(401);
    expect(code(await api("GET", `/${projectA}/environment/bindings`, "owner"))).toBe("MISSING_ENVIRONMENT");
    expect(code(await api("GET", `/${projectA}/environment/bindings?environment=prod`, "owner"))).toBe("INVALID_ENVIRONMENT");
    expect(code(await api("GET", `/${projectA}/environment/bindings?environment=DEVELOPMENT`, "owner"))).toBe("BINDING_NOT_FOUND");
    expect(code(await api("POST", `/${projectA}/environment/pools/resolve`, "owner", { roleType: "runtime" }))).toBe("MISSING_ENVIRONMENT");
    expect(code(await api("POST", `/${projectA}/environment/pools/resolve`, "owner", { environment: "PRODUCTION" }))).toBe("BINDING_NOT_FOUND");
    expect(await q(`SELECT count(*)::int AS n FROM forge_environment_bindings WHERE "projectId" = $1`, [projectA])).toEqual([{ n: 0 }]);
  });

  it("registers a binding for authorized administrators only and never returns or logs the secret reference", async () => {
    const route = `/${projectA}/environment/bindings/DEVELOPMENT`;
    expect((await api("PUT", route, null, { secretRef: SECRET })).status).toBe(401);
    expect((await api("PUT", route, "outsider", { secretRef: SECRET })).status).toBe(403);
    expect((await api("PUT", route, "wsMember", { secretRef: SECRET })).status).toBe(403);
    expect(code(await api("PUT", route, "owner", {}))).toBe("INVALID_SECRET_REF");
    expect(code(await api("PUT", route, "owner", { secretRef: "postgres://app:hunter2@db.internal:5432/app" }))).toBe("RAW_CREDENTIALS_FORBIDDEN");
    expect(code(await api("PUT", route, "owner", { secretRef: SECRET, roles: { runtimeRole: "app; DROP ROLE x" } }))).toBe("INVALID_ROLE_NAME");
    expect(await q(`SELECT count(*)::int AS n FROM forge_environment_bindings WHERE "projectId" = $1`, [projectA])).toEqual([{ n: 0 }]);

    const logged: string[] = [];
    const spies = (["log", "warn", "error", "info"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { logged.push(args.map(String).join(" ")); }));
    const created = await api("PUT", route, "wsAdmin", { secretRef: SECRET, roles: { runtimeRole: "tracker_runtime" } });
    const read = await api("GET", `/${projectA}/environment/bindings?environment=development`, "wsMember");
    const listed = await api("GET", `/${projectA}/environment/bindings/list`, "wsMember");
    spies.forEach((spy) => spy.mockRestore());

    expect(created.status).toBe(201);
    expect(created.json.binding).toMatchObject({
      version: 1, environmentClass: "DEVELOPMENT", protectionLevel: "SANDBOX", status: "ACTIVE", secretRefMasked: true,
      roles: { runtimeRole: "tracker_runtime", inspectionRole: "app_development_readonly", migratorRole: "app_development_migrator" },
      poolLimits: { min: 2, max: 10, idleTimeoutMs: 10000, connectionTimeoutMs: 5000 },
      verificationHistory: [],
    });
    expect(read.status).toBe(200);
    for (const text of [created.text, read.text, listed.text, ...logged]) expect(text.includes(SECRET)).toBe(false);

    // Stored once, with the reference; the audit trail identifies the version by fingerprint only.
    const [row] = await q(`SELECT "secretRef", "createdById", version FROM forge_environment_bindings WHERE "projectId" = $1`, [projectA]);
    expect(row).toEqual({ secretRef: SECRET, createdById: ids.wsAdmin, version: 1 });
    const audit = await prisma.auditLog.findFirst({ where: { action: "ENVIRONMENT_BINDING_REGISTERED", targetResource: `forge_project:${projectA}` } });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit).includes(SECRET)).toBe(false);
  });

  it("survives a restart: a new process reads the same binding from PostgreSQL", async () => {
    const script = path.join(process.cwd(), `.binding-probe-${marker}.ts`);
    writeFileSync(script, `
      import { environmentBindingService } from "./src/services/environment/environmentBinding.service.ts";
      import { prisma, pgPool } from "./src/config/prisma.ts";
      const b = await environmentBindingService.getBinding(${JSON.stringify(projectA)}, "DEVELOPMENT");
      console.log("PROBE" + JSON.stringify({ version: b.version, bindingId: b.bindingId, secretRef: b.secretRef, runtimeRole: b.roles.runtimeRole, pid: process.pid }));
      await prisma.$disconnect(); await pgPool.end();
    `);
    try {
      const out = execFileSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), script], { encoding: "utf8", env: process.env });
      const probe = JSON.parse(out.split("PROBE")[1].split("\n")[0]);
      expect(probe.pid).not.toBe(process.pid);
      expect(probe).toMatchObject({ version: 1, bindingId: `bind_${projectA}_development`, secretRef: SECRET, runtimeRole: "tracker_runtime" });
    } finally {
      rmSync(script, { force: true });
    }
  }, 60_000);

  it("isolates projects: another tenant cannot read, change or retire the binding", async () => {
    for (const [method, route, body] of [
      ["GET", `/${projectA}/environment/bindings?environment=DEVELOPMENT`, undefined],
      ["GET", `/${projectA}/environment/bindings/list`, undefined],
      ["PUT", `/${projectA}/environment/bindings/DEVELOPMENT`, { secretRef: "vault:keys:attacker" }],
      ["DELETE", `/${projectA}/environment/bindings/DEVELOPMENT`, undefined],
      ["POST", `/${projectA}/environment/pools/resolve`, { environment: "DEVELOPMENT" }],
    ] as const) {
      expect((await api(method, route, "outsider", body)).status, `${method} ${route}`).toBe(403);
    }
    // The outsider's own project has no binding, and registering one does not touch project A.
    expect(code(await api("GET", `/${projectB}/environment/bindings?environment=DEVELOPMENT`, "outsider"))).toBe("BINDING_NOT_FOUND");
    expect((await api("PUT", `/${projectB}/environment/bindings/DEVELOPMENT`, "outsider", { secretRef: "vault:keys:b" })).status).toBe(201);
    expect((await api("GET", `/${projectB}/environment/bindings?environment=DEVELOPMENT`, "owner")).status).toBe(403);
    expect(await q(`SELECT "secretRef", version FROM forge_environment_bindings WHERE "projectId" = $1`, [projectA])).toEqual([{ secretRef: SECRET, version: 1 }]);
  });

  it("keeps one binding per project and environment under concurrent and conflicting updates", async () => {
    const route = `/${projectA}/environment/bindings/STAGING`;
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => api("PUT", route, "owner", { secretRef: `vault:keys:${marker}:staging_${n}` })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(results.map((r) => r.json.binding.version).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(await q(`SELECT count(*)::int AS n, max(version)::int AS version FROM forge_environment_bindings WHERE "projectId" = $1 AND "environmentClass" = 'STAGING'`, [projectA]))
      .toEqual([{ n: 1, version: 5 }]);

    // Optimistic update: a stale version is refused and changes nothing.
    expect(code(await api("PUT", route, "owner", { secretRef: "vault:keys:stale", expectedVersion: 2 }))).toBe("BINDING_VERSION_CONFLICT");
    expect(code(await api("PUT", `/${projectA}/environment/bindings/DEVELOPMENT`, "owner", { secretRef: "vault:keys:dup", expectedVersion: 0 }))).toBe("BINDING_VERSION_CONFLICT");
    const updated = await api("PUT", route, "owner", { secretRef: `vault:keys:${marker}:staging_final`, expectedVersion: 5 });
    expect(updated.json.binding).toMatchObject({ version: 6, protectionLevel: "CONTROLLED_STAGING" });

    // The database refuses a second row and a credential-shaped reference even without the service.
    await expect(pgPool.query(
      `INSERT INTO forge_environment_bindings ("projectId", "environmentClass", "bindingId", "applicationId", "targetFingerprint", "safeDisplayLabel", "secretRef", roles, "poolLimits", "protectionLevel")
       VALUES ($1, 'STAGING', 'dup', 'app', repeat('0', 64), 'x', 'vault:keys:x', '{}', '{}', 'CONTROLLED_STAGING')`, [projectA])).rejects.toMatchObject({ code: "23505" });
    await expect(pgPool.query(
      `UPDATE forge_environment_bindings SET "secretRef" = 'postgres://app:hunter2@db:5432/app' WHERE "projectId" = $1 AND "environmentClass" = 'STAGING'`, [projectA]))
      .rejects.toMatchObject({ code: "23514" });
  });

  it("requires a recent sign-in for production changes and ignores a client-supplied step-up flag", async () => {
    const route = `/${projectA}/environment/bindings/PRODUCTION`;
    const body = { secretRef: `vault:keys:${marker}:prod_db`, stepUpVerified: true };
    expect(code(await api("PUT", route, "owner-stale", body))).toBe("STEP_UP_VERIFICATION_REQUIRED");
    expect(await q(`SELECT count(*)::int AS n FROM forge_environment_bindings WHERE "projectId" = $1 AND "environmentClass" = 'PRODUCTION'`, [projectA])).toEqual([{ n: 0 }]);

    const created = await api("PUT", route, "owner", { secretRef: body.secretRef });
    expect(created.status).toBe(201);
    expect(created.json.binding).toMatchObject({ protectionLevel: "RESTRICTED_PRODUCTION", poolLimits: { min: 5, max: 30 } });

    expect(code(await api("PUT", route, "owner-stale", { ...body, secretRef: "vault:keys:rotated" }))).toBe("STEP_UP_VERIFICATION_REQUIRED");
    expect(code(await api("DELETE", route, "owner-stale"))).toBe("STEP_UP_VERIFICATION_REQUIRED");
    expect(await q(`SELECT version, status, "secretRef" FROM forge_environment_bindings WHERE "projectId" = $1 AND "environmentClass" = 'PRODUCTION'`, [projectA]))
      .toEqual([{ version: 1, status: "ACTIVE", secretRef: body.secretRef }]);
    // A stale session may still work on non-production bindings.
    expect((await api("PUT", `/${projectA}/environment/bindings/DEVELOPMENT`, "owner-stale", { secretRef: SECRET })).status).toBe(200);
  });

  it("resolves pools by binding version and stops resolving a retired binding until it is registered again", async () => {
    const dev = await api("GET", `/${projectA}/environment/bindings?environment=DEVELOPMENT`, "owner");
    const pool = await api("POST", `/${projectA}/environment/pools/resolve`, "wsMember", { environment: "DEVELOPMENT", roleType: "migrator" });
    expect(pool.json.pool).toMatchObject({ version: dev.json.binding.version, role: "app_development_migrator", maxConnections: 10, status: "ACTIVE" });
    expect(code(await api("POST", `/${projectA}/environment/pools/resolve`, "owner", { environment: "DEVELOPMENT", roleType: "superuser" }))).toBe("INVALID_ROLE_TYPE");

    expect((await api("DELETE", `/${projectA}/environment/bindings/DEVELOPMENT`, "wsMember")).status).toBe(403);
    const retired = await api("DELETE", `/${projectA}/environment/bindings/DEVELOPMENT`, "owner");
    expect(retired.json.binding).toMatchObject({ status: "RETIRED", version: dev.json.binding.version + 1 });
    expect(code(await api("GET", `/${projectA}/environment/bindings?environment=DEVELOPMENT`, "owner"))).toBe("BINDING_NOT_FOUND");
    expect(code(await api("POST", `/${projectA}/environment/pools/resolve`, "owner", { environment: "DEVELOPMENT" }))).toBe("BINDING_NOT_FOUND");
    expect(code(await api("DELETE", `/${projectA}/environment/bindings/DEVELOPMENT`, "owner"))).toBe("BINDING_NOT_FOUND");
    // Retired, not deleted; other environments are unaffected and nothing falls back to them.
    expect((await api("GET", `/${projectA}/environment/bindings/list`, "owner")).json.bindings.map((b: any) => `${b.environmentClass}:${b.status}`))
      .toEqual(["DEVELOPMENT:RETIRED", "PRODUCTION:ACTIVE", "STAGING:ACTIVE"]);

    const again = await api("PUT", `/${projectA}/environment/bindings/DEVELOPMENT`, "owner", { secretRef: SECRET });
    expect(again.json.binding).toMatchObject({ status: "ACTIVE", version: dev.json.binding.version + 2, bindingId: dev.json.binding.bindingId });
  });

  it("fails without any fallback when the store is unavailable, and maps an unknown project to not found", async () => {
    const down = () => Promise.reject(Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" }));
    const service = new bindings.EnvironmentBindingService(new bindings.PostgresEnvironmentBindingStore({ query: down, connect: down } as any));
    const silenced = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(service.getBinding(projectA, "PRODUCTION")).rejects.toMatchObject({ statusCode: 503, code: "BINDING_STORE_UNAVAILABLE" });
      await expect(service.getBinding(projectA, "DEVELOPMENT")).rejects.toMatchObject({ code: "BINDING_STORE_UNAVAILABLE" });
      await expect(service.listBindings(projectA)).rejects.toMatchObject({ code: "BINDING_STORE_UNAVAILABLE" });
      await expect(service.registerBinding(projectA, "app", "DEVELOPMENT", { secretRef: SECRET })).rejects.toMatchObject({ code: "BINDING_STORE_UNAVAILABLE" });
      await expect(service.retireBinding(projectA, "STAGING")).rejects.toMatchObject({ code: "BINDING_STORE_UNAVAILABLE" });
      expect(silenced.mock.calls.flat().join(" ").includes(SECRET)).toBe(false);
    } finally {
      silenced.mockRestore();
    }

    const real = bindings.environmentBindingService;
    await expect(real.registerBinding(randomUUID(), "app", "DEVELOPMENT", { secretRef: SECRET })).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_NOT_FOUND" });
    await expect(real.registerBinding("not-a-uuid", "app", "DEVELOPMENT", { secretRef: SECRET })).rejects.toMatchObject({ code: "PROJECT_NOT_FOUND" });
    await expect(real.getBinding("not-a-uuid", "DEVELOPMENT")).rejects.toMatchObject({ code: "BINDING_NOT_FOUND" });
  });
});
