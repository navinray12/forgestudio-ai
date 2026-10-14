/**
 * Tenant membership for the mounted v2 API groups (blueprint §18; FS21-AT-GEN-08, DAT-07).
 *
 * Runs the real Express application with real sessions against the disposable database:
 * unauthenticated, non-member, cross-tenant, under-privileged and authorized access, and
 * client-supplied tenant IDs being ignored.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/tenant-scoped-apis.integration.test.ts
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

describe.skipIf(!optedIn)("Tenant-scoped v2 APIs (real app, disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const { default: app } = await import("../app.js");

  const marker = randomUUID().slice(0, 8);
  const tokens: Record<"owner" | "editor" | "outsider", string> = {} as any;
  const ids: Record<"owner" | "editor" | "outsider", string> = {} as any;
  let ownerSite = "";
  let outsiderSite = "";
  let server: Server;
  let base = "";

  async function api(method: string, path: string, who: keyof typeof tokens | null, body?: unknown) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }

  const GRAPH = {
    nodes: [
      { id: "start", type: "TRIGGER", name: "Lead received", config: {} },
      { id: "end", type: "EXIT", name: "Done", config: {} },
    ],
    edges: [{ id: "e1", sourceNodeId: "start", targetNodeId: "end" }],
  };

  beforeAll(async () => {
    await ensureDatabaseTables();
    for (const role of ["owner", "editor", "outsider"] as const) {
      const user = await prisma.user.create({
        data: { fullName: `Scope ${role}`, email: `scope-${role}-${marker}@example.test`, status: "ACTIVE", authEpoch: 1 } as any,
      });
      ids[role] = user.id;
      const token = `scope-${role}-${randomUUID()}`;
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 3_600_000),
          authEpoch: 1,
          audience: "TENANT",
          authTime: new Date(Date.now() - 1000),
          authMethod: "local",
          lastUsedAt: new Date(),
        },
      });
      tokens[role] = token;
    }
    ownerSite = (await prisma.website.create({ data: { userId: ids.owner, name: `Scope ${marker}`, slug: `scope-${marker}` } })).id;
    outsiderSite = (await prisma.website.create({ data: { userId: ids.outsider, name: `Other ${marker}`, slug: `other-${marker}` } })).id;
    await prisma.websiteCollaborator.create({ data: { websiteId: ownerSite, userId: ids.editor, permission: "EDITOR" } });

    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    await new Promise((r) => server?.close(r));
    await prisma.website.deleteMany({ where: { id: { in: [ownerSite, outsiderSite].filter(Boolean) } } }).catch(() => undefined);
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  });

  it("rejects unauthenticated requests on every mounted group", async () => {
    for (const path of [
      "/api/v1/adaptive-infrastructure/profiles",
      "/api/v1/hosting-export/destinations/STATIC/capabilities",
      "/api/v1/security-audit/threat-model",
      "/api/v1/service-objectives/alerts",
    ]) {
      expect((await api("GET", path, null)).status).toBe(401);
    }
    expect((await api("POST", "/api/v1/workflows-communication/workflows/draft", null, { websiteId: ownerSite })).status).toBe(401);
    expect((await api("GET", `/api/v1/workflows-communication/workflows?websiteId=${ownerSite}`, null)).status).toBe(401);
  });

  it("lets any authenticated user use the tenant-free calculators", async () => {
    expect((await api("GET", "/api/v1/adaptive-infrastructure/profiles", "outsider")).status).toBe(200);
    expect((await api("GET", "/api/v1/security-audit/threat-model", "outsider")).status).toBe(200);
  });

  it("requires a website and hides other tenants' websites", async () => {
    expect((await api("POST", "/api/v1/hosting-export/export/manifest", "owner", { targetProfile: "STATIC_SNAPSHOT" })).status).toBe(400);
    expect((await api("POST", "/api/v1/hosting-export/export/manifest", "outsider", { websiteId: ownerSite })).status).toBe(404);
  });

  it("ignores a client-supplied tenant and uses the website's tenant", async () => {
    const draft = await api("POST", "/api/v1/workflows-communication/workflows/draft", "editor", {
      websiteId: ownerSite,
      tenantId: "attacker-tenant",
      workflowId: `wf-${marker}`,
      name: "Follow up",
      ...GRAPH,
    });
    expect(draft.status).toBe(201);
    expect(draft.json.draft).toMatchObject({ websiteId: ownerSite, workflowKey: `wf-${marker}`, version: 1, status: "DRAFT", createdById: ids.editor });
    expect(JSON.stringify(draft.json)).not.toContain("attacker-tenant");
    const quota = await api("POST", "/api/v1/security-audit/quota/check", "editor", {
      websiteId: ownerSite, tenantId: "attacker-tenant", category: "FORMS", currentCount: 1, limit: 10,
    });
    expect(quota.status).toBe(200);
    expect(JSON.stringify(quota.json)).not.toContain("attacker-tenant");
  });

  it("does not let another tenant act on a workflow, even through its own website", async () => {
    const workflowId = `wf2-${marker}`;
    const created = await api("POST", "/api/v1/workflows-communication/workflows/draft", "owner", {
      websiteId: ownerSite, workflowId, name: "Nurture", ...GRAPH,
    });
    expect(created.status).toBe(201);
    const simulateAsOutsider = await api("POST", `/api/v1/workflows-communication/workflows/${workflowId}/simulate/1`, "outsider", { websiteId: outsiderSite });
    expect(simulateAsOutsider.status).toBe(404);
    const publishAsEditor = await api("POST", `/api/v1/workflows-communication/workflows/${workflowId}/publish/1`, "editor", { websiteId: ownerSite });
    expect(publishAsEditor.status).toBe(403);
    const simulateAsEditor = await api("POST", `/api/v1/workflows-communication/workflows/${workflowId}/simulate/1`, "editor", { websiteId: ownerSite, initialContext: {} });
    expect(simulateAsEditor.status).not.toBe(404);
    const publishAsOwner = await api("POST", `/api/v1/workflows-communication/workflows/${workflowId}/publish/1`, "owner", { websiteId: ownerSite });
    expect(publishAsOwner.status).toBe(200);
  });

  it("keeps workflow definitions durable, immutable and isolated per website", async () => {
    const workflowId = `wf3-${marker}`;
    const draft = (extra: Record<string, unknown> = {}, who: "owner" | "outsider" = "owner", site = ownerSite) =>
      api("POST", "/api/v1/workflows-communication/workflows/draft", who, { websiteId: site, workflowId, name: "Durable", ...GRAPH, ...extra });

    // Concurrent drafts receive distinct, gap-free versions.
    const created = await Promise.all([draft(), draft(), draft()]);
    expect(created.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(created.map((r) => r.json.draft.version).sort()).toEqual([1, 2, 3]);

    // The same workflowId on another tenant's website is a separate workflow, not a new version here.
    const foreign = await draft({}, "outsider", outsiderSite);
    expect(foreign.json.draft).toMatchObject({ websiteId: outsiderSite, version: 1 });
    expect((await pgPool.query(`SELECT count(*)::int AS n FROM forge_workflow_definitions WHERE "websiteId" = $1 AND "workflowKey" = $2`, [ownerSite, workflowId])).rows[0].n).toBe(3);

    // State is read from PostgreSQL, not process memory.
    const publish = (version: number) => api("POST", `/api/v1/workflows-communication/workflows/${workflowId}/publish/${version}`, "owner", { websiteId: ownerSite });
    expect((await publish(1)).json.workflow).toMatchObject({ status: "PUBLISHED", publishedById: ids.owner });
    expect((await publish(1)).status).toBe(200);
    expect((await publish(2)).json.workflow.status).toBe("PUBLISHED");
    const statuses = (await pgPool.query(`SELECT version, status FROM forge_workflow_definitions WHERE "websiteId" = $1 AND "workflowKey" = $2 ORDER BY version`, [ownerSite, workflowId])).rows;
    expect(statuses).toEqual([{ version: 1, status: "DEPRECATED" }, { version: 2, status: "PUBLISHED" }, { version: 3, status: "DRAFT" }]);
    expect((await publish(1)).status).toBe(409);
    expect((await publish(9)).status).toBe(404);

    // The database itself refuses edits to a definition and illegal status changes.
    await expect(pgPool.query(`UPDATE forge_workflow_definitions SET definition = '{}'::jsonb WHERE "websiteId" = $1 AND "workflowKey" = $2 AND version = 2`, [ownerSite, workflowId]))
      .rejects.toThrow(/immutable/);
    await expect(pgPool.query(`UPDATE forge_workflow_definitions SET status = 'DRAFT' WHERE "websiteId" = $1 AND "workflowKey" = $2 AND version = 2`, [ownerSite, workflowId]))
      .rejects.toThrow(/illegal workflow status transition/);

    const simulation = await api("POST", `/api/v1/workflows-communication/workflows/${workflowId}/simulate/2`, "editor", { websiteId: ownerSite, initialContext: {} });
    expect(simulation.json.simulation).toMatchObject({ isSimulation: true, workflowVersion: 2, totalSteps: 2 });
    const listed = await api("GET", `/api/v1/workflows-communication/workflows?websiteId=${ownerSite}&workflowId=${workflowId}`, "editor");
    expect(listed.json.versions.map((v: any) => v.version)).toEqual([3, 2, 1]);
    expect((await api("GET", `/api/v1/workflows-communication/workflows?websiteId=${ownerSite}`, "outsider")).status).toBe(404);

    const invalid = await draft({ nodes: [{ id: "only", type: "ACTION", name: "x", config: {} }], edges: [] });
    expect(invalid.status).toBe(400);
  });

  it("commits a confirmed chat lead through the durable lead service", async () => {
    const body = { websiteId: ownerSite, tenantId: "attacker-tenant", formId: "chat", confirmedContact: { name: "Chat Lead", email: "chat@example.test" } };
    expect((await api("POST", "/api/v1/workflows-communication/chat/convert-lead", "editor", body)).status).toBe(400);
    expect((await api("POST", "/api/v1/workflows-communication/chat/convert-lead", "outsider", { ...body, consentConfirmed: true })).status).toBe(404);
    const converted = await api("POST", "/api/v1/workflows-communication/chat/convert-lead", "editor", { ...body, consentConfirmed: true });
    expect(converted.status).toBe(201);
    const lead = (await pgPool.query(`SELECT "websiteId", provenance, email, stage FROM forge_leads WHERE id = $1`, [converted.json.receipt.leadId])).rows[0];
    expect(lead).toEqual({ websiteId: ownerSite, provenance: "CHAT_AGENT", email: "chat@example.test", stage: "NEW" });
  });

  it("does not serve in-memory release state, self-attested gates or fabricated delivery", async () => {
    for (const [method, path] of [
      ["POST", "/api/v1/release-integrity/releases/request"],
      ["POST", "/api/v1/release-integrity/releases/gates/evaluate"],
      ["POST", "/api/v1/release-integrity/releases/passport/issue"],
      ["POST", "/api/v1/workflows-communication/messages/dispatch"],
      ["POST", "/api/v1/workflows-communication/policy/revalidate"],
      ["POST", "/api/v1/workflows-communication/experiments/create"],
      ["POST", "/api/v1/workflows-communication/chat/init"],
    ] as const) {
      expect((await api(method, path, "owner", { websiteId: ownerSite })).status, path).toBe(404);
    }
  });

  it("regenerates infrastructure upgrade plans and attests only the caller's approval", async () => {
    const forged = {
      websiteId: ownerSite,
      plan: { currentProfile: "NATIVE_COMPOSE", targetProfile: "MANAGED_KUBERNETES", requiredApprovals: [] },
      approvals: [{ role: "FINANCE_ADMIN", approverId: "someone-else" }],
    };
    expect((await api("POST", "/api/v1/adaptive-infrastructure/upgrade/execute", "editor", forged)).status).toBe(403);
    const asOwner = await api("POST", "/api/v1/adaptive-infrastructure/upgrade/execute", "owner", forged);
    expect(JSON.stringify(asOwner.json)).not.toContain("someone-else");
  });

  it("keeps the platform-wide audit chain for platform administrators", async () => {
    expect((await api("GET", "/api/v1/security-audit/audit/integrity", "owner")).status).toBe(403);
  });

  it("keeps routers that trust client tenant IDs unmounted", async () => {
    for (const path of ["/api/v1/forms-leads/forms", "/api/v1/owner-experience/workspaces", "/api/v1/marketing-analytics/events"]) {
      expect((await api("GET", path, "owner")).status).toBe(404);
    }
  });
});
