# 00 — Executive Summary: ForgeStudio Codebase Audit

Date: 2026-10-15 (1st pass + detailed 2nd pass) · Branch `sconfigtesting` · HEAD `fa2de24` + your 39 uncommitted/staged paths · Scope: **partial** but whole-repository mechanical checks were added in the 2nd pass (see [09](09-audit-coverage-and-open-items.md)).

## 1. What ForgeStudio is

- **Backend** — Express 5 + Prisma 7 + PostgreSQL; ~210k hand-written lines; **1,087 live API endpoints in 83 routers**; 5 WebSocket gateways; in-process job poller + separate worker.
- **Frontend** — React 19 SPA (~143k lines): dashboard (12 tabs), managed-site console (18 tabs), visual editor with **127 element types**, atomic editor, published-site renderer, developer workspace (13 panels), database studio, admin consoles, support desk, forum.
- **Two products in one server**: a visual **website builder** and a **full-stack developer / data platform** (files, git, terminal, runtime, per-project PostgreSQL schemas, migration authority). Plus a large **WordPress management console** (~110 endpoints).

## 2. Feature count and completion

**263 features and sub-features catalogued** ([02](02-complete-feature-inventory.md)):

| Status | Count | Meaning |
|---|---|---|
| Implemented & verified | **10** | proven by tests executed in this audit |
| Implemented, unverified | **161** | code exists and looks complete; no executed evidence |
| Partial | **22** | some required behaviour missing |
| Missing | **7** | required, not built |
| Broken | **30** | confirmed defect (security, wrong endpoint, fabricated output, vanishes on publish) |
| Disconnected | **10** | built but not wired into the product |
| Redundant | **2** | duplicate implementation |
| Blocked | **21** | needs an external system to verify (16 of them WordPress) |

Widgets ([12](12-editor-widget-catalog.md)): of 127 element types, **84 work in editor and on the published site** (browser-unverified), **21 render in the editor but disappear after publishing**, 1 can be inserted but renders nowhere, 1 renders only on the published site, **20 exist only as type names**.

API ([10](10-api-endpoint-catalog.md), [11](11-ui-api-contract-and-dead-code.md)): 28 routers have no screen at all; **9 live UI actions call endpoints that do not exist**; 87 backend files (~12.7k lines) and 37 frontend files (~8.9k lines) are dead code.

## 3. Overall readiness

**Not ready for a market launch as a standalone website builder.**

| Question | Answer (evidence) |
|---|---|
| Can a new user register and start? | Mostly; but the working tree leaks OTP codes outside `production` (SEC-04) and the first site depends on GET calls lazily creating a subscription (PROD-01). |
| Create, edit, save, reopen reliably? | Backend save path is strong (versioned compare-and-set). The editor itself has no executed tests. |
| Does what the user builds appear on the live site? | **Not always** — 21 widget types vanish after publishing (PROD-10). |
| AI generation produces validated, persisted changes? | By design yes (reviewable changesets); live providers not exercised; full-site generation has no quota (PROD-03). |
| Preview and publish reliably? | Publish bypasses save concurrency and accepts client content (DATA-02); the approval workflow cannot be used (PROD-11). |
| Hosting, domains, templates, assets? | Sites are only a client-rendered route in the app; custom domains never serve; SSL status is fabricated (PROD-04). Media library UI is dead code; video upload and website kits are broken (PROD-11/12). |
| Auth, isolation, billing, quotas? | App-level isolation verified on tested APIs, but the data platform lets any project owner run SQL on the platform database (SEC-12/13/14) and the DB role bypasses RLS (SEC-08). Payments don't change enforced limits (PROD-02). |
| Recoverable, operable? | Broken migration history (DATA-01), no monitoring (QA-06), no backups (QA-07), several fabricated metrics (PROD-05/13). |

## 4. Most important findings

**P0 — release blockers**
1. **SEC-01** `/ws/terminal`: anonymous WebSocket → interactive host shell with all server secrets.
2. **SEC-02** "Sandbox" executes tenant commands directly on the host.
3. **SEC-03** `/ws/realtime`: anonymous subscription to any project's table changes.
4. **SEC-12** Project SQL console runs arbitrary SQL on the platform's own database connection (with `public` schema visible). **SEC-13** Table create/alter injects unvalidated types/defaults into DDL. (**SEC-14** database id not bound to project.)
5. **DATA-01** Two schema authorities; dev DB has a failed migration blocking 26 others; fresh install unproven; already causes 4 failing tests (DATA-06).

