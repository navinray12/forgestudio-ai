import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  validateDomainBoundary,
} from "../services/marketingAnalytics/telemetryAnalyticsBoundary.service.js";

import {
  validateMeasurementEventPayload,
  inspectSerializedNetworkPayload,
} from "../services/marketingAnalytics/measurementEventContract.service.js";

import {
  recordConsentChoice,
  withdrawConsent,
  canDispatchAnalyticsEvent,
} from "../services/marketingAnalytics/consentDecisionEngine.service.js";

import { validateExposure } from "../services/marketingAnalytics/exposureValidator.service.js";

import {
  buildCampaignLink,
  freezeConversionAttribution,
} from "../services/marketingAnalytics/attributionEngine.service.js";

import { calculateTruthfulGrowthMetrics } from "../services/marketingAnalytics/truthfulMetricsEngine.service.js";

import {
  buildGoogleOfflineConversionPayload,
  buildMetaCapiEventPayload,
  dispatchProviderConversion,
} from "../services/marketingAnalytics/providerAdapters.service.js";

import { verifyGrowthActionGate } from "../services/marketingAnalytics/growthCapabilityGate.service.js";

describe("Point 13 — Marketing, Analytics and Truthful Conversion Evidence", () => {
  const websiteId = "site-analytics-test";
  const subjectId = "visitor-hash-123";

  it("should enforce domain boundaries and ensure business ledgers never depend on analytics consent", () => {
    // 1. Authoritative business ledger write is allowed WITHOUT analytics consent
    const ledgerCheck = validateDomainBoundary("AUTHORITATIVE_BUSINESS_LEDGER", false);
    assert.equal(ledgerCheck.allowed, true, "Business ledger must not require analytics consent");

    // 2. Operational telemetry is allowed WITHOUT consent
    const telemetryCheck = validateDomainBoundary("OPERATIONAL_TELEMETRY", false);
    assert.equal(telemetryCheck.allowed, true);

    // 3. Optional behavioral analytics is BLOCKED without consent
    const analyticsCheck = validateDomainBoundary("OPTIONAL_BEHAVIORAL_ANALYTICS", false);
    assert.equal(analyticsCheck.allowed, false);
  });

  it("should scrub prohibited PII and inspect serialized network payloads in measurement events", () => {
    // 1. Validate payload with prohibited keys & embedded PII
    const event = {
      eventName: "button_click",
      version: "1.0",
      purpose: "CTA interaction",
      routeId: "/pricing",
      timestamp: new Date().toISOString(),
      properties: {
        ctaName: "Start Free Trial",
        userEmail: "visitor@example.com", // Prohibited key and email value!
        contactPhone: "+15551234567",       // Prohibited key and phone value!
        buttonColor: "blue",
      },
    };

    const valResult = validateMeasurementEventPayload(event);
    assert.ok(valResult.violations.length >= 2, "Must flag PII violations");
    assert.equal(valResult.sanitizedProperties.ctaName, "Start Free Trial");
    assert.equal(valResult.sanitizedProperties.userEmail, undefined, "Email must be scrubbed");
    assert.equal(valResult.sanitizedProperties.contactPhone, undefined, "Phone must be scrubbed");

    // 2. Network payload inspector verifies outgoing JSON
    const dirtyJson = JSON.stringify({ event: "lead", email: "leaked@example.com" });
    const netCheck = inspectSerializedNetworkPayload(dirtyJson);
    assert.equal(netCheck.safe, false);
    assert.ok(netCheck.detectedLeakedPatterns.includes("LEAKED_EMAIL_PATTERN"));
  });

  it("should enforce fail-closed consent and handle immediate withdrawal", async () => {
    // 1. Unknown visitor: dispatch is blocked (fail-closed)
    const unknownCheck = canDispatchAnalyticsEvent(websiteId, "unknown-visitor-id");
    assert.equal(unknownCheck.permitted, false);
    assert.ok(unknownCheck.reason.includes("UNKNOWN"));

    // 2. Record explicit opt-in consent
    recordConsentChoice({
      subjectId,
      websiteId,
      status: "GRANTED",
      purposes: { analytics: true, marketing: true },
    });
    const grantedCheck = canDispatchAnalyticsEvent(websiteId, subjectId);
    assert.equal(grantedCheck.permitted, true);

    // 3. Withdraw consent
    await withdrawConsent({ subjectId, websiteId, reason: "Visitor opted out via footer" });
    const withdrawnCheck = canDispatchAnalyticsEvent(websiteId, subjectId);
    assert.equal(withdrawnCheck.permitted, false);
    assert.ok(withdrawnCheck.reason.includes("WITHDRAWN"));
  });

  it("should validate browser exposure correctness, rejecting bots and hidden tabs", () => {
    // Bot check
    const botCheck = validateExposure({
      route: "/home",
      visibilityState: "visible",
      userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)",
      continuousVisibleDurationMs: 5000,
    });
    assert.equal(botCheck.isVerifiedExposure, false);

    // Hidden tab check
    const hiddenCheck = validateExposure({
      route: "/home",
      visibilityState: "hidden",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      continuousVisibleDurationMs: 5000,
    });
    assert.equal(hiddenCheck.isVerifiedExposure, false);

    // Short exposure check (<1000ms)
    const shortCheck = validateExposure({
      route: "/home",
      visibilityState: "visible",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      continuousVisibleDurationMs: 400,
    });
    assert.equal(shortCheck.isVerifiedExposure, false);

    // Legitimate visible human exposure
    const validCheck = validateExposure({
      route: "/home",
      visibilityState: "visible",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      continuousVisibleDurationMs: 3500,
    });
    assert.equal(validCheck.isVerifiedExposure, true);
  });

  it("should normalize UTM parameters and freeze conversion-time attribution without fabricating direct", () => {
    const link = buildCampaignLink({
      baseUrl: "https://example.com/demo",
      utm: {
        source: "Newsletter ",
        medium: "Email ",
        campaign: "Autumn_Launch",
      },
    });
    assert.equal(link, "https://example.com/demo?utm_source=newsletter&utm_medium=email&utm_campaign=autumn_launch");

    // Frozen attribution without consent marks "REFUSED" (never fabricated as "direct")
    const refusedAttribution = freezeConversionAttribution({
      conversionId: "conv-1",
      websiteId,
      consentGranted: false,
    });
    assert.equal(refusedAttribution.firstTouch, "REFUSED");
    assert.equal(refusedAttribution.isDirectFallback, false);
  });

  it("should calculate truthful growth metrics respecting exact blueprint definitions", () => {
    const metrics = calculateTruthfulGrowthMetrics({
      eligibleMeasuredSessions: 100,
      sessionsWithAtLeastOneLead: 25,
      totalEligibleAcceptedLeads: 120, // Multiple leads from repeat submissions
      totalAuthoritativeBusinessLeads: 150, // Includes leads without analytics consent
      maturedCohortTotalLeads: 80,
      maturedCohortQualifiedLeads: 40,
    });

    // Binary rate is 25% (must be <= 100%)
    assert.equal(metrics.binarySessionConversionRate.value, 25);

    // Leads per session density is 120% (can exceed 100%)
    assert.equal(metrics.leadsPerSessionDensity.value, 120);

    // Business lead count includes all authoritative leads
    assert.equal(metrics.authoritativeBusinessLeadCount.value, 150);

    // Cohort qualification rate is 50%
    assert.equal(metrics.cohortQualificationRate.value, 50);
  });

  it("should build provider payloads with deduplication event_id and enforce growth gates", async () => {
    // 1. Meta CAPI payload contains event_id
    const metaPayload = buildMetaCapiEventPayload({
      eventId: "evt_lead_same_action_123",
      eventName: "Lead",
      eventTimeUnixSeconds: Math.floor(Date.now() / 1000),
      actionSource: "website",
      eventSourceUrl: "https://example.com/contact",
    });
    assert.equal(metaPayload.event_id, "evt_lead_same_action_123");

    // 2. Google offline conversion payload
    const googlePayload = buildGoogleOfflineConversionPayload({
      conversionActionId: "customers/123/conversionActions/456",
      gclid: "test_gclid_value",
      conversionTimeUtc: new Date().toISOString(),
    });
    assert.equal(googlePayload.gclid, "test_gclid_value");

    // 3. Provider conversion fails closed when credentials missing
    await assert.rejects(
      async () => {
        await dispatchProviderConversion({
          config: {
            provider: "GOOGLE_ADS",
            isConnected: false,
            credentialsConfigured: false,
            missingPrerequisites: ["Missing Google OAuth refresh token"],
          },
          eventId: "evt-123",
          payload: googlePayload,
        });
      },
      (err: any) => err.code === "PROVIDER_UNCONFIGURED",
      "Must reject unconfigured provider"
    );

    // 4. Growth capability gate
    const gateCheck = verifyGrowthActionGate({
      actionType: "CAMPAIGN_SPEND",
      enabledCapabilities: ["CAP-101"],
      operatorPermissions: ["perm:overview:view"], // Lacks perm:billing:override!
      consentGranted: true,
      providerConnected: true,
      budgetRemainingUnits: 500,
      requiredUnits: 100,
    });
    assert.equal(gateCheck.allowed, false);
    assert.ok(gateCheck.blockReason?.includes("perm:billing:override"));
  });
});
