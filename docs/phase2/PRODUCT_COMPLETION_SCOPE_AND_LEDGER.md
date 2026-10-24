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
| **WP-02 Database and tenancy** | P0 / 1 | One schema migration authority; fresh PostgreSQL install; bind principal/project/database in every sensitive operation | Clean migration and negative tenant tests | WP-00/01 | **IN PROGRESS** (template startup sequencing and DB-read error fixes; real database validation pending) |
| **WP-03 Editor reliability** | P0 / 1 | Versioned editor saves, widget catalog and rendering parity, responsive breakpoints, recovery | Advertised widgets survive save/reopen/preview/publish; concurrency tests | WP-00/02 | **IN PROGRESS** (global widget server-backed CRUD and error/retry contract tests; published parity pending) |
| **WP-04 Functional business website** | P1 / 2 | Templates/kits, CMS list/detail, durable media, live forms/leads/notifications | Real visitor submissions and CMS updates on published URL | WP-02/03/05 | **IN PROGRESS** (media tenant checks, CSV safety, legacy upload safety; durable media/CMS/kit/notification E2E pending) |
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

## Wave 1 and Wave 2 focused audit, 24 October 2026

**Source of truth:** Phase 2 Product Completion Blueprint (all J01–J12 and WP-00–WP-10 remain applicable). This iteration does not complete either wave.

**Reproduced source defects and remediation:**
- **Wave 1 / WP-02:** `backend/src/services/template.service.ts` previously converted database read failure into an empty template list; it now raises a typed service error. Source also performed asynchronous schema DDL during module import and suppressed errors; bootstrap now runs as awaited initialization inside existing `backend/src/server.ts` startup gate, which aborts startup on failure.
- **Wave 1 / WP-03 and Wave 2 UI:** `frontend/src/features/global-widget/services/globalWidgetService.ts` previously returned success from create/update/delete on server/network failure by updating local browser storage and inventing IDs/user ownership; it now accepts only confirmed backend responses and surfaces auth, permission, validation and availability errors. Existing legacy local-only data requires a separately approved migration plan rather than cross-account auto-upload.
- **Wave 2 / WP-03 and WP-04 user experience:** the library exposes retry on failed load and no longer falsely shows an empty catalog on server failure. Messaging no longer promises automatic synchronization of all inserted element instances; this capability is not currently qualified.
- **Wave 2 / WP-05 security dependency:** the legacy `/api/hosted/:projectId/:deploymentId` file route remains deliberately unavailable until the existing control plane verifies project/deployment ownership and a safe artifact path. Do not call live publishing complete.

