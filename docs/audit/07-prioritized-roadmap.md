# 07 — Prioritized Roadmap

Built from the dependency graph in [06](06-gap-and-dependency-analysis.md). Each task references work items (WR), findings ([08](08-verification-and-evidence-ledger.md)) and features ([02](02-complete-feature-inventory.md)).
**Nothing here has been implemented.** Tasks marked *Decision* need a product decision before work starts.

## P0 — security, data integrity, release blockers

### P0-1 Close the unauthenticated execution and data surfaces (WR-01, WR-02, WR-03, WR-21)
- **Rationale**: SEC-01/02/03 allow remote code execution and cross-tenant data reads on the main API server; they outweigh every other risk.
- **Dependencies**: none. *Decision*: whether terminal/runtime/realtime ship in the website-builder product at all (open question 1). Safest first step regardless: stop routing `/ws/terminal` and `/ws/realtime` until authenticated.
- **Acceptance criteria**: upgrade requests to `/ws/terminal` and `/ws/realtime` without a valid session (and, for realtime, without project read permission) are rejected before any handler runs; cross-origin upgrades are rejected; terminal child processes receive an allow-listed environment with no platform secrets; tenant commands do not run as the API host user (container/VM isolation or feature disabled); `/api/hosted` requires auth (or is unmounted), uses a separator-safe path check, and returns 404 for unknown deployments.
- **Affected modules**: `websocketGateways.ts`, `services/terminal/forgeTerminal.service.ts`, `services/runtime/forgeSandbox.service.ts`, `modules/data-platform/data-layer/realtime.service.ts`, `routes/hosted.routes.ts`.
- **Regression tests**: new integration tests that attempt anonymous and cross-tenant upgrades for both gateways (pattern: `workspace-sync-gateway.integration.test.ts`); env-leak test asserting no `DATABASE_URL`/API key in the child environment; traversal tests for `/api/hosted` (`../sibling`, `..` id).

### P0-1b Lock down the data platform's SQL paths (WR-28) — added in 2nd pass
- **Rationale**: SEC-12/13/14 give any user who creates a project read/write access to the platform database and other tenants' data.
- **Dependencies**: none; same decision as P0-1 (whether the data platform ships in the website-builder product). Safest immediate step: disable `POST …/database/:databaseId/sql` and the table create/alter endpoints until fixed.
- **Acceptance criteria**: customer SQL and DDL run as a per-database role that owns only its schema (no `public`, no superuser, no `BYPASSRLS`); column types come from an allow-list and defaults are parameterised or validated; every data-platform handler loads the database by `(projectId, databaseId)`; a user cannot read `public.users` or another project's schema through any data-platform endpoint.
- **Affected modules**: `modules/data-platform/database/connectionManager.ts`, `forgeDatabase.service.ts`, `database-provisioner.service.ts`, `studio/databaseStudio.service.ts`, `controllers/dataPlatform.controller.ts`.
- **Regression tests**: integration tests attempting `SELECT … FROM public.users`, a type string containing `;`, and a foreign `databaseId`; existing `migration-authority`, `env-migration-target`, studio suites must still pass.

### P0-2 Revert OTP disclosure (WR-04)
- **Rationale**: SEC-04 disables email verification outside `production`, and the compose stack runs as `development`.
- **Dependencies**: none.
- **Acceptance criteria**: OTP codes never appear in HTTP responses or logs in any environment unless an explicit, documented local-only flag is set and the server refuses to start with that flag when `NODE_ENV=production` or a non-localhost bind; delivery failure leaves the challenge unusable (as in the committed version).
- **Affected modules**: `modules/identity/application/local-authentication.ts`, `modules/identity/http/local.routes.ts`.
- **Regression tests**: `identity-security.test.ts`, `local-otp-delivery.test.ts`, plus a test asserting the response body has no `devOtp` field.

