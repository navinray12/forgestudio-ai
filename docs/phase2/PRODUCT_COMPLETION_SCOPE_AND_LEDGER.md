# Phase 2 — Product Completion Scope and Execution Ledger

**Status:** Active, evidence-led engineering plan  
**Source baseline:** `sconfigtesting` at `3c7b0c791e84c6d48b7742cbdd3594b6c3dbdb5d` (24 Oct 2026)  
**Development branch:** `phase2/production-hardening`  
**Authoritative planning input:** user-approved *ForgeStudio AI — Phase 2 Product Completion & Delivery Blueprint*, 11 pages (24 Oct 2026).  
**Rule:** This file is a tracking companion to that blueprint, **not a replacement**. Future work must reference its work-package IDs (WP), journeys (J), acceptance gates and architecture boundaries. The blueprint is retained by its title and original snapshot; the complete PDF is supplied by the owner outside git. The original repo architecture, API conventions, Prisma models and existing module boundaries remain the implementation starting point.

## End-product contract

A new customer can sign up, verify identity, start a website via blank/template/AI, edit and reliably reopen it, manage content/forms/assets, publish with real TLS/domain support, and operate or restore the published site. Untrusted developer-runtime features must not weaken the SaaS tenant boundary. No synthetic deployment, billing, integration, or health successes.

## Exactly 11 engineering scopes (WP-00 through WP-10)

| Scope | Priority / wave | Business outcome and included tasks | Exit evidence | Dependencies | Status |
| --- | --- | --- | --- | --- | --- |
| **WP-00 Evidence baseline** | P0 / 0 | Inventory existing routes, modules and data contracts; clean checkout, compiler, tests, CI, issue reproduction | Reproducible baseline for current SHA with build/migration/test evidence | None | **IN PROGRESS** |
| **WP-01 Execution/data security** | P0 / 0 | Revalidate terminal, WebSocket, hosted runtime, public data APIs, user SQL and HTML trust boundaries; close exploitable access | Unauthorized, cross-tenant, traversal and injection tests fail safely | WP-00 | **IN PROGRESS** (legacy hosted route quarantined pending tests) |
| **WP-02 Database and tenancy** | P0 / 1 | One schema migration authority; fresh PostgreSQL install; bind principal/project/database in every sensitive operation | Clean migration and negative tenant tests | WP-00/01 | NOT STARTED |
| **WP-03 Editor reliability** | P0 / 1 | Versioned editor saves, widget catalog and rendering parity, responsive breakpoints, recovery | Advertised widgets survive save/reopen/preview/publish; concurrency tests | WP-00/02 | NOT STARTED |
| **WP-04 Functional business website** | P1 / 2 | Templates/kits, CMS list/detail, durable media, live forms/leads/notifications | Real visitor submissions and CMS updates on published URL | WP-02/03/05 | NOT STARTED |
| **WP-05 Hosting and release** | P0 / 2 | Authorized artifact resolving, staging, immutable releases, domains, TLS and rollback | Live HTTP/DNS/TLS and rollback checks; no fake health | WP-01/02/03 | NOT STARTED |
| **WP-06 Complete AI workflow** | P1 / 2 | Provider-backed job/proposal/preview/apply, concurrency safety, quota/budget | Real sandbox provider flow and generated-site publish tests | WP-02/03/05 | NOT STARTED |
| **WP-07 Onboarding and commercial** | P1 / 1–3 | OTP, idempotent provisioning, canonical entitlements, payment and webhook lifecycle | Fresh signup-to-site and pay-to-upgrade tests | WP-01/02 | NOT STARTED |
| **WP-08 Third-party adapters** | P1–P2 / 2–3 | Typed UI/API contracts, integration test routes, minimal qualified WordPress and provider adapters | Contract matrix; real/sandbox provider tests and honest degraded states | WP-02/04 | NOT STARTED |
| **WP-09 Operations and recovery** | P0 / 1–4 | Real telemetry and alerts, safe backups/restores, release rollback, operational runbooks | Restore exercise with recorded RPO/RTO and alert validation | WP-02/05 | NOT STARTED |
| **WP-10 Safe refactoring** | P2 / 3–4 | Extract oversized modules behind regression tests; remove proven dead code only | No behavior regression and verified import reachability | WP-00/03/04 | NOT STARTED |

**Total: 11 work packages; 5 delivery waves (0–4); 12 acceptance journeys (J01–J12).** These are boundaries for delivery and review, not a claim that 11 PRs are sufficient.

## Customer journey checklist

- [ ] **J01** Signup → OTP → workspace/subscription provisioning → first site
- [ ] **J02** Blank site → responsive edit → save/reload → publish
- [ ] **J03** Browse/preview/apply template kit → retain pages/assets → publish
- [ ] **J04** AI brief → job/proposal → preview/accept → edit/publish
- [ ] **J05** CMS schema/entries → list/detail bindings → public updates and SEO
- [ ] **J06** Form setup → public submission → persisted lead → owner notification
- [ ] **J07** Upload/browse/insert/remove image/video → durable published assets
- [ ] **J08** Publish → default URL → domain/TLS → staging/rollback
- [ ] **J09** Merchant checkout/payment and webhook order state **if included in release**
- [ ] **J10** Checkout/webhook → entitlement upgrade → cancel/downgrade
- [ ] **J11** Invite/role/revoke → server-side cross-tenant denial
- [ ] **J12** Detect incident → logs → backup or release restore → verify site