**P1**
- **PROD-10** 21 widget types disappear on the published site.
- **PROD-11** 9 broken UI actions (website kits, global-widget update, publish approval, integration tests, PayPal widget, video upload, widget file upload, WordPress plugin download, default contact form).
- SEC-04 OTP leak (uncommitted) · SEC-05 unsanitized HTML in the editor · SEC-08 superuser DB role · DATA-02 publish lost-update · PROD-01 onboarding · PROD-02 billing · PROD-03 AI cost · PROD-04 no real hosting, fabricated SSL · QA-04 no editor/E2E tests · QA-06 no observability · QA-07 no backups.

**P2** — PROD-12 (backend features whose UI is dead code: media library, design notes, component access, code export), PROD-13 (more fabricated outputs: media optimisation "35%", fake access logs, SFTP test success, plugin sync constant), DATA-03 (everything stored in one JSON row), ARCH-06 dead code.

**What genuinely works (executed)**: 306 of 311 backend integration tests pass (1st pass) — visual↔code sync, realtime workspace sync, migration authority, CPT CMS, lead intake, approved purge, tenant-scoped APIs, RLS helpers, environment bindings, app-generation runs.

## 5. Corrections made in the 2nd pass
- Billing: the duplicate Stripe checkout is **dead (not mounted)**, not a path collision; an organization checkout UI **does exist** (workspace dashboard) — billing is still disconnected from enforced limits.
- SEC-05: one of the two raw-HTML paths is in a dead file; the live editor path remains.
- Media library status changed from "unverified" to "disconnected" (its UI is never imported).

## 6. Evidence limitations
No live AI/payment/email/WordPress/SFTP/IdP calls; dev servers were not running; no browser tests; compose not started; CI history unavailable (`gh` missing); ~186 script test suites not run. Security findings SEC-01/02/03/12/13 are confirmed by code reading, not exploitation. The 2nd pass was entirely static and read-only.

## 7. Recommended next step
**P0-1 + P0-1b**: stop routing `/ws/terminal` and `/ws/realtime` until authenticated, keep tenant code off the host, and disable or isolate the project SQL console and table DDL; ship with **P0-2** (revert the OTP leak) and **P0-4** (sanitize editor HTML). Then **P0-3** (single schema authority + proven fresh install). Then **P1-9** (published widget parity) and **P1-10** (fix the 9 broken UI actions). Full ordering with acceptance criteria: [07](07-prioritized-roadmap.md).

## 8. Decisions needed from you
1. Should the terminal, runtime and data platform (SQL console, project databases) ship in the website-builder product, or only in a separately deployed developer platform?
2. Which record owns entitlements: per-user or per-organization subscriptions?
3. Hosting model for published sites (subdomains + custom domains via edge/CDN, static export only, …)?
4. Should Prisma migrations be the sole schema authority (retiring boot-time DDL)?
5. Keep or drop the publish-approval workflow and the 20 type-only widget types?

## 9. Reports
| # | File | Contents |
|---|---|---|
| 00 | [00-executive-summary.md](00-executive-summary.md) | this summary |
| 01 | [01-repository-and-architecture.md](01-repository-and-architecture.md) | apps, entry points, architecture, data flows |
| 02 | [02-complete-feature-inventory.md](02-complete-feature-inventory.md) | **263 features with status** |
| 03 | [03-frontend-backend-database-audit.md](03-frontend-backend-database-audit.md) | journey traceability, subsystem findings |
| 04 | [04-ai-integrations-and-infrastructure.md](04-ai-integrations-and-infrastructure.md) | AI, jobs, storage, hosting, deployment |
| 05 | [05-quality-security-and-testing.md](05-quality-security-and-testing.md) | commands run, security by severity |
| 06 | [06-gap-and-dependency-analysis.md](06-gap-and-dependency-analysis.md) | 33 work items, dependency graph |
| 07 | [07-prioritized-roadmap.md](07-prioritized-roadmap.md) | P0–P3 tasks with acceptance criteria |
| 08 | [08-verification-and-evidence-ledger.md](08-verification-and-evidence-ledger.md) | **51 findings** with file/line evidence, test results |
| 09 | [09-audit-coverage-and-open-items.md](09-audit-coverage-and-open-items.md) | coverage, open items |
| 10 | [10-api-endpoint-catalog.md](10-api-endpoint-catalog.md) | every router: endpoints, mounts, UI wiring |
| 11 | [11-ui-api-contract-and-dead-code.md](11-ui-api-contract-and-dead-code.md) | broken UI calls, dead UI, dead code, fabricated outputs |
| 12 | [12-editor-widget-catalog.md](12-editor-widget-catalog.md) | all 127 widget types |

Repository changes: only files under `docs/audit/` (the pre-existing `FORGESTUDIO_BLUEPRINT_V2_COMPREHENSIVE_AUDIT.md` untouched).
