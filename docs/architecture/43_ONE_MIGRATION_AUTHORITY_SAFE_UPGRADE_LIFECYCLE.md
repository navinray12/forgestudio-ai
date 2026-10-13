# Blueprint Point 43 — One Migration Authority and Safe Upgrade Lifecycle

## 1. Overview & Single Namespace Authority

Blueprint Point 43 establishes [UnifiedMigrationAuthorityService](file:///c:/Users/navin/Downloads/forge-main/forge-main/backend/src/services/migration/unifiedMigrationAuthority.service.ts), guaranteeing that exactly one migration engine owns every physical database namespace (`PRISMA_QUALIFIED` or `FORGE_MANAGED`), eliminating competing DDL conflicts.

---

## 2. Immutable Migration Plan & 12 Lifecycle States

Every schema change is governed by an immutable plan binding:
- Target binding and physical namespace.
- Source and target schema hashes.
- Ordered migration-set checksum.
- Individual statement hashes and transactionality classifications.
- Dual rehearsal results.
- Fenced namespace lease tokens.

### 12 Explicit States:
1. `planned`
2. `preflight-passed`
3. `rehearsed`
4. `approved`
5. `applying`
6. `validating`
7. `applied`
8. `cancelled`
9. `failed`
10. `partially-applied`
11. `uncertain`
12. `recovery-required`

---

## 3. Hazard Mitigation & Execution Integrity

1. **Dual Rehearsals:**
   - Every plan must rehearse successfully against both an empty database and a prior-release database populated with realistic synthetic data before approval.
2. **Hazard Detection:**
   - Detects duplicate values prior to applying unique constraints.
   - Enforces bounded backfills before applying NOT NULL constraints.
   - Preserves column renames without dropping and recreating columns.
3. **Non-Transactional Operations:**
   - Statements like `CREATE INDEX CONCURRENTLY` are flagged as non-transactional (`isTransactional: false`) and executed in resumable phases with catalog verification.
4. **Fenced Concurrency Leases:**
   - Distributed leases prevent multiple workers from executing migrations concurrently within the same physical namespace.
5. **Uncertain Outcome Reconciliation:**
   - If target DDL succeeds but control-plane status fails, the service queries the target catalog and compares observed schema checksums, reconciling the state to `applied` if evidence matches or `recovery-required` if mismatch occurs.
6. **Forward-Fix Recovery:**
   - Unsafe down migrations are prevented; safe forward-repair plans are generated and executed instead.

## 5. Implementation: one durable authority, real PostgreSQL DDL (WP-21)

`UnifiedMigrationAuthorityService` (`backend/src/services/migration/unifiedMigrationAuthority.service.ts`)
is the only code that sends DDL to a customer database schema (`forge_databases`). It keeps no
state in memory. `MigrationEngine.applyMigration`, `rollbackMigration` and `reconcileMigrationState`
delegate to it, as do the HTTP routes and the CLI.

### 5.1 Durable record

One row of `forge_database_migrations` per migration: `status` (the lifecycle state), `plan`
(immutable: ordered statements with checksums, hazards, destructive flag, dependencies, budgets),
`lifecycle` (preflight evidence, rehearsal results, approval, per-phase progress, database
evidence), and the lease columns. Every transition is a compare-and-set on `status`.

| State | Meaning |
| --- | --- |
| `PENDING` | Planned. Also where a plan returns when a check fails or the target changed. |
| `PREFLIGHT_PASSED` | Identity, binding, privileges, integrity, drift, dependencies, hazards and budgets checked. |
| `REHEARSED` | Applied for real in two scratch schemas (empty and prior-release), both dropped again. |
| `APPROVED` | Approved for one hour, for exactly this set of statements. |
| `APPLYING` / `VALIDATING` | Holding the database's lease; DDL running, then evidence being read back. |
| `APPLIED` | The target's `_forge_migrations` ledger holds the name and checksum. |
| `FAILED` | Nothing of the plan is in the target (checked). May be retried through every gate. |
| `PARTIALLY_APPLIED` | Some non-transactional phases committed; `execute` resumes from the recorded progress. |
| `UNCERTAIN` | The outcome could not be read from the target; `reconcile` resolves it. |
| `RECOVERY_REQUIRED` | The target records the name with different SQL; needs a forward-fix plan. |
| `CANCELLED`, `ROLLED_BACK` | Withdrawn, or reverted by a later governed plan. |

### 5.2 Gates before DDL

- **Target identity**: the migration, its database, the project and the stated environment must
  agree (`MIGRATION_TARGET_MISMATCH`, `PROJECT_MISMATCH`, `ENVIRONMENT_MISMATCH`); the schema must be
  a `forge_cust_*` schema registered for exactly one database and present with its ledger.
- **Environment binding** (Phase 1 persistence): the plan is pinned to the binding version seen at
  preflight; production requires an active `RESTRICTED_PRODUCTION` binding.
- **Privileges**: the session role must hold CREATE and USAGE on the schema.
- **Integrity**: SQL and per-statement checksums must match what was planned, at every step.
- **Drift**: the target's ledger and the control plane must agree in both directions, and the
  schema's catalog fingerprint must equal the one recorded when the last migration was applied.
  A change made outside the authority is accepted only by adopting a baseline.
- **Dependencies**: listed dependencies applied; no other migration of the database unresolved.
- **Hazards** (checked on the target, read-only): duplicate values before a unique rule; NULLs or
  existing rows before NOT NULL, unless the plan backfills first; uniqueness over an expression is
  refused as unverifiable.
- **Budgets**: lock timeout 5 s, statement timeout 30 s, total 5 min, and no blocking ALTER on a
  table estimated above one million rows.
- **Dual rehearsal**: "empty" replays the recorded history from nothing when it accounts for every
  table, otherwise clones the structure without rows; "prior release" clones the structure with
  data (all rows up to 10,000 per table, a sample beyond that, generated rows for empty tables).
- **Approval**: outside production the requester's governed run is the approval. In production an
  administrator approves explicitly, and a destructive plan needs `acknowledgeDestructive`.
  The gates are evaluated again immediately before execution; a target that changed since the
  rehearsal sends the plan back to `PENDING`.

### 5.3 Execution

- Fencing: a partial unique index admits one `APPLYING`/`VALIDATING` row per database across
  instances, and the executing session holds an advisory lock on the database.
- The session's search path is the customer schema alone, so an unqualified name cannot resolve
  to a control-plane table; the session is discarded afterwards.
- Transactional statements and the ledger insert share one transaction. A statement that cannot
  run in a transaction (`CREATE INDEX CONCURRENTLY`) is a phase of its own, with progress recorded
  after each phase and an invalid index from an earlier attempt dropped before it is rebuilt.
- The outcome is decided from the target: ledger row with the same checksum → `APPLIED`;
  different checksum → `RECOVERY_REQUIRED`; no row and nothing committed → `FAILED`; phases
  committed → `PARTIALLY_APPLIED`; target unreadable → `UNCERTAIN`.
- `reconcile` runs no DDL and refuses while the original session still holds the advisory lock.
  Interrupted migrations whose lease has expired are reconciled at server start.

### 5.4 Entry points

`POST /api/v1/projects/:id/database/:databaseId/migrations/plan`, `…/baseline`, and
`…/:migrationId/{preflight|rehearse|approve|execute|reconcile|retry|cancel}`.
`…/:migrationId/apply`, `POST …/database/migrations/unified-execute` and the CLI `migrate` action
run the governed sequence in one call for non-production databases; for production they stop
after the rehearsal (`APPROVAL_REQUIRED`, or 202 with `approvalRequired`). `…/rollback` runs the
down SQL as a governed plan outside production and is refused in production.

### 5.5 Unresolved hazards

- **Other DDL paths on the same schemas are not governed.** `forgeDatabaseService`
  (`createTable`, `alterTable`, `dropTable`, `truncateTable`, `createIndex`, `dropIndex`,
  `restoreBackup`) and the SQL console still execute directly, in any environment. The authority
  detects their effect as schema drift and refuses to run until a baseline is adopted; it does not
  prevent them.
- Those paths still use `customerConnectionManager`, whose search path is `<schema>, public`.
- The Database Studio for `project_databases` (`/studio/migrations`, `database_migration_records`)
  is a separate family of databases with its own direct DDL; it is outside this authority.
- Migrations run as the control-plane database role. Namespace isolation rests on the search path
  and on statement analysis, not on a least-privilege migrator role; the binding's `migratorRole`
  is a name only. Statement analysis is pattern-based: a `DO` block is treated as opaque and
  destructive, but its body is not inspected.
- The environment binding identifies a binding version, not a physical server; all customer
  schemas live in the control-plane database.
- The prior-release rehearsal copies real rows inside the same database rather than generating
  synthetic data for populated tables, and samples tables above 10,000 rows.
- Rows created before plans existed run as one opaque, destructive statement.
- A scratch schema can be left behind if the process dies during a rehearsal
  (`_forge_rehearsal_*`); nothing removes it automatically.
- The row-count budget uses planner estimates.

