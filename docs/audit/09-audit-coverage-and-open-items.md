# 09 — Audit Coverage and Open Items

**This audit is PARTIAL.** It covers the critical website-builder journey and the highest-risk surfaces in depth, and the rest of the repository by inventory and targeted search. It does not claim line-by-line coverage of 556k lines of TypeScript.

## 1. Inspection methods
File listings and line counts; router-mount analysis of `app.ts`; call-graph `grep` (callers of key services); targeted reads of entry points and hot paths; mechanical scans (auth middleware per route file, `dangerouslySetInnerHTML`, `Math.random`, empty `catch`, `console.*`, `any`, TODO/placeholder markers); read-only SQL against local PostgreSQL; typecheck, lint and integration-test execution (see [05](05-quality-security-and-testing.md) §1).

## 2. Coverage by area

| Area | Depth | What was inspected |
|---|---|---|
| Entry points, routing, WebSocket gateways | Deep | `server.ts`, `app.ts`, `routes/index.ts`, `websocketGateways.ts`, all route files (auth scan) |
| Identity (local auth) | Deep | `modules/identity/*` local path, uncommitted diff |
| Onboarding / subscriptions | Deep | `subscription.service.ts`, controllers, `usage.service.ts`, `signup.service.ts` reachability |
| Website create / save / permissions | Deep | `create-personal-website.ts`, `save-document.ts`, `permission.service.ts`, website routes |
| Publishing / public rendering | Deep | `publishing.service.ts` (publish path), `getPublicWebsiteById`, `PublishedSite.tsx` (custom code, HTML) |
| Domains / hosting | Medium | `customDomain.service.ts`, `customDomain.controller.ts`, `hosted.routes.ts`; `forgeHosting`, `forgeCicd`, `forgeDomain` only listed |
| AI | Medium | provider routing, site generation, quota, routes, worker pipeline entry; individual generators not read |
| Jobs / workers | Medium | `jobRunner.ts` claim logic, `workers/main.ts`, `scheduleWorker.ts` |
| Media / uploads | Medium | `upload.middleware.ts`, media routes/service; governed files module only located |
| Billing | Medium | plan selection, both Stripe stacks located, entitlement linkage |
| Terminal / sandbox / realtime | Deep (security path) | gateway handlers, `executeInSandbox` |
| Database | Medium | schema/migration counts, boot DDL, fallback proxy, live migration state (read-only) |
| Frontend | Medium | route table, dashboard create/import flows, editor persistence and HTML rendering, published renderer; editor widgets/inspectors not read |
| CI / Docker | Medium | workflow triggers and commands, compose services, Dockerfiles, nginx |
| Docs | Light | prior audit/planning headings; acceptance traceability summary |

## 2a. Second pass (2026-10-15) — mechanical whole-repository checks

| Check | Scope | Result | Report |
|---|---|---|---|
| Endpoint extraction + mount resolution | all backend routers | 1,087 live declarations, 83 routers, 3 unmounted | [10](10-api-endpoint-catalog.md) |
| Frontend → backend path matching | 380 call sites + hand-resolved service clients | 9 live broken contracts | [11](11-ui-api-contract-and-dead-code.md) §1 |
| Import-graph reachability | 738 backend + 362 frontend files | 87 + 37 unreachable | [11](11-ui-api-contract-and-dead-code.md) §3 |
| Widget renderer parity | all 127 `ElementType` values | 21 vanish on publish, 20 type-only | [12](12-editor-widget-catalog.md) |
| Simulation/fabrication markers | 35 backend files | 6 more fabricated outputs | [11](11-ui-api-contract-and-dead-code.md) §4 |
| Raw-SQL interpolation scan | all backend sources | 81 interpolations; SEC-13 | [05](05-quality-security-and-testing.md) |
| Data-platform authorisation path | SQL console, table DDL | SEC-12, SEC-14 | [08](08-verification-and-evidence-ledger.md) |
| WordPress inbound webhook signatures | 2 handlers | verified HMAC + replay; SEC-15 | [08](08-verification-and-evidence-ledger.md) |
| UI surface enumeration | dashboard tabs, managed-site tabs, editor modals, developer panels, atomic editor | 263 catalogued features | [02](02-complete-feature-inventory.md) |

