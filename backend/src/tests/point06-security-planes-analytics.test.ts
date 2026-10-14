/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Test Suite 3: Security Planes Outage Resilience & Analytics Non-Starvation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { SecurityPlanesService } from "../services/authoritative/securityPlanes.service.js";
import { BusinessPolicyLedgerService } from "../services/authoritative/record5-business-ledgers.service.js";

test("Point 06 — Security Planes & Analytics Isolation Suite", async (t) => {
  t.beforeEach(() => {
    SecurityPlanesService.clearMemory();
    BusinessPolicyLedgerService.clearMemory();
  });

  await t.test("1. Control Plane Outage Invariant: Published static pages remain readable during control plane outages", async () => {
    const publishedHtml = "<html><body><h1>Published Static Website</h1></body></html>";

    // 1. Initially both control and delivery planes are operational
    const normalServe = await SecurityPlanesService.servePublishedPage({
      websiteId: "site-101",
      routePath: "/",
      publishedHtml,
    });
    assert.equal(normalServe.content, publishedHtml);
    assert.equal(normalServe.servedDuringControlPlaneOutage, false);

    // 2. Simulate complete control plane outage
    SecurityPlanesService.setControlPlaneState("OFFLINE");

    // 3. Delivery plane MUST CONTINUE serving published content seamlessly
    const outageServe = await SecurityPlanesService.servePublishedPage({
      websiteId: "site-101",
      routePath: "/",
      publishedHtml,
    });
    assert.equal(outageServe.content, publishedHtml);
    assert.equal(outageServe.servedDuringControlPlaneOutage, true, "Must serve published page even when control plane is OFFLINE");

    // 4. Planes health report reflects the outage accurately
    const planesStatus = SecurityPlanesService.getPlanesStatus();
    const controlPlane = planesStatus.find((p) => p.plane === "CONTROL_PLANE");
    const deliveryPlane = planesStatus.find((p) => p.plane === "DELIVERY_PLANE");

    assert.equal(controlPlane?.status, "OFFLINE");
    assert.equal(deliveryPlane?.status, "OPERATIONAL");
  });

  await t.test("2. Analytics Non-Starvation Invariant: Analytics queue saturation or failure never starves durable lead acceptance", async () => {
    // 1. Fill analytics queue to saturation (100 events)
    for (let i = 0; i < 100; i++) {
      SecurityPlanesService.enqueueAnalyticsEvent({
        eventId: `evt_${i}`,
        websiteId: "site-101",
        tenantId: "tenant-acme",
        eventType: "PAGE_VIEW",
        metadata: { path: `/page-${i}` },
        timestamp: new Date().toISOString(),
      });
    }

    const metricsBefore = SecurityPlanesService.getAnalyticsMetrics();
    assert.equal(metricsBefore.isSaturated, true, "Analytics queue must be saturated");

    // 2. Further analytics events are dropped under backpressure
    const overflowEvent = SecurityPlanesService.enqueueAnalyticsEvent({
      eventId: "evt_overflow",
      websiteId: "site-101",
      tenantId: "tenant-acme",
      eventType: "PAGE_VIEW",
      metadata: { path: "/overflow" },
      timestamp: new Date().toISOString(),
    });
    assert.equal(overflowEvent.enqueued, false);
    assert.equal(overflowEvent.dropped, true);

    // 3. High-Priority Business Lead Submission DURING full analytics saturation:
    const { lead, analyticsAccepted } = await SecurityPlanesService.submitCustomerLeadWithIsolatedAnalytics({
      websiteId: "site-101",
      tenantId: "tenant-acme",
      formId: "quote_form",
      idempotencyKey: "lead_high_priority_1",
      leadData: {
        customerName: "Acme Buyer",
        email: "buyer@acme.org",
        budget: 50000,
      },
      analyticsContext: {
        campaign: "google_search_q3",
      },
    });

    // 4. CRITICAL INVARIANT: The lead MUST be durably accepted!
    assert.equal(lead.status, "ACCEPTED_DURABLE", "Lead must be accepted with durable persistence");
    assert.equal(lead.contactEmail, "buyer@acme.org");
    assert.equal(analyticsAccepted, false, "Analytics was dropped due to saturation, but lead succeeded");
  });
});
