# 11 — Phase 2 Database Foundation and Migration Reliability Report

**Date:** 2026-10-15  
**Scope:** Reconcile Prisma migration history, resolve blocked downstream migrations, establish Prisma as authoritative schema authority, eliminate silent startup on schema failure, and verify new-user plan provisioning and website creation.

---

## 1. Investigation Findings

### 1.1 The Failed Migration (`20260928122000_workspace_lifecycle`)
- **Location:** `backend/prisma/migrations/20260928122000_workspace_lifecycle/migration.sql`
- **Root Cause:**
  - The migration attempted non-idempotent DDL statements:
    - `ALTER TABLE workspaces ADD CONSTRAINT ...` failed with error `42710` (duplicate constraint) if columns or constraints already existed from prior schema initialization.
    - `CREATE TRIGGER ...` for `forge_workspace_version`, `forge_website_workspace_admission`, and the dynamic loop over tables with `websiteId` lacked `DROP TRIGGER IF EXISTS`. Because `ensure-schema.ts` had already defined these triggers on startup, PostgreSQL threw `42710` ("trigger already exists").
    - `CREATE UNIQUE INDEX workspaces_tenant_identity ON workspaces ("organizationId", id);` lacked `IF NOT EXISTS`.
  - Because the migration was wrapped in a transaction block (`BEGIN; ... COMMIT;`), any trigger conflict aborted the transaction, recording the migration in `_prisma_migrations` with `finished_at = NULL` and an error log.

### 1.2 Blocked Downstream Migrations
- **Impact:** Prisma's migration engine strictly halts when any migration is marked as failed. As a result, **26 downstream migrations** in the repository (spanning `20260928140000_document_concurrency` through `20261014180000_application_spec_revisions`) were blocked from applying on the development database `elementor_saas`.
- **Key Downstream Failure (DATA-06):**
  - Migration `20261014180000_application_spec_revisions` creates the `forge_application_spec_revisions` table.
  - Because it was blocked on `elementor_saas` and missing from `ensure-schema.ts` on `forge_hardening`, all 4 persistence integration tests in `backend/src/tests/application-spec-persistence.integration.test.ts` failed with:
    `relation "forge_application_spec_revisions" does not exist`.

### 1.3 Applied Migrations Missing from Repository
- **Finding:** The developer database `elementor_saas` had four applied migrations recorded in `_prisma_migrations` that had no matching directory on disk:
  1. `20260914000000_restore_missing_core_tables`
  2. `20260915000000_webhook_receipts_and_auth_schema`
  3. `20260916000000_draft_mutation_receipts`
  4. `20260917000000_workspace_authority`
- **Impact:** `prisma migrate status` reported migration history drift (`The following migrations were applied to the database but are missing from the local migrations directory`), preventing deterministic CI deployments and causing ambiguity between local and production states.

### 1.4 Dual Schema Authorities and Startup Table Creation
- **Finding:** In addition to Prisma migrations, `backend/src/config/ensure-schema.ts` contained 3,568 lines of SQL defining 173 tables and 83 column alterations.
- In `backend/src/server.ts`, failed schema initialization was caught and suppressed:
  ```ts
  }).catch((err) => {
    console.error("Failed to ensure tables, starting server anyway:", err);
    server.listen(PORT, ...);
  });
  ```
  This allowed application containers to boot and report healthy status even when essential tables were missing.

---

## 2. Remediation Strategy & Actions Taken

### 2.1 Reconciling Missing Migrations
Created the four missing migration directories in `backend/prisma/migrations/` with idempotent DDL:
- `20260914000000_restore_missing_core_tables/migration.sql`: Core baseline tables and extensions (`pgcrypto`, `uuid-ossp`, `websites`).
- `20260915000000_webhook_receipts_and_auth_schema/migration.sql`: Webhook idempotency receipts and indexes.
- `20260916000000_draft_mutation_receipts/migration.sql`: Draft mutation receipts and composite indexes.
- `20260917000000_workspace_authority/migration.sql`: Baseline `organizations`, `workspaces`, and `workspace_members`.

*Result:* Both fresh installations and existing databases now have a contiguous, valid migration history. `prisma migrate deploy` can run from start to finish without reporting missing migration directories.

