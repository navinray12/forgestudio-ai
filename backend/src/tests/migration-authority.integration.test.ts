/**
 * One migration authority with real PostgreSQL DDL (blueprint §43, WP-21).
 *
 * Every case runs against real customer schemas in the disposable database and proves its outcome
 * with SQL on the target: the table exists or it does not, the target's _forge_migrations ledger
 * holds the migration or it does not. Covers wrong targets, namespace isolation, hazards, drift,
 * successful DDL, approval and production rules, concurrency, lock timeouts, partial failure and
 * resume, interruption, reconciliation, duplicate requests and the HTTP entry points.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/migration-authority.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

type Db = "dev" | "other" | "prod" | "prodUnbound";

describe.skipIf(!optedIn)("Migration authority (real PostgreSQL DDL, disposable database)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const { createForgeProject } = await import("../services/project/forgeProject.service.js");
  const { forgeDatabaseService } = await import("../modules/data-platform/database/forgeDatabase.service.js");
  const { migrationEngine } = await import("../modules/data-platform/database/migrationEngine.js");
  const { environmentBindingService } = await import("../services/environment/environmentBinding.service.js");
  const { unifiedMigrationAuthority: authority, analyzeStatement } = await import("../services/migration/unifiedMigrationAuthority.service.js");
  const { default: app } = await import("../app.js");

  const marker = randomUUID().slice(0, 8);
  const users = {} as Record<"owner" | "member" | "outsider", string>;
  const tokens = {} as Record<"owner" | "outsider", string>;
  const project = {} as Record<Db, string>;
  const db = {} as Record<Db, string>;
  const schema = {} as Record<Db, string>;
  let server: Server;
  let base = "";
  let n = 0;

  const owner = () => ({ id: users.owner, canAdminister: true });
  const member = () => ({ id: users.member, canAdminister: false });
  const q = async (sql: string, params: unknown[] = []) => (await pgPool.query(sql, params)).rows;
  const tableExists = async (key: Db, table: string) => (await q(`SELECT to_regclass($1) IS NOT NULL AS present`, [`"${schema[key]}"."${table}"`]))[0].present as boolean;
  const ledger = async (key: Db) => (await q(`SELECT name, checksum FROM "${schema[key]}"._forge_migrations ORDER BY applied_at`)) as Array<{ name: string; checksum: string }>;
  const row = async (id: string) => (await q(`SELECT status, "errorMessage", lifecycle, "leaseToken" FROM forge_database_migrations WHERE id = $1`, [id]))[0];
  const scratchSchemas = async () => (await q(`SELECT count(*)::int AS n FROM pg_namespace WHERE nspname LIKE '\\_forge\\_rehearsal\\_%'`))[0].n as number;
  const name = (label: string) => `${String(++n).padStart(3, "0")}_${label}`;
  const plan = (key: Db, label: string, statements: string[], extra: Record<string, unknown> = {}) =>
    authority.createPlan({ databaseId: db[key], projectId: project[key], name: name(label), statements, createdById: users.owner, ...extra });
  const govern = (id: string, key: Db = "dev") => authority.runGoverned(id, owner(), { databaseId: db[key], projectId: project[key] });
  /** Preflight, rehearse and approve, without executing. */
  const approveOnly = async (id: string) => {
    await authority.preflight(id);
    await authority.rehearse(id);
    return authority.approve(id, owner(), { acknowledgeDestructive: true });
  };
  const code = async (promise: Promise<unknown>) => promise.then(() => "resolved", (err: any) => err?.code ?? String(err));

  // Every case runs real DDL, and each migration is rehearsed twice before it is applied.
  vi.setConfig({ testTimeout: 90_000 });

  beforeAll(async () => {
    await ensureDatabaseTables();
    for (const who of ["owner", "member", "outsider"] as const) {
      users[who] = (await prisma.user.create({ data: { fullName: `Mig ${who}`, email: `mig-${who}-${marker}@example.test`, status: "ACTIVE", authEpoch: 1 } as any })).id;
    }
    for (const who of ["owner", "outsider"] as const) {
      const token = `mig-${who}-${randomUUID()}`;
      await prisma.session.create({
        data: {
          userId: users[who], tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000),
          authEpoch: 1, audience: "TENANT", authTime: new Date(Date.now() - 1000), authMethod: "local", lastUsedAt: new Date(),
        },
      });
      tokens[who] = token;
    }
    for (const [key, environment] of [["dev", "development"], ["other", "development"], ["prod", "production"], ["prodUnbound", "production"]] as const) {
      project[key] = (await createForgeProject({ name: `Mig ${key} ${marker}`, ownerId: users.owner } as any)).id;
      const provisioned = await forgeDatabaseService.provisionDatabase(project[key], environment as any);
      db[key] = provisioned.id;
      schema[key] = provisioned.schemaName;
    }
    await environmentBindingService.registerBinding(project.prod, `app-${marker}`, "PRODUCTION", { secretRef: `vault/forge/${marker}/prod`, stepUpVerified: true, actorId: users.owner });
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 120_000);

  afterAll(async () => {
    await new Promise((r) => server?.close(r));
    for (const key of Object.keys(schema) as Db[]) await pgPool.query(`DROP SCHEMA IF EXISTS "${schema[key]}" CASCADE`).catch(() => undefined);
    await pgPool.query(`DELETE FROM forge_projects WHERE id = ANY($1::uuid[])`, [Object.values(project)]).catch(() => undefined);
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(users) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  }, 60_000);

  describe("successful DDL", () => {
    let first = "";

    it("applies a plan only after preflight, both rehearsals and approval, and proves it from the target", async () => {
      const created = await plan("dev", "customers", [
        "CREATE TABLE customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, name text, code int)",
        "INSERT INTO customers (email, name, code) VALUES ('a@example.test', 'A', 1), ('b@example.test', 'B', 2), (NULL, 'C', 3)",
      ]);
      first = created.id;
      expect(created).toMatchObject({ status: "PENDING" });
      expect(created.plan).toMatchObject({ authority: "FORGE_MANAGED", destructive: false });
      expect(await tableExists("dev", "customers")).toBe(false);

      const result = await govern(created.id);
      expect(result).toMatchObject({ approvalRequired: false });
      expect(result.migration.status).toBe("APPLIED");

      // Evidence in the target itself.
      expect(await tableExists("dev", "customers")).toBe(true);
      expect(await ledger("dev")).toEqual([{ name: created.name, checksum: created.checksum }]);
      expect((await q(`SELECT count(*)::int AS n FROM "${schema.dev}".customers`))[0].n).toBe(3);

      const life = result.migration.lifecycle;
      expect(life.preflight).toMatchObject({ passed: true, schemaName: schema.dev, environment: "DEVELOPMENT" });
      expect(life.rehearsals).toMatchObject({ passed: true, empty: { passed: true }, priorRelease: { passed: true } });
      expect(life.approval).toMatchObject({ approvedById: users.owner, environment: "DEVELOPMENT" });
      expect(life.evidence.ledger).toMatchObject({ name: created.name, checksum: created.checksum });
      expect(life.evidence.catalogHash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.migration.appliedAt).toBeTruthy();
      expect((await row(created.id)).leaseToken).toBeNull();
      // The rehearsals ran in scratch schemas that no longer exist, and never in the control plane.
      expect(await scratchSchemas()).toBe(0);
      expect((await q(`SELECT to_regclass('public.customers') IS NULL AS absent`))[0].absent).toBe(true);
    });

    it("rehearses the next plan by replaying the recorded history from an empty schema", async () => {
      const next = await plan("dev", "customer_tier", ["ALTER TABLE customers ADD COLUMN tier text DEFAULT 'free'"], { dependsOn: [first] });
      const result = await govern(next.id);
      expect(result.migration.status).toBe("APPLIED");
      expect(result.migration.lifecycle.rehearsals.empty).toMatchObject({ passed: true, basis: "HISTORY_REPLAY", replayed: 1 });
      expect(result.migration.lifecycle.rehearsals.priorRelease).toMatchObject({ passed: true, basis: "STRUCTURE_CLONE", data: { customers: { rows: 3, sampled: false } } });
      expect((await q(`SELECT tier FROM "${schema.dev}".customers LIMIT 1`))[0].tier).toBe("free");
    });

    it("returns the recorded result for a repeated request and never runs the DDL twice", async () => {
      const again = await authority.execute(first, owner());
      expect(again).toMatchObject({ status: "APPLIED", replayed: true });
      expect((await govern(first)).replayed).toBe(true);
      expect((await ledger("dev")).filter((r) => r.name.endsWith("customers")).length).toBe(1);

      const key = `req-${randomUUID()}`;
      const one = await authority.createPlan({ databaseId: db.dev, projectId: project.dev, name: `dup_${marker}`, statements: ["CREATE TABLE dup_a (id int)"], requestKey: key });
      const two = await authority.createPlan({ databaseId: db.dev, projectId: project.dev, name: `dup_${marker}`, statements: ["CREATE TABLE dup_a (id int)"], requestKey: key });
      expect(two.id).toBe(one.id);
      expect(await code(authority.createPlan({ databaseId: db.dev, projectId: project.dev, name: `dup_${marker}`, statements: ["CREATE TABLE dup_b (id int)"], requestKey: key }))).toBe("REQUEST_KEY_REUSED");
      expect(await code(authority.createPlan({ databaseId: db.dev, projectId: project.dev, name: `dup_${marker}`, statements: ["CREATE TABLE dup_c (id int)"] }))).toBe("MIGRATION_NAME_TAKEN");
      await authority.cancel(one.id, owner());
    });
  });

  describe("wrong targets and namespace ownership", () => {
    it("refuses a migration aimed at another database, project or environment before anything runs", async () => {
      const created = await plan("dev", "wrong_target", ["CREATE TABLE wrong_target (id int)"]);
      expect(await code(authority.runGoverned(created.id, owner(), { databaseId: db.other }))).toBe("MIGRATION_TARGET_MISMATCH");
      expect(await code(authority.runGoverned(created.id, owner(), { databaseId: db.dev, projectId: project.other }))).toBe("PROJECT_MISMATCH");
      expect(await code(authority.runGoverned(created.id, owner(), { databaseId: db.dev, environment: "PRODUCTION" }))).toBe("ENVIRONMENT_MISMATCH");
      expect(await code(authority.runGoverned(created.id, owner(), { databaseId: db.dev, environment: "moon" }))).toBe("ENVIRONMENT_REQUIRED");
      expect(await code(authority.createPlan({ databaseId: db.dev, projectId: project.other, name: "x1", statements: ["CREATE TABLE x (id int)"] }))).toBe("PROJECT_MISMATCH");
      expect((await row(created.id)).status).toBe("PENDING");
      expect(await tableExists("dev", "wrong_target")).toBe(false);
      expect(await tableExists("other", "wrong_target")).toBe(false);
      await authority.cancel(created.id, owner());
    });

    it("accepts only single schema or data changes inside the database's own schema", () => {
      const rejected = [
        "DROP TABLE public.users",
        `DROP TABLE "${schema.other}".anything`,
        "SET search_path = public",
        "CREATE TABLE a (id int); DROP TABLE b",
        "GRANT ALL ON customers TO PUBLIC",
        "CREATE EXTENSION pgcrypto",
        "DROP SCHEMA public CASCADE",
        "SELECT pg_terminate_backend(1)",
        "COMMIT",
        "ALTER ROLE postgres SUPERUSER",
        "",
      ];
      for (const sql of rejected) expect(() => analyzeStatement(sql, 1, schema.dev), sql).toThrowError(/Statement 1/);
      expect(analyzeStatement(`CREATE TABLE "${schema.dev}".ok (id int)`, 1, schema.dev).destructive).toBe(false);
      expect(analyzeStatement("ALTER TABLE customers DROP COLUMN name", 1, schema.dev).destructive).toBe(true);
      expect(analyzeStatement("CREATE INDEX CONCURRENTLY i ON customers (email)", 1, schema.dev).transactional).toBe(false);
      expect(analyzeStatement("CREATE UNIQUE INDEX u ON customers (email, code)", 1, schema.dev).hazards).toEqual([{ type: "DUPLICATE_CHECK", table: "customers", columns: ["email", "code"] }]);
      expect(analyzeStatement("ALTER TABLE customers ALTER COLUMN email SET NOT NULL", 1, schema.dev).hazards).toEqual([{ type: "NOT_NULL_BACKFILL", table: "customers", columns: ["email"], mode: "SET" }]);
      expect(analyzeStatement("INSERT INTO notes (body) VALUES ('a; DROP TABLE public.users; --')", 1, schema.dev).destructive).toBe(false);
    });

    it("cannot reach a control-plane table through an unqualified name", async () => {
      // "users" exists in the control plane's public schema and not in the customer schema.
      const created = await plan("dev", "drop_users", ["DROP TABLE users"]);
      expect(await code(govern(created.id))).toBe("REHEARSAL_FAILED");
      expect((await row(created.id)).lifecycle.rehearsals.empty.error).toContain("does not exist");
      expect((await q(`SELECT to_regclass('public.users') IS NOT NULL AS present`))[0].present).toBe(true);
      expect((await q(`SELECT count(*)::int AS n FROM users WHERE id = $1`, [users.owner]))[0].n).toBe(1);
      await authority.cancel(created.id, owner());
    });

    it("refuses a database whose schema is not a managed customer namespace", async () => {
      const [{ id }] = await q(`INSERT INTO forge_databases ("projectId", environment, "schemaName") VALUES ($1, 'staging', 'public') RETURNING id`, [project.dev]);
      expect(await code(authority.createPlan({ databaseId: id, projectId: project.dev, name: "in_public", statements: ["CREATE TABLE in_public (id int)"] }))).toBe("NAMESPACE_NOT_MANAGED");
      await q(`DELETE FROM forge_databases WHERE id = $1`, [id]);
      expect((await q(`SELECT to_regclass('public.in_public') IS NULL AS absent`))[0].absent).toBe(true);
    });
  });

  describe("hazard checks", () => {
    it("stops a unique rule over duplicate values and a NOT NULL over missing values, before any DDL", async () => {
      await q(`INSERT INTO "${schema.dev}".customers (email, name, code) VALUES ('a@example.test', 'A again', 9)`);
      const unique = await plan("dev", "unique_email", ["CREATE UNIQUE INDEX ux_customers_email ON customers (email)"]);
      expect(await code(govern(unique.id))).toBe("DUPLICATE_VALUES");
      const after = await row(unique.id);
      expect(after.status).toBe("PENDING");
      expect(after.lifecycle.preflight).toMatchObject({ passed: false });
      expect(after.lifecycle.preflight.failures[0].code).toBe("DUPLICATE_VALUES");

      const notNull = await plan("dev", "email_required", ["ALTER TABLE customers ALTER COLUMN email SET NOT NULL"]);
      expect(await code(govern(notNull.id))).toBe("BACKFILL_REQUIRED");
      const added = await plan("dev", "region_required", ["ALTER TABLE customers ADD COLUMN region text NOT NULL"]);
      expect(await code(govern(added.id))).toBe("BACKFILL_REQUIRED");
      const expression = await plan("dev", "unique_lower", ["CREATE UNIQUE INDEX ux_lower ON customers (lower(email))"]);
      expect(await code(govern(expression.id))).toBe("UNVERIFIABLE_HAZARD");

      expect((await q(`SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname = $1 AND indexname IN ('ux_customers_email', 'ux_lower')`, [schema.dev]))[0].n).toBe(0);
      expect((await q(`SELECT is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'customers' AND column_name = 'email'`, [schema.dev]))[0].is_nullable).toBe("YES");
      for (const p of [unique, notNull, added, expression]) await authority.cancel(p.id, owner());
    });

    it("applies the same changes once the plan removes the hazard first", async () => {
      const fixed = await plan("dev", "email_clean", [
        "DELETE FROM customers WHERE name = 'A again'",
        "UPDATE customers SET email = 'unknown-' || code || '@example.test' WHERE email IS NULL",
        "ALTER TABLE customers ALTER COLUMN email SET NOT NULL",
        "CREATE UNIQUE INDEX ux_customers_email ON customers (email)",
      ]);
      expect(fixed.plan!.destructive).toBe(true);
      // The duplicate is still in the target, so the unique rule is refused until it is gone.
      expect(await code(govern(fixed.id))).toBe("DUPLICATE_VALUES");
      await authority.cancel(fixed.id, owner());

      const cleanup = await plan("dev", "remove_duplicate", ["DELETE FROM customers WHERE name = 'A again'"]);
      expect((await govern(cleanup.id)).migration.status).toBe("APPLIED");
      const constrain = await plan("dev", "email_rules", [
        "UPDATE customers SET email = 'unknown-' || code || '@example.test' WHERE email IS NULL",
        "ALTER TABLE customers ALTER COLUMN email SET NOT NULL",
        "CREATE UNIQUE INDEX ux_customers_email ON customers (email)",
      ]);
      const result = await govern(constrain.id);
      expect(result.migration.status).toBe("APPLIED");
      expect(result.migration.lifecycle.preflight.hazards).toEqual(expect.arrayContaining([expect.objectContaining({ type: "NOT_NULL_BACKFILL", rowsNeedingBackfill: true, backfillInPlan: true })]));
      expect((await q(`SELECT count(*)::int AS n FROM "${schema.dev}".customers WHERE email IS NULL`))[0].n).toBe(0);
      expect((await q(`SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname = $1 AND indexname = 'ux_customers_email'`, [schema.dev]))[0].n).toBe(1);
    });
  });

  describe("drift and integrity", () => {
    it("refuses to run after the schema was changed outside the authority, until it is adopted as a baseline", async () => {
      await q(`ALTER TABLE "${schema.dev}".customers ADD COLUMN out_of_band text`);
      const next = await plan("dev", "after_drift", ["CREATE TABLE after_drift (id int)"]);
      expect(await code(govern(next.id))).toBe("SCHEMA_DRIFT");
      expect(await tableExists("dev", "after_drift")).toBe(false);

      const baseline = await authority.adoptBaseline(db.dev, owner(), { projectId: project.dev });
      expect(baseline).toMatchObject({ status: "APPLIED" });
      expect(baseline.plan).toMatchObject({ baseline: true, statements: [] });
      expect((await ledger("dev")).some((r) => r.name === baseline.name)).toBe(true);

      const result = await govern(next.id);
      expect(result.migration.status).toBe("APPLIED");
      // History now contains a baseline without SQL, so the empty rehearsal clones the structure.
      expect(result.migration.lifecycle.rehearsals.empty.basis).toBe("STRUCTURE_CLONE");
    });

    it("refuses to run when the target's ledger and the control plane disagree", async () => {
      const victim = (await ledger("dev"))[0];
      await q(`UPDATE "${schema.dev}"._forge_migrations SET checksum = repeat('0', 64) WHERE name = $1`, [victim.name]);
      const next = await plan("dev", "history_drift", ["CREATE TABLE history_drift (id int)"]);
      expect(await code(govern(next.id))).toBe("MIGRATION_HISTORY_DRIFT");
      await q(`UPDATE "${schema.dev}"._forge_migrations SET checksum = $2 WHERE name = $1`, [victim.name, victim.checksum]);

      await q(`INSERT INTO "${schema.dev}"._forge_migrations (name, checksum) VALUES ('applied_by_someone_else', repeat('1', 64))`);
      expect(await code(govern(next.id))).toBe("MIGRATION_HISTORY_DRIFT");
      await q(`DELETE FROM "${schema.dev}"._forge_migrations WHERE name = 'applied_by_someone_else'`);
      expect(await tableExists("dev", "history_drift")).toBe(false);
      expect((await govern(next.id)).migration.status).toBe("APPLIED");
    });

    it("refuses SQL that was altered after planning, at every step", async () => {
      const tampered = await plan("dev", "tampered", ["CREATE TABLE tampered (id int)"]);
      await q(`UPDATE forge_database_migrations SET "upSql" = 'DROP TABLE customers;' WHERE id = $1`, [tampered.id]);
      expect(await code(govern(tampered.id))).toBe("MIGRATION_CHECKSUM_MISMATCH");
      expect(await code(authority.preflight(tampered.id))).toBe("MIGRATION_CHECKSUM_MISMATCH");
      expect(await tableExists("dev", "customers")).toBe(true);

      const approved = await plan("dev", "tampered_late", ["CREATE TABLE tampered_late (id int)"]);
      await approveOnly(approved.id);
      await q(`UPDATE forge_database_migrations SET plan = jsonb_set(plan, '{statements,0,sql}', '"DROP TABLE customers"') WHERE id = $1`, [approved.id]);
      expect(await code(authority.execute(approved.id, owner()))).toBe("MIGRATION_CHECKSUM_MISMATCH");
      expect(await tableExists("dev", "customers")).toBe(true);
      expect(await tableExists("dev", "tampered_late")).toBe(false);
      await q(`UPDATE forge_database_migrations SET status = 'CANCELLED' WHERE id = ANY($1::uuid[])`, [[tampered.id, approved.id]]);
    });

    it("sends an approved plan back when the target changed after its rehearsal", async () => {
      const approved = await plan("dev", "stale_rehearsal", ["CREATE TABLE stale_rehearsal (id int)"]);
      await approveOnly(approved.id);
      const other = await plan("dev", "lands_first", ["CREATE TABLE lands_first (id int)"]);
      expect((await govern(other.id)).migration.status).toBe("APPLIED");

      expect(await code(authority.execute(approved.id, owner()))).toBe("TARGET_CHANGED_SINCE_REHEARSAL");
      const after = await row(approved.id);
      expect(after.status).toBe("PENDING");
      expect(after.lifecycle.approval).toBeNull();
      expect(await tableExists("dev", "stale_rehearsal")).toBe(false);
      // Checked and rehearsed again against the new schema, it applies.
      expect((await govern(approved.id)).migration.status).toBe("APPLIED");
    });

    it("requires dependencies to be applied", async () => {
      const first = await plan("dev", "dep_first", ["CREATE TABLE dep_first (id int PRIMARY KEY)"]);
      const second = await plan("dev", "dep_second", ["CREATE TABLE dep_second (id int REFERENCES dep_first (id))"], { dependsOn: [first.id] });
      expect(await code(authority.preflight(second.id))).toBe("DEPENDENCY_NOT_APPLIED");
      expect(await code(authority.createPlan({ databaseId: db.dev, projectId: project.dev, name: "dep_bad", statements: ["CREATE TABLE z (id int)"], dependsOn: [randomUUID()] }))).toBe("UNKNOWN_DEPENDENCY");
      await govern(first.id);
      expect((await govern(second.id)).migration.status).toBe("APPLIED");
    });
  });

  describe("approval and production", () => {
    it("does not execute without a current approval", async () => {
      const created = await plan("dev", "needs_approval", ["CREATE TABLE needs_approval (id int)"]);
      expect(await code(authority.execute(created.id, owner()))).toBe("NOT_APPROVED");
      expect(await code(authority.approve(created.id, owner()))).toBe("REHEARSAL_REQUIRED");
      await authority.preflight(created.id);
      expect(await code(authority.approve(created.id, owner()))).toBe("REHEARSAL_REQUIRED");
      await authority.rehearse(created.id);
      await authority.approve(created.id, owner());
      await q(`UPDATE forge_database_migrations SET lifecycle = jsonb_set(lifecycle, '{approval,expiresAt}', '"2020-01-01T00:00:00.000Z"') WHERE id = $1`, [created.id]);
      expect(await code(authority.execute(created.id, owner()))).toBe("APPROVAL_EXPIRED");
      expect((await row(created.id)).status).toBe("CANCELLED");
      expect(await tableExists("dev", "needs_approval")).toBe(false);
    });

    it("never runs a production migration in one call, and needs an administrator to approve it", async () => {
      const created = await plan("prod", "orders", ["CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), total int, note text)"]);
      const governed = await govern(created.id, "prod");
      expect(governed).toMatchObject({ approvalRequired: true });
      expect(governed.migration.status).toBe("REHEARSED");
      expect(await tableExists("prod", "orders")).toBe(false);

      // The legacy apply path and the CLI use the engine: they stop here as well.
      expect(await code(migrationEngine.applyMigration(db.prod, created.id, { actor: owner() }))).toBe("APPROVAL_REQUIRED");
      expect(await tableExists("prod", "orders")).toBe(false);

      expect(await code(authority.approve(created.id, member()))).toBe("FORBIDDEN");
      await authority.approve(created.id, owner());
      const applied = await authority.execute(created.id, owner());
      expect(applied.status).toBe("APPLIED");
      expect(applied.lifecycle.preflight.binding).toMatchObject({ protectionLevel: "RESTRICTED_PRODUCTION", version: 1 });
      expect(await tableExists("prod", "orders")).toBe(true);
    });

    it("needs an explicit acknowledgement for a destructive production plan", async () => {
      const destructive = await plan("prod", "drop_note", ["ALTER TABLE orders DROP COLUMN note"]);
      expect(destructive.plan!.destructive).toBe(true);
      expect((await govern(destructive.id, "prod")).approvalRequired).toBe(true);
      expect(await code(authority.approve(destructive.id, owner()))).toBe("DESTRUCTIVE_ACKNOWLEDGEMENT_REQUIRED");
      expect(await code(authority.execute(destructive.id, owner()))).toBe("NOT_APPROVED");
      expect((await q(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'orders' AND column_name = 'note'`, [schema.prod]))[0].n).toBe(1);

      const approved = await authority.approve(destructive.id, owner(), { acknowledgeDestructive: true });
      expect(approved.lifecycle.approval).toMatchObject({ destructive: true, destructiveAcknowledged: true });
      expect((await authority.execute(destructive.id, owner())).status).toBe("APPLIED");
      expect((await q(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'orders' AND column_name = 'note'`, [schema.prod]))[0].n).toBe(0);
    });

    it("refuses production without an environment binding, and a production rollback", async () => {
      const unbound = await plan("prodUnbound", "no_binding", ["CREATE TABLE no_binding (id int)"]);
      expect(await code(govern(unbound.id, "prodUnbound"))).toBe("BINDING_REQUIRED");
      expect(await tableExists("prodUnbound", "no_binding")).toBe(false);

      const [{ id }] = await q(`SELECT id FROM forge_database_migrations WHERE "databaseId" = $1 AND status = 'APPLIED' ORDER BY "createdAt" LIMIT 1`, [db.prod]);
      await q(`UPDATE forge_database_migrations SET "downSql" = 'DROP TABLE orders;' WHERE id = $1`, [id]);
      expect(await code(migrationEngine.rollbackMigration(db.prod, id, { actor: owner() }))).toBe("ROLLBACK_REQUIRES_FORWARD_FIX");
      expect(await tableExists("prod", "orders")).toBe(true);
    });
  });

  describe("concurrency and locks", () => {
    it("runs one of two simultaneous executions of the same plan", async () => {
      const created = await plan("other", "same_plan", ["CREATE TABLE same_plan (id int)", "DO $$ BEGIN PERFORM pg_sleep(0.5); END $$"]);
      await approveOnly(created.id);
      const results = await Promise.allSettled([authority.execute(created.id, owner()), authority.execute(created.id, owner())]);
      const fulfilled = results.filter((r) => r.status === "fulfilled") as Array<PromiseFulfilledResult<any>>;
      const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      expect(fulfilled.filter((r) => !r.value.replayed).length).toBe(1);
      for (const r of rejected) expect(r.reason.code).toBe("MIGRATION_IN_PROGRESS");
      expect((await ledger("other")).filter((r) => r.name === created.name).length).toBe(1);
      expect((await row(created.id)).status).toBe("APPLIED");
    });

    it("admits one migration at a time per database", async () => {
      const slow = await plan("other", "slow_one", ["CREATE TABLE slow_one (id int)", "DO $$ BEGIN PERFORM pg_sleep(1.5); END $$"]);
      const fast = await plan("other", "fast_one", ["CREATE TABLE fast_one (id int)"]);
      await approveOnly(slow.id);
      await approveOnly(fast.id);
      const running = authority.execute(slow.id, owner());
      await new Promise((r) => setTimeout(r, 500));
      expect((await row(slow.id)).status).toBe("APPLYING");
      expect(await code(authority.execute(fast.id, owner()))).toBe("MIGRATION_IN_PROGRESS");
      expect(await code(authority.reconcile(slow.id))).toBe("MIGRATION_IN_PROGRESS"); // its session is alive
      expect(await tableExists("other", "fast_one")).toBe(false);
      expect((await running).status).toBe("APPLIED");
      // The waiting plan was rehearsed against the schema before "slow_one": it is sent back, not run blind.
      expect(await code(authority.execute(fast.id, owner()))).toBe("TARGET_CHANGED_SINCE_REHEARSAL");
      expect((await govern(fast.id, "other")).migration.status).toBe("APPLIED");
    });

    it("fails cleanly on a lock timeout and can be retried", async () => {
      await govern((await plan("other", "locked_table", ["CREATE TABLE locked_table (id int)"])).id, "other");
      const change = await plan("other", "alter_locked", ["ALTER TABLE locked_table ADD COLUMN note text"]);
      await approveOnly(change.id);
      const blocker = await pgPool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query(`LOCK TABLE "${schema.other}".locked_table IN ACCESS EXCLUSIVE MODE`);
        expect(await code(authority.execute(change.id, owner()))).toBe("MIGRATION_FAILED");
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
      const failed = await row(change.id);
      expect(failed.status).toBe("FAILED");
      expect(failed.errorMessage).toMatch(/lock timeout/i);
      expect(failed.lifecycle.failure.ledgerChecked).toBe(true);
      expect((await ledger("other")).some((r) => r.name === change.name)).toBe(false);

      const retried = await govern(change.id, "other");
      expect(retried.migration.status).toBe("APPLIED");
      expect(retried.migration.lifecycle.attempt).toBe(2);
    }, 30_000);
  });

  describe("partial failure, interruption and reconciliation", () => {
    it("records a partially applied plan truthfully and resumes it", async () => {
      await govern((await plan("other", "parts", ["CREATE TABLE parts (id int, code text)", "INSERT INTO parts VALUES (1, 'a'), (2, 'b')"])).id, "other");
      const phased = await plan("other", "parts_phased", [
        "CREATE TABLE parts_audit (id int)",
        "CREATE INDEX CONCURRENTLY idx_parts_code ON parts (code)",
        "INSERT INTO parts_audit VALUES (1)",
      ]);
      expect(phased.plan!.statements.map((s) => s.transactional)).toEqual([true, false, true]);
      await approveOnly(phased.id);

      const blocker = await pgPool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query(`LOCK TABLE "${schema.other}".parts IN ACCESS EXCLUSIVE MODE`);
        expect(await code(authority.execute(phased.id, owner()))).toBe("MIGRATION_PARTIALLY_APPLIED");
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
      const partial = await row(phased.id);
      expect(partial.status).toBe("PARTIALLY_APPLIED");
      expect(Object.keys(partial.lifecycle.progress)).toEqual(["1"]);
      expect(partial.lifecycle.partial).toMatchObject({ completedStatements: 1, of: 3 });
      // What the database holds: the first phase, and no claim that the migration is applied.
      expect(await tableExists("other", "parts_audit")).toBe(true);
      expect((await ledger("other")).some((r) => r.name === phased.name)).toBe(false);
      // Other plans wait until it is resolved.
      const waiting = await plan("other", "waits_for_partial", ["CREATE TABLE waits_for_partial (id int)"]);
      expect(await code(authority.preflight(waiting.id))).toBe("UNRESOLVED_MIGRATION");

      const resumed = await authority.execute(phased.id, owner());
      expect(resumed.status).toBe("APPLIED");
      expect(Object.keys(resumed.lifecycle.progress)).toEqual(["1", "2", "3"]);
      expect((await q(`SELECT i.indisvalid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_index i ON i.indexrelid = c.oid WHERE n.nspname = $1 AND c.relname = 'idx_parts_code'`, [schema.other]))[0].indisvalid).toBe(true);
      expect((await q(`SELECT count(*)::int AS n FROM "${schema.other}".parts_audit`))[0].n).toBe(1); // not inserted twice
      expect((await govern(waiting.id, "other")).migration.status).toBe("APPLIED");
    }, 40_000);

    it("reports a killed database session as failed only after checking the target", async () => {
      const created = await plan("other", "killed_session", ["CREATE TABLE killed_session (id int)", "DO $$ BEGIN PERFORM pg_sleep(6); END $$"]);
      await approveOnly(created.id);
      const running = code(authority.execute(created.id, owner()));
      await new Promise((r) => setTimeout(r, 700));
      const killed = await q(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND query LIKE '%pg_sleep(6)%'`);
      expect(killed.length).toBe(1);
      expect(await running).toBe("MIGRATION_FAILED");
      const after = await row(created.id);
      expect(after.status).toBe("FAILED");
      expect(after.lifecycle.failure.ledgerChecked).toBe(true);
      expect(await tableExists("other", "killed_session")).toBe(false); // the transaction never committed
      await authority.cancel(created.id, owner());
    }, 90_000);

    it("reconciles a migration left in flight by a dead process from what the target holds", async () => {
      const abandon = async (id: string) =>
        q(`UPDATE forge_database_migrations SET status = 'APPLYING', "leaseToken" = 'lease_dead', "leaseExpiresAt" = now() - interval '1 minute' WHERE id = $1`, [id]);

      // (a) The process died before anything was committed.
      const nothing = await plan("other", "died_before_commit", ["CREATE TABLE died_before_commit (id int)"]);
      await approveOnly(nothing.id);
      await abandon(nothing.id);
      expect(await code(authority.execute(nothing.id, owner()))).toBe("MIGRATION_IN_PROGRESS"); // never re-run blindly
      const swept = await authority.reconcileInterrupted();
      expect(swept).toContainEqual({ id: nothing.id, status: "FAILED" });
      expect(await tableExists("other", "died_before_commit")).toBe(false);
      expect((await govern(nothing.id, "other")).migration.status).toBe("APPLIED"); // retried through every gate

      // (b) The DDL committed, and the process died before the control plane was told.
      const committed = await plan("other", "died_after_commit", ["CREATE TABLE died_after_commit (id int)"]);
      await approveOnly(committed.id);
      await q(`CREATE TABLE "${schema.other}".died_after_commit (id int)`);
      await q(`INSERT INTO "${schema.other}"._forge_migrations (name, checksum) VALUES ($1, $2)`, [committed.name, committed.checksum]);
      await abandon(committed.id);
      const reconciled = await authority.reconcile(committed.id);
      expect(reconciled.status).toBe("APPLIED");
      expect(reconciled.lifecycle.evidence.ledger).toMatchObject({ name: committed.name, checksum: committed.checksum });
      expect((await row(committed.id)).leaseToken).toBeNull();

      // (c) The target records the name with other SQL: nothing is assumed.
      const mismatch = await plan("other", "ledger_mismatch", ["CREATE TABLE ledger_mismatch (id int)"]);
      await approveOnly(mismatch.id);
      await q(`INSERT INTO "${schema.other}"._forge_migrations (name, checksum) VALUES ($1, repeat('f', 64))`, [mismatch.name]);
      await q(`UPDATE forge_database_migrations SET status = 'RECONCILIATION_REQUIRED' WHERE id = $1`, [mismatch.id]); // the legacy uncertain label
      expect((await authority.reconcile(mismatch.id)).status).toBe("RECOVERY_REQUIRED");
      expect(await code(authority.execute(mismatch.id, owner()))).toBe("NOT_APPROVED");
      const blocked = await plan("other", "blocked_by_recovery", ["CREATE TABLE blocked_by_recovery (id int)"]);
      expect(await code(authority.preflight(blocked.id))).toBe("UNRESOLVED_MIGRATION");
      const fix = await authority.createForwardFixPlan(mismatch.id, { name: name("forward_fix"), statements: ["CREATE TABLE IF NOT EXISTS ledger_mismatch (id int)"] });
      expect(fix.plan).toMatchObject({ fixes: mismatch.id });
      // Clear the unresolved record so later cases are not blocked by it.
      await q(`DELETE FROM "${schema.other}"._forge_migrations WHERE name = $1`, [mismatch.name]);
      await q(`UPDATE forge_database_migrations SET status = 'CANCELLED' WHERE id = ANY($1::uuid[])`, [[mismatch.id, fix.id, blocked.id]]);
    }, 60_000);

    it("reverts a non-production migration as a governed plan", async () => {
      const created = await authority.createPlan({
        databaseId: db.other, projectId: project.other, name: name("revertable"),
        statements: ["CREATE TABLE revertable (id int)"], downSql: "DROP TABLE revertable;",
      });
      await govern(created.id, "other");
      expect(await tableExists("other", "revertable")).toBe(true);

      const reverted = await migrationEngine.rollbackMigration(db.other, created.id, { actor: owner() });
      expect(reverted.status).toBe("ROLLED_BACK");
      expect(await tableExists("other", "revertable")).toBe(false);
      const names = (await ledger("other")).map((r) => r.name);
      expect(names).not.toContain(created.name);
      expect(names.some((n2) => n2.startsWith(`${created.name}__revert_`))).toBe(true);
      const [revert] = await q(`SELECT status, plan, lifecycle FROM forge_database_migrations WHERE "databaseId" = $1 AND name LIKE $2`, [db.other, `${created.name}__revert_%`]);
      expect(revert).toMatchObject({ status: "APPLIED", plan: { reverts: created.id, destructive: true } });
      expect(revert.lifecycle.rehearsals.passed).toBe(true);
    });
  });

  describe("HTTP entry points", () => {
    const call = (path: string, who: "owner" | "outsider" | null, body?: unknown, headers: Record<string, string> = {}) =>
      fetch(`${base}/api/v1/projects/${project.other}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}), ...headers },
        body: JSON.stringify(body ?? {}),
      }).then(async (res) => ({ status: res.status, json: await res.json().catch(() => null) }));

    it("unified-execute plans and runs real DDL, with no defaults and no success without evidence", async () => {
      expect((await call("/database/migrations/unified-execute", null, {})).status).toBe(401);
      expect([403, 404]).toContain((await call("/database/migrations/unified-execute", "outsider", { databaseId: db.other, name: "x", statements: ["CREATE TABLE x (id int)"] })).status);
      expect((await call("/database/migrations/unified-execute", "owner", {})).status).toBe(400);
      expect((await call("/database/migrations/unified-execute", "owner", { databaseId: db.dev, name: "cross", statements: ["CREATE TABLE cross_project (id int)"] })).status).toBe(403);

      const key = `http-${randomUUID()}`;
      const body = { databaseId: db.other, name: name("http_table"), statements: ["CREATE TABLE http_table (id int)"], environment: "DEVELOPMENT" };
      const ok = await call("/database/migrations/unified-execute", "owner", body, { "Idempotency-Key": key });
      expect(ok.status).toBe(200);
      expect(ok.json).toMatchObject({ success: true, approvalRequired: false, migration: { status: "APPLIED" } });
      expect(ok.json.migration.lifecycle.evidence.ledger.name).toBe(body.name);
      expect(await tableExists("other", "http_table")).toBe(true);
      const repeat = await call("/database/migrations/unified-execute", "owner", body, { "Idempotency-Key": key });
      expect(repeat.json).toMatchObject({ replayed: true, migration: { id: ok.json.migration.id } });

      const broken = await call("/database/migrations/unified-execute", "owner", { databaseId: db.other, name: name("http_broken"), statements: ["ALTER TABLE no_such_table ADD COLUMN x int"] });
      expect(broken.status).toBe(422);
      expect(broken.json.error.code).toBe("REHEARSAL_FAILED");
      expect((await call("/database/migrations/unified-execute", "owner", { databaseId: db.other, name: name("http_env"), statements: ["CREATE TABLE http_env (id int)"], environment: "PRODUCTION" })).status).toBe(403);
      expect(await tableExists("other", "http_env")).toBe(false);
    });

    it("exposes each lifecycle step, and the legacy apply route goes through the same gates", async () => {
      const planned = await call(`/database/${db.other}/migrations/plan`, "owner", { name: name("http_steps"), statements: ["CREATE TABLE http_steps (id int)"] });
      expect(planned.status).toBe(201);
      const id = planned.json.migration.id;
      const step = (s: string, body?: unknown) => call(`/database/${db.other}/migrations/${id}/${s}`, "owner", body);
      expect((await step("execute")).json.error.code).toBe("NOT_APPROVED");
      expect((await step("preflight")).json.migration.status).toBe("PREFLIGHT_PASSED");
      expect((await step("rehearse")).json.migration.status).toBe("REHEARSED");
      expect((await step("approve")).json.migration.status).toBe("APPROVED");
      expect([403, 404]).toContain((await call(`/database/${db.other}/migrations/${id}/execute`, "outsider")).status);
      expect((await step("execute")).json.migration.status).toBe("APPLIED");
      expect(await tableExists("other", "http_steps")).toBe(true);
      // A step addressed through another database of the same owner is refused.
      const wrong = await fetch(`${base}/api/v1/projects/${project.dev}/database/${db.dev}/migrations/${id}/reconcile`, { method: "POST", headers: { Authorization: `Bearer ${tokens.owner}` } });
      expect(wrong.status).toBe(403);

      const legacy = await migrationEngine.createMigration(db.other, project.other, name("legacy_apply"), "CREATE TABLE legacy_apply (id int);");
      const applied = await call(`/database/${db.other}/migrations/${legacy.id}/apply`, "owner");
      expect(applied.status).toBe(200);
      expect(applied.json.migration.status).toBe("APPLIED");
      expect(applied.json.migration.lifecycle.rehearsals.passed).toBe(true);
      expect(await tableExists("other", "legacy_apply")).toBe(true);
    });
  });
});
