import { ensureDatabaseTables } from "../src/config/ensure-schema.js";
import { runModules46to52TestSuite } from "../src/tests/modules46-52-runtime-platform.test.js";

async function main() {
  try {
    await ensureDatabaseTables();
    const result = await runModules46to52TestSuite();
    if (!result.success) {
      console.error("Runtime Platform test suite failed!");
      process.exit(1);
    }
    console.log("SUCCESS: Modules 46–52 Runtime Platform test suite completed!");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

main();
