import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolvePublicRouteDelivery,
  detectRedirectLoop,
} from "../services/searchQuality/seoRouteDelivery.service.js";

import { generateSearchReadinessReport } from "../services/searchQuality/searchReadinessWorkspace.service.js";

import { evaluateAiSearchCompliance } from "../services/searchQuality/aiSearchGuidance.service.js";

import {
  registerFactOffer,
  previewOfferChangeImpact,
} from "../services/searchQuality/factOfferRegister.service.js";

import { sanitizeMediaMetadataAndRecordRights } from "../services/searchQuality/mediaMetadataRights.service.js";

describe("Point 14 — Search, Content Quality and Business Evidence", () => {
  const canonicalDomain = "example.com";

  it("should enforce HTTP route correctness, canonical URL derivation, and draft leak protection", () => {
    // 1. Published route -> HTTP 200 with canonical URL derived from trusted domain
    const pubRoute = resolvePublicRouteDelivery({
      siteCanonicalDomain: canonicalDomain,
      path: "/services",
      isPublished: true,
      isTrashed: false,
      hasLegalHoldOrPurged: false,
      title: "Our Consulting Services",
      description: "Professional technology solutions.",
      publishedContent: { headline: "Enterprise Technology" },
    });
    assert.equal(pubRoute.statusCode, 200);
    assert.equal(pubRoute.canonicalUrl, "https://example.com/services");
    assert.equal(pubRoute.meta.robots, "index, follow");
    assert.equal(pubRoute.leakedDraftFieldsDetected, false);

    // 2. Unpublished route -> HTTP 404 (No soft-404 returning 200 with error page!)
    const unpubRoute = resolvePublicRouteDelivery({
      siteCanonicalDomain: canonicalDomain,
      path: "/unreleased-feature",
      isPublished: false,
      isTrashed: false,
      hasLegalHoldOrPurged: false,
      title: "Draft Feature",
      description: "Not live yet",
    });
    assert.equal(unpubRoute.statusCode, 404);
    assert.equal(unpubRoute.meta.robots, "noindex, nofollow");

    // 3. Trashed route -> HTTP 410 Gone
    const trashedRoute = resolvePublicRouteDelivery({
      siteCanonicalDomain: canonicalDomain,
      path: "/discontinued-service",
      isPublished: true,
      isTrashed: true,
      hasLegalHoldOrPurged: false,
      title: "Discontinued",
      description: "Removed",
    });
    assert.equal(trashedRoute.statusCode, 410);

    // 4. Redirect loop detection
    const loopRules = [
      { fromPath: "/a", toPath: "/b", statusCode: 301 as const },
      { fromPath: "/b", toPath: "/c", statusCode: 301 as const },
      { fromPath: "/c", toPath: "/a", statusCode: 301 as const }, // Loop!
    ];
    const loopResult = detectRedirectLoop(loopRules, "/a");
    assert.equal(loopResult.hasLoop, true);
    assert.deepEqual(loopResult.pathTrail, ["/a", "/b", "/c", "/a"]);
  });

  it("should report search readiness categories distinguishing technical checks from observed outcomes", () => {
    const report = generateSearchReadinessReport({
      websiteId: "site-sr-test",
      canonicalDomain: "example.com",
      sitemapGenerated: true,
      sitemapSubmittedToGsc: false, // Generated but not submitted!
      robotsTxtValid: true,
      localBusinessSchemaPresent: true,
      hasProductOfferings: false,
    });

    const sitemapItem = report.items.find((i) => i.id === "sr:xml_sitemap");
    assert.ok(sitemapItem);
    assert.equal(sitemapItem?.state, "TECHNICALLY_CHECKED");
    assert.equal(sitemapItem?.evidenceType, "TECHNICAL_CHECK");
    assert.ok(sitemapItem?.remediation?.includes("Google Search Console"));

    // Check AI search surfaces item
    const aiItem = report.items.find((i) => i.id === "sr:ai_search_readiness");
    assert.ok(aiItem);
    assert.equal(aiItem?.state, "TECHNICALLY_CHECKED");
    assert.ok(aiItem?.limitations?.includes("ForgeStudio does not sell synthetic ranking scores"));
  });

  it("should evaluate official search engine guidance and reject synthetic ranking scores", () => {
    const evaluation = evaluateAiSearchCompliance({
      serverVisibleContent: true,
      crawlableNavigation: true,
      validStructuredData: true,
      factuallySupportedClaims: true,
      clearAuthorshipAndReview: true,
      noSyntheticRankingScoresSold: true,
    });

    assert.equal(evaluation.compliant, true);
    assert.ok(evaluation.officialGuidanceReferences.some((r) => r.includes("Google Search Central")));
    assert.ok(evaluation.truthfulDisclosures.some((d) => d.includes("No search engine publishes a proprietary 'AI search ranking factor'")));
  });

  it("should register authoritative business facts and compute offer change impact previews", () => {
    const fact = registerFactOffer({
      factId: "fact:price:consulting_hourly",
      websiteId: "site-fact-test",
      category: "PRICE_OFFER",
      statement: "Consulting rate is $150 per hour",
      approvedWording: "$150/hr flat rate for senior technical advisory",
      approvedBy: "owner-1",
      approvalStatus: "APPROVED",
      validFrom: "2026-01-01T00:00:00.000Z",
      dependentSurfaces: [
        { surfaceType: "PAGE", surfaceIdentifier: "/pricing" },
        { surfaceType: "PAGE", surfaceIdentifier: "/services" },
        { surfaceType: "CAMPAIGN", surfaceIdentifier: "autumn_promo_2026" },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    assert.equal(fact.approvalStatus, "APPROVED");

    // Preview change impact when increasing price to $200
    const impact = previewOfferChangeImpact({
      factId: fact.factId,
      proposedStatement: "Consulting rate is $200 per hour",
      proposedAmount: 200,
    });

    assert.equal(impact.affectedPagesCount, 2);
    assert.equal(impact.affectedCampaignsCount, 1);
    assert.equal(impact.requiresOwnerApproval, true);
    assert.equal(impact.historicalQuotesProtectedCount, 42, "Must preserve terms of existing historical quotes");
  });

  it("should sanitize media metadata, strip private EXIF, preserve rights, and map contextual alt text", () => {
    const manifest = sanitizeMediaMetadataAndRecordRights({
      assetId: "media-img-101",
      originalFileName: "team-photo.jpg",
      originalHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      sourceProvider: "Unsplash",
      licenseType: "COMMERCIAL_PERMITTED",
      placementsWithAltText: [
        { placementId: "placement:hero_banner", altText: "Founding team collaborating in studio office" },
        { placementId: "placement:footer_thumb", altText: "Small team thumbnail" },
      ],
    });

    assert.equal(manifest.assetId, "media-img-101");
    assert.equal(manifest.rights.sourceProvider, "Unsplash");
    assert.equal(manifest.rights.licenseType, "COMMERCIAL_PERMITTED");
    assert.equal(manifest.privateMetadataScrubbed.gpsStripped, true, "Private GPS coords must be stripped");
    assert.equal(manifest.privateMetadataScrubbed.cameraSerialStripped, true);

    // Verify distinct alt text per placement
    assert.equal(
      manifest.contextualAltTextMap["placement:hero_banner"],
      "Founding team collaborating in studio office"
    );
    assert.equal(
      manifest.contextualAltTextMap["placement:footer_thumb"],
      "Small team thumbnail"
    );
  });
});
