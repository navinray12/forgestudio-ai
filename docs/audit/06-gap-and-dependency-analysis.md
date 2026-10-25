# 06 — Gap and Dependency Analysis

Finding IDs refer to [08](08-verification-and-evidence-ledger.md); feature IDs to [02](02-complete-feature-inventory.md).

## 1. Remaining-work register

Type: **DEF** confirmed defect · **GAP** missing product capability · **RISK** unverified risk · **DEBT** maintainability.

| WR | Type | Summary | Findings / features | Root cause |
|---|---|---|---|---|
| WR-01 | DEF | Remove or authenticate and isolate the terminal gateway | SEC-01, F-INT-03 | Developer-platform feature wired into the shared upgrade handler without the auth used by `/ws/workspace-sync` |
| WR-02 | DEF | Replace host "sandbox" with real isolation or disable for tenants | SEC-02 | Prototype runtime promoted to product surface |
| WR-03 | DEF | Authenticate and authorize `/ws/realtime` | SEC-03, F-INT-05 | Same as WR-01 |
| WR-04 | DEF | Revert OTP disclosure; gate any dev aid on an explicit opt-in flag, never on `NODE_ENV` absence | SEC-04 | Local-testing convenience change in working tree |
| WR-05 | DEF | Sanitize HTML elements in the editor canvas with the published-path sanitizer | SEC-05, F-ED-05 | Two render paths with different safety |
| WR-06 | DEF | Single schema authority; repair migration history; prove fresh install | DATA-01, DATA-06 | Boot-time DDL accreted alongside Prisma migrations; failed migration on dev DB |
| WR-07 | DEF | Publish with CAS on `documentVersion`, publish only the saved version | DATA-02, F-PUB-01 | Publishing predates the versioned-save contract |
| WR-08 | GAP | Explicit onboarding: create subscription + default workspace on signup completion; seed plans in migrations | PROD-01, F-WS-02, F-UX-01 | Provisioning moved out of signup, left as GET side effects |
| WR-09 | GAP | Real hosting: static/SSR output per release, per-site origin, Host-based routing, CDN, real ACME | PROD-04, F-PUB-02, F-PUB-06 | Hosting implemented as SPA route; SSL stubbed |
| WR-10 | DEF | Remove fabricated outputs (SSL, hosted health, perf metrics, CPU, latency, order ids) | PROD-04(a), SEC-06, PROD-05, PROD-08 | Placeholder code paths reporting success |
| WR-11 | GAP | One billing stack linked to entitlements; checkout UI; webhooks update the entitlement the limits read | PROD-02, F-BIL-02/03/07 | Two parallel SaaS foundations (user vs. organization subscriptions) |
| WR-12 | GAP | AI cost control: quota on site generation, plan credits, usage metering, async job | PROD-03, F-AI-06 | Quotas added per generator, not at the gateway |
| WR-13 | GAP | Media on governed storage: magic-byte validation, quota, S3, delete files | SEC-07, PROD-07, F-MED-01/03, F-BIL-06 | Legacy upload path never migrated |
| WR-14 | GAP | Least-privilege DB role; extend RLS | SEC-08, F-WS-06 | Local superuser role; staged RLS rollout |
| WR-15 | GAP | Observability: structured logs, error tracking, metrics, alerting | QA-06, F-OPS-03 | Not started |
| WR-16 | GAP | Platform DB backups + restore drill; move releases/backups out of `editorData` | QA-07, DATA-03, F-OPS-04 | JSON-document storage of operational data |
| WR-17 | GAP | Browser E2E for the core journey; frontend unit tests; one CI pipeline running all suites | QA-04, QA-05 | Test investment went to backend gate scripts |
| WR-18 | DEF | Fix or update page-naming test | QA-08 | Possible regression from staged `pageRegistry.ts` |
| WR-19 | DEBT | Split `WebsiteEditor.tsx` and inspectors/renderers | ARCH-01 | Organic growth |
| WR-20 | DEBT | Consolidate duplicates: billing, domain services, upload paths, route mounts; delete dead routers/files | ARCH-03, ARCH-04, ARCH-05 | Parallel implementations kept for compatibility |
| WR-21 | DEF | Hosted runtime: fix traversal guard, authenticate, durable artifact storage | SEC-06, F-PUB-10 | Prototype |
| WR-22 | DEF | Kit import keeps all pages | PROD-06 | Incomplete handler |
| WR-23 | DEBT | Replace `alert()` with consistent UI states; re-enable key lint rules | PROD-09, SEC-10 | — |
| WR-24 | RISK | Verify WordPress, SFTP, PayPal, SMTP, OIDC against real targets | F-PUB-08/09, F-BIL-04, F-INT-10, F-AUTH-04 | External systems unavailable in audit |
| WR-25 | RISK | Verify live AI providers end-to-end with cost caps | F-AI-01..05 | Paid calls not made in audit |
| WR-26 | DEBT | Upload/SPA security headers (CSP) | SEC-11 | — |
| WR-27 | DEF | State-changing GET for migration recovery | SEC-09 | — |
| WR-28 | DEF | Run customer-database SQL and DDL under a per-database least-privilege role (no `public` on the search path), validate column types/defaults against an allow-list, bind `databaseId` to the authorised project in every handler | SEC-12, SEC-13, SEC-14, F-DATA-03/04, F-WS-11 | Data platform reuses the platform connection pool and trusts request bodies |
| WR-29 | DEF | Published-site widget parity: one renderer (or a shared registry) used by editor, preview and published site; unknown types fail visibly, never silently | PROD-10, F-ED-03/04, F-PUB-03/04 | Editor and published renderers are separate hand-maintained `if` chains |
| WR-30 | DEF | Fix the 9 broken UI→API contracts (kits, global-widget update, approval request, integration prefix, PayPal widget, video upload, dynamic upload, plugin download link, atomic form default action) | PROD-11 | No shared typed API client; mixed `/api` vs `/api/v1` |
| WR-31 | GAP | Wire or delete UI for backend features whose screens are dead: media library, design notes, component access manager, code-export modal, editor forms panels, plugin system | PROD-12, F-MED-02, F-ED-16/22, F-ACL-04 | Components left unimported after refactors |
| WR-32 | DEF | Remove the additional fabricated outputs (media-optimisation job, image optimisation fallback, fake access logs, SFTP test success, plugin sync constant, simulated DNS) | PROD-13 | Placeholder paths reporting success |
| WR-34 | DEF | **(3rd pass)** Require authentication on the generated-app data API; verify JWT signatures; reject unknown `fg_sec_`/`fg_anon_` keys; create real RLS policies (or per-role grants) in customer databases so `anon` is restricted | SEC-16, F-DATA-09 | Supabase-style API copied without the policy layer |
| WR-35 | DEF | **(3rd pass)** Route every `editorData` write through one versioned command (or move server-owned data out of the document) so publish, restore, experiments, commerce, staging, domains, backups etc. cannot overwrite user edits; stop visitor traffic from rewriting the document | DATA-07, DATA-02, F-RUN-07, F-SITE-07 | Many features added state to one JSON column |
| WR-36 | DEF | **(3rd pass)** Make staging a separate target that never touches the live snapshot or status | PROD-17, F-MS-04 | Publish path ignores `environment` |
| WR-37 | DEF | **(3rd pass)** Commerce: authorise through the capability system, price from stored products, rate-limit public orders, store orders outside `editorData` | SEC-17, F-RUN-03 | — |
| WR-38 | GAP | **(3rd pass)** Per-site merchant/CRM credentials for payment and lead widgets (or remove the widgets) | PROD-15, F-INT-04, F-RUN-02 | Integrations built against platform env vars |
| WR-39 | DEF | **(3rd pass)** WordPress console: implement plugins/themes/cache/menus/webhooks/SEO/analytics/forms against the plugin (adding plugin routes) or hide them; ship one plugin; remove SSO fallback secret | PROD-14, SEC-18, ARCH-08, F-WP-06..16 | UI and API built ahead of the plugin |
| WR-40 | GAP | **(3rd pass)** Autosave safety: retry with backoff, `beforeunload` warning while unsaved/failed, local draft recovery | PROD-18, F-SITE-04 | — |
| WR-41 | DEF | **(3rd pass)** Remove success-valued UI fallbacks and remaining fabrications (client invoice link, container build, domain availability, app-auth bootstrap demo) | PROD-16, PROD-19, PROD-20 | Placeholder code paths |
| WR-42 | DEBT | **(3rd pass)** Repair or delete stale tests that import removed symbols; make every test file report through one runner | QA-09 | Test rot |
| WR-33 | DEBT | Delete or document dead code (87 backend + 37 frontend files, 3 unmounted routers) after confirming no dynamic loading | ARCH-06 | — |

