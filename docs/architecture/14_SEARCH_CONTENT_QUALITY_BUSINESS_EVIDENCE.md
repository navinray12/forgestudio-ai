# 14 | Search, Content Quality and Business Evidence Architecture
## ForgeStudio Execution Blueprint v2.1 — Point 14 Technical Specification

---

## 1. Executive Summary & Purpose

Point 14 unifies technical SEO, content quality, and verified business claims into an auditable evidence system. It treats search optimization as an aspect of strict route correctness, establishes an owner-facing Search Readiness workspace, adheres to official search engine guidance without selling speculative "AI ranking scores", maps price/offer change dependencies, and manages media rights and metadata sanitization.

---

## 2. SEO as Route Correctness

Implemented in `seoRouteDelivery.service.ts`:
- **Real HTTP Status Codes**: Returns HTTP 200 for live pages, 301/302 for redirects, 404 for unreleased/missing routes, and 410 for trashed/purged resources. Soft-404s (returning 200 with error HTML) are strictly avoided.
- **Trusted Canonical Hosts**: Canonical URLs derive exclusively from verified website configuration rather than incoming client `Host` headers.
- **Redirect Loops**: Proactively detects circular redirects before serving responses.
- **Public Projections**: Draft content, internal notes, trashed revisions, and private fields are strictly blocked from public crawler delivery.

---

## 3. Search Readiness Workspace

Implemented in `searchReadinessWorkspace.service.ts`:
- **Readiness Categories**: Standard Web Search, Local Search, Product Search, Image/Video Search, Indexability, AI Search Surfaces.
- **State Dimensions**: Distinguishes `CONFIGURED`, `TECHNICALLY_CHECKED`, `SUBMITTED_WHERE_APPLICABLE`, `OBSERVED`, `UNAVAILABLE`, and `INELIGIBLE`.
- **Truthful Evidence Distinction**: Clearly differentiates between local technical checks (e.g. sitemap generated), provider submission receipts (e.g. submitted to Google Search Console), and external observed outcomes (e.g. verified indexing).

---

## 4. Truthful AI Search Guidance

Implemented in `aiSearchGuidance.service.ts`:
- Adheres strictly to official Google Search Central guidance: accessible HTML content, crawlable navigation, original information, valid Schema.org structured data, and trustworthy claims.
- **Anti-Speculation Guarantee**: Rejects and refuses to display invented "AI Optimization Scores" or promises of guaranteed generative search inclusion.

---

## 5. Authoritative Fact and Offer Register

Implemented in `factOfferRegister.service.ts`:
- Extends Record 1 (Business Facts): tracks statement wording, evidence references, reviewer approval, validity windows, and dependent surfaces (pages, campaigns, chatbot prompts, downloads).
- **Price/Offer Change Impact Preview**: Before activating a price or promotion change, generates an impact preview detailing all affected pages and active campaigns.
- **Historical Protection**: Historical customer quotes and existing orders remain protected with the terms agreed upon at creation.

---

## 6. Media Rights, Licensing & Contextual Alt Text

Implemented in `mediaMetadataRights.service.ts`:
- **Metadata Sanitization**: Strips private EXIF metadata (GPS coordinates, camera serial numbers, device models) while preserving copyright, license type, and author provenance.
- **License Expiry**: An expired asset license suspends public display without destructively purging the historical protected source record.
- **Contextual Alt Text**: Maps distinct, purpose-specific alt text per placement rather than reusing a generic fallback string across unrelated contexts.