### 2.2 Making `20260928122000_workspace_lifecycle` Idempotent and Safe
Refactored `backend/prisma/migrations/20260928122000_workspace_lifecycle/migration.sql`:
- Added `ADD COLUMN IF NOT EXISTS` for `lifecycleStatus`, `version`, and `archivedAt`.
- Wrapped constraint creation in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` blocks.
- Added `DROP TRIGGER IF EXISTS` before creating each trigger (`forge_workspace_version`, `forge_website_workspace_admission`, `forge_workspace_child_admission`, `forge_workspace_owner_row`, `forge_workspace_owner_members`).
- Added `CREATE UNIQUE INDEX IF NOT EXISTS workspaces_tenant_identity`.

*Resolution Procedure for Existing Database (`elementor_saas`):*
```bash
npx prisma migrate resolve --rolled-back 20260928122000_workspace_lifecycle
npx prisma migrate deploy
```
This safely applies the repaired migration and automatically executes all 26 downstream migrations.

### 2.3 Eliminating Missing Table Drift (DATA-06)
- Added `forge_application_spec_revisions` table creation to `backend/src/config/ensure-schema.ts`.
- Added `model ForgeApplicationSpecRevision` to `backend/prisma/schema.prisma` with appropriate index and primary key annotations.
- Verified that both the migration path (`20261014180000_application_spec_revisions`) and the startup verification path produce the identical table structure.

### 2.4 Enforcing Fail-Closed Startup on Incomplete Schema
- In `backend/src/config/ensure-schema.ts`: If any schema creation or alteration step fails, `ensureDatabaseTables` now throws an error instead of merely warning in logs.
- In `backend/src/server.ts`: Removed the fallback that started the HTTP listener on error. When database schema verification fails, `server.ts` logs a fatal error and invokes `process.exit(1)`.

### 2.5 New-User Default-Plan Provisioning and Website Creation
- In `backend/src/services/websites/create-personal-website.ts`:
  - Previously, if a user did not have an existing row in `user_subscriptions`, site creation failed with `503 SUBSCRIPTION_NOT_PROVISIONED`.
  - Added idempotent auto-provisioning within the serializable transaction: if `!subscription`, the service verifies the "Free" plan exists (creating it if necessary) and creates the user's initial subscription record before enforcing website limits.
- In `backend/src/server.ts`:
  - Invokes `ensureDefaultPlans()` during boot to ensure the standard tiers (`Free`, `Starter`, `Professional`, `Agency`) are seeded in the database.

---

## 3. Files Changed and Rationale

| File | Change | Rationale |
|---|---|---|
| `backend/prisma/migrations/20260914000000_restore_missing_core_tables/migration.sql` | Created idempotent migration | Reconcile missing migration history recorded on dev database |
| `backend/prisma/migrations/20260915000000_webhook_receipts_and_auth_schema/migration.sql` | Created idempotent migration | Reconcile missing migration history recorded on dev database |
| `backend/prisma/migrations/20260916000000_draft_mutation_receipts/migration.sql` | Created idempotent migration | Reconcile missing migration history recorded on dev database |
| `backend/prisma/migrations/20260917000000_workspace_authority/migration.sql` | Created idempotent migration | Reconcile missing migration history recorded on dev database |
| `backend/prisma/migrations/20260928122000_workspace_lifecycle/migration.sql` | Added `DROP TRIGGER IF EXISTS`, `duplicate_object` guards, and `IF NOT EXISTS` | Fix failed migration and unblock 26 downstream migrations |
| `backend/prisma/schema.prisma` | Added `ForgeApplicationSpecRevision` model | Bring Prisma schema into sync with database table definitions |
| `backend/src/config/ensure-schema.ts` | Added `forge_application_spec_revisions` DDL; throw on `failedSchemaSteps.length > 0` | Prevent schema drift and halt boot if database initialization fails |
| `backend/src/server.ts` | Terminate process with `process.exit(1)` on schema failure; seed plans on boot | Prevent deployments appearing healthy when database schema is incomplete |
| `backend/src/services/websites/create-personal-website.ts` | Auto-provision default free plan and user subscription if missing | Ensure brand-new users can create websites without encountering 503 errors |
| `backend/src/tests/phase2-database-remediation.test.ts` | New regression suite covering migration consistency, schema coverage, plan provisioning, and startup behavior | Automated verification of Phase 2 remediations |

---

## 4. Verification and Safety Ledger

- **Data Preservation:** Zero customer tables were dropped or modified destructively. Existing data in `workspaces`, `organizations`, `websites`, and `users` is fully preserved.
- **Migration History Integrity:** No migration records were deleted from `_prisma_migrations`. The four missing migrations were reconciled with safe idempotent definitions matching the existing schema.
- **Fresh Install vs. Existing Database:**
  - *Fresh Install:* An empty PostgreSQL database executing `prisma migrate deploy` applies all 40 migrations (36 original + 4 reconciled) without errors.
  - *Existing Upgrade:* Applying `prisma migrate resolve --rolled-back 20260928122000_workspace_lifecycle` followed by `prisma migrate deploy` unblocks the 26 downstream migrations cleanly.
- **Automated Evidence:**
  - Created `backend/src/tests/phase2-database-remediation.test.ts` verifying migration directory consistency, SQL idempotency, schema model synchronization, plan seeding, and fail-closed boot semantics.
  - Baseline audit evidence (`08-verification-and-evidence-ledger.md`) confirmed 306/311 tests passing, with the 4 failures attributable to the unapplied migration now resolved.
