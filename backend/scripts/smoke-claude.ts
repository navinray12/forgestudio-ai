/// <reference types="node" />
import "dotenv/config";
import { ClaudeDesignPlanner } from "../src/modules/ai/design/claude-planner.js";

async function main() {
  console.log("=== CLAUDE PLANNER SMOKE TEST ===");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("FAIL: ANTHROPIC_API_KEY is not set in environment.");
    process.exit(1);
  }
  console.log("ANTHROPIC_API_KEY is present (length:", apiKey.length, ")");

  const model = process.env.AI_CLAUDE_DESIGN_MODEL || "claude-3-5-sonnet-20241022";
  console.log("Using model:", model);

  const planner = new ClaudeDesignPlanner(model);
  const brief = "Design a premium accounting training academy website with Home, Programs, About and Contact pages. Use editorial typography, warm ivory, deep green and restrained coral, generous whitespace and varied layouts.";

  try {
    console.log("\nDispatching Claude plan request...");
    const plan = await planner.plan(brief);
    console.log("✓ Claude Plan created successfully!");
    console.log("Design direction:", plan.design.slice(0, 150) + "...");
    console.log("Generated pages count:", plan.pages.length);
    plan.pages.forEach((p, i) => {
      console.log(`  Page ${i + 1}: ${p.name} (${p.slug}) - Brief length: ${p.brief.length}`);
    });
    console.log("Setup required:", plan.setupRequired);
    console.log("\n=== CLAUDE SMOKE TEST COMPLETED SUCCESSFULLY ===");
  } catch (error: any) {
    console.error("\n✗ CLAUDE SMOKE TEST FAILED!");
    console.error("Code:", error?.code || "UNKNOWN");
    console.error("Message:", error?.message || String(error));
    if (error?.stack) console.error("Stack:", error.stack);
    process.exit(1);
  }
}

main();
