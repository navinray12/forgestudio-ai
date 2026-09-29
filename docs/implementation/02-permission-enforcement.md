# Increment 2: permission enforcement

Requirements: AUTH-002, SEC-003, L-02, L-08.

The existing service exports and role vocabulary remain available. A failed
permission lookup denies access instead of returning to role defaults. Unknown
capabilities/effects are denied. Applicable DENY overrides win over narrower
ALLOW overrides, owner shortcuts and legacy EDIT/MANAGE_TEAM aliases.

Permission mutations use one Prisma transaction for the mutation and mandatory
audit. A caller cannot grant an action outside its own effective capability.
Owner restrictions remain protected; middleware requires a website scope.

Run: `node --experimental-vm-modules --test tests/hardening/*.test.mjs`.
Local source-unit result: 36 passed, 0 failed (17 session + 19 permission).
The transaction double verifies the service's boundary and rejection behavior;
it does not certify real PostgreSQL isolation, concurrency or full API coverage.
The legacy website-access resolver and all additional entry points still require
migration to the tenant UnitOfWork and current-authority enforcement.

No schema migration or production deployment was executed. Back up and review
existing granular overrides before rollout: a narrower ALLOW can no longer
bypass an applicable DENY. Do not restore fail-open behavior to handle schema
or availability errors. The original integration suites are not replaced.
