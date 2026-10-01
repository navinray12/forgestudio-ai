import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma, pgPool } from "../config/prisma.js";
import { assignDefaultFreePlan } from "../services/subscription.service.js";
import { createTenantWorkspace, createTenantWorkspaceWebsite } from "../services/workspaces/workspace-api.service.js";
import { startDesignExecution, getDesignExecution, cancelDesignExecution, retryDesignExecution } from "../modules/ai/design/executions.js";
import { runDesignExecution } from "../modules/ai/design/pipeline.js";
import { HtmlDesignConverter } from "../modules/ai/design/converter.js";
import type { DesignPlanner, DesignProvider, ArtifactStore } from "../modules/ai/design/contracts.js";
import { applyAiChangeset } from "../modules/ai/site-generation.service.js";
import { saveWebsiteDocument } from "../services/websites/save-document.js";
import { processNextJob, registerJobHandler } from "../services/jobs/jobRunner.js";
import { AppError } from "../utils/app-error.js";

const database = new URL(process.env.DATABASE_URL || "invalid:");
if (process.env.FORGE_DISPOSABLE_TEST_DB !== "1" || !["localhost", "127.0.0.1"].includes(database.hostname) || database.pathname !== "/forge_hardening") throw new Error("Requires opted-in local forge_hardening database");
test("durable Stitch/Claude proposal lifecycle on PostgreSQL (fixture providers)", async t => {
  const env = { ...process.env };
  Object.assign(process.env, { AI_PROMPT_ENCRYPTION_KEY: randomBytes(32).toString("base64"), STITCH_API_KEY: "fixture-key", ANTHROPIC_API_KEY: "fixture-key", AI_CLAUDE_DESIGN_MODEL: "fixture-claude", AI_DESIGN_DAILY_UNITS: "10000", AI_DESIGN_MAX_PAGES: "2" });
  t.after(async () => { for (const key of ["AI_PROMPT_ENCRYPTION_KEY", "STITCH_API_KEY", "ANTHROPIC_API_KEY", "AI_CLAUDE_DESIGN_MODEL", "AI_DESIGN_DAILY_UNITS", "AI_DESIGN_MAX_PAGES"]) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; } await prisma.$disconnect(); await pgPool.end(); });
  const owner = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, fullName: "Design fixture", status: "ACTIVE" } });
  const outsider = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, fullName: "Other tenant", status: "ACTIVE" } });
  await prisma.subscriptionPlan.upsert({ where: { slug: "free" }, update: {}, create: { name: "Fixture", slug: "free", price: 0, currency: "INR", billingInterval: "monthly", websiteLimit: 1, features: [] } });
  await assignDefaultFreePlan(owner.id);
  const { workspace } = await createTenantWorkspace(owner.id, { name: "Design fixtures" }, randomUUID());
  const websiteId = (await createTenantWorkspaceWebsite(owner.id, workspace.id, "Design fixture", randomUUID())).resourceId;
  const website = () => prisma.website.findUniqueOrThrow({ where: { id: websiteId } });
  const brief = "PRIVATE_BRIEF_MARKER build a beautiful editorial academy website";
  const input = { workflow: "stitch-claude", prompt: brief, operation: "GENERATE_SITE", scope: { type: "site" } };
  const stored = new Map<string, string>();
  const artifacts: ArtifactStore = { async put(value) { const id = randomUUID(); stored.set(id, value); return id; }, async get(key) { if (!stored.has(key)) throw new Error("Missing fixture artifact"); return stored.get(key)!; } };
  let plans = 0, screens = 0, failExport = false, failScreen = false, cancelDuringPlan: string | undefined;
  const planner: DesignPlanner = {
    async plan() { plans++; if (cancelDuringPlan) await cancelDesignExecution(cancelDuringPlan, owner.id, randomUUID()); return { design: "Editorial green and ivory with strong typographic hierarchy", pages: [{ name: "Home", slug: "/", brief: "A complete editorial academy landing page" }], setupRequired: [] }; },
    async repair() { throw new Error("Repair was not expected"); }, async edit() { return []; },
  };
  const designer: DesignProvider = { async createProject() { return "fixture-project"; }, async generate() { screens++; if (failScreen) throw new Error("SECRET_REMOTE_BODY"); return { screenId: "fixture-screen" }; }, async html() { if (failExport) throw new AppError("Export unavailable", 503, "AI_EXPORT_UNAVAILABLE"); return '<body style="font-family:system-ui;color:#172033"><main><h1>Editorial academy</h1><p>Learn with confidence.</p><a href="/">Home</a></main></body>'; }, async close() {} };
  registerJobHandler("AI_DESIGN_EXECUTION", async (payload, job) => runDesignExecution(String(payload.executionId), { id: job.id, lockToken: job.lockToken! }, { planner, designer, artifacts, converter: new HtmlDesignConverter() }));
  async function start() { return startDesignExecution(websiteId, owner.id, input, { key: randomUUID(), expectedVersion: (await website()).documentVersion }); }
  async function run(id: string) { const job = await prisma.backgroundJob.findFirstOrThrow({ where: { idempotencyKey: `ai:${id}` } }); await prisma.backgroundJob.update({ where: { id: job.id }, data: { runAt: new Date(0) } }); await processNextJob({ id: job.id }); return getDesignExecution(id, owner.id); }
  await t.test("enqueue and replay are durable, private and tenant scoped; no early mutation", async () => {
    const before = await website(), write = { key: randomUUID(), expectedVersion: before.documentVersion };
    const first = await startDesignExecution(websiteId, owner.id, input, write);
    delete process.env.STITCH_API_KEY;
    try { assert.deepEqual(await startDesignExecution(websiteId, owner.id, input, write), first); }
    finally { process.env.STITCH_API_KEY = "fixture-key"; }
    assert.equal((await website()).documentVersion, before.documentVersion);
    const dto = await getDesignExecution(first.executionId, owner.id);
    assert.equal(dto.status, "QUEUED"); assert.equal(JSON.stringify(dto).includes(brief), false);
    await assert.rejects(getDesignExecution(first.executionId, outsider.id));
    await assert.rejects(cancelDesignExecution(first.executionId, outsider.id, randomUUID()));
    const job = await prisma.backgroundJob.findFirstOrThrow({ where: { idempotencyKey: `ai:${first.executionId}` } });
    assert.deepEqual(job.payload, { executionId: first.executionId });
    await cancelDesignExecution(first.executionId, owner.id, randomUUID());
    assert.equal((await run(first.executionId)).status, "CANCELLED"); assert.equal(plans, 0);
  });
  await t.test("generation proposes, apply commits once, subsequent manual editing works", async () => {
    const before = await website(), first = await start(), ready = await run(first.executionId);
    assert.equal(ready.status, "COMPLETED", JSON.stringify(ready)); assert.ok(ready.changesetId);
    assert.equal((await website()).documentVersion, before.documentVersion);
    const write = { key: randomUUID(), expectedVersion: before.documentVersion };
    const applied = await applyAiChangeset(ready.changesetId!, owner.id, write);
    assert.deepEqual(await applyAiChangeset(ready.changesetId!, owner.id, write), applied);
    const manual = await saveWebsiteDocument(websiteId, owner.id, { editorData: { version: 1, elements: [{ id: "manual", type: "heading", content: "Manually edited" }] } }, { key: randomUUID(), expectedVersion: applied.documentVersion });
    assert.equal(manual.documentVersion, applied.documentVersion + 1);
  });
  await t.test("linked retry reuses completed paid checkpoints without overwriting original", async () => {
    failExport = true; const first = await start(); assert.equal((await run(first.executionId)).status, "FAILED");
    const previousPlans = plans, previousScreens = screens;
    await assert.rejects(retryDesignExecution(first.executionId, outsider.id, { key: randomUUID(), expectedVersion: (await website()).documentVersion }));
    failExport = false;
    const retry = await retryDesignExecution(first.executionId, owner.id, { key: randomUUID(), expectedVersion: (await website()).documentVersion });
    assert.notEqual(retry.executionId, first.executionId); assert.equal((await run(retry.executionId)).status, "COMPLETED");
    assert.equal(plans, previousPlans); assert.equal(screens, previousScreens);
    assert.equal((await getDesignExecution(first.executionId, owner.id)).status, "FAILED");
  });
  await t.test("uncertain screen creation cannot be blindly retried", async () => {
    failScreen = true; const first = await start(), result = await run(first.executionId); failScreen = false;
    assert.equal(result.status, "RECONCILIATION_REQUIRED"); assert.equal(result.errorCode, "AI_EXTERNAL_OUTCOME_UNKNOWN");
    await assert.rejects(retryDesignExecution(first.executionId, owner.id, { key: randomUUID(), expectedVersion: (await website()).documentVersion }), { code: "AI_EXECUTION_STATE" });
    assert.equal(JSON.stringify(result).includes("SECRET"), false);
  });
  await t.test("cancel during a provider call fences all later stages", async () => {
    const first = await start(), previousScreens = screens; cancelDuringPlan = first.executionId;
    const result = await run(first.executionId); cancelDuringPlan = undefined;
    assert.equal(result.status, "CANCELLED"); assert.equal(screens, previousScreens); assert.equal(result.changesetId, null);
  });
  await t.test("expired briefs never call a provider", async () => {
    const first = await start(), previousPlans = plans;
    await prisma.aiExecution.update({ where: { id: first.executionId }, data: { promptExpiresAt: new Date(0) } });
    assert.equal((await run(first.executionId)).errorCode, "AI_PROMPT_EXPIRED"); assert.equal(plans, previousPlans);
    await assert.rejects(retryDesignExecution(first.executionId, owner.id, { key: randomUUID(), expectedVersion: (await website()).documentVersion }), { code: "AI_PROMPT_EXPIRED" });
  });
});
