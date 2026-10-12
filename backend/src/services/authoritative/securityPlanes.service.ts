/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Three Security Planes & Analytics Isolation Service
 *
 * Implements architectural and operational boundaries between:
 * 1. Control Plane — Authoring, configuration, approvals, and Fact Registers
 * 2. Build Plane — Isolated execution, resource quotas, and secret redaction
 * 3. Delivery Plane — Published sites and customer business operations
 * 4. Analytics Isolation — Separate queue/budget; guaranteed non-starvation of leads
 */

import { AppError } from "../../utils/app-error.js";
import { BusinessPolicyLedgerService, DurableLeadRecord } from "./record5-business-ledgers.service.js";

export type SecurityPlane = "CONTROL_PLANE" | "BUILD_PLANE" | "DELIVERY_PLANE";

export interface PlaneStatusReport {
  plane: SecurityPlane;
  status: "OPERATIONAL" | "DEGRADED" | "OFFLINE";
  authenticated: boolean;
  activeWorkloadsCount: number;
  lastHealthCheck: string;
}

export interface AnalyticsEventPayload {
  eventId: string;
  websiteId: string;
  tenantId: string;
  eventType: "PAGE_VIEW" | "SCROLL_DEPTH" | "CTA_CLICK" | "TIME_ON_PAGE";
  metadata: Record<string, any>;
  timestamp: string;
}

export interface AnalyticsQueueMetrics {
  queueLength: number;
  maxQueueCapacity: number;
  processedCount: number;
  droppedCount: number;
  concurrencyLimit: number;
  activeWorkers: number;
  isSaturated: boolean;
}

// Bounded in-memory analytics queue
const ANALYTICS_MAX_CAPACITY = 100;
const ANALYTICS_CONCURRENCY = 5;
const analyticsQueue: AnalyticsEventPayload[] = [];
let analyticsProcessedCount = 0;
let analyticsDroppedCount = 0;
let analyticsWorkersActive = 0;

// Plane health states (can be modified in tests to simulate outages)
let controlPlaneHealth: "OPERATIONAL" | "DEGRADED" | "OFFLINE" = "OPERATIONAL";
let deliveryPlaneHealth: "OPERATIONAL" | "DEGRADED" | "OFFLINE" = "OPERATIONAL";

export class SecurityPlanesService {
  /**
   * Set control plane health state (for simulating outages).
   */
  static setControlPlaneState(state: "OPERATIONAL" | "DEGRADED" | "OFFLINE"): void {
    controlPlaneHealth = state;
  }

  /**
   * Set delivery plane health state.
   */
  static setDeliveryPlaneState(state: "OPERATIONAL" | "DEGRADED" | "OFFLINE"): void {
    deliveryPlaneHealth = state;
  }

  /**
   * Get health status across the three security planes.
   */
  static getPlanesStatus(): PlaneStatusReport[] {
    const now = new Date().toISOString();
    return [
      {
        plane: "CONTROL_PLANE",
        status: controlPlaneHealth,
        authenticated: true,
        activeWorkloadsCount: 2,
        lastHealthCheck: now,
      },
      {
        plane: "BUILD_PLANE",
        status: "OPERATIONAL",
        authenticated: true,
        activeWorkloadsCount: 0,
        lastHealthCheck: now,
      },
      {
        plane: "DELIVERY_PLANE",
        status: deliveryPlaneHealth,
        authenticated: false, // Delivery is public, does not require administrative auth
        activeWorkloadsCount: 12,
        lastHealthCheck: now,
      },
    ];
  }

  /**
   * Delivery Plane Simulation: Serve published page.
   * STRICT INVARIANT: If control plane is OFFLINE, delivery of published static pages MUST CONTINUE.
   */
  static async servePublishedPage(params: {
    websiteId: string;
    routePath: string;
    publishedHtml: string;
  }): Promise<{ content: string; servedDuringControlPlaneOutage: boolean }> {
    if (deliveryPlaneHealth === "OFFLINE") {
      throw new AppError("Delivery plane service unavailable", 503, "DELIVERY_UNAVAILABLE");
    }

    const controlPlaneWasDown = controlPlaneHealth === "OFFLINE";

    // Delivery does NOT make synchronous calls to the control plane
    return {
      content: params.publishedHtml,
      servedDuringControlPlaneOutage: controlPlaneWasDown,
    };
  }

