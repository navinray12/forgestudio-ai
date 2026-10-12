/**
 * ForgeStudio Execution Blueprint v2.1 — Point 04: What Every Generated Website Must Contain
 * Truthful Claims and Evidence Engine
 *
 * Implements the Point 04 Truthful Claims & Evidence Reference Model:
 * - Distinguishes:
 *   1. Approved facts (verified facts provided by accountable organization)
 *   2. Claims with approved supporting evidence (citations, cert IDs, verified URLs)
 *   3. Claims awaiting review (unverified statements requiring human reviewer sign-off)
 *   4. Unsupported claims (statements lacking verifiable proof; forbidden from publishing)
 * - Prohibits inventing credentials, fake awards, false customer counts, or bogus testimonials.
 * - Enforces release-gating: Unreviewed or unsupported claims block public release.
 */

import { AppError } from "../../utils/app-error.js";
import { BusinessClaim, ClaimVerificationStatus } from "./websiteContract.js";

export type ClaimCategory =
  | "ORGANIZATION_IDENTITY"
  | "CREDENTIALS_AND_AWARDS"
  | "CUSTOMER_TESTIMONIAL"
  | "METRICS_AND_COUNTS"
  | "PRICING_AND_GUARANTEES"
  | "SERVICE_AND_DELIVERY"
  | "HEALTH_OR_FINANCIAL";

export interface DetailedBusinessClaim extends BusinessClaim {
  category: ClaimCategory;
  pageId?: string;
  sectionId?: string;
  evidenceType?: "DOCUMENT" | "THIRD_PARTY_REGISTRY" | "ACCREDITATION" | "CUSTOMER_SIGN_OFF";
  submittedBy?: string;
  auditTrail: Array<{
    action: "CREATED" | "EVIDENCE_LINKED" | "REVIEWED" | "STATUS_CHANGED";
    performedBy: string;
    timestamp: string;
    note?: string;
  }>;
}

export interface ClaimsReleaseValidationResult {
  canPublish: boolean;
  totalClaims: number;
  approvedCount: number;
  evidenceAttachedCount: number;
  awaitingReviewCount: number;
  unsupportedCount: number;
  blockers: string[];
}

/**
 * Validates a claim and determines its truthful verification status.
 */
export function evaluateClaimStatus(
  statement: string,
  category: ClaimCategory,
  evidenceReference?: string,
  isApprovedFact?: boolean,
  reviewedBy?: string
): ClaimVerificationStatus {
  // If explicitly provided by verified owner as an approved business fact
  if (isApprovedFact && reviewedBy) {
    return "APPROVED_FACT";
  }

  // If evidence reference is supplied and verified by a reviewer
  if (evidenceReference && evidenceReference.trim().length > 0 && reviewedBy) {
    return "EVIDENCE_ATTACHED";
  }

  // If evidence is attached but pending human review
  if (evidenceReference && evidenceReference.trim().length > 0) {
    return "AWAITING_REVIEW";
  }

  // Statement exists without evidence or approval
  if (statement.trim().length > 0) {
    return "UNSUPPORTED";
  }

  return "UNSUPPORTED";
}

/**
 * Creates a new managed claim with complete audit metadata.
 */
export function createManagedClaim(params: {
  id: string;
  statement: string;
  category: ClaimCategory;
  pageId?: string;
  sectionId?: string;
  evidenceReference?: string;
  evidenceType?: "DOCUMENT" | "THIRD_PARTY_REGISTRY" | "ACCREDITATION" | "CUSTOMER_SIGN_OFF";
  isApprovedFact?: boolean;
  creatorId: string;
}): DetailedBusinessClaim {
  const status = evaluateClaimStatus(
    params.statement,
    params.category,
    params.evidenceReference,
    params.isApprovedFact,
    params.isApprovedFact ? params.creatorId : undefined
  );

  const now = new Date().toISOString();

  return {
    id: params.id,
    statement: params.statement,
    category: params.category,
    status,
    pageId: params.pageId,
    sectionId: params.sectionId,
    evidenceReference: params.evidenceReference,
    evidenceType: params.evidenceType,
    reviewedBy: params.isApprovedFact ? params.creatorId : undefined,
    reviewedAt: params.isApprovedFact ? now : undefined,
    submittedBy: params.creatorId,
    auditTrail: [
      {
        action: "CREATED",
        performedBy: params.creatorId,
        timestamp: now,
        note: `Claim created with initial status ${status}`,
      },
    ],
  };
}

