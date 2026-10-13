/**
 * Tenant row-level security, stage 1 (blueprint §18, WP-02/WP-19), against real PostgreSQL roles.
 *
 * Nothing here is mocked: the restricted roles are the real ones, sessions really switch to them,
 * and one block logs in as a freshly created non-superuser application role. Covers cross-tenant
 * reads and writes, missing and invalid context, pooled-connection reuse, table-specific
 * ownership (website-owned, workspace-owned, project-owned, platform-only), the application
 * services that were moved onto row security, platform administration and its audit trail, the
 * catalog posture, and the staged FORCE and rollback scripts (applied inside a transaction that
 * is rolled back).
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/tenant-rls.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

const RLS_VIOLATION = "42501"; // insufficient_privilege: also raised for a row that violates a policy

describe.skipIf(!optedIn)("Tenant row-level security (real PostgreSQL roles, disposable database)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const rls = await import("../platform/tenancy/rls.js");
  const records = await import("../services/websiteRecords.service.js");
  const workflows = await import("../services/workflowsCommunication/durableWorkflowDefinitions.service.js");
  const { environmentBindingService } = await import("../services/environment/environmentBinding.service.js");
  const { targetResolutionService } = await import("../services/environment/targetResolution.service.js");
  const benchmark = await import("../services/benchmark/benchmarkRunStore.service.js");
  const { createForgeProject } = await import("../services/project/forgeProject.service.js");

  vi.setConfig({ testTimeout: 60_000 });
  const marker = randomUUID().slice(0, 8);
  const user = {} as Record<"a" | "b" | "admin", string>;
  const site = {} as Record<"a" | "b" | "team", string>;
  const project = {} as Record<"a" | "b", string>;
  const tenant = {} as Record<"a" | "b" | "team", string>;
  let workspaceId = "";
  const runIds: string[] = [];

  const GRAPH = {
    nodes: [{ id: "start", type: "TRIGGER", name: "Lead received", config: {} }, { id: "end", type: "EXIT", name: "Done", config: {} }],
    edges: [{ id: "e1", sourceNodeId: "start", targetNodeId: "end" }],
  };
  const scope = (key: "a" | "b" | "team") => ({ websiteId: site[key], tenantId: tenant[key] });
  const q = async (sql: string, params: unknown[] = []) => (await pgPool.query(sql, params)).rows;
  const errorCode = async (promise: Promise<unknown>) => promise.then(() => "resolved", (err: any) => err?.code ?? String(err));

  /** A session as a restricted role, the way the application opens one, with whatever context is given. */
  async function asRole<T>(role: string, settings: Record<string, string>, work: (client: pg.PoolClient) => Promise<T>, pool: pg.Pool = pgPool as unknown as pg.Pool): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL ROLE ${role}`);
      for (const [name, value] of Object.entries(settings)) await client.query(`SELECT set_config($1, $2, true)`, [name, value]);
      return await work(client);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  }
  /** Runs one statement in a savepoint so a refused statement does not end the transaction. */
  const attempt = async (client: pg.PoolClient, sql: string, params: unknown[] = []) => {
    await client.query("SAVEPOINT attempt");
    try {
      const result = await client.query(sql, params);
      await client.query("RELEASE SAVEPOINT attempt");
      return { rowCount: result.rowCount ?? 0, rows: result.rows, code: null as string | null };
    } catch (err: any) {
      await client.query("ROLLBACK TO SAVEPOINT attempt");
      return { rowCount: 0, rows: [], code: err.code as string };
    }
  };
  const count = async (client: pg.PoolClient, table: string) => Number((await client.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);

  beforeAll(async () => {
    await ensureDatabaseTables();
    for (const key of ["a", "b", "admin"] as const) {
      user[key] = (await prisma.user.create({
        data: { fullName: `RLS ${key}`, email: `rls-${key}-${marker}@example.test`, status: "ACTIVE", authEpoch: 1, ...(key === "admin" ? { role: "ADMIN" } : {}) } as any,
      })).id;
    }
    workspaceId = (await prisma.workspace.create({
      data: { name: `RLS ${marker}`, slug: `rls-${marker}`, ownerId: user.a, members: { create: [{ userId: user.a, role: "OWNER" }] } } as any,
    })).id;
    site.a = (await prisma.website.create({ data: { userId: user.a, name: `RLS A ${marker}`, slug: `rls-a-${marker}` } })).id;
    site.b = (await prisma.website.create({ data: { userId: user.b, name: `RLS B ${marker}`, slug: `rls-b-${marker}` } })).id;
    // Owned by user A, but it belongs to a workspace: its tenant is the workspace, not the user.
    site.team = (await prisma.website.create({ data: { userId: user.a, workspaceId, name: `RLS team ${marker}`, slug: `rls-team-${marker}` } as any })).id;
    project.a = (await createForgeProject({ name: `RLS A ${marker}`, ownerId: user.a } as any)).id;
    project.b = (await createForgeProject({ name: `RLS B ${marker}`, ownerId: user.b } as any)).id;
    tenant.a = user.a;
    tenant.b = user.b;
    tenant.team = workspaceId;

    for (const key of ["a", "b", "team"] as const) {
      await records.putWebsiteRecord({ scope: scope(key), kind: "FACT_OFFER", key: "offer", data: { owner: key }, request: { owner: key }, userId: key === "b" ? user.b : user.a });
      await workflows.createWorkflowDraft(scope(key), key === "b" ? user.b : user.a, { workflowKey: "welcome", name: `Welcome ${key}`, ...GRAPH } as any);
    }
    await environmentBindingService.registerBinding(project.a, "app-a", "DEVELOPMENT", { secretRef: `vault/${marker}/a`, actorId: user.a });
    await environmentBindingService.registerBinding(project.b, "app-b", "DEVELOPMENT", { secretRef: `vault/${marker}/b`, actorId: user.b });
  }, 120_000);

  afterAll(async () => {
    if (runIds.length) await pgPool.query(`DELETE FROM forge_benchmark_runs WHERE "runId" = ANY($1)`, [runIds]).catch(() => undefined);
    await pgPool.query(`DELETE FROM forge_projects WHERE id = ANY($1::uuid[])`, [Object.values(project)]).catch(() => undefined);
    await prisma.website.deleteMany({ where: { id: { in: Object.values(site) } } }).catch(() => undefined);
    if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: Object.values(user) } } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  }, 60_000);

  describe("catalog posture", () => {
    it("has the restricted roles, policies and grants it claims, and says what weakens them here", async () => {
      const posture = await rls.rlsPosture();
      expect(posture.roles).toEqual([
        { name: "forge_tenant_rls", exists: true, canLogin: false, superuser: false, bypassRls: false, inherit: false },
        { name: "forge_platform_rls", exists: true, canLogin: false, superuser: false, bypassRls: false, inherit: false },
      ]);
      const byTable = Object.fromEntries(posture.tables.map((t) => [t.table, t]));
      expect(Object.keys(byTable).sort()).toEqual([...rls.RLS_TABLES].sort());
      for (const table of posture.tables) expect(table.enabled, table.table).toBe(true);
      expect(byTable.forge_website_records).toMatchObject({ policies: ["forge_website_records_tenant:forge_tenant_rls"], grants: { forge_tenant_rls: ["INSERT", "SELECT", "UPDATE"] } });
      expect(byTable.forge_workflow_definitions).toMatchObject({ policies: ["forge_workflow_definitions_tenant:forge_tenant_rls"], grants: { forge_tenant_rls: ["INSERT", "SELECT", "UPDATE"] } });
      expect(byTable.forge_environment_bindings).toMatchObject({ policies: ["forge_environment_bindings_tenant:forge_tenant_rls"], grants: { forge_tenant_rls: ["INSERT", "SELECT", "UPDATE"] } });
      expect(byTable.forge_benchmark_runs).toMatchObject({ policies: ["forge_benchmark_runs_platform:forge_platform_rls"], grants: { forge_platform_rls: ["INSERT", "SELECT"] } });
      for (const table of posture.tables) expect(table.grants.PUBLIC, table.table).toBeUndefined();
      expect(posture.orphans).toEqual({ forge_website_records: 0, forge_workflow_definitions: 0, forge_environment_bindings: 0 });

      // This environment connects as a superuser. The report must say so rather than imply more.
      const { superuser, bypassRls } = posture.connection;
      expect(posture.warnings.some((w) => /bypasses every policy/.test(w))).toBe(superuser || bypassRls);
      // The restricted roles hold no other table privilege anywhere in the database.
      const stray = await q(
        `SELECT grantee, table_name FROM information_schema.role_table_grants WHERE grantee IN ('forge_tenant_rls', 'forge_platform_rls') AND table_name <> ALL($1)`,
        [[...rls.RLS_TABLES]]
      );
      expect(stray).toEqual([]);
    });
  });

  describe("direct SQL as the restricted tenant role", () => {
    const TABLES = ["forge_website_records", "forge_workflow_definitions", "forge_environment_bindings"];

    it("sees nothing and can write nothing without a tenant", async () => {
      await asRole("forge_tenant_rls", {}, async (client) => {
        expect((await client.query("SELECT current_user AS role")).rows[0].role).toBe("forge_tenant_rls");
        for (const table of TABLES) expect(await count(client, table), table).toBe(0);
        const insert = await attempt(client, `INSERT INTO forge_website_records ("websiteId", "tenantId", kind, "recordKey", data, "requestHash", "createdById", "updatedById") VALUES ($1::uuid, $2, 'FACT_OFFER', 'x', '{}', repeat('0', 64), $3::uuid, $3::uuid)`, [site.a, tenant.a, user.a]);
        expect(insert.code).toBe(RLS_VIOLATION);
        expect((await attempt(client, `UPDATE forge_website_records SET data = '{"hijacked":true}'`)).rowCount).toBe(0);
      });
      // An empty or malformed tenant is not "all tenants": empty matches nothing, garbage is an error.
      await asRole("forge_tenant_rls", { "app.tenant_id": "" }, async (client) => {
        for (const table of TABLES) expect(await count(client, table), table).toBe(0);
      });
      await asRole("forge_tenant_rls", { "app.tenant_id": "' OR '1'='1" }, async (client) => {
        expect((await attempt(client, `SELECT count(*) FROM forge_website_records`)).code).toBe("22P02");
      });
      await asRole("forge_tenant_rls", { "app.tenant_id": randomUUID() }, async (client) => {
        for (const table of TABLES) expect(await count(client, table), table).toBe(0);
      });
    });

    it("confines a tenant to its own rows in every table, for reads and writes", async () => {
      await asRole("forge_tenant_rls", { "app.tenant_id": tenant.a }, async (client) => {
        expect((await client.query(`SELECT "websiteId" FROM forge_website_records`)).rows).toEqual([{ websiteId: site.a }]);
        expect((await client.query(`SELECT "websiteId" FROM forge_workflow_definitions`)).rows).toEqual([{ websiteId: site.a }]);
        expect((await client.query(`SELECT "projectId" FROM forge_environment_bindings`)).rows).toEqual([{ projectId: project.a }]);

        // Another tenant's rows cannot be found, changed, or created, whatever the WHERE clause says.
        expect((await client.query(`SELECT 1 FROM forge_website_records WHERE "websiteId" = $1::uuid`, [site.b])).rowCount).toBe(0);
        expect((await attempt(client, `UPDATE forge_website_records SET data = '{"hijacked":true}' WHERE "websiteId" = $1::uuid`, [site.b])).rowCount).toBe(0);
        expect((await attempt(client, `UPDATE forge_workflow_definitions SET name = 'hijacked' WHERE "websiteId" = $1::uuid`, [site.b])).rowCount).toBe(0);
        expect((await attempt(client, `UPDATE forge_environment_bindings SET status = 'RETIRED' WHERE "projectId" = $1::uuid`, [project.b])).rowCount).toBe(0);
        const insertOther = `INSERT INTO forge_website_records ("websiteId", "tenantId", kind, "recordKey", data, "requestHash", "createdById", "updatedById") VALUES ($1::uuid, $2, 'FACT_OFFER', 'planted', '{}', repeat('0', 64), $3::uuid, $3::uuid)`;
        expect((await attempt(client, insertOther, [site.b, tenant.b, user.a])).code).toBe(RLS_VIOLATION); // into B's website
        expect((await attempt(client, insertOther, [site.b, tenant.a, user.a])).code).toBe(RLS_VIOLATION); // B's website, own tenant label
        expect((await attempt(client, insertOther, [site.a, tenant.b, user.a])).code).toBe(RLS_VIOLATION); // own website, B's tenant label
        // A row cannot be moved to another tenant either.
        // (For a website-owned row the workspace lifecycle trigger refuses the move first, as an immutable parent.)
        expect([RLS_VIOLATION, "23514"]).toContain((await attempt(client, `UPDATE forge_website_records SET "websiteId" = $1::uuid`, [site.b])).code);
        expect((await attempt(client, `UPDATE forge_environment_bindings SET "projectId" = $1::uuid`, [project.b])).code).toBe(RLS_VIOLATION);

        // Least privilege: no deletes, and nothing outside the granted tables.
        expect((await attempt(client, `DELETE FROM forge_website_records`)).code).toBe(RLS_VIOLATION);
        for (const table of ["websites", "users", "forge_projects", "forge_benchmark_runs", "audit_logs", "sessions"]) {
          expect((await attempt(client, `SELECT 1 FROM ${table} LIMIT 1`)).code, table).toBe(RLS_VIOLATION);
        }
        // Whether this session could switch to another role depends on who logged in, not on the
        // tenant role: PostgreSQL checks SET ROLE against the session user. Under the non-superuser
        // login below it is refused; under a superuser login it is not (see the posture warning).
        const sessionIsSuperuser = (await client.query(`SELECT rolsuper FROM pg_roles WHERE rolname = session_user`)).rows[0].rolsuper;
        expect((await attempt(client, `SET LOCAL ROLE forge_platform_rls`)).code).toBe(sessionIsSuperuser ? null : RLS_VIOLATION);
      });
      // Nothing above changed anything.
      expect(await q(`SELECT data FROM forge_website_records WHERE "websiteId" = $1::uuid`, [site.b])).toEqual([{ data: { owner: "b" } }]);
      expect((await q(`SELECT count(*)::int AS n FROM forge_website_records WHERE "recordKey" = 'planted'`))[0].n).toBe(0);
    });

    it("follows each table's own ownership rule", async () => {
      // User A owns two websites, but one belongs to a workspace: the user's tenant does not reach it.
      await asRole("forge_tenant_rls", { "app.tenant_id": tenant.a }, async (client) => {
        expect((await client.query(`SELECT 1 FROM forge_website_records WHERE "websiteId" = $1::uuid`, [site.team])).rowCount).toBe(0);
      });
      await asRole("forge_tenant_rls", { "app.tenant_id": tenant.team }, async (client) => {
        expect((await client.query(`SELECT "websiteId" FROM forge_website_records`)).rows).toEqual([{ websiteId: site.team }]);
        expect((await client.query(`SELECT "websiteId" FROM forge_workflow_definitions`)).rows).toEqual([{ websiteId: site.team }]);
        expect(await count(client, "forge_environment_bindings")).toBe(0); // the workspace has no project
      });
      // Ownership is read live: when a website moves to another tenant, its rows move with it.
      await q(`UPDATE websites SET "workspaceId" = NULL WHERE id = $1::uuid`, [site.team]);
      try {
        await asRole("forge_tenant_rls", { "app.tenant_id": tenant.team }, async (client) => {
          expect(await count(client, "forge_workflow_definitions")).toBe(0);
        });
        await asRole("forge_tenant_rls", { "app.tenant_id": tenant.a }, async (client) => {
          expect((await client.query(`SELECT "websiteId" FROM forge_workflow_definitions ORDER BY 1`)).rows.map((r) => r.websiteId).sort()).toEqual([site.a, site.team].sort());
        });
      } finally {
        await q(`UPDATE websites SET "workspaceId" = $2::uuid WHERE id = $1::uuid`, [site.team, workspaceId]);
      }
    });
  });

  describe("pooled connections", () => {
    it("leaves no role or tenant behind for the next borrower, after success or failure", async () => {
      const single = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
      try {
        const state = async () => (await single.query(`SELECT pg_backend_pid() AS pid, current_user AS role, current_setting('app.tenant_id', true) AS tenant`)).rows[0];
        const before = await state();
        const seen = await rls.withTenantRls(tenant.a, user.a, async (client) => {
          const inside = (await client.query(`SELECT pg_backend_pid() AS pid, current_user AS role, current_setting('app.tenant_id', true) AS tenant`)).rows[0];
          expect(inside).toEqual({ pid: before.pid, role: "forge_tenant_rls", tenant: tenant.a });
          return (await client.query(`SELECT "websiteId" FROM forge_website_records`)).rows;
        }, single);
        expect(seen).toEqual([{ websiteId: site.a }]);
        expect(await state()).toEqual({ pid: before.pid, role: before.role, tenant: "" });

        await expect(rls.withTenantRls(tenant.a, user.a, async (client) => {
          await client.query(`SELECT 1 FROM forge_website_records`);
          throw new Error("work failed");
        }, single)).rejects.toThrow("work failed");
        expect(await state()).toEqual({ pid: before.pid, role: before.role, tenant: "" });

        // The same physical connection, next tenant: only that tenant's rows.
        const next = await rls.withTenantRls(tenant.b, user.b, (client) => client.query(`SELECT "websiteId" FROM forge_website_records`), single);
        expect(next.rows).toEqual([{ websiteId: site.b }]);
        // And as the restricted role with no tenant on that connection: nothing.
        await asRole("forge_tenant_rls", {}, async (client) => expect(await count(client, "forge_website_records")).toBe(0), single);
      } finally {
        await single.end();
      }
    });

    it("refuses to open a tenant transaction without a valid tenant", async () => {
      for (const missing of [undefined, null, "", "tenant-1", "*", { id: tenant.a }]) {
        expect(await errorCode(rls.withTenantRls(missing as any, user.a, async () => "ran"))).toBe("TENANT_CONTEXT_REQUIRED");
      }
      expect(await errorCode(rls.withProjectRls(randomUUID(), user.a, async () => "ran"))).toBe("PROJECT_NOT_FOUND");
      expect(await errorCode(rls.withProjectRls("not-a-uuid", user.a, async () => "ran"))).toBe("PROJECT_NOT_FOUND");
    });
  });

  describe("a real non-superuser application login", () => {
    const login = `rls_app_${marker}`;
    const password = randomBytes(18).toString("hex");
    let app: pg.Pool;

    beforeAll(async () => {
      // A separate login role, as a hardened deployment would use: not a superuser, not the table
      // owner, with table grants of its own and membership of the tenant role only.
      await q(`CREATE ROLE ${login} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE`);
      await q(`GRANT forge_tenant_rls TO ${login}`);
      await q(`GRANT USAGE ON SCHEMA public TO ${login}`);
      // The application resolves a resource's tenant before opening the tenant transaction.
      await q(`GRANT EXECUTE ON FUNCTION forge_website_tenant(uuid), forge_project_tenant(uuid) TO ${login}`);
      await q(`GRANT SELECT, INSERT, UPDATE, DELETE ON forge_website_records, forge_workflow_definitions, forge_environment_bindings, forge_benchmark_runs TO ${login}`);
      const url = new URL(process.env.DATABASE_URL!);
      url.username = login;
      url.password = password;
      app = new pg.Pool({ connectionString: url.toString(), max: 2 });
    });

    afterAll(async () => {
      await app?.end();
      await q(`REVOKE ALL ON forge_website_records, forge_workflow_definitions, forge_environment_bindings, forge_benchmark_runs FROM ${login}`).catch(() => undefined);
      await q(`REVOKE EXECUTE ON FUNCTION forge_website_tenant(uuid), forge_project_tenant(uuid) FROM ${login}`).catch(() => undefined);
      await q(`REVOKE USAGE ON SCHEMA public FROM ${login}`).catch(() => undefined);
      await q(`DROP ROLE IF EXISTS ${login}`).catch(() => undefined);
    });

    it("gets no rows from a query that forgot the tenant transaction, despite holding table grants", async () => {
      const who = (await app.query(`SELECT current_user AS role, (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) AS privileged`)).rows[0];
      expect(who).toEqual({ role: login, privileged: false });
      for (const table of ["forge_website_records", "forge_workflow_definitions", "forge_environment_bindings", "forge_benchmark_runs"]) {
        expect(Number((await app.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n), table).toBe(0);
      }
      expect((await app.query(`UPDATE forge_website_records SET data = '{"hijacked":true}'`)).rowCount).toBe(0);
      expect((await app.query(`DELETE FROM forge_workflow_definitions`)).rowCount).toBe(0);
      expect(await errorCode(app.query(
        `INSERT INTO forge_website_records ("websiteId", "tenantId", kind, "recordKey", data, "requestHash", "createdById", "updatedById") VALUES ($1::uuid, $2, 'FACT_OFFER', 'app', '{}', repeat('0', 64), $3::uuid, $3::uuid)`,
        [site.a, tenant.a, user.a]
      ))).toBe(RLS_VIOLATION);
      // Setting a tenant without switching role does not help: no policy names this role.
      const client = await app.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenant.a]);
        expect(await count(client, "forge_website_records")).toBe(0);
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    });

    it("works through the tenant transaction, and cannot reach the platform role or other tables", async () => {
      const mine = await rls.withTenantRls(tenant.a, user.a, (client) => client.query(`SELECT "websiteId" FROM forge_website_records`), app);
      expect(mine.rows).toEqual([{ websiteId: site.a }]);
      const written = await rls.withTenantRls(tenant.a, user.a, (client) => client.query(`UPDATE forge_website_records SET "updatedAt" = now() RETURNING "websiteId"`), app);
      expect(written.rows).toEqual([{ websiteId: site.a }]);
      // The project-tenant lookup runs with the function owner's rights, so the login needs no access to forge_projects.
      const bound = await rls.withProjectRls(project.a, user.a, (client) => client.query(`SELECT "projectId" FROM forge_environment_bindings`), app);
      expect(bound.rows).toEqual([{ projectId: project.a }]);

      await asRole("forge_tenant_rls", { "app.tenant_id": tenant.a }, async (client) => {
        expect((await attempt(client, `RESET ROLE`)).code).toBeNull();
        // Back to the login role: still no superuser, still no rows without the tenant role.
        expect(await count(client, "forge_website_records")).toBe(0);
        expect((await attempt(client, `SELECT 1 FROM websites LIMIT 1`)).code).toBe(RLS_VIOLATION);
        expect((await attempt(client, `SET LOCAL ROLE forge_platform_rls`)).code).toBe(RLS_VIOLATION);
        expect((await attempt(client, `SET LOCAL ROLE postgres`)).code).toBe(RLS_VIOLATION);
        expect((await attempt(client, `ALTER TABLE forge_website_records DISABLE ROW LEVEL SECURITY`)).code).toBe(RLS_VIOLATION);
      }, app);
    });
  });

  describe("application services on row security", () => {
    it("keeps working for the authorised tenant", async () => {
      expect((await records.getWebsiteRecord(scope("a"), "FACT_OFFER", "offer"))?.data).toEqual({ owner: "a" });
      const updated = await records.putWebsiteRecord({ scope: scope("a"), kind: "FACT_OFFER", key: "offer", data: { owner: "a", v: 2 }, request: { v: 2 }, userId: user.a });
      expect(updated).toMatchObject({ outcome: "UPDATED", record: { revision: 2 } });
      expect((await records.putWebsiteRecord({ scope: scope("a"), kind: "FACT_OFFER", key: "offer", data: { owner: "a", v: 2 }, request: { v: 2 }, userId: user.a })).outcome).toBe("REPLAYED");
      expect((await records.putWebsiteRecord({ scope: scope("a"), kind: "FACT_OFFER", key: "offer", data: { owner: "a", v: 3 }, request: { v: 3 }, userId: user.a, expectedRevision: 2 })).record.revision).toBe(3);

      expect((await workflows.listWorkflowVersions(scope("team"))).map((w) => w.name)).toEqual(["Welcome team"]);
      const published = await workflows.publishWorkflowVersion(scope("team"), user.a, "welcome", 1);
      expect(published.status).toBe("PUBLISHED");
      expect((await workflows.getWorkflowVersion(scope("team"), "welcome", 1)).status).toBe("PUBLISHED");

      // Background-style callers resolve a binding by project, with no request in hand.
      expect((await environmentBindingService.getBinding(project.a, "DEVELOPMENT")).projectId).toBe(project.a);
      expect((await targetResolutionService.resolveTargetPool(project.a, "DEVELOPMENT", "migrator")).bindingId).toContain(project.a);
      expect((await environmentBindingService.listBindings(project.b)).map((b) => b.projectId)).toEqual([project.b]);
      const rotated = await environmentBindingService.registerBinding(project.a, "app-a", "DEVELOPMENT", { secretRef: `vault/${marker}/a2`, actorId: user.a, expectedVersion: 1 });
      expect(rotated.version).toBe(2);
    });

    it("stops a caller that pairs one tenant with another tenant's website", async () => {
      // The service's own WHERE clause uses the website ID it was given. Row security is what
      // refuses the mismatch, so a mistaken or forged scope cannot cross tenants.
      const forged = { websiteId: site.b, tenantId: tenant.a };
      expect(await records.getWebsiteRecord(forged, "FACT_OFFER", "offer")).toBeNull();
      expect(await errorCode(records.putWebsiteRecord({ scope: forged, kind: "FACT_OFFER", key: "offer", data: { hijacked: true }, request: { hijacked: true }, userId: user.a }))).toBe(RLS_VIOLATION);
      expect(await errorCode(records.putWebsiteRecord({ scope: forged, kind: "FACT_OFFER", key: "planted", data: {}, request: {}, userId: user.a }))).toBe(RLS_VIOLATION);
      expect(await workflows.listWorkflowVersions(forged)).toEqual([]);
      expect(await errorCode(workflows.getWorkflowVersion(forged, "welcome", 1))).toBe("WORKFLOW_NOT_FOUND");
      expect(await errorCode(workflows.createWorkflowDraft(forged, user.a, { workflowKey: "planted", name: "Planted", ...GRAPH } as any))).toBe(RLS_VIOLATION);
      expect(await errorCode(workflows.publishWorkflowVersion(forged, user.a, "welcome", 1))).toBe("WORKFLOW_NOT_FOUND");

      expect(await q(`SELECT data FROM forge_website_records WHERE "websiteId" = $1::uuid`, [site.b])).toEqual([{ data: { owner: "b" } }]);
      expect(await q(`SELECT "workflowKey", status FROM forge_workflow_definitions WHERE "websiteId" = $1::uuid`, [site.b])).toEqual([{ workflowKey: "welcome", status: "DRAFT" }]);
    });
  });

  describe("platform administration", () => {
    const run = (label: string) => ({
      config: {
        protocolVersion: "2.1.0", productName: `RLS ${label} ${marker}`, productVersion: "1", purchasedPlanOrEntitlement: "Internal",
        briefId: "BRIEF-01-SOLARIS-CONSULTING", operatorExperienceLevel: "BUSINESS_USER" as const, enabledIntegrations: [],
        startingConditions: "", preparedAssetsDescription: "", costAssumptionsDescription: "", actualCostUsd: 0,
      },
      taskResults: [],
    });

    it("is explicit, limited to platform administrators and audited", async () => {
      expect(await errorCode(benchmark.listBenchmarkRuns({ id: user.a, role: "USER" }))).toBe("FORBIDDEN");
      expect(await errorCode(benchmark.recordBenchmarkRun({ id: user.a, role: "USER" }, run("denied") as any))).toBe("FORBIDDEN");
      expect(await errorCode(rls.withPlatformAdminRls(null, "benchmark_runs:list", async () => "ran"))).toBe("FORBIDDEN");
      expect(await errorCode(rls.withPlatformAdminRls({ id: user.admin, role: "ADMIN" }, "", async () => "ran"))).toBe("PURPOSE_REQUIRED");

      const admin = { id: user.admin, role: "ADMIN" };
      const recorded = await benchmark.recordBenchmarkRun(admin, run("ok") as any);
      runIds.push(recorded.report.runId);
      expect((await benchmark.getBenchmarkRun(admin, recorded.report.runId)).runId).toBe(recorded.report.runId);
      expect((await benchmark.listBenchmarkRuns(admin)).map((r) => r.runId)).toContain(recorded.report.runId);
      expect((await benchmark.recordBenchmarkRun(admin, run("ok") as any)).replayed).toBe(true);

      const audit = await q(`SELECT action, "targetResource" FROM audit_logs WHERE "userId" = $1::uuid AND action = 'platform.rls_admin_access' ORDER BY "createdAt"`, [user.admin]);
      expect(audit.map((a: any) => a.targetResource)).toEqual(["benchmark_runs:record", "benchmark_runs:read", "benchmark_runs:list", "benchmark_runs:record"]);
      expect((await q(`SELECT count(*)::int AS n FROM audit_logs WHERE "userId" = $1::uuid AND action = 'platform.rls_admin_access'`, [user.a]))[0].n).toBe(0);
    });

    it("gives the platform role its own tables only, and only when the transaction is marked", async () => {
      await asRole("forge_platform_rls", {}, async (client) => {
        expect(await count(client, "forge_benchmark_runs")).toBe(0); // not marked as platform administration
        expect((await attempt(client, `INSERT INTO forge_benchmark_runs ("runId", "requestHash", report, "recordedById") VALUES ('x', repeat('0', 64), '{}', $1::uuid)`, [user.admin])).code).toBe(RLS_VIOLATION);
      });
      await asRole("forge_platform_rls", { "app.platform_admin": "on" }, async (client) => {
        expect(await count(client, "forge_benchmark_runs")).toBeGreaterThan(0);
        expect((await attempt(client, `DELETE FROM forge_benchmark_runs`)).code).toBe(RLS_VIOLATION);
        for (const table of ["forge_website_records", "forge_workflow_definitions", "forge_environment_bindings", "websites", "users"]) {
          expect((await attempt(client, `SELECT 1 FROM ${table} LIMIT 1`)).code, table).toBe(RLS_VIOLATION);
        }
      });
      // The tenant role cannot mark itself as platform administration into anything.
      await asRole("forge_tenant_rls", { "app.tenant_id": tenant.a, "app.platform_admin": "on" }, async (client) => {
        expect((await attempt(client, `SELECT 1 FROM forge_benchmark_runs LIMIT 1`)).code).toBe(RLS_VIOLATION);
      });
    });
  });

  describe("staging and reversal", () => {
    const script = (name: string) => readFileSync(path.resolve(process.cwd(), "prisma/rls", name), "utf8");

    it("stage 2 (FORCE) subjects the table owner too, and both stages roll back cleanly", async () => {
      const flags = async (client: pg.PoolClient) =>
        (await client.query(`SELECT relname, relrowsecurity AS enabled, relforcerowsecurity AS forced FROM pg_class WHERE relname = ANY($1) ORDER BY 1`, [[...rls.RLS_TABLES]])).rows;
      const client = await pgPool.connect();
      try {
        // Everything below is undone by the ROLLBACK: the owner change, the role, and both scripts.
        await client.query("BEGIN");
        const owner = `rls_owner_${marker}`;
        await client.query(`CREATE ROLE ${owner} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
        await client.query(`GRANT USAGE ON SCHEMA public TO ${owner}`);
        for (const table of rls.RLS_TABLES) await client.query(`ALTER TABLE ${table} OWNER TO ${owner}`);

        // Stage 1: a non-superuser owner is still exempt.
        await client.query(`SET LOCAL ROLE ${owner}`);
        expect(await count(client, "forge_website_records")).toBeGreaterThanOrEqual(3);
        await client.query("RESET ROLE");

        await client.query(script("stage2_force.sql"));
        expect((await flags(client)).every((t) => t.enabled && t.forced)).toBe(true);
        await client.query(`SET LOCAL ROLE ${owner}`);
        for (const table of rls.RLS_TABLES) expect(await count(client, table), table).toBe(0); // the owner, without a tenant transaction
        expect((await attempt(client, `UPDATE forge_website_records SET data = '{}'`)).rowCount).toBe(0);
        await client.query("RESET ROLE");
        // The tenant role is unaffected by FORCE.
        await client.query("SET LOCAL ROLE forge_tenant_rls");
        await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenant.a]);
        expect((await client.query(`SELECT "websiteId" FROM forge_website_records`)).rows).toEqual([{ websiteId: site.a }]);
        await client.query("RESET ROLE");

        await client.query(script("rollback_stage2.sql"));
        expect((await flags(client)).every((t) => t.enabled && !t.forced)).toBe(true);
        await client.query(script("rollback_stage1.sql"));
        expect((await flags(client)).every((t) => !t.enabled && !t.forced)).toBe(true);
        expect((await client.query(`SELECT count(*)::int AS n FROM pg_policies WHERE tablename = ANY($1)`, [[...rls.RLS_TABLES]])).rows[0].n).toBe(0);
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
      // Rolled back: stage 1 is in place exactly as before, and no data changed.
      const posture = await rls.rlsPosture();
      expect(posture.tables.every((t) => t.enabled && !t.forced && t.policies.length === 1)).toBe(true);
      expect(posture.tables.every((t) => t.owner === posture.connection.role)).toBe(true);
      expect((await q(`SELECT count(*)::int AS n FROM pg_roles WHERE rolname = $1`, [`rls_owner_${marker}`]))[0].n).toBe(0);
    });

    it("still removes a tenant's rows when its website or project is deleted", async () => {
      const temp = (await prisma.website.create({ data: { userId: user.b, name: `RLS temp ${marker}`, slug: `rls-temp-${marker}` } })).id;
      const tempScope = { websiteId: temp, tenantId: tenant.b };
      await records.putWebsiteRecord({ scope: tempScope, kind: "FACT_OFFER", key: "offer", data: {}, request: {}, userId: user.b });
      await workflows.createWorkflowDraft(tempScope, user.b, { workflowKey: "temp", name: "Temp", ...GRAPH } as any);
      await prisma.website.delete({ where: { id: temp } });
      expect((await q(`SELECT (SELECT count(*) FROM forge_website_records WHERE "websiteId" = $1::uuid)::int + (SELECT count(*) FROM forge_workflow_definitions WHERE "websiteId" = $1::uuid)::int AS n`, [temp]))[0].n).toBe(0);
    });
  });
});