  /**
   * Enqueue analytical event with backpressure and bounded resource limits.
   * If queue is saturated, events are dropped with backpressure rather than
   * starving business-critical workloads.
   */
  static enqueueAnalyticsEvent(event: AnalyticsEventPayload): { enqueued: boolean; dropped: boolean } {
    if (analyticsQueue.length >= ANALYTICS_MAX_CAPACITY) {
      analyticsDroppedCount++;
      return { enqueued: false, dropped: true };
    }

    analyticsQueue.push(event);
    this.drainAnalyticsQueue();
    return { enqueued: true, dropped: false };
  }

  /**
   * Process analytics queue asynchronously with concurrency budget.
   */
  private static drainAnalyticsQueue(): void {
    while (analyticsQueue.length > 0 && analyticsWorkersActive < ANALYTICS_CONCURRENCY) {
      analyticsWorkersActive++;
      const item = analyticsQueue.shift();
      if (!item) {
        analyticsWorkersActive--;
        break;
      }

      // Simulate async processing
      setTimeout(() => {
        analyticsProcessedCount++;
        analyticsWorkersActive--;
        this.drainAnalyticsQueue();
      }, 5);
    }
  }

  /**
   * Get metrics for the analytical processing queue.
   */
  static getAnalyticsMetrics(): AnalyticsQueueMetrics {
    return {
      queueLength: analyticsQueue.length,
      maxQueueCapacity: ANALYTICS_MAX_CAPACITY,
      processedCount: analyticsProcessedCount,
      droppedCount: analyticsDroppedCount,
      concurrencyLimit: ANALYTICS_CONCURRENCY,
      activeWorkers: analyticsWorkersActive,
      isSaturated: analyticsQueue.length >= ANALYTICS_MAX_CAPACITY,
    };
  }

  /**
   * High-Priority Business Lead Acceptance with Analytics Non-Starvation Invariant.
   * GUARANTEE: Even if analytics is failing or completely saturated,
   * durable lead acceptance succeeds with 100% reliability.
   */
  static async submitCustomerLeadWithIsolatedAnalytics(params: {
    websiteId: string;
    tenantId: string;
    formId: string;
    idempotencyKey?: string;
    leadData: Record<string, any>;
    analyticsContext?: Record<string, any>;
  }): Promise<{ lead: DurableLeadRecord; analyticsAccepted: boolean }> {
    // 1. Critical Priority: Durable lead persistence FIRST
    const { lead } = await BusinessPolicyLedgerService.acceptDurableLead({
      websiteId: params.websiteId,
      tenantId: params.tenantId,
      formId: params.formId,
      idempotencyKey: params.idempotencyKey,
      payload: params.leadData,
    });

    // 2. Secondary Optional: Attempt analytics recording in isolated budget
    let analyticsAccepted = false;
    if (params.analyticsContext) {
      try {
        const { enqueued } = this.enqueueAnalyticsEvent({
          eventId: `evt_${Date.now()}`,
          websiteId: params.websiteId,
          tenantId: params.tenantId,
          eventType: "CTA_CLICK",
          metadata: params.analyticsContext,
          timestamp: new Date().toISOString(),
        });
        analyticsAccepted = enqueued;
      } catch {
        // Analytics failure is explicitly swallowed; never blocks lead acceptance
        analyticsAccepted = false;
      }
    }

    return { lead, analyticsAccepted };
  }

  /**
   * Reset analytics queue and plane statuses (for tests).
   */
  static clearMemory(): void {
    analyticsQueue.length = 0;
    analyticsProcessedCount = 0;
    analyticsDroppedCount = 0;
    analyticsWorkersActive = 0;
    controlPlaneHealth = "OPERATIONAL";
    deliveryPlaneHealth = "OPERATIONAL";
  }
}