**Regression and build evidence:** GitHub Actions [Phase 2 qualification #40073623398](https://github.com/navinray12/forgestudio-ai/actions/runs/40073623398) finished with 4/4 jobs passed (backend build, frontend build, global widget service/UI tests, backend hosted and template tests). These are build/unit/HTTP mocked tests, not a real PostgreSQL deployment test or visitor E2E test. Review the latest SHA run before merging; a new commit invalidates the old SHA as final evidence.

**Dependency remediation evidence:** an isolated GitHub Actions run [#40074045740](https://github.com/navinray12/forgestudio-ai/actions/runs/40074045740) updated direct/transitive dependencies and their lockfiles. Both `npm audit --audit-level high` runs reported **0 vulnerabilities**; both production builds and 26 targeted tests passed before the dependency commit `84853153251bcd2ce12b43c5f465ceeff7409f58`. Existing identity CI must be rechecked on a normal authenticated commit because workflow runs on the bot push showed `action_required`, not test outcomes. The temporary write-enabled remediation workflow must be removed from the development branch after use.\n\n**Remaining release blockers:** real PostgreSQL clean migration and deployed-site validation remain unverified. Real PostgreSQL clean migration, full project ownership/tenancy matrix, J01–J08 browser journeys, production origin, domains/TLS, CMS/forms/assets, AI provider qualification and backup/restore have **not** passed release gates. There are **zero fully certified work packages** in this iteration.

**Post-remediation cleanup:** the temporary write-enabled dependency remediation workflow has been deleted. The normal identity dependency gate has subsequently reported success on a human-authored branch commit. All future dependency changes must use ordinary reviewed manifests/lockfiles and CI, without auto-push workflows.\n\n## WP-00 and WP-01 security delivery evidence (24 October 2026)

The active audit and per-file remediation log is [WP00_WP01_SECURITY_EVIDENCE.md](./WP00_WP01_SECURITY_EVIDENCE.md). This is the source of truth for the Wave 0 checkpoint alongside the user's approved Phase 2 blueprint.

- **WP-00 — IN PROGRESS.** Dedicated CI now runs disposable PostgreSQL `prisma migrate deploy` and `prisma migrate status`, frontend/backend builds, targeted runtime/data-plane tests, and existing MCP/XSS suites. The fresh migration and core security CI passed on checked SHA; current feature inventory and real staging journey evidence remain open.
- **WP-01 — IN PROGRESS.** Verified code remediations include false container-isolation claims, terminal session/project authorization, cross-project sandbox termination, realtime LISTEN subscription lifecycle, forged service API keys, unsigned JWTs, project-scoped data access, API scopes, FORCE RLS, and shared platform-admin tenant DB fallback (including historical READY records).
- **Release security gate remains blocked** until real Postgres cross-tenant policy/role tests, isolated developer execution infrastructure or explicit product removal, and external API/browser/WS negative integration coverage are complete. Quarantined features are **unavailable**, not implemented.
- Exact CI links, decisions and remaining attack surfaces: [security evidence](./WP00_WP01_SECURITY_EVIDENCE.md) and draft [PR #42](https://github.com/navinray12/forgestudio-ai/pull/42).

## Wave-0 live database qualification update — 24 October 2026

- **WP-00:** fresh checkout now proves 42 versioned PostgreSQL migrations, real user/website creation and physically separate tenant-database provisioning. The runtime-only `project_databases` schema bootstrap was promoted to Prisma migrations and converted to fail-closed schema verification. The exact seven live HTTP/PostgreSQL tests and file inventory are in [WP-00/WP-01 evidence](./WP00_WP01_SECURITY_EVIDENCE.md).
- **WP-01:** API keys now require matching project **and environment**, dedicated pools attest real PostgreSQL ownership and restricted role flags, realtime broadcasts no longer leak unfiltered rows, and sandbox file materialization refuses lexical and symlink escapes.
- **Verified:** [Phase 2 qualification run 40078109973](https://github.com/navinray12/forgestudio-ai/actions/runs/40078109973) is green (6/6 jobs) at commit `b2d32fb2`; this is NOT certification of a deployed production environment. Revalidate CI against any newer commit.
- **Go/No-go: NO-GO.** WP-00/WP-01 remain **IN PROGRESS**, pending a fully reconciled current-entry-point inventory, comprehensive deployed adversarial authorization testing, independent runtime isolation, and applicable operator/staging security evidence. Do not count a security-disabled runtime as a delivered customer feature.

## WP-01 / WP-02 canonical audit — do not repeat full refactors

All new work on security and multi-tenancy must start from [WP01_WP02_CANONICAL_AUDIT.md](./WP01_WP02_CANONICAL_AUDIT.md). The document maps both existing database architectures, records exact file owners and permanent issue IDs, and distinguishes verified fixes from release blockers. Use incremental reproduction → fix → test → ledger update instead of re-auditing the complete repository or rewriting module boundaries.

The latest work adds authenticated-session FORCE RLS enforcement, production editor write denial, canonical Website-scoped realtime authorization, read-only tenant pool lookup with explicit provisioning, and single-flight PostgreSQL pool initialization. Qualification evidence must match the exact current SHA; prior green runs do not qualify new changes. **WP-01/WP-02 remain IN PROGRESS until real-environment and open-P0 exit conditions are met.**

## WP-03 / WP-04 development audit

The permanent issue register is [WP03_WP04_CANONICAL_AUDIT.md](./WP03_WP04_CANONICAL_AUDIT.md). It maps editor/template/global widgets, form intake, lead/export, CMS and media paths to exact owning files and acceptance criteria. **Do not repeat a full-repository refactor** for these issues.

Current implementation commits: WP03-01 template API contract validation; WP04-01 media website ownership checks; WP04-02 CSV export injection protection; WP04-03 image signature checks, false-success removal and local storage quarantine. The dedicated backend/frontend tests passed in [Phase 2 run 40081631402](https://github.com/navinray12/forgestudio-ai/actions/runs/40081631402) on code SHA `de5498d4`: 7/7 jobs, 102 focused backend, 21 frontend and 247 broader security tests, plus 42 migrations and 25 PostgreSQL integration/RLS tests. Every later commit requires fresh exact-SHA verification. Legacy public form integration destinations supplied in client requests (WP04-05), durable production asset upload (WP04-04), CMS/kit complete journeys and editor/public parity remain **OPEN**. The temporary production local-upload rejection is a **security restriction**, not delivery of a production media feature.

## Six-task implementation and verification checkpoint — 24 October 2026

[Detailed evidence, code ownership and blockers](./SIX_TASK_DELIVERY_EVIDENCE.md) is the latest six-task release report. The source commit `e2956e0d` passed [9/9 Phase 2 CI jobs](https://github.com/navinray12/forgestudio-ai/actions/runs/40084498359), including 42 migrations, 11 real HTTP tenant tests, 14 RLS integration tests, 126 focused backend tests, 41 editor journey tests, 21 frontend contracts, 247 security regressions, and a source-inventory artifact.

Changes: visitor-supplied form integration secrets/destinations are ignored in favor of owner-saved form policy; unsafe shared-admin legacy schema access and provisioning are unavailable in production; realtime event delivery checks live membership; editor history/save/publish are regression gated; S3 confirmations require real object/tenant evidence; source inventory is SHA-hashed and migration-only startup is enforced.

**Remaining security and product gates:** outbound integration credentials must move to encrypted server-only storage, legacy DB requires real per-tenant principals, actual isolated code runner is unimplemented, real S3/MinIO delivery not deployed, editor/CMS/widget parity and published HTTPS flows not certified, and WP-00 full business feature matrix not signed off. **WP-00–WP-04 still IN PROGRESS / NO-GO.**

## Current WP-02 / WP-04 recovery and upload hardening checkpoint — 24 October 2026

Two additional narrow code corrections: (1) `database-backup.service.ts` removed the incomplete generated SQL backup fallback and verifies compressed snapshot checksum, size, tenant prefix and archive before any restore SQL; rollback/failure paths are regression-gated. (2) `upload-presigner.service.ts` makes repeated upload confirmations idempotent and reserves bucket quota atomically under contention. Review the permanent [WP-01/02 audit](./WP01_WP02_CANONICAL_AUDIT.md) and [WP-03/04 audit](./WP03_WP04_CANONICAL_AUDIT.md) for named issues and remaining acceptance gates.

These fixes **do not** prove production recoverability or public media delivery. Live cloud object storage, restricted backup role with RLS-qualified `pg_dump`, real restore drill, isolated execution runner, browser-published parity, server-only encrypted form integration settings and full staging acceptance remain required. WP-00–WP-04 are **IN PROGRESS; RELEASE NO-GO**.

## Current code ledger (GitHub)

| Change | File | Verification | Risk/status |
| --- | --- | --- | --- |
| Align global widget update from PUT to backend PATCH | `frontend/src/features/global-widget/services/globalWidgetService.ts` | Route/controller contract inspected | Committed; integration tests pending |
| Quarantine unauthenticated legacy deployment serving | `backend/src/routes/hosted.routes.ts` | Source inspected; no runtime test | Committed; **legacy endpoint intentionally 404** until owner-verified resolver implemented |

A dedicated PR CI workflow at `.github/workflows/phase2-qualification.yml` now runs backend/frontend builds, real disposable PostgreSQL migrations, legacy hosting and data-plane security tests, global-widget regressions, and MCP/HTML security suites. Check the exact latest SHA before merging.\n\nSee draft [PR #42](https://github.com/navinray12/forgestudio-ai/pull/42). Do not merge while compiler/tests, hosted consumers and production configuration are unverified.

### Next small reviewable tasks

1. **WP-00:** await green branch CI (build + hosted-access suite); expand baseline to clean PostgreSQL migration and journey test matrix.
2. **WP-01:** verify hosted route mounting, secure deployment owner lookup, traversal containment, and denied foreign project; preserve existing hosting implementation.
3. **WP-01:** audit unauthenticated realtime and terminal route mounting; test before security changes.
4. **WP-02:** clean PostgreSQL migration test; document project-to-database ownership.
5. **WP-03:** global-widget HTTP error tests, persistence consistency and publish parity tests.

**Document changes must be committed alongside scope/status changes.** Historical October 15 audit counts (263 features, 30 broken, 22 partial, 10 disconnected) are hypotheses for current revalidation, not verified current defect totals.