/**
 * Reviews an existing claim.
 * Only authorized reviewers can mark a claim APPROVED_FACT or EVIDENCE_ATTACHED.
 */
export function reviewClaim(
  claim: DetailedBusinessClaim,
  decision: "APPROVE" | "REJECT" | "REQUEST_EVIDENCE",
  reviewerId: string,
  note?: string
): DetailedBusinessClaim {
  const now = new Date().toISOString();

  let nextStatus: ClaimVerificationStatus = claim.status;

  if (decision === "APPROVE") {
    if (!claim.evidenceReference && claim.category !== "ORGANIZATION_IDENTITY") {
      throw new AppError(
        400,
        `Cannot approve claim '${claim.id}' in category '${claim.category}' without a valid evidence reference.`
      );
    }
    nextStatus = claim.evidenceReference ? "EVIDENCE_ATTACHED" : "APPROVED_FACT";
  } else if (decision === "REJECT") {
    nextStatus = "UNSUPPORTED";
  } else if (decision === "REQUEST_EVIDENCE") {
    nextStatus = "AWAITING_REVIEW";
  }

  return {
    ...claim,
    status: nextStatus,
    reviewedBy: reviewerId,
    reviewedAt: now,
    auditTrail: [
      ...claim.auditTrail,
      {
        action: "REVIEWED",
        performedBy: reviewerId,
        timestamp: now,
        note: note || `Review decision: ${decision} -> status ${nextStatus}`,
      },
    ],
  };
}

/**
 * Validates an array of claims prior to publishing a release.
 * Releases are strictly blocked if unsupported claims exist or
 * unreviewed claims remain without explicit override policy.
 */
export function validateClaimsForRelease(
  claims: BusinessClaim[],
  options: { allowUnreviewed?: boolean } = {}
): ClaimsReleaseValidationResult {
  const blockers: string[] = [];
  let approvedCount = 0;
  let evidenceAttachedCount = 0;
  let awaitingReviewCount = 0;
  let unsupportedCount = 0;

  for (const claim of claims) {
    switch (claim.status) {
      case "APPROVED_FACT":
        approvedCount++;
        break;
      case "EVIDENCE_ATTACHED":
        evidenceAttachedCount++;
        break;
      case "AWAITING_REVIEW":
        awaitingReviewCount++;
        if (!options.allowUnreviewed) {
          blockers.push(
            `Claim '${claim.id}' ("${claim.statement.substring(0, 50)}...") is awaiting review. Publication blocked under truthful claims policy.`
          );
        }
        break;
      case "UNSUPPORTED":
        unsupportedCount++;
        blockers.push(
          `Unsupported claim '${claim.id}' ("${claim.statement.substring(0, 50)}...") has no verified evidence or approval. Cannot publish unverified claims.`
        );
        break;
    }
  }

  return {
    canPublish: blockers.length === 0,
    totalClaims: claims.length,
    approvedCount,
    evidenceAttachedCount,
    awaitingReviewCount,
    unsupportedCount,
    blockers,
  };
}

/**
 * Scans generated block text to detect unverified statistical or credential claims
 * that might have been accidentally inserted without metadata backing.
 */
export function scanContentForUnbackedClaims(
  text: string
): Array<{ snippet: string; suspectedCategory: ClaimCategory; reason: string }> {
  const flags: Array<{ snippet: string; suspectedCategory: ClaimCategory; reason: string }> = [];

  // Patterns for statistics, percentages, large customer counts
  const countPattern = /\b(\d+(?:,\d+)*(?:\+)?|\d+%\s+(?:increase|guarantee|satisfaction))\s+(?:customers|clients|users|satisfaction|rating|reviews|uptime)/gi;
  let match;
  while ((match = countPattern.exec(text)) !== null) {
    flags.push({
      snippet: match[0],
      suspectedCategory: "METRICS_AND_COUNTS",
      reason: "Numeric metric or customer count detected. Must be backed by approved evidence.",
    });
  }

  // Patterns for awards and superlative badges
  const awardPattern = /\b(#1|voted best|award-winning|certified by|accredited by|guaranteed)\b/gi;
  while ((match = awardPattern.exec(text)) !== null) {
    flags.push({
      snippet: match[0],
      suspectedCategory: "CREDENTIALS_AND_AWARDS",
      reason: "Superlative claim or award detected. Must cite accredited reference.",
    });
  }

  return flags;
}
