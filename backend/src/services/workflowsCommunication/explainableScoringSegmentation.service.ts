/**
 * ForgeStudio Execution Blueprint v2.1 — Point 15: Workflows, Communication, Experiments and Contextual Chat
 * Section 1.5: Explainable Scoring and Segmentation
 *
 * Rules:
 * 1. Versioned, explainable lead/contact scoring.
 * 2. Inputs & provenance recorded with rule versions and weights.
 * 3. Repeat-action caps prevent score inflation.
 * 4. Missing analytics / refused consent represented as UNKNOWN or NOT_COLLECTED, not as low interest.
 * 5. Bounded segmentation queries with tenant scoping and strict limits.
 * 6. Predictive scoring requires an approved capability gate.
 */

import { AppError } from "../../utils/app-error.js";

export interface ScoreRule {
  ruleId: string;
  name: string;
  weight: number;
  maxPointsAllowed: number; // repeat-action cap
  criterion: string;
}

export interface ScoreFactorExplanation {
  ruleId: string;
  ruleName: string;
  inputDescription: string;
  provenance: "FIRST_PARTY_FORM" | "TRANSACTIONAL_LEDGER" | "BEHAVIORAL_ANALYTICS" | "UNKNOWN_NOT_COLLECTED";
  weight: number;
  occurrencesObserved: number;
  pointsContributed: number;
  capped: boolean;
}

export interface LeadScoreResult {
  leadId: string;
  tenantId: string;
  scoreVersion: number;
  totalScore: number;
  confidence: "HIGH" | "MEDIUM" | "LOW_DUE_TO_UNCOLLECTED_DATA";
  missingDataClassification: "NOT_COLLECTED_REFUSED_CONSENT" | "COMPLETE";
  calculatedAt: string;
  factors: ScoreFactorExplanation[];
  manualOverride?: {
    overriddenScore: number;
    actorId: string;
    reason: string;
    timestamp: string;
  };
}

export interface SegmentFilterRule {
  field: "status" | "score" | "city" | "intent" | "createdDaysAgo";
  operator: "EQUALS" | "GREATER_THAN" | "LESS_THAN" | "IN";
  value: any;
}

export interface SegmentDefinition {
  segmentId: string;
  tenantId: string;
  name: string;
  filters: SegmentFilterRule[];
  maxLimit: number; // bounded limit
}

export class ExplainableScoringSegmentation {
  private static scoreRules: ScoreRule[] = [
    {
      ruleId: "RULE_FORM_SUBMITTED",
      name: "High-Intent Form Submission",
      weight: 40,
      maxPointsAllowed: 40,
      criterion: "Submitted high-value quote request form",
    },
    {
      ruleId: "RULE_BUSINESS_EMAIL",
      name: "Corporate Domain Email",
      weight: 20,
      maxPointsAllowed: 20,
      criterion: "Email domain is not a free public provider",
    },
    {
      ruleId: "RULE_REPEAT_ENGAGEMENT",
      name: "Repeat Enquiry",
      weight: 15,
      maxPointsAllowed: 30, // capped at 2 repeats
      criterion: "Multiple inquiries submitted across 30 days",
    },
    {
      ruleId: "RULE_PHONE_VERIFIED",
      name: "Valid Phone Provided",
      weight: 15,
      maxPointsAllowed: 15,
      criterion: "Provided valid E.164 phone number",
    },
  ];

