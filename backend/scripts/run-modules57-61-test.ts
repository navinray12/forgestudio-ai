import { ensureDatabaseTables } from "../src/config/ensure-schema.js";
import { runModules57to61TestSuite } from "../src/tests/modules57-61-developer-platform.test.js";

async function main() {
  try {
    await ensureDatabaseTables();
    const result = await runModules57to61TestSuite();
    if (!result.success) {
      console.error("Developer Platform Modules 57–61 test suite failed!");
      process.exit(1);
    }
    console.log("SUCCESS: Modules 57–61 (Collaboration, Extensions, Import, Monorepo, Containers) test suite completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

main();