A journey is checked only after evidence in the target environment, not because its UI exists.

## Preserve existing architecture: mandatory implementation rules

1. **Architecture first:** inspect current routes, controllers, services, Prisma models, React features, middlewares, auth and worker patterns *before* editing. Extend established interfaces; do not create a second parallel stack.
2. **Trust boundaries:** maintain identity/control plane, website document plane, business data plane, AI orchestration, publishing plane, isolated developer runtime, and observability plane. This describes responsibility boundaries and does **not** authorize a rewrite.
3. **No unreviewed breaking changes:** update consumers, add compatibility/migration strategy, and test affected journeys. Any temporary fail-closed feature must be declared to the reviewer.
4. **Original implementation, measured quality:** typed boundaries, explicit errors, least privilege, validation, idempotency, bounded workloads, targeted tests, clear naming, no hidden fallbacks that claim success, and no secrets in commits. Plagiarism or AI-detector evasion is not a release measure.
5. **No invented evidence:** use statuses `INVENTORIED`, `REPRODUCED`, `VERIFIED EXISTING`, `SPECIFIED`, `IN DEVELOPMENT`, `CODE REVIEW`, `INTEGRATION VERIFIED`, `STAGING VERIFIED`, `RELEASED`, `BLOCKED` or `DEFERRED`. A pushed commit means only code committed.
6. **Per ticket:** journey and WP ID, exact files, baseline/current SHA, reproduced problem, test matrix (positive, invalid, unauthorized, foreign tenant, concurrency, recovery as relevant), review, migration/rollback and staging evidence.

## Release gates (all mandatory)

- Clean checkout builds; empty PostgreSQL database migrates and initializes.
- No unmitigated high-severity exposure; authenticated and cross-tenant negative tests green.
- All *advertised* widget types retain editor/preview/published parity; no lost concurrent updates.
- J01–J08 pass with real persistent state; J09–J11 if in release scope; J12 restoration is proven.
- Independent public origin with verified HTTP response, assets, DNS and TLS.
- AI provider calls and costs enforced, recoverable jobs, no stale-proposal overwrite.
- Verified payment webhooks correctly change enforced entitlements.
- Alerts and backups are real; restore, rollback and operator runbooks exercised.
- Tests, build, lint, CI and reviewer approvals recorded for release candidate.

## Wave progression and sequencing

- **Wave 0 — Discover and contain:** WP-00/WP-01. Reproduce current risks and gate unsafe entry points.
- **Wave 1 — Durable core:** WP-02, WP-03 foundation, WP-07 onboarding, WP-09 foundation.
- **Wave 2 — Visitor-ready site:** WP-03/04/05/06/08; real public site and complete J01–J08.
- **Wave 3 — Commercial completion:** WP-07/08/10; billing and selected connectors.
- **Wave 4 — Certification and launch:** full regression, threat review, load and restore exercises, documentation and formal go/no-go.

The blueprint's **12–18-week** figure assumes a coordinated ~6–8 engineer team and is **not** a solo-engineer estimate or commitment.

## Decision register: resolve before promising release

- Canonical subscriptions owner and entitlement policy.
- Hosting topology (public origin, static/SSR artifacts, edge routing, certificates).
- Migration authority and isolation model for customer SQL.
- Definitive supported widget registry versus UI-advertised types.
- WordPress connector scope and whether J09 commerce is mandatory.
- Provider accounts, budget, sandbox credentials and staging ownership.

## Current code ledger (GitHub)

| Change | File | Verification | Risk/status |
| --- | --- | --- | --- |
| Align global widget update from PUT to backend PATCH | `frontend/src/features/global-widget/services/globalWidgetService.ts` | Route/controller contract inspected | Committed; integration tests pending |
| Quarantine unauthenticated legacy deployment serving | `backend/src/routes/hosted.routes.ts` | Source inspected; no runtime test | Committed; **legacy endpoint intentionally 404** until owner-verified resolver implemented |

See draft [PR #42](https://github.com/navinray12/forgestudio-ai/pull/42). Do not merge while compiler/tests, hosted consumers and production configuration are unverified.

### Next small reviewable tasks

1. **WP-00:** establish branch CI and focused route/service regression tests.
2. **WP-01:** verify hosted route mounting, secure deployment owner lookup, traversal containment, and denied foreign project; preserve existing hosting implementation.
3. **WP-01:** audit unauthenticated realtime and terminal route mounting; test before security changes.
4. **WP-02:** clean PostgreSQL migration test; document project-to-database ownership.
5. **WP-03:** global-widget HTTP error tests, persistence consistency and publish parity tests.

**Document changes must be committed alongside scope/status changes.** Historical October 15 audit counts (263 features, 30 broken, 22 partial, 10 disconnected) are hypotheses for current revalidation, not verified current defect totals.
