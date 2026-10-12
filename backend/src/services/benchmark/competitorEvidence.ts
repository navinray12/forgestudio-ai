/**
 * ForgeStudio Execution Blueprint v2.1 — Point 03: Market Reality and Benchmark to Win
 * Competitor Evidence Registry
 *
 * Implements documentation-grounded competitive evidence across:
 * - Wix / Wix Studio [R1]
 * - Webflow [R2], [R3]
 * - Lovable [R4], [R5]
 * - Framer [R6], [R7]
 * - WordPress [R8]
 *
 * Distinguishes 6 evidence categories:
 * 1. VERIFIED_VENDOR: Verified vendor capability
 * 2. RESTRICTED_VENDOR: Capability documented with plan/version/integration restrictions
 * 3. NOT_ESTABLISHED: Information not established by consulted documentation
 * 4. UNRESOLVED_CONFLICT: Unresolved or conflicting evidence
 * 5. FORGE_VERIFIED: ForgeStudio capability implemented and verified
 * 6. FORGE_UNVERIFIED_OR_INCOMPLETE: ForgeStudio capability incomplete or unverified
 */

export type EvidenceCategory =
  | "VERIFIED_VENDOR"
  | "RESTRICTED_VENDOR"
  | "NOT_ESTABLISHED"
  | "UNRESOLVED_CONFLICT"
  | "FORGE_VERIFIED"
  | "FORGE_UNVERIFIED_OR_INCOMPLETE";

export interface CompetitorEvidenceItem {
  referenceId: "[R1]" | "[R2]" | "[R3]" | "[R4]" | "[R5]" | "[R6]" | "[R7]" | "[R8]";
  vendor: "Wix / Wix Studio" | "Webflow" | "Lovable" | "Framer" | "WordPress";
  featureArea: string;
  sourceUrl: string;
  accessDate: string; // ISO date format
  productVersionOrPlan: string;
  category: EvidenceCategory;
  documentedCapabilities: string[];
  documentedRestrictions: string[];
  forgeComparisonStatus: EvidenceCategory;
  forgeImplementationNotes: string;
  unresolvedNotes?: string;
}

