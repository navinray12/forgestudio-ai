# Point 27 — Migration and Existing-Customer Protection

**Authoritative Reference:** Blueprint Point 27  
**Status:** `IMPLEMENTED — UNVERIFIED` (Host subprocess sandbox restriction blocks live test execution)  
**Verification Date:** 2026-10-12  

---

## 1. Customer Asset Protection Principles

1. **Single Publishing Authority:** Exactly one authoritative pipeline controls deployments for a given site/domain.
2. **Cryptographic Pre-Migration Snapshots:**
   - Captures full file and manifest SHA-256 digests.
   - Computes authentic `contentVersionDigest` from schema version, entries, and fields metadata (never derived from `websiteId`).
   - Rejects directory traversal paths (`..`, unsafe separators).
3. **Restore Verification:**
   - Detects missing files.
   - Detects modified files (hash mismatch).
   - Detects unexpected extra files when exact restore match is required.
4. **Zero Side-Effect Shadow Generation:**
   - Candidates generated through new compilers run in shadow mode without altering production releases, dispatching webhooks, or spending budgets.
5. **Optimistic Concurrency Migrations:**
   - Prevents overwriting newer user edits (`currentDatabaseVersion !== expectedBaseVersion`); missing fields in partial updates are non-destructively preserved.

---

## 2. 10 Legacy Retirement Gates

Before deprecating or removing an older exporter/compiler implementation, all 10 gates must pass:

1. All active callers mapped to replacement.
2. Replacement verified to support required behavior.
3. Source preservation verified against regression fixtures.
4. Export and staging probes match approved semantics.
5. Existing-customer migration fixtures pass.
6. Provider and target compatibility qualified.
7. Rollback procedure validated.
8. Observability and support runbooks documented.
9. No duplicate publishing authority remains.
10. Cumulative ledger records exit evidence.

---

## 3. Cohort Rollout Automated Stop Policy

- Canary cohorts monitor real-time error rates.
- **Fail-Closed on Telemetry Outages:** Rollout halts immediately if metrics are stale or sample size is below minimum threshold (`minSampleSize`).
- If error rate exceeds max threshold (e.g. > 1%), rollout is **halted immediately** with automatic diagnostics preserved.

---

## 4. WordPress External CMS Disconnection Safety

- Disconnecting external WordPress or third-party headless CMS **never deletes local content or revokes local editing permissions** (0 local items deleted).
- Reconnecting requires fresh authentication and explicit reconciliation plans.

---

## 5. Verification & Acceptance Tests

- Test suite: `backend/src/tests/point27-migration-customer-protection.test.ts`.
- Validates: authentic `contentVersionDigest`, path safety, extra file detection, snapshot restore integrity, shadow generation side-effect isolation, optimistic concurrency migration conflicts, fail-closed canary cohort halt thresholds, and external CMS disconnect safety.
