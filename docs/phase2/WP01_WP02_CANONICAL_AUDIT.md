# WP-01 + WP-02 — Canonical Single-Pass Audit and Issue Register

**Date:** 24 October 2026  
**Repository:** `navinray12/forgestudio-ai`  
**Source baseline:** `sconfigtesting`; **work branch:** `phase2/production-hardening`; draft [PR #42](https://github.com/navinray12/forgestudio-ai/pull/42).  
**Applies to:** WP-01 (execution, data and privilege security), WP-02 (database, tenancy, migration/pool lifecycle). **WP-00 baseline and WP-05 publishing remain separate scopes.**

## Rule: audit ONCE, implement incrementally

This file is the canonical starting inventory for WP-01/WP-02. Before modifying a module again, locate its issue ID below; add evidence/root cause to that row; change **only the smallest existing module boundary**; add a negative regression test; link an exact Git commit and CI run. Do not re-audit/refactor the entire codebase for each ticket. Reopen a closed issue only on a new failing reproduction. If a new trust boundary is found, add its own ID before changing code.

No issue is `CERTIFIED` based on a mocked test. Mark as `FIXED — CI VERIFIED` only when exact-head CI is green. `RELEASE BLOCKED` is distinct from `BROKEN`. Preserve the original component, database, API and directory architecture unless a planned, separately reviewed data migration is approved.

## Existing architecture map — do not conflate these paths

| Plane / path | Entry-point and implementation | Existing data ownership | Decision |
| --- | --- | --- | --- |
| Platform/control | `backend/src/config/prisma.ts` and `prisma/schema.prisma` | `User`, `Website`, `ProjectDatabase` metadata and authorization | Keep; migrations are schema authority |
| Dedicated website data | `modules/data-platform/data-layer/data.routes.ts` → `data.controller.ts` → `common/pool-manager.ts` → `database/database-provisioner.service.ts` | `ProjectDatabase(websiteId, environment)` resolves a separate PostgreSQL database and restricted login | Keep this contract; project + environment + principal must match |
| Database management & studio | `modules/data-platform/database/database.routes.ts`, `studio/studio.routes.ts`, related controllers | Authenticated website access; explicit DDL/provision/deprovision workflows | Keep independent of public CRUD; apply owner/admin mutation policy |
| Developer-managed database path | `database/forgeDatabase.service.ts` → `database/connectionManager.ts` | `ForgeDatabase(projectId, environment)`, schema-per-project on a shared `pgPool` with runtime schema provisioning | **WP02-07 OPEN** — second architecture; no blind consolidation/migration. Identify all callers, validate authorization and runtime DB privileges before deciding |
| Realtime | `data-layer/realtime.service.ts` → authorized Website → tenant pool → PostgreSQL LISTEN → `/ws/realtime` | Website project identity, production data environment, table-change events | Keep, but no unscoped row payloads |
| Runtime/terminal | `services/runtime/forgeSandbox.service.ts`, `services/terminal/forgeTerminal.service.ts`, controllers and WS gateway | Authenticated ForgeProject command execution; currently HOST `spawn` | Production execution intentionally **disabled** until separately attested remote isolated runner exists |

## Issue register (single authority)

| ID | Priority | Root cause and precise owner file | Remediation / acceptance | Status |
| --- | --- | --- | --- | --- |
| WP01-01 | P0 | `rls-claim-injector.ts`: authenticated users bypassed FORCE RLS check, while tenant database login owns tables | Require `relrowsecurity` and `relforcerowsecurity` on **all non-service credentials**; denial against live unprotected table | FIXED — CI VERIFIED on `bb4fd9c1` |
| WP01-02 | P0 | `rls-claim-injector.ts`, `data.controller.ts`: valid read-only website member could mutate production tables | Carry website `canAdminister` from authenticated session; deny `data:write` for non-admin in PRODUCTION; real editor POST=403 test | FIXED — CI VERIFIED on `bb4fd9c1` |
| WP01-03 | P0 | `data-layer/realtime.service.ts`: WebSocket used ForgeProject resolver despite Website-scoped data API | Authorize realtime via `verifyProjectAccess(websiteId,userId)`; retain listener lifecycle tests | FIXED — CI VERIFIED on `bb4fd9c1` |
| WP01-04 | P0 | `realtime.service.ts` previously broadcast unfiltered `record` and `oldRecord` | Publish only invalidation metadata, refetch via project/API/RLS | FIXED on earlier tested commit |
| WP01-05 | P0 | Developer shell `forgeSandbox.service.ts` uses host `spawn`; env flag was mistaken for VM proof | Fail closed in production; build and attest separate container/microVM runner before enabling feature | **RELEASE BLOCKED** — host runtime disabled; secure runner not implemented |
| WP01-06 | P1 | WebSocket sessions may outlive membership revocation; listener recovery and concurrent subscribe semantics need real network qualification | Auth epoch/membership revalidation on long-lived sockets, LISTEN retry and disconnect harness | OPEN — not release-certified |
| WP01-07 | P1 | Service-role project key deliberately bypasses row policies through per-request GUC | Independently review service credential scope, key storage/rotation, audit and network exposure with least-privilege live roles | OPEN — security review required |
| WP02-01 | P0 | `common/pool-manager.ts`: any missing pool on a read triggered privileged tenant database provisioning | Remove implicit provisioning from reads; 404 without inserted `ProjectDatabase`; explicit authenticated management route provisions | FIXED — CI VERIFIED on `bb4fd9c1` |
| WP02-02 | P1 | `common/pool-manager.ts`: simultaneous cache misses created multiple independent connection pools | Single-flight pending promise per website/environment; integration asserts same pool | FIXED — CI VERIFIED on `bb4fd9c1` |
| WP02-03 | P0 | `pool-manager.ts`: historical database record pointed at platform DB/admin login | Reject record and attest real PostgreSQL user, owner, database, superuser/bypass/DDL flags before caching | FIXED on earlier tested commit |
| WP02-04 | P0 | Clean migrations omitted `websites.deletedAt` and data-platform catalog; lazy request-time DDL hid drift | 42 versioned migrations; migrate deploy/status and 7 live provision/API cross-tenant tests on disposable PostgreSQL | FIXED, CI verified |
| WP02-05 | P1 | `database/database-provisioner.service.ts`: historical admin-DB fallback | Fail closed and mark FAILED; do not return control-plane database on tenant provisioning failure | FIXED, tested |
| WP02-06 | P0 | Tenant schema/user revocation and stale-pool invalidation, read replica, quotas and backup/restore not yet live-certified | Run independent database recovery, secrets rotation, load/limit, and deprovision race tests | OPEN — production environment evidence |
| WP02-07 | P0 | **Two customer database implementations**: `ForgeDatabase` shared-schema `connectionManager.ts` vs dedicated `ProjectDatabase` tenant roles | Trace route callers, enforce owner/site & environment and real least privilege in shared-schema path, formally decide product support and migration strategy | OPEN — architecture review, no broad refactor |
| WP02-08 | P1 | Shared-schema `forgeDatabase.service.ts#getDatabase()` auto-provisions and `connectionManager.ts` executes on `pgPool` with tenant-specific search_path | Separate focused security review: bind dbId to owner, eliminate unsafe implicit creation, test schema isolation under two tenants | OPEN — requires independent integration path |
| WP02-09 | P0 | `api-layer/dataApi.service.ts`: absent API exposure config granted access and new customer tables started `isExposed=true` | Fail closed with HTTP 403 unless explicit enabled config permits operation; new tables default private; unit tests `wp02-api-exposure-defaults.test.ts` | **FIXED — CI VERIFIED** at `d3bbfb35`; 4/4 tests passed |

## Test evidence and regression location

**Baseline last proven before this work:** GitHub [Phase 2 qualification 40078291534](https://github.com/navinray12/forgestudio-ai/actions/runs/40078291534), 6/6 jobs; 42 migrations, 7 live HTTP+PostgreSQL tests, 71 focused tests, 247 MCP/XSS tests, frontend build/lint and identity/AI qualification checks.

**Current code + audit evidence:** [Phase 2 qualification 40079386681](https://github.com/navinray12/forgestudio-ai/actions/runs/40079386681) on commit `bb4fd9c1bb10d1da20e2e641032a3b4a9e527939` — all six jobs passed. Fresh PostgreSQL: 42 migrations and **11/11 live tenant HTTP tests**; source-level checks include 247 MCP/security/XSS tests plus backend/frontend builds. This report-only document update is not itself covered by that earlier commit; recheck the exact branch head after updates.

**Latest code-gate result:** [Phase 2 qualification 40079774685](https://github.com/navinray12/forgestudio-ai/actions/runs/40079774685) on `d3bbfb353dcac410f2e004926dede7859e0757a7`: **7/7 jobs passed**, comprising backend/frontend builds, global-widget verification, hosting isolation, 42 clean migrations, **11/11 real dedicated-tenant HTTP tests**, **14/14 real PostgreSQL restricted-role RLS tests**, **77/77 focused backend tests**, and **247/247 MCP/XSS security regressions**. Existing identity, AI, and frontend lint workflows are separate; do not silently count them if still running.

**Security/API behavior change:** The legacy ForgeDatabase generated-API adapter now defaults new table API exposure to `false`; missing table API configs no longer grant CRUD access. Consumers must explicitly enable/configure exposure, and website owner authorization for that management path remains a separate acceptance gate (WP02-07/08).

**Added in this issue pass:**
- `backend/src/tests/wp01-data-credential-validation.test.ts`: authenticated session FORCE RLS + editor write restriction
- `backend/src/tests/wp01-realtime-subscription-isolation.test.ts`: canonical website access check
- `backend/src/tests/wp01-real-data-plane.integration.test.ts`: real editor production-write 403, auth session unprotected table 403, no implicit DB provisioning, concurrent pool equality
- `backend/src/modules/data-platform/common/pool-manager.ts`: single-flight tenant pool, explicit-provision-only reads

**Quality gate:** `.github/workflows/phase2-qualification.yml` now includes two **separate disposable PostgreSQL** jobs: (1) dedicated tenant + live HTTP test, and (2) pre-existing restricted-role tenant RLS/rollback tests. Both passed at `d3bbfb35`. Every subsequent code/document commit needs fresh exact-SHA verification.

## Release decision and acceptance boundary

Do not call WP-01 or WP-02 `DONE` until the high-priority OPEN rows are resolved or the disabled features explicitly removed from release scope, AND their real-environment acceptance evidence exists. In particular, no product manager should interpret a safe 404 or disabled shell as a functional website publishing/developer execution feature.

**Production decision at this checkpoint: NO-GO** pending secure hosted release, isolated code execution, full shared-schema/database architecture qualification, deployed least-privilege and security verification. No changes have been merged into `sconfigtesting`.

## Work-order rule

Prioritize verified P0 issues and follow this order: security boundary → negative test → positive functionality → transaction/pool lifecycle → CI evidence → update this file. Every follow-up must refer to issue IDs, avoiding repeated repository-wide audits. Do not assert new source-level fixes are verified until current CI results support them.