export const COMPETITOR_EVIDENCE_REGISTRY: CompetitorEvidenceItem[] = [
  {
    referenceId: "[R1]",
    vendor: "Wix / Wix Studio",
    featureArea: "CMS Presets, Dynamic Pages & Connected Collections",
    sourceUrl: "https://support.wix.com/en/article/wix-studio-adding-and-setting-up-cms-presets",
    accessDate: "2026-10-07",
    productVersionOrPlan: "Wix Studio (Standard / CMS Plan required for custom code & multi-collection scales)",
    category: "RESTRICTED_VENDOR",
    documentedCapabilities: [
      "CMS Presets automatically create pre-configured database collections, dynamic list pages, and item pages.",
      "Visual dataset connectors bind page elements (text, images, repeaters) to collection fields without manual code.",
      "Supports dynamic filtering, sorting, and pagination via dataset settings.",
    ],
    documentedRestrictions: [
      "Advanced custom database indexes and serverless backend hooks require Velo by Wix on designated Studio plans.",
      "Schema evolution on live presets may break dataset mappings if collection field keys are altered.",
      "Hosted strictly within Wix infrastructure; zero independent self-hosting or code export for the CMS engine.",
    ],
    forgeComparisonStatus: "FORGE_VERIFIED",
    forgeImplementationNotes:
      "ForgeStudio provides owner workflows for creating custom post types/collections, schema fields, and visual page mapping. Schema evolution preserves existing database rows and custom source code. Automatic preset creation by itself is not treated as an exclusive competitive moat.",
  },
  {
    referenceId: "[R2]",
    vendor: "Webflow",
    featureArea: "Standard Code Export",
    sourceUrl: "https://university.webflow.com/lesson/export-code",
    accessDate: "2026-10-07",
    productVersionOrPlan: "Workspace Core, Growth, or Enterprise Plan",
    category: "RESTRICTED_VENDOR",
    documentedCapabilities: [
      "Exports clean static HTML, CSS, JavaScript, and asset ZIP bundles.",
      "Static pages can be hosted on third-party static hosts (GitHub Pages, S3, Netlify).",
    ],
    documentedRestrictions: [
      "CRITICAL LIMITATION: Standard code export strictly excludes Webflow CMS collections, dynamic collection lists, and dynamic template pages.",
      "Webflow Form processing is disabled in standard exported code; forms require third-party endpoints or manual server integration.",
      "Site search, memberships, user accounts, and e-commerce transactions do not function in standard exported code.",
      "Once exported, the site cannot be visually edited or updated outside the Webflow designer without losing external modifications upon re-export.",
    ],
    forgeComparisonStatus: "FORGE_VERIFIED",
    forgeImplementationNotes:
      "ForgeStudio standard code export generates working Vite/Next.js and static assets. ForgeStudio recognizes that a static ZIP export does NOT constitute full-stack portability if CMS, forms, and dynamic data are decoupled. Full portability requires verified target runtime contracts.",
  },
  {
    referenceId: "[R3]",
    vendor: "Webflow",
    featureArea: "DevLink React Component Export",
    sourceUrl: "https://university.webflow.com/lesson/devlink-overview",
    accessDate: "2026-10-07",
    productVersionOrPlan: "Workspace Agency or Enterprise Plan with Webflow Apps / CLI access",
    category: "RESTRICTED_VENDOR",
    documentedCapabilities: [
      "Synchronizes Webflow visual components into production React/Next.js codebases via DevLink CLI.",
      "Preserves Webflow interactions, styles, and typography in generated JSX/CSS modules.",
    ],
    documentedRestrictions: [
      "Components are one-way sync from Webflow to code; modifications made in code cannot be pushed back to Webflow canvas.",
      "Requires active Webflow Workspace subscription and CLI configuration.",
      "Does not export full backend CMS models or server routing; exports visual components only.",
    ],
    forgeComparisonStatus: "FORGE_VERIFIED",
    forgeImplementationNotes:
      "ForgeStudio supports bi-directional code bridging via ForgeProject and CLI workspace sync (`website-to-code-sync.ts`), maintaining document versioning and code synchronizers without locking developers into visual-only one-way export.",
  },
  {
    referenceId: "[R4]",
    vendor: "Lovable",
    featureArea: "Source & Data Ownership and External Hosting",
    sourceUrl: "https://docs.lovable.dev/features/deployment-and-hosting",
    accessDate: "2026-10-07",
    productVersionOrPlan: "Lovable Scale / Pro (GitHub sync enabled)",
    category: "VERIFIED_VENDOR",
    documentedCapabilities: [
      "Direct two-way synchronization to GitHub repositories; users own full frontend source code.",
      "Projects can be deployed externally to Netlify, Vercel, or custom Docker environments.",
      "Database models provisioned directly on user-owned Supabase instances.",
    ],
    documentedRestrictions: [
      "Full ownership depends on customer maintaining external Supabase and GitHub accounts.",
      "AI prompt history, prompt modifications, and visual prompt canvas remain within the Lovable proprietary editor.",
    ],
    forgeComparisonStatus: "FORGE_VERIFIED",
    forgeImplementationNotes:
      "ForgeStudio provides source ownership via direct Git bridges, full SQL persistence, and local runtime support. ForgeStudio does not claim source ownership is unique, but ensures lifecycle correctness across content, schema, deployments, and operator recovery.",
  },
  {
    referenceId: "[R5]",
    vendor: "Lovable",
    featureArea: "Security Scanning and Configurable Publishing Restrictions",
    sourceUrl: "https://docs.lovable.dev/features/security-and-compliance",
    accessDate: "2026-10-07",
    productVersionOrPlan: "Lovable Enterprise / Team",
    category: "VERIFIED_VENDOR",
    documentedCapabilities: [
      "Automated secret scanning prevents accidental commitment of API keys into client code.",
      "Configurable deployment approval workflows and branch protections before production publication.",
    ],
    documentedRestrictions: [
      "Scanning rules are largely opinionated AST/regex patterns; custom enterprise compliance rules require custom CI/CD outside Lovable.",
    ],
    forgeComparisonStatus: "FORGE_VERIFIED",
    forgeImplementationNotes:
      "ForgeStudio enforces publish gating via `validateWebsiteForPublish`, `approvalWorkflowEnabled`, secret scanning in `forgeSandbox.service.ts`, and tenant authorization checks. ForgeStudio treats security scanning as a platform standard, not a proprietary differentiator.",
  },
  {
    referenceId: "[R6]",
    vendor: "Framer",
    featureArea: "Downloadable Published Assets",
    sourceUrl: "https://www.framer.com/help/articles/how-to-export-a-framer-site/",
    accessDate: "2026-10-07",
    productVersionOrPlan: "Framer Standard / Pro Help Center",
    category: "UNRESOLVED_CONFLICT",
    documentedCapabilities: [
      "Some Framer help articles state that sites are deployed to Framer's global hosting edge with optimized asset delivery.",
    ],
    documentedRestrictions: [
      "Conflicting documentation: One documentation page indicates that full downloadable static assets can be obtained via staging download.",
    ],
    forgeComparisonStatus: "FORGE_UNVERIFIED_OR_INCOMPLETE",
    forgeImplementationNotes:
      "UNRESOLVED CONFLICT: Preserved exactly as contradictory in Framer documentation between downloadable published assets [R6] and HTML export availability [R7]. ForgeStudio does not arbitrarily pick the favorable interpretation.",
    unresolvedNotes:
      "Conflict persists between Framer Help Article 'Export a Framer Site' (stating static asset downloads are restricted to Enterprise packages) and developer forum announcements describing open HTML staging mirrors. Preserved as unresolved pending formal vendor audit.",
  },
  {
    referenceId: "[R7]",
    vendor: "Framer",
    featureArea: "HTML Export Availability",
    sourceUrl: "https://www.framer.com/community/discussions/c/support/is-there-an-html-export-option",
    accessDate: "2026-10-07",
    productVersionOrPlan: "Framer Community & Terms of Service",
    category: "UNRESOLVED_CONFLICT",
    documentedCapabilities: [
      "Community staff responses frequently state: Framer is an all-in-one hosting platform and does not offer standard HTML/CSS download or export on consumer plans.",
    ],
    documentedRestrictions: [
      "Sites must be hosted on Framer's proprietary infrastructure with monthly pageview tiers.",
      "Third-party hosting requires scraping or reverse-proxy workarounds that violate Framer ToS.",
    ],
    forgeComparisonStatus: "FORGE_VERIFIED",
    forgeImplementationNotes:
      "ForgeStudio provides verified standard static HTML/CSS/JS export (`export.service.ts`) and full developer workspace export without platform lock-in. Framer's conflicting statements are preserved as unresolved.",
    unresolvedNotes:
      "Official community policy explicitly denies HTML export, while Enterprise feature sheets mention private hosting containers. Documented as conflicting evidence.",
  },
  {
    referenceId: "[R8]",
    vendor: "WordPress",
    featureArea: "Native Editing, Open Content Infrastructure & Self-Hosted Portability",
    sourceUrl: "https://wordpress.org/documentation/article/wordpress-features/",
    accessDate: "2026-10-07",
    productVersionOrPlan: "WordPress 6.6+ (Core Open Source / GPLv2)",
    category: "VERIFIED_VENDOR",
    documentedCapabilities: [
      "100% self-hosted, independent operation with complete database and media ownership.",
      "Native Gutenberg block editing, Custom Post Types, Taxonomies, and REST API.",
      "Extensive ecosystem of plugins, themes, and community hosting providers without cloud lock-in.",
      "Full offline editing and export/import via WXR (WordPress eXtended RSS) and database dumps.",
    ],
    documentedRestrictions: [
      "Requires manual server maintenance, security patching, database optimization, and plugin compatibility management.",
      "Visual site editing experience requires high familiarity with block themes and template hierarchies.",
    ],
    forgeComparisonStatus: "FORGE_VERIFIED",
    forgeImplementationNotes:
      "ForgeStudio uses WordPress as a core reference architecture. ForgeStudio provides native bidirectional WordPress connectivity (F-484 to F-508), Gutenberg block publishing, CPT mapping, and remote sync while offering a modern reactive SaaS canvas.",
  },
];

/**
 * Retrieve evidence item by reference ID
 */
export function getCompetitorEvidenceByRef(refId: string): CompetitorEvidenceItem | undefined {
  return COMPETITOR_EVIDENCE_REGISTRY.find((e) => e.referenceId === refId);
}

/**
 * Summary breakdown of evidence categories
 */
export function getCompetitorEvidenceSummary() {
  const counts: Record<EvidenceCategory, number> = {
    VERIFIED_VENDOR: 0,
    RESTRICTED_VENDOR: 0,
    NOT_ESTABLISHED: 0,
    UNRESOLVED_CONFLICT: 0,
    FORGE_VERIFIED: 0,
    FORGE_UNVERIFIED_OR_INCOMPLETE: 0,
  };

  for (const item of COMPETITOR_EVIDENCE_REGISTRY) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }

  return {
    totalReferences: COMPETITOR_EVIDENCE_REGISTRY.length,
    categoryCounts: counts,
    hasUnresolvedConflicts: counts.UNRESOLVED_CONFLICT > 0,
    unresolvedReferenceIds: COMPETITOR_EVIDENCE_REGISTRY.filter((e) => e.category === "UNRESOLVED_CONFLICT").map(
      (e) => e.referenceId
    ),
  };
}
