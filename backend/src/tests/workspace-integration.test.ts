import { runDocumentContracts } from "./document-contracts.js";
import { runWorkspaceLifecycleContracts } from "./workspace-lifecycle.contracts.js";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma, pgPool } from "../config/prisma.js";
import { assignDefaultFreePlan } from "../services/subscription.service.js";
import * as workspaces from "../services/workspaces/workspace-api.service.js";
import workspaceRouter from "../routes/tenant-workspace.routes.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";

// This suite intentionally creates fixtures and exercises a migration. It must
// never accept a production URL, an arbitrary database name, or an implicit opt-in.
const database = new URL(process.env.DATABASE_URL || "invalid:");
if (process.env.FORGE_DISPOSABLE_TEST_DB !== "1" ||
    !["localhost", "127.0.0.1"].includes(database.hostname) || database.pathname !== "/forge_hardening") {
  throw new Error("Workspace integration tests require the explicitly opted-in local forge_hardening database");
}

test("workspace contracts on disposable PostgreSQL", async (t) => {
  t.after(async () => { await prisma.$disconnect(); await pgPool.end(); });
  // db push is used only to prepare the disposable legacy schema. Recreate only
  // these new, empty fixture tables to exercise their actual additive migration.
  await pgPool.query('DROP TABLE IF EXISTS workspace_outbox, workspace_command_journal');
  await pgPool.query(readFileSync("prisma/migrations/20260928090000_workspace_command_journal/migration.sql", "utf8"));
  const owner = await prisma.user.create({ data: { fullName: "Fixture owner", email: `owner-${randomUUID()}@example.test`, status: "ACTIVE" } });
  const member = await prisma.user.create({ data: { fullName: "Fixture member", email: `member-${randomUUID()}@example.test`, status: "ACTIVE" } });
  const outsider = await prisma.user.create({ data: { fullName: "Fixture outsider", email: `outsider-${randomUUID()}@example.test`, status: "ACTIVE" } });
  await prisma.subscriptionPlan.upsert({ where: { slug: "free" }, update: {}, create: {
    name: "Fixture free", slug: "free", price: 0, currency: "INR", billingInterval: "monthly", websiteLimit: 1, features: [],
  } });
  await assignDefaultFreePlan(owner.id);
  const first = await workspaces.createTenantWorkspace(owner.id, { name: "Engineering" }, "create-engineering-1");
  const firstId = first.resourceId;
  const organizationId = first.workspace.organizationId!;
  await prisma.organizationMember.create({ data: { organizationId, userId: member.id, role: "MEMBER" } });
  const finance = await workspaces.createTenantWorkspace(owner.id, { name: "Finance", organizationId }, "create-finance-1");

  await t.test("concurrent duplicate create yields one workspace, audit and outbox", async () => {
    const input = { name: "Concurrent", organizationId };
    const results = await Promise.all([
      workspaces.createTenantWorkspace(owner.id, input, "concurrent-create-1"),
      workspaces.createTenantWorkspace(owner.id, input, "concurrent-create-1"),
    ]);
    assert.equal(results[0].resourceId, results[1].resourceId);
    assert.equal(await prisma.workspace.count({ where: { organizationId, name: "Concurrent" } }), 1);
    const { rows } = await pgPool.query('SELECT count(*)::int AS count FROM workspace_outbox WHERE "resourceId"=$1', [results[0].resourceId]);
    assert.equal(rows[0].count, 1);
  });

  await t.test("same key with different payload conflicts", async () => {
    await assert.rejects(workspaces.createTenantWorkspace(owner.id, { name: "Different" }, "create-engineering-1"), { code: "IDEMPOTENCY_CONFLICT" });
  });

  await t.test("organization membership alone grants no sibling workspace access", async () => {
    await workspaces.addTenantWorkspaceMember(owner.id, firstId, member.id, "MEMBER", "add-member-1");
    const visible = await workspaces.listTenantWorkspaces(member.id);
    assert.deepEqual(visible.workspaces.map((entry) => entry.id), [firstId]);
    await assert.rejects(workspaces.readTenantWorkspace(member.id, finance.resourceId), { code: "NOT_FOUND" });
    await assert.rejects(workspaces.readTenantWorkspace(outsider.id, firstId), { code: "NOT_FOUND" });
  });

  await t.test("membership commands reject escalation and owner removal", async () => {
    await assert.rejects(workspaces.addTenantWorkspaceMember(member.id, firstId, outsider.id, "ADMIN", "escalate-admin-1"), { code: "FORBIDDEN" });
    await assert.rejects(workspaces.addTenantWorkspaceMember(owner.id, firstId, outsider.id, "MEMBER", "cross-org-member-1"), { code: "NOT_FOUND" });
    await assert.rejects(workspaces.removeTenantWorkspaceMember(owner.id, firstId, owner.id, "remove-owner-1"), { code: "OWNER_TRANSFER_REQUIRED" });
  });

  await t.test("concurrent website creation cannot consume the same last quota slot", async () => {
    const results = await Promise.allSettled([
      workspaces.createTenantWorkspaceWebsite(owner.id, firstId, "Site A", "quota-site-a-1"),
      workspaces.createTenantWorkspaceWebsite(owner.id, firstId, "Site B", "quota-site-b-1"),
    ]);
    assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
    assert.equal(await prisma.website.count({ where: { userId: owner.id } }), 1);
    const rejection = results.find((entry) => entry.status === "rejected");
    assert.equal(rejection?.status === "rejected" && rejection.reason.code, "WEBSITE_LIMIT_EXCEEDED");
  });

  await t.test("audit failure rolls back workspace mutation, result and intent", async () => {
    await pgPool.query(`CREATE FUNCTION reject_workspace_audit_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action = 'WORKSPACE_CREATED' THEN RAISE EXCEPTION 'fixture audit unavailable'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_workspace_audit_fixture BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_workspace_audit_fixture();`);
    try {
      await assert.rejects(workspaces.createTenantWorkspace(owner.id, { name: "Must rollback", organizationId }, "audit-rollback-1"));
      assert.equal(await prisma.workspace.count({ where: { organizationId, name: "Must rollback" } }), 0);
      const { rows } = await pgPool.query('SELECT count(*)::int AS count FROM workspace_command_journal WHERE "idempotencyKey"=$1', ["audit-rollback-1"]);
      assert.equal(rows[0].count, 0);
    } finally {
      await pgPool.query('DROP TRIGGER reject_workspace_audit_fixture ON audit_logs; DROP FUNCTION reject_workspace_audit_fixture()');
    }
  });

  await t.test("new journal and outbox enforce forced RLS under a non-owner role", async () => {
    // Roles are cluster-wide, unlike the disposable database. A per-run role
    // avoids collisions with another test DB and is always revoked and dropped.
    const rlsRole = `forge_workspace_rls_${randomUUID().replaceAll("-", "")}`;
    assert.match(rlsRole, /^forge_workspace_rls_[a-f0-9]{32}$/);
    await pgPool.query(`CREATE ROLE "${rlsRole}" NOLOGIN NOSUPERUSER NOBYPASSRLS;
      GRANT SELECT, INSERT ON workspace_command_journal, workspace_outbox TO "${rlsRole}"`);
    const client = await pgPool.connect();
    try {
      await client.query(`BEGIN; SET LOCAL ROLE "${rlsRole}"`);
      await client.query("SELECT set_config('app.tenant_id',$1,true)", [organizationId]);
      assert.ok((await client.query('SELECT id FROM workspace_outbox')).rows.length > 0);
      await client.query("SELECT set_config('app.tenant_id',$1,true)", [randomUUID()]);
      assert.equal((await client.query('SELECT id FROM workspace_outbox')).rows.length, 0);
      await assert.rejects(client.query('INSERT INTO workspace_outbox ("organizationId","actorId",operation,"resourceId") VALUES ($1,$2,$3,$4)', [organizationId, owner.id, "FORBIDDEN_TEST", firstId]), { code: "42501" });
      await client.query('ROLLBACK');
      await client.query(`BEGIN; SET LOCAL ROLE "${rlsRole}"`);
      assert.equal((await client.query('SELECT id FROM workspace_outbox')).rows.length, 0);
      await client.query('COMMIT');
    } finally {
      await client.query('ROLLBACK'); client.release();
      await pgPool.query(`REVOKE ALL PRIVILEGES ON workspace_command_journal, workspace_outbox FROM "${rlsRole}"; DROP ROLE "${rlsRole}"`);
    }
    const { rows } = await pgPool.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('workspace_outbox','workspace_command_journal')");
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));
  });

  await t.test("HTTP boundary validates identity, intent, schema and membership", async () => {
    const token = randomUUID();
    await prisma.session.create({ data: { authEpoch: 1, authMethod: "local", authTime: new Date(), audience: "TENANT", userId: member.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now()+60000) } });
    const app = express(); app.use(express.json({ limit: "32kb" }), cookieParser());
    app.use("/api/v1/tenant-workspaces", workspaceRouter); app.use(errorMiddleware);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api/v1/tenant-workspaces`;
    try {
      assert.equal((await fetch(base)).status, 401);
      const headers = { Cookie: `forge_session=${token}`, "Content-Type": "application/json" };
      const visible = await fetch(`${base}/${firstId}`, { headers }); assert.equal(visible.status, 200);
      assert.equal((await fetch(`${base}/${finance.resourceId}`, { headers })).status, 404);
      assert.equal((await fetch(base, { method: "POST", headers, body: JSON.stringify({ name: "No intent" }) })).status, 403);
      assert.equal((await fetch(base, { method: "POST", headers: { ...headers, "X-Forge-Intent": "workspace-command", "Idempotency-Key": "http-schema-1" }, body: JSON.stringify({ name: "X", ownerId: outsider.id }) })).status, 400);
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  });

  await t.test("organization revocation invalidates retained workspace membership", async () => {
    await prisma.organizationMember.delete({ where: { organizationId_userId: { organizationId, userId: member.id } } });
    await assert.rejects(workspaces.readTenantWorkspace(member.id, firstId), { code: "NOT_FOUND" });
    assert.equal((await workspaces.listTenantWorkspaces(member.id)).workspaces.length, 0);
  });
  await runWorkspaceLifecycleContracts(t);
  await runDocumentContracts(t);

});
