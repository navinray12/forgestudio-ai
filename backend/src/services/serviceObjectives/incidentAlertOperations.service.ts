/**
 * ForgeStudio Execution Blueprint v2.1 — Point 20: Service Objectives and Failure Behavior
 * Section 2.5: Incident, Alert and Error-Budget Operations
 *
 * Rules:
 * 1. Role-based accountability (no invented personal names).
 * 2. Error-budget policy pauses risky releases when error budget is exhausted (<99.0% availability or lead latency > 1500ms).
 */

import { AppError } from "../../utils/app-error.js";

export interface AlertDefinition {
  alertId: string;
  name: string;
  signalName: string;
  threshold: string;
  accountableRole: string;
  backupRole: string;
  escalationTimingMinutes: number;
  mitigationRunbook: string;
}

export interface ErrorBudgetStatus {
  totalBudgetMinutes: number;
  consumedBudgetMinutes: number;
  remainingBudgetPercent: number;
  budgetExhausted: boolean;
  riskyReleasesFrozen: boolean;
  reason?: string;
}

export class IncidentAlertOperationsService {
  private static alerts: AlertDefinition[] = [
    {
      alertId: "ALERT_LEAD_SUBMISSION_LATENCY",
      name: "Lead Submission Latency Spike",
      signalName: "lead_acceptance_duration_ms",
      threshold: "p95 > 1500ms over 5m window",
      accountableRole: "BACKEND_CORE_ONCALL",
      backupRole: "PLATFORM_ENGINEERING_LEAD",
      escalationTimingMinutes: 10,
      mitigationRunbook: "Check PostgreSQL connection pool saturation and vacuum locks.",
    },
    {
      alertId: "ALERT_OUTBOX_DEAD_LETTER_ACCUMULATION",
      name: "Outbox Dead-Letter Rate Elevated",
      signalName: "outbox_dead_letter_count",
      threshold: "> 10 dead letters in 15m window",
      accountableRole: "INTEGRATION_SERVICES_ONCALL",
      backupRole: "SRE_LEAD",
      escalationTimingMinutes: 15,
      mitigationRunbook: "Inspect downstream provider error codes; pause affected tenant worker queue.",
    },
    {
      alertId: "ALERT_TENANT_SECURITY_DENIAL_SPIKE",
      name: "Suspicious Tenant Substitution Denial Surge",
      signalName: "security_denial_count",
      threshold: "> 25 denials in 5m window",
      accountableRole: "SECURITY_OPERATIONS_ONCALL",
      backupRole: "CHIEF_SECURITY_OFFICER_ROLE",
      escalationTimingMinutes: 5,
      mitigationRunbook: "Quarantine originating IP range and investigate token replay.",
    },
  ];

  public static getAlertDefinitions(): AlertDefinition[] {
    return this.alerts;
  }

  /**
   * Evaluates current error budget and enforces release freeze if exhausted.
   */
  public static evaluateErrorBudget(availabilityPercent: number): ErrorBudgetStatus {
    const targetAvailability = 99.9;
    const totalBudgetMinutes = 43.2; // 0.1% of a 30-day month = 43.2 minutes

    // Calculate consumed downtime
    const downtimeFraction = Math.max(0, (100 - availabilityPercent) / 100);
    const consumedMinutes = Math.min(totalBudgetMinutes, Number((downtimeFraction * 30 * 24 * 60).toFixed(1)));
    const remainingPercent = Number((((totalBudgetMinutes - consumedMinutes) / totalBudgetMinutes) * 100).toFixed(1));

    const budgetExhausted = remainingPercent <= 0;
    const riskyReleasesFrozen = budgetExhausted || remainingPercent < 10;

    return {
      totalBudgetMinutes,
      consumedBudgetMinutes: consumedMinutes,
      remainingBudgetPercent: Math.max(0, remainingPercent),
      budgetExhausted,
      riskyReleasesFrozen,
      reason: riskyReleasesFrozen
        ? `Error budget severely degraded (${remainingPercent}% remaining). High-risk production promotions frozen.`
        : "Error budget healthy; deployments permitted.",
    };
  }
}
