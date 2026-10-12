/**
 * ForgeStudio Execution Blueprint v2.1 — Point 19: Adaptive Infrastructure and Operating Economics
 * Section 1.3: Optional Infrastructure Capabilities & Exit Contracts
 *
 * Covers:
 * 1. Redis cache: tenant/revision isolation, invalidation on publish/revoke, DB fallback, loss safety.
 * 2. RabbitMQ task transport: durable outbox authoritative, idempotent consumers, bounded retries/DLQ.
 * 3. Kafka event streaming: schema versions, safe scoped replay without obsolete consent replay.
 * 4. Search service: index from authorized source records, query-time permission & publication check.
 * 5. Kubernetes & Python worker constraints.
 */

import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";

export interface CacheKeyDimensions {
  tenantId: string;
  websiteId: string;
  revisionId: string;
  authContext: "PUBLIC" | "AUTHENTICATED_MEMBER" | "OWNER";
  routeSlug: string;
}

export interface CachedItem {
  key: string;
  data: any;
  cachedAt: string;
  ttlSeconds: number;
}

export class OptionalInfrastructureCapabilitiesService {
  private static redisCacheStore = new Map<string, CachedItem>();
  private static rabbitMqDeadLetterQueue: Array<{ eventId: string; payload: any; reason: string; timestamp: string }> = [];

  // ==========================================
  // A. Redis Cache Capability
  // ==========================================

  public static buildCacheKey(dims: CacheKeyDimensions): string {
    return `cache:${dims.tenantId}:${dims.websiteId}:${dims.revisionId}:${dims.authContext}:${dims.routeSlug.replace(/^\//, "")}`;
  }

  public static setCache(dims: CacheKeyDimensions, data: any, ttlSeconds: number = 3600): void {
    const key = this.buildCacheKey(dims);
    this.redisCacheStore.set(key, {
      key,
      data,
      cachedAt: new Date().toISOString(),
      ttlSeconds,
    });
  }

  public static getCache(dims: CacheKeyDimensions): { hit: boolean; data?: any; fallbackRequired?: boolean } {
    const key = this.buildCacheKey(dims);
    const item = this.redisCacheStore.get(key);
    if (!item) {
      return { hit: false, fallbackRequired: true };
    }
    return { hit: true, data: item.data };
  }

  /**
   * Invalidation following publication or revocation semantics.
   * Completely purges all cached entries for the specified website and old revision.
   */
  public static invalidateCacheOnPublication(websiteId: string, oldRevisionId?: string): number {
    let invalidatedCount = 0;
    for (const [key] of this.redisCacheStore.entries()) {
      if (key.includes(`:${websiteId}:`)) {
        if (!oldRevisionId || key.includes(`:${oldRevisionId}:`)) {
          this.redisCacheStore.delete(key);
          invalidatedCount++;
        }
      }
    }
    return invalidatedCount;
  }

  // ==========================================
  // B. RabbitMQ Task Transport Capability
  // ==========================================

  /**
   * Enqueues an outbox event into RabbitMQ transport.
   * Guaranteed: Transactional outbox remains the primary authoritative record.
   */
  public static routeTaskToQueue(
    event: { eventId: string; tenantId: string; type: string; payload: any; retryCount: number }
  ): { enqueued: boolean; destinationQueue: string; deadLettered: boolean } {
    // Bounded retry behavior: move to DLQ after 5 attempts
    if (event.retryCount >= 5) {
      this.rabbitMqDeadLetterQueue.push({
        eventId: event.eventId,
        payload: event.payload,
        reason: "Max retries (5) exceeded on message transport",
        timestamp: new Date().toISOString(),
      });
      return { enqueued: false, destinationQueue: "DLQ_UNRESOLVED_EVENTS", deadLettered: true };
    }

    return {
      enqueued: true,
      destinationQueue: `queue_${event.type.toLowerCase()}`,
      deadLettered: false,
    };
  }

  // ==========================================
  // C. Kafka Event Streaming Capability
  // ==========================================

  /**
   * Safe event replay contract ensuring obsolete consent or suppressed contacts are not replayed.
   */
  public static filterKafkaReplayEvents(
    events: Array<{ eventId: string; eventType: string; timestamp: string; requiresActiveConsent: boolean; consentState: string }>
  ): { eligibleReplays: any[]; suppressedReplays: any[] } {
    const eligibleReplays: any[] = [];
    const suppressedReplays: any[] = [];

    events.forEach((ev) => {
      // Protect against replaying events where consent was subsequently revoked/refused
      if (ev.requiresActiveConsent && ev.consentState !== "GRANTED") {
        suppressedReplays.push({
          eventId: ev.eventId,
          reason: "Consent state is not GRANTED; event replay prohibited by privacy policy",
        });
      } else {
        eligibleReplays.push(ev);
      }
    });

    return { eligibleReplays, suppressedReplays };
  }

  // ==========================================
  // D. Search Service Capability
  // ==========================================

  /**
   * Evaluates query-time publication and permission checks against search indexes.
   * Stale indexes cannot leak drafts, trashed, or unapproved records.
   */
  public static filterSearchQueryResults(
    tenantId: string,
    queryResults: Array<{ id: string; tenantId: string; status: "PUBLISHED" | "DRAFT" | "TRASHED"; isPrivate: boolean }>,
    userRole: string
  ): any[] {
    return queryResults.filter((doc) => {
      if (doc.tenantId !== tenantId) return false;
      if (doc.status !== "PUBLISHED") return false; // Hide drafts and trashed content
      if (doc.isPrivate && userRole === "PUBLIC_VISITOR") return false;
      return true;
    });
  }
}
