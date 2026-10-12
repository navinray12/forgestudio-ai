import { AppError } from "../../utils/app-error.js";

export interface RouteResolutionResult {
  route: string;
  statusCode: 200 | 301 | 302 | 404 | 410 | 503;
  canonicalUrl: string;
  meta: {
    title: string;
    description: string;
    robots: string;
    ogTitle?: string;
    ogDescription?: string;
  };
  structuredDataJsonLd?: Record<string, any>;
  redirectTarget?: string;
  isSoft404Detected: boolean;
  leakedDraftFieldsDetected: boolean;
}

export interface RedirectRule {
  fromPath: string;
  toPath: string;
  statusCode: 301 | 302;
}

/**
 * Detects redirect loops and evaluates safe redirect destinations.
 */
export function detectRedirectLoop(rules: RedirectRule[], startPath: string): { hasLoop: boolean; pathTrail: string[] } {
  const trail: string[] = [startPath];
  const visited = new Set<string>([startPath]);
  let current = startPath;

  for (let i = 0; i < 20; i++) {
    const match = rules.find((r) => r.fromPath === current);
    if (!match) break;
    current = match.toPath;
    trail.push(current);
    if (visited.has(current)) {
      return { hasLoop: true, pathTrail: trail };
    }
    visited.add(current);
  }

  return { hasLoop: false, pathTrail: trail };
}

/**
 * Resolves public route delivery with strict HTTP status correctness and canonical host derivation.
 */
export function resolvePublicRouteDelivery(params: {
  siteCanonicalDomain: string; // From trusted config, NOT incoming Host header!
  path: string;
  isPublished: boolean;
  isTrashed: boolean;
  hasLegalHoldOrPurged: boolean;
  title: string;
  description: string;
  publishedContent?: Record<string, any>;
  redirectRules?: RedirectRule[];
}): RouteResolutionResult {
  const {
    siteCanonicalDomain,
    path,
    isPublished,
    isTrashed,
    hasLegalHoldOrPurged,
    title,
    description,
    publishedContent,
    redirectRules = [],
  } = params;

  // 1. Check redirects first
  const redirectMatch = redirectRules.find((r) => r.fromPath === path);
  if (redirectMatch) {
    const loopCheck = detectRedirectLoop(redirectRules, path);
    if (loopCheck.hasLoop) {
      throw new AppError(`Redirect loop detected: ${loopCheck.pathTrail.join(" -> ")}`, 508, "REDIRECT_LOOP");
    }
    return {
      route: path,
      statusCode: redirectMatch.statusCode,
      canonicalUrl: `https://${siteCanonicalDomain}${redirectMatch.toPath}`,
      redirectTarget: redirectMatch.toPath,
      meta: { title: "", description: "", robots: "noindex, nofollow" },
      isSoft404Detected: false,
      leakedDraftFieldsDetected: false,
    };
  }

  // 2. Trashed / Purged status -> HTTP 410 Gone
  if (hasLegalHoldOrPurged || isTrashed) {
    return {
      route: path,
      statusCode: 410,
      canonicalUrl: `https://${siteCanonicalDomain}${path}`,
      meta: { title: "410 Gone", description: "Resource has been permanently removed", robots: "noindex, nofollow" },
      isSoft404Detected: false,
      leakedDraftFieldsDetected: false,
    };
  }

  // 3. Unpublished -> HTTP 404 Not Found (Never return HTTP 200 with an error page!)
  if (!isPublished) {
    return {
      route: path,
      statusCode: 404,
      canonicalUrl: `https://${siteCanonicalDomain}${path}`,
      meta: { title: "404 Not Found", description: "Page not found", robots: "noindex, nofollow" },
      isSoft404Detected: false,
      leakedDraftFieldsDetected: false,
    };
  }

  // 4. Published content: verify no draft or internal fields leaked in public projection
  let leakedDraftFields = false;
  if (publishedContent) {
    const prohibitedDraftKeys = ["draftContent", "internalNotes", "reviewerComments", "unverifiedSecrets"];
    leakedDraftFields = Object.keys(publishedContent).some((k) => prohibitedDraftKeys.includes(k));
  }

  const canonicalUrl = `https://${siteCanonicalDomain}${path}`;

  return {
    route: path,
    statusCode: 200,
    canonicalUrl,
    meta: {
      title,
      description,
      robots: "index, follow",
      ogTitle: title,
      ogDescription: description,
    },
    structuredDataJsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description,
      url: canonicalUrl,
    },
    isSoft404Detected: false,
    leakedDraftFieldsDetected: leakedDraftFields,
  };
}
