import { ensureDatabaseTables } from "../src/config/ensure-schema.js";
import { runModules35to36TestSuite } from "../src/tests/modules35-36-code-intelligence.test.js";

async function main() {
  try {
    await ensureDatabaseTables();
    const result = await runModules35to36TestSuite();
    if (!result.success) {
      console.error("Code Intelligence & Knowledge Graph Modules 35–36 test suite failed!");
      process.exit(1);
    }
    console.log("SUCCESS: Modules 35–36 (Code Intelligence & Knowledge Graph) test suite completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

main();