### P0-3 One schema authority and a proven fresh install (WR-06)
- **Rationale**: DATA-01/DATA-06 — the dev DB cannot take migrations, the test DB has no history, and features that depend on new migrations fail (4 failing tests). No evidence that a clean install works.
- **Dependencies**: none; unblocks P1-1, P1-3, P2-3, P2-4. *Decision*: migrations as sole authority (open question 4).
- **Acceptance criteria**: on an empty PostgreSQL 15 database, `prisma migrate deploy` alone produces a schema on which the API boots with zero `[DATABASE] Schema notice` lines and all integration suites pass; boot-time DDL is removed or reduced to verification that fails startup on drift; `prisma migrate status` is clean on a rebuilt dev DB; the 4 orphan migration names are reconciled or documented; plans are seeded by migration.
- **Affected modules**: `prisma/migrations/*`, `config/ensure-schema.ts`, `config/db-init.ts`, per-service `CREATE TABLE` calls, `config/prisma-fallback.ts`, `server.ts`.
- **Regression tests**: CI job "fresh-install": empty DB → `migrate deploy` → boot → full integration suite; `application-spec-persistence.integration` must pass.

### P0-4 Sanitize editor HTML (WR-05)
- **Rationale**: SEC-05 cross-collaborator stored XSS on the app origin.
- **Dependencies**: none.
- **Acceptance criteria**: editor canvas renders `html` and `custom_html` through the same sanitizer as `components/HtmlNode.tsx`; a payload with event-handler attributes or `<script>` does not execute in the editor; published output unchanged.
- **Affected modules**: `pages/editor/WebsiteEditor.tsx` (~7225), `pages/editor/widgets/WpLegacyWidgetRenderer.tsx`.
- **Regression tests**: unit test of the shared sanitizer (via the backend-hosted frontend-module import pattern used by `canvas-to-source-sync`) and a browser check once P1-6 exists.

### P0-1c Close the public data API (WR-34) — added in 3rd pass
- **Rationale**: SEC-16 — anyone, without credentials, can read and modify every table of every provisioned customer database.
- **Dependencies**: none. Safest immediate step: unmount `/api/v1/data` and `/api/data` until fixed.
- **Acceptance criteria**: requests without a valid project key or verified session are rejected; JWTs are verified against a per-project secret (or not accepted); keys not found in `project_api_keys` are rejected in every environment; `anon` requests are limited by RLS policies or grants that the provisioner creates; a test with a forged `fg_sec_` key, an unsigned JWT and no credentials gets 401/403 on GET/POST/PATCH/DELETE.
- **Affected modules**: `modules/data-platform/data-layer/{data.routes,data.controller,rls-claim-injector}.ts`, `database/database-provisioner.service.ts`, `common/pool-manager.ts`, generated SDK.
- **Regression tests**: the three forged-credential tests above; `modules25-28-data-platform` (after repairing its stale import, QA-09).

### P0-5 Publish integrity (WR-07)
- **Rationale**: DATA-02 lost updates and unreviewed publish payloads.
- **Dependencies**: none (complements P0-3).
- **Acceptance criteria**: publish requires `If-Match` on `documentVersion`, publishes exactly the stored draft at that version (request `editorData` rejected), and writes the snapshot under the same CAS; a concurrent save yields `412` on one side, never silent overwrite.
- **Affected modules**: `services/publishing.service.ts`, `controllers/publishing.controller.ts`, `features/publishing/services/publishingService.ts`, `PublishModal.tsx`.
- **Regression tests**: integration test racing save vs. publish; existing `phase4-publishing`, `point17-release-integrity` scripts.

## P1 — essential for a usable standalone product

### P1-1 Explicit onboarding (WR-08)
- **Rationale**: PROD-01 — first-site creation depends on GET side effects and seeded plans.
- **Dependencies**: P0-3 (plans by migration). *Decision*: subscription owner (open question 2).
- **Acceptance criteria**: completing signup OTP creates (idempotently, in one transaction) the subscription and default workspace; a brand-new user on a fresh install can create a site immediately with no other request; GET endpoints become side-effect-free; dead `signup.service.ts` removed or reused.
- **Affected modules**: identity `finish`, `subscription.service.ts`, `usage.service.ts`, `subscription.controller.ts`, `create-personal-website.ts`.
- **Regression tests**: integration "signup → verify → POST /websites" on a fresh DB.

