import { strict as assert } from "node:assert";
import { test } from "node:test";
import { canonicalSiteFromBlueprint, SITE_BLUEPRINT_JSON_SCHEMA } from "../modules/ai/site-blueprint.js";
import { OpenAiProvider } from "../modules/ai/openai.provider.js";
import { AnthropicProvider } from "../modules/ai/anthropic.provider.js";
import { GeminiProvider } from "../modules/ai/gemini.provider.js";
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
  assert.equal(pages[0]?.elements[0]?.type, "container");
  assert.deepEqual(pages[0]?.elements[1]?.children.map(child => child.type), ["text", "heading", "text", "button"]);
  assert.equal(pages[0]?.elements.at(-1)?.type, "container");
  assert.equal((draft.editorData.pages as Array<{ pageSettings: { backgroundColor: string } }>)[0]?.pageSettings.backgroundColor, "#f7f4ed");
  assert.equal(draft.editorData.homePageId, (draft.editorData.pages as Array<{ id: string }>)[0]?.id);
});

test("blueprint rejects unsupported fields, duplicate pages, unsafe links and oversized output", () => {
  assert.throws(() => canonicalSiteFromBlueprint({ pages: [{ ...blueprint.pages[0], html: "<script>" }] }), /invalid website draft/);
  assert.throws(() => canonicalSiteFromBlueprint({ pages: [blueprint.pages[0], blueprint.pages[0]] }), /invalid website draft/);
  assert.throws(() => canonicalSiteFromBlueprint({ pages: [{ ...blueprint.pages[0], sections: [{ ...blueprint.pages[0].sections[0], ctaHref: "https://evil.example" }] }] }), /invalid website draft/);
  assert.throws(() => canonicalSiteFromBlueprint({ pages: Array(9).fill(blueprint.pages[0]) }), /invalid website draft/);
});

test("blueprint normalizes safe model paths and discards CTAs without targets", () => {
  const normalized = canonicalSiteFromBlueprint({ pages: [
    { name: "Home", slug: "home", sections: [{ heading: "Welcome", body: "A useful introduction", ctaLabel: "Learn more", ctaHref: "about" }] },
    { name: "About", slug: "About Us", sections: [{ heading: "About us", body: "Our story", ctaLabel: "Contact", ctaHref: "" }] },
  ] });
  const pages = normalized.editorData.pages as Array<{ slug: string; elements: Array<{ children: Array<{ type: string; href?: string }> }> }>;
  assert.equal(pages[0]?.slug, "/");
  assert.equal(pages[1]?.slug, "/about-us");
  assert.equal(pages[0]?.elements[1]?.children.at(-1)?.href, "/about");
  assert.equal(pages[1]?.elements[1]?.children.some(child => child.type === "button"), false);
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

test("Gemini adapter sends server-only key and structured blueprint schema", async () => {
  let sentUrl = "";
  let sentHeaders: Headers;
  let sentBody: Record<string, unknown> | undefined;
  const fakeFetch = async (url: string | URL | Request, options?: RequestInit) => {
    sentUrl = String(url);
    sentHeaders = new Headers(options?.headers);
    sentBody = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({ responseId: "gemini_test", candidates: [
      { finishReason: "STOP", content: { parts: [{ text: JSON.stringify(blueprint) }] } },
    ] }), { status: 200 });
  };
  const result = await new GeminiProvider("secret-gemini-key", "gemini-3.8-flash", fakeFetch as typeof fetch).generate(request);
  assert.equal(result.provider, "gemini");
  assert.equal(result.requestId, "gemini_test");
  assert.deepEqual(JSON.parse(result.text), blueprint);
  assert.equal(sentHeaders!.get("x-goog-api-key"), "secret-gemini-key");
  assert.equal(sentUrl.includes("secret-gemini-key"), false);
  assert.equal(JSON.stringify(sentBody).includes("secret-gemini-key"), false);
  assert.equal((sentBody?.generationConfig as { responseMimeType: string }).responseMimeType, "application/json");
  assert.deepEqual((sentBody?.generationConfig as { responseJsonSchema: unknown }).responseJsonSchema,
    SITE_BLUEPRINT_JSON_SCHEMA);
});

test("Gemini adapter rejects blocked, truncated, malformed and failed responses safely", async () => {
  const cases = [
    new Response(JSON.stringify({ error: { message: "secret provider error" } }), { status: 429 }),
    new Response(JSON.stringify({ candidates: [{ finishReason: "SAFETY", content: { parts: [{ text: "{}" }] } }] }), { status: 200 }),
    new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{}" }] } }] }), { status: 200 }),
    new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
    new Response("not json", { status: 200 }),
  ];
  for (const response of cases) {
    const fakeFetch = async () => response;
    await assert.rejects(new GeminiProvider("secret-gemini-key", "gemini-3.8-flash", fakeFetch as typeof fetch).generate(request), error => {
      assert.equal(JSON.stringify(error).includes("secret provider error"), false);
      assert.equal((error as { code: string }).code, response.status === 429 ? "AI_PROVIDER_UNAVAILABLE" : "AI_INVALID_OUTPUT");
      return true;
    });
  }
  const timedOut = async () => { throw new Error("secret provider error"); };
  await assert.rejects(new GeminiProvider("secret-gemini-key", "gemini-3.8-flash", timedOut as typeof fetch).generate(request),
    error => (error as { code: string }).code === "AI_PROVIDER_UNAVAILABLE" && !JSON.stringify(error).includes("secret provider error"));
  await assert.rejects(new GeminiProvider("", "gemini-3.8-flash").generate(request),
    error => (error as { code: string }).code === "AI_NOT_CONFIGURED");
  await assert.rejects(new GeminiProvider("secret-gemini-key", "../invalid").generate(request),
    error => (error as { code: string }).code === "AI_NOT_CONFIGURED");
});

test("OpenAI route uses Gemini only when OpenAI key is absent", () => {
  const previous = { provider: process.env.AI_SITE_PROVIDER, openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY, model: process.env.AI_MODEL_PLANNER, geminiModel: process.env.AI_MODEL_GEMINI };
  try {
    process.env.AI_SITE_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.AI_MODEL_PLANNER = "gpt-5";
    process.env.AI_MODEL_GEMINI = "gemini-3.8-flash";
    assert.equal(siteGenerationProvider().name, "gemini");
    assert.equal(siteGenerationProvider().model, "gemini-3.8-flash");
    process.env.OPENAI_API_KEY = "openai-key";
    assert.equal(siteGenerationProvider().name, "openai");
    process.env.AI_SITE_PROVIDER = "gemini";
    assert.equal(siteGenerationProvider().name, "gemini");
  } finally {
    for (const [key, value] of Object.entries({ AI_SITE_PROVIDER: previous.provider,
      OPENAI_API_KEY: previous.openai, GEMINI_API_KEY: previous.gemini,
      AI_MODEL_PLANNER: previous.model, AI_MODEL_GEMINI: previous.geminiModel })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
