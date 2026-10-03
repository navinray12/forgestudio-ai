import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { HtmlDesignConverter } from "../modules/ai/design/converter.js";
import { applyScopedEdits } from "../modules/ai/design/edit-operations.js";
import { ClaudeDesignPlanner } from "../modules/ai/design/claude-planner.js";
import { LocalDesignArtifacts } from "../modules/ai/design/artifacts.js";
import { PrivateStitchClient } from "../modules/ai/design/stitch-client.js";
import type { JsonObject } from "../services/websites/document-policy.js";

const converter = new HtmlDesignConverter();
test("Stitch transport never logs or propagates provider bodies", async t => {
  const logged: unknown[] = [];
  t.mock.method(console, "error", (...values: unknown[]) => logged.push(values));
  const client = new PrivateStitchClient("PRIVATE_KEY", (async () => new Response("PRIVATE_PROVIDER_BODY", { status: 503 })) as typeof fetch);
  await assert.rejects(client.callTool("create_project", { title: "PRIVATE_PROMPT" }), error => error instanceof Error && !error.message.includes("PRIVATE"));
  assert.equal(JSON.stringify(logged).includes("PRIVATE"), false);
  await client.close();
});
export const htmlFixture = `<html><head><style>body{font-family:system-ui;color:#17332a;margin:0}main{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:40px 20px;background:linear-gradient(90deg,#fff,#eee)}h1{font-size:48px}@media(max-width:767px){main{grid-template-columns:1fr;padding:20px}h1{font-size:32px}}</style></head><body><main><h1>Independent learning</h1><p>Build a stronger future.</p><a href="/">Explore programs</a></main></body></html>`;
test("HTML becomes deterministic native elements with responsive styles", async () => {
  const first = await converter.convert(htmlFixture, "fixture"), second = await converter.convert(htmlFixture, "fixture");
  assert.deepEqual(first, second);
  const root = first[0]!, main = (root.children as JsonObject[])[0]!, heading = (main.children as JsonObject[])[0]!;
  assert.equal(main.type, "container"); assert.equal(heading.headingLevel, "h1");
  assert.equal((main.styles as JsonObject).paddingLeft, "20px");
  assert.equal(((main.responsiveStyles as JsonObject).mobile as JsonObject).gridTemplateColumns, "1fr");
  assert.equal(((heading.responsiveStyles as JsonObject).mobile as JsonObject).fontSize, "32px");
});
for (const [name, html] of Object.entries({ script: "<script>alert('secret')</script><h1>Hello</h1>", event: '<h1 onclick="alert(1)">Hello</h1>', external: '<link rel="stylesheet" href="http://localhost/private"><h1>Hello</h1>', css: '<h1 style="background:url(http://localhost/private)">Hello</h1>', iframe: '<iframe src="https://example.test"></iframe>', link: '<a href="javascript:alert(1)">Click</a>' })) {
  test(`unsafe export fails closed: ${name}`, async () => { await assert.rejects(converter.convert(html, "fixture"), { code: "AI_CONVERSION_UNSUPPORTED" }); });
}
test("scoped operations preserve unrelated elements and input", () => {
  const input: JsonObject = { version: 1, homePageId: "home", pages: [{ id: "home", slug: "/", elements: [{ id: "a", type: "heading", content: "Original" }, { id: "b", type: "text", content: "Untouched" }] }] };
  const result = applyScopedEdits(input, [{ type: "text", elementId: "a", text: "Changed" }], { type: "selection", pageId: "home", elementId: "a" });
  assert.equal(((result.pages as JsonObject[])[0]!.elements as JsonObject[])[0]!.content, "Changed");
  assert.equal(((input.pages as JsonObject[])[0]!.elements as JsonObject[])[0]!.content, "Original");
  assert.throws(() => applyScopedEdits(input, [{ type: "text", elementId: "b", text: "Escape" }], { type: "selection", pageId: "home", elementId: "a" }), { code: "AI_SCOPE_VIOLATION" });
});
test("provider invalid JSON, timeout and error bodies remain safe", async t => {
  const original = process.env.ANTHROPIC_API_KEY; process.env.ANTHROPIC_API_KEY = "fixture-only";
  t.after(() => { if (original === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = original; });
  for (const fetcher of [async () => new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "SECRET_INVALID_JSON" }] })), async () => new Response("SECRET_PROVIDER_BODY", { status: 429 }), async () => { throw new DOMException("SECRET_TIMEOUT", "TimeoutError"); }]) {
    const planner = new ClaudeDesignPlanner("fixture-model", fetcher as typeof fetch);
    await assert.rejects(planner.plan("A detailed private brief"), error => error instanceof Error && !error.message.includes("SECRET"));
  }
});
test("private artifacts are encrypted and path traversal is rejected", async t => {
  const directory = await mkdtemp(join(tmpdir(), "forge-artifacts-test-"));
  const original = process.env.AI_PROMPT_ENCRYPTION_KEY; process.env.AI_PROMPT_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  t.after(async () => { await rm(directory, { recursive: true }); if (original === undefined) delete process.env.AI_PROMPT_ENCRYPTION_KEY; else process.env.AI_PROMPT_ENCRYPTION_KEY = original; });
  const store = new LocalDesignArtifacts(directory), key = await store.put("PRIVATE_DESIGN_CONTENT");
  assert.equal((await readFile(join(directory, key), "utf8")).includes("PRIVATE_DESIGN_CONTENT"), false);
  assert.equal(await store.get(key), "PRIVATE_DESIGN_CONTENT");
  await assert.rejects(store.get("../.env"), { code: "AI_ARTIFACT_UNAVAILABLE" });
});
