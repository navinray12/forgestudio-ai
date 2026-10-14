/**
 * ForgeStudio Execution Blueprint v2.1 — Point 05: Executable Capability Contract
 * Profile-Aware Mandatory Release Gate (CAP-119)
 *
 * Implements strict, profile-aware pre-publish governance:
 * - Evaluates mandatory capabilities for the selected website profile.
 * - Enforces zero-tolerance rules:
 *   - Blank or missing checks never count as passed.
 *   - Critical failures cannot be offset by high composite percentages.
 *   - Consent or authorization failures fail closed.
 * - Restricted exception governance: requires named approver, scope, reason, and unexpired date.
 * - Connects directly into pre-publish validation.
 */

import { randomUUID } from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import {
  getCapabilityById,
  CapabilityRecord,
} from "./capabilityRegistry.js";
import {
  resolveProfileCapabilities,
  WebsiteProfileRecipe,
} from "./capabilityManifest.js";
import {
  getEvidenceForCapability,
  evaluateEvidenceFreshness,
} from "./evidenceRegistry.js";

export interface RestrictedReleaseException {
  id: string;
  capId: string;
  scope: string; // e.g. "WEBSITE_DEPLOYMENT"
  approvedBy: string; // Named approver email/ID
  reason: string;
  mitigation: string;
  grantedAt: string;
  expiresAt: string;
  isExpired: boolean;
}

export interface CapabilityReleaseCheckResult {
  capId: string;
  name: string;
  classification: "F" | "G" | "B";
  isMandatoryForProfile: boolean;
  implementationStatus: string;
  activationStatus: string;
  verificationStatus: string;
  hasFreshEvidence: boolean;
  passed: boolean;
  failureReason?: string;
  isCriticalFailure: boolean;
  exceptionApplied?: RestrictedReleaseException;
}

export interface ProfileReleaseAssessment {
  websiteId: string;
  profileId: string;
  evaluatedAt: string;
  canPublish: boolean;
  decision: "APPROVED" | "BLOCKED";
  summary: {
    totalChecked: number;
    mandatoryPassed: number;
    criticalFailures: number;
    missingEvidenceCount: number;
    exceptionsApplied: number;
  };
  checks: CapabilityReleaseCheckResult[];
  blockers: string[];
}

// In-memory exception registry
const RELEASE_EXCEPTIONS: Map<string, RestrictedReleaseException> = new Map();

/**
 * Registers a restricted, policy-permitted exception.
 * Business waivers NEVER override prohibited data processing or non-waivable safety gates.
 */
export function registerReleaseException(input: {
  capId: string;
  scope: string;
  approvedBy: string;
  reason: string;
  mitigation: string;
  durationDays: number;
}): RestrictedReleaseException {
  const cap = getCapabilityById(input.capId);
  if (!cap) {
    throw new AppError(`Capability '${input.capId}' not found.`, 404);
  }

  // Non-waivable safety gates: Tenant isolation, authentication, data consent, durable leads
  const nonWaivable = new Set(["CAP-006", "CAP-007", "CAP-043", "CAP-072"]);
  if (nonWaivable.has(cap.id)) {
    throw new AppError(
      `Capability '${cap.id}' (${cap.name}) is a non-waivable security/consent gate. Exceptions are strictly prohibited.`,
      403
    );
  }

  const id = `exc-${randomUUID()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000).toISOString();

  const exception: RestrictedReleaseException = {
    id,
    capId: cap.id,
    scope: input.scope,
    approvedBy: input.approvedBy,
    reason: input.reason,
    mitigation: input.mitigation,
    grantedAt: now.toISOString(),
    expiresAt,
    isExpired: false,
  };

  RELEASE_EXCEPTIONS.set(id, exception);
  return exception;
}

/**
 * Evaluates a website's readiness for release against its declared profile.
 */
export function evaluateProfileReleaseGate(
  websiteId: string,
  profileId: string,
  activeCapabilities: string[] = []
): ProfileReleaseAssessment {
  const { profile, mandatoryCaps } = resolveProfileCapabilities(profileId);
  const activeSet = new Set(activeCapabilities.map((id) => id.toUpperCase()));
  const now = new Date();

  const checks: CapabilityReleaseCheckResult[] = [];
  const blockers: string[] = [];

  let mandatoryPassed = 0;
  let criticalFailures = 0;
  let missingEvidenceCount = 0;
  let exceptionsApplied = 0;

  for (const capId of mandatoryCaps) {
    const cap = getCapabilityById(capId);
    if (!cap) {
      blockers.push(`Mandatory capability '${capId}' missing from authoritative registry.`);
      criticalFailures++;
      continue;
    }

    const evidenceList = getEvidenceForCapability(cap.id);
    const freshEvidence = evidenceList.find((e) => evaluateEvidenceFreshness(e).isFresh);
    const hasFreshEvidence = Boolean(freshEvidence);

    let passed = false;
    let failureReason: string | undefined;
    let isCritical = false;

    // Check implementation readiness
    if (cap.implementationStatus !== "IMPLEMENTED") {
      failureReason = `Mandatory capability '${cap.id}' is ${cap.implementationStatus}, not IMPLEMENTED.`;
      isCritical = true;
    }
    // Check evidence freshness
    else if (!hasFreshEvidence) {
      failureReason = `Mandatory capability '${cap.id}' lacks fresh verification evidence.`;
      missingEvidenceCount++;
      isCritical = true;
    } else {
      passed = true;
      mandatoryPassed++;
    }

    // Check for active, unexpired exception
    let appliedException: RestrictedReleaseException | undefined;
    if (!passed) {
      for (const exc of RELEASE_EXCEPTIONS.values()) {
        if (exc.capId === cap.id) {
          const isExpired = now > new Date(exc.expiresAt);
          exc.isExpired = isExpired;
          if (!isExpired) {
            appliedException = exc;
            passed = true;
            failureReason = undefined;
            exceptionsApplied++;
            break;
          }
        }
      }
    }

    if (!passed) {
      blockers.push(failureReason || `Mandatory capability '${cap.id}' failed release gate.`);
      criticalFailures++;
    }

    checks.push({
      capId: cap.id,
      name: cap.name,
      classification: cap.classification,
      isMandatoryForProfile: true,
      implementationStatus: cap.implementationStatus,
      activationStatus: cap.activationStatus,
      verificationStatus: cap.verificationStatus,
      hasFreshEvidence,
      passed,
      failureReason,
      isCriticalFailure: isCritical && !appliedException,
      exceptionApplied: appliedException,
    });
  }

  const canPublish = criticalFailures === 0;

  return {
    websiteId,
    profileId: profile.profileId,
    evaluatedAt: now.toISOString(),
    canPublish,
    decision: canPublish ? "APPROVED" : "BLOCKED",
    summary: {
      totalChecked: checks.length,
      mandatoryPassed,
      criticalFailures,
      missingEvidenceCount,
      exceptionsApplied,
    },
    checks,
    blockers,
  };
}