  /**
   * Computes an explainable score for a lead without penalizing refused analytics consent.
   */
  public static computeLeadScore(
    tenantId: string,
    leadId: string,
    leadData: {
      hasFormSubmission: boolean;
      email?: string;
      repeatInquiryCount?: number;
      hasPhone?: boolean;
      analyticsConsentStatus: "GRANTED" | "REFUSED" | "UNKNOWN";
    }
  ): LeadScoreResult {
    const factors: ScoreFactorExplanation[] = [];
    let runningScore = 0;

    // Factor 1: Form submission
    if (leadData.hasFormSubmission) {
      factors.push({
        ruleId: "RULE_FORM_SUBMITTED",
        ruleName: "High-Intent Form Submission",
        inputDescription: "Valid form submission recorded in Record 5",
        provenance: "FIRST_PARTY_FORM",
        weight: 40,
        occurrencesObserved: 1,
        pointsContributed: 40,
        capped: false,
      });
      runningScore += 40;
    }

    // Factor 2: Corporate email
    const email = leadData.email || "";
    const isFreeDomain = /@(gmail|yahoo|hotmail|outlook|aol)\.com$/i.test(email);
    if (email && !isFreeDomain) {
      factors.push({
        ruleId: "RULE_BUSINESS_EMAIL",
        ruleName: "Corporate Domain Email",
        inputDescription: `Work domain detected: ${email.split("@")[1]}`,
        provenance: "FIRST_PARTY_FORM",
        weight: 20,
        occurrencesObserved: 1,
        pointsContributed: 20,
        capped: false,
      });
      runningScore += 20;
    }

    // Factor 3: Repeat inquiry with repeat cap
    const repeats = leadData.repeatInquiryCount || 0;
    if (repeats > 0) {
      const rawPoints = repeats * 15;
      const cappedPoints = Math.min(rawPoints, 30);
      factors.push({
        ruleId: "RULE_REPEAT_ENGAGEMENT",
        ruleName: "Repeat Enquiry",
        inputDescription: `${repeats} repeated inquiries observed`,
        provenance: "TRANSACTIONAL_LEDGER",
        weight: 15,
        occurrencesObserved: repeats,
        pointsContributed: cappedPoints,
        capped: rawPoints > cappedPoints,
      });
      runningScore += cappedPoints;
    }

    // Factor 4: Valid phone
    if (leadData.hasPhone) {
      factors.push({
        ruleId: "RULE_PHONE_VERIFIED",
        ruleName: "Valid Phone Provided",
        inputDescription: "Direct phone contact provided",
        provenance: "FIRST_PARTY_FORM",
        weight: 15,
        occurrencesObserved: 1,
        pointsContributed: 15,
        capped: false,
      });
      runningScore += 15;
    }

    // Missing analytics / refusal handling: explicitly represented, NEVER penalized
    const isConsentMissing = leadData.analyticsConsentStatus !== "GRANTED";
    if (isConsentMissing) {
      factors.push({
        ruleId: "NOTE_ANALYTICS_ABSENT",
        ruleName: "Optional Analytics Not Collected",
        inputDescription: "Visitor refused or has not provided behavioral tracking consent",
        provenance: "UNKNOWN_NOT_COLLECTED",
        weight: 0,
        occurrencesObserved: 0,
        pointsContributed: 0,
        capped: false,
      });
    }

    return {
      leadId,
      tenantId,
      scoreVersion: 1,
      totalScore: runningScore,
      confidence: isConsentMissing ? "LOW_DUE_TO_UNCOLLECTED_DATA" : "HIGH",
      missingDataClassification: isConsentMissing ? "NOT_COLLECTED_REFUSED_CONSENT" : "COMPLETE",
      calculatedAt: new Date().toISOString(),
      factors,
    };
  }

  /**
   * Bounded segmentation query execution with tenant isolation and strict limits.
   */
  public static executeBoundedSegmentQuery(
    segment: SegmentDefinition,
    candidateLeads: Array<Record<string, any>>
  ): { matchedLeads: Array<Record<string, any>>; totalCount: number; truncated: boolean } {
    // Enforce tenant scoping
    const tenantLeads = candidateLeads.filter((l) => l.tenantId === segment.tenantId);

    // Apply filters
    const matched = tenantLeads.filter((lead) => {
      for (const filter of segment.filters) {
        const val = lead[filter.field];
        if (filter.operator === "EQUALS" && val !== filter.value) return false;
        if (filter.operator === "GREATER_THAN" && (val === undefined || val <= filter.value)) return false;
        if (filter.operator === "LESS_THAN" && (val === undefined || val >= filter.value)) return false;
        if (filter.operator === "IN" && (!Array.isArray(filter.value) || !filter.value.includes(val))) return false;
      }
      return true;
    });

    const maxLimit = Math.min(segment.maxLimit || 100, 500); // hard ceiling of 500
    const truncated = matched.length > maxLimit;
    const boundedResults = matched.slice(0, maxLimit);

    return {
      matchedLeads: boundedResults,
      totalCount: matched.length,
      truncated,
    };
  }
}