No tests were run and no database was touched in the second pass; everything was static and read-only.

## 3. Not inspected or only listed (risk)

| Subsystem | Reason | Risk |
|---|---|---|
| WordPress integration (~110 routes, plugin PHP, 11 job types) | Size; external target needed | Medium — large attack surface (SSO, plugin install, webhooks) not reviewed |
| Developer platform modules: `devops-platform`, `quality-platform`, `runtime-platform`, `intelligence-platform`, `code-intelligence`, `knowledge-graph`, `monorepo`, `containers`, `extensions` | Size; secondary to website builder | High where they execute code (see SEC-02) |
| Data platform data API/SDK/storage auth details | Time | Medium |
| Support desk, forum, licences, white-label, client billing, commerce routes | Time | Low–medium |
| Blueprint v2 routers' business logic (forms-leads, owner-experience, marketing-analytics, …) | Covered only by mount/auth integration test | Low–medium |
| Editor widgets, inspectors, navigation, integrations renderers (~35k lines) | Size | Medium (other raw HTML paths may exist beyond the 8 `dangerouslySetInnerHTML` uses scanned) |
| `wordpress-plugin/` (PHP), `tests/` root harness, `qa/`, `scripts/` | Time | Low |
| Per-handler review of all 38 data-platform handlers for `databaseId` binding | Time (pattern recorded as SEC-14) | High |
| Business logic of each developer-platform segment (runtime, devops, quality, extensions, MCP …) | Size | Medium |

Excluded as generated or vendored: `backend/src/generated/` (Prisma client, ~200k lines), `node_modules/`, `dist/`, `uploads/`, lockfiles (except targeted lookups).

## 4. Unavailable services / blocked verification
- Backend and frontend dev servers were not running; no HTTP-level runtime checks.
- Live AI providers, Stripe, PayPal, SMTP, WordPress, SFTP, OIDC IdP, Google Stitch: not called (cost/external side effects or no target).
- Docker compose stack not started; production deployment target unknown.
- `gh` CLI missing → CI history unavailable.
- Playwright browsers not installed → no browser E2E.

## 5. Missing requirements documents
- Product requirements for the website-builder launch: hosting model, billing/subscription owner, onboarding, supported integrations at launch, SLAs/SLOs, data-retention policy for customers.
- Production deployment architecture (edge/CDN, TLS, secrets, scaling, backups).

## 6. Remaining verification tasks (ordered)
1. HTTP-level confirmation of SEC-01/SEC-03 on a disposable local instance (anonymous upgrade succeeds) — expected to confirm; safe only on an isolated machine.
2. Fresh-install proof: empty scratch DB → `prisma migrate deploy` → boot → full suite (needs permission to create a scratch database).
3. Baseline run of `website-to-code-sync` on `testing` to classify QA-08.
4. Run the ~186 `node:test` script suites against `forge_hardening` and classify environment vs. real failures.
5. Browser check of SEC-05 and of the full editor journey.
6. ~~WordPress webhook signatures and raw-SQL scan~~ — done in the 2nd pass. Next: review all 38 data-platform handlers for `databaseId` binding (SEC-14) and browser-confirm the 21 vanishing widgets (PROD-10).
7. Live AI smoke with a hard spend cap.

## 7. Resuming this audit
The canonical ledgers are [02](02-complete-feature-inventory.md) (features) and [08](08-verification-and-evidence-ledger.md) (findings). Resume from §3 above, starting with the data-platform handlers (SEC-14), then the developer-platform modules that execute code, then the WordPress plugin PHP.

## 8. Repository changes made by this audit
Only new files under `docs/audit/` (00–12; 10–12 added in the 2nd pass). Helper scripts used for the mechanical checks live in the session scratchpad outside the repository. No application code, schema, migration, dependency, configuration or Git history was modified. The only database writes were made by the existing integration test suites to the disposable `forge_hardening` database; all other database access was read-only.
