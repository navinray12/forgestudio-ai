export type ReadinessCategory =
  | "WEB_SEARCH"
  | "LOCAL_SEARCH"
  | "PRODUCT_SEARCH"
  | "IMAGE_VIDEO_SEARCH"
  | "INDEXABILITY"
  | "AI_SEARCH_SURFACES";

export type ReadinessState =
  | "CONFIGURED"
  | "TECHNICALLY_CHECKED"
  | "SUBMITTED_WHERE_APPLICABLE"
  | "OBSERVED"
  | "UNAVAILABLE"
  | "INELIGIBLE";

export interface SearchReadinessItem {
  id: string;
  category: ReadinessCategory;
  name: string;
  state: ReadinessState;
  targetPropertyOrRoute: string;
  evidenceCollectionTimestamp: string;
  evidenceType: "TECHNICAL_CHECK" | "PROVIDER_SUBMISSION_RECEIPT" | "OBSERVED_OUTCOME";
  remediation?: string;
  limitations?: string;
}

export interface SearchReadinessReport {
  websiteId: string;
  items: SearchReadinessItem[];
  summary: {
    totalItems: number;
    technicallyCheckedCount: number;
    submittedCount: number;
    observedCount: number;
    actionRequiredCount: number;
  };
  generatedAt: string;
}

export function generateSearchReadinessReport(params: {
  websiteId: string;
  canonicalDomain: string;
  sitemapGenerated: boolean;
  sitemapSubmittedToGsc: boolean;
  robotsTxtValid: boolean;
  localBusinessSchemaPresent: boolean;
  hasProductOfferings: boolean;
}): SearchReadinessReport {
  const {
    websiteId,
    canonicalDomain,
    sitemapGenerated,
    sitemapSubmittedToGsc,
    robotsTxtValid,
    localBusinessSchemaPresent,
    hasProductOfferings,
  } = params;

  const now = new Date().toISOString();
  const items: SearchReadinessItem[] = [
    // 1. Robots.txt
    {
      id: "sr:robots_txt",
      category: "INDEXABILITY",
      name: "Robots.txt & Crawl Directives",
      state: robotsTxtValid ? "TECHNICALLY_CHECKED" : "UNAVAILABLE",
      targetPropertyOrRoute: `https://${canonicalDomain}/robots.txt`,
      evidenceCollectionTimestamp: now,
      evidenceType: "TECHNICAL_CHECK",
      remediation: robotsTxtValid ? undefined : "Generate robots.txt with valid sitemap directive",
    },
    // 2. XML Sitemap
    {
      id: "sr:xml_sitemap",
      category: "INDEXABILITY",
      name: "XML Sitemap Generation & Routing",
      state: sitemapGenerated
        ? sitemapSubmittedToGsc
          ? "SUBMITTED_WHERE_APPLICABLE"
          : "TECHNICALLY_CHECKED"
        : "UNAVAILABLE",
      targetPropertyOrRoute: `https://${canonicalDomain}/sitemap.xml`,
      evidenceCollectionTimestamp: now,
      evidenceType: sitemapSubmittedToGsc ? "PROVIDER_SUBMISSION_RECEIPT" : "TECHNICAL_CHECK",
      remediation: !sitemapGenerated
        ? "Publish website pages to generate XML sitemap"
        : !sitemapSubmittedToGsc
        ? "Submit sitemap to Google Search Console via verified property"
        : undefined,
      limitations: sitemapSubmittedToGsc
        ? "Submission receipt confirmed; search engine crawling operates on external schedule"
        : "Sitemap exists locally but has not been submitted to search engines",
    },
    // 3. Local Business Schema
    {
      id: "sr:local_schema",
      category: "LOCAL_SEARCH",
      name: "LocalBusiness Structured Data (JSON-LD)",
      state: localBusinessSchemaPresent ? "TECHNICALLY_CHECKED" : "CONFIGURED",
      targetPropertyOrRoute: `https://${canonicalDomain}/`,
      evidenceCollectionTimestamp: now,
      evidenceType: "TECHNICAL_CHECK",
      remediation: localBusinessSchemaPresent
        ? undefined
        : "Configure verified physical address and operating hours in Business Facts",
    },
    // 4. Product Search
    {
      id: "sr:product_schema",
      category: "PRODUCT_SEARCH",
      name: "Product & Offer Structured Data",
      state: hasProductOfferings ? "TECHNICALLY_CHECKED" : "INELIGIBLE",
      targetPropertyOrRoute: `https://${canonicalDomain}/offerings`,
      evidenceCollectionTimestamp: now,
      evidenceType: "TECHNICAL_CHECK",
      remediation: hasProductOfferings ? undefined : "Site profile does not configure transactional products",
    },
    // 5. AI Search Surfaces
    {
      id: "sr:ai_search_readiness",
      category: "AI_SEARCH_SURFACES",
      name: "AI Search Quality & Citability",
      state: "TECHNICALLY_CHECKED",
      targetPropertyOrRoute: `https://${canonicalDomain}/`,
      evidenceCollectionTimestamp: now,
      evidenceType: "TECHNICAL_CHECK",
      remediation: undefined,
      limitations: "Conforms to official Google crawlable content guidance. ForgeStudio does not sell synthetic ranking scores.",
    },
  ];

  const technicallyCheckedCount = items.filter((i) => i.state === "TECHNICALLY_CHECKED").length;
  const submittedCount = items.filter((i) => i.state === "SUBMITTED_WHERE_APPLICABLE").length;
  const observedCount = items.filter((i) => i.state === "OBSERVED").length;
  const actionRequiredCount = items.filter((i) => i.state === "UNAVAILABLE" || !!i.remediation).length;

  return {
    websiteId,
    items,
    summary: {
      totalItems: items.length,
      technicallyCheckedCount,
      submittedCount,
      observedCount,
      actionRequiredCount,
    },
    generatedAt: now,
  };
}