### P1-2 Real hosting for published sites (WR-09, WR-10, WR-16 part)
- **Rationale**: PROD-04 — sites are not reachable as standalone websites, not crawlable, and custom domains/SSL are fabricated.
- **Dependencies**: P0-5, P1-4 (durable assets), release storage moved out of `editorData` (P2-3). *Decision*: hosting model (open question 3).
- **Acceptance criteria**: each publish produces an immutable release artifact (static HTML/CSS/JS per page, server-rendered meta tags); a default per-site host (e.g. subdomain) serves it from an origin separate from the app; custom domains route by `Host`; certificates come from a real ACME client or managed edge and status reflects the provider; rollback switches the served release; all fabricated SSL fields removed.
- **Affected modules**: `publishing.service.ts`, `services/domains/*`, `services/hosting/*`, `PublishedSite.tsx` (shared renderer), new static renderer, infra config.
- **Regression tests**: publish → fetch HTML over HTTP (no JS) contains page content and meta; rollback test; domain verification test against a controlled DNS fixture.

### P1-3 Billing linked to entitlements (WR-11)
- **Rationale**: PROD-02 — customers cannot pay; payments would not raise limits.
- **Dependencies**: P0-3, P1-1, *Decision* on subscription owner.
- **Acceptance criteria**: one Stripe integration; checkout reachable from `SubscriptionPage`; verified webhook updates the entitlement record that `createPersonalWebsite`/workspace APIs read; downgrade/cancel/expiry behave per policy; duplicate stack removed.
- **Affected modules**: `modules/billing/*` or `services/billing/*`, `subscription.service.ts`, `services/billing/subscription-policy.ts`, `SubscriptionPage.tsx`, `SubscriptionBillingPanel.tsx`.
- **Regression tests**: webhook signature + idempotency tests (Stripe test mode, BLOCKED until keys), entitlement change → limit change integration test.

### P1-4 Durable, safe media (WR-13)
- **Rationale**: SEC-07, PROD-07 — unsafe validation, no quota, local disk.
- **Dependencies**: P0-3; storage decision (S3/MinIO already supported).
- **Acceptance criteria**: editor uploads go through the governed file pipeline (magic-byte sniffing, size enforced while streaming, SVG sanitized or served with `Content-Disposition`/separate origin, quarantine scan); per-plan storage quota enforced; delete removes the object; URLs stable for published sites.
- **Affected modules**: `middlewares/upload.middleware.ts`, `routes/upload.routes.ts`, `services/media.service.ts`, `modules/files`, `services/files`, `MediaLibraryModal.tsx`, editor upload calls.
- **Regression tests**: upload fuzz (wrong magic bytes, oversized stream, SVG with script), quota exceeded, delete.

### P1-5 AI cost control (WR-12)
- **Rationale**: PROD-03 — unbounded spend on the most expensive path.
- **Dependencies**: P1-3 for plan credits (daily quota can ship first).
- **Acceptance criteria**: site generation reserves and settles quota like the other generators; plan `aiCreditLimit` enforced; usage endpoint reports real consumption; generation runs as a durable job with progress and cancel; per-user rate limit on AI routes.
- **Affected modules**: `modules/ai/site-generation.service.ts`, `ai-quota.ts`, `usage.service.ts`, `ai.routes.ts`, worker registration.
- **Regression tests**: quota exhaustion returns 429 without provider call (provider mocked); job recovery after worker restart.

### P1-6 Evidence for the core journey (WR-17)
- **Rationale**: QA-04/QA-05 — the editor and publish→view have no executed tests; CI is fragmented.
- **Dependencies**: P0-3 (fresh DB in CI).
- **Acceptance criteria**: one CI pipeline on every PR runs backend typecheck, frontend build, all vitest suites on a fresh migrated DB, and a Playwright journey: signup (OTP via test mailbox) → create site → edit → reload persists → publish → view public page → rollback.
- **Affected modules**: `.github/workflows/*`, `tests/browser/*`, root `package.json`.
- **Regression tests**: the pipeline itself.

