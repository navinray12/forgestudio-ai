import { strict as assert } from "node:assert";
import { test } from "node:test";
import { canonicalSiteFromBlueprint } from "../modules/ai/site-blueprint.js";
import { OpenAiProvider } from "../modules/ai/openai.provider.js";
import { AnthropicProvider } from "../modules/ai/anthropic.provider.js";
import { siteGenerationProvider } from "../modules/ai/provider-routing.js";

const blueprint = { pages: [
  { name: "Home", slug: "/", sections: [{ heading: "Welcome", body: "A useful introduction", ctaLabel: "About", ctaHref: "/about" }] },
  { name: "About", slug: "/about", sections: [{ heading: "Our story", body: "A short story", ctaLabel: "", ctaHref: "" }] },
] };
const request = { operation: "SITE_GENERATION" as const, prompt: "Create a useful website", context: { websiteName: "Example" } };

test("blueprint becomes editable canonical pages with supported widgets", () => {
  const draft = canonicalSiteFromBlueprint(blueprint);
  assert.deepEqual(draft.pageNames, ["Home", "About"]);
  assert.equal(draft.sectionCount, 2);
  const pages = draft.editorData.pages as Array<{ elements: Array<{ type: string; children: Array<{ type: string }> }> }>;
  assert.deepEqual(pages[0]?.elements[0]?.children.map(child => child.type), ["heading", "text", "button"]);
  assert.equal(draft.editorData.homePageId, (draft.editorData.pages as Array<{ id: string }>)[0]?.id);
});

test("blueprint rejects unsupported fields, duplicate pages, unsafe links and oversized output", () => {
  assert.throws(() => canonicalSiteFromBlueprint({ pages: [{ ...blueprint.pages[0], html: "<script>" }] }), /invalid website draft/);
  assert.throws(() => canonicalSiteFromBlueprint({ pages: [blueprint.pages[0], blueprint.pages[0]] }), /invalid website draft/);
  assert.throws(() => canonicalSiteFromBlueprint({ pages: [{ ...blueprint.pages[0], sections: [{ ...blueprint.pages[0].sections[0], ctaHref: "https://evil.example" }] }] }), /invalid website draft/);
  assert.throws(() => canonicalSiteFromBlueprint({ pages: Array(9).fill(blueprint.pages[0]) }), /invalid website draft/);
});

test("OpenAI adapter reads raw Responses output and sends strict schema without document context", async () => {
  let sent: Record<string, unknown> | undefined;
  const fakeFetch = async (_url: string | URL | Request, options?: RequestInit) => {
    sent = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({ status: "completed", id: "resp_test", output: [
      { type: "message", content: [{ type: "output_text", text: JSON.stringify(blueprint) }] },
    ] }), { status: 200 });
  };
  const result = await new OpenAiProvider("test-key", "test-model", fakeFetch as typeof fetch).generate(request);
  assert.equal(result.requestId, "resp_test");
  assert.deepEqual(JSON.parse(result.text), blueprint);
  assert.equal((sent?.text as { format: { strict: boolean } }).format.strict, true);
  assert.equal(JSON.stringify(sent).includes("existingDocument"), false);
  assert.equal(JSON.stringify(sent).includes("test-key"), false);
});

test("OpenAI adapter rejects incomplete output and hides provider body", async () => {
  const fakeFetch = async () => new Response(JSON.stringify({ status: "incomplete", output: [], secret: "do-not-leak" }), { status: 200 });
  await assert.rejects(new OpenAiProvider("test-key", "test-model", fakeFetch as typeof fetch).generate(request), error => {
    assert.equal((error as { code: string }).code, "AI_INVALID_OUTPUT");
    assert.equal(JSON.stringify(error).includes("do-not-leak"), false);
    return true;
  });
});

test("Anthropic adapter reads Messages output and hides provider error bodies", async () => {
  const success = async () => new Response(JSON.stringify({ stop_reason: "end_turn", id: "msg_test", model: "test-model", content: [{ type: "text", text: JSON.stringify(blueprint) }] }), { status: 200 });
  const result = await new AnthropicProvider("test-key", "test-model", success as typeof fetch).generate(request);
  assert.equal(result.requestId, "msg_test");
  const failure = async () => new Response(JSON.stringify({ error: { message: "do-not-leak" } }), { status: 500 });
  await assert.rejects(new AnthropicProvider("test-key", "test-model", failure as typeof fetch).generate(request), error => {
    assert.equal((error as { code: string }).code, "AI_PROVIDER_UNAVAILABLE");
    assert.equal(JSON.stringify(error).includes("do-not-leak"), false);
    return true;
  });
});

test("provider timeout is safe and provider route is explicit", async () => {
  const timeout = async () => { throw new Error("provider secret response body"); };
  await assert.rejects(new OpenAiProvider("test-key", "test-model", timeout as typeof fetch).generate(request), error => {
    assert.equal((error as { code: string }).code, "AI_PROVIDER_UNAVAILABLE");
    assert.equal(JSON.stringify(error).includes("provider secret response body"), false);
    return true;
  });
  const before = process.env.AI_SITE_PROVIDER;
  try {
    process.env.AI_SITE_PROVIDER = "anthropic";
    assert.equal(siteGenerationProvider().name, "anthropic");
    process.env.AI_SITE_PROVIDER = "invalid";
    assert.throws(() => siteGenerationProvider(), /AI provider configuration is invalid/);
  } finally {
    if (before === undefined) delete process.env.AI_SITE_PROVIDER;
    else process.env.AI_SITE_PROVIDER = before;
  }
});
