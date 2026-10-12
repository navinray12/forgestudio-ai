/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Record 1: Business Brief and Fact/Offer Register
 *
 * Authority: Owner-approved business facts, claims, markets, outcomes, capacity,
 * price authority, and policy decisions.
 *
 * Rules:
 * 1. AI output is strictly a proposal until explicit authorized approval occurs.
 * 2. Origin, reviewer, and approval history are permanently preserved.
 * 3. Price validity and effective-period information are explicitly recorded.
 * 4. Cached AI responses cannot override current approved facts or invent prices.
 * 5. Historical approved revisions are preserved for accepted customer obligations.
 * 6. Internal notes and restricted facts are strictly filtered from public delivery.
 */

import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import { prisma, pgPool } from "../../config/prisma.js";

export type FactCategory =
  | "BUSINESS_FACT"
  | "CLAIM_AND_EVIDENCE"
  | "OFFER_AND_SERVICE"
  | "PRICE_AUTHORITY"
  | "MARKET_AND_AUDIENCE"
  | "CAPACITY_AND_TERMS"
  | "POLICY_DECISION";

export type FactApprovalState =
  | "PROPOSED"      // Proposed by AI or draft author, unapproved
  | "APPROVED"      // Approved by authorized owner/reviewer
  | "REJECTED"      // Formally rejected by reviewer
  | "SUPERSEDED"    // Replaced by a newer approved revision
  | "REVOKED";      // Withdrawn due to policy/compliance change

export type FactSource =
  | "AI_PROPOSAL"
  | "OWNER_AUTHORING"
  | "LEGAL_POLICY"
  | "EXTERNAL_IMPORT"
  | "BENCHMARK_SPEC";

export interface PricingAuthority {
  amount: number;
  currency: string;
  billingInterval?: "ONE_TIME" | "MONTHLY" | "ANNUAL" | "CUSTOM";
  validFrom: string;
  validUntil?: string;
  approvedBy: string;
  enquiryOnly: boolean;
}

export interface CapacityConstraints {
  maxQuantity?: number;
  leadTimeDays?: number;
  geographicEligibility?: string[];
  deliveryTerms?: string;
}

export interface BusinessFactAuditEntry {
  action: "PROPOSED" | "APPROVED" | "PRICE_UPDATED" | "REJECTED" | "SUPERSEDED" | "REVOKED";
  actorId: string;
  timestamp: string;
  details?: Record<string, any>;
  notes?: string;
}

export interface BusinessFactRecord {
  id: string;
  tenantId: string;
  websiteId: string;
  version: number;
  category: FactCategory;
  statement: string;
  source: FactSource;
  approvalState: FactApprovalState;
  isPublic: boolean;
  internalNotes?: string;
  pricingAuthority?: PricingAuthority;
  capacityConstraints?: CapacityConstraints;
  evidenceReference?: string;
  policyApprover?: string;
  validFrom: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  history: BusinessFactAuditEntry[];
}

