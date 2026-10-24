# WP-03 / WP-04 — Canonical Editor and Business Website Audit

**Created:** 24 October 2026  
**Branch:** `phase2/production-hardening` based on `sconfigtesting`.  
**Planning authority:** *ForgeStudio AI — Phase 2 Product Completion & Delivery Blueprint* and [PRODUCT_COMPLETION_SCOPE_AND_LEDGER.md](./PRODUCT_COMPLETION_SCOPE_AND_LEDGER.md).  
**Method:** Preserve existing Express controllers/services, React feature components and Prisma schema. Reference these issue IDs before editing. Add code, negative regression tests, positive journey tests, evidence links, then update status. No sweeping reorganization or repeated codebase audits.

## Existing user journeys and code authorities

| Product journey | Frontend entry | Backend authority | Current qualification |
| --- | --- | --- | --- |
| Edit design and reusable/global widgets | `features/global-widget/`, `pages/editor/` | `routes/template.routes.ts`, `services/template.service.ts` | API persistence unit coverage; no full editor-to-published-site E2E |
| Templates and kits | `features/templates/`, `features/templates/services/templateService.ts` | `controllers/template.controller.ts`, `services/template.service.ts` | API-contract tests added; kit application and publish tests pending |
| Public form to persisted lead | `pages/editor/components/forms/`, published form widget | `routes/form.routes.ts` → `form.service.ts` → `services/leads/leadIntake.service.ts` | Durable intake exists; visitor submission-to-owner-notification E2E not certified |
| Lead review/export/PDF | `pages/dashboard/components/FormSubmissionsModal.tsx` | `controllers/form.controller.ts`, `services/form/pdf.service.ts` | CSV formula-injection protection added; full visitor/owner E2E pending |
| Upload/insert/list media | `pages/editor/components/media/` | `routes/upload.routes.ts`, `middlewares/upload.middleware.ts`, `services/media.service.ts` | Legacy local upload hardening; durable production object storage is NOT delivered by this change |
| Content management | Editor CMS bindings, loops and dynamic pages | `services/cms/`, CPT and CMS routes | Not qualified across create/update/list/detail/SEO/publish |

**Important:** The parallel `services/formsLeads/atomicSubmissionBoundary.service.ts` in-memory submission map is not mounted as a public endpoint. The current public form route delegates to durable `leadIntake.service.ts`. Do not switch to in-memory paths for production.

## Single authoritative issue list

| ID | Priority | Root cause + owning file | Fix / release acceptance | Status |
| --- | --- | --- | --- | --- |
| WP03-01 | P1 | `features/templates/services/templateService.ts`: 200 malformed payload yielded `[]`; save/update/share could return undefined as success | Require expected template/list response contracts and surface real errors; frontend test | FIX COMMITTED — CI pending |
| WP03-02 | P0 | Editor widget registry differs from published renderer; some advertised widgets vanish on publish (historical audit) | Current widget-type registry parity matrix, editor/save/reopen/preview/publish browser E2E for every advertised type | OPEN |
| WP03-03 | P0 | Editor save and template update concurrency might overwrite newer versions | Version compare/conditional update with 409 and recoverable UI state; competing-editor integration test | OPEN |
| WP03-04 | P1 | Global-widget source changes do not prove propagated instance updates | Explicit model for linked instances + stable identity, or honest reusable-copy UX with no auto-sync claim | OPEN |
| WP04-01 | P0 | `services/media.service.ts`: client-supplied `websiteId` was not checked against media owner's websites | Website ownership check on create/list/reassign; negative tenant tests | FIX COMMITTED — CI pending |
| WP04-02 | P1 | `controllers/form.controller.ts`: CSV exported visitor-supplied values and headers without formula neutralization | Quote/escape field names and values; neutralize spreadsheet formulas; test malicious form data | FIX COMMITTED — CI pending |
| WP04-03 | P0 | `middlewares/upload.middleware.ts`: local file write could return success after MediaAsset DB failure; extension/MIME spoofing and active SVG | Require authenticated + metadata-confirmed file, remove file on failure, signature-sniff raster, reject unsanitized SVG, production local-storage quarantine | FIX COMMITTED — CI pending; durable production upload remains OPEN |
| WP04-04 | P0 | Production media uses legacy `uploads/images` application disk, not durable object-storage pipeline | Wire authenticated upload to existing organization-scoped object storage/quarantine, signed asset retrieval and CDN; upload → browser → published URL → retention/recovery test | OPEN |
| WP04-05 | P0 | `services/form/form.service.ts`: public submission request carries `actions` (email recipient, webhook and third-party keys). Site owner trust of these settings has not been proven | Bind integration destinations and credentials to durable *server-owned* website/form configuration; never use anonymous client-supplied SMTP/webhook/Sheets/Mailchimp/Zapier secrets or targets | OPEN — security review and test mandatory |
| WP04-06 | P1 | Form schema, conditional rules, notification retries and idempotency need verified end-to-end visitor contracts | Live web form → transactional submission+lead+outbox → worker → owner lead UI test, duplicate and abuse cases | OPEN |
| WP04-07 | P0 | Website kits, CMS dynamic bindings/list-detail pages, SEO and published assets parity not fully qualified | Complete linked pages/assets and durable CMS E2E, content revision, search crawl tests | OPEN |
| WP04-08 | P1 | Media removal/reassignment and shared assets need usage/reference and recovery policy | Verify site usage before deletion, orphan cleanup, retention and CDN invalidation | OPEN |

## Scope exit requirements

**WP-03:** every advertised widget passes editor → save → reopen → preview → publish, responsive render matches, global widgets behave as labeled, concurrency errors cannot silently lose work, accessible UI and no hidden API failures.

**WP-04:** preview/apply website kit, CMS schemas/entries and public list/detail pages, form submission with durable lead/outbox and trusted actions, secure media upload with durable object storage and published delivery, safe CSV/PDF export, proven authorizations and recovery.

**Not included as a completion shortcut:** tests that only validate services using mocks, local disk artifacts mislabeled as durable production uploads, old audit lists as current proofs, or disabled endpoints described as implemented.

## Verification plan

Targeted CI is wired into `.github/workflows/phase2-qualification.yml`:
- `frontend/tests/wp03-template-service.test.ts`
- `backend/src/tests/wp04-media-ownership.test.ts`
- `backend/src/tests/wp04-form-csv-export.test.ts`
- `backend/src/tests/wp04-upload-safety.test.ts`
- Existing frontend global-widget and backend security suites, PostgreSQL integration, builds, identity/lint/AI gates.

**Evidence:** Link the exact GitHub Actions run and SHA after passing. Do not mark any item complete merely on commit. Track P0 OPEN items above before declaring production or the five requested scopes complete.

## Work discipline

Audit source only once per issue; if the current architecture changes, update this file first. Implement narrow fixes in existing modules and tests, review diffs, run all relevant CI, keep `sconfigtesting` untouched, maintain draft PR #42 until independent review. Security-degraded or disabled features are explicitly **pending**, never called production-ready.
