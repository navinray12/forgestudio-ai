# 03 — Frontend, Backend and Database Audit

Finding IDs refer to [08](08-verification-and-evidence-ledger.md); feature IDs to [02](02-complete-feature-inventory.md).

## 1. Critical-journey traceability (UI → API → service → DB → UI)

| Step | UI / state | API call | Route + middleware | Service | Storage | Response → UI | Issues |
|---|---|---|---|---|---|---|---|
| Sign up | `pages/auth/SignupPage.tsx` | `POST /api/auth/signup` | `local.routes.ts` (JSON-only, origin check, 16 kB body, rate limit) | `LocalAuthentication.beginSignup` + `sendCode` | `users`, login challenges, audit | `requireOtp`, challenge cookie | SEC-04 |
| Verify OTP | same | `POST /api/auth/signup/verify-otp` | same | `LocalAuthentication.finish` | sessions | session cookie, user | — |
| Load dashboard | `UserDashboard.tsx` + `AuthContext` | `GET /api/auth/me`, `GET /api/websites`, `GET /api/v1/users/me/usage`, `GET /api/v1/subscriptions/current` | `requireAuth` | `usage.service`, `subscription.service` | `user_subscriptions` **created here** | lists / panels | PROD-01 (provisioning on GET) |
| Create site | `WebsiteStartChooser` (ai / template / blank) | `POST /api/websites` | `requireAuth` | `createPersonalWebsite` (serializable, retry ×2) | `websites`, personal org/workspace, `audit_logs` | `website` → navigate to `/editor/:id` | 503 if plan not yet provisioned |
| Load editor | `features/editor-access/EditorRoute` → `WebsiteEditor` | `GET /api/websites/:id` | `authorizeCapability("VIEW")` | `getWebsiteById` | `websites.editorData` | document + `documentVersion` | Saves cannot alter server-owned keys (`document-policy.ts:80-86` preserves `publishedData`, `releases`, `backups`, `customDomains`, …). Whether the load response strips those keys (payload size with 50 releases + 25 backups) is UNVERIFIED. |
| Save | `createDocumentSaveCoordinator`, `useAutosave` | `PUT /api/websites/:id` with `If-Match`, `Idempotency-Key` | `authorizeCapability("EDIT")` | `save-document.ts` (`workspaceCommand`, CAS, field allow-list, permission per field) | `websites` (+ revision for AI apply) | acknowledgement with new version | Strong. Visual→code sync follows (`syncAcknowledgedSave`) |
| AI generate | `UnifiedAiAssistant` / AI start mode | `POST /api/ai/websites/:id/generate` | `requireAuth`, `EDIT_DESIGN` | `generateSiteDraft` (sync provider call) | `ai_executions`, `ai_changesets` | changeset → review UI → `POST /ai/changesets/:id/apply` (`If-Match`) | PROD-03 |
| Publish | `PublishModal.tsx` (3.6k lines), `publishingService.ts` | `POST /api/websites/:id/validate-publish`, `POST /api/websites/:id/publish` | `PUBLISH` | `publishWebsite` | `deployments`, `websites.editorData.publishedData` | deployment result | DATA-02, DATA-03 |
| View | `pages/published/PublishedSite.tsx` (`/site/:id`) | `GET /api/websites/public/:id` (unauthenticated) | none (public) | `getPublicWebsiteById` (status `PUBLISHED`, current release snapshot, token resolution) | read | client render; custom JS in sandboxed iframes; HTML via DOMPurify | PROD-04 |

## 2. Frontend

**Structure.** 25 routes (`App.tsx`). Large feature areas: editor (`pages/editor`, ~60k lines), developer workspace (`features/developer-workspace`, ~15k lines), dashboard (`pages/dashboard`), publishing, templates, SEO, collaboration, support, forum, platform control, database studio.

**State management.** React state and context only (`AuthContext`, `AccessibilityContext`); no global store. Editor state is one component (`WebsiteEditor.tsx`) with hundreds of `useState` hooks; `react-hooks/exhaustive-deps` is disabled (SEC-10), so stale-closure bugs would not be flagged.

**API integration.** Mostly direct `fetch(`${apiUrl}/api/...`)` calls with `credentials:"include"`; `apiUrl` defaults to `http://localhost:5000` when `VITE_API_URL` is unset (`WebsiteEditor.tsx:343`). The frontend mixes `/api/*` and `/api/v1/*` paths. No shared typed client.

**Loading / error / empty / permission states.** Present in newer modules (support, database studio, editor access); dashboard and editor rely heavily on `alert()` (142 calls, PROD-09). `ErrorBoundary` wraps routes.

**Disconnected or partial UI.**
- Kit import keeps the first page only (PROD-06).
- Media upload uses the legacy endpoint; the governed file API has no UI (PROD-07).
- Paid plans: `SubscriptionPage` can only switch plans when dev switching is enabled; an organization checkout exists in the workspace dashboard (`OrganizationBillingPanel`), but it does not change the limits that are enforced (PROD-02).
- 9 live features call endpoints that do not exist (PROD-11, full list in [11](11-ui-api-contract-and-dead-code.md) §1); 7 backend features have UI only in never-imported files (PROD-12); 21 widget types vanish on the published site (PROD-10, [12](12-editor-widget-catalog.md)).
- Editor HTML elements render unsanitized (SEC-05).
- Leftover `UserDashboard.tsx.rej` indicates an unapplied patch hunk (ARCH-05).

