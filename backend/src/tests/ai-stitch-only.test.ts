import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { designConfig, designAvailability, designConfigSchema } from "../modules/ai/design/config.js";
import { StitchOnlyPlanner } from "../modules/ai/design/stitch-planner.js";
import { sitePlanSchema } from "../modules/ai/design/contracts.js";
import { PrivateStitchClient } from "../modules/ai/design/stitch-client.js";
import { StitchDesignProvider } from "../modules/ai/design/stitch-provider.js";
import { ConversionError, HtmlDesignConverter } from "../modules/ai/design/converter.js";
import { AppError } from "../utils/app-error.js";

test("Stitch-only availability requires no Claude key and advertises generation only", t => {
  const keys = ["AI_DESIGN_PROVIDER", "STITCH_API_KEY", "ANTHROPIC_API_KEY", "AI_PROMPT_ENCRYPTION_KEY", "AI_STITCH_MODEL"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  Object.assign(process.env, { AI_DESIGN_PROVIDER: "stitch", STITCH_API_KEY: "fixture", AI_PROMPT_ENCRYPTION_KEY: randomBytes(32).toString("base64"), AI_STITCH_MODEL: "GEMINI_3_5_FLASH_LITE" });
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(designConfig().provider, "stitch");
  const available = designAvailability();
  assert.equal(available.available, true);
  assert.deepEqual("operations" in available && available.operations, ["GENERATE_SITE"]);
  assert.equal(designConfigSchema.parse({ claudeModel: "legacy", stitchModel: "GEMINI_3_PRO", maxPages: 1, dailyUnits: 100 }).provider, "stitch-claude");
});

test("local single-page plan preserves full brief and rejects unsupported AI editing", async () => {
  const planner = new StitchOnlyPlanner();
  for (const brief of ["Build my CRM", "A".repeat(64000)]) {
    const plan = sitePlanSchema.parse(await planner.plan(brief));
    assert.equal(plan.pages.length, 1);
    assert.ok(plan.pages[0]!.brief.includes(brief));
  }
  await assert.rejects(planner.edit(), { code: "AI_UNSUPPORTED_OPERATION" });
});

test("metadata JSON cannot be presented as a generated editable design", async () => {
  await assert.rejects(new HtmlDesignConverter().convert('{"components":["header","footer","section"]}', "fixture"), error => {
    assert.ok(error instanceof ConversionError);
    assert.ok(error instanceof AppError);
    assert.deepEqual(error.issues, ["HTML_PAGE_REQUIRED"]);
    return true;
  });
});

test("inline Stitch HTML does not compile copy into unused Tailwind transition rules", async () => {
  const nodes = await new HtmlDesignConverter().convert('<main style="-webkit-font-smoothing:antialiased"><h1>Transition your CRM</h1><p>Organize customer relationships.</p></main>', "fixture");
  assert.ok(JSON.stringify(nodes).includes("Transition your CRM"));
});

test("Stitch border side longhands remain editable CSS", async () => {
  const nodes = await new HtmlDesignConverter().convert('<main style="border-left-width:4px;border-left-style:solid;border-left-color:#2563eb"><h1>Customer pipeline</h1></main>', "fixture");
  const serialized = JSON.stringify(nodes);
  assert.ok(serialized.includes('"borderLeftWidth":"4px"'));
  assert.ok(serialized.includes('"borderLeftColor":"#2563eb"'));
});

test("screen exports use the current name-only request and reject metadata responses", async t => {
  const previous = process.env.STITCH_API_KEY;
  process.env.STITCH_API_KEY = "fixture";
  t.after(() => { if (previous === undefined) delete process.env.STITCH_API_KEY; else process.env.STITCH_API_KEY = previous; });
  t.mock.method(PrivateStitchClient.prototype, "callTool", async (name: string, args: unknown) => {
    assert.equal(name, "get_screen");
    assert.deepEqual(args, { name: "projects/project-1/screens/screen-1" });
    return { htmlCode: { downloadUrl: "https://contribution.usercontent.google.com/download" } };
  });
  let body = '<main><h1>CRM overview</h1></main>';
  t.mock.method(globalThis, "fetch", async () => new Response(body));
  const provider = new StitchDesignProvider("GEMINI_3_8_FLASH");
  assert.equal(await provider.html("project-1", "screen-1"), body);
  body = '{"components":["header"]}';
  await assert.rejects(provider.html("project-1", "screen-1"), { code: "AI_INVALID_OUTPUT" });
  await provider.close();
});

test("Stitch adapter uses live model schema and rejects obsolete models before generation", async t => {
  const previous = process.env.STITCH_API_KEY;
  process.env.STITCH_API_KEY = "fixture";
  t.after(() => { if (previous === undefined) delete process.env.STITCH_API_KEY; else process.env.STITCH_API_KEY = previous; });
  t.mock.method(PrivateStitchClient.prototype, "listTools", async () => ({ tools: [{ name: "generate_screen_from_text", inputSchema: { properties: { modelId: { enum: ["GEMINI_3_5_FLASH_LITE"] } } } }] }));
  const calls: string[] = [];
  t.mock.method(PrivateStitchClient.prototype, "callTool", async (name: string) => { calls.push(name); return { outputComponents: [{ design: { screens: [{ name: "projects/fixture/screens/screen-1" }] } }] }; });
  const current = new StitchDesignProvider("GEMINI_3_5_FLASH_LITE");
  assert.deepEqual(await current.generate("fixture", "Create a CRM overview"), { screenId: "screen-1" });
  await current.close();
  const obsolete = new StitchDesignProvider("GEMINI_3_PRO");
  await assert.rejects(obsolete.generate("fixture", "Create a CRM overview"), { code: "AI_BAD_REQUEST" });
  assert.deepEqual(calls, ["generate_screen_from_text"]);
  await obsolete.close();
});

test("structured list rows preserve child typography and flex layout", async () => {
  const nodes = await new HtmlDesignConverter().convert('<ul><li style="display:flex;justify-content:space-between"><span style="font-weight:600">Contact Registry</span><span style="color:#64748b">Stakeholder associations</span></li></ul>', "fixture");
  const row = (nodes[0]!.children as any[])[0].children[0];
  assert.equal(row.type, "container");
  assert.equal(row.children.length, 2);
  assert.equal(row.children[0].styles.fontWeight, "600");
  assert.equal(row.layout.justifyContent, "space-between");
});
