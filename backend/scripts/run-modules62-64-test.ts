import { ensureDatabaseTables } from "../src/config/ensure-schema.js";
import { runModules62to64TestSuite } from "../src/tests/modules62-64-intelligence-platform.test.js";

async function main() {
  try {
    await ensureDatabaseTables();
    const result = await runModules62to64TestSuite();
    if (!result.success) {
      console.error("Intelligence Platform test suite failed!");
      process.exit(1);
    }
    console.log("SUCCESS: Modules 62–64 Optimization Engine, Checkpoint/Recovery & Architecture Visualization test suite completed!");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

main();
