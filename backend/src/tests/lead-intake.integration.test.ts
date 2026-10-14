/**
 * Durable form submission boundary and lead lifecycle (blueprint §12; owner journey "receive/qualify
 * a lead" from §11).
 *
 * Runs the real Express app with real sessions against the disposable database and observes every
 * effect with SQL: atomic submission + lead + audit + notification jobs, idempotent replay and
 * conflict, rollback when part of the commit fails, and membership-scoped staff operations.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/lead-intake.integration.test.ts
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

describe.skipIf(!optedIn)("Durable lead intake (real app, disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const { acceptSubmission } = await import("../services/leads/leadIntake.service.js");
  const { default: app } = await import("../app.js");

  const marker = randomUUID().slice(0, 8);
  const tokens: Record<"owner" | "editor" | "outsider", string> = {} as any;
  const ids: Record<"owner" | "editor" | "outsider", string> = {} as any;
  let site = "";
  let otherSite = "";
  let server: Server;
  let base = "";

  async function api(method: string, path: string, who: keyof typeof tokens | null, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  // The per-IP limiter is configured per form; every request here comes from 127.0.0.1.
  const spamProtection = { rateLimitPerMinute: 1000 };
  const submit = (fields: Record<string, unknown>, key?: string, extra: Record<string, unknown> = {}) =>
    api("POST", "/api/forms/submit", null, { websiteId: site, formId: "contact", formName: "Contact", fields, spamProtection, ...extra },
      key ? { "Idempotency-Key": key } : {});

  const q = async (sql: string, params: unknown[] = []) => (await pgPool.query(sql, params)).rows;

  beforeAll(async () => {
    await ensureDatabaseTables();
    for (const role of ["owner", "editor", "outsider"] as const) {
      const user = await prisma.user.create({
        data: { fullName: `Lead ${role}`, email: `lead-${role}-${marker}@example.test`, status: "ACTIVE", authEpoch: 1 } as any,
      });
      ids[role] = user.id;
      const token = `lead-${role}-${randomUUID()}`;
      await prisma.session.create({
        data: {
          userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000),
          authEpoch: 1, audience: "TENANT", authTime: new Date(Date.now() - 1000), authMethod: "local", lastUsedAt: new Date(),
        },
      });
      tokens[role] = token;
    }
    site = (await prisma.website.create({ data: { userId: ids.owner, name: `Leads ${marker}`, slug: `leads-${marker}` } })).id;
    otherSite = (await prisma.website.create({ data: { userId: ids.outsider, name: `Other ${marker}`, slug: `leads-other-${marker}` } })).id;
    await prisma.websiteCollaborator.create({ data: { websiteId: site, userId: ids.editor, permission: "EDITOR" } });
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    await new Promise((r) => server?.close(r));
    await pgPool.query(`DELETE FROM background_jobs WHERE payload->>'websiteId' = ANY($1) OR payload->'body'->>'websiteId' = ANY($1)`, [[site, otherSite]]).catch(() => undefined);
    await prisma.website.deleteMany({ where: { id: { in: [site, otherSite].filter(Boolean) } } }).catch(() => undefined);
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  });

  let leadId = "";

  it("commits the submission, its lead, the audit event and notification jobs before acknowledging", async () => {
    const nonce = `Ada ${randomUUID()}`;
    const res = await submit({ name: nonce, email: "ada@example.test", message: "Quote please" }, `key-${marker}-1`, {
      actions: {
        activeActions: ["database", "webhook", "email"],
        webhookConfig: { endpointUrl: "https://hooks.example.com/forge" },
        emailConfig: { toEmail: "owner@example.test", subject: "New lead" },
      },
    });
    expect(res.status).toBe(201);
    const receipt = res.json.receipt;
    expect(receipt).toMatchObject({ replayed: false });
    leadId = receipt.leadId;

    const [submission] = await q(`SELECT "websiteId", "leadId", data->>'name' AS name FROM form_submissions WHERE id = $1`, [receipt.submissionId]);
    expect(submission).toEqual({ websiteId: site, leadId, name: nonce });
    const [lead] = await q(`SELECT "websiteId", "submissionId", stage, "displayName", email, revision FROM forge_leads WHERE id = $1`, [leadId]);
    expect(lead).toEqual({ websiteId: site, submissionId: receipt.submissionId, stage: "NEW", displayName: nonce, email: "ada@example.test", revision: 1 });
    expect(await q(`SELECT type, "toStage" FROM forge_lead_events WHERE "leadId" = $1`, [leadId])).toEqual([{ type: "CREATED", toStage: "NEW" }]);
    const jobs = await q(`SELECT type, status FROM background_jobs WHERE payload->>'leadId' = $1 ORDER BY type`, [leadId]);
    expect(jobs.map((j) => j.type)).toEqual(["FORM_NOTIFICATION_EMAIL", "WEBHOOK_RETRY"]);
  });

  it("replays the original receipt for the same key and refuses a changed request under it", async () => {
    const key = `key-${marker}-2`;
    const fields = { name: "Grace", email: "grace@example.test" };
    const first = await submit(fields, key);
    const again = await submit(fields, key);
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.json.receipt).toMatchObject({ submissionId: first.json.receipt.submissionId, leadId: first.json.receipt.leadId, replayed: true });
    expect(await q(`SELECT count(*)::int AS n FROM form_submissions WHERE "websiteId" = $1 AND "idempotencyKey" = $2`, [site, key])).toEqual([{ n: 1 }]);

    const changed = await submit({ ...fields, email: "other@example.test" }, key);
    expect(changed.status).toBe(409);

    // Concurrent retries of one request still produce exactly one lead.
    const racing = `key-${marker}-3`;
    const results = await Promise.all([1, 2, 3, 4].map(() => submit({ name: "Race" }, racing)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 201]);
    expect(new Set(results.map((r) => r.json.receipt.leadId)).size).toBe(1);
  });

  it("treats two enquiries without a key as two leads, even with the same email", async () => {
    const a = await submit({ name: "Same", email: "same@example.test" });
    const b = await submit({ name: "Same", email: "same@example.test" });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.json.receipt.leadId).not.toBe(b.json.receipt.leadId);
  });

  it("rolls back everything and reports failure when part of the commit fails", async () => {
    const before = await q(`SELECT count(*)::int AS n FROM forge_leads WHERE "websiteId" = $1`, [site]);
    await expect(acceptSubmission({
      websiteId: site, formId: "contact", data: { name: "Rollback" }, metadata: {},
      // background_jobs.type is VARCHAR(100): the outbox insert fails inside the transaction.
      notifications: [{ type: "X".repeat(150) as any, payload: {} }],
    })).rejects.toMatchObject({ statusCode: 503, code: "SUBMISSION_NOT_SAVED" });
    expect(await q(`SELECT count(*)::int AS n FROM forge_leads WHERE "websiteId" = $1`, [site])).toEqual(before);
    expect(await q(`SELECT count(*)::int AS n FROM form_submissions WHERE "websiteId" = $1 AND data->>'name' = 'Rollback'`, [site])).toEqual([{ n: 0 }]);

    const unknownSite = await api("POST", "/api/forms/submit", null, { websiteId: randomUUID(), formId: "contact", fields: { name: "x" }, spamProtection });
    expect(unknownSite.status).toBe(404);
  });

  it("lets only members manage leads, following the lead transition policy with revisions", async () => {
    expect((await api("GET", `/api/forms/${site}/leads`, null)).status).toBe(401);
    expect((await api("GET", `/api/forms/${site}/leads`, "outsider")).status).toBe(404);
    expect((await api("GET", `/api/forms/leads/${leadId}`, "outsider")).status).toBe(404);
    expect((await api("POST", `/api/forms/leads/${leadId}/transition`, "outsider", { targetStage: "CONTACTED", expectedRevision: 1 })).status).toBe(404);

    const list = await api("GET", `/api/forms/${site}/leads?stage=NEW`, "editor");
    expect(list.status).toBe(200);
    expect(list.json.data.some((l: any) => l.id === leadId)).toBe(true);

    expect((await api("POST", `/api/forms/leads/${leadId}/transition`, "editor", { targetStage: "WON", expectedRevision: 1 })).status).toBe(409);
    expect((await api("POST", `/api/forms/leads/${leadId}/transition`, "editor", { targetStage: "QUALIFIED", expectedRevision: 1 })).status).toBe(400);
    expect((await api("POST", `/api/forms/leads/${leadId}/transition`, "editor", { targetStage: "CONTACTED" })).status).toBe(428);
    expect((await api("POST", `/api/forms/leads/${leadId}/transition`, "editor", { targetStage: "CONTACTED", expectedRevision: 9 })).status).toBe(409);

    const contacted = await api("POST", `/api/forms/leads/${leadId}/transition`, "editor", { targetStage: "CONTACTED", expectedRevision: 1 });
    expect(contacted.status, JSON.stringify(contacted.json)).toBe(200);
    expect(contacted.json.data).toMatchObject({ stage: "CONTACTED", revision: 2 });
    const qualified = await api("POST", `/api/forms/leads/${leadId}/transition`, "owner",
      { targetStage: "QUALIFIED", expectedRevision: 2, evidence: "Budget confirmed on call" });
    expect(qualified.json.data).toMatchObject({ stage: "QUALIFIED", revision: 3, qualificationEvidence: "Budget confirmed on call" });

    expect((await api("POST", `/api/forms/leads/${leadId}/assign`, "owner", { assigneeId: ids.outsider, expectedRevision: 3 })).status).toBe(400);
    expect((await api("POST", `/api/forms/leads/${leadId}/assign`, "owner", { assigneeId: ids.editor, expectedRevision: 3 })).status).toBe(200);
    expect((await api("POST", `/api/forms/leads/${leadId}/notes`, "editor", { note: "Sent proposal" })).status).toBe(201);

    const events = await q(`SELECT type, "actorId", "fromStage", "toStage" FROM forge_lead_events WHERE "leadId" = $1 ORDER BY "createdAt"`, [leadId]);
    expect(events).toEqual([
      { type: "CREATED", actorId: null, fromStage: null, toStage: "NEW" },
      { type: "STAGE_CHANGED", actorId: ids.editor, fromStage: "NEW", toStage: "CONTACTED" },
      { type: "STAGE_CHANGED", actorId: ids.owner, fromStage: "CONTACTED", toStage: "QUALIFIED" },
      { type: "ASSIGNED", actorId: ids.owner, fromStage: null, toStage: null },
      { type: "NOTE", actorId: ids.editor, fromStage: null, toStage: null },
    ]);
    expect((await api("GET", `/api/forms/${otherSite}/leads`, "editor")).status).toBe(404);
  });
});
