# ForgeStudio Execution Blueprint v2.1 — Point 03
## Competitor Evidence & Reference Mapping Registry

**Milestone:** Point 03: Market Reality and the Benchmark to Win  
**Date of Audit & Record:** 2026-10-12  
**Baseline Reference Standard:** Execution Blueprint v2.1, Section 3  

---

### 1. Evidence Classification Standards

Every competitive statement in this registry adheres to one of six mutually exclusive evidentiary classifications:
1. **`VERIFIED_VENDOR`**: Capability authoritatively documented by official vendor technical documentation or verified in production.
2. **`RESTRICTED_VENDOR`**: Documented capability subject to specific plan tiers, version bounds, or feature restrictions.
3. **`NOT_ESTABLISHED`**: Information not established or confirmed by consulted documentation (absence from documentation is NOT proof of absence).
4. **`UNRESOLVED_CONFLICT`**: Official vendor sources publish contradictory statements; preserved as unresolved pending vendor clarification.
5. **`FORGE_VERIFIED`**: ForgeStudio capability implemented and verified by automated or regression test suites.
6. **`FORGE_UNVERIFIED_OR_INCOMPLETE`**: ForgeStudio capability planned, partially implemented, or unverified.

---

### 2. Comprehensive Evidence & Reference Ledger

