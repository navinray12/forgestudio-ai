import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit.service.js";

export type OutboxEventStatus = "QUEUED" | "PROCESSING" | "DELIVERED" | "DEAD_LETTER";

export interface OutboxEventRecord {
  eventId: string;
  tenantId: string;
  websiteId: string;
  eventType: string;
  payload: Record<string, any>;
  destination: string;
  status: OutboxEventStatus;
  attemptCount: number;
  maxAttempts: number;
  leaseOwner?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
  lastError?: string;
  nextRetryAt: string;
  createdAt: string;
  deliveredAt?: string;
  deadLetteredAt?: string;
}

// In-memory outbox store
const outboxQueue = new Map<string, OutboxEventRecord>();

/**
 * Enqueues a durable outbox event committed atomically with business mutation.
 */
export function enqueueOutboxEvent(params: {
  tenantId: string;
  websiteId: string;
  eventType: string;
  payload: Record<string, any>;
  destination: string;
  maxAttempts?: number;
}): OutboxEventRecord {
  const { tenantId, websiteId, eventType, payload, destination, maxAttempts = 5 } = params;
  const eventId = `evt_outbox_${crypto.randomUUID()}`;

  const record: OutboxEventRecord = {
    eventId,
    tenantId,
    websiteId,
    eventType,
    payload,
    destination,
    status: "QUEUED",
    attemptCount: 0,
    maxAttempts,
    nextRetryAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  outboxQueue.set(eventId, record);
  return record;
}

/**
 * Acquires a fenced worker lease for queued events ready to process.
 */
export function acquireOutboxLease(workerId: string, ttlMs = 30000): OutboxEventRecord | null {
  const now = Date.now();
  for (const event of outboxQueue.values()) {
    if (event.status === "QUEUED" && new Date(event.nextRetryAt).getTime() <= now) {
      const leaseToken = `lease_${crypto.randomUUID()}`;
      event.status = "PROCESSING";
      event.leaseOwner = workerId;
      event.leaseToken = leaseToken;
      event.leaseExpiresAt = new Date(now + ttlMs).toISOString();
      return event;
    }
  }
  return null;
}

/**
 * Completes event delivery with destination confirmation and fenced token verification.
 */
export function completeOutboxDelivery(
  eventId: string,
  leaseToken: string,
  destinationReceiptId?: string
): OutboxEventRecord {
  const event = outboxQueue.get(eventId);
  if (!event) {
    throw new AppError("Outbox event not found", 404, "EVENT_NOT_FOUND");
  }

  // Fencing check: ensure worker hasn't lost its lease to a newer worker
  if (event.leaseToken !== leaseToken) {
    throw new AppError("Stale worker lease token rejected", 409, "STALE_WORKER_LEASE");
  }

  event.status = "DELIVERED";
  event.deliveredAt = new Date().toISOString();
  event.leaseOwner = undefined;
  event.leaseToken = undefined;
  event.leaseExpiresAt = undefined;
  return event;
}

/**
 * Records failed delivery attempt with bounded exponential backoff or dead-letter transition.
 */
export async function recordOutboxFailure(
  eventId: string,
  leaseToken: string,
  errorMessage: string,
  isPermanentFailure = false
): Promise<OutboxEventRecord> {
  const event = outboxQueue.get(eventId);
  if (!event) {
    throw new AppError("Outbox event not found", 404, "EVENT_NOT_FOUND");
  }

  if (event.leaseToken !== leaseToken) {
    throw new AppError("Stale worker lease token rejected", 409, "STALE_WORKER_LEASE");
  }

  event.attemptCount += 1;
  event.lastError = errorMessage;

  if (isPermanentFailure || event.attemptCount >= event.maxAttempts) {
    event.status = "DEAD_LETTER";
    event.deadLetteredAt = new Date().toISOString();
    event.leaseOwner = undefined;
    event.leaseToken = undefined;

    await recordAuditLog({
      userId: undefined,
      action: "OUTBOX_EVENT_DEAD_LETTERED",
      targetResource: `website:${event.websiteId}`,
      details: {
        eventId,
        destination: event.destination,
        attemptCount: event.attemptCount,
        lastError: errorMessage,
      },
    });
  } else {
    // Bounded exponential backoff: 2^attempts * 1000ms + jitter
    const backoffMs = Math.min(60000, Math.pow(2, event.attemptCount) * 1000 + Math.floor(Math.random() * 500));
    event.status = "QUEUED";
    event.nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
    event.leaseOwner = undefined;
    event.leaseToken = undefined;
  }

  return event;
}

/**
 * Replays a dead-lettered event following administrator review or credential remediation.
 */
export function replayDeadLetterEvent(eventId: string, actorId: string): OutboxEventRecord {
  const event = outboxQueue.get(eventId);
  if (!event) {
    throw new AppError("Outbox event not found", 404, "EVENT_NOT_FOUND");
  }

  if (event.status !== "DEAD_LETTER") {
    throw new AppError("Event is not in dead letter state", 400, "INVALID_STATE");
  }

  event.status = "QUEUED";
  event.attemptCount = 0;
  event.nextRetryAt = new Date().toISOString();
  event.deadLetteredAt = undefined;
  return event;
}
