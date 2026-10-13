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
    expect((await api("POST", "/api/v1/release-integrity/releases/request", null, { websiteId: ownerSite })).status).toBe(401);
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
    expect(draft.json.draft.tenantId).toBe(ids.owner);
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

  it("restricts release operations to owners/admins of the release's website", async () => {
    const asEditor = await api("POST", "/api/v1/release-integrity/releases/request", "editor", {
      websiteId: ownerSite, version: 1, immutableArtifactDigest: "a".repeat(64),
      pinnedInputDigests: { sourceDigest: "s", contentDigest: "c", policyDigest: "p", schemaDigest: "d" },
    });
    expect(asEditor.status).toBe(403);

    const requested = await api("POST", "/api/v1/release-integrity/releases/request", "owner", {
      websiteId: ownerSite, tenantId: "attacker-tenant", version: 1, immutableArtifactDigest: "a".repeat(64),
      pinnedInputDigests: { sourceDigest: "s", contentDigest: "c", policyDigest: "p", schemaDigest: "d" },
    });
    expect(requested.status).toBe(201);
    const releaseId = requested.json.candidate.releaseId;
    expect(requested.json.candidate.tenantId).toBe(ids.owner);
    expect(requested.json.candidate.requestedBy).toBe(ids.owner);

    const crossTenant = await api("POST", `/api/v1/release-integrity/releases/${releaseId}/transition`, "outsider", {
      websiteId: outsiderSite, nextState: "PLANNED", workerFencingToken: 1,
    });
    expect(crossTenant.status).toBe(404);
  });

  it("does not expose self-attested release passports", async () => {
    const res = await api("POST", "/api/v1/release-integrity/releases/passport/issue", "owner", { websiteId: ownerSite });
    expect(res.status).toBe(404);
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