#### [R1] Wix / Wix Studio — CMS Presets & Dynamic Connected Pages
- **Vendor:** Wix / Wix Studio
- **Consulted Source:** [Wix Studio CMS Presets](https://support.wix.com/en/article/wix-studio-adding-and-setting-up-cms-presets)
- **Verification Date:** 2026-10-07
- **Product Version / Plan:** Wix Studio (Standard & Studio Plans; CMS collection volume quotas apply)
- **Classification:** `RESTRICTED_VENDOR`
- **Documented Capabilities:**
  - CMS Presets automatically create pre-configured database collections, dynamic list pages, and item pages.
  - Visual dataset connectors bind page elements (text, images, repeaters) to collection fields without manual code.
  - Supports dynamic filtering, sorting, and pagination via visual dataset controls.
- **Documented Restrictions:**
  - Advanced custom database indexes and serverless backend hooks require Velo by Wix on designated Studio plans.
  - Schema evolution on live presets may break dataset mappings if collection field keys are altered.
  - Hosted strictly within Wix proprietary cloud; zero independent self-hosting or code export for the CMS engine.
- **ForgeStudio Architectural Comparison:**
  - **Status:** `FORGE_VERIFIED`
  - ForgeStudio provides an understandable owner workflow for:
    1. Creating and configuring custom post types/collections via `customPostType.service.ts`.
    2. Connecting content dynamically to pages via tokens and loop widgets (`tokenResolver.ts`).
    3. Generating dynamic list and item page experiences.
    4. Evolving schemas with automatic backward compatibility (`point03-benchmark-qualification.test.ts`).
    5. Operating the resulting site as an independent, standalone website.
  - **Deliberate Reconciliation:** Automatic CMS preset creation is recognized as a convenient vendor pattern, **not** presented as a proprietary competitive moat.

---

#### [R2] Webflow — Standard Code Export Limitations
- **Vendor:** Webflow
- **Consulted Source:** [Webflow University — Export Code](https://university.webflow.com/lesson/export-code)
- **Verification Date:** 2026-10-07
- **Product Version / Plan:** Workspace Core, Growth, or Enterprise Plan
- **Classification:** `RESTRICTED_VENDOR`
- **Documented Capabilities:**
  - Exports clean static HTML, CSS, JavaScript, and asset ZIP bundles.
  - Static pages can be hosted on third-party static hosts (GitHub Pages, AWS S3, Cloudflare Pages, Netlify).
- **Documented Restrictions & Critical Limitations:**
  - **CRITICAL CMS EXCLUSION:** Standard code export strictly excludes Webflow CMS collections, dynamic collection lists, and dynamic template pages.
  - **FORM PROCESSING EXCLUSION:** Webflow native form processing is disabled in standard exported code; forms require third-party endpoints or manual server integration.
  - Site search, memberships, user accounts, and e-commerce transactions do not function in standard exported code.
  - Exported code cannot be re-imported into Webflow designer for further visual editing.
- **ForgeStudio Architectural Comparison:**
  - **Status:** `FORGE_VERIFIED`
  - ForgeStudio provides standard static export (`export.service.ts`), but explicitly recognizes that a static ZIP export does **not** constitute full-stack portability if CMS, forms, and dynamic data are lost. ForgeStudio tests portability against live target runtimes with preserved form handling.

---

#### [R3] Webflow — DevLink React Component Export
- **Vendor:** Webflow
- **Consulted Source:** [Webflow University — DevLink Overview](https://university.webflow.com/lesson/devlink-overview)
- **Verification Date:** 2026-10-07
- **Product Version / Plan:** Workspace Agency or Enterprise Plan with Webflow Apps / CLI access
- **Classification:** `RESTRICTED_VENDOR`
- **Documented Capabilities:**
  - Synchronizes Webflow visual components into production React/Next.js codebases via DevLink CLI.
  - Preserves Webflow interactions, styles, and typography in generated JSX/CSS modules.
- **Documented Restrictions:**
  - One-way synchronization: modifications made in external React code cannot be pushed back to the Webflow canvas.
  - Requires active Webflow Workspace subscription and CLI token configuration.
  - Does not export full backend CMS models or server routing; exports visual components only.
- **ForgeStudio Architectural Comparison:**
  - **Status:** `FORGE_VERIFIED`
  - ForgeStudio supports bi-directional code bridging via ForgeProject and CLI workspace sync (`website-to-code-sync.ts`), maintaining document versioning and code synchronizers without locking developers into visual-only one-way export.

---

#### [R4] Lovable — Source & Data Ownership and External Hosting
- **Vendor:** Lovable
- **Consulted Source:** [Lovable Documentation — Deployment and Hosting](https://docs.lovable.dev/features/deployment-and-hosting)
- **Verification Date:** 2026-10-07
- **Product Version / Plan:** Lovable Scale / Pro (GitHub sync enabled)
- **Classification:** `VERIFIED_VENDOR`
- **Documented Capabilities:**
  - Direct two-way synchronization to GitHub repositories; users own full frontend source code.
  - Projects can be deployed externally to Netlify, Vercel, or custom Docker environments.
  - Database models provisioned directly on user-owned Supabase instances.
- **Documented Restrictions:**
  - Full ownership depends on customer maintaining external Supabase and GitHub accounts.
  - AI prompt history, prompt modifications, and visual prompt canvas remain within the Lovable proprietary editor.
- **ForgeStudio Architectural Comparison:**
  - **Status:** `FORGE_VERIFIED`
  - ForgeStudio provides full source ownership, SQL migrations, and Git bridges. Source ownership is recognized as an industry standard, **not** claimed as unique to ForgeStudio.

---

#### [R5] Lovable — Security Scanning & Publishing Controls
- **Vendor:** Lovable
- **Consulted Source:** [Lovable Documentation — Security and Compliance](https://docs.lovable.dev/features/security-and-compliance)
- **Verification Date:** 2026-10-07
- **Product Version / Plan:** Lovable Enterprise / Team
- **Classification:** `VERIFIED_VENDOR`
- **Documented Capabilities:**
  - Automated secret scanning prevents accidental commitment of API keys into client code.
  - Configurable deployment approval workflows and branch protections before production publication.
- **Documented Restrictions:**
  - Scanning rules are largely opinionated AST/regex patterns; custom enterprise compliance rules require custom CI/CD outside Lovable.
- **ForgeStudio Architectural Comparison:**
  - **Status:** `FORGE_VERIFIED`
  - ForgeStudio enforces publish gating via `validateWebsiteForPublish`, `approvalWorkflowEnabled`, secret scanning in `forgeSandbox.service.ts`, and tenant authorization checks.

---

#### [R6] Framer — Downloadable Published Assets (Conflict A)
- **Vendor:** Framer
- **Consulted Source:** [Framer Help Center — Export a Framer Site](https://www.framer.com/help/articles/how-to-export-a-framer-site/)
- **Verification Date:** 2026-10-07
- **Product Version / Plan:** Framer Standard / Pro Help Center
- **Classification:** `UNRESOLVED_CONFLICT`
- **Documented Capabilities:**
  - Articles indicate that sites are deployed to Framer's global hosting edge with optimized asset delivery.
- **Documented Restrictions:**
  - Conflicting documentation: One documentation page indicates that full downloadable static assets can be obtained via staging download.
- **ForgeStudio Handling:**
  - **Status:** Preserved as an active `UNRESOLVED_CONFLICT`. ForgeStudio does not arbitrarily choose whichever statement favors it.

---

#### [R7] Framer — HTML Export Availability (Conflict B)
- **Vendor:** Framer
- **Consulted Source:** [Framer Community Official Support Discussions](https://www.framer.com/community/discussions/c/support/is-there-an-html-export-option)
- **Verification Date:** 2026-10-07
- **Product Version / Plan:** Framer Community & Terms of Service
- **Classification:** `UNRESOLVED_CONFLICT`
- **Documented Capabilities:**
  - Community staff responses frequently state: Framer is an all-in-one hosting platform and does not offer standard HTML/CSS download or export on consumer plans.
- **Documented Restrictions:**
  - Sites must be hosted on Framer's proprietary infrastructure with monthly pageview tiers.
  - Third-party hosting requires scraping or reverse-proxy workarounds that violate Framer ToS.
- **ForgeStudio Handling:**
  - **Status:** Preserved as an active `UNRESOLVED_CONFLICT` alongside [R6]. ForgeStudio provides verified static HTML/CSS/JS export (`export.service.ts`), while honestly documenting Framer's internal contradiction.

---

#### [R8] WordPress — Native Editing, Open Content Infrastructure & Portability
- **Vendor:** WordPress (Core Open Source / GPLv2)
- **Consulted Source:** [WordPress Features & Architecture](https://wordpress.org/documentation/article/wordpress-features/)
- **Verification Date:** 2026-10-07
- **Product Version / Plan:** WordPress 6.6+ Core
- **Classification:** `VERIFIED_VENDOR`
- **Documented Capabilities:**
  - 100% self-hosted, independent operation with complete database and media ownership.
  - Native Gutenberg block editing, Custom Post Types, Taxonomies, and REST API.
  - Extensive ecosystem of plugins, themes, and community hosting providers without cloud lock-in.
  - Full offline editing and export/import via WXR (WordPress eXtended RSS) and database dumps.
- **Documented Restrictions:**
  - Requires manual server maintenance, security patching, database optimization, and plugin compatibility management.
  - Visual site editing experience requires high familiarity with block themes and template hierarchies.
- **ForgeStudio Architectural Comparison:**
  - **Status:** `FORGE_VERIFIED`
  - ForgeStudio uses WordPress as a primary reference point. ForgeStudio provides native bidirectional WordPress connectivity (F-484 to F-508), Gutenberg block publishing, CPT mapping, and remote sync while offering a modern reactive SaaS canvas.
