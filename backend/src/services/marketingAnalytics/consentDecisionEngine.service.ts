import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit.service.js";

export type ConsentStatus =
  | "GRANTED"
  | "REFUSED"
  | "WITHDRAWN"
  | "UNKNOWN"
  | "EXPIRED"
  | "NOT_APPLICABLE";

export interface VisitorConsentDecision {
  subjectId: string; // Hashed device identifier or session ID
  websiteId: string;
  status: ConsentStatus;
  policyVersion: string;
  purposes: {
    functional: boolean; // Always true
    analytics: boolean;
    marketing: boolean;
  };
  recordedAt: string;
  expiresAt: string;
  withdrawnAt?: string;
  provenance: {
    ipMasked?: string;
    userAgent?: string;
    uiPromptVersion: string;
  };
}

// In-memory store for visitor consent state
const consentDecisionStore = new Map<string, VisitorConsentDecision>();

// Queue of pending analytics events awaiting dispatch
const queuedAnalyticsEvents = new Map<string, Array<{ eventId: string; timestamp: string }>>();

export function recordConsentChoice(params: {
  subjectId: string;
  websiteId: string;
  status: "GRANTED" | "REFUSED";
  purposes: { analytics: boolean; marketing: boolean };
  policyVersion?: string;
  ipMasked?: string;
  userAgent?: string;
}): VisitorConsentDecision {
  const { subjectId, websiteId, status, purposes, policyVersion = "2026.1", ipMasked, userAgent } = params;

  const key = `${websiteId}:${subjectId}`;
  const now = new Date();
  const expires = new Date(now.getTime() + 180 * 24 * 3600 * 1000); // 180-day consent TTL

  const decision: VisitorConsentDecision = {
    subjectId,
    websiteId,
    status,
    policyVersion,
    purposes: {
      functional: true,
      analytics: status === "GRANTED" ? purposes.analytics : false,
      marketing: status === "GRANTED" ? purposes.marketing : false,
    },
    recordedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    provenance: {
      ipMasked,
      userAgent,
      uiPromptVersion: "banner-opt-in-v2",
    },
  };

  consentDecisionStore.set(key, decision);
  return decision;
}

/**
 * Handles explicit withdrawal of consent.
 * Immediately cancels queued events and halts future collection.
 */
export async function withdrawConsent(params: {
  subjectId: string;
  websiteId: string;
  reason?: string;
}): Promise<VisitorConsentDecision> {
  const { subjectId, websiteId, reason } = params;
  const key = `${websiteId}:${subjectId}`;
  const decision = consentDecisionStore.get(key);

  if (!decision) {
    throw new AppError("Consent record not found for subject", 404, "CONSENT_NOT_FOUND");
  }

  decision.status = "WITHDRAWN";
  decision.purposes.analytics = false;
  decision.purposes.marketing = false;
  decision.withdrawnAt = new Date().toISOString();

  // Purge any queued analytics events for this subject
  queuedAnalyticsEvents.delete(key);

  await recordAuditLog({
    userId: undefined,
    action: "CONSENT_WITHDRAWN",
    targetResource: `website:${websiteId}`,
    details: { subjectId, reason },
  });

  return decision;
}

/**
 * Checks whether optional analytics event dispatch is permitted.
 * Fails closed if status is UNKNOWN, REFUSED, WITHDRAWN, or EXPIRED.
 */
export function canDispatchAnalyticsEvent(
  websiteId: string,
  subjectId?: string
): { permitted: boolean; reason: string } {
  if (!subjectId) {
    return { permitted: false, reason: "Subject ID missing: fail-closed for anonymous tracking" };
  }

  const key = `${websiteId}:${subjectId}`;
  const decision = consentDecisionStore.get(key);

  if (!decision) {
    return { permitted: false, reason: "Consent state UNKNOWN: fail-closed" };
  }

  if (new Date(decision.expiresAt).getTime() < Date.now()) {
    return { permitted: false, reason: "Consent expired: fail-closed" };
  }

  if (decision.status !== "GRANTED" || !decision.purposes.analytics) {
    return { permitted: false, reason: `Consent is ${decision.status}: no-send enforced locally` };
  }

  return { permitted: true, reason: "Explicit consent verified" };
}