### P1-7 Observability and backups (WR-15, WR-16 backups)
- **Rationale**: QA-06, QA-07 — failures are invisible and the platform DB has no backup.
- **Dependencies**: none (can run in parallel with P1-1..5).
- **Acceptance criteria**: structured JSON logs with request ids; error tracking for API and SPA; metrics for request latency, job queue depth, AI spend; alerting on 5xx rate and job dead letters; scheduled PostgreSQL backups with a tested restore runbook; empty `catch {}` on audit/deployment paths replaced by logged failures.
- **Affected modules**: `app.ts`, `server.ts`, `error.middleware.ts`, `jobRunner.ts`, infra.
- **Regression tests**: log-shape test; restore drill documented and executed.

### P1-8 Least-privilege database role (WR-14)
- **Rationale**: SEC-08.
- **Dependencies**: P0-3.
- **Acceptance criteria**: API connects as a non-superuser without `BYPASSRLS`; migrations use a separate owner role; `tenant-rls.integration` passes under the app role.
- **Affected modules**: deployment config, `platform/tenancy/rls.ts`, `prisma/rls/*`.
- **Regression tests**: `tenant-rls.integration`, `tenant-scoped-apis.integration` under the new role.

### P1-9 Published-site widget parity (WR-29) — added in 2nd pass
- **Rationale**: PROD-10 — 21 widget types users can build with vanish after publishing; 20 declared types have no implementation.
- **Dependencies**: P1-6 (browser tests) to prove parity; complements P1-2 (whatever renders the live site must use the same registry).
- **Acceptance criteria**: a single widget registry maps every `ElementType` to one renderer used by editor canvas, preview and published site (or the type is removed from the palette and type union); an automated test fails if any palette type lacks a published renderer; unknown types render a visible placeholder in preview and are blocked by publish validation.
- **Affected modules**: `pages/published/PublishedSite.tsx`, `pages/editor/WebsiteEditor.tsx`, `widgets/renderers.tsx`, `types/index.ts`, `defaults/index.ts`, `publishing.service.ts` (validation).
- **Regression tests**: registry completeness unit test; Playwright: insert each widget → publish → assert visible on `/site/:id`.

### P1-10 Fix broken UI→API contracts (WR-30) — added in 2nd pass
- **Rationale**: PROD-11 — 9 live features fail with 404/405.
- **Dependencies**: none (small, independent); approval-request fix needs a decision on whether the approval workflow stays.
- **Acceptance criteria**: each call in [11](11-ui-api-contract-and-dead-code.md) §1 reaches an existing endpoint with the right method and prefix (or the UI control is removed); a CI check fails on any frontend API path that matches no backend route.
- **Affected modules**: `websiteKitService.ts`, `globalWidgetService.ts`, `PublishModal.tsx`, `ManagedSiteModal.tsx`, `renderers.tsx`, `WebsiteEditor.tsx`, `DynamicWidgetInspectors.tsx`, `atomicFormService.ts`, `app.ts` (integration mount), new approval route if kept.
- **Regression tests**: the route-contract check; integration tests for approval request → approve → publish.

### P1-11 One write path for the site document (WR-35, extends P0-5) — added in 3rd pass
- **Rationale**: DATA-07 — 16 code paths, two of them triggered by public visitors, can silently overwrite the owner's edits.
- **Dependencies**: P0-5 (same mechanism); P2-3 (moving releases/backups out of `editorData`) reduces the surface.
- **Acceptance criteria**: every write to `websites.editorData` goes through a function that checks and increments `documentVersion` (or the data moves to its own table); visitor events (experiments, orders) never write `editorData`; revision restore bumps the version; a race test (save vs. each writer) never loses the save.
- **Affected modules**: the 16 files listed in DATA-07.
- **Regression tests**: one race test per writer; existing publish/revision/experiment suites.

