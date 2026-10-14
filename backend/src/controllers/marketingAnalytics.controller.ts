import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../utils/app-error.js";
import { tenantScopeOf } from "../middlewares/tenantScope.middleware.js";
import { recordAuditLog } from "../services/audit.service.js";
import { getWebsiteRecord, putWebsiteRecord } from "../services/websiteRecords.service.js";
import {
  buildConsentDecision,
  type VisitorConsentDecision,
} from "../services/marketingAnalytics/consentDecisionEngine.service.js";
import { validateMeasurementEventPayload } from "../services/marketingAnalytics/measurementEventContract.service.js";
import { buildCampaignLink } from "../services/marketingAnalytics/attributionEngine.service.js";
import { calculateTruthfulGrowthMetrics } from "../services/marketingAnalytics/truthfulMetricsEngine.service.js";

/**
 * Marketing & analytics (blueprint §13). Consent decisions are durable and scoped to a website the
 * caller belongs to; the remaining routes are calculations over the request body.
 *
 * Not exposed: /conversions/dispatch. The provider adapter makes no provider call and returns an
 * ACCEPTED receipt when the client says the provider is connected.
 */
const subjectId = z.string().trim().min(1).max(128);

const consentInput = z.object({
  subjectId,
  status: z.enum(["GRANTED", "REFUSED"]),
  purposes: z.object({ analytics: z.boolean(), marketing: z.boolean() }),
  policyVersion: z.string().trim().min(1).max(32).optional(),
});

const withdrawInput = z.object({ subjectId, reason: z.string().trim().max(500).optional() });

const eventInput = z.object({
  eventName: z.string().min(1).max(120),
  version: z.string().min(1).max(32),
  purpose: z.string().min(1).max(60),
  routeId: z.string().min(1).max(200),
  sectionId: z.string().max(200).optional(),
  properties: z.record(z.string(), z.unknown()),
  timestamp: z.string().min(1).max(40),
});

const utmInput = z.object({
  baseUrl: z.url().max(2000),
  utm: z.object({
    source: z.string().min(1).max(200),
    medium: z.string().min(1).max(200),
    campaign: z.string().min(1).max(200),
    term: z.string().max(200).optional(),
    content: z.string().max(200).optional(),
  }),
});

const count = z.number().nonnegative();
const metricsInput = z.object({
  eligibleMeasuredSessions: count,
  sessionsWithAtLeastOneLead: count,
  totalEligibleAcceptedLeads: count,
  totalAuthoritativeBusinessLeads: count,
  maturedCohortTotalLeads: count,
  maturedCohortQualifiedLeads: count,
  cohortWindow: z.string().max(20).optional(),
});

export async function recordConsentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = tenantScopeOf(res);
    const input = consentInput.parse(req.body);
    const { record, outcome } = await putWebsiteRecord<VisitorConsentDecision>({
      scope,
      kind: "CONSENT_DECISION",
      key: input.subjectId,
      data: buildConsentDecision({ ...input, websiteId: scope.websiteId }),
      request: input,
      userId: res.locals.user.id,
    });
    res.status(outcome === "CREATED" ? 201 : 200).json({
      success: true,
      decision: record.data,
      revision: record.revision,
      idempotentReplay: outcome === "REPLAYED",
    });
  } catch (error) {
    next(error);
  }
}

export async function withdrawConsentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = tenantScopeOf(res);
    const input = withdrawInput.parse(req.body);
    const current = await getWebsiteRecord<VisitorConsentDecision>(scope, "CONSENT_DECISION", input.subjectId);
    if (!current) throw new AppError("Consent record not found for subject", 404, "CONSENT_NOT_FOUND");
    if (current.data.status === "WITHDRAWN") {
      res.json({ success: true, decision: current.data, revision: current.revision, idempotentReplay: true });
      return;
    }
    const { record } = await putWebsiteRecord<VisitorConsentDecision>({
      scope,
      kind: "CONSENT_DECISION",
      key: input.subjectId,
      data: {
        ...current.data,
        status: "WITHDRAWN",
        purposes: { functional: true, analytics: false, marketing: false },
        withdrawnAt: new Date().toISOString(),
      },
      request: { withdrawnFromRevision: current.revision },
      userId: res.locals.user.id,
      expectedRevision: current.revision,
    });
    await recordAuditLog({
      userId: res.locals.user.id,
      action: "CONSENT_WITHDRAWN",
      targetResource: `website:${scope.websiteId}`,
      details: { subjectId: input.subjectId, reason: input.reason },
    });
    res.json({ success: true, decision: record.data, revision: record.revision, idempotentReplay: false });
  } catch (error) {
    next(error);
  }
}

export async function validateEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, ...validateMeasurementEventPayload(eventInput.parse(req.body)) });
  } catch (error) {
    next(error);
  }
}

export async function buildUtmLinkHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, link: buildCampaignLink(utmInput.parse(req.body)) });
  } catch (error) {
    next(error);
  }
}

export async function calculateMetricsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, metrics: calculateTruthfulGrowthMetrics(metricsInput.parse(req.body)) });
  } catch (error) {
    next(error);
  }
}
