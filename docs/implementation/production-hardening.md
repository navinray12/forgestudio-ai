# Production hardening execution record

Baseline: `76b68ee502b5203d4e50ccd4640b8796a6718e31`.
Authority: Adaptive SaaS Architecture Standard v3, then the supplied backend v2
and unsuperseded AWS v1 requirements. Direct fast-forward commits to `main` are
an explicit repository-owner override for this implementation session; branch
protections and production deployment approvals are not weakened.

## Inventory and requirement-to-file map

This is a scoped inventory, not a completed whole-repository certification.

| Requirement | Existing path | Increment / remaining work |
| --- | --- | --- |
| AUTH-003, L-11 | `backend/src/middlewares/auth.middleware.ts` | Check account status; fail closed; remove authentication-time DDL; coalesce activity writes |
| AUTH-002, SEC-003 | `backend/src/services/permission.service.ts` | Pending: fail closed on override lookup; transactional audit |
| BILL-001, FG-008 | `backend/src/services/subscription.service.ts` | Pending: block unverified paid activation; remove synthetic success and fail-open quotas |
| TEN-001 | `backend/src/services/workspace.service.ts` and schema | Pending inventory, membership policies, lifecycle and same-organization workspace isolation |
| FG-007 | `frontend/src/pages/editor/components/CodeInjectionRuntime.tsx` | Pending isolated content runtime and browser evidence |
| FG-012 | `wordpress-plugin/forgestudio-connector.php` | Pending connector authentication migration and integration tests |
| DATA-003 | `backend/prisma/migrations/` | Pending complete schema/migration drift rehearsal; auth no longer performs repair |

## Increment 1: session validation

Suspended/deleted/unknown account states are denied even when the session has not
expired. Every request still reads current session revocation, expiry and account
status. Activity timestamps use a conditional update at most once per minute per
session; this is not a cached authorization decision. Database errors propagate
without an ALTER TABLE attempt or a synthetic authenticated user.

Prerequisite: verify the existing
`20260920000000_add_optimization_and_enterprise` migration has been applied
through the approved migration process before deploying to a previously drifting
database. This commit does not run migrations against any environment.

Run the dependency-free source-unit tests on Node 22.16.0:

```sh
node --experimental-vm-modules --test tests/hardening/*.test.mjs
```

Tests execute the actual TypeScript module with explicit database doubles. Node's
experimental stripping/VM APIs are confined to this test harness. They are not
production execution dependencies and do not type-check the entire application.
Local result for increment 1: 17 passed, 0 failed. Full build, real PostgreSQL,
browser, payment-provider, cloud, load, recovery and deployment checks have not
been executed. The existing integration suites remain intact.

Rollback: use a reviewed forward fix or revert the affected commit after impact
review. Reverting restores the previous authentication weaknesses; it is not a
recommended operational workaround for a missing migration. Never force-reset
`main` or drop customer data.