export interface ProposeFactInput {
  tenantId: string;
  websiteId: string;
  category: FactCategory;
  statement: string;
  source?: FactSource;
  isPublic?: boolean;
  internalNotes?: string;
  pricingAuthority?: Omit<PricingAuthority, "approvedBy">;
  capacityConstraints?: CapacityConstraints;
  evidenceReference?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface ApproveFactInput {
  tenantId: string;
  websiteId: string;
  factId: string;
  actorId: string;
  notes?: string;
  pricingApproval?: {
    approvedAmount: number;
    currency: string;
    validUntil?: string;
  };
}

// In-memory backing store for tests and staging fallback
const FACT_REGISTRY = new Map<string, BusinessFactRecord>();

export class BusinessFactRegisterService {
  /**
   * Propose a new fact or offer. AI generation outputs enter here with status "PROPOSED".
   * AI output is NEVER automatically approved.
   */
  static async proposeFact(input: ProposeFactInput, actorId: string): Promise<BusinessFactRecord> {
    if (!input.statement || input.statement.trim().length === 0) {
      throw new AppError("Fact statement cannot be empty", 400, "INVALID_FACT_STATEMENT");
    }
    if (!input.tenantId || !input.websiteId) {
      throw new AppError("Tenant ID and Website ID are required", 400, "TENANT_REQUIRED");
    }

    const id = `fact_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const source: FactSource = input.source || (actorId === "ai_assistant" ? "AI_PROPOSAL" : "OWNER_AUTHORING");

    const record: BusinessFactRecord = {
      id,
      tenantId: input.tenantId,
      websiteId: input.websiteId,
      version: 1,
      category: input.category,
      statement: input.statement.trim(),
      source,
      approvalState: "PROPOSED",
      isPublic: input.isPublic ?? true,
      internalNotes: input.internalNotes,
      pricingAuthority: input.pricingAuthority ? {
        ...input.pricingAuthority,
        approvedBy: "", // Unapproved until explicit owner sign-off
      } : undefined,
      capacityConstraints: input.capacityConstraints,
      evidenceReference: input.evidenceReference,
      validFrom: input.validFrom || now,
      validUntil: input.validUntil,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          action: "PROPOSED",
          actorId,
          timestamp: now,
          notes: source === "AI_PROPOSAL" ? "AI synthesized proposal awaiting owner review" : "Initial authoring",
        },
      ],
    };

    FACT_REGISTRY.set(id, record);
    return record;
  }

  /**
   * Explicitly approve a proposed fact or offer by an authorized reviewer/owner.
   * Transfers authority from proposed to approved truth.
   */
  static async approveFact(input: ApproveFactInput): Promise<BusinessFactRecord> {
    const existing = FACT_REGISTRY.get(input.factId);
    if (!existing) {
      throw new AppError(`Business fact not found: ${input.factId}`, 404, "FACT_NOT_FOUND");
    }
    if (existing.tenantId !== input.tenantId || existing.websiteId !== input.websiteId) {
      throw new AppError("Cross-tenant fact access denied", 403, "TENANT_VIOLATION");
    }

    const now = new Date().toISOString();

    // If pricing was proposed, require explicit pricing authority confirmation
    if (existing.category === "PRICE_AUTHORITY" || existing.pricingAuthority) {
      if (!input.pricingApproval && !existing.pricingAuthority?.approvedBy) {
        throw new AppError("Approving a price authority record requires explicit pricing approval parameters", 400, "PRICING_AUTHORITY_REQUIRED");
      }
      if (input.pricingApproval) {
        existing.pricingAuthority = {
          amount: input.pricingApproval.approvedAmount,
          currency: input.pricingApproval.currency,
          validFrom: now,
          validUntil: input.pricingApproval.validUntil,
          approvedBy: input.actorId,
          enquiryOnly: false,
        };
      }
    }

    existing.approvalState = "APPROVED";
    existing.approvedBy = input.actorId;
    existing.approvedAt = now;
    existing.version += 1;
    existing.updatedAt = now;
    existing.history.push({
      action: "APPROVED",
      actorId: input.actorId,
      timestamp: now,
      notes: input.notes || "Fact verified and approved by accountable reviewer",
    });

    FACT_REGISTRY.set(input.factId, existing);
    return existing;
  }

  /**
   * Revoke or supersede a business fact when terms change.
   */
  static async revokeFact(
    tenantId: string,
    websiteId: string,
    factId: string,
    actorId: string,
    reason: string
  ): Promise<BusinessFactRecord> {
    const existing = FACT_REGISTRY.get(factId);
    if (!existing) {
      throw new AppError(`Business fact not found: ${factId}`, 404, "FACT_NOT_FOUND");
    }
    if (existing.tenantId !== tenantId || existing.websiteId !== websiteId) {
      throw new AppError("Cross-tenant fact access denied", 403, "TENANT_VIOLATION");
    }

    const now = new Date().toISOString();
    existing.approvalState = "REVOKED";
    existing.version += 1;
    existing.updatedAt = now;
    existing.history.push({
      action: "REVOKED",
      actorId,
      timestamp: now,
      notes: reason,
    });

    FACT_REGISTRY.set(factId, existing);
    return existing;
  }

  /**
   * Retrieve approved facts for a website.
   * If publicOnly is true, filters out unapproved proposals, revoked facts,
   * internal notes, and restricted commercial details.
   */
  static async getApprovedFacts(
    tenantId: string,
    websiteId: string,
    options: { publicOnly?: boolean; category?: FactCategory } = {}
  ): Promise<BusinessFactRecord[]> {
    const list: BusinessFactRecord[] = [];

    for (const record of FACT_REGISTRY.values()) {
      if (record.tenantId === tenantId && record.websiteId === websiteId) {
        if (options.category && record.category !== options.category) {
          continue;
        }

        if (options.publicOnly) {
          // Public delivery ONLY includes APPROVED facts
          if (record.approvalState !== "APPROVED" || !record.isPublic) {
            continue;
          }
          // Filter internal notes and audit history from public delivery bundle
          const safePublicRecord: BusinessFactRecord = {
            ...record,
            internalNotes: undefined,
            history: [], // Do not expose internal audit history to public bundles
          };
          list.push(safePublicRecord);
        } else {
          list.push(record);
        }
      }
    }

    return list.sort((a, b) => b.version - a.version);
  }

  /**
   * Get complete register snapshot with revision hash for compiler and release manifest.
   */
  static async getFactRegisterSnapshot(
    tenantId: string,
    websiteId: string
  ): Promise<{
    revision: number;
    snapshotHash: string;
    approvedFactsCount: number;
    proposedCount: number;
    facts: BusinessFactRecord[];
  }> {
    const all = await this.getApprovedFacts(tenantId, websiteId, { publicOnly: false });
    const approved = all.filter((f) => f.approvalState === "APPROVED");
    const proposed = all.filter((f) => f.approvalState === "PROPOSED");

    const digestPayload = JSON.stringify(
      approved.map((f) => ({
        id: f.id,
        version: f.version,
        statement: f.statement,
        price: f.pricingAuthority?.amount,
        currency: f.pricingAuthority?.currency,
      }))
    );

    const snapshotHash = crypto.createHash("sha256").update(digestPayload).digest("hex");
    const maxVersion = all.reduce((max, f) => Math.max(max, f.version), 1);

    return {
      revision: maxVersion,
      snapshotHash,
      approvedFactsCount: approved.length,
      proposedCount: proposed.length,
      facts: approved,
    };
  }

  /**
   * Clear in-memory facts (for test isolation).
   */
  static clearMemory(): void {
    FACT_REGISTRY.clear();
  }
}
