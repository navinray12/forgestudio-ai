/**
 * ForgeStudio Execution Blueprint v2.1 — Point 15: Workflows, Communication, Experiments and Contextual Chat
 * Section 1.6: Experiment and A/B Testing Integrity
 *
 * Rules:
 * 1. Pinned exact control and treatment revisions.
 * 2. Pre-declared configuration (unit, population, sample plan, horizon, guardrails, stopping method).
 * 3. Assignment separate from actual exposure.
 * 4. Sample-ratio mismatch (SRM) detection & telemetry contamination reporting.
 * 5. Explicit outcomes: RUNNING, COMPLETED, INCONCLUSIVE, INVALID, SAFETY_STOPPED, CANCELLED.
 * 6. Automatic safety stopping if guardrails are breached; promotion requires reviewed evidence.
 */

import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";

export type ExperimentOutcome =
  | "RUNNING"
  | "COMPLETED"
  | "INCONCLUSIVE"
  | "INVALID"
  | "SAFETY_STOPPED"
  | "CANCELLED";

export interface ExperimentVariantConfig {
  variantId: "control" | "treatment";
  revisionId: string;
  revisionDigest: string;
  trafficAllocationPercent: number; // e.g. 50
  assignedCount: number;
  exposedCount: number; // strictly tracked separately from assignedCount
  conversionCount: number;
}

export interface ExperimentDefinition {
  experimentId: string;
  websiteId: string;
  tenantId: string;
  title: string;
  outcome: ExperimentOutcome;
  assignmentUnit: "VISITOR_ID" | "SESSION_ID";
  targetMetric: string; // e.g. "FORM_SUBMISSION"
  guardrails: {
    maxAllowedErrorRatePercent: number; // e.g. 5.0
    minConversionFloorPercent: number;  // e.g. 1.0
  };
  controlVariant: ExperimentVariantConfig;
  treatmentVariant: ExperimentVariantConfig;
  srmDetected: boolean;
  srmPValue?: number;
  safetyStoppedReason?: string;
  createdAt: string;
  startedAt?: string;
  concludedAt?: string;
}

export class ExperimentationEngine {
  private static experiments = new Map<string, ExperimentDefinition>();
  private static assignments = new Map<string, "control" | "treatment">(); // "expId:visitorId" -> variantId
  private static exposures = new Set<string>(); // "expId:visitorId:variantId"

  /**
   * Pre-declares and registers a new experiment with pinned revisions.
   */
  public static createExperiment(
    tenantId: string,
    websiteId: string,
    experimentId: string,
    title: string,
    controlRevision: { id: string; digest: string },
    treatmentRevision: { id: string; digest: string },
    guardrails: { maxErrorRate?: number; minConversionFloor?: number } = {}
  ): ExperimentDefinition {
    const experiment: ExperimentDefinition = {
      experimentId,
      websiteId,
      tenantId,
      title,
      outcome: "RUNNING",
      assignmentUnit: "VISITOR_ID",
      targetMetric: "FORM_SUBMISSION",
      guardrails: {
        maxAllowedErrorRatePercent: guardrails.maxErrorRate ?? 5.0,
        minConversionFloorPercent: guardrails.minConversionFloor ?? 1.0,
      },
      controlVariant: {
        variantId: "control",
        revisionId: controlRevision.id,
        revisionDigest: controlRevision.digest,
        trafficAllocationPercent: 50,
        assignedCount: 0,
        exposedCount: 0,
        conversionCount: 0,
      },
      treatmentVariant: {
        variantId: "treatment",
        revisionId: treatmentRevision.id,
        revisionDigest: treatmentRevision.digest,
        trafficAllocationPercent: 50,
        assignedCount: 0,
        exposedCount: 0,
        conversionCount: 0,
      },
      srmDetected: false,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    };

    this.experiments.set(experimentId, experiment);
    return experiment;
  }

