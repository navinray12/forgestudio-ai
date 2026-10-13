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
