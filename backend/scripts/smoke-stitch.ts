/// <reference types="node" />
import "dotenv/config";
import { PrivateStitchClient } from "../src/modules/ai/design/stitch-client.js";
import { StitchDesignProvider } from "../src/modules/ai/design/stitch-provider.js";

async function main() {
  console.log("=== STITCH PROVIDER SMOKE TEST ===");

  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) {
    console.error("FAIL: STITCH_API_KEY is not set in environment.");
    process.exit(1);
  }
  console.log("STITCH_API_KEY is present (length:", apiKey.length, ")");

  const client = new PrivateStitchClient(apiKey);

  try {
    // Step 1: Connect
    console.log("\n[Step 1] Connecting to Stitch MCP endpoint...");
    await client.connect();
    console.log("✓ Connected to Stitch MCP.");

    // Step 2 & 3: List Tools & inspect generate_screen_from_text
    console.log("\n[Step 2 & 3] Listing tools & discovering capabilities...");
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t: { name: string }) => t.name);
    console.log("Available tools:", toolNames.join(", "));

    const genTool = toolsResult.tools.find((t: { name: string }) => t.name === "generate_screen_from_text");
    if (!genTool) {
      throw new Error("generate_screen_from_text tool not found in tool list!");
    }

    const schema = genTool.inputSchema as {
      properties?: Record<string, { type?: string; enum?: string[]; description?: string }>;
      required?: string[];
    } | undefined;

    const properties = schema?.properties || {};
    const required = Array.isArray(schema?.required) ? schema.required : [];
    const modelIdEnum = properties.modelId?.enum;
    const deviceTypeEnum = properties.deviceType?.enum;
    const optionalFields = Object.keys(properties).filter(k => !required.includes(k));

    console.log("\n[STITCH CAPABILITIES]");
    console.log("Tool: generate_screen_from_text");
    console.log("modelId enum =", JSON.stringify(modelIdEnum || []));
    console.log("deviceType enum =", JSON.stringify(deviceTypeEnum || []));
    console.log("required fields =", JSON.stringify(required));
    console.log("optional fields =", JSON.stringify(optionalFields));

    // Step 4: Create Project using StitchDesignProvider
    const configuredModel = process.env.AI_STITCH_MODEL || "MODEL_ID_UNSPECIFIED";
    console.log("\n[Step 4] Creating project with model config:", configuredModel);
    const provider = new StitchDesignProvider(configuredModel);

    const projectId = await provider.createProject("Smoke Test SaaS Landing Page");
    console.log("✓ Project created successfully. Normalized ID:", projectId);

    // Step 5 & 6: Generate screen
    console.log("\n[Step 5 & 6] Generating screen from text prompt...");
    const prompt = "Create a simple responsive SaaS landing page with a header, hero section, three feature cards, and footer. Use a clean professional visual design.";
    const genResult = await provider.generate(projectId, prompt);
    console.log("✓ Screen generated successfully. Screen ID:", genResult.screenId);

    // Step 7 & 8: Retrieve screen HTML
    console.log("\n[Step 7 & 8] Retrieving screen HTML export...");
    const html = await provider.html(projectId, genResult.screenId);
    console.log("✓ HTML export retrieved. Bytes:", Buffer.byteLength(html, "utf8"));
    console.log("HTML preview (first 200 chars):", html.slice(0, 200).replace(/\s+/g, " "));

    await provider.close();
    await client.close();

    console.log("\n==================================================");
    console.log("=== STITCH SMOKE TEST COMPLETED SUCCESSFULLY ===");
    console.log("==================================================");
  } catch (error: any) {
    console.error("\n✗ STITCH SMOKE TEST FAILED!");
    console.error("Error Code:", error?.code || "UNKNOWN");
    console.error("Error Message:", error?.message || String(error));
    if (error?.stack) {
      console.error("Stack:", error.stack);
    }
    await client.close().catch(() => {});
    process.exit(1);
  }
}

main();