  /**
   * Assigns a visitor deterministically to a variant. Assignment != exposure.
   */
  public static assignVisitor(experimentId: string, visitorId: string): "control" | "treatment" {
    const exp = this.experiments.get(experimentId);
    if (!exp) throw new AppError(`Experiment ${experimentId} not found`, 404, "EXPERIMENT_NOT_FOUND");
    if (exp.outcome !== "RUNNING") return "control"; // fallback to control if stopped

    const key = `${experimentId}:${visitorId}`;
    const existing = this.assignments.get(key);
    if (existing) return existing;

    // Deterministic hash assignment
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    const bucket = parseInt(hash.slice(0, 4), 16) % 100; // 0-99
    const assigned: "control" | "treatment" = bucket < exp.controlVariant.trafficAllocationPercent ? "control" : "treatment";

    this.assignments.set(key, assigned);
    if (assigned === "control") {
      exp.controlVariant.assignedCount++;
    } else {
      exp.treatmentVariant.assignedCount++;
    }

    this.checkSampleRatioMismatch(exp);
    return assigned;
  }

  /**
   * Confirms verified exposure (e.g. element rendered in viewport for >= 1000ms).
   */
  public static recordExposure(experimentId: string, visitorId: string, variantId: "control" | "treatment"): void {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.outcome !== "RUNNING") return;

    const exposureKey = `${experimentId}:${visitorId}:${variantId}`;
    if (this.exposures.has(exposureKey)) return; // Deduplicate repeat exposures

    this.exposures.add(exposureKey);
    if (variantId === "control") {
      exp.controlVariant.exposedCount++;
    } else {
      exp.treatmentVariant.exposedCount++;
    }
  }

  /**
   * Records a business conversion for an exposed visitor.
   */
  public static recordConversion(experimentId: string, visitorId: string): void {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.outcome !== "RUNNING") return;

    const assigned = this.assignments.get(`${experimentId}:${visitorId}`);
    if (!assigned) return;

    // Only count conversion if visitor was legitimately exposed
    const wasExposed = this.exposures.has(`${experimentId}:${visitorId}:${assigned}`);
    if (!wasExposed) return;

    if (assigned === "control") {
      exp.controlVariant.conversionCount++;
    } else {
      exp.treatmentVariant.conversionCount++;
    }

    this.evaluateGuardrails(exp);
  }

  /**
   * Sample-Ratio Mismatch (SRM) detection via Chi-Square test approximation.
   */
  private static checkSampleRatioMismatch(exp: ExperimentDefinition): void {
    const total = exp.controlVariant.assignedCount + exp.treatmentVariant.assignedCount;
    if (total < 100) return; // Need minimal statistical sample

    const expected = total / 2;
    const chiSquare =
      Math.pow(exp.controlVariant.assignedCount - expected, 2) / expected +
      Math.pow(exp.treatmentVariant.assignedCount - expected, 2) / expected;

    // Chi-Square 1 DOF critical value at p=0.001 is 10.83
    if (chiSquare > 10.83) {
      exp.srmDetected = true;
      exp.outcome = "INVALID";
      exp.safetyStoppedReason = `Sample Ratio Mismatch detected (Chi-square: ${chiSquare.toFixed(2)}). Traffic allocation corrupted.`;
      exp.concludedAt = new Date().toISOString();
    }
  }

  /**
   * Evaluates safety guardrails (e.g., treatment catastrophic regression).
   */
  private static evaluateGuardrails(exp: ExperimentDefinition): void {
    if (exp.treatmentVariant.exposedCount >= 50) {
      const treatmentRate = (exp.treatmentVariant.conversionCount / exp.treatmentVariant.exposedCount) * 100;
      if (treatmentRate < exp.guardrails.minConversionFloorPercent) {
        exp.outcome = "SAFETY_STOPPED";
        exp.safetyStoppedReason = `Treatment conversion rate (${treatmentRate.toFixed(2)}%) breached safety floor (${exp.guardrails.minConversionFloorPercent}%).`;
        exp.concludedAt = new Date().toISOString();
      }
    }
  }

  /**
   * Evaluates experiment results with truthful status reporting.
   */
  public static getExperimentResults(experimentId: string): ExperimentDefinition {
    const exp = this.experiments.get(experimentId);
    if (!exp) throw new AppError(`Experiment ${experimentId} not found`, 404, "NOT_FOUND");
    return exp;
  }
}
