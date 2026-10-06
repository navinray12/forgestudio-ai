import { ensureDatabaseTables } from "../src/config/ensure-schema.js";
import { runModules53to56TestSuite } from "../src/tests/modules53-56-devops-platform.test.js";

async function main() {
  try {
    await ensureDatabaseTables();
    const result = await runModules53to56TestSuite();
    if (!result.success) {
      console.error("DevOps Platform test suite failed!");
      process.exit(1);
    }
    console.log("SUCCESS: Modules 53–56 DevOps, Observability, Security & Flags test suite completed!");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

main();
