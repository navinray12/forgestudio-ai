/**
 * Independent acceptance of a generated full-stack package (blueprint §38, §40, §44, §45;
 * FS21-AT-GEN-03, GEN-04, GEN-05, GEN-06, GEN-07, GEN-08, DAT concurrency/migration checks).
 *
 * The package comes from the APPROVED_TEMPLATE path (deterministic, no AI provider), so this proves
 * the generated application's behavior, not a live provider call (GEN-01 is separate).
 *
 * Flow: generate through AppGenerationService -> export the persisted files -> npm install
 * (--ignore-scripts) and build in a temp directory -> migrate into a disposable schema of
 * forge_hardening -> run the API as a separate process with a scrubbed environment -> verify every
 * effect independently with SQL. Generated code is never imported into this process; the
 * generated client/controller run in their own child process.
 *
 * Run with:
 *   FORGE_DISPOSABLE_TEST_DB=1 FORGE_GENERATED_APP_E2E=1 \
 *   DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/generated-app.acceptance.test.ts
 * Needs network access to the npm registry for the install step.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID, createHmac, randomBytes } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  process.env.FORGE_GENERATED_APP_E2E === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

const isWindows = process.platform === "win32";

describe.skipIf(!optedIn)("Generated application acceptance (separate process, disposable schema)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const { createForgeProject } = await import("../services/project/forgeProject.service.js");
  const fs = await import("../services/project/forgeFilesystem.service.js");
  const { AppGenerationService } = await import("../services/appGeneration/appGeneration.service.js");

  const marker = randomUUID().slice(0, 8);
  const schema = `genapp_${marker}`;
  const secret = randomBytes(32).toString("hex");
  const users: Record<"owner", { id: string }> = {} as any;
  let projectId = "";
  let workdir = "";
  let appDir = "";
  let port = 0;
  let server: ChildProcess | null = null;
  const evidence: Record<string, unknown> = {};

  /** Only what the generated app needs; no platform secrets or provider keys reach it. */
  function childEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
    const keep = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "ComSpec", "PATHEXT"];
    const env: NodeJS.ProcessEnv = {};
    for (const key of keep) if (process.env[key] !== undefined) env[key] = process.env[key];
    return { ...env, ...extra };
  }

  function appDatabaseUrl(): string {
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    return url.toString();
  }

  function run(command: string, args: string[], env: NodeJS.ProcessEnv, timeout = 300_000) {
    const result = spawnSync(command, args, { cwd: appDir, env, shell: isWindows, encoding: "utf8", timeout });
    return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
  }

  async function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once("error", reject);
      probe.listen(0, "127.0.0.1", () => {
        const { port: p } = probe.address() as { port: number };
        probe.close(() => resolve(p));
      });
    });
  }

  /** Independent token minting: the harness signs tokens itself rather than calling generated code. */
  function token(sub: string, tenantId: string, key = secret): string {
    const body = Buffer.from(JSON.stringify({ sub, tenantId, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
  }

  async function startServer(databaseUrl: string): Promise<void> {
    server = spawn(process.execPath, ["dist/server/main.js"], {
      cwd: appDir,
      env: childEnv({ DATABASE_URL: databaseUrl, APP_AUTH_SECRET: secret, PORT: String(port) }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    server.stdout?.on("data", (d) => (log += d));
    server.stderr?.on("data", (d) => (log += d));
    for (let i = 0; i < 100; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (res.status === 200 || res.status === 503) return;
      } catch {
        // not listening yet
      }
      if (server.exitCode !== null) throw new Error(`generated server exited: ${log}`);
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`generated server did not start: ${log}`);
  }

  async function stopServer(): Promise<void> {
    if (!server || server.exitCode !== null) return;
    const exited = new Promise((r) => server!.once("exit", r));
    server.kill();
    await exited;
    server = null;
  }

  async function api(method: string, route: string, opts: { token?: string; body?: unknown; revision?: number; key?: string } = {}) {
    const headers: Record<string, string> = {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.revision !== undefined) headers["If-Match"] = String(opts.revision);
    if (opts.key) headers["Idempotency-Key"] = opts.key;
    const res = await fetch(`http://127.0.0.1:${port}${route}`, {
      method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  }

  /** Runs the generated browser client + view controller in a separate Node process. */
  function runGeneratedClient(script: string): any {
    const file = path.join(appDir, `drive-${randomUUID().slice(0, 6)}.mjs`);
    writeFileSync(file, script);
    const result = spawnSync(process.execPath, [file], { cwd: appDir, env: childEnv({}), encoding: "utf8", timeout: 60_000 });
    rmSync(file, { force: true });
    if (result.status !== 0) throw new Error(`client driver failed: ${result.stderr}`);
    return JSON.parse(result.stdout.trim().split("\n").pop()!);
  }

  const q = async (sql: string, params: unknown[] = []) => (await pgPool.query(sql, params)).rows;

  beforeAll(async () => {
    await ensureDatabaseTables();
    users.owner = await prisma.user.create({
      data: { fullName: "GenApp owner", email: `genapp-owner-${marker}@example.test`, status: "ACTIVE" },
    });
    const project = await createForgeProject({ name: `GenApp ${marker}`, ownerId: users.owner.id } as any);
    projectId = project.id;

    // 1. Generate through the product service (approved template; no AI provider).
    const service = new AppGenerationService({ providerFactory: () => { throw new Error("provider must not be called"); }, filesystem: fs });
    const { run: created } = await service.createRun({
      projectId, tenantId: users.owner.id, requestedById: users.owner.id, mode: "APPROVED_TEMPLATE", templateId: "task-tracker",
    });
    let generation: any = null;
    for (let i = 0; i < 400; i++) {
      generation = await service.getRun(projectId, created.id);
      if (generation.status === "SOURCE_WRITTEN" || generation.status === "FAILED") break;
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(generation.status).toBe("SOURCE_WRITTEN");
    evidence.generationRunId = generation.id;

    // 2. Export exactly what the platform persisted.
    workdir = mkdtempSync(path.join(tmpdir(), "forge-genapp-"));
    const stored = (await fs.listFiles(projectId)).filter((f: any) => !f.isDirectory && f.path.startsWith("forge-app/"));
    expect(stored.length).toBe(generation.files.length);
    for (const entry of stored) {
      const file = await fs.readFile(projectId, entry.path);
      const target = path.join(workdir, entry.path);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, file.content);
    }
    appDir = path.join(workdir, "forge-app");
    port = await freePort();
    await pgPool.query(`CREATE SCHEMA "${schema}"`);
  }, 120_000);

  afterAll(async () => {
    await stopServer();
    await pgPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    if (projectId) await pgPool.query(`DELETE FROM forge_projects WHERE id = $1`, [projectId]).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: { endsWith: `-${marker}@example.test` } } }).catch(() => undefined);
    if (workdir) rmSync(workdir, { recursive: true, force: true });
    console.log("[generated-app acceptance evidence]", JSON.stringify(evidence));
    await prisma.$disconnect();
    await pgPool.end();
  });

  it("GEN-03: installs with scripts disabled and builds the API, client and web frontend", () => {
    const env = childEnv({ npm_config_ignore_scripts: "true" });
    const install = run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], env, 600_000);
    expect(install.status, install.output).toBe(0);
    const build = run("npm", ["run", "build"], env);
    expect(build.status, build.output).toBe(0);
    for (const output of ["dist/server/main.js", "dist/server/task.routes.js", "dist/server/migrate.js", "dist/client/api.js", "dist/web/main.js", "dist/web/controller.js"]) {
      expect(spawnSync(process.execPath, ["-e", `require("fs").accessSync(${JSON.stringify(output)})`], { cwd: appDir }).status, output).toBe(0);
    }
    // The candidate's own tests are recorded but are not acceptance evidence (GEN-14).
    const selfTest = run("npm", ["test"], env);
    evidence.candidateSelfTestExit = selfTest.status;
  }, 900_000);

  it("migrates through its single migration authority, is idempotent and refuses checksum drift", async () => {
    const env = childEnv({ DATABASE_URL: appDatabaseUrl() });
    const first = run("npm", ["run", "migrate"], env);
    expect(first.status, first.output).toBe(0);
    expect(first.output).toContain("applied 0001_initial.sql");

    const tables = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY 1`, [schema])).map((r) => r.table_name);
    expect(tables).toEqual(["app_audit_log", "app_command_receipts", "app_outbox", "app_schema_migrations", "projects", "tasks"]);
    const fks = await q(`SELECT conname FROM pg_constraint WHERE connamespace = $1::regnamespace AND contype = 'f'`, [schema]);
    expect(fks.map((r) => r.conname)).toEqual(["fk_tasks_projectId"]);
    expect(await q(`SELECT count(*)::int AS n FROM "${schema}".tasks`)).toEqual([{ n: 0 }]);

    const again = run("npm", ["run", "migrate"], env);
    expect(again.status, again.output).toBe(0);
    expect(again.output).not.toContain("applied");

    const [{ checksum }] = await q(`SELECT checksum FROM "${schema}".app_schema_migrations WHERE name = '0001_initial.sql'`);
    await q(`UPDATE "${schema}".app_schema_migrations SET checksum = 'tampered' WHERE name = '0001_initial.sql'`);
    const drift = run("npm", ["run", "migrate"], env);
    expect(drift.status).not.toBe(0);
    expect(drift.output).toContain("checksum drift");
    await q(`UPDATE "${schema}".app_schema_migrations SET checksum = $1 WHERE name = '0001_initial.sql'`, [checksum]);
  }, 300_000);

  const tenantA = `tenant-a-${marker}`;
  const tenantB = `tenant-b-${marker}`;
  const nonce = `Accept ${randomUUID()}`;
  let projectA: any;
  let task: any;

  it("refuses unauthenticated and forged requests", async () => {
    await startServer(appDatabaseUrl());
    expect((await api("GET", "/api/tasks")).status).toBe(401);
    expect((await api("GET", "/api/tasks", { token: token("alice", tenantA, "x".repeat(64)) })).status).toBe(401);
    const page = await fetch(`http://127.0.0.1:${port}/`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('src="/web/main.js"');
  }, 60_000);

  it("GEN-04: the generated client creates a uniquely tagged task that an independent observer finds", async () => {
    const created = await api("POST", "/api/projects", { token: token("alice", tenantA), body: { name: `Project ${marker}` } });
    expect(created.status).toBe(201);
    projectA = created.body.data;

    const result = runGeneratedClient(`
      import { createClient } from "./dist/client/api.js";
      import { ResourceController } from "./dist/web/controller.js";
      const client = createClient({ baseUrl: "http://127.0.0.1:${port}", getToken: () => ${JSON.stringify(token("alice", tenantA))} });
      const controller = new ResourceController(client.tasks);
      await controller.load();
      const before = controller.state.status;
      const record = await controller.create({ title: ${JSON.stringify(nonce)}, projectId: ${JSON.stringify(projectA.id)} });
      console.log(JSON.stringify({ before, after: controller.state.status, record, count: controller.state.records.length }));
    `);
    expect(result.before).toBe("empty");
    expect(result.after).toBe("ready");
    expect(result.record).toMatchObject({ title: nonce, projectId: projectA.id, status: "OPEN", revision: 1 });
    expect(result.record).not.toHaveProperty("tenantId");
    expect(result.record).not.toHaveProperty("deletedAt");
    task = result.record;

    const rows = await q(`SELECT * FROM "${schema}".tasks WHERE title = $1`, [nonce]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: task.id, tenantId: tenantA, projectId: projectA.id, status: "OPEN", revision: 1, deletedAt: null });
    const events = await q(`SELECT "eventType", "tenantId", "actorId" FROM "${schema}".app_outbox WHERE "aggregateId" = $1`, [task.id]);
    expect(events).toEqual([{ eventType: "Task.created", tenantId: tenantA, actorId: "alice" }]);
    evidence.task = { id: task.id, nonce };
  }, 60_000);

  it("GEN-08: another tenant cannot read, change or reference tenant A's records by ID", async () => {
    const bob = token("bob", tenantB);
    expect((await api("GET", `/api/tasks/${task.id}`, { token: bob })).status).toBe(404);
    expect((await api("PATCH", `/api/tasks/${task.id}`, { token: bob, revision: 1, body: { title: "hijack" } })).status).toBe(404);
    expect((await api("POST", `/api/tasks/${task.id}/commands/complete`, { token: bob, revision: 1, body: { completionNote: "x" } })).status).toBe(404);
    expect((await api("GET", "/api/tasks", { token: bob })).body.data).toEqual([]);
    const crossReference = await api("POST", "/api/tasks", { token: bob, body: { title: "x", projectId: projectA.id } });
    expect(crossReference.status).toBe(422);
    expect(crossReference.body.code).toBe("INVALID_REFERENCE");
    const tenantInBody = await api("POST", "/api/projects", { token: bob, body: { name: "x", tenantId: tenantA } });
    expect(tenantInBody.status).toBe(422);

    // Even a direct insert bypassing the API cannot point at another tenant's project.
    await expect(pgPool.query(
      `INSERT INTO "${schema}".tasks ("tenantId", title, "projectId") VALUES ($1, 'raw', $2)`, [tenantB, projectA.id],
    )).rejects.toMatchObject({ code: "23503" });
    expect(await q(`SELECT title, revision FROM "${schema}".tasks WHERE id = $1`, [task.id])).toEqual([{ title: nonce, revision: 1 }]);
  }, 60_000);

  it("GEN-07: completion is a guarded command with evidence, audit, outbox and idempotency", async () => {
    const alice = token("alice", tenantA);
    const statusPatch = await api("PATCH", `/api/tasks/${task.id}`, { token: alice, revision: 1, body: { status: "DONE" } });
    expect(statusPatch.status).toBe(422);
    const noRevision = await api("POST", `/api/tasks/${task.id}/commands/complete`, { token: alice, body: { completionNote: "done" } });
    expect(noRevision.status).toBe(428);
    const noEvidence = await api("POST", `/api/tasks/${task.id}/commands/complete`, { token: alice, revision: 1, body: {} });
    expect(noEvidence.status).toBe(422);
    const invalid = await api("POST", `/api/tasks/${task.id}/commands/reopen`, { token: alice, revision: 1 });
    expect(invalid.status).toBe(409);
    expect(invalid.body).toMatchObject({ code: "INVALID_TRANSITION", state: "OPEN" });
    const stale = await api("POST", `/api/tasks/${task.id}/commands/complete`, { token: alice, revision: 7, body: { completionNote: "done" } });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: "REVISION_CONFLICT", currentRevision: 1 });
    expect(await q(`SELECT count(*)::int AS n FROM "${schema}".app_audit_log`)).toEqual([{ n: 0 }]);

    const key = `complete-${marker}`;
    const done = await api("POST", `/api/tasks/${task.id}/commands/complete`, { token: alice, revision: 1, key, body: { completionNote: "Shipped" } });
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ status: "DONE", completionNote: "Shipped", revision: 2 });

    const replay = await api("POST", `/api/tasks/${task.id}/commands/complete`, { token: alice, revision: 1, key, body: { completionNote: "Shipped" } });
    expect(replay.status).toBe(200);
    expect(replay.headers.get("idempotent-replay")).toBe("true");
    expect(replay.body.data.revision).toBe(2);
    const reused = await api("POST", `/api/tasks/${task.id}/commands/complete`, { token: alice, revision: 1, key, body: { completionNote: "Different" } });
    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe("IDEMPOTENCY_CONFLICT");

    expect(await q(`SELECT status, "completionNote", revision FROM "${schema}".tasks WHERE id = $1`, [task.id]))
      .toEqual([{ status: "DONE", completionNote: "Shipped", revision: 2 }]);
    expect(await q(`SELECT "actorId", command, "fromState", "toState", revision FROM "${schema}".app_audit_log WHERE "recordId" = $1`, [task.id]))
      .toEqual([{ actorId: "alice", command: "complete", fromState: "OPEN", toState: "DONE", revision: 2 }]);
    expect((await q(`SELECT "eventType" FROM "${schema}".app_outbox WHERE "aggregateId" = $1 ORDER BY "createdAt"`, [task.id])).map((r) => r.eventType))
      .toEqual(["Task.created", "Task.complete"]);
  }, 60_000);

  it("rejects one of two concurrent edits made against the same revision", async () => {
    const alice = token("alice", tenantA);
    const results = await Promise.all(["Edit one", "Edit two"].map((title) =>
      api("PATCH", `/api/projects/${projectA.id}`, { token: alice, revision: 1, body: { name: title } })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await q(`SELECT revision FROM "${schema}".projects WHERE id = $1`, [projectA.id])).toEqual([{ revision: 2 }]);
  }, 60_000);

  it("GEN-05: the task survives a full API restart and is read back in a new session", async () => {
    await stopServer();
    await startServer(appDatabaseUrl());
    const fresh = token("alice-second-session", tenantA);
    const read = await api("GET", `/api/tasks/${task.id}`, { token: fresh });
    expect(read.status).toBe(200);
    expect(read.body.data).toMatchObject({ id: task.id, title: nonce, status: "DONE", revision: 2 });
  }, 60_000);

  it("GEN-06: with the database unreachable nothing is reported as saved and the UI keeps a retryable failure", async () => {
    await stopServer();
    const unreachable = new URL(appDatabaseUrl());
    unreachable.port = String(await freePort());
    await startServer(unreachable.toString());

    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(health.status).toBe(503);
    const outageTitle = `Outage ${randomUUID()}`;
    const attempt = await api("POST", "/api/tasks", { token: token("alice", tenantA), body: { title: outageTitle, projectId: projectA.id } });
    expect(attempt.status).toBe(503);
    expect(attempt.body).toMatchObject({ code: "DB_UNAVAILABLE", retryable: true });

    const ui = runGeneratedClient(`
      import { createClient } from "./dist/client/api.js";
      import { ResourceController } from "./dist/web/controller.js";
      const client = createClient({ baseUrl: "http://127.0.0.1:${port}", getToken: () => ${JSON.stringify(token("alice", tenantA))} });
      const controller = new ResourceController(client.tasks);
      const record = await controller.create({ title: ${JSON.stringify(outageTitle)}, projectId: ${JSON.stringify(projectA.id)} });
      console.log(JSON.stringify({ record, state: controller.state }));
    `);
    expect(ui.record).toBeNull();
    expect(ui.state).toMatchObject({ status: "failed", retryable: true, records: [] });
    expect(ui.state.pending.input.title).toBe(outageTitle);
    expect(await q(`SELECT count(*)::int AS n FROM "${schema}".tasks WHERE title = $1`, [outageTitle])).toEqual([{ n: 0 }]);
    await stopServer();
  }, 60_000);
});
