# WP-00 / WP-01 — Audit, Remediation and Release Evidence

**Date:** 24 October 2026  
**Planning authority:** *ForgeStudio AI — Phase 2 Product Completion & Delivery Blueprint* (11 pages, 24 October 2026); work packages WP-00 and WP-01, Wave 0.  
**Branch:** `phase2/production-hardening`, PR [#42](https://github.com/navinray12/forgestudio-ai/pull/42). Source branch `sconfigtesting` is not modified by this work.  
**Rule:** The actual GitHub run for the final commit is authoritative. **A green suite does not certify a deployed product or all runtime security.**

## Scope completion ledger

| Scope | Blueprint acceptance | Implementation status | Remaining evidence |
| --- | --- | --- | --- |
| WP-00 — Evidence baseline | Reproducible checkout/build, current source route & UI entry points, migrations, tests, evidence by SHA | Builds, disposable PostgreSQL migrations, CI gates and security entry-point inventory wired | Complete current 263-feature rebaseline and target staging/real-service journey coverage; retain QA/CI evidence per SHA |
| WP-01 — Execution/data security | No unauthenticated/cross-tenant runtime, SQL or app-data exposure; negative auth, SSRF, XSS and isolation tests | High-severity code paths hardened and regression tests added; unsafe legacy hosting/host shell fail closed | Real-service/real-db multi-tenant attack harness, verified OS/container isolation for developer runtime, tenancy RLS + service-role policy review, public publishing/terminal replacement, independent security review |

**Both scopes remain IN PROGRESS until every exit gate is evidenced. Never claim that the security quarantine constitutes a working production runtime.**

## Actual application wiring reviewed

| Existing boundary | Source files and contracts | Risk evaluation |
| --- | --- | --- |
| Identity/session | `backend/src/services/session-authentication.ts`, `middlewares/auth.middleware.ts`, `websocketGateways.ts` | Session verification already present; extend it rather than replacing identity stack |
| Developer terminal | `backend/src/controllers/project/terminal.controller.ts`, `services/terminal/forgeTerminal.service.ts` | Previously, terminal session IDs could reach command execution without checking owner of the session's project |
| Host process execution | `backend/src/services/runtime/forgeSandbox.service.ts`, `controllers/project/sandbox.controller.ts` | `FORGE_CONTAINER_RUNTIME` label did not change host `spawn`; process termination lacked target-project binding |
| Realtime events | `backend/src/modules/data-platform/data-layer/realtime.service.ts`, `websocketGateways.ts` | Unsubscribe could release other socket's LISTEN ref; repeated subscribe altered ref counts; listener failure was acknowledged |
| Public data CRUD | `data-layer/data.routes.ts`, `data.controller.ts`, `rls-claim-injector.ts` | Unverified service key prefixes and unsigned JWT payloads could gain tenant privileges; missing project membership checks and key scope enforcement |
| Data Studio | `modules/data-platform/studio/studio.controller.ts`, `studio-sql.service.ts`, `common/project-access.ts` | Existing controller access/production confirmation read; real dedicated-DB privilege & SQL negative testing still required |
| Project tenant databases | `modules/data-platform/database/database-provisioner.service.ts`, `common/pool-manager.ts` | Historical fail-open shared admin DB fallback; prior READY records could continue using platform DB |
| MCP outbound services | `src/tests/regression/mcp-egress.test.ts`, `mcp-trust-approval.test.ts` and corresponding services | Existing tests cover SSRF addresses, redirect/DNS rebinding, trust approvals |
| Published legacy host | `backend/src/routes/hosted.routes.ts` | Quarantined as 404 until safe project/deployment authorization exists |
| HTML sanitization | `frontend/src/utils/sanitizeHtml.ts`, `backend/src/tests/phase1-security-remediation.test.ts` | Cross-stack XSS suite in CI; current policy does not replace browser/site E2E validation |

## Changes made, grouped by security control

**SEC-RUNTIME.** `services/runtime/forgeSandbox.service.ts` prevents application-host `spawn` from being enabled by setting runtime labels. It is closed for production/staging/test and enabled only under explicit local development opt-in. `controllers/project/sandbox.controller.ts` verifies a process belongs to the authorized project before terminating it.

**SEC-TERMINAL.** `services/terminal/forgeTerminal.service.ts` checks the verified principal and real session project's authorization for every command, including empty requests, and refuses closed sessions. `controllers/project/terminal.controller.ts` forwards the authenticated role. Production host execution is not enabled.

**SEC-REALTIME.** `data-layer/realtime.service.ts` acquires LISTEN only before acknowledging a subscription, makes repeat subscription idempotent, rejects unsubscribe from sockets that have not subscribed, and releases failed LISTEN connections.

**SEC-DATA-API.** `data-layer/data.routes.ts` and `data.controller.ts` require project authentication for SDK and realtime DDL endpoints; mutations check existing production policy. CRUD applies verified key scope checks and database FORCE RLS validation for public API keys.

**SEC-CREDENTIALS.** `data-layer/rls-claim-injector.ts` rejects forged/unregistered/revoked/expired API keys, never trusts unsigned JWT content, authenticates bearer tokens through the existing session service, and checks website membership for the authenticated principal. Missing credentials are 401 instead of implicitly anonymous.

**SEC-TENANCY.** `database/database-provisioner.service.ts` fails closed if dedicated tenant database creation/setup fails; never substitutes platform administrator database/password. `common/pool-manager.ts` rejects historical READY records pointing to platform database/user.

**CI.** `.github/workflows/phase2-qualification.yml` now has fresh PostgreSQL versioned migration deployment/status, production frontend/backend builds, scoped WP-01 tests and existing MCP/HTML XSS security regression suites. Previous failures due missing generated Prisma client, cross-stack DOMPurify installation, and a persistent unit-test mock were fixed without disabling tests.

## New WP-01 regression files

- `backend/src/tests/wp01-host-execution-isolation.test.ts`
- `backend/src/tests/wp01-terminal-authorization.test.ts`
- `backend/src/tests/wp01-realtime-subscription-isolation.test.ts`
- `backend/src/tests/wp01-sandbox-termination-authorization.test.ts`
- `backend/src/tests/wp01-data-api-authorization.test.ts`
- `backend/src/tests/wp01-data-credential-validation.test.ts`
- `backend/src/tests/wp01-tenant-database-isolation.test.ts`
- `backend/src/tests/wp01-legacy-pool-isolation.test.ts`

## Evidence and honest limits

- [Passing six-job build/migration/security run at earlier patch SHA](https://github.com/navinray12/forgestudio-ai/actions/runs/40076200008): frontend/backend builds, fresh PostgreSQL migrate deploy/status, global-widget unit/UI, hosted/runtime authorization, MCP egress and XSS suite.
- The **latest** SHA adds legacy pool rejection tests; use GitHub Actions on PR #42 for the final job results, not prior runs.
- Test doubles validate negative permission contracts but are not a substitute for independent cross-tenant PostgreSQL connections and attacker-controlled HTTP/WebSocket network traffic.
- The existing identity workflow and dependency audit are separate required checks. Earlier branch CI was green; each new commit needs fresh qualification.
- No real isolated Docker/gVisor/Firecracker executor has been implemented. Host execution is intentionally unavailable in production; dependent features remain blocked until an isolated service is designed and qualified.
- Existing `FORCE RLS` and API-key scope gates are additional controls; the exact tenant table policies, actual caller DB privileges, and all external data-plane entry points still need real PostgreSQL verification.
- **Never merge this draft PR or enable untrusted runtime solely because these tests passed.**

## Definition of done for these two scopes

WP-00 is certifiable only after the final commit has a reproducible compile, migration, route inventory, security fixture/journey matrix, required checks and documented outstanding issues. WP-01 is certifiable only after every public runtime/data-plane security entry point passes anonymous, forged credential, foreign-tenant, production-mode, injected SQL/XSS, stale session and recovery tests **on both isolated unit and real disposable integration environments**, with blocked features explicitly treated as unavailable rather than as completed functionality.
