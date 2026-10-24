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
| WP03-01 | P1 | `features/templates/services/templateService.ts`: 200 malformed payload yielded `[]`; save/update/share could return undefined as success | Require expected template/list response contracts and surface real errors; frontend test | FIXED — CI VERIFIED on `de5498d4` |
| WP03-02 | P0 | Editor widget registry differs from published renderer; some advertised widgets vanish on publish (historical audit) | Current widget-type registry parity matrix, editor/save/reopen/preview/publish browser E2E for every advertised type | OPEN |
| WP03-03 | P0 | Editor save and template update concurrency might overwrite newer versions | Version compare/conditional update with 409 and recoverable UI state; competing-editor integration test | OPEN |
| WP03-04 | P1 | Global-widget source changes do not prove propagated instance updates | Explicit model for linked instances + stable identity, or honest reusable-copy UX with no auto-sync claim | OPEN |
| WP04-01 | P0 | `services/media.service.ts`: client-supplied `websiteId` was not checked against media owner's websites | Website ownership check on create/list/reassign; negative tenant tests | FIXED — CI VERIFIED on `de5498d4` |
| WP04-02 | P1 | `controllers/form.controller.ts`: CSV exported visitor-supplied values and headers without formula neutralization | Quote/escape field names and values; neutralize spreadsheet formulas; test malicious form data | FIXED — CI VERIFIED on `de5498d4` |
| WP04-03 | P0 | `middlewares/upload.middleware.ts`: local file write could return success after MediaAsset DB failure; extension/MIME spoofing and active SVG | Require authenticated + metadata-confirmed file, remove file on failure, signature-sniff raster, reject unsanitized SVG, production local-storage quarantine | FIXED — CI VERIFIED on `de5498d4`; durable production upload remains OPEN |
| WP04-04 | P0 | Production media uses legacy `uploads/images` application disk, not durable object-storage pipeline | Wire authenticated upload to existing organization-scoped object storage/quarantine, signed asset retrieval and CDN; upload → browser → published URL → retention/recovery test | OPEN |
| WP04-05 | P0 | `services/form/form.service.ts`: public submission request carries `actions` (email recipient, webhook and third-party keys). Site owner trust of these settings has not been proven | Bind integration destinations and credentials to durable *server-owned* website/form configuration; never use anonymous client-supplied SMTP/webhook/Sheets/Mailchimp/Zapier secrets or targets | OPEN — security review and test mandatory |
| WP04-06 | P1 | Form schema, conditional rules, notification retries and idempotency need verified end-to-end visitor contracts | Live web form → transactional submission+lead+outbox → worker → owner lead UI test, duplicate and abuse cases | OPEN |
| WP04-07 | P0 | Website kits, CMS dynamic bindings/list-detail pages, SEO and published assets parity not fully qualified | Complete linked pages/assets and durable CMS E2E, content revision, search crawl tests | OPEN |
| WP04-08 | P1 | Media removal/reassignment and shared assets need usage/reference and recovery policy | Verify site usage before deletion, orphan cleanup, retention and CDN invalidation | OPEN |

## Scope exit requirements

**WP-03:** every advertised widget passes editor → save → reopen → preview → publish, responsive render matches, global widgets behave as labeled, concurrency errors cannot silently lose work, accessible UI and no hidden API failures.

**WP-04:** preview/apply website kit, CMS schemas/entries and public list/detail pages, form submission with durable lead/outbox and trusted actions, secure media upload with durable object storage and published delivery, safe CSV/PDF export, proven authorizations and recovery.

**Not included as a completion shortcut:** tests that only validate services using mocks, local disk artifacts mislabeled as durable production uploads, old audit lists as current proofs, or disabled endpoints described as implemented.

## Verification evidence — latest code and documentation checkpoint

