# 05 — Quality, Security and Testing

Finding IDs refer to [08](08-verification-and-evidence-ledger.md).

## 1. Commands run (all non-destructive to tracked files)

| # | Command | Scope | Result | Notes |
|---|---|---|---|---|
| 1 | `npx tsc --noEmit -p .` | backend | **FAILED** — 1 error | `converter.ts(4,29) TS2307 '@tailwindcss/postcss'`: dependency declared and locked but missing from local `node_modules` (QA-01). Otherwise clean. |
| 2 | `npx tsc --noEmit -p tsconfig.app.json` | frontend | PASSED | 2 min 10 s |
| 3 | `npx eslint .` | frontend | PASSED — 0 errors, 3 warnings | Relaxed rule set (SEC-10) |
| 4 | `vitest run --no-file-parallelism src/tests/*.integration.test.ts src/tests/website-to-code-*.test.ts` with `DATABASE_URL=…/forge_hardening`, `FORGE_DISPOSABLE_TEST_DB=1`, `NODE_ENV=test` | backend | **FAILED** — 306/311 passed | 4 failures from a missing migration table (DATA-06), 1 page-naming failure (QA-08). Wrote only to the disposable test database. |
| 5 | Read-only SQL: `_prisma_migrations`, `information_schema.tables`, `pg_roles`, `pg_database` | dev + test DB | Completed | DATA-01, SEC-08 |
| 6 | `node -e` path-resolution check | none | Completed | SEC-06 guard logic |
| 7 | `curl` to `localhost:5000` / `:5173` | — | Services not running | No HTTP-level runtime checks performed |
| 8 | `gh run list` | CI | Could not run (`gh` not installed) | QA-05 |

Not run: production build (`npm run build` writes `dist/` and runs `prisma generate`, which modifies generated files), docker compose, ~186 `node:test` script suites, Part B root suites, browser specs, live AI smoke scripts (paid external calls).

## 2. Security findings by severity

### P0 — must fix before any internet-facing or multi-tenant deployment
- **SEC-01** Unauthenticated `/ws/terminal` → interactive host shell with full server environment. Reachable cross-site from a developer's browser.
- **SEC-02** Host-level command execution presented as a sandbox (`shell: true`, no isolation).
- **SEC-03** Anonymous `/ws/realtime` subscriptions to any project table change feed.
- **SEC-12** (2nd pass) Project SQL console runs arbitrary SQL on the platform's own connection pool/role with `public` on the search path — any user who creates a project can read or change platform tables.
- **SEC-13** (2nd pass) Table create/alter concatenates unvalidated column types and defaults into multi-statement DDL — SQL injection with the platform role.

### P1
- **SEC-04** OTP returned in responses / logged and delivery failure ignored whenever `NODE_ENV !== "production"` (uncommitted change; compose uses `development`).
- **SEC-05** Stored XSS between collaborators via unsanitized HTML elements in the editor canvas (published path is sanitized).
- **SEC-08** Application DB role is superuser with `BYPASSRLS`; RLS covers 4 tables.
- **SEC-14** (2nd pass) Data-platform handlers check project ownership but not that `databaseId` belongs to the project (cross-tenant database access by id).

### P2
- **SEC-06** `/api/hosted` traversal-guard flaw, unauthenticated, fabricated health.
- **SEC-07** Upload validation by extension, SVG on app-adjacent public path, full buffering before size check, no quota.
- **SEC-09** State-changing GET for migration recovery (staff only).

### P3
- **SEC-15** (2nd pass) WordPress inbound-webhook HMAC computed over re-serialised JSON (correctness; verification itself is present).
- **SEC-10** Lint rules disabled; heavy `any` usage.

Raw-SQL review (2nd pass): 81 `${…}` interpolations inside raw SQL in 11 files; apart from SEC-13 they are quoted identifiers (`quoteIdent`, `quote()`), placeholder builders or constants. The provisioner (`database-provisioner.service.ts:118-187`) builds `CREATE ROLE … PASSWORD '…'` with quote-doubling on a generated password and a quoted role name — acceptable but brittle.
- **SEC-11** No CSP/security headers for the SPA (nginx).

### Positive controls observed
Hashed OTP challenges with attempt limits and constant-time comparison; dummy-hash timing protection on login; DB-backed and IP rate limits on auth; `helmet` on API; CORS allow-list with production restriction; cookie-mutation origin checks; fail-closed website capability checks with explicit-deny precedence; changesets bound to document versions; idempotency keys on document commands; signed raw-body Stripe webhooks; encrypted AI prompt retention; error middleware that hides internals; published custom JS isolated in sandboxed iframes; DOMPurify on published HTML; `.env` files git-ignored (no secret values were printed in this audit).

## 3. Reliability and data integrity
- Strong: CAS saves, serializable transactions with bounded retries, job leases with `SKIP LOCKED`, reconciliation of interrupted AI runs and migrations at boot, approved purge.
- Weak: publish bypasses CAS (DATA-02); operational data in one JSON row (DATA-03); boot continues after schema failures (DATA-01); silent failures (DATA-05); local-disk state.

## 4. Performance
- `editorData` row carries up to 50 release snapshots and 25 backups; every publish rewrites it (DATA-03). Load payload size UNVERIFIED.
- Site generation blocks an HTTP request for up to 60 s per provider attempt (PROD-03).
- DB pool default `max: 5`, statement timeout 5 s (`config/prisma.ts:32-36`) — conservative; combined with in-process job polling and synchronous AI calls, capacity under load is UNVERIFIED (no load test executed; `tests/performance` exists, not run).
- Frontend: editor bundle includes a 21k-line component; route-level lazy loading exists. No bundle-size measurement was run.

## 5. Observability and recovery
- Logging: 235 `console.*` calls, partly structured JSON (`server.ts`). No error tracking, metrics, tracing or alerting (QA-06).
- Health: `/api/health`, `/api/live`, `/api/ready` (DB `SELECT 1`); staff diagnostics endpoints.
- Recovery: interrupted-run reconciliation; dead-letter table for jobs; release rollback by pointer. No platform DB backup/restore (QA-07).

## 6. Test coverage of critical workflows

| Workflow | Automated evidence | Executed here |
|---|---|---|
| Signup / login / OTP | `identity-security`, `local-otp-delivery`, `oidc-adapter` (node:test) | No |
| Onboarding → first site | none found end-to-end | — |
| Editor save / conflict | backend contracts (`document-contracts.ts`, `workspace-integration`) | No |
| Editor UI | none (QA-04) | — |
| AI generate → apply | `ai-changeset-integration`, `ai-site-*` (mocked providers likely) | No |
| Publish / rollback | `phase4-publishing`, `point17-release-integrity` | No |
| Public rendering | none | — |
| Billing | `licensing-billing`, `paypal-payment-integrity`, `saas-foundations` | No |
| Tenant isolation | `tenant-scoped-apis`, `tenant-rls`, `cross-system-security` | First two: **yes, pass** |
| Visual↔code / workspace sync | 8 suites | **yes, 1 failure** |
| Data platform migrations | `migration-authority`, `env-migration-target` | **yes, pass** |
| Purge | `website-purge` | **yes, pass** |

## 7. Pre-existing vs. new failures
No baseline run on `testing` was made, so this audit cannot say whether QA-08 is new. DATA-06 is new in the sense that its migration is staged in this branch and has never been applied to either local database.
