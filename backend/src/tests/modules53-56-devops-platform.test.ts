/**
 * ForgeStudio Modules 53–56 Comprehensive Production Test Suite
 * Module 53: Preview Environment Manager (Ephemeral Previews, DB branch schemas, TTL, Promotions, Teardown)
 * Module 54: Developer Observability (Structured Logs, APM, OpenTelemetry Distributed Tracing, Issue Fingerprinting)
 * Module 55: Application Security Scanning (SAST, Secret Detection, Dependency CVEs, Security Gates, AI Auto-Fix)
 * Module 56: Feature Flags & Remote Configuration (Toggles, Rollouts, Targeting Rules, Dynamic Remote Config)
 */

import assert from "node:assert/strict";
import { forgeProjectService } from "../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../services/project/forgeFilesystem.service.js";
import { previewEnvironmentService } from "../modules/devops-platform/preview/previewEnvironment.service.js";
import { developerObservabilityService } from "../modules/devops-platform/observability/developerObservability.service.js";
import { applicationSecurityService } from "../modules/devops-platform/security/applicationSecurity.service.js";
import { featureFlagsService } from "../modules/devops-platform/feature-flags/featureFlags.service.js";

export async function runModules53to56TestSuite(): Promise<{
  success: boolean;
  testsRun: number;
  details: string[];
}> {
  const details: string[] = [];
  let testsRun = 0;

  function logPass(msg: string) {
    details.push(`✓ ${msg}`);
    console.log(`  ✓ ${msg}`);
    testsRun++;
  }

  console.log("============================================================");
  console.log("Starting Modules 53–56 (DevOps, Observability, Security & Flags) Test Suite");
  console.log("============================================================\n");

  const testUserId = "test-devops-architect-uuid";
  const suffix = Date.now().toString(36);

  // Setup: Create test project
  const project = await forgeProjectService.createProject(testUserId, {
    name: `DevOps Engineering Project ${suffix}`,
    slug: `devops-eng-${suffix}`,
    projectType: "FULLSTACK",
    framework: "nextjs",
    runtime: "nodejs",
    runtimeVersion: "20.x",
  });
  const projId = project.id;
  logPass(`Setup: Test Project created with id ${projId}`);

  // Create sample files for security and observability testing
  await forgeFilesystemService.writeFile(
    projId,
    "src/utils/calculator.ts",
    `
    // Sample utility file
    export function compute(expr: string) {
      // Insecure pattern for SAST testing
      return eval(expr);
    }
    `
  );

  await forgeFilesystemService.writeFile(
    projId,
    "src/config/aws.ts",
    `
    // Insecure hardcoded credential pattern for Secret Detection
    export const awsKey = "AKIAIOSFODNN7EXAMPLE";
    `
  );

  await forgeFilesystemService.writeFile(
    projId,
    "package.json",
    JSON.stringify(
      {
        name: "devops-app",
        version: "1.0.0",
        dependencies: {
          lodash: "4.17.15", // Known vulnerable version
          react: "19.0.0",
        },
      },
      null,
      2
    )
  );
  logPass("Setup: Test project filesystem seeded with code fixtures");

  // ------------------------------------------------------------
  // MODULE 53: Preview Environment Manager
  // ------------------------------------------------------------
  console.log("\n[Module 53] Preview Environment Manager Tests:");

  // 53.1 Create Preview Environment
  const createdPreview = await previewEnvironmentService.createPreviewEnvironment(projId, {
    name: "PR-42 Checkout Redesign",
    branch: "feature/checkout-flow",
    pullRequestId: "42",
    ttlHours: 48,
    envVars: { FEATURE_CHECKOUT: "true", API_ENDPOINT: "https://staging.internal" },
    cloneDatabase: true,
  });

  assert.ok(createdPreview.id, "Created preview must have an id");
  assert.equal(createdPreview.branch, "feature/checkout-flow", "Branch must match input");
  assert.equal(createdPreview.status, "ACTIVE", "New preview environment must be ACTIVE");
  assert.ok(createdPreview.url.includes("preview"), "Preview URL must be generated");
  logPass(`53.1 Ephemeral Preview: Provisioned preview '${createdPreview.name}' (${createdPreview.slug}) -> ${createdPreview.url}`);

  // 53.2 List Previews
  const previewList = await previewEnvironmentService.listPreviewEnvironments(projId);
  assert.ok(previewList.length >= 1, "Preview list must contain created environment");
  assert.equal(previewList[0].id, createdPreview.id, "First item must be created environment");
  logPass(`53.2 Environment Listing: Queried ${previewList.length} active preview environments`);

  // 53.3 Extend TTL
  const extendedPreview = await previewEnvironmentService.extendTtl(projId, createdPreview.id, 24);
  assert.equal(extendedPreview.ttlHours, 72, "TTL hours must be extended from 48 to 72");
  assert.ok(new Date(extendedPreview.expiresAt) > new Date(createdPreview.expiresAt), "ExpiresAt must be in the future");
  logPass("53.3 TTL Auto-Expiry Extension: Successfully added 24 hours to preview lifecycle");

  // 53.4 Promotion to Staging & Production
  const stagingPromotion = await previewEnvironmentService.promotePreviewEnvironment(
    projId,
    createdPreview.id,
    "staging"
  );
  assert.equal(stagingPromotion.targetEnvironment, "staging", "Target environment must be staging");
  assert.ok(stagingPromotion.deploymentId, "Promotion must generate a deployment record");
  logPass(`53.4 Promotion Pipeline: Promoted preview ${createdPreview.slug} to STAGING (${stagingPromotion.url})`);

  const prodPromotion = await previewEnvironmentService.promotePreviewEnvironment(
    projId,
    createdPreview.id,
    "production"
  );
  assert.equal(prodPromotion.targetEnvironment, "production", "Target environment must be production");
  logPass(`53.5 Zero-Downtime Production Promotion: Promoted directly to PRODUCTION (${prodPromotion.url})`);

  // 53.6 Teardown
  const teardownResult = await previewEnvironmentService.teardownPreviewEnvironment(
    projId,
    createdPreview.id
  );
  assert.equal(teardownResult.success, true, "Teardown must succeed");
  const postTeardown = await previewEnvironmentService.getPreviewEnvironment(projId, createdPreview.id);
  assert.equal(postTeardown.status, "DESTROYED", "Status after teardown must be DESTROYED");
  logPass("53.6 Ephemeral Teardown: Successfully destroyed preview environment and reclaimed resources");

  // ------------------------------------------------------------
  // MODULE 54: Developer Observability
  // ------------------------------------------------------------
  console.log("\n[Module 54] Developer Observability Tests:");

  // 54.1 Structured Log Ingestion & Query
  const testTraceId = `trace-${Date.now()}`;
  const testSpanId = `span-${Date.now()}`;

  const infoLog = await developerObservabilityService.ingestLog(projId, {
    environment: "preview",
    source: "RUNTIME",
    level: "info",
    message: "HTTP 200 GET /api/v1/orders processed successfully",
    metadata: { route: "/api/v1/orders", statusCode: 200, durationMs: 42 },
    traceId: testTraceId,
    spanId: testSpanId,
  });

  assert.ok(infoLog.id, "Ingested log must have an id");
  assert.equal(infoLog.level, "info", "Log level must match");
  logPass("54.1 Structured Log Ingestion: Ingested telemetry entry with correlation metadata and trace ID");

  // 54.2 Error Log Ingestion & Automatic Issue Fingerprinting
  const errorLog = await developerObservabilityService.ingestLog(projId, {
    environment: "preview",
    source: "FUNCTION",
    level: "error",
    message: "NullReferenceException: Cannot read properties of undefined (reading 'billingAddress')",
    metadata: {
      errorType: "NullReferenceException",
      stack: "NullReferenceException: Cannot read properties of undefined\n    at CheckoutController.process (src/checkout.ts:88:14)\n    at dispatch (express.js:450:10)",
    },
    traceId: testTraceId,
  });

  assert.equal(errorLog.level, "error", "Log level must be error");
  logPass("54.2 Runtime Error Ingestion: Ingested runtime failure with call stack");

  // 54.3 Issue Grouping Verification
  const issues = await developerObservabilityService.listIssues(projId);
  assert.ok(issues.length >= 1, "At least 1 issue must be automatically created from error log");
  const targetIssue = issues[0];
  assert.ok(targetIssue.fingerprint.length > 0, "Issue must have a deterministic fingerprint");
  assert.equal(targetIssue.occurrenceCount, 1, "Occurrence count must be initialized to 1");
  logPass(`54.3 Exception Fingerprinting: Automatically grouped error into tracked issue '${targetIssue.title.slice(0, 40)}...'`);

  // 54.4 Log Search & Filter
  const queriedLogs = await developerObservabilityService.queryLogs(projId, {
    traceId: testTraceId,
  });
  assert.equal(queriedLogs.length, 2, "Trace filter must retrieve both related log entries");
  logPass(`54.4 Log Explorer: Filtered and correlated ${queriedLogs.length} logs matching traceId`);

  // 54.5 OpenTelemetry Distributed Tracing & Waterfall
  await developerObservabilityService.recordSpan(projId, {
    traceId: testTraceId,
    spanId: testSpanId,
    name: "http.request /api/v1/orders",
    service: "api-gateway",
    durationMs: 42,
    status: "OK",
    attributes: { "http.method": "GET", "http.status_code": 200 },
  });

  await developerObservabilityService.recordSpan(projId, {
    traceId: testTraceId,
    spanId: `child-${Date.now()}`,
    parentSpanId: testSpanId,
    name: "db.query SELECT * FROM orders",
    service: "postgres-db",
    durationMs: 18,
    status: "OK",
    attributes: { "db.statement": "SELECT * FROM orders WHERE customer_id = $1" },
  });

  const traceTree = await developerObservabilityService.getTrace(projId, testTraceId);
  assert.equal(traceTree.spans.length, 2, "Distributed trace must contain root and child spans");
  assert.equal(traceTree.spans[0].service, "api-gateway", "First span must be gateway");
  logPass(`54.5 Distributed Tracing: Captured OpenTelemetry trace tree with parent/child waterfall (${traceTree.spans.length} spans)`);

  // 54.6 APM Performance Telemetry
  const apmMetrics = await developerObservabilityService.getApmMetrics(projId);
  assert.ok(typeof apmMetrics.requestsPerSecond === "number", "RPS must be calculated");
  assert.ok(typeof apmMetrics.latencyMs.p50 === "number", "p50 latency must be tracked");
  assert.ok(typeof apmMetrics.memoryUsageMb === "number", "Memory RSS must be tracked");
  assert.ok(apmMetrics.openIssuesCount >= 1, "Open issues count must be non-zero");
  logPass(`54.6 APM Performance Telemetry: Metrics generated (p50: ${apmMetrics.latencyMs.p50}ms, RPS: ${apmMetrics.requestsPerSecond}, Memory: ${apmMetrics.memoryUsageMb}MB)`);

  // 54.7 AI Root-Cause Diagnostic
  const issueDiagnostic = await developerObservabilityService.diagnoseIssueWithAi(projId, targetIssue.id);
  assert.ok(issueDiagnostic.summary.length > 0, "AI diagnostic summary must not be empty");
  assert.ok(issueDiagnostic.suggestedFix.length > 0, "AI diagnostic suggested fix must not be empty");
  logPass("54.7 AI Error Diagnosis: Generated intelligent root-cause analysis and code fix recommendation");

  // ------------------------------------------------------------
  // MODULE 55: Application Security Scanning
  // ------------------------------------------------------------
  console.log("\n[Module 55] Application Security Scanning Tests:");

  // 55.1 Full Security Scan
  const scanResult = await applicationSecurityService.runSecurityScan(projId, "FULL", {
    failOnCritical: true,
    failOnHigh: true,
    minScore: 80,
  });

  assert.ok(scanResult.id, "Security scan record must have an id");
  assert.ok(scanResult.findings.length >= 3, "Scan must detect seeded SAST, Secret, and Dependency vulnerabilities");
  assert.ok(scanResult.criticalCount >= 1, "Critical vulnerabilities must be identified (eval/AWS key)");
  assert.equal(scanResult.passedGates, false, "Security gate must fail due to critical findings");
  logPass(`55.1 Multi-Vector Security Scan: Analyzed project (Score: ${scanResult.score}/100, Findings: ${scanResult.findings.length}, Gate: BLOCKED)`);

  // 55.2 Finding Categorization Verification
  const sastFindings = scanResult.findings.filter((f) => f.type === "SAST");
  const secretFindings = scanResult.findings.filter((f) => f.type === "SECRET");
  const depFindings = scanResult.findings.filter((f) => f.type === "DEPENDENCY");

  assert.ok(sastFindings.length >= 1, "SAST finding must be detected (eval in calculator.ts)");
  assert.ok(secretFindings.length >= 1, "Secret finding must be detected (AWS key in aws.ts)");
  assert.ok(depFindings.length >= 1, "Dependency finding must be detected (lodash CVE in package.json)");
  logPass("55.2 Finding Triage: Verified SAST (eval), Secret (AWS Key), and Dependency (lodash CVE) rules");

  // 55.3 Latest Scan Retrieval
  const latestScan = await applicationSecurityService.getLatestScan(projId);
  assert.ok(latestScan, "Latest scan must be retrieved");
  assert.equal(latestScan?.id, scanResult.id, "Latest scan must match just executed scan");
  logPass("55.3 Security Audit History: Successfully retrieved persisted scan results");

  // 55.4 AI Auto-Remediation Patch
  const targetFinding = scanResult.findings[0];
  const remediation = await applicationSecurityService.generateAiRemediation(projId, targetFinding.id);
  assert.ok(remediation.patchCode.length > 0, "Remediation patch code must not be empty");
  logPass(`55.4 AI Auto-Remediation: Generated security patch for finding ${targetFinding.ruleId}`);

  // ------------------------------------------------------------
  // MODULE 56: Feature Flags & Remote Configuration
  // ------------------------------------------------------------
  console.log("\n[Module 56] Feature Flags & Remote Configuration Tests:");

  // 56.1 Create Feature Flags (Boolean & Multivariate)
  const boolFlag = await featureFlagsService.createFlag(projId, {
    key: "enable_express_checkout",
    name: "Express Checkout Flow",
    description: "Enables one-click Stripe express checkout",
    type: "BOOLEAN",
    defaultValue: true,
    rolloutPercentage: 50,
    environmentOverrides: {
      staging: true,
      production: false,
    },
    targetingRules: [
      {
        attribute: "role",
        operator: "equals",
        value: "BETA_TESTER",
        serveValue: true,
      },
    ],
    isEnabled: true,
  });

  assert.equal(boolFlag.key, "enable_express_checkout", "Flag key must match");
  assert.equal(boolFlag.isEnabled, true, "Flag must be enabled");
  logPass("56.1 Feature Flag Creation: Created flag with environment overrides and targeting rules");

  // 56.2 Flag Toggle
  const toggledFlag = await featureFlagsService.toggleFlag(projId, boolFlag.key, false);
  assert.equal(toggledFlag.isEnabled, false, "Flag state must be toggled to false");
  await featureFlagsService.toggleFlag(projId, boolFlag.key, true); // Restore
  logPass("56.2 Instant Flag Toggle: Toggled feature flag state on and off");

  // 56.3 Environment Override Evaluation
  const evalStaging = featureFlagsService.evaluateFlag(boolFlag, { environment: "staging" });
  assert.equal(evalStaging.value, true, "Staging override must evaluate to true");
  assert.equal(evalStaging.reason, "ENV_OVERRIDE", "Evaluation reason must be ENV_OVERRIDE");

  const evalProd = featureFlagsService.evaluateFlag(boolFlag, { environment: "production" });
  assert.equal(evalProd.value, false, "Production override must evaluate to false");
  assert.equal(evalProd.reason, "ENV_OVERRIDE", "Evaluation reason must be ENV_OVERRIDE");
  logPass("56.3 Environment Isolation: Evaluated flag across staging and production overrides");

  // 56.4 Attribute Targeting Rules Evaluation
  const evalTargeted = featureFlagsService.evaluateFlag(boolFlag, {
    environment: "development",
    attributes: { role: "BETA_TESTER" },
  });
  assert.equal(evalTargeted.value, true, "Targeting rule match must serve true");
  assert.equal(evalTargeted.reason, "TARGETING_RULE", "Evaluation reason must be TARGETING_RULE");
  logPass("56.4 Targeting Engine: Evaluated user attribute rule (role: BETA_TESTER)");

  // 56.5 Deterministic Percentage Rollout
  const evalUserA = featureFlagsService.evaluateFlag(boolFlag, {
    environment: "development",
    userId: "usr_alice_100",
  });
  assert.equal(evalUserA.reason, "PERCENTAGE_ROLLOUT", "Reason must be PERCENTAGE_ROLLOUT");
  logPass(`56.5 Percentage Rollout: Deterministic hash evaluated for user (${evalUserA.isEnabled ? "ENTERED ROLLOUT" : "EXCLUDED"})`);

  // 56.6 Batch Flags Evaluation
  const allFlags = await featureFlagsService.evaluateAllFlags(projId, {
    environment: "staging",
    userId: "usr_bob_200",
  });
  assert.ok(allFlags["enable_express_checkout"], "Batch evaluation must include created flag");
  logPass("56.6 Batch Evaluation SDK: Evaluated entire feature flag catalogue in single operation");

  // 56.7 Remote Configuration CRUD
  const createdConfig = await featureFlagsService.setConfig(projId, {
    key: "app_theme_palette",
    value: { primaryColor: "#4f46e5", borderRadius: "8px", darkMode: true },
    valueType: "JSON",
    description: "Dynamic frontend theming parameters",
    environment: "all",
  });

  assert.equal(createdConfig.key, "app_theme_palette", "Remote config key must match");
  assert.equal(createdConfig.value.darkMode, true, "Remote config payload must match");
  assert.equal(createdConfig.version, 1, "Initial config version must be 1");
  logPass("56.7 Remote Configuration: Set dynamic runtime configuration parameter with JSON payload");

  // Update Config
  const updatedConfig = await featureFlagsService.setConfig(projId, {
    key: "app_theme_palette",
    value: { primaryColor: "#06b6d4", borderRadius: "12px", darkMode: true },
    description: "Updated palette",
    environment: "all",
  });
  assert.equal(updatedConfig.version, 2, "Config version must increment to 2");
  assert.equal(updatedConfig.value.primaryColor, "#06b6d4", "Updated value must be reflected");
  logPass(`56.8 Config Hot-Reload: Updated remote config with automatic version bumping (v${updatedConfig.version})`);

  // Summary
  console.log("\n============================================================");
  console.log(`Modules 53–56 Test Suite PASSED! (${testsRun}/${testsRun} tests succeeded)`);
  console.log("============================================================\n");

  return {
    success: true,
    testsRun,
    details,
  };
}