**Not verified.** No frontend unit tests exist and no browser test was run (QA-04). Rendering, drag-and-drop, responsive behaviour, keyboard access and autosave UX have no executed evidence.

## 3. Backend

**Routing.** ~120 mounts, each duplicated under `/api` and `/api/v1`; 14 routers share `/api/v1/websites`; `/api/v1/workspaces` resolves to two routers; `tenantWorkspaceRoutes` mounted twice (ARCH-03). The never-mounted `routes/index.ts` aggregator keeps dead routers alive in the import graph.

**Authentication coverage.** A scan of every route file found only these without any auth middleware reference: `hosted.routes.ts` (SEC-06), `oauth.routes.ts` (retired stubs + logout), `modules/billing/http/webhook.routes.ts` (signature-verified webhook), `modules/identity/http/local.routes.ts` (login/signup). Unauthenticated routes inside authenticated files: `GET /websites/public/:id`, `POST /websites/:id/wordpress/webhook`, `POST /websites/:id/wordpress/webhooks/delivery` (signature verification not inspected — UNVERIFIED). WebSocket gateways are outside Express middleware: `/ws/terminal` and `/ws/realtime` are unauthenticated (SEC-01, SEC-03).

**Authorization.** Website routes use `authorizeCapability` (fail-closed, explicit DENY wins, archived workspaces read-only). Routes without the guard (purge requests, invitation revoke/resend by id) enforce OWNER/ADMIN inside the service (`website.service.ts:640-647`, `websitePurge.service.ts`). Project routes use project-scope checks (verified by `tenant-scoped-apis` tests).

**Validation.** Newer code uses zod (identity, document policy, studio). Older controllers destructure `req.body` directly (e.g. `publishing.controller.ts:32` accepts arbitrary `editorData`).

**Error handling.** `error.middleware.ts` maps `AppError`, zod and specific PostgreSQL errors and avoids leaking internals. 150 empty `catch {}` blocks swallow failures (DATA-05).

**Duplicates / dead code.** Two billing stacks and Stripe adapters; two custom-domain services; `signup.service.ts` unreachable; `routes/signup.routes.ts` exports an empty router; job worker runs in API process and worker (ARCH-04).

**Fabricated results.** SSL issuance (PROD-04), `/api/hosted` health (SEC-06), performance audit, CPU and latency metrics (PROD-05), commerce order ids (PROD-08). Earlier work removed several fabricated-evidence routers (`release-integrity`, qualification routes); these remaining cases were not covered.

## 4. Database

**Schema sources.** `schema.prisma` (95 models, 2,054 lines) + 36 migrations; `cpt.prisma` (68 lines, separate CPT schema); boot-time DDL in `config/ensure-schema.ts` (173 tables), `config/db-init.ts` (plan seeding SQL) and 12 services that create their own tables (`form.service`, `template.service`, `license.service`, `siteMailer.service`, `imageOptimization.service`, `jobRunner`, …).

**Migration consistency (read-only check, DATA-01).**

| Database | Applied | Failed | Missing from DB | Applied but not in repo |
|---|---|---|---|---|
| `elementor_saas` (dev) | 14 | `20260928122000_workspace_lifecycle` | 26 | 4 (`20260914000000_restore_missing_core_tables`, `20260915000000_webhook_receipts_and_auth_schema`, `20260916000000_draft_mutation_receipts`, `20260917000000_workspace_authority`) |
| `forge_hardening` (test) | no `_prisma_migrations` table | — | all | — |

Consequences: Prisma refuses further `migrate deploy` on the dev DB until the failed migration is resolved; features whose tables exist only in migrations (e.g. `forge_application_spec_revisions`) fail (DATA-06, 4 failing tests). Whether an empty database reaches a working schema through migrations alone is **UNVERIFIED** — it requires a scratch database, which this audit did not create.

**Integrity patterns.** Good: serializable transactions with retry for site creation and plan assignment; CAS on `documentVersion`; DB triggers for workspace ownership (`WORKSPACE_OWNER_REQUIRED`) and immutability of workflow definitions; `FOR UPDATE SKIP LOCKED` job claims; advisory locks for quota reservations. Weak: publishing bypasses CAS (DATA-02); operational data inside `editorData` JSON (domains, releases, backups, orders) has no constraints (DATA-03); raw-SQL fallback delegates hide drift (DATA-04).

**Tenant isolation.** Application-level checks (verified for tested APIs). RLS limited to 4 tables, and the connection role bypasses RLS (SEC-08). Customer data-platform schemas (`forge_cust_*`) share the same server and role.

**Lifecycle.** Soft delete (`deletedAt`, `TRASH`) and an approved purge flow (verified). Media deletion removes metadata only; files stay on disk. Prompt retention is encrypted with expiry and a cleanup scheduler.

**Unsafe query patterns.** `$executeRawUnsafe` is used with parameter placeholders in the inspected cases (e.g. `publishing.service.ts:504-508`); a full scan of all raw SQL for interpolation was not completed (see 09).
