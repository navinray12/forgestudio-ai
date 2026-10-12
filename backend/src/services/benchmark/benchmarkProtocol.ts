/**
 * ForgeStudio Execution Blueprint v2.1 — Point 03: Market Reality and Benchmark to Win
 * Fair Benchmark Protocol & Evaluation Engine
 *
 * Implements a reproducible, fair methodology for evaluating website platforms:
 * - Equalized conditions across all compared products.
 * - Strict hard-failure policy: a critical failure (data loss, security leak, silent lead drop)
 *   CANNOT be masked or averaged away by a high composite score.
 * - Versioned, machine-readable benchmark run model.
 */

import { BENCHMARK_TASKS, getBenchmarkTaskById } from "./benchmarkTasks.js";
import { SYNTHETIC_BUSINESS_BRIEFS, getSyntheticBusinessBriefById } from "./benchmarkBriefs.js";

export const BENCHMARK_PROTOCOL_VERSION = "2.1.0";

export type OperatorExperienceLevel = "NOVICE" | "BUSINESS_USER" | "PROFESSIONAL_DESIGNER" | "SOFTWARE_ENGINEER";

export type TaskExecutionStatus = "PASSED" | "FAILED" | "BLOCKED" | "NOT_YET_MEASURED";

export interface TaskMeasurementResult {
  taskId: string;
  taskName: string;
  status: TaskExecutionStatus;
  activeElapsedSeconds: number;
  totalElapsedSeconds: number;
  assistanceInterventionsCount: number;
  defects: Array<{
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    description: string;
    evidenceReference?: string;
  }>;
  isCriticalFailure: boolean;
  notes: string;
  rawMetrics: Record<string, any>;
  evidenceArtifactUrls: string[];
}

export interface BenchmarkRunConfig {
  protocolVersion: string;
  productName: string; // e.g. "ForgeStudio", "Wix Studio", "Webflow", "Lovable", "Framer", "WordPress"
  productVersion: string; // e.g. "2.1.0", "6.6", "Unknown"
  purchasedPlanOrEntitlement: string; // e.g. "Pro $29/mo", "Free", "Open Source"
  briefId: string;
  operatorExperienceLevel: OperatorExperienceLevel;
  enabledIntegrations: string[];
  startingConditions: string;
  preparedAssetsDescription: string;
  costAssumptionsDescription: string;
  actualCostUsd: number;
}

export interface BenchmarkRunReport {
  runId: string;
  createdAt: string;
  config: BenchmarkRunConfig;
  taskResults: TaskMeasurementResult[];
  summary: {
    totalTasks: number;
    tasksPassed: number;
    tasksFailed: number;
    tasksBlocked: number;
    tasksNotMeasured: number;
    totalActiveElapsedSeconds: number;
    totalAssistanceInterventions: number;
    defectsBySeverity: {
      CRITICAL: number;
      HIGH: number;
      MEDIUM: number;
      LOW: number;
    };
    // Hard-Failure Invariant: If any critical defect or critical task failure occurred,
    // hasCriticalFailure is TRUE and overallOutcome is FORCED to CRITICAL_FAILURE.
    hasCriticalFailure: boolean;
    overallOutcome: "PASS" | "PASS_WITH_DEFECTS" | "FAILED" | "CRITICAL_FAILURE" | "INCOMPLETE";
    // Raw composite score (0-100), but explicitly accompanied by critical failure warning
    provisionalCompositeScore: number;
    scoreInterpretation: string;
  };
  knownLimitationsAndUncertainty: string[];
}

/**
 * Validates a benchmark run configuration against protocol standards
 */
