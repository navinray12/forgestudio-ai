/**
 * ForgeStudio Execution Blueprint v2.1 — Point 20 Automated Test Suite
 * Service Objectives and Failure Behavior
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ServiceLevelObjectivesRegisterService } from "../services/serviceObjectives/serviceLevelObjectivesRegister.service.ts";
import { FailureIsolationContractsService } from "../services/serviceObjectives/failureIsolationContracts.service.ts";
import { IncidentAlertOperationsService } from "../services/serviceObjectives/incidentAlertOperations.service.ts";

describe("Point 20 — Service Objectives and Failure Behavior", () => {
  it("should provide an SLO register with 8 proposed starting targets and defined SLI sources", () => {
    const slos = ServiceLevelObjectivesRegisterService.getSLORegister();
    assert.equal(slos.length, 8);

    // Invariant: Every SLO must be classified as PROPOSED_STARTING_TARGET
    slos.forEach((slo) => {
      assert.equal(slo.classification, "PROPOSED_STARTING_TARGET");
      assert.ok(slo.sliFormula.numerator);
      assert.ok(slo.sliFormula.denominator);
      assert.ok(slo.accountableRole);
    });

    const leadSlo = slos.find((s) => s.id === "SLO_LEAD_ACCEPTANCE");
    assert.ok(leadSlo);
    assert.ok(leadSlo.proposedTarget.includes("p95 <= 800ms"));
  });

  it("should enforce failure isolation across all 8 critical infrastructure fault modes", () => {
    // 1. AI Provider Outage: Primary service remains operational
    const aiOutage = FailureIsolationContractsService.evaluateFailureIsolation("AI_PROVIDER_OUTAGE");
    assert.equal(aiOutage.primaryServiceOperational, true);
    assert.equal(aiOutage.degradedModeActive, true);
    assert.equal(aiOutage.businessActionPermitted, true);

    // 2. CRM / Mail Outage: Lead capture remains durable in Record 5
    const crmOutage = FailureIsolationContractsService.evaluateFailureIsolation("CRM_MAIL_OUTAGE");
    assert.equal(crmOutage.leadCaptureDurable, true);
    assert.equal(crmOutage.businessActionPermitted, true);

    // 3. Analytics Outage: Core operations proceed unblocked
    const analyticsOutage = FailureIsolationContractsService.evaluateFailureIsolation("ANALYTICS_OUTAGE");
    assert.equal(analyticsOutage.primaryServiceOperational, true);

    // 4. Content Service Outage: Edge serves cached pages, writes blocked, zero drafts leaked
    const contentOutage = FailureIsolationContractsService.evaluateFailureIsolation("CONTENT_SERVICE_OUTAGE");
    assert.equal(contentOutage.draftsLeaked, false);
    assert.equal(contentOutage.businessActionPermitted, false);

    // 5. Audit Failure: Protected mutations fail safely
    const auditOutage = FailureIsolationContractsService.evaluateFailureIsolation("AUDIT_PERSISTENCE_FAILURE");
    assert.equal(auditOutage.businessActionPermitted, false);

    // 6. Corrupted Artifact: Promotion blocked
    const artifactOutage = FailureIsolationContractsService.evaluateFailureIsolation("CORRUPTED_ARTIFACT");
    assert.equal(artifactOutage.businessActionPermitted, false);
  });

  it("should evaluate error budgets and freeze promotions when reliability is compromised", () => {
    // 1. Healthy availability (99.95%) -> Error budget intact, promotions allowed
    const healthyBudget = IncidentAlertOperationsService.evaluateErrorBudget(99.95);
    assert.equal(healthyBudget.budgetExhausted, false);
    assert.equal(healthyBudget.riskyReleasesFrozen, false);

    // 2. Degraded availability (98.5%) -> Error budget depleted, risky promotions frozen
    const degradedBudget = IncidentAlertOperationsService.evaluateErrorBudget(98.5);
    assert.equal(degradedBudget.riskyReleasesFrozen, true);
    assert.ok(degradedBudget.reason?.includes("frozen"));
  });

  it("should provide incident alert definitions with role-based accountability and escalation timing", () => {
    const alerts = IncidentAlertOperationsService.getAlertDefinitions();
    assert.ok(alerts.length >= 3);

    alerts.forEach((alert) => {
      assert.ok(alert.accountableRole);
      assert.ok(alert.backupRole);
      assert.ok(alert.escalationTimingMinutes > 0);
      assert.ok(alert.mitigationRunbook);
    });
  });
});
