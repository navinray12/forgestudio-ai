/**
 * Secure activation of the blueprint v2 feature routers (WP-01, WP-16): forms-leads,
 * owner-experience, marketing-analytics, search-quality, delivery-governance, components,
 * benchmark and capabilities.
 *
 * Runs the real Express application with real sessions against the disposable database:
 * unauthenticated and cross-tenant access, client-supplied tenant IDs, validation, duplicate
 * requests, persistence across an application restart, rate limiting and the operations that are
 * deliberately not exposed.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/v2-feature-routers.integration.test.ts
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

type Who = "owner" | "editor" | "outsider" | "admin";

describe.skipIf(!optedIn)("Blueprint v2 feature routers (real app, disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");

  const marker = randomUUID().slice(0, 8);
  const tokens = {} as Record<Who, string>;
  const ids = {} as Record<Who, string>;
  const pools: Array<{ end: () => Promise<void> }> = [pgPool];
  const runIds: string[] = [];
  let ownerSite = "";
  let outsiderSite = "";
  let leadId = "";
  let server: Server;
  let base = "";

  async function api(method: string, path: string, who: Who | null, body?: unknown) {
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

  /** Boots a fresh copy of the application: new module instances, so no process-local state survives. */
  async function startApplication() {
    if (server) await new Promise((r) => server.close(r));
    vi.resetModules();
    const { default: app } = await import("../app.js");
    pools.push((await import("../config/prisma.js")).pgPool);
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  const consent = (websiteId: string, extra: Record<string, unknown> = {}) => ({
    websiteId,
    subjectId: `visitor-${marker}`,
    status: "GRANTED",
    purposes: { analytics: true, marketing: false },
    ...extra,
  });

  const fact = (websiteId: string, extra: Record<string, unknown> = {}) => ({
    websiteId,
    factId: `offer-${marker}`,
    category: "PRICE_OFFER",
    statement: "Spring offer",
    approvedWording: "20% off until the end of May",
    validFrom: "2026-10-01T00:00:00.000Z",
    dependentSurfaces: [
      { surfaceType: "PAGE", surfaceIdentifier: "/pricing" },
      { surfaceType: "CAMPAIGN", surfaceIdentifier: "spring" },
    ],
    ...extra,
  });

  const source = (websiteId: string, sourceContent = "export function Hero() { return null; }") => ({
    websiteId,
    fileName: `Hero-${marker}.tsx`,
    sourceContent,
  });

  const run = {
    config: {
      protocolVersion: "2.1.0",
      productName: `ForgeStudio ${marker}`,
      productVersion: "2.1.0",
      purchasedPlanOrEntitlement: "Internal",
      briefId: "BRIEF-01-SOLARIS-CONSULTING",
      operatorExperienceLevel: "BUSINESS_USER",
      enabledIntegrations: [],
      startingConditions: "Empty workspace",
      preparedAssetsDescription: "None",
      costAssumptionsDescription: "None",
      actualCostUsd: 0,
    },
    taskResults: [
      {
        taskId: "TASK-01",
        taskName: "Operator study task",
        status: "NOT_YET_MEASURED",
        activeElapsedSeconds: 0,
        totalElapsedSeconds: 0,
        assistanceInterventionsCount: 0,
        defects: [],
        isCriticalFailure: false,
        notes: "Recorded by the integration test",
        rawMetrics: {},
        evidenceArtifactUrls: [],
      },
    ],
  };

  beforeAll(async () => {
    await ensureDatabaseTables();
    for (const who of ["owner", "editor", "outsider", "admin"] as const) {
      const user = await prisma.user.create({
        data: {
          fullName: `Router ${who}`,
          email: `router-${who}-${marker}@example.test`,
          status: "ACTIVE",
          authEpoch: 1,
          ...(who === "admin" ? { role: "ADMIN" } : {}),
        } as any,
      });
      ids[who] = user.id;
      const token = `router-${who}-${randomUUID()}`;
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
      tokens[who] = token;
    }
    ownerSite = (await prisma.website.create({ data: { userId: ids.owner, name: `Router ${marker}`, slug: `router-${marker}` } })).id;
    outsiderSite = (await prisma.website.create({ data: { userId: ids.outsider, name: `Other ${marker}`, slug: `router-other-${marker}` } })).id;
    await prisma.websiteCollaborator.create({ data: { websiteId: ownerSite, userId: ids.editor, permission: "EDITOR" } });
    const { rows } = await pgPool.query(
      `INSERT INTO forge_leads ("websiteId", "displayName", email) VALUES ($1::uuid, 'Router Lead', $2) RETURNING id`,
      [ownerSite, `lead-${marker}@example.test`]
    );
    leadId = rows[0].id;
    await startApplication();
  }, 120_000);

  afterAll(async () => {
    await new Promise((r) => server?.close(r));
    if (runIds.length) await pgPool.query(`DELETE FROM forge_benchmark_runs WHERE "runId" = ANY($1)`, [runIds]).catch(() => undefined);
    await prisma.website.deleteMany({ where: { id: { in: [ownerSite, outsiderSite].filter(Boolean) } } }).catch(() => undefined);
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.$disconnect();
    for (const pool of pools) await pool.end().catch(() => undefined);
  });

  it("rejects unauthenticated requests on every router", async () => {
    for (const path of [
      `/api/v1/forms-leads/leads?websiteId=${ownerSite}`,
      "/api/v1/owner-experience/permissions/catalog",
      "/api/v1/search-quality/facts",
      "/api/v1/delivery-governance/stages",
      "/api/v1/components/contracts",
      "/api/v1/benchmark/competitors",
      "/api/v1/benchmark/runs",
      "/api/v1/capabilities",
      "/api/capabilities/manifest",
    ]) {
      expect((await api("GET", path, null)).status, path).toBe(401);
    }
    for (const [path, body] of [
      ["/api/v1/marketing-analytics/consent", consent(ownerSite)],
      ["/api/v1/marketing-analytics/utm/build", {}],
      ["/api/v1/search-quality/facts", fact(ownerSite)],
      ["/api/v1/owner-experience/drafts/local", { websiteId: ownerSite, clientVersion: 1, content: {} }],
      ["/api/v1/components/source/import", source(ownerSite)],
      [`/api/v1/forms-leads/leads/${leadId}/transition`, { targetStage: "CONTACTED", expectedRevision: 1 }],
      ["/api/v1/benchmark/runs", run],
    ] as const) {
      expect((await api("POST", path, null, body)).status, path).toBe(401);
    }
  });

  it("serves the read-only registers to any authenticated user", async () => {
    const list = await api("GET", "/api/v1/capabilities", "outsider");
    expect(list.status).toBe(200);
    expect(list.json.total).toBeGreaterThan(0);
    expect((await api("GET", "/api/v1/capabilities/manifest", "outsider")).status).toBe(200);
    const one = await api("GET", "/api/v1/capabilities/CAP-001", "outsider");
    expect(one.status).toBe(200);
    expect(one.json.capability.id).toBe("CAP-001");
    expect(one.json).not.toHaveProperty("evidence");
    expect((await api("GET", "/api/v1/capabilities/CAP-NOPE", "outsider")).status).toBe(404);

    expect((await api("GET", "/api/v1/components/contracts", "outsider")).status).toBe(200);
    expect((await api("GET", "/api/v1/components/contracts/does-not-exist", "outsider")).status).toBe(404);
    expect((await api("GET", "/api/v1/components/contracts?target=MAINFRAME", "outsider")).status).toBe(422);
    expect((await api("GET", "/api/v1/delivery-governance/stages", "outsider")).status).toBe(200);
    expect((await api("GET", "/api/v1/delivery-governance/decisions", "outsider")).status).toBe(200);
    const registers = await api("GET", "/api/v1/delivery-governance/source-registers", "outsider");
    expect(registers.status).toBe(200);
    expect(registers.json).not.toHaveProperty("mutationHarnessExecution");
    expect((await api("GET", "/api/v1/owner-experience/permissions/catalog", "outsider")).status).toBe(200);
  });

  it("runs the body-only calculations and rejects malformed input", async () => {
    const link = await api("POST", "/api/v1/marketing-analytics/utm/build", "owner", {
      baseUrl: "https://example.test/landing",
      utm: { source: "Newsletter", medium: "Email", campaign: "Spring" },
    });
    expect(link.status).toBe(200);
    expect(link.json.link).toContain("utm_source=newsletter");
    expect((await api("POST", "/api/v1/marketing-analytics/utm/build", "owner", { baseUrl: "not a url" })).status).toBe(422);
    expect((await api("POST", "/api/v1/marketing-analytics/metrics/calculate", "owner", { eligibleMeasuredSessions: -1 })).status).toBe(422);

    const delivery = await api("POST", "/api/v1/search-quality/routes/resolve", "owner", {
      siteCanonicalDomain: "example.test",
      path: "/gone",
      isPublished: false,
      isTrashed: true,
      hasLegalHoldOrPurged: false,
      title: "Gone",
      description: "Gone",
    });
    expect(delivery.status).toBe(200);
    expect([404, 410]).toContain(delivery.json.delivery.statusCode);
    expect((await api("POST", "/api/v1/search-quality/routes/resolve", "owner", { path: "/x" })).status).toBe(422);
    expect((await api("POST", "/api/v1/components/validate", "owner", { props: {} })).status).toBe(422);
  });

  it("restricts benchmark data to platform administrators and stores each run once", async () => {
    expect((await api("GET", "/api/v1/benchmark/competitors", "owner")).status).toBe(403);
    expect((await api("POST", "/api/v1/benchmark/runs", "owner", run)).status).toBe(403);
    expect((await api("GET", "/api/v1/benchmark/tasks", "admin")).status).toBe(200);
    expect((await api("POST", "/api/v1/benchmark/runs", "admin", { config: run.config })).status).toBe(422);
    expect((await api("POST", "/api/v1/benchmark/runs", "admin", { ...run, config: { ...run.config, briefId: "BRIEF-NOPE" } })).status).toBe(400);

    const first = await api("POST", "/api/v1/benchmark/runs", "admin", run);
    expect(first.status).toBe(201);
    runIds.push(first.json.report.runId);
    const again = await api("POST", "/api/v1/benchmark/runs", "admin", run);
    expect(again.status).toBe(200);
    expect(again.json.idempotentReplay).toBe(true);
    expect(again.json.report.runId).toBe(first.json.report.runId);
    const { rows } = await pgPool.query(`SELECT "recordedById" FROM forge_benchmark_runs WHERE "runId" = $1`, [runIds[0]]);
    expect(rows).toEqual([{ recordedById: ids.admin }]);
    expect((await api("GET", "/api/v1/benchmark/runs/run-does-not-exist", "admin")).status).toBe(404);
  });

  it("hides another tenant's website from every website-scoped operation", async () => {
    expect((await api("POST", "/api/v1/marketing-analytics/consent", "outsider", consent(ownerSite))).status).toBe(404);
    expect((await api("POST", "/api/v1/marketing-analytics/consent/withdraw", "outsider", { websiteId: ownerSite, subjectId: `visitor-${marker}` })).status).toBe(404);
    expect((await api("POST", "/api/v1/search-quality/facts", "outsider", fact(ownerSite))).status).toBe(404);
    expect((await api("POST", "/api/v1/search-quality/facts/preview-impact", "outsider", { websiteId: ownerSite, factId: `offer-${marker}`, proposedStatement: "x" })).status).toBe(404);
    expect((await api("POST", "/api/v1/owner-experience/drafts/local", "outsider", { websiteId: ownerSite, clientVersion: 1, content: {} })).status).toBe(404);
    expect((await api("GET", `/api/v1/owner-experience/drafts/local/main-editor?websiteId=${ownerSite}&serverVersion=1`, "outsider")).status).toBe(404);
    expect((await api("POST", "/api/v1/components/source/import", "outsider", source(ownerSite))).status).toBe(404);
    expect((await api("GET", `/api/v1/forms-leads/leads?websiteId=${ownerSite}`, "outsider")).status).toBe(404);
    expect((await api("POST", `/api/v1/forms-leads/leads/${leadId}/transition`, "outsider", { targetStage: "CONTACTED", expectedRevision: 1 })).status).toBe(404);
    const { rows } = await pgPool.query(`SELECT count(*)::int AS n FROM forge_website_records WHERE "websiteId" = $1::uuid`, [ownerSite]);
    expect(rows[0].n).toBe(0);
  });

  it("requires a website and never accepts a tenant ID from the client", async () => {
    expect((await api("POST", "/api/v1/marketing-analytics/consent", "owner", { ...consent(ownerSite), websiteId: undefined })).status).toBe(400);
    expect((await api("POST", "/api/v1/search-quality/facts", "owner", fact("site-1"))).status).toBe(400);
    expect((await api("GET", "/api/v1/forms-leads/leads", "owner")).status).toBe(400);

    const created = await api("POST", "/api/v1/search-quality/facts", "owner", fact(ownerSite, { tenantId: ids.outsider, approvedBy: ids.outsider }));
    expect(created.status).toBe(201);
    expect(created.json.fact.approvedBy).toBe(ids.owner);
    expect(created.json.fact.websiteId).toBe(ownerSite);
    const { rows } = await pgPool.query(
      `SELECT "tenantId", "createdById" FROM forge_website_records WHERE "websiteId" = $1::uuid AND kind = 'FACT_OFFER'`,
      [ownerSite]
    );
    expect(rows).toEqual([{ tenantId: ids.owner, createdById: ids.owner }]);
  });

  it("stores facts durably, replays duplicates and reserves approval for owners and admins", async () => {
    const replay = await api("POST", "/api/v1/search-quality/facts", "owner", fact(ownerSite));
    expect(replay.status).toBe(200);
    expect(replay.json.idempotentReplay).toBe(true);
    expect(replay.json.fact.revision).toBe(1);

    expect((await api("POST", "/api/v1/search-quality/facts", "editor", fact(ownerSite, { approvalStatus: "APPROVED" }))).status).toBe(403);
    expect((await api("POST", "/api/v1/search-quality/facts", "owner", fact(ownerSite, { category: "RUMOUR" }))).status).toBe(422);
    const approved = await api("POST", "/api/v1/search-quality/facts", "owner", fact(ownerSite, { approvalStatus: "APPROVED" }));
    expect(approved.status).toBe(200);
    expect(approved.json.fact).toMatchObject({ approvalStatus: "APPROVED", revision: 2 });

    const preview = await api("POST", "/api/v1/search-quality/facts/preview-impact", "editor", {
      websiteId: ownerSite, factId: `offer-${marker}`, proposedStatement: "25% off", proposedAmount: 25,
    });
    expect(preview.status).toBe(200);
    expect(preview.json.preview).toMatchObject({ affectedPagesCount: 1, affectedCampaignsCount: 1 });
    expect(preview.json.preview).not.toHaveProperty("historicalQuotesProtectedCount");
    // The same fact ID in another tenant's website is a different, absent record.
    expect((await api("POST", "/api/v1/search-quality/facts/preview-impact", "outsider", {
      websiteId: outsiderSite, factId: `offer-${marker}`, proposedStatement: "x",
    })).status).toBe(404);
  });

  it("records consent once per subject and validates the decision", async () => {
    expect((await api("POST", "/api/v1/marketing-analytics/consent", "owner", consent(ownerSite, { status: "MAYBE" }))).status).toBe(422);
    expect((await api("POST", "/api/v1/marketing-analytics/consent/withdraw", "owner", { websiteId: ownerSite, subjectId: "nobody" })).status).toBe(404);

    const first = await api("POST", "/api/v1/marketing-analytics/consent", "owner", consent(ownerSite));
    expect(first.status).toBe(201);
    expect(first.json.decision).toMatchObject({ status: "GRANTED", websiteId: ownerSite, purposes: { analytics: true, marketing: false } });
    const again = await api("POST", "/api/v1/marketing-analytics/consent", "owner", consent(ownerSite));
    expect(again.status).toBe(200);
    expect(again.json).toMatchObject({ idempotentReplay: true, revision: 1 });
    expect(again.json.decision.recordedAt).toBe(first.json.decision.recordedAt);
  });

  it("keeps recovery drafts private to their author", async () => {
    expect((await api("POST", "/api/v1/owner-experience/drafts/local", "owner", { websiteId: ownerSite, clientVersion: 0, content: {} })).status).toBe(422);
    const body = { websiteId: ownerSite, draftId: "home", clientVersion: 3, content: { title: "Draft", secrets: { apiKey: "sk-123" } } };
    const stored = await api("POST", "/api/v1/owner-experience/drafts/local", "owner", body);
    expect(stored.status).toBe(201);
    expect(stored.json.draft).toMatchObject({ userId: ids.owner, websiteId: ownerSite, isServerAcknowledged: false });
    expect(stored.json.draft.content.secrets).toEqual({});
    expect((await api("POST", "/api/v1/owner-experience/drafts/local", "owner", body)).status).toBe(200);

    const mine = await api("GET", `/api/v1/owner-experience/drafts/local/home?websiteId=${ownerSite}&serverVersion=5`, "owner");
    expect(mine.json).toMatchObject({ eligibleForRecovery: true, isStale: true, actionRequired: "CONFLICT_RESOLUTION_REQUIRED" });
    const theirs = await api("GET", `/api/v1/owner-experience/drafts/local/home?websiteId=${ownerSite}&serverVersion=5`, "editor");
    expect(theirs.status).toBe(200);
    expect(theirs.json).toMatchObject({ eligibleForRecovery: false, localVersion: 0 });
    expect(theirs.json).not.toHaveProperty("draft");
    expect((await api("GET", `/api/v1/owner-experience/drafts/local/home?websiteId=${ownerSite}`, "owner")).status).toBe(422);
  });

  it("inspects imported source once and reports a blocked file as a failure", async () => {
    expect((await api("POST", "/api/v1/components/source/import", "owner", { websiteId: ownerSite, fileName: "a.tsx" })).status).toBe(422);
    const clean = await api("POST", "/api/v1/components/source/import", "owner", source(ownerSite));
    expect(clean.status).toBe(201);
    expect(clean.json.data.metadata).toMatchObject({ tenantId: ids.owner, projectId: ownerSite, uploaderId: ids.owner });
    const again = await api("POST", "/api/v1/components/source/import", "owner", source(ownerSite));
    expect(again.status).toBe(200);
    expect(again.json.idempotentReplay).toBe(true);
    expect(again.json.data.importId).toBe(clean.json.data.importId);

    const blocked = await api("POST", "/api/v1/components/source/import", "owner", source(ownerSite, "export const x = eval('1');"));
    expect(blocked.status).toBe(422);
    expect(blocked.json.success).toBe(false);
    expect(blocked.json.data.status).toBe("BLOCKED_SECURITY_RISK");
  });

  it("lists and transitions leads through the durable lead service", async () => {
    const list = await api("GET", `/api/v1/forms-leads/leads?websiteId=${ownerSite}`, "editor");
    expect(list.status).toBe(200);
    expect(list.json.leads.map((l: any) => l.id)).toEqual([leadId]);
    expect((await api("GET", `/api/v1/forms-leads/leads?websiteId=${ownerSite}&stage=NOPE`, "editor")).status).toBe(400);

    const path = `/api/v1/forms-leads/leads/${leadId}/transition`;
    expect((await api("POST", path, "owner", { targetStage: "CONTACTED" })).status).toBe(428);
    expect((await api("POST", path, "owner", { targetStage: "QUALIFIED", expectedRevision: 1 })).status).toBe(400);
    const moved = await api("POST", path, "owner", { targetStage: "CONTACTED", expectedRevision: 1 });
    expect(moved.status).toBe(200);
    expect(moved.json.lead).toMatchObject({ stage: "CONTACTED", revision: 2 });
    // A duplicate of the same request no longer matches the revision it was based on.
    expect((await api("POST", path, "owner", { targetStage: "CONTACTED", expectedRevision: 1 })).status).toBe(409);
  });

  it("does not expose the operations that are still unsafe", async () => {
    for (const [method, path, who] of [
      ["POST", "/api/v1/forms-leads/submissions", "owner"],
      ["POST", "/api/v1/forms-leads/schemas", "owner"],
      ["POST", "/api/v1/forms-leads/uploads/init", "owner"],
      ["GET", "/api/v1/forms-leads/disaster-recovery", "owner"],
      ["GET", "/api/v1/owner-experience/view", "owner"],
      ["POST", "/api/v1/owner-experience/roles/custom", "owner"],
      ["POST", `/api/v1/owner-experience/editor-state/${ownerSite}/transition`, "owner"],
      ["POST", "/api/v1/owner-experience/journeys/execute", "owner"],
      ["POST", "/api/v1/marketing-analytics/conversions/dispatch", "owner"],
      ["GET", "/api/v1/search-quality/readiness", "owner"],
      ["POST", "/api/v1/search-quality/ai-search/evaluate", "owner"],
      ["POST", "/api/v1/delivery-governance/commerce-webhook", "owner"],
      ["POST", "/api/v1/delivery-governance/initiate-transfer", "owner"],
      ["POST", "/api/v1/delivery-governance/complete-transfer", "owner"],
      ["POST", "/api/v1/delivery-governance/check-launch-risks", "owner"],
      ["POST", "/api/v1/components/source/reconcile", "owner"],
      ["POST", "/api/v1/components/behavior/review", "owner"],
      ["POST", "/api/v1/benchmark/execute-automated", "admin"],
      ["POST", "/api/v1/capabilities/CAP-001/activate", "admin"],
      ["POST", "/api/v1/capabilities/CAP-001/evidence", "admin"],
      ["POST", "/api/v1/capabilities/release-gate/evaluate", "admin"],
    ] as const) {
      expect((await api(method, path, who, method === "POST" ? {} : undefined)).status, path).toBe(404);
    }
  });

  it("keeps every record across an application restart", async () => {
    await startApplication();

    const replayedConsent = await api("POST", "/api/v1/marketing-analytics/consent", "owner", consent(ownerSite));
    expect(replayedConsent.status).toBe(200);
    expect(replayedConsent.json.idempotentReplay).toBe(true);
    const withdrawn = await api("POST", "/api/v1/marketing-analytics/consent/withdraw", "owner", { websiteId: ownerSite, subjectId: `visitor-${marker}` });
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.json.decision).toMatchObject({ status: "WITHDRAWN", purposes: { analytics: false, marketing: false } });
    expect(withdrawn.json.revision).toBe(2);
    const withdrawnAgain = await api("POST", "/api/v1/marketing-analytics/consent/withdraw", "owner", { websiteId: ownerSite, subjectId: `visitor-${marker}` });
    expect(withdrawnAgain.json).toMatchObject({ idempotentReplay: true, revision: 2 });

    const preview = await api("POST", "/api/v1/search-quality/facts/preview-impact", "owner", { websiteId: ownerSite, factId: `offer-${marker}`, proposedStatement: "x" });
    expect(preview.status).toBe(200);
    const draft = await api("GET", `/api/v1/owner-experience/drafts/local/home?websiteId=${ownerSite}&serverVersion=3`, "owner");
    expect(draft.json).toMatchObject({ eligibleForRecovery: true, actionRequired: "RESTORE_SAFE", localVersion: 3 });
    expect((await api("POST", "/api/v1/components/source/import", "owner", source(ownerSite))).status).toBe(200);
    const report = await api("GET", `/api/v1/benchmark/runs/${runIds[0]}`, "admin");
    expect(report.status).toBe(200);
    expect(report.json.report.config.productName).toBe(run.config.productName);
    const runs = await api("GET", "/api/v1/benchmark/runs", "admin");
    expect(runs.json.runs.map((r: any) => r.runId)).toContain(runIds[0]);
    const leads = await api("GET", `/api/v1/forms-leads/leads?websiteId=${ownerSite}&stage=CONTACTED`, "owner");
    expect(leads.json.leads.map((l: any) => l.id)).toEqual([leadId]);
  }, 60_000); // re-imports the whole application

  it("rate limits writes per user without affecting other users", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await api("POST", "/api/v1/components/source/import", "outsider", source(outsiderSite, `export const v${i} = ${i};`))).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect((await api("POST", "/api/v1/components/source/import", "owner", source(ownerSite, "export const other = 1;"))).status).toBe(201);
  });
});
