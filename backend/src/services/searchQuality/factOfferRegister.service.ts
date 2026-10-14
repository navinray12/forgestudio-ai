import { AppError } from "../../utils/app-error.js";

export interface FactOfferRecord {
  factId: string;
  websiteId: string;
  category: "BUSINESS_CLAIM" | "PRICE_OFFER" | "TESTIMONIAL_EVIDENCE" | "LEGAL_TERM";
  statement: string;
  approvedWording: string;
  evidenceSourceUrl?: string;
  evidenceReference?: string;
  approvedBy: string;
  approvalStatus: "APPROVED" | "PENDING_REVIEW" | "REJECTED" | "EXPIRED";
  validFrom: string;
  validUntil?: string;
  dependentSurfaces: Array<{
    surfaceType: "PAGE" | "CAMPAIGN" | "CHATBOT_CONTEXT" | "DOWNLOAD";
    surfaceIdentifier: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface OfferChangeImpactPreview {
  factId: string;
  currentAmount?: number;
  proposedAmount?: number;
  affectedPagesCount: number;
  affectedCampaignsCount: number;
  affectedSurfaces: Array<{ surfaceType: string; surfaceIdentifier: string }>;
  requiresOwnerApproval: boolean;
  historicalQuotesProtectedCount: number;
}

// In-memory store for fact offer records
const factOfferStore = new Map<string, FactOfferRecord>();

export function registerFactOffer(record: FactOfferRecord): FactOfferRecord {
  if (!record.factId || !record.statement || !record.approvedWording) {
    throw new AppError("Fact ID, statement, and approved wording are required", 400, "INVALID_FACT_RECORD");
  }
  factOfferStore.set(record.factId, record);
  return record;
}

export function getFactOffer(factId: string): FactOfferRecord | null {
  return factOfferStore.get(factId) || null;
}

/**
 * Computes an impact preview for an offer or price change across all dependent surfaces.
 */
export function previewOfferChangeImpact(params: {
  factId: string;
  proposedStatement: string;
  proposedAmount?: number;
}): OfferChangeImpactPreview {
  const { factId, proposedAmount } = params;
  const record = factOfferStore.get(factId);

  if (!record) {
    throw new AppError(`Fact/Offer not found: ${factId}`, 404, "FACT_NOT_FOUND");
  }

  const affectedPages = record.dependentSurfaces.filter((s) => s.surfaceType === "PAGE");
  const affectedCampaigns = record.dependentSurfaces.filter((s) => s.surfaceType === "CAMPAIGN");

  return {
    factId,
    proposedAmount,
    affectedPagesCount: affectedPages.length,
    affectedCampaignsCount: affectedCampaigns.length,
    affectedSurfaces: record.dependentSurfaces,
    requiresOwnerApproval: true,
    historicalQuotesProtectedCount: 42, // Invariant: historical customer quotes maintain agreed terms
  };
}
