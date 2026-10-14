/**
 * ForgeStudio Execution Blueprint v2.1 — Point 19: Adaptive Infrastructure and Operating Economics
 * Section 1.5 & 1.6: Autoscaling and Operating Economics Models
 *
 * Rules:
 * 1. Resource-aware autoscaling: queue depth, worker saturation, CPU/mem, connection pool budgets.
 * 2. Pending work protection: scale-down is prevented while active leases exist.
 * 3. Transparent cost model: breakdown across compute, DB, builds, AI tokens (failed attempts/retries included), messaging, telemetry, egress.
 * 4. Scenarios: low, base, high workload projections.
 */

export interface AutoscalingDecision {
  currentReplicas: number;
  desiredReplicas: number;
  reason: string;
  scaleDownBlockedDueToPendingLeases: boolean;
  activeLeaseCount: number;
}

export interface OperatingCostBreakdown {
  scenario: "LOW" | "BASE" | "HIGH";
  computeUsd: number;
  databaseUsd: number;
  buildsAndVerificationUsd: number;
  aiTokensAndRetriesUsd: number; // Includes failed attempts and repair retries!
  messagingAndChannelsUsd: number;
  telemetryAndLogsUsd: number;
  mediaProcessingUsd: number;
  dataEgressUsd: number;
  supportOverheadUsd: number;
  totalMonthlyEstimatedCostUsd: number;
}

export class AutoscalingCostEconomicsService {
  /**
   * Evaluates autoscaling signals with scale-down protection for pending work.
   */
  public static evaluateAutoscaling(signals: {
    currentReplicas: number;
    maxAllowedReplicas: number;
    queueDepth: number;
    cpuUtilizationPercent: number;
    activeInFlightWorkerLeases: number;
  }): AutoscalingDecision {
    const { currentReplicas, maxAllowedReplicas, queueDepth, cpuUtilizationPercent, activeInFlightWorkerLeases } = signals;

    // 1. Scale Up condition: queue depth > 50 or CPU > 75%
    if ((queueDepth > 50 || cpuUtilizationPercent > 75) && currentReplicas < maxAllowedReplicas) {
      const desired = Math.min(currentReplicas + 2, maxAllowedReplicas);
      return {
        currentReplicas,
        desiredReplicas: desired,
        reason: `Scale-up triggered: Queue depth (${queueDepth}) or CPU (${cpuUtilizationPercent}%) breached threshold`,
        scaleDownBlockedDueToPendingLeases: false,
        activeLeaseCount: activeInFlightWorkerLeases,
      };
    }

    // 2. Scale Down check with pending work protection
    if (queueDepth === 0 && cpuUtilizationPercent < 25 && currentReplicas > 1) {
      if (activeInFlightWorkerLeases > 0) {
        return {
          currentReplicas,
          desiredReplicas: currentReplicas,
          reason: `Scale-down paused: ${activeInFlightWorkerLeases} active worker leases in flight`,
          scaleDownBlockedDueToPendingLeases: true,
          activeLeaseCount: activeInFlightWorkerLeases,
        };
      }

      return {
        currentReplicas,
        desiredReplicas: Math.max(1, currentReplicas - 1),
        reason: "Scale-down executed: Idle workload with 0 pending leases",
        scaleDownBlockedDueToPendingLeases: false,
        activeLeaseCount: 0,
      };
    }

    return {
      currentReplicas,
      desiredReplicas: currentReplicas,
      reason: "Capacity stable within target utilization envelope",
      scaleDownBlockedDueToPendingLeases: false,
      activeLeaseCount: activeInFlightWorkerLeases,
    };
  }

  /**
   * Computes scenario-based operating economics.
   * Crucial invariant: Includes failed repair attempts and retries in AI/Build cost modeling.
   */
  public static computeScenarioCostModel(scenario: "LOW" | "BASE" | "HIGH"): OperatingCostBreakdown {
    switch (scenario) {
      case "LOW":
        return {
          scenario: "LOW",
          computeUsd: 15.0,
          databaseUsd: 15.0,
          buildsAndVerificationUsd: 5.0,
          aiTokensAndRetriesUsd: 8.5, // ~150k tokens + retries
          messagingAndChannelsUsd: 2.0,
          telemetryAndLogsUsd: 3.0,
          mediaProcessingUsd: 2.5,
          dataEgressUsd: 1.0,
          supportOverheadUsd: 0.0,
          totalMonthlyEstimatedCostUsd: 52.0,
        };
      case "BASE":
        return {
          scenario: "BASE",
          computeUsd: 45.0,
          databaseUsd: 35.0,
          buildsAndVerificationUsd: 18.0,
          aiTokensAndRetriesUsd: 32.0, // ~800k tokens + 2 repair cycles
          messagingAndChannelsUsd: 12.0,
          telemetryAndLogsUsd: 8.0,
          mediaProcessingUsd: 10.0,
          dataEgressUsd: 5.0,
          supportOverheadUsd: 10.0,
          totalMonthlyEstimatedCostUsd: 175.0,
        };
      case "HIGH":
        return {
          scenario: "HIGH",
          computeUsd: 180.0,
          databaseUsd: 120.0,
          buildsAndVerificationUsd: 65.0,
          aiTokensAndRetriesUsd: 125.0, // High token volume + repair retries
          messagingAndChannelsUsd: 45.0,
          telemetryAndLogsUsd: 25.0,
          mediaProcessingUsd: 40.0,
          dataEgressUsd: 20.0,
          supportOverheadUsd: 30.0,
          totalMonthlyEstimatedCostUsd: 650.0,
        };
    }
  }
}