## 2. Dependency graph (what must come first)

```
WR-06 schema authority ──┬─► WR-08 onboarding (plans seeded by migration)
                         ├─► WR-11 billing (one subscription table)
                         ├─► WR-16 backups / move releases out of editorData
                         └─► WR-14 least-privilege role + RLS
WR-01/02/03 isolation ───► any public deployment (independent of everything else; do first)
WR-04 OTP revert ────────► any shared/staging deployment
WR-07 publish CAS ───────► WR-09 real hosting (hosting consumes immutable, versioned releases)
WR-16 release storage ───► WR-09 real hosting
WR-09 hosting ───────────► WR-10 (domain/SSL truthfulness only meaningful once serving exists)
WR-11 billing ───────────► WR-12 AI credits (credits come from the entitlement record)
WR-13 media storage ─────► WR-09 (published sites need durable asset URLs) and WR-11 (storage quota)
WR-15 observability ─────► safe rollout of WR-09/11/12
WR-17 E2E + CI ──────────► regression safety for WR-07/08/09/11 and WR-19 refactor
WR-19 editor split ──────► after WR-17 (needs browser tests first)
```

## 3. Blockers to a market-ready standalone release

1. **Security**: WR-01, WR-02, WR-03, **WR-28** (SQL console / DDL injection / database IDOR), WR-04, WR-05 (and WR-21 if `/api/hosted` stays mounted).
1a. **What users see after publishing**: WR-29 (21 widget types vanish), WR-30 (9 broken UI actions).
2. **Data integrity / operability**: WR-06, WR-07, WR-16, WR-15.
3. **Core product completeness**: WR-08 (a new user can reliably start), WR-09 (sites actually reachable on the web, crawlable, on custom domains), WR-11 (customers can pay and get what they paid for), WR-12 (AI cost cannot run away), WR-13 (assets durable and safe).
4. **Evidence**: WR-17 (no executed evidence for the editor or the publish→view journey).

