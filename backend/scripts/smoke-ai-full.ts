/// <reference types="node" />
import "dotenv/config";
import { ClaudeDesignPlanner } from "../src/modules/ai/design/claude-planner.js";
import { StitchDesignProvider } from "../src/modules/ai/design/stitch-provider.js";
import { DESIGN_CONTRACT, type SitePlan } from "../src/modules/ai/design/contracts.js";

async function main() {
  console.log("==================================================");
  console.log("=== INTEGRATED CLAUDE + STITCH PIPELINE TEST ===");
  console.log("==================================================");

  // 1. Validate environment
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const stitchKey = process.env.STITCH_API_KEY;

  if (!anthropicKey) {
    console.error("FAIL: ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }
  if (!stitchKey) {
    console.error("FAIL: STITCH_API_KEY is not set.");
    process.exit(1);
  }
  console.log("✓ Credentials verified (keys present without exposure)");

  const claudeModel = process.env.AI_CLAUDE_DESIGN_MODEL || "claude-3-5-sonnet-20241022";
  const stitchModel = process.env.AI_STITCH_MODEL || "MODEL_ID_UNSPECIFIED";
  console.log(`Configured models: Claude = ${claudeModel}, Stitch = ${stitchModel}`);

  // 2. Test Claude Planner
  console.log("\n[Phase 1] Claude Planner: Generating site plan...");
  const planner = new ClaudeDesignPlanner(claudeModel);
  const brief = "Design a premium accounting training academy website with Home, Programs, About and Contact pages. Use editorial typography, warm ivory, deep green and restrained coral, generous whitespace and varied layouts. Include CMA, CPA and ACCA program introductions and clear navigation between real pages. Use expressive CSS shapes and gradients rather than external images. Do not invent testimonials, prices or statistics. Make the layout work from 320px mobile to desktop.";

  const startTime = Date.now();
  let plan: SitePlan | null = null;
  try {
    plan = await planner.plan(brief);
    console.log(`✓ Plan generated in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`  Design: ${plan.design.slice(0, 120)}...`);
    console.log(`  Pages (${plan.pages.length}):`, plan.pages.map(p => `${p.name} [${p.slug}]`).join(", "));
  } catch (err: any) {
    console.error("✗ Phase 1 (Claude Planner) FAILED:", err?.code || "", err?.message || err);
    process.exit(1);
  }

  if (!plan) return;

  // 3. Test Stitch Provider
  console.log("\n[Phase 2] Stitch Provider: Initializing...");
  const designer = new StitchDesignProvider(stitchModel);

  let projectId = "";
  try {
    console.log("\n[Phase 2A] Creating project in Stitch...");
    projectId = await designer.createProject("Forge Pipeline Test");
    console.log(`✓ Project created: id=${projectId}`);
  } catch (err: any) {
    console.error("✗ Phase 2A (Create Project) FAILED:", err?.code || "", err?.message || err);
    await designer.close().catch(() => {});
    process.exit(1);
  }

  const firstPage = plan.pages[0]!;
  let screenId = "";
  try {
    console.log(`\n[Phase 2B] Generating screen for page: ${firstPage.name} (${firstPage.slug})...`);
    const prompt = `${DESIGN_CONTRACT}\nShared design: ${plan.design}\nSite routes: ${JSON.stringify(plan.pages.map(item => ({ name: item.name, slug: item.slug })))}\nPage: ${firstPage.name}\n${firstPage.brief}`;
    const screenRes = await designer.generate(projectId, prompt);
    screenId = screenRes.screenId;
    console.log(`✓ Screen generated: screenId=${screenId}`);
  } catch (err: any) {
    console.error("✗ Phase 2B (Generate Screen) FAILED:", err?.code || "", err?.message || err);
    await designer.close().catch(() => {});
    process.exit(1);
  }

  let html = "";
  try {
    console.log("\n[Phase 2C] Fetching HTML export...");
    html = await designer.html(projectId, screenId);
    console.log(`✓ HTML export retrieved: ${Buffer.byteLength(html, "utf8")} bytes`);
    console.log("  Contains html/body:", /<html/i.test(html) && /<body/i.test(html));
  } catch (err: any) {
    console.error("✗ Phase 2C (HTML Export) FAILED:", err?.code || "", err?.message || err);
    await designer.close().catch(() => {});
    process.exit(1);
  }

  await designer.close().catch(() => {});

  // 4. Test HTML Conversion
  try {
    console.log("\n[Phase 3] Converting HTML to Forge native document elements...");
    const { IsolatedDesignConverter } = await import("../src/modules/ai/design/isolated-converter.js");
    const converter = new IsolatedDesignConverter();
    const elements = await converter.convert(html, "smoke-test:0");
    console.log(`✓ HTML converted successfully into ${elements.length} root elements`);
    console.log(`  Root element type: ${elements[0]?.type}`);
    const children = (elements[0] as any)?.children;
    console.log(`  Root element children count: ${Array.isArray(children) ? children.length : 0}`);
  } catch (err: any) {
    console.error("✗ Phase 3 (HTML Conversion) FAILED:", err?.issues || err?.message || err);
    process.exit(1);
  }

  console.log("\n==================================================");
  console.log("✓ ALL PIPELINE COMPONENTS VERIFIED END-TO-END");
  console.log("==================================================");
}

main();
