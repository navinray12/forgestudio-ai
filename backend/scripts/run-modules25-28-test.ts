import { ensureDatabaseTables } from "../src/config/ensure-schema.js";
import { runModules25to28TestSuite } from "../src/tests/modules25-28-data-platform.test.js";

async function main() {
  try {
    await ensureDatabaseTables();
    const result = await runModules25to28TestSuite();
    if (!result.success) {
      console.error("Data Platform test suite failed!");
      process.exit(1);
    }
    console.log("SUCCESS: Modules 25–28 Data Platform test suite completed!");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

main();
