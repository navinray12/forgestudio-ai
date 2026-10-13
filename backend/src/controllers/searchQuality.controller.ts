import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../utils/app-error.js";
import { tenantScopeOf } from "../middlewares/tenantScope.middleware.js";
import { getWebsiteRecord, putWebsiteRecord, type WebsiteRecord } from "../services/websiteRecords.service.js";
import { resolvePublicRouteDelivery } from "../services/searchQuality/seoRouteDelivery.service.js";
import type { FactOfferRecord } from "../services/searchQuality/factOfferRegister.service.js";
import { sanitizeMediaMetadataAndRecordRights } from "../services/searchQuality/mediaMetadataRights.service.js";

/**
 * Search quality (blueprint §14). The fact & offer register is durable and scoped to a website the
 * caller belongs to; the approver is the session user and only owners/admins can approve or reject.
 *
 * Not exposed: /readiness and /ai-search/evaluate. Both turn client-asserted booleans into a
 * readiness or compliance verdict without inspecting the website.
 */
const text = (max: number) => z.string().trim().min(1).max(max);

const routeInput = z.object({
  siteCanonicalDomain: text(253),
  path: text(2000),
  isPublished: z.boolean(),
  isTrashed: z.boolean(),
  hasLegalHoldOrPurged: z.boolean(),
  title: z.string().max(500),
  description: z.string().max(2000),
  publishedContent: z.record(z.string(), z.unknown()).optional(),
  redirectRules: z
    .array(z.object({ fromPath: text(2000), toPath: text(2000), statusCode: z.union([z.literal(301), z.literal(302)]) }))
    .max(500)
    .optional(),
});

const factInput = z.object({
  factId: text(120),
  category: z.enum(["BUSINESS_CLAIM", "PRICE_OFFER", "TESTIMONIAL_EVIDENCE", "LEGAL_TERM"]),
  statement: text(2000),
  approvedWording: text(2000),
  evidenceSourceUrl: z.url().max(2000).optional(),
  evidenceReference: z.string().max(500).optional(),
  approvalStatus: z.enum(["APPROVED", "PENDING_REVIEW", "REJECTED"]).default("PENDING_REVIEW"),
  validFrom: z.iso.datetime(),
  validUntil: z.iso.datetime().optional(),
  dependentSurfaces: z
    .array(z.object({ surfaceType: z.enum(["PAGE", "CAMPAIGN", "CHATBOT_CONTEXT", "DOWNLOAD"]), surfaceIdentifier: text(300) }))
    .max(500)
    .default([]),
});

const previewInput = z.object({
  factId: text(120),
  proposedStatement: text(2000),
  proposedAmount: z.number().nonnegative().optional(),
});

const mediaInput = z.object({
  assetId: text(200),
  originalFileName: text(255),
  originalHash: text(128),
  sourceProvider: text(120),
  licenseType: z.enum(["COMMERCIAL_PERMITTED", "EDITORIAL_ONLY", "PROPRIETARY_OWNED"]),
  licenseExpiryUtc: z.iso.datetime().optional(),
  placementsWithAltText: z.array(z.object({ placementId: text(200), altText: z.string().max(1000) })).max(500).optional(),
});

type StoredFact = Omit<FactOfferRecord, "createdAt" | "updatedAt">;

function toFact(record: WebsiteRecord<StoredFact>): FactOfferRecord & { revision: number } {
  return { ...record.data, createdAt: record.createdAt, updatedAt: record.updatedAt, revision: record.revision };
}

/** The resolved delivery (including a 301/404/410 outcome) is the response body, not the HTTP status. */
export async function resolveRouteDeliveryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, delivery: resolvePublicRouteDelivery(routeInput.parse(req.body)) });
  } catch (error) {
    next(error);
  }
}

export async function createFactOfferHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = tenantScopeOf(res);
    const input = factInput.parse(req.body);
    if (input.approvalStatus !== "PENDING_REVIEW" && !scope.canAdminister) {
      throw new AppError("Only website owners and admins can approve or reject a fact", 403, "FORBIDDEN");
    }
    const { record, outcome } = await putWebsiteRecord<StoredFact>({
      scope,
      kind: "FACT_OFFER",
      key: input.factId,
      data: { ...input, websiteId: scope.websiteId, approvedBy: res.locals.user.id },
      request: input,
      userId: res.locals.user.id,
    });
    res.status(outcome === "CREATED" ? 201 : 200).json({
      success: true,
      fact: toFact(record),
      idempotentReplay: outcome === "REPLAYED",
    });
  } catch (error) {
    next(error);
  }
}

export async function previewOfferImpactHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = previewInput.parse(req.body);
    const record = await getWebsiteRecord<StoredFact>(tenantScopeOf(res), "FACT_OFFER", input.factId);
    if (!record) throw new AppError(`Fact/Offer not found: ${input.factId}`, 404, "FACT_NOT_FOUND");
    const surfaces = record.data.dependentSurfaces;
    res.json({
      success: true,
      preview: {
        factId: input.factId,
        proposedAmount: input.proposedAmount,
        affectedPagesCount: surfaces.filter((s) => s.surfaceType === "PAGE").length,
        affectedCampaignsCount: surfaces.filter((s) => s.surfaceType === "CAMPAIGN").length,
        affectedSurfaces: surfaces,
        requiresOwnerApproval: true,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function sanitizeMediaRightsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, manifest: sanitizeMediaMetadataAndRecordRights(mediaInput.parse(req.body)) });
  } catch (error) {
    next(error);
  }
}
