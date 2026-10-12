import { AppError } from "../../utils/app-error.js";

export type DataDomain =
  | "OPERATIONAL_TELEMETRY"      // Service health, job runner status, error logs, audit trail
  | "OPTIONAL_BEHAVIORAL_ANALYTICS" // Visitor events, pageviews, campaign touches, click IDs
  | "AUTHORITATIVE_BUSINESS_LEDGER"; // Accepted leads, customer transactions, legal consent records

export interface DataIngestionPolicy {
  domain: DataDomain;
  requiresConsent: boolean;
  canBlockBusinessWorkflows: boolean;
  retentionDays: number;
}

export const DOMAIN_POLICIES: Record<DataDomain, DataIngestionPolicy> = {
  OPERATIONAL_TELEMETRY: {
    domain: "OPERATIONAL_TELEMETRY",
    requiresConsent: false, // Essential system stability & security logging
    canBlockBusinessWorkflows: false,
    retentionDays: 90,
  },
  OPTIONAL_BEHAVIORAL_ANALYTICS: {
    domain: "OPTIONAL_BEHAVIORAL_ANALYTICS",
    requiresConsent: true, // Must be governed by explicit opt-in consent
    canBlockBusinessWorkflows: false, // Invariant: Failure or refusal can NEVER block lead submission!
    retentionDays: 365,
  },
  AUTHORITATIVE_BUSINESS_LEDGER: {
    domain: "AUTHORITATIVE_BUSINESS_LEDGER",
    requiresConsent: false, // Core transactional processing for customer-requested actions
    canBlockBusinessWorkflows: true, // Fails atomic boundary if durable write fails
    retentionDays: 2555, // 7-year statutory retention for business records
  },
};

/**
 * Validates domain boundary rules.
 * Enforces that optional analytics is never used as prerequisite or authoritative source for leads.
 */
export function validateDomainBoundary(domain: DataDomain, hasConsent: boolean): { allowed: boolean; reason?: string } {
  const policy = DOMAIN_POLICIES[domain];
  if (policy.requiresConsent && !hasConsent) {
    return {
      allowed: false,
      reason: `Data domain '${domain}' requires explicit visitor consent prior to ingestion`,
    };
  }
  return { allowed: true };
}
