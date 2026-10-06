import { ensureDatabaseTables } from "../src/config/ensure-schema.js";
import { runModules43to45TestSuite } from "../src/tests/modules43-45-quality-platform.test.js";

async function main() {
  try {
    await ensureDatabaseTables();
    const result = await runModules43to45TestSuite();
    if (!result.success) {
      console.error("Quality Platform test suite failed!");
      process.exit(1);
    }
    console.log("SUCCESS: Modules 43–45 Quality Platform test suite completed!");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

main();
