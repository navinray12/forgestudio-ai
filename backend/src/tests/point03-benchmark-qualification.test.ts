import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPETITOR_EVIDENCE_REGISTRY,
  getCompetitorEvidenceByRef,
  getCompetitorEvidenceSummary,
} from "../services/benchmark/competitorEvidence.js";
import {
  BENCHMARK_TASKS,
  getBenchmarkTaskById,
  getHardFailureTriggerTasks,
} from "../services/benchmark/benchmarkTasks.js";
import {
  SYNTHETIC_BUSINESS_BRIEFS,
  getSyntheticBusinessBriefById,
  listSyntheticBusinessBriefs,
} from "../services/benchmark/benchmarkBriefs.js";
import {
  BENCHMARK_PROTOCOL_VERSION,
  computeBenchmarkRunReport,
  validateBenchmarkRunConfig,
  BenchmarkRunConfig,
  TaskMeasurementResult,
} from "../services/benchmark/benchmarkProtocol.js";
import { benchmarkService } from "../services/benchmark/benchmark.service.js";

test("Point 03: Market Reality and Benchmark to Win Qualification Suite", async (t) => {
  await t.test("1. Competitor Evidence Registry covers [R1]-[R8] with explicit conflict preservation", async () => {
    assert.equal(COMPETITOR_EVIDENCE_REGISTRY.length, 8, "Must contain exactly 8 reference citations [R1]-[R8]");

    const refIds = COMPETITOR_EVIDENCE_REGISTRY.map((r) => r.referenceId);
    for (const expectedRef of ["[R1]", "[R2]", "[R3]", "[R4]", "[R5]", "[R6]", "[R7]", "[R8]"]) {
      assert.ok(refIds.includes(expectedRef as any), `Must include reference citation ${expectedRef}`);
    }

    // Verify Wix [R1]
    const wixRef = getCompetitorEvidenceByRef("[R1]");
    assert.ok(wixRef);
    assert.equal(wixRef.vendor, "Wix / Wix Studio");
    assert.ok(wixRef.documentedCapabilities.some((c) => c.includes("CMS Presets")));
    assert.equal(wixRef.category, "RESTRICTED_VENDOR");

    // Verify Webflow standard export [R2] vs DevLink [R3]
    const webflowExport = getCompetitorEvidenceByRef("[R2]");
    assert.ok(webflowExport);
    assert.ok(
      webflowExport.documentedRestrictions.some((r) => r.includes("excludes Webflow CMS collections")),
      "Webflow standard export must document CMS exclusion"
    );

    const webflowDevlink = getCompetitorEvidenceByRef("[R3]");
    assert.ok(webflowDevlink);
    assert.ok(webflowDevlink.documentedCapabilities.some((c) => c.includes("DevLink")));

    // Verify Framer conflict preservation [R6] vs [R7]
    const framerAssets = getCompetitorEvidenceByRef("[R6]");
    const framerHtml = getCompetitorEvidenceByRef("[R7]");
    assert.ok(framerAssets);
    assert.ok(framerHtml);
    assert.equal(framerAssets.category, "UNRESOLVED_CONFLICT", "Framer [R6] must be preserved as UNRESOLVED_CONFLICT");
    assert.equal(framerHtml.category, "UNRESOLVED_CONFLICT", "Framer [R7] must be preserved as UNRESOLVED_CONFLICT");
    assert.ok(framerAssets.unresolvedNotes?.includes("Conflict persists"));

    // Verify summary counts
    const summary = getCompetitorEvidenceSummary();
    assert.equal(summary.totalReferences, 8);
    assert.equal(summary.hasUnresolvedConflicts, true);
    assert.deepEqual(summary.unresolvedReferenceIds, ["[R6]", "[R7]"]);
  });

  await t.test("2. Benchmark Task Registry defines all 10 required tasks with hard-failure rules", async () => {
    assert.equal(BENCHMARK_TASKS.length, 10, "Must contain all 10 required benchmark tasks");

    const expectedTaskIds = [
      "TASK-01-CREATE-WEBSITE",
      "TASK-02-MOBILE-A11Y",
      "TASK-03-PUBLISH-ARTICLE",
      "TASK-04-SCHEMA-EVOLUTION",
      "TASK-05-STATEFUL-COMPONENT",
      "TASK-06-CRM-OUTAGE-LEAD",
      "TASK-07-INTERRUPTED-EDIT-RECOVERY",
      "TASK-08-REJECT-DANGEROUS-RELEASE",
      "TASK-09-PORTABLE-HOSTING-PUBLISH",
      "TASK-10-OPERATOR-ACCOUNT-RECOVERY",
    ];

    for (let i = 0; i < 10; i++) {
      const task = BENCHMARK_TASKS[i];
      assert.equal(task.id, expectedTaskIds[i]);
      assert.equal(task.taskNumber, i + 1);
      assert.ok(task.preconditions.length > 0, `Task ${task.id} must define preconditions`);
      assert.ok(task.executionSteps.length > 0, `Task ${task.id} must define execution steps`);
      assert.ok(task.passCriteria.length > 0, `Task ${task.id} must define pass criteria`);
      assert.ok(task.failCriteria.length > 0, `Task ${task.id} must define fail criteria`);
      assert.ok(task.cleanupInstructions, `Task ${task.id} must define cleanup instructions`);
    }

    // Verify Hard-Failure Trigger tasks
    const hardFailureTasks = getHardFailureTriggerTasks();
    const hardTaskIds = hardFailureTasks.map((t) => t.id);
    assert.ok(hardTaskIds.includes("TASK-04-SCHEMA-EVOLUTION"), "TASK-04 must be hard-failure trigger");
    assert.ok(hardTaskIds.includes("TASK-05-STATEFUL-COMPONENT"), "TASK-05 must be hard-failure trigger");
    assert.ok(hardTaskIds.includes("TASK-06-CRM-OUTAGE-LEAD"), "TASK-06 must be hard-failure trigger");
    assert.ok(hardTaskIds.includes("TASK-08-REJECT-DANGEROUS-RELEASE"), "TASK-08 must be hard-failure trigger");
    assert.ok(hardTaskIds.includes("TASK-10-OPERATOR-ACCOUNT-RECOVERY"), "TASK-10 must be hard-failure trigger");
  });

  await t.test("3. Synthetic Business Briefs define 10 heterogeneous scenarios", async () => {
    assert.equal(SYNTHETIC_BUSINESS_BRIEFS.length, 10, "Must contain exactly 10 heterogeneous business briefs");

    const briefSummaries = listSyntheticBusinessBriefs();
    assert.equal(briefSummaries.length, 10);

    const expectedBriefIds = [
      "BRIEF-01-SOLARIS-CONSULTING",
      "BRIEF-02-VANGUARD-LEGAL",
      "BRIEF-03-APEX-ACADEMY",
      "BRIEF-04-CHRONICLE-DIGITAL",
      "BRIEF-05-NEXUS-TALENT",
      "BRIEF-06-PULSE-FITNESS",
      "BRIEF-07-CALC-FINANCIAL",
      "BRIEF-08-AURA-PROPERTIES",
      "BRIEF-09-BEACON-NONPROFIT",
      "BRIEF-10-HORIZON-HEALTH",
    ];

    for (let i = 0; i < 10; i++) {
      const brief = SYNTHETIC_BUSINESS_BRIEFS[i];
      assert.equal(brief.id, expectedBriefIds[i]);
      assert.equal(brief.briefNumber, i + 1);
      assert.ok(brief.requiredPages.length > 0, `Brief ${brief.id} must have required pages`);
      assert.ok(brief.mobileAndA11yCriteria.length > 0, `Brief ${brief.id} must have mobile/a11y criteria`);
      assert.ok(brief.explicitExclusions.length > 0, `Brief ${brief.id} must have explicit scope exclusions`);
      assert.ok(brief.criticalFailureConditions.length > 0, `Brief ${brief.id} must have critical failure conditions`);
    }

    // Verify distinct archetypes
    const archetypes = new Set(SYNTHETIC_BUSINESS_BRIEFS.map((b) => b.archetype));
    assert.equal(archetypes.size, 10, "All 10 briefs must have materially distinct archetypes");
  });

  await t.test("4. Fair Benchmark Protocol anti-masking: Critical failure cannot be hidden by high score", async () => {
    const validConfig: BenchmarkRunConfig = {
      protocolVersion: BENCHMARK_PROTOCOL_VERSION,
      productName: "Competitor-X",
      productVersion: "2026.1",
      purchasedPlanOrEntitlement: "Enterprise Tier ($299/mo)",
      briefId: "BRIEF-01-SOLARIS-CONSULTING",
      operatorExperienceLevel: "PROFESSIONAL_DESIGNER",
      enabledIntegrations: ["Custom CRM Webhook"],
      startingConditions: "Clean test workspace",
      preparedAssetsDescription: "Standardized Brief-01 fixtures",
      costAssumptionsDescription: "Annual enterprise plan billed monthly",
      actualCostUsd: 299.0,
    };

    // Construct results where 9 tasks pass with flying colors, but TASK-06 (CRM outage) drops leads (CRITICAL failure)
    const taskResults: TaskMeasurementResult[] = [
      {
        taskId: "TASK-01-CREATE-WEBSITE",
        taskName: "Create a Website",
        status: "PASSED",
        activeElapsedSeconds: 1800,
        totalElapsedSeconds: 1900,
        assistanceInterventionsCount: 0,
        defects: [],
        isCriticalFailure: false,
        notes: "Flawless site creation",
        rawMetrics: {},
        evidenceArtifactUrls: [],
      },
      {
        taskId: "TASK-02-MOBILE-A11Y",
        taskName: "Mobile Accessibility",
        status: "PASSED",
        activeElapsedSeconds: 300,
        totalElapsedSeconds: 300,
        assistanceInterventionsCount: 0,
        defects: [],
        isCriticalFailure: false,
        notes: "Passed WCAG AA",
        rawMetrics: {},
        evidenceArtifactUrls: [],
      },
      {
        taskId: "TASK-03-PUBLISH-ARTICLE",
        taskName: "Add and Publish an Article",
        status: "PASSED",
        activeElapsedSeconds: 200,
        totalElapsedSeconds: 200,
        assistanceInterventionsCount: 0,
        defects: [],
        isCriticalFailure: false,
        notes: "Published article cleanly",
        rawMetrics: {},
        evidenceArtifactUrls: [],
      },
      {
        taskId: "TASK-04-SCHEMA-EVOLUTION",
        taskName: "Change a Used Collection Field",
        status: "PASSED",
        activeElapsedSeconds: 400,
        totalElapsedSeconds: 400,
        assistanceInterventionsCount: 0,
        defects: [],
        isCriticalFailure: false,
        notes: "Schema evolved without data loss",
        rawMetrics: {},
        evidenceArtifactUrls: [],
      },
      {
        taskId: "TASK-05-STATEFUL-COMPONENT",
        taskName: "Reuse a Stateful Uploaded Component",
        status: "PASSED",
        activeElapsedSeconds: 350,
        totalElapsedSeconds: 350,
        assistanceInterventionsCount: 0,
        defects: [],
        isCriticalFailure: false,
        notes: "Component rendered cleanly",
        rawMetrics: {},
        evidenceArtifactUrls: [],
      },
      {
        taskId: "TASK-06-CRM-OUTAGE-LEAD",
        taskName: "Collect a Synthetic Lead During CRM Failure",
        status: "FAILED",
        activeElapsedSeconds: 500,
        totalElapsedSeconds: 500,
        assistanceInterventionsCount: 0,
        defects: [
          {
            severity: "CRITICAL",
            description: "Lead dropped silently with 0 retry or local database persistence during CRM 503 outage.",
          },
        ],
        isCriticalFailure: true,
        notes: "CRITICAL FAILURE: visitor inquiry permanently lost",
        rawMetrics: { leadLost: true },
        evidenceArtifactUrls: [],
      },
      {
        taskId: "TASK-07-INTERRUPTED-EDIT-RECOVERY",
        taskName: "Recover an Interrupted Edit",
        status: "PASSED",
        activeElapsedSeconds: 200,
        totalElapsedSeconds: 200,
        assistanceInterventionsCount: 0,
        defects: [],
        isCriticalFailure: false,
        notes: "Draft restored",
        rawMetrics: {},
        evidenceArtifactUrls: [],
      },
      {
        taskId: "TASK-08-REJECT-DANGEROUS-RELEASE",
        taskName: "Reject a Dangerous Release",
        status: "PASSED",
        activeElapsedSeconds: 150,
        totalElapsedSeconds: 150,
        assistanceInterventionsCount: 0,
        defects: [],
        isCriticalFailure: false,
        notes: "Dangerous release rejected",
        rawMetrics: {},
        evidenceArtifactUrls: [],
      },
      {
        taskId: "TASK-09-PORTABLE-HOSTING-PUBLISH",
        taskName: "Move to Fresh Hosting and Publish Another Article",
        status: "PASSED",
        activeElapsedSeconds: 600,
        totalElapsedSeconds: 600,
        assistanceInterventionsCount: 0,
        defects: [],
        isCriticalFailure: false,
        notes: "Export installed on target server",
        rawMetrics: {},
        evidenceArtifactUrls: [],
      },
      {
        taskId: "TASK-10-OPERATOR-ACCOUNT-RECOVERY",
        taskName: "Recover After Operator-Account Loss",
        status: "PASSED",
        activeElapsedSeconds: 300,
        totalElapsedSeconds: 300,
        assistanceInterventionsCount: 0,
        defects: [],
        isCriticalFailure: false,
        notes: "Successor recovered project",
        rawMetrics: {},
        evidenceArtifactUrls: [],
      },
    ];

    const report = computeBenchmarkRunReport("test-run-antimasking", validConfig, taskResults);

    // Assert that even though 9 of 10 tasks passed (90% raw pass rate), the critical failure is NOT masked:
    assert.equal(report.summary.hasCriticalFailure, true, "Must flag hasCriticalFailure = true");
    assert.equal(
      report.summary.overallOutcome,
      "CRITICAL_FAILURE",
      "Overall outcome MUST be forced to CRITICAL_FAILURE despite high score"
    );
    assert.ok(
      report.summary.scoreInterpretation.includes("CRITICAL FAILURE DETECTED"),
      "Score interpretation must openly declare score is invalid for certification"
    );
  });

  await t.test("5. Automated technical qualification verifies ForgeStudio release rejection and lead resilience", async () => {
    // TASK-08: Reject Dangerous Release
    const task08Result = await benchmarkService.executeAutomatedQualification(
      "TASK-08-REJECT-DANGEROUS-RELEASE",
      "BRIEF-01-SOLARIS-CONSULTING"
    );
    assert.equal(task08Result.status, "PASSED", "TASK-08 qualification must pass (dangerous release rejected)");
    assert.equal(task08Result.isCriticalFailure, false);

    // TASK-06: Synthetic lead during CRM failure
    const task06Result = await benchmarkService.executeAutomatedQualification(
      "TASK-06-CRM-OUTAGE-LEAD",
      "BRIEF-06-PULSE-FITNESS"
    );
    assert.equal(task06Result.status, "PASSED", "TASK-06 qualification must pass (lead resilience preserved)");
    assert.equal(task06Result.isCriticalFailure, false);

    // TASK-04: Schema evolution
    const task04Result = await benchmarkService.executeAutomatedQualification(
      "TASK-04-SCHEMA-EVOLUTION",
      "BRIEF-08-AURA-PROPERTIES"
    );
    assert.equal(task04Result.status, "PASSED");

    // Human operator task (TASK-01) reports NOT_YET_MEASURED
    const task01Result = await benchmarkService.executeAutomatedQualification(
      "TASK-01-CREATE-WEBSITE",
      "BRIEF-01-SOLARIS-CONSULTING"
    );
    assert.equal(
      task01Result.status,
      "NOT_YET_MEASURED",
      "Human operator task must report NOT_YET_MEASURED without simulated fabrication"
    );
  });

  await t.test("6. Benchmark run persistence, retrieval, and input validation", async () => {
    // Negative test: invalid briefId
    const invalidConfig: BenchmarkRunConfig = {
      protocolVersion: BENCHMARK_PROTOCOL_VERSION,
      productName: "ForgeStudio",
      productVersion: "2.1.0",
      purchasedPlanOrEntitlement: "Pro",
      briefId: "NON_EXISTENT_BRIEF",
      operatorExperienceLevel: "BUSINESS_USER",
      enabledIntegrations: [],
      startingConditions: "Fresh",
      preparedAssetsDescription: "None",
      costAssumptionsDescription: "None",
      actualCostUsd: 0,
    };
    const valRes = validateBenchmarkRunConfig(invalidConfig);
    assert.equal(valRes.valid, false, "Invalid briefId must fail validation");

    // Positive test: record benchmark run
    const validConfig: BenchmarkRunConfig = {
      protocolVersion: BENCHMARK_PROTOCOL_VERSION,
      productName: "ForgeStudio",
      productVersion: "2.1.0",
      purchasedPlanOrEntitlement: "Team Pro",
      briefId: "BRIEF-01-SOLARIS-CONSULTING",
      operatorExperienceLevel: "BUSINESS_USER",
      enabledIntegrations: ["WordPress Gutenberg Bridge"],
      startingConditions: "Clean workspace with Brief 01 fixtures",
      preparedAssetsDescription: "Solaris assets",
      costAssumptionsDescription: "Standard license",
      actualCostUsd: 49.0,
    };

    const taskResults: TaskMeasurementResult[] = [
      await benchmarkService.executeAutomatedQualification("TASK-08-REJECT-DANGEROUS-RELEASE", "BRIEF-01-SOLARIS-CONSULTING"),
      await benchmarkService.executeAutomatedQualification("TASK-06-CRM-OUTAGE-LEAD", "BRIEF-01-SOLARIS-CONSULTING"),
    ];

    const recorded = await benchmarkService.recordBenchmarkRun("test-user-id", {
      config: validConfig,
      taskResults,
      knownLimitations: ["Human operator study not yet executed for this run"],
    });

    assert.ok(recorded.runId);
    assert.equal(recorded.summary.hasCriticalFailure, false);
    assert.equal(recorded.summary.overallOutcome, "PASS");

    // Retrieve by ID
    const retrieved = benchmarkService.getBenchmarkRunById(recorded.runId);
    assert.equal(retrieved.runId, recorded.runId);
    assert.equal(retrieved.config.productName, "ForgeStudio");

    // List runs
    const allRuns = benchmarkService.listBenchmarkRuns();
    assert.ok(allRuns.some((r) => r.runId === recorded.runId));
  });
});