export function validateBenchmarkRunConfig(config: BenchmarkRunConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.productName || !config.productName.trim()) {
    errors.push("productName is required.");
  }
  if (!config.briefId || !getSyntheticBusinessBriefById(config.briefId)) {
    errors.push(`Invalid briefId: '${config.briefId}'. Must match one of the 10 defined synthetic briefs.`);
  }
  if (!config.operatorExperienceLevel) {
    errors.push("operatorExperienceLevel is required.");
  }
  if (config.actualCostUsd < 0) {
    errors.push("actualCostUsd cannot be negative.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Evaluates and computes an authoritative benchmark run report with hard-failure enforcement
 */
export function computeBenchmarkRunReport(
  runId: string,
  config: BenchmarkRunConfig,
  taskResults: TaskMeasurementResult[],
  knownLimitations: string[] = []
): BenchmarkRunReport {
  let totalActiveSeconds = 0;
  let totalAssistance = 0;
  let passedCount = 0;
  let failedCount = 0;
  let blockedCount = 0;
  let notMeasuredCount = 0;

  const defectCounts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  let hasCriticalFailure = false;

  for (const t of taskResults) {
    totalActiveSeconds += t.activeElapsedSeconds || 0;
    totalAssistance += t.assistanceInterventionsCount || 0;

    if (t.status === "PASSED") passedCount++;
    else if (t.status === "FAILED") failedCount++;
    else if (t.status === "BLOCKED") blockedCount++;
    else if (t.status === "NOT_YET_MEASURED") notMeasuredCount++;

    const taskDef = getBenchmarkTaskById(t.taskId);
    if (taskDef?.isHardFailureTrigger && t.status === "FAILED") {
      hasCriticalFailure = true;
    }

    if (t.isCriticalFailure) {
      hasCriticalFailure = true;
    }

    for (const d of t.defects || []) {
      defectCounts[d.severity] = (defectCounts[d.severity] || 0) + 1;
      if (d.severity === "CRITICAL") {
        hasCriticalFailure = true;
      }
    }
  }

  // Calculate provisional task completion ratio (0 - 100)
  const measuredTasks = passedCount + failedCount;
  const rawPassRate = measuredTasks > 0 ? (passedCount / measuredTasks) * 100 : 0;

  // Penalize defects: High (-10), Medium (-3), Low (-1)
  const defectPenalty = defectCounts.HIGH * 10 + defectCounts.MEDIUM * 3 + defectCounts.LOW * 1;
  const provisionalCompositeScore = Math.max(0, Math.round(rawPassRate - defectPenalty));

  // Determine overall outcome with STRICT hard-failure enforcement
  let overallOutcome: "PASS" | "PASS_WITH_DEFECTS" | "FAILED" | "CRITICAL_FAILURE" | "INCOMPLETE";
  let scoreInterpretation: string;

  if (hasCriticalFailure) {
    overallOutcome = "CRITICAL_FAILURE";
    scoreInterpretation = `CRITICAL FAILURE DETECTED (${defectCounts.CRITICAL} critical defects). The composite score (${provisionalCompositeScore}/100) is invalid for certification because a critical safety, data loss, or business failure occurred.`;
  } else if (notMeasuredCount > 0 && measuredTasks === 0) {
    overallOutcome = "INCOMPLETE";
    scoreInterpretation = `Run contains unmeasured tasks (${notMeasuredCount} unmeasured). Protocol execution incomplete.`;
  } else if (failedCount > 0) {
    overallOutcome = "FAILED";
    scoreInterpretation = `Run failed ${failedCount} of ${measuredTasks} measured tasks without critical failures. Score: ${provisionalCompositeScore}/100.`;
  } else if (defectCounts.HIGH > 0 || defectCounts.MEDIUM > 0) {
    overallOutcome = "PASS_WITH_DEFECTS";
    scoreInterpretation = `All measured tasks passed, but non-critical defects were noted (${defectCounts.HIGH} high, ${defectCounts.MEDIUM} medium). Score: ${provisionalCompositeScore}/100.`;
  } else {
    overallOutcome = "PASS";
    scoreInterpretation = `All measured tasks passed cleanly with zero high or critical defects. Score: ${provisionalCompositeScore}/100.`;
  }

  return {
    runId,
    createdAt: new Date().toISOString(),
    config,
    taskResults,
    summary: {
      totalTasks: taskResults.length,
      tasksPassed: passedCount,
      tasksFailed: failedCount,
      tasksBlocked: blockedCount,
      tasksNotMeasured: notMeasuredCount,
      totalActiveElapsedSeconds: totalActiveSeconds,
      totalAssistanceInterventions: totalAssistance,
      defectsBySeverity: defectCounts,
      hasCriticalFailure,
      overallOutcome,
      provisionalCompositeScore,
      scoreInterpretation,
    },
    knownLimitationsAndUncertainty: knownLimitations,
  };
}
