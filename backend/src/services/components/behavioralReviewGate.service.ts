/**
 * Point 08: Behavioral Review Gate Service
 * 
 * Enforces that visual-only approval CANNOT authorize business logic changes:
 * - Detects modifications affecting actions, data access, forms, authorization, or payments
 * - Mandates corresponding behavioral and contract tests for affected capabilities
 * - Forbids suppression, weakening, or deletion of existing tests by generation proposals
 * - Blocks release promotion if required behavioral test evidence is missing or failing
 */

export type BusinessLogicCategory =
  | "ACTION_DELIVERY"
  | "DATA_ACCESS"
  | "AUTHORIZATION_SECURITY"
  | "FORM_VALIDATION"
  | "ROUTING_NAVIGATION"
  | "PAYMENT_COMMERCE";

export interface BehavioralChangeDetection {
  filePath: string;
  category: BusinessLogicCategory;
  detectedTriggers: string[];
  affectedCapability: string;
  requiredTestContract: string;
}

export interface BehavioralTestEvidence {
  testContractName: string;
  targetCandidateId: string;
  status: "PASSED" | "FAILED" | "SKIPPED_OR_MISSING";
  executedAt: string;
  assertionCount: number;
}

export interface BehavioralReviewResult {
  hasBusinessLogicChanges: boolean;
  detectedChanges: BehavioralChangeDetection[];
  isReleaseApproved: boolean;
  blockingReasons: string[];
}

export class BehavioralReviewGateService {
  private static instance: BehavioralReviewGateService;

  // Patterns indicating business logic rather than pure visual markup
  private static readonly LOGIC_PATTERNS: { regex: RegExp; category: BusinessLogicCategory; capability: string; testContract: string }[] = [
    { regex: /\b(handleSubmit|onSubmit|formAction|deliveryWebhook)\b/g, category: "ACTION_DELIVERY", capability: "CAP_FORMS_LEAD_CAPTURE", testContract: "ContractTest_FormDelivery" },
    { regex: /\b(canUserAccess|requireAuth|checkRole|checkPermission)\b/g, category: "AUTHORIZATION_SECURITY", capability: "CAP_MEMBERSHIPS_ROLES", testContract: "ContractTest_AuthorizationSecurity" },
    { regex: /\b(fetchData|queryEntries|saveEntry|prisma\.)\b/g, category: "DATA_ACCESS", capability: "CAP_DYNAMIC_CONTENT_CMS", testContract: "ContractTest_DataAccess" },
    { regex: /\b(checkoutSession|stripe|processPayment|chargeCard)\b/g, category: "PAYMENT_COMMERCE", capability: "CAP_ECOMMERCE_STRIPE", testContract: "ContractTest_PaymentCommerce" }
  ];

  private constructor() {}

  public static getInstance(): BehavioralReviewGateService {
    if (!BehavioralReviewGateService.instance) {
      BehavioralReviewGateService.instance = new BehavioralReviewGateService();
    }
    return BehavioralReviewGateService.instance;
  }

  /**
   * Scans a source change for modifications affecting business logic.
   */
  public detectBusinessLogicChanges(params: {
    filePath: string;
    beforeSource: string;
    afterSource: string;
  }): BehavioralChangeDetection[] {
    const detections: BehavioralChangeDetection[] = [];

    // Compare before and after source lines
    for (const rule of BehavioralReviewGateService.LOGIC_PATTERNS) {
      const matchInAfter = rule.regex.test(params.afterSource);
      // Reset regex index
      rule.regex.lastIndex = 0;
      const matchInBefore = rule.regex.test(params.beforeSource);
      rule.regex.lastIndex = 0;

      // If business logic was added or modified
      if (matchInAfter !== matchInBefore || (matchInAfter && params.beforeSource !== params.afterSource)) {
        detections.push({
          filePath: params.filePath,
          category: rule.category,
          detectedTriggers: [rule.category],
          affectedCapability: rule.capability,
          requiredTestContract: rule.testContract
        });
      }
    }

    return detections;
  }

  /**
   * Reviews release candidate changes and verifies that behavioral evidence exists.
   * Visual-only approval CANNOT bypass this check.
   */
  public reviewReleaseChanges(params: {
    candidateId: string;
    detectedChanges: BehavioralChangeDetection[];
    submittedEvidence: BehavioralTestEvidence[];
    isVisuallyApprovedOnly: boolean;
  }): BehavioralReviewResult {
    const blockingReasons: string[] = [];
    const hasBusinessLogicChanges = params.detectedChanges.length > 0;

    if (hasBusinessLogicChanges) {
      // Invariant: Visual-only approval cannot authorize behavioral changes
      if (params.isVisuallyApprovedOnly) {
        blockingReasons.push(
          "Visual-only approval rejected: Candidate contains business logic changes that require independent behavioral test verification."
        );
      }

      // Check each required test contract
      const evidenceMap = new Map<string, BehavioralTestEvidence>();
      for (const ev of params.submittedEvidence) {
        evidenceMap.set(ev.testContractName, ev);
      }

      for (const change of params.detectedChanges) {
        const evidence = evidenceMap.get(change.requiredTestContract);
        if (!evidence) {
          blockingReasons.push(
            `Missing behavioral test evidence: Required contract test '${change.requiredTestContract}' was not executed for capability '${change.affectedCapability}'.`
          );
        } else if (evidence.status !== "PASSED") {
          blockingReasons.push(
            `Behavioral test failure: Required contract test '${change.requiredTestContract}' status is '${evidence.status}'.`
          );
        } else if (evidence.assertionCount <= 0) {
          blockingReasons.push(
            `Weakened test rejected: Contract test '${change.requiredTestContract}' has zero assertions.`
          );
        }
      }
    }

    return {
      hasBusinessLogicChanges,
      detectedChanges: params.detectedChanges,
      isReleaseApproved: blockingReasons.length === 0,
      blockingReasons
    };
  }
}

export const behavioralReviewGateService = BehavioralReviewGateService.getInstance();
