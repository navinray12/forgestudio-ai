/**
 * ForgeStudio Execution Blueprint v2.1 — Point 19 Automated Test Suite
 * Adaptive Infrastructure and Operating Economics
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InfrastructureProfilesService } from "../services/adaptiveInfrastructure/infrastructureProfiles.service.ts";
import { OptionalInfrastructureCapabilitiesService } from "../services/adaptiveInfrastructure/optionalInfrastructureCapabilities.service.ts";
import { UpgradeInfrastructureWorkflowService } from "../services/adaptiveInfrastructure/upgradeInfrastructureWorkflow.service.ts";
import { AutoscalingCostEconomicsService } from "../services/adaptiveInfrastructure/autoscalingCostEconomics.service.ts";

describe("Point 19 — Adaptive Infrastructure and Operating Economics", () => {
  it("should provide typed infrastructure profiles and validate migration planning", () => {
    const profiles = InfrastructureProfilesService.getAllProfiles();
    assert.equal(profiles.length, 4);

    // Migration plan from Native Dev to Managed Container
    const plan = InfrastructureProfilesService.generateProfileMigrationPlan(
      "tenant_alpha",
      "NATIVE_DEV",
      "MANAGED_CONTAINER"
    );
    assert.equal(plan.preflightPassed, true);
    assert.equal(plan.currentProfile, "NATIVE_DEV");
    assert.equal(plan.targetProfile, "MANAGED_CONTAINER");
    assert.ok(plan.databaseMigrationSteps.length >= 4);
    assert.ok(plan.requiredApprovals.includes("INFRASTRUCTURE_OWNER"));
  });

  it("should enforce cache invalidation on publication and fallback on miss", () => {
    const dims = {
      tenantId: "tenant_alpha",
      websiteId: "web_01",
      revisionId: "rev_01",
      authContext: "PUBLIC" as const,
      routeSlug: "/about",
    };

    // 1. Cache set and get
    OptionalInfrastructureCapabilitiesService.setCache(dims, { title: "About Us" }, 3600);
    const hit = OptionalInfrastructureCapabilitiesService.getCache(dims);
    assert.equal(hit.hit, true);
    assert.equal(hit.data.title, "About Us");

    // 2. Invalidate on new publication
    const count = OptionalInfrastructureCapabilitiesService.invalidateCacheOnPublication("web_01", "rev_01");
    assert.ok(count >= 1);

    // 3. Fallback required after invalidation
    const after = OptionalInfrastructureCapabilitiesService.getCache(dims);
    assert.equal(after.hit, false);
    assert.equal(after.fallbackRequired, true);
  });

  it("should route queue tasks to DLQ when max retries exceeded and filter Kafka replay on revoked consent", () => {
    // 1. Task retry under threshold
    const taskNormal = OptionalInfrastructureCapabilitiesService.routeTaskToQueue({
      eventId: "ev_01",
      tenantId: "tenant_alpha",
      type: "SEND_EMAIL",
      payload: {},
      retryCount: 2,
    });
    assert.equal(taskNormal.enqueued, true);
    assert.equal(taskNormal.deadLettered, false);

    // 2. Task retry exceeding limit of 5
    const taskDlq = OptionalInfrastructureCapabilitiesService.routeTaskToQueue({
      eventId: "ev_02",
      tenantId: "tenant_alpha",
      type: "SEND_EMAIL",
      payload: {},
      retryCount: 5,
    });
    assert.equal(taskDlq.enqueued, false);
    assert.equal(taskDlq.deadLettered, true);

    // 3. Kafka replay filter: blocks events for users who revoked consent
    const kafkaEvents = [
      { eventId: "k_01", eventType: "NEWSLETTER", timestamp: "2026-10-01", requiresActiveConsent: true, consentState: "GRANTED" },
      { eventId: "k_02", eventType: "MARKETING_SMS", timestamp: "2026-10-01", requiresActiveConsent: true, consentState: "WITHDRAWN" },
    ];
    const { eligibleReplays, suppressedReplays } = OptionalInfrastructureCapabilitiesService.filterKafkaReplayEvents(kafkaEvents);
    assert.equal(eligibleReplays.length, 1);
    assert.equal(suppressedReplays.length, 1);
    assert.equal(suppressedReplays[0].eventId, "k_02");
  });

  it("should filter search results hiding draft and trashed content from public queries", () => {
    const rawDocs = [
      { id: "d1", tenantId: "tenant_alpha", status: "PUBLISHED" as const, isPrivate: false },
      { id: "d2", tenantId: "tenant_alpha", status: "DRAFT" as const, isPrivate: false },
      { id: "d3", tenantId: "tenant_alpha", status: "TRASHED" as const, isPrivate: false },
      { id: "d4", tenantId: "tenant_beta", status: "PUBLISHED" as const, isPrivate: false },
    ];

    const results = OptionalInfrastructureCapabilitiesService.filterSearchQueryResults("tenant_alpha", rawDocs, "PUBLIC_VISITOR");
    assert.equal(results.length, 1);
    assert.equal(results[0].id, "d1");
  });

  it("should execute upgrade workflow with approval verification", () => {
    const plan = InfrastructureProfilesService.generateProfileMigrationPlan(
      "tenant_alpha",
      "DOCKER_COMPOSE",
      "MANAGED_CONTAINER"
    );

    // Fails without required approvals
    assert.throws(
      () => UpgradeInfrastructureWorkflowService.executeUpgradePlan(plan, []),
      /Missing required approval role/
    );

    // Succeeds with approval
    const receipt = UpgradeInfrastructureWorkflowService.executeUpgradePlan(plan, [
      { role: "INFRASTRUCTURE_OWNER", approverId: "devops_lead" },
      { role: "FINANCE_ADMIN", approverId: "cfo_user" },
    ]);
    assert.equal(receipt.status, "COMPLETED");
    assert.ok(receipt.stepsExecuted.length >= 5);
  });

  it("should enforce autoscaling scale-down protection for pending worker leases and account for AI repair retries in cost models", () => {
    // 1. Scale down blocked by active in-flight worker leases
    const autoscaleDecision = AutoscalingCostEconomicsService.evaluateAutoscaling({
      currentReplicas: 4,
      maxAllowedReplicas: 10,
      queueDepth: 0,
      cpuUtilizationPercent: 10,
      activeInFlightWorkerLeases: 3, // In flight!
    });
    assert.equal(autoscaleDecision.desiredReplicas, 4); // Did not scale down!
    assert.equal(autoscaleDecision.scaleDownBlockedDueToPendingLeases, true);

    // 2. Cost model accounts for failed repair attempts and retries
    const baseModel = AutoscalingCostEconomicsService.computeScenarioCostModel("BASE");
    assert.ok(baseModel.aiTokensAndRetriesUsd >= 32.0);
    assert.ok(baseModel.totalMonthlyEstimatedCostUsd > 150.0);
  });
});
