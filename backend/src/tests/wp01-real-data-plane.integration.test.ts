/**
 * WP-00 / WP-01 disposable, real PostgreSQL / real HTTP test.
 * Never run against user data: it hard-fails unless the dedicated ephemeral DB
 * name, loopback host and explicit opt-in all agree.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { prisma, pgPool } from "../config/prisma.js";
import { dataRoutes } from "../modules/data-platform/data-layer/data.routes.js";
import { provisionDatabase, deprovisionDatabase } from "../modules/data-platform/database/database-provisioner.service.js";
import { TenantPoolManager } from "../modules/data-platform/common/pool-manager.js";
import { generateApiKey } from "../modules/data-platform/common/crypto.utils.js";
import { injectRlsClaims } from "../modules/data-platform/data-layer/rls-claim-injector.js";

const url = new URL(process.env.DATABASE_URL || "http://invalid/");
if (process.env.FORGE_DISPOSABLE_TEST_DB !== "1" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.pathname !== "/forge_phase2_fresh" ||
    process.env.NODE_ENV !== "test") {
  throw new Error("WP-01 live test requires opted-in disposable loopback forge_phase2_fresh");
}

describe("WP-01 live tenant database + data endpoint isolation", () => {
  let server: Server | undefined;
  let origin = "";
  const marker = randomUUID();
  const owners: string[] = [];
  const sites: string[] = [];
  const sessions: string[] = [];
  const databases: string[] = [];
  let publicA = "";
  let publicB = "";
  let readOnlyA = "";
  let devOnlyA = "";
  let ownerSession = "";
  let outsiderSession = "";
  let collaboratorSession = "";

  async function request(method: string, site: string, path: string, key?: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (key) headers.apikey = key;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(origin + "/api/v1/data/" + site + "/" + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    return { status: response.status, payload };
  }

  async function fixture(site: string, note: string) {
    const record = await provisionDatabase(site, "PRODUCTION");
    databases.push(record.id);
    const pool = await TenantPoolManager.getTenantPool(site, "PRODUCTION");
    const info = await pool.query(
      "SELECT current_user AS role, current_database() AS db, " +
      "(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) AS unsafe"
    );
    expect(info.rows[0]).toMatchObject({ role: record.dbUser, db: record.dbName, unsafe: false });
    await pool.query("CREATE TABLE public.orders (id serial PRIMARY KEY, owner_id text NOT NULL, note text NOT NULL)");
    await pool.query("ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY");
    await pool.query("ALTER TABLE public.orders FORCE ROW LEVEL SECURITY");
    await pool.query(
      "CREATE POLICY customer_rows ON public.orders FOR ALL " +
      "USING (owner_id = current_setting('request.jwt.claim.sub', true)) " +
      "WITH CHECK (owner_id = current_setting('request.jwt.claim.sub', true))"
    );
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await injectRlsClaims(client, { role: "anon", sub: "anon", isServiceRole: false });
      await client.query("INSERT INTO public.orders (owner_id, note) VALUES ($1, $2)", ["anon", note]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally { client.release(); }
    return record;
  }

  async function keyFor(dbId: string, keyType: "ANON" | "SERVICE_ROLE", scopes: string[]) {
    const issued = generateApiKey(keyType);
    await prisma.projectApiKey.create({
      data: { databaseId: dbId, name: "WP-01 isolated credential", keyType,
        tokenHash: issued.tokenHash, prefix: issued.prefix, scopes },
    });
    return issued.key;
  }

  async function sessionFor(userId: string) {
    const secret = randomUUID() + randomUUID();
    const hash = createHash("sha256").update(secret).digest("hex");
    await prisma.session.create({
      data: { userId, tokenHash: hash, authEpoch: 1,
        authMethod: "local", audience: "TENANT", authTime: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    sessions.push(hash);
    return secret;
  }

  beforeAll(async () => {
    const alice = await prisma.user.create({
      data: { email: "wp01-a-" + marker + "@example.test", fullName: "Scope Owner A",
        status: "ACTIVE", authEpoch: 1 },
    });
    owners.push(alice.id);
    const bob = await prisma.user.create({
      data: { email: "wp01-b-" + marker + "@example.test", fullName: "Scope Owner B",
        status: "ACTIVE", authEpoch: 1 },
    });
    owners.push(bob.id);
    for (const [index, user] of [alice, bob].entries()) {
      const site = await prisma.website.create({
        data: { userId: user.id, name: "WP01 site " + index,
          slug: "wp01-" + marker + "-" + index },
      });
      sites.push(site.id);
    }
    const dbA = await fixture(sites[0], "isolated_a");
    const dbB = await fixture(sites[1], "isolated_b");
    expect(dbA.dbName).not.toBe(dbB.dbName);
    expect(dbA.dbUser).not.toBe(dbB.dbUser);
    publicA = await keyFor(dbA.id, "ANON", ["data:read", "data:write"]);
    publicB = await keyFor(dbB.id, "ANON", ["data:read"]);
    readOnlyA = await keyFor(dbA.id, "ANON", ["data:read"]);
    const devIssued = generateApiKey("SERVICE_ROLE");
    await prisma.projectApiKey.create({
      data: { databaseId: dbA.id, name: "Dev-only fixture key",
        keyType: "SERVICE_ROLE", prefix: devIssued.prefix,
        tokenHash: devIssued.tokenHash, scopes: ["data:read"] },
    });
    devOnlyA = devIssued.key;
    ownerSession = await sessionFor(alice.id);
    outsiderSession = await sessionFor(bob.id);
    const editor = await prisma.user.create({
      data: { email: "wp01-editor-" + marker + "@example.test",
        fullName: "Website Collaborator", status: "ACTIVE", authEpoch: 1 },
    });
    owners.push(editor.id);
    await prisma.websiteCollaborator.create({
      data: { websiteId: sites[0], userId: editor.id, permission: "EDITOR" },
    });
    collaboratorSession = await sessionFor(editor.id);

    const app = express();
    app.use(express.json());
    app.use("/api/v1/data", dataRoutes);
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({ error: { code: err.code || "INTERNAL_ERROR" } });
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    origin = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  }, 120_000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    for (const site of sites) {
      await TenantPoolManager.closeTenantPool(site, "PRODUCTION").catch(() => undefined);
      await deprovisionDatabase(site, "PRODUCTION").catch(() => undefined);
    }
    await prisma.website.deleteMany({ where: { id: { in: sites } } }).catch(() => undefined);
    await prisma.session.deleteMany({ where: { tokenHash: { in: sessions } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: owners } } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  }, 120_000);

  it("serves only the physical tenant database belonging to the provided key", async () => {
    const a = await request("GET", sites[0], "orders?environment=PRODUCTION", publicA);
    const b = await request("GET", sites[1], "orders?environment=PRODUCTION", publicB);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.payload.data.map((r: any) => r.note)).toEqual(["isolated_a"]);
    expect(b.payload.data.map((r: any) => r.note)).toEqual(["isolated_b"]);
  });

  it("rejects another website's key, missing key and invalid environment", async () => {
    expect((await request("GET", sites[0], "orders?environment=PRODUCTION", publicB)).status).toBe(401);
    expect((await request("GET", sites[0], "orders?environment=PRODUCTION")).status).toBe(401);
    expect((await request("GET", sites[0], "orders?environment=FORGED", publicA)).status).toBe(400);
  });

  it("rejects a key restricted to another environment", async () => {
    const keyRecord = await prisma.projectApiKey.findFirst({
      where: { tokenHash: createHash("sha256").update(devOnlyA).digest("hex") },
    });
    expect(keyRecord).toBeTruthy();
    // Stored for a PRODUCTION database: DEVELOPMENT cannot use this credential.
    expect((await request("GET", sites[0], "orders?environment=DEVELOPMENT", devOnlyA)).status).toBe(401);
  });

  it("rejects a read-only key for mutating requests", async () => {
    const result = await request("POST", sites[0], "orders?environment=PRODUCTION",
      readOnlyA, { owner_id: "anon", note: "forbidden" });
    expect(result.status).toBe(403);
    const remaining = await request("GET", sites[0], "orders?environment=PRODUCTION", publicA);
    expect(remaining.payload.data.map((r: any) => r.note)).toEqual(["isolated_a"]);
  });

  it("verifies live session membership rather than accepting any valid bearer session", async () => {
    const other = await fetch(origin + "/api/v1/data/" + sites[0] + "/orders?environment=PRODUCTION",
      { headers: { Authorization: "Bearer " + outsiderSession } });
    expect(other.status).toBe(404);
    const own = await fetch(origin + "/api/v1/data/" + sites[0] + "/orders?environment=PRODUCTION",
      { headers: { Authorization: "Bearer " + ownerSession } });
    expect(own.status).toBe(200);
  });

  it("rejects production writes from authenticated read-only collaborators", async () => {
    const baseUrl = origin + "/api/v1/data/" + sites[0] + "/orders?environment=PRODUCTION";
    const read = await fetch(baseUrl, { headers: { Authorization: "Bearer " + collaboratorSession } });
    expect(read.status).toBe(200);
    expect((await read.json()).data).toEqual([]); // RLS hides rows owned by anon
    const write = await fetch(baseUrl, {
      method: "POST", headers: { Authorization: "Bearer " + collaboratorSession,
        "Content-Type": "application/json" },
      body: JSON.stringify({ owner_id: "anon", note: "unauthorized" }),
    });
    expect(write.status).toBe(403);
    expect((await write.json()).error.code).toBe("PRODUCTION_WRITE_FORBIDDEN");
  });

  it("does not let authenticated sessions read tables without FORCE RLS", async () => {
    const pool = await TenantPoolManager.getTenantPool(sites[0], "PRODUCTION");
    await pool.query("CREATE TABLE IF NOT EXISTS public.session_unprotected (id int, secret text)");
    const denied = await fetch(origin + "/api/v1/data/" + sites[0] + "/session_unprotected?environment=PRODUCTION",
      { headers: { Authorization: "Bearer " + ownerSession } });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("PUBLIC_RLS_REQUIRED");
  });

  it("coalesces concurrent tenant pool initialization to one verified pool", async () => {
    await TenantPoolManager.closeTenantPool(sites[1], "PRODUCTION");
    const [left, right, third] = await Promise.all([
      TenantPoolManager.getTenantPool(sites[1], "PRODUCTION"),
      TenantPoolManager.getTenantPool(sites[1], "PRODUCTION"),
      TenantPoolManager.getTenantPool(sites[1], "PRODUCTION"),
    ]);
    expect(left).toBe(right);
    expect(right).toBe(third);
  });

  it("never silently provisions a tenant database on an HTTP read", async () => {
    const unprovisioned = await prisma.website.create({
      data: { userId: owners[0], name: "Nonprovisioned tenant",
        slug: "wp01-unprovisioned-" + marker },
    });
    sites.push(unprovisioned.id);
    const response = await fetch(origin + "/api/v1/data/" + unprovisioned.id +
      "/orders?environment=PRODUCTION", { headers: { Authorization: "Bearer " + ownerSession } });
    expect(response.status).toBe(404);
    const row = await prisma.projectDatabase.findFirst({ where: { websiteId: unprovisioned.id } });
    expect(row).toBeNull();
  });

  it("rejects non-FORCE-RLS tables despite a valid anonymous project API key", async () => {
    const pool = await TenantPoolManager.getTenantPool(sites[0], "PRODUCTION");
    await pool.query("CREATE TABLE public.internal_only (id int)");
    const denied = await request("GET", sites[0], "internal_only?environment=PRODUCTION", publicA);
    expect(denied.status).toBe(403);
    expect(denied.payload.error.code).toBe("PUBLIC_RLS_REQUIRED");
  });

  it("rejects forged SQL table identifiers and revoked keys", async () => {
    const invalid = await request("GET", sites[0], "orders%3BDELETE?environment=PRODUCTION", publicA);
    expect(invalid.status).toBe(400);
    const hashed = createHash("sha256").update(publicA).digest("hex");
    await prisma.projectApiKey.updateMany({ where: { tokenHash: hashed }, data: { revokedAt: new Date() } });
    const revoked = await request("GET", sites[0], "orders?environment=PRODUCTION", publicA);
    expect(revoked.status).toBe(401);
  });
});