### P1-12 Staging isolation (WR-36) — added in 3rd pass
- **Rationale**: PROD-17 — creating a staging environment can publish an unpublished site.
- **Dependencies**: P0-5; P1-2 (hosting model decides where staging is served).
- **Acceptance criteria**: a STAGING deployment never changes `status`, `publishedData` or `currentReleaseId`; staging content is served only at a staging URL that requires auth or a preview token; promote is the only path from staging to live.
- **Affected modules**: `services/staging.service.ts`, `services/publishing.service.ts`.
- **Regression tests**: create staging on a never-published site → `/site/:id` still 404; promote → live.

### P1-13 Commerce and payment widgets (WR-37, WR-38) — added in 3rd pass
- **Rationale**: SEC-17, PROD-15 — client-set prices, unauthorised product management, payments into the platform's account.
- **Dependencies**: P1-3 (billing model), *Decision*: whether commerce/payment widgets ship at launch.
- **Acceptance criteria**: totals computed from stored product prices; product/settings management requires a commerce capability; public order creation rate-limited and stored in its own table; each site uses its own connected merchant/CRM account, or the widgets are hidden.
- **Affected modules**: `controllers/commerce.controller.ts`, `services/ecommerce/*`, `services/integration.service.ts`, `routes/integration.routes.ts`, widget renderers.
- **Regression tests**: tampered `unitPrice` rejected; viewer-role collaborator cannot edit products; widget without merchant config is disabled.

### P1-14 Autosave safety (WR-40) — added in 3rd pass
- **Rationale**: PROD-18 — silent loss of edits after a failed save.
- **Dependencies**: none.
- **Acceptance criteria**: failed saves retry with backoff; closing or navigating away while unsaved or failed shows a browser warning; unsaved edits survive a reload via local recovery and are offered back to the user.
- **Affected modules**: `features/autosave/*`, `WebsiteEditor.tsx`, `features/editor-access/document-save-coordinator.ts`.
- **Regression tests**: browser test (P1-6) that blocks the save endpoint, reloads, and recovers the edit.

## P2 — completeness, reliability, scalability

| Task | Rationale | Depends on | Acceptance criteria | Modules | Tests |
|---|---|---|---|---|---|
| P2-10 Wire or remove dead UI (WR-31) | PROD-12 | P1-4 for media library | Media library, design notes, component access manager reachable from the editor or removed with their APIs | editor components | browser checks |
| P2-11 Remove remaining fabricated outputs (WR-32) | PROD-13 | — | No job/service reports success or metrics it did not measure | `jobs/handlers.ts`, `imageOptimization`, `siteSecurity`, `serverConfig`, `pluginIntegration`, `customDomain` | unit tests per path |
| P2-12 Dead-code removal (WR-33) | ARCH-06 | P1-6 | Unreachable files deleted or documented; reachability check in CI | backend + frontend | reachability script |


