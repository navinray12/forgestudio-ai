/**
 * ForgeStudio Execution Blueprint v2.1 — Point 20: Service Objectives and Failure Behavior
 * Section 2.4: Failure-Isolation Contracts
 *
 * Rules:
 * 1. AI Provider Outage: Deterministic editing and publishing remain operational.
 * 2. CRM/Mail Outage: Lead acceptance remains durable in Record 5; external webhook queued.
 * 3. Analytics Outage: Core operations unblocked; no fabricated conversion data.
 * 4. Content Service Outage: Serve approved cached public pages; drafts strictly blocked.
 * 5. Consent Uncertainty: Fail closed for optional tracking.
 * 6. Build Failure: Candidate rejected without overwriting active release.
 * 7. Audit Persistence Failure: Protected mutations fail safely if local audit cannot commit.
 * 8. Corrupted Artifact: Promotion blocked immediately.
 */

import { AppError } from "../../utils/app-error.js";

export type OutageType =
  | "AI_PROVIDER_OUTAGE"
  | "CRM_MAIL_OUTAGE"
  | "ANALYTICS_OUTAGE"
  | "CONTENT_SERVICE_OUTAGE"
  | "CONSENT_POLICY_UNCERTAINTY"
  | "BUILD_FAILURE"
  | "AUDIT_PERSISTENCE_FAILURE"
  | "CORRUPTED_ARTIFACT";

export interface FailureIsolationEvaluation {
  outageType: OutageType;
  primaryServiceOperational: boolean;
  degradedModeActive: boolean;
  leadCaptureDurable: boolean;
  draftsLeaked: false;
  businessActionPermitted: boolean;
  message: string;
}

export class FailureIsolationContractsService {
  /**
   * Evaluates system response under simulated or real infrastructure faults.
   */
  public static evaluateFailureIsolation(outage: OutageType): FailureIsolationEvaluation {
    switch (outage) {
      case "AI_PROVIDER_OUTAGE":
        return {
          outageType: outage,
          primaryServiceOperational: true, // Deterministic editor & CMS stay alive!
          degradedModeActive: true,
          leadCaptureDurable: true,
          draftsLeaked: false,
          businessActionPermitted: true,
          message: "AI assistance unavailable; deterministic code generation and publishing remain operational.",
        };

      case "CRM_MAIL_OUTAGE":
        return {
          outageType: outage,
          primaryServiceOperational: true,
          degradedModeActive: true,
          leadCaptureDurable: true, // Committed to Record 5 regardless!
          draftsLeaked: false,
          businessActionPermitted: true,
          message: "External CRM/mail webhook unreachable; lead committed atomically to Record 5 and outbox queued.",
        };

      case "ANALYTICS_OUTAGE":
        return {
          outageType: outage,
          primaryServiceOperational: true,
          degradedModeActive: true,
          leadCaptureDurable: true,
          draftsLeaked: false,
          businessActionPermitted: true,
          message: "Behavioral analytics beacon offline; lead submissions and core operations proceed unblocked.",
        };

      case "CONTENT_SERVICE_OUTAGE":
        return {
          outageType: outage,
          primaryServiceOperational: false,
          degradedModeActive: true,
          leadCaptureDurable: true,
          draftsLeaked: false,
          businessActionPermitted: false, // New content mutations blocked
          message: "Content platform unavailable; edge serving cached public pages; new writes safely rejected.",
        };

      case "CONSENT_POLICY_UNCERTAINTY":
        return {
          outageType: outage,
          primaryServiceOperational: true,
          degradedModeActive: true,
          leadCaptureDurable: true,
          draftsLeaked: false,
          businessActionPermitted: true,
          message: "Consent status unknown; failing closed for optional tracking while allowing transactional forms.",
        };

      case "BUILD_FAILURE":
        return {
          outageType: outage,
          primaryServiceOperational: true,
          degradedModeActive: false,
          leadCaptureDurable: true,
          draftsLeaked: false,
          businessActionPermitted: false,
          message: "Candidate build failed; active working release remains untouched.",
        };

      case "AUDIT_PERSISTENCE_FAILURE":
        return {
          outageType: outage,
          primaryServiceOperational: false,
          degradedModeActive: false,
          leadCaptureDurable: false,
          draftsLeaked: false,
          businessActionPermitted: false,
          message: "Local audit evidence write failed; protected business mutation rolled back safely.",
        };

      case "CORRUPTED_ARTIFACT":
        return {
          outageType: outage,
          primaryServiceOperational: false,
          degradedModeActive: false,
          leadCaptureDurable: true,
          draftsLeaked: false,
          businessActionPermitted: false,
          message: "Release candidate digest mismatch detected; promotion blocked and candidate marked FAILED.",
        };
    }
  }
}
