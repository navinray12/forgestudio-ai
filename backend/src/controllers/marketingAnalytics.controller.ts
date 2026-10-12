import type { Request, Response, NextFunction } from "express";
import {
  recordConsentChoice,
  withdrawConsent,
  canDispatchAnalyticsEvent,
} from "../services/marketingAnalytics/consentDecisionEngine.service.js";
import {
  validateMeasurementEventPayload,
  inspectSerializedNetworkPayload,
} from "../services/marketingAnalytics/measurementEventContract.service.js";
import {
  buildCampaignLink,
  freezeConversionAttribution,
} from "../services/marketingAnalytics/attributionEngine.service.js";
import { calculateTruthfulGrowthMetrics } from "../services/marketingAnalytics/truthfulMetricsEngine.service.js";
import {
  dispatchProviderConversion,
  buildGoogleOfflineConversionPayload,
  buildMetaCapiEventPayload,
} from "../services/marketingAnalytics/providerAdapters.service.js";

export async function recordConsentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const decision = recordConsentChoice(req.body);
    res.status(201).json({ success: true, decision });
  } catch (error) {
    next(error);
  }
}

export async function withdrawConsentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const decision = await withdrawConsent(req.body);
    res.json({ success: true, decision });
  } catch (error) {
    next(error);
  }
}

export async function validateEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = validateMeasurementEventPayload(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function buildUtmLinkHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const link = buildCampaignLink(req.body);
    res.json({ success: true, link });
  } catch (error) {
    next(error);
  }
}

export async function calculateMetricsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = calculateTruthfulGrowthMetrics(req.body);
    res.json({ success: true, metrics: summary });
  } catch (error) {
    next(error);
  }
}

export async function dispatchConversionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const receipt = await dispatchProviderConversion(req.body);
    res.json({ success: true, receipt });
  } catch (error) {
    next(error);
  }
}
