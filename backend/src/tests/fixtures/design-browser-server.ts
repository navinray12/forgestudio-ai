/** Test-only composition: real HTTP, PostgreSQL and worker; deterministic paid-provider ports. */
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createApplication } from "../../app.js";
import { prisma, pgPool } from "../../config/prisma.js";
import { assignDefaultFreePlan } from "../../services/subscription.service.js";
import { createTenantWorkspace, createTenantWorkspaceWebsite } from "../../services/workspaces/workspace-api.service.js";
import { runDesignExecution } from "../../modules/ai/design/pipeline.js";
import { IsolatedDesignConverter } from "../../modules/ai/design/isolated-converter.js";
import { registerJobHandler, startJobWorker, stopJobWorker } from "../../services/jobs/jobRunner.js";

const database = new URL(process.env.DATABASE_URL || "invalid:"), output = process.env.FORGE_BROWSER_FIXTURE_PATH;
if (process.env.NODE_ENV !== "test" || process.env.FORGE_DISPOSABLE_TEST_DB !== "1" || database.pathname !== "/forge_hardening" || !["localhost", "127.0.0.1"].includes(database.hostname) || !output || !isAbsolute(output)) throw new Error("Requires explicitly opted-in disposable local test database and private fixture path");
Object.assign(process.env, { STITCH_API_KEY: "fixture-only", ANTHROPIC_API_KEY: "fixture-only", AI_CLAUDE_DESIGN_MODEL: "fixture-only", AI_PROMPT_ENCRYPTION_KEY: randomBytes(32).toString("base64"), AI_DESIGN_DAILY_UNITS: "10000" });
const user = await prisma.user.create({ data: { fullName: "Design browser fixture", email: `${randomUUID()}@example.test`, status: "ACTIVE", emailVerified: true } });
await prisma.subscriptionPlan.upsert({ where: { slug: "free" }, update: {}, create: { name: "Fixture", slug: "free", price: 0, websiteLimit: 1, features: [] } });
await assignDefaultFreePlan(user.id);
const { workspace } = await createTenantWorkspace(user.id, { name: "Design browser fixture" }, randomUUID());
const websiteId = (await createTenantWorkspaceWebsite(user.id, workspace.id, "Design browser fixture", randomUUID())).resourceId;
const token = randomBytes(32).toString("hex");
await prisma.session.create({ data: { userId: user.id, authEpoch: 1, audience: "TENANT", authMethod: "local", authTime: new Date(), tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60 * 60_000) } });
await writeFile(output, JSON.stringify({ token, websiteId }), { mode: 0o600 });
const artifacts = new Map<string, string>();
registerJobHandler("AI_DESIGN_EXECUTION", async (payload, job) => runDesignExecution(String(payload.executionId), job, {
  planner: { async plan() { return { design: "A confident green editorial academy with spacious typography", pages: [{ name: "Home", slug: "/", brief: "Home page with navigation, hero and contact CTA" }], setupRequired: [] }; }, async repair(html) { return html; }, async edit(document) { const pages = document.pages as Array<{elements: Array<{children: Array<{children: Array<{id: string}>}>}>}>; return [{ type: "text", elementId: pages[0]!.elements[0]!.children[0]!.children[0]!.id, text: "AI edited heading" }]; } },
  designer: { async createProject() { return "fixture-project"; }, async generate() { return { screenId: "fixture-screen" }; }, async html() { return '<style>body{margin:0;color:#153e32;font-family:system-ui}main{padding:40px;background:#f8f5ee;display:grid;grid-template-columns:1fr 1fr;gap:24px}h1{font-size:48px}@media(max-width:767px){main{padding:20px;grid-template-columns:1fr}h1{font-size:28px}}</style><main><h1>Editorial academy</h1><p>Learn with confidence.</p><a href="/">Explore courses</a></main>'; }, async close() {} },
  artifacts: { async put(value) { const id = randomUUID(); artifacts.set(id, value); return id; }, async get(key) { return artifacts.get(key)!; } }, converter: new IsolatedDesignConverter(),
}));
startJobWorker(200);
const server = createServer(createApplication());
server.listen(Number(process.env.PORT || 55001), "127.0.0.1", () => console.log("Disposable design browser server ready; provider ports use fixtures"));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { server.close(async () => { await stopJobWorker(); await prisma.$disconnect(); await pgPool.end(); process.exit(0); }); });
