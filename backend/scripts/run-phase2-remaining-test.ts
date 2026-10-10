import { ensureDatabaseTables } from "../src/config/ensure-schema.js";
import { runPhase2RemainingMasterTestSuite } from "../src/tests/phase2-remaining-master.test.js";
import { pgPool, prisma } from "../src/config/prisma.js";

async function main() {
  console.log("Preparing environment and verifying self-healing database schema...");
  await ensureDatabaseTables();

  const results = await runPhase2RemainingMasterTestSuite();

  console.log(`Test Execution Summary:`);
  console.log(`- Success: ${results.success}`);
  console.log(`- Tests Passed: ${results.testsRun}`);

  await prisma.$disconnect().catch(() => undefined);
  await pgPool.end().catch(() => undefined);

  if (!results.success) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution encountered an unhandled error:", err);
  process.exit(1);
});