[Phase 2 qualification run 40081631402](https://github.com/navinray12/forgestudio-ai/actions/runs/40081631402), commit `de5498d419ec2ab862380af6a37ba7a1ba4051f6`, **7/7 jobs passed**:

- Backend and frontend production builds
- **102/102 focused backend regression tests**, including media ownership, CSV safety and the legacy local upload contract
- **21/21 frontend contract tests**, including template save/list/update/share error handling and Global Widgets
- **247/247 broader MCP/security/XSS tests**
- 42 versioned database migrations and **11/11 real tenant HTTP/PostgreSQL tests**
- **14/14 restricted-role PostgreSQL RLS tests**

The independent [AI/worker qualification](https://github.com/navinray12/forgestudio-ai/actions/runs/40081631394) and frontend lint check also passed at the same code SHA. Identity qualification may have a longer browser stage and is not counted as passed until completed. Subsequent documentation or code commits require their own exact-SHA check.

**Product certification remains NO-GO:** site publishing parity, trusted form integration configuration, complete CMS/template/kit journeys and durable production media storage remain open P0 work. The quarantine on production legacy disk uploads is safety containment, not delivery of the production upload feature.

## Upload quota integrity checkpoint — 24 October 2026

**WP04-09 — UPLOAD CONFIRMATION REPLAY/QUOTA (FIXED — CI VERIFIED):** `storage/upload-presigner.service.ts#confirmUpload` now treats matching already-recorded S3 keys idempotently, blocks conflicting claims and uses an atomic conditional bucket quota reservation before insertion. `wp04-confirm-upload-authorization.test.ts` covers retries, concurrent reservation denial, ownership and metadata. S3 HEAD evidence is retained. Real concurrent S3+PostgreSQL upload/load and CDN-publication tests are **still OPEN**; this does not complete WP04-04.

## Verification plan

Targeted CI is wired into `.github/workflows/phase2-qualification.yml`:
- `frontend/tests/wp03-template-service.test.ts`
- `backend/src/tests/wp04-media-ownership.test.ts`
- `backend/src/tests/wp04-form-csv-export.test.ts`
- `backend/src/tests/wp04-upload-safety.test.ts`
- Existing frontend global-widget and backend security suites, PostgreSQL integration, builds, identity/lint/AI gates.

**Evidence:** Link the exact GitHub Actions run and SHA after passing. Do not mark any item complete merely on commit. Track P0 OPEN items above before declaring production or the five requested scopes complete.

## Six-task follow-up — editor and website services (24 October 2026)

- `WP03-03`: backend document writes already enforce documentVersion and reject stale writes with 412. New CI executes 41 editor history/save/publish/page-management tests. Real cross-browser competing-editor and published-renderer E2E remain OPEN; no redundant editor refactor.
- `WP04-05`: public form service now sources integration destinations, secrets, spam/validation policy and form name from authenticated owner-saved `Website.editorData`, never from visitor-request `actions`. Unknown form representations create durable lead **without** sending outbound integrations. Owner secrets must be migrated into encrypted server-only storage before production certification.
- `WP04-04`: public image transform now checks exact website key and an explicitly PUBLIC bucket. Storage URL configuration rejects default HTTP/MinIO production credentials, and S3 upload confirmation requires S3 HEAD evidence, tenant bucket ownership, quota and matching size/type. Real S3/CDN publish/restore integration remains OPEN; legacy local disk upload remains blocked for production.
- Form schema creation on service import removed; required form migration checked before server starts. New source-inventory hashes editor, route, CMS, tests and migrations per commit.
- [Detailed work register](./SIX_TASK_DELIVERY_EVIDENCE.md); verified source [CI run](https://github.com/navinray12/forgestudio-ai/actions/runs/40084498359) at `e2956e0d`: 126 focused backend, 41 editor journey, 21 frontend contract and 247 security tests passed. WP-03 and WP-04 remain IN PROGRESS pending user-facing scope exit tests.

## Production form credential control — 24 October 2026

**WP04-05 server-only policy storage IMPLEMENTED / CI VERIFIED** at `a0b0cfeb`:

- `prisma/migrations/20261024003000_form_delivery_policy_secrets/migration.sql` installs `form_delivery_policies`, keyed by website and form, with credential ciphertext, last actor and update timestamp. It is part of the **43 versioned migrations** proven on disposable PostgreSQL.
- `services/form/formDeliveryPolicy.service.ts` provides owner/admin-only encrypted PUT/GET-status/DELETE at `/api/forms/:websiteId/forms/:formId/delivery`. GET never returns SMTP, webhook or third-party credentials. Network destinations are validated and encryption fails closed without a dedicated production secret.
- `services/form/trustedFormPolicy.service.ts` resolves production delivery only from this server-only encrypted policy. Anonymous submissions and published editor JSON cannot choose outbound destinations.
- `services/websites/formEditorSecrets.guard.ts` and `save-document.ts` block newly persisted raw form API keys and access tokens in production editor JSON; published layout is not a secret store. Legacy secrets already saved before this gate require migration and exposure review.
- Production startup requires `FORGE_DATA_PLATFORM_SECRET` and verifies the migration before opening HTTP.
- `wp04-server-form-policy.test.ts`, `wp04-real-form-delivery.integration.test.ts`, `wp04-form-editor-secrets.test.ts` cover unauthorized tenant writes, encrypted SQL storage, production source isolation, raw-secret rejection and revocation.
- [Phase 2 run 40088546404](https://github.com/navinray12/forgestudio-ai/actions/runs/40088546404) on `a0b0cfeb`: **9/9 jobs passed**, including 165 focused backend tests and 16 actual HTTP/PostgreSQL integration tests.

**WP04-05 still NOT release-certified:** editor settings UX must call the new privileged policy API, existing plaintext editor documents must be migrated/redacted, provider-specific secret refs and real outbound delivery/retry must be exercised on a deployed staging website. Do not describe encryption-at-rest alone as production completion.

## Work discipline

Audit source only once per issue; if the current architecture changes, update this file first. Implement narrow fixes in existing modules and tests, review diffs, run all relevant CI, keep `sconfigtesting` untouched, maintain draft PR #42 until independent review. Security-degraded or disabled features are explicitly **pending**, never called production-ready.
