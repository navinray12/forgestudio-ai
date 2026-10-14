/**
 * Approved website purge (blueprint §10: independent approver, expiring approval, exact manifest,
 * fresh authority/hold checks, explicit single-owner exception with protected audit).
 *
 * Runs the real Express app with real sessions against the disposable database. Every website here
 * is created by this test; nothing outside its own fixtures is deleted.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/website-purge.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

type Role = "owner" | "coadmin" | "editor" | "outsider" | "solo";

describe.skipIf(!optedIn)("Approved website purge (real app, disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const { default: app } = await import("../app.js");

  const marker = randomUUID().slice(0, 8);
  const tokens: Record<string, string> = {};
  const ids: Record<Role, string> = {} as any;
  const sites: string[] = [];
  let server: Server;
  let base = "";

  async function api(method: string, path: string, who: string | null, body?: unknown) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }
  const code = (r: { json: any }) => r.json?.code ?? r.json?.error?.code;
  const q = async (sql: string, params: unknown[] = []) => (await pgPool.query(sql, params)).rows;

  async function session(name: string, userId: string, authTime: Date) {
    const token = `purge-${name}-${randomUUID()}`;
    await prisma.session.create({
      data: {
        userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000),
        authEpoch: 1, audience: "TENANT", authTime, authMethod: "local", lastUsedAt: new Date(),
      },
    });
    tokens[name] = token;
  }

  /** A trashed website owned by `owner`, optionally with an ADMIN and an EDITOR collaborator. */
  async function trashedSite(label: string, owner: Role, withTeam: boolean) {
    const site = await prisma.website.create({
      data: { userId: ids[owner], name: `Purge ${label} ${marker}`, slug: `purge-${label}-${marker}`, status: "TRASH", deletedAt: new Date() } as any,
    });
    sites.push(site.id);
    if (withTeam) {
      await prisma.websiteCollaborator.create({ data: { websiteId: site.id, userId: ids.coadmin, permission: "ADMIN" } });
      await prisma.websiteCollaborator.create({ data: { websiteId: site.id, userId: ids.editor, permission: "EDITOR" } });
    }
    return { id: site.id, slug: site.slug };
  }

  const requestBody = (slug: string, extra: Record<string, unknown> = {}) => ({ reason: "Client offboarded", confirmNameOrSlug: slug, ...extra });
  const exists = async (id: string) => (await q(`SELECT count(*)::int AS n FROM websites WHERE id = $1`, [id]))[0].n === 1;

  beforeAll(async () => {
    await ensureDatabaseTables();
    for (const role of ["owner", "coadmin", "editor", "outsider", "solo"] as const) {
      const user = await prisma.user.create({
        data: { fullName: `Purge ${role}`, email: `purge-${role}-${marker}@example.test`, status: "ACTIVE", authEpoch: 1 } as any,
      });
      ids[role] = user.id;
      await session(role, user.id, new Date(Date.now() - 1000));
    }
    await session("solo-stale", ids.solo, new Date(Date.now() - 60 * 60 * 1000));
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    await new Promise((r) => server?.close(r));
    await pgPool.query(`DELETE FROM website_purge_requests WHERE "websiteId" = ANY($1::uuid[])`, [sites]).catch(() => undefined);
    await prisma.website.deleteMany({ where: { id: { in: sites } } }).catch(() => undefined);
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  });

  it("no longer purges directly, whatever flags the client sends", async () => {
    const site = await trashedSite("direct", "owner", true);
    const direct = await api("DELETE", `/api/websites/${site.id}/purge`, "owner", { confirmNameOrSlug: site.slug, forceImmediatePurge: true });
    expect(direct.status).not.toBe(200);
    expect(await exists(site.id)).toBe(true);
  });

  it("accepts a purge request only from the owner, for a trashed website, with a reason and confirmation", async () => {
    const site = await trashedSite("request", "owner", true);
    const path = `/api/websites/${site.id}/purge-requests`;
    expect((await api("POST", path, null, requestBody(site.slug))).status).toBe(401);
    expect((await api("POST", path, "outsider", requestBody(site.slug))).status).toBe(404);
    expect((await api("POST", path, "editor", requestBody(site.slug))).status).toBe(403);
    expect((await api("POST", path, "coadmin", requestBody(site.slug))).status).toBe(403);
    expect(code(await api("POST", path, "owner", { confirmNameOrSlug: site.slug }))).toBe("REASON_REQUIRED");
    expect(code(await api("POST", path, "owner", requestBody("wrong-name")))).toBe("CONFIRMATION_MISMATCH");
    // Another admin exists, so the requester cannot wave through their own purge.
    expect(code(await api("POST", path, "owner", requestBody(site.slug, { singleOwnerException: true })))).toBe("INDEPENDENT_APPROVER_AVAILABLE");

    const live = await prisma.website.create({ data: { userId: ids.owner, name: `Live ${marker}`, slug: `purge-live-${marker}` } });
    sites.push(live.id);
    expect(code(await api("POST", `/api/websites/${live.id}/purge-requests`, "owner", requestBody(live.slug)))).toBe("WEBSITE_NOT_IN_TRASH");

    process.env.FORGE_TRASH_RETENTION_DAYS = "30";
    try {
      expect(code(await api("POST", path, "owner", requestBody(site.slug, { forceImmediatePurge: true })))).toBe("RETENTION_PERIOD_ACTIVE");
    } finally {
      delete process.env.FORGE_TRASH_RETENTION_DAYS;
    }
    expect(await q(`SELECT count(*)::int AS n FROM website_purge_requests WHERE "websiteId" = $1`, [site.id])).toEqual([{ n: 0 }]);
  });

  it("requires a different owner/admin to approve and refuses to execute without it", async () => {
    const site = await trashedSite("approve", "owner", true);
    const created = await api("POST", `/api/websites/${site.id}/purge-requests`, "owner", requestBody(site.slug));
    expect(created.status).toBe(201);
    expect(created.json.data).toMatchObject({ status: "PENDING_APPROVAL", requestedById: ids.owner, approvedById: null });
    const req = `/api/websites/${site.id}/purge-requests/${created.json.data.id}`;

    expect(code(await api("POST", `${req}/execute`, "owner"))).toBe("INVALID_STATE");
    expect(code(await api("POST", `${req}/approve`, "owner"))).toBe("INDEPENDENT_APPROVER_REQUIRED");
    expect((await api("POST", `${req}/approve`, "editor")).status).toBe(403);
    expect((await api("POST", `${req}/approve`, "outsider")).status).toBe(404);
    expect(await exists(site.id)).toBe(true);

    const approved = await api("POST", `${req}/approve`, "coadmin");
    expect(approved.json.data).toMatchObject({ status: "APPROVED", approvedById: ids.coadmin });
    // The approver is not the owner and cannot execute; another website's path cannot reach this request.
    expect((await api("POST", `${req}/execute`, "coadmin")).status).toBe(403);
    const other = await trashedSite("other", "outsider", false);
    expect((await api("POST", `/api/websites/${other.id}/purge-requests/${created.json.data.id}/execute`, "outsider")).status).toBe(404);
    expect((await api("POST", `/api/websites/${other.id}/purge-requests/${created.json.data.id}/approve`, "outsider")).status).toBe(404);
    expect(await exists(site.id)).toBe(true);
  });

  it("purges nothing when the website changed after approval or the approval expired", async () => {
    const site = await trashedSite("stale", "owner", true);
    const make = async () => {
      const created = await api("POST", `/api/websites/${site.id}/purge-requests`, "owner", requestBody(site.slug));
      const req = `/api/websites/${site.id}/purge-requests/${created.json.data.id}`;
      expect((await api("POST", `${req}/approve`, "coadmin")).status).toBe(200);
      return { id: created.json.data.id as string, req };
    };

    // A record arrives after approval: the approved manifest no longer describes the website.
    const first = await make();
    await pgPool.query(`INSERT INTO form_submissions (id, "websiteId", "formId", data, "createdAt") VALUES (gen_random_uuid(), $1, 'late', '{}'::jsonb, now())`, [site.id]);
    expect(code(await api("POST", `${first.req}/execute`, "owner"))).toBe("MANIFEST_CHANGED");
    expect(await exists(site.id)).toBe(true);
    expect((await q(`SELECT status FROM website_purge_requests WHERE id = $1`, [first.id]))[0].status).toBe("APPROVED");

    // Restored and trashed again: an old approval does not carry over.
    const second = await make();
    await prisma.website.update({ where: { id: site.id }, data: { status: "DRAFT", deletedAt: null } as any });
    expect(code(await api("POST", `${second.req}/execute`, "owner"))).toBe("MANIFEST_CHANGED");
    await prisma.website.update({ where: { id: site.id }, data: { status: "TRASH", deletedAt: new Date(Date.now() + 1000) } as any });
    expect(code(await api("POST", `${second.req}/execute`, "owner"))).toBe("MANIFEST_CHANGED");

    const third = await make();
    await pgPool.query(`UPDATE website_purge_requests SET "expiresAt" = now() - interval '1 second' WHERE id = $1`, [third.id]);
    expect(code(await api("POST", `${third.req}/execute`, "owner"))).toBe("APPROVAL_EXPIRED");
    expect((await q(`SELECT status FROM website_purge_requests WHERE id = $1`, [third.id]))[0].status).toBe("EXPIRED");
    expect(await exists(site.id)).toBe(true);
  });

  it("purges an approved, unchanged website and keeps the record of who approved it", async () => {
    const site = await trashedSite("execute", "owner", true);
    await pgPool.query(`INSERT INTO form_submissions (id, "websiteId", "formId", data, "createdAt") VALUES (gen_random_uuid(), $1, 'contact', '{}'::jsonb, now())`, [site.id]);
    const created = await api("POST", `/api/websites/${site.id}/purge-requests`, "owner", requestBody(site.slug));
    const req = `/api/websites/${site.id}/purge-requests/${created.json.data.id}`;
    expect(created.json.data.manifest).toMatchObject({ websiteId: site.id, slug: site.slug, counts: { formSubmissions: 1 } });
    await api("POST", `${req}/approve`, "coadmin");

    const executed = await api("POST", `${req}/execute`, "owner");
    expect(executed.status).toBe(200);
    expect(await exists(site.id)).toBe(false);
    expect(await q(`SELECT count(*)::int AS n FROM form_submissions WHERE "websiteId" = $1`, [site.id])).toEqual([{ n: 0 }]);

    const [record] = await q(`SELECT status, "requestedById", "approvedById", "executedById", "singleOwnerException" FROM website_purge_requests WHERE id = $1`, [created.json.data.id]);
    expect(record).toEqual({ status: "EXECUTED", requestedById: ids.owner, approvedById: ids.coadmin, executedById: ids.owner, singleOwnerException: false });
    const audit = await prisma.auditLog.findFirst({ where: { action: "WEBSITE_PERMANENTLY_PURGED", targetResource: `website:${site.id}` } });
    expect(audit).not.toBeNull();
    expect((await api("POST", `${req}/execute`, "owner")).status).not.toBe(200);
  });

  it("allows the single-owner exception only without another admin and with a recent sign-in", async () => {
    const site = await trashedSite("solo", "solo", false);
    const path = `/api/websites/${site.id}/purge-requests`;
    expect(code(await api("POST", path, "solo-stale", requestBody(site.slug, { singleOwnerException: true })))).toBe("REAUTHENTICATION_REQUIRED");

    // Without the explicit exception the request still waits for an approver that does not exist.
    const pending = await api("POST", path, "solo", requestBody(site.slug));
    expect(pending.json.data.status).toBe("PENDING_APPROVAL");
    expect(code(await api("POST", `${path}/${pending.json.data.id}/approve`, "solo"))).toBe("INDEPENDENT_APPROVER_REQUIRED");

    const exception = await api("POST", path, "solo", requestBody(site.slug, { singleOwnerException: true }));
    expect(exception.json.data).toMatchObject({ status: "APPROVED", singleOwnerException: true, approvedById: ids.solo });
    expect(code(await api("POST", `${path}/${exception.json.data.id}/execute`, "solo-stale"))).toBe("REAUTHENTICATION_REQUIRED");
    expect(await exists(site.id)).toBe(true);
    expect((await api("POST", `${path}/${exception.json.data.id}/execute`, "solo")).status).toBe(200);
    expect(await exists(site.id)).toBe(false);
    expect((await q(`SELECT status, "singleOwnerException" FROM website_purge_requests WHERE id = $1`, [exception.json.data.id]))[0])
      .toEqual({ status: "EXECUTED", singleOwnerException: true });
  });
});
