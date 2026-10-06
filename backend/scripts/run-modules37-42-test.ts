import { ensureDatabaseTables } from "../src/config/ensure-schema.js";
import { runModules37to42TestSuite } from "../src/tests/modules37-42-ai-platform.test.js";

async function main() {
  try {
    await ensureDatabaseTables();
    const result = await runModules37to42TestSuite();
    if (!result.success) {
      console.error("Test suite failed!");
      process.exit(1);
    }
    console.log("SUCCESS: All tests completed!");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

main();
