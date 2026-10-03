import fs from "node:fs";
import path from "node:path";
import { runApiTestSuite } from "./api/part-b-api.test.js";
import { runDatabaseTestSuite } from "./database/part-b-db.test.js";
import { runWordPressE2ESuite } from "./wordpress/part-b-wp-e2e.test.js";
import { runSecurityTestSuite } from "./security/part-b-security.test.js";
import { runPerformanceTestSuite } from "./performance/part-b-performance.test.js";
import { runRecoveryTestSuite } from "./recovery/part-b-recovery.test.js";
import { featureEvidence, summarizeSuites } from "./reporting/evidence.mjs";

async function runMasterRegression() {
  const started = Date.now();
  const registry = JSON.parse(fs.readFileSync("tests/feature-registry/part-b-modules-25-31.json", "utf8"));
  const suites = {
    api: await runApiTestSuite(), database: await runDatabaseTestSuite(),
    wordpress: await runWordPressE2ESuite(), security: await runSecurityTestSuite(),
    recovery: await runRecoveryTestSuite(),
  };
  const performance = await runPerformanceTestSuite();
  const summaries = summarizeSuites(suites);
  // No feature-level mapping has been proved by these coarse legacy probes.
  // Never infer UI, publishing, recovery or isolation verification from a tag.
  const features = featureEvidence(registry);
  const failed = summaries.reduce((sum, suite) => sum + suite.failed, 0) + (performance.passed ? 0 : 1);
  const passed = summaries.reduce((sum, suite) => sum + suite.passed, 0);
  const report = {commit: process.env.GITHUB_SHA ?? null, at: new Date().toISOString(), durationMs: Date.now()-started,
    scope: "Legacy API/database/WordPress smoke probes; not full feature certification",
    suites, performance, features, passed, failed, productionQualified: false};
  const directory = "tests/reports"; fs.mkdirSync(directory, {recursive:true});
  fs.writeFileSync(path.join(directory,"part-b-regression-matrix.json"), JSON.stringify(features,null,2));
  fs.writeFileSync(path.join(directory,"part-b-regression-results.json"), JSON.stringify(report,null,2));
  const markdown = ["# Forge Part B executed smoke evidence", "",
    `Commit: ${report.commit ?? "local/unbound"}`, `Executed checks: ${passed} passed, ${failed} failed.`,
    "", "| Suite | Checks | Passed | Failed |", "|---|---:|---:|---:|",
    ...summaries.map((suite) => `| ${suite.name} | ${suite.checks} | ${suite.passed} | ${suite.failed} |`), "",
    `${features.filter((feature) => feature.result === "NOT_VERIFIED").length} catalogue features have no complete operation-level evidence.`,
    "Browser rendering, authenticated publishing, reference-load capacity and disaster recovery remain NOT_VERIFIED.",
    "The performance smoke measures real health HTTP requests only, not editor or production capacity.", ""] .join("\n");
  fs.writeFileSync(path.join(directory,"part-b-regression-report.md"),markdown);
  fs.writeFileSync(path.join(directory,"part-b-regression-summary.md"),`${passed} executed checks passed; ${failed} failed. Full feature qualification: NOT_VERIFIED.\n`);
  console.log(markdown);
  if (failed || summaries.some((suite) => suite.status !== "PASS")) process.exitCode=1;
}
runMasterRegression().catch((error) => {console.error("Regression runner failed",error);process.exitCode=1;});