## 4. Redundant implementations

| Area | Implementations | Keep (recommendation, pending decision) |
|---|---|---|
| Organization billing / Stripe | `modules/billing/*`, `services/billing/*` | One, after WR-11 decision on subscription owner |
| Subscription owner | `user_subscriptions` (gates limits) vs. organization subscriptions (paid by Stripe) | Decision required (open question 2) |
| Custom domains | `services/domains/customDomain.service.ts`, `services/hosting/forgeDomain.service.ts` | Decide with WR-09 |
| Uploads | `middlewares/upload.middleware.ts` (disk) vs. `modules/files` + `services/files` (S3, quarantine) | Governed pipeline |
| Job workers | API-process poller + worker process | Worker process only, once all handlers are registered there |
| Route mounts | `/api/*` and `/api/v1/*`; double `tenantWorkspaceRoutes`; `/api/v1/workspaces` → two routers | Versioned paths; single mount |
| Schema authority | Prisma migrations, `ensure-schema.ts`, per-service DDL, `prisma-fallback.ts` delegates | Migrations (open question 4) |

## 5. Confirmed defects vs. unverified risks

- **Confirmed by execution**: DATA-01, DATA-06, SEC-08 (local), QA-01, QA-08, ARCH-01, ARCH-05.
- **Confirmed by code**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-07, SEC-09, SEC-10, SEC-11, SEC-12, SEC-13, DATA-02, DATA-03, DATA-04, DATA-05, PROD-01..13, ARCH-02..04, ARCH-06, ARCH-07, QA-06, QA-07.
- **Plausible**: SEC-05 (needs a browser), SEC-06 HTTP exploitability, SEC-14 beyond the two handlers read, SEC-15.
- **Unverified**: live AI behaviour, WordPress/SFTP/PayPal/SMTP/OIDC, editor UI behaviour, compose deployment, fresh-install migrations, production DB role, CI status, performance under load, accessibility of the app.