| Task | Rationale | Depends on | Acceptance criteria | Modules | Tests |
|---|---|---|---|---|---|
| P2-1 Remove fabricated metrics (WR-10) | PROD-05, PROD-08 | — | Unreachable sites report failure, not 200; no `Math.random` in reported metrics; commerce disabled or real | `sitePerformance.service.ts`, `developerObservability.service.ts`, `controlPlaneReconciliation.service.ts`, `commerce.controller.ts` | grep gate in CI for `Math.random` in metric code; unit tests |
| P2-2 Kit import completeness (WR-22) | PROD-06 | — | All kit pages and templates imported or the UI states what was skipped | `UserDashboard.tsx` | unit/browser test |
| P2-3 Move releases/backups/domains out of `editorData` (WR-16) | DATA-03 | P0-3 | Release and backup tables with FKs; `editorData` holds only the draft; load payload measured | `publishing.service.ts`, `websiteBackup.service.ts`, `document-policy.ts`, migration | publish/rollback integration |
| P2-4 Consolidate duplicates (WR-20) | ARCH-03/04 | P1-3, P1-4 | One billing stack, one domain service, one upload path, single route mount per router, dead routers deleted | `app.ts`, `routes/index.ts`, services | route-inventory test |
| P2-5 Fix QA-08 (WR-18) | failing test | baseline run on `testing` | Test and generator agree on page file naming | `compiler/pageRegistry.ts`, test | `website-to-code-sync` |
| P2-6 SPA security headers (WR-26) | SEC-11 | P1-2 (separate site origin) | CSP, frame-ancestors, referrer, nosniff on nginx | `frontend/nginx.conf` | header check |
| P2-7 GET mutation removal (WR-27) | SEC-09 | — | Recovery only via POST with origin check | `health.routes.ts` | route test |
| P2-8 Worker consolidation | ARCH-04 | P1-7 | All handlers in worker; API process does not poll jobs | `scheduleWorker.ts`, `workers/main.ts` | job integration |
| P2-12 WordPress console truthfulness (WR-39) — 3rd pass | PROD-14, SEC-18, ARCH-08 | Decision: WordPress at launch? | Plugins/themes/cache/menus/webhooks/SEO/analytics/forms either call real plugin routes (added to the one shipped plugin) or are hidden; SSO has a plugin handler and no fallback secret; one plugin file | `services/wordpress/*Provider*.ts`, `wpAdmin.service.ts`, `wordpress-plugin/` | f490–f508 suites rewritten against a WordPress test instance, not in-memory stubs |
| P2-13 Remove success fallbacks and remaining fabrications (WR-41) — 3rd pass | PROD-16, PROD-19, PROD-20 | — | Missing data renders as "not measured"; no hard-coded PASS checks; invoices use a real payment link or none; container build/domain availability/dependency resolution either real or labelled "estimate"; app-auth bootstrap removed from the product API | `ManagedSiteModal.tsx`, admin dashboards, `clientBilling.service.ts`, `dockerfileGenerator.ts`, `forgeDomain.service.ts`, `project.controller.ts` | UI snapshot with empty data shows no score; grep gate |
| P2-14 Test-suite hygiene (WR-42) — 3rd pass | QA-09 | P0-3 (fresh DB) | Every test file runs under one command with one result format; stale imports fixed; suites that need a free plan get it from migrations | `backend/src/tests/*` | the suite itself |
| P2-9 Verify external integrations (WR-24, WR-25) | unverified | test accounts | WordPress, SFTP, PayPal, SMTP, OIDC, live AI each have one recorded passing run | — | existing f4xx/f5xx, smoke scripts |

## P3 — quality and differentiation

| Task | Rationale | Acceptance criteria |
|---|---|---|
| P3-1 Split `WebsiteEditor.tsx` (WR-19) | ARCH-01 | No file > 2,000 lines in `pages/editor`; behaviour unchanged under P1-6 E2E |
| P3-2 UI states and lint (WR-23) | PROD-09, SEC-10 | `alert()` replaced by toasts/inline states; `exhaustive-deps`, `no-undef`, `no-duplicate-case` re-enabled with zero errors |
| P3-3 Onboarding guidance | F-UX-01 | First-run checklist (create → edit → publish) |
| P3-4 Accessibility audit of dashboard/editor | F-UX-02 | axe scan in CI with no serious violations on core screens |
| P3-5 Repository cleanup | ARCH-05 | `.rej`, fix/replace scripts, root certification JSON, committed `dist/`/`uploads/` removed or ignored |
| P3-6 Full-stack app generation (Blueprint v2.1) | F-AI-09 | Continue only after P0–P1; scenario catalogue in `docs/planning/21_…` |

## Recommended next step

**Start with P0-1 and P0-1b** (close `/ws/terminal`, `/ws/realtime`, host sandbox and `/api/hosted`; disable or isolate the project SQL console and table DDL), together with the two small, independent fixes **P0-2** (OTP revert) and **P0-4** (editor sanitization). Immediately after P0-3, the highest-value user-facing work is **P1-9** (published widgets) and **P1-10** (broken UI actions), because they decide whether what a user builds actually appears and works.

Why: they are the only findings that allow remote code execution or cross-tenant data access, they have no upstream dependencies, they are small in code size, and every later task (hosting, billing, onboarding) would otherwise be built on a server that cannot be exposed to the internet. **P0-3** (schema authority / fresh install) should follow immediately, because it is the root dependency of onboarding, billing, release storage and the least-privilege role, and it is already causing failing tests.
