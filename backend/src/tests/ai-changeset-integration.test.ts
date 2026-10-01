import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma, pgPool } from "../config/prisma.js";
import { assignDefaultFreePlan } from "../services/subscription.service.js";
import { createTenantWorkspace, createTenantWorkspaceWebsite, addTenantWorkspaceMember } from "../services/workspaces/workspace-api.service.js";
import { saveWebsiteDocument } from "../services/websites/save-document.js";
import { applyAiChangeset, cancelAiChangeset, getAiChangeset, retryAiChangeset, generateSiteDraft } from "../modules/ai/site-generation.service.js";
import { encryptPrompt } from "../modules/ai/prompt-vault.js";
import { purgeExpiredAiPrompts } from "../modules/ai/prompt-cleanup.js";

const database = new URL(process.env.DATABASE_URL || "invalid:");
if (process.env.FORGE_DISPOSABLE_TEST_DB !== "1" || !["localhost", "127.0.0.1"].includes(database.hostname) || database.pathname !== "/forge_hardening") {
  throw new Error("AI integration tests require the explicitly opted-in local forge_hardening database");
}

test("AI approval contracts on migrated disposable PostgreSQL", async t => {
  const env = { ...process.env };
  t.after(async () => {
    for (const key of ["AI_PROMPT_ENCRYPTION_KEY", "AI_SITE_PROVIDER", "GEMINI_API_KEY", "AI_MODEL_GEMINI"]) {
      if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
    }
    await prisma.$disconnect(); await pgPool.end();
  });
  process.env.AI_PROMPT_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.AI_SITE_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "fixture-key-not-a-real-credential";
  process.env.AI_MODEL_GEMINI = "fixture-gemini";
  const user = (name: string) => prisma.user.create({ data: { fullName: name, email: `${randomUUID()}@example.test`, status: "ACTIVE" } });
  const owner = await user("AI owner"), viewer = await user("AI viewer"), outsider = await user("Other workspace");
  await prisma.subscriptionPlan.upsert({ where: { slug: "free" }, update: {}, create: { name: "Fixture", slug: "free", price: 0, currency: "INR", billingInterval: "monthly", websiteLimit: 1, features: [] } });
  await assignDefaultFreePlan(owner.id);
  const { workspace } = await createTenantWorkspace(owner.id, { name: "AI qualification" }, randomUUID());
  await prisma.organizationMember.createMany({ data: [viewer, outsider].map(actor => ({ organizationId: workspace.organizationId!, userId: actor.id, role: "MEMBER" })) });
  await addTenantWorkspaceMember(owner.id, workspace.id, viewer.id, "MEMBER", randomUUID());
  const sibling = await createTenantWorkspace(owner.id, { name: "Other workspace", organizationId: workspace.organizationId! }, randomUUID());
  await addTenantWorkspaceMember(owner.id, sibling.resourceId, outsider.id, "MEMBER", randomUUID());
  const websiteId = (await createTenantWorkspaceWebsite(owner.id, workspace.id, "AI fixture", randomUUID())).resourceId;
  const current = () => prisma.website.findUniqueOrThrow({ where: { id: websiteId } });
  const draft = (text: string) => ({ version: 1, elements: [{ id: "title", type: "heading", content: { text } }] });
  const secret = "PRIVATE_BRIEF_MARKER_do_not_log_or_return";
  async function proposal(text: string = randomUUID(), expires = new Date(Date.now() + 60_000)) {
    const website = await current();
    const execution = await prisma.aiExecution.create({ data: { websiteId, workspaceId: workspace.id, organizationId: workspace.organizationId, actorId: owner.id,
      operation: "SITE_GENERATION", provider: "gemini", model: "fixture-original-model", status: "COMPLETED", promptCiphertext: encryptPrompt(secret), promptExpiresAt: expires,
    } });
    return prisma.aiChangeset.create({ data: { executionId: execution.id, websiteId, workspaceId: workspace.id, organizationId: workspace.organizationId, actorId: owner.id, expectedDocumentVersion: website.documentVersion, proposedDocument: draft(text) } });
  }
  const writeFor = (row: { expectedDocumentVersion: number }) => ({ key: randomUUID(), expectedVersion: row.expectedDocumentVersion });

  await t.test("cross-workspace reads and mutations fail without provider calls", async () => {
    const row = await proposal();
    await assert.rejects(getAiChangeset(row.id, outsider.id), { code: "WEBSITE_NOT_FOUND" });
    await assert.rejects(applyAiChangeset(row.id, outsider.id, writeFor(row)), { code: "WEBSITE_NOT_FOUND" });
    await assert.rejects(cancelAiChangeset(row.id, outsider.id), { code: "WEBSITE_NOT_FOUND" });
    await assert.rejects(retryAiChangeset(row.id, outsider.id, row.expectedDocumentVersion), { code: "WEBSITE_NOT_FOUND" });
  });
  await t.test("view permission does not grant apply, cancel or paid retry", async () => {
    const row = await proposal();
    assert.equal((await getAiChangeset(row.id, viewer.id)).id, row.id);
    await assert.rejects(applyAiChangeset(row.id, viewer.id, writeFor(row)), { code: "DOCUMENT_EDIT_FORBIDDEN" });
    await assert.rejects(cancelAiChangeset(row.id, viewer.id), { code: "DOCUMENT_EDIT_FORBIDDEN" });
    await assert.rejects(retryAiChangeset(row.id, viewer.id, row.expectedDocumentVersion), { code: "DOCUMENT_EDIT_FORBIDDEN" });
  });
  await t.test("apply commits one revision, audit, outbox and acknowledgement; lost acknowledgement replays", async () => {
    const row = await proposal("Applied text"), write = writeFor(row);
    const beforeRevisions = await prisma.websiteRevision.count({ where: { websiteId } });
    const [first, duplicate] = await Promise.all([applyAiChangeset(row.id, owner.id, write), applyAiChangeset(row.id, owner.id, write)]);
    assert.deepEqual(first, duplicate);
    assert.equal(first.documentVersion, row.expectedDocumentVersion + 1);
    assert.ok(first.revisionId);
    assert.equal(await prisma.websiteRevision.count({ where: { websiteId } }), beforeRevisions + 1);
    assert.equal((await getAiChangeset(row.id, owner.id)).status, "APPLIED");
    assert.equal((await getAiChangeset(row.id, owner.id)).appliedRevisionId, first.revisionId);
    assert.deepEqual((await getAiChangeset(row.id, owner.id)).applyAcknowledgement, first);
    assert.equal((await pgPool.query('SELECT count(*)::int n FROM workspace_command_journal WHERE "idempotencyKey"=$1', [write.key])).rows[0].n, 1);
    assert.equal((await pgPool.query('SELECT count(*)::int n FROM workspace_outbox WHERE "resourceId"=$1 AND operation=$2', [websiteId, "AI_CHANGESET_APPLIED"])).rows[0].n, 1);
    const manual = await saveWebsiteDocument(websiteId, owner.id, { editorData: draft("Manual after AI") }, { key: randomUUID(), expectedVersion: first.documentVersion });
    assert.equal(manual.documentVersion, first.documentVersion + 1);
    assert.deepEqual(await applyAiChangeset(row.id, owner.id, write), first);
    assert.deepEqual((await current()).editorData, draft("Manual after AI"));
    await assert.rejects(applyAiChangeset(row.id, owner.id, writeFor(row)), { code: "AI_CHANGESET_STATE" });
  });
  await t.test("replay reauthorizes the actor after permission revocation", async () => {
    const row = await proposal(), write = writeFor(row);
    await applyAiChangeset(row.id, owner.id, write);
    const deny = await prisma.granularPermission.create({ data: { websiteId, userId: owner.id, resourceId: "*", capability: "EDIT_DESIGN", effect: "DENY" } });
    try { await assert.rejects(applyAiChangeset(row.id, owner.id, write), { code: "DOCUMENT_EDIT_FORBIDDEN" }); }
    finally { await prisma.granularPermission.delete({ where: { id: deny.id } }); }
  });
  await t.test("stale proposals never overwrite a manual save", async () => {
    const row = await proposal();
    await saveWebsiteDocument(websiteId, owner.id, { editorData: draft("Concurrent manual") }, writeFor(row));
    await assert.rejects(applyAiChangeset(row.id, owner.id, writeFor(row)), { code: "DOCUMENT_VERSION_CONFLICT" });
    assert.equal((await getAiChangeset(row.id, owner.id)).status, "PENDING_REVIEW");
  });
  await t.test("cancel is idempotent and prevents apply", async () => {
    const row = await proposal(), before = await current();
    assert.equal((await cancelAiChangeset(row.id, owner.id)).status, "CANCELLED");
    assert.equal((await cancelAiChangeset(row.id, owner.id)).status, "CANCELLED");
    await assert.rejects(applyAiChangeset(row.id, owner.id, writeFor(row)), { code: "AI_CHANGESET_STATE" });
    assert.deepEqual((await current()).editorData, before.editorData);
  });
  await t.test("concurrent apply/cancel has exactly one winner", async () => {
    const row = await proposal(), before = await current();
    const outcomes = await Promise.allSettled([applyAiChangeset(row.id, owner.id, writeFor(row)), cancelAiChangeset(row.id, owner.id)]);
    assert.equal(outcomes.filter(outcome => outcome.status === "fulfilled").length, 1);
    const after = await getAiChangeset(row.id, owner.id);
    assert.equal((await current()).documentVersion, before.documentVersion + (after.status === "APPLIED" ? 1 : 0));
  });
  await t.test("mandatory audit failure rolls back document, status, revision and journal", async () => {
    const row = await proposal(), before = await current(), write = writeFor(row);
    const revisionCount = await prisma.websiteRevision.count({ where: { websiteId } });
    await pgPool.query(`CREATE FUNCTION ai_audit_failure_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='AI_CHANGESET_APPLIED' THEN RAISE EXCEPTION 'fixture audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER ai_audit_failure_fixture BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ai_audit_failure_fixture()`);
    try { await assert.rejects(applyAiChangeset(row.id, owner.id, write)); }
    finally { await pgPool.query('DROP TRIGGER ai_audit_failure_fixture ON audit_logs; DROP FUNCTION ai_audit_failure_fixture()'); }
    assert.deepEqual((await current()).editorData, before.editorData);
    assert.equal((await current()).documentVersion, before.documentVersion);
    assert.equal((await getAiChangeset(row.id, owner.id)).status, "PENDING_REVIEW");
    assert.equal(await prisma.websiteRevision.count({ where: { websiteId } }), revisionCount);
    assert.equal((await pgPool.query('SELECT count(*)::int n FROM workspace_command_journal WHERE "idempotencyKey"=$1', [write.key])).rows[0].n, 0);
  });
  await t.test("expired retry is rejected and cleanup is bounded and repeatable", async () => {
    // Isolate the cutoff from other concurrently running expiry fixtures.
    const cutoff = new Date(-1_000_000_000_000);
    const a = await proposal("Expired A", cutoff), b = await proposal("Expired B", cutoff), fresh = await proposal();
    await assert.rejects(retryAiChangeset(a.id, owner.id, a.expectedDocumentVersion), { code: "AI_PROMPT_EXPIRED" });
    assert.equal(await purgeExpiredAiPrompts(cutoff, 1), 1);
    assert.equal(await purgeExpiredAiPrompts(cutoff, 1), 1);
    assert.equal(await purgeExpiredAiPrompts(cutoff, 1), 0);
    for (const row of [a, b]) assert.equal((await prisma.aiExecution.findUniqueOrThrow({ where: { id: row.executionId } })).promptCiphertext, null);
    assert.ok((await prisma.aiExecution.findUniqueOrThrow({ where: { id: fresh.executionId } })).promptCiphertext);
    await assert.rejects(purgeExpiredAiPrompts(new Date(), 1001));
  });
  await t.test("retry preserves provider/model and original proposal without exposing encrypted prompt", async sub => {
    const row = await proposal();
    const cipher = (await prisma.aiExecution.findUniqueOrThrow({ where: { id: row.executionId } })).promptCiphertext!;
    assert.ok(!cipher.includes(secret));
    const logs: unknown[] = [];
    sub.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
    sub.mock.method(console, "warn", (...args: unknown[]) => { logs.push(args); });
    sub.mock.method(console, "log", (...args: unknown[]) => { logs.push(args); });
    let requestedUrl = "";
    sub.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
      requestedUrl = String(url);
      return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ pages: [{ name: "Home", slug: "/", sections: [{ heading: "A real editable fixture", body: "Useful content", ctaLabel: "", ctaHref: "" }] }] }) }] } }] });
    });
    process.env.AI_SITE_PROVIDER = "invalid-default-must-not-be-used";
    try {
      const result = await retryAiChangeset(row.id, owner.id, row.expectedDocumentVersion);
      assert.notEqual(result.changeset.id, row.id);
      assert.match(requestedUrl, /fixture-original-model:generateContent$/);
      assert.deepEqual(await getAiChangeset(row.id, owner.id), row);
      for (const output of [JSON.stringify(result), JSON.stringify(await getAiChangeset(row.id, owner.id)), JSON.stringify(logs), JSON.stringify(await prisma.auditLog.findMany({ where: { userId: owner.id } }))]) {
        assert.ok(!output.includes(secret)); assert.ok(!output.includes(cipher)); assert.ok(!output.includes(process.env.GEMINI_API_KEY!));
      }
    } finally { process.env.AI_SITE_PROVIDER = "gemini"; }
  });
  for (const mode of ["invalid-json", "timeout"] as const) {
    await t.test(`provider ${mode} fails safely and never creates a proposal`, async sub => {
      const before = await current(), count = await prisma.aiChangeset.count({ where: { websiteId } });
      sub.mock.method(globalThis, "fetch", async () => {
        if (mode === "timeout") throw new DOMException("SECRET_PROVIDER_BODY", "AbortError");
        return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "SECRET_PROVIDER_BODY_not_json" }] } }] });
      });
      await assert.rejects(generateSiteDraft({ websiteId, actorId: owner.id, expectedVersion: before.documentVersion, prompt: secret }), (error: unknown) => {
        assert.ok(error instanceof Error); assert.ok(!error.message.includes("SECRET_PROVIDER_BODY")); return true;
      });
      assert.equal(await prisma.aiChangeset.count({ where: { websiteId } }), count);
      assert.deepEqual((await current()).editorData, before.editorData);
    });
  }
});
