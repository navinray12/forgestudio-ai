import { AppError } from "../../utils/app-error.js";

export interface UtmParameters {
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

export interface AttributionTouchpoint {
  source: string;
  medium: string;
  campaign: string;
  clickId?: string;
  clickIdType?: "gclid" | "fbclid" | "msclkid" | "ttclid";
  landingRoute: string;
  recordedAt: string;
}

export interface FrozenConversionAttribution {
  conversionId: string;
  websiteId: string;
  firstTouch: AttributionTouchpoint | "UNKNOWN" | "REFUSED";
  lastTouch: AttributionTouchpoint | "UNKNOWN" | "REFUSED";
  snapshotFrozenAt: string;
  isDirectFallback: boolean;
}

/**
 * Builds and normalizes a campaign link with approved UTM parameters.
 */
export function buildCampaignLink(params: {
  baseUrl: string;
  utm: UtmParameters;
}): string {
  const { baseUrl, utm } = params;

  if (!baseUrl || !utm.source || !utm.medium || !utm.campaign) {
    throw new AppError("Base URL, source, medium, and campaign are required for campaign link", 400, "INVALID_UTM_PARAMS");
  }

  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", utm.source.trim().toLowerCase());
  url.searchParams.set("utm_medium", utm.medium.trim().toLowerCase());
  url.searchParams.set("utm_campaign", utm.campaign.trim().toLowerCase());

  if (utm.term) url.searchParams.set("utm_term", utm.term.trim().toLowerCase());
  if (utm.content) url.searchParams.set("utm_content", utm.content.trim().toLowerCase());

  return url.toString();
}

/**
 * Freezes conversion-time attribution snapshot.
 * Invariant: Unknown/refused attribution is NEVER rewritten as "direct".
 */
export function freezeConversionAttribution(params: {
  conversionId: string;
  websiteId: string;
  firstTouch?: AttributionTouchpoint;
  lastTouch?: AttributionTouchpoint;
  consentGranted: boolean;
}): FrozenConversionAttribution {
  const { conversionId, websiteId, firstTouch, lastTouch, consentGranted } = params;

  if (!consentGranted) {
    return {
      conversionId,
      websiteId,
      firstTouch: "REFUSED",
      lastTouch: "REFUSED",
      snapshotFrozenAt: new Date().toISOString(),
      isDirectFallback: false,
    };
  }

  return {
    conversionId,
    websiteId,
    firstTouch: firstTouch || "UNKNOWN",
    lastTouch: lastTouch || "UNKNOWN",
    snapshotFrozenAt: new Date().toISOString(),
    isDirectFallback: false,
  };
}
