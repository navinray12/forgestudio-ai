import type { Request, Response, NextFunction } from "express";
import { resolvePublicRouteDelivery } from "../services/searchQuality/seoRouteDelivery.service.js";
import { generateSearchReadinessReport } from "../services/searchQuality/searchReadinessWorkspace.service.js";
import { evaluateAiSearchCompliance } from "../services/searchQuality/aiSearchGuidance.service.js";
import {
  registerFactOffer,
  getFactOffer,
  previewOfferChangeImpact,
} from "../services/searchQuality/factOfferRegister.service.js";
import { sanitizeMediaMetadataAndRecordRights } from "../services/searchQuality/mediaMetadataRights.service.js";

export async function resolveRouteDeliveryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = resolvePublicRouteDelivery(req.body);
    res.status(result.statusCode).json({ success: true, delivery: result });
  } catch (error) {
    next(error);
  }
}

export async function getSearchReadinessHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const report = generateSearchReadinessReport({
      websiteId: (req.query.websiteId as string) || "site-1",
      canonicalDomain: (req.query.canonicalDomain as string) || "example.com",
      sitemapGenerated: req.query.sitemapGenerated === "true",
      sitemapSubmittedToGsc: req.query.sitemapSubmittedToGsc === "true",
      robotsTxtValid: req.query.robotsTxtValid !== "false",
      localBusinessSchemaPresent: req.query.localBusinessSchemaPresent === "true",
      hasProductOfferings: req.query.hasProductOfferings === "true",
    });
    res.json({ success: true, report });
  } catch (error) {
    next(error);
  }
}

export async function evaluateAiSearchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const evaluation = evaluateAiSearchCompliance(req.body);
    res.json({ success: true, evaluation });
  } catch (error) {
    next(error);
  }
}

export async function createFactOfferHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const record = registerFactOffer(req.body);
    res.status(201).json({ success: true, fact: record });
  } catch (error) {
    next(error);
  }
}

export async function previewOfferImpactHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const preview = previewOfferChangeImpact(req.body);
    res.json({ success: true, preview });
  } catch (error) {
    next(error);
  }
}

export async function sanitizeMediaRightsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const manifest = sanitizeMediaMetadataAndRecordRights(req.body);
    res.json({ success: true, manifest });
  } catch (error) {
    next(error);
  }
}
