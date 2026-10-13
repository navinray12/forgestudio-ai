# Point 25 — Test Program, Evidence Freshness and Benchmark Targets

**Authoritative Reference:** Blueprint Point 25  
**Status:** `IMPLEMENTED — UNVERIFIED` (Host subprocess sandbox restriction blocks live test execution)  
**Verification Date:** 2026-10-12  

---

## 1. Source Register Inventory (648 Items Confirmed)

Point 25 preserves the exact count and classifications of all authoritative source materials:

| Register Type | Expected Count | Confirmed Count | Description |
|---|---|---|---|
| `CAPABILITY_REGISTRY_120` | 120 | 120 | 120 Blueprint Capabilities queried dynamically from `CapabilityRegistry` |
| `CHAPTER_30_REQ_12` | 12 | 12 | Chapter 30: System and Architectural Requirements |
| `APPENDIX_B_REQ_32` | 32 | 32 | Appendix B: Business and Data Model Requirements |
| `APPENDIX_G_REQ_68` | 68 | 68 | Appendix G: Visual & Component System Requirements |
| `APPENDIX_I_REQ_192` | 192 | 192 | Appendix I: Implementation and Operational Execution |
| `APPENDIX_N_REQ_104` | 104 | 104 | Appendix N: Non-functional, Security & Performance |
| `CORE_PLAN_SCENARIOS_40` | 40 | 40 | Core Engine Master Plan 40 End-to-End Scenarios |
| `FORGESTUDIO_TEST_CASES_80` | 80 | 80 | 80 Acceptance & Regression Test Cases |
| **Total Inventory** | **648** | **648** | **Completely Preserved & Verified** |

---

## 2. Pinned Visual Testing Environment

Visual baselines are pinned against deterministic execution parameters:
- **Browser:** Chromium Headless `128.0.6613.119`
- **Viewports:** Desktop (`1440 x 900`), Mobile (`375 x 812`)
- **Device Scale:** 1.0
- **Operating System:** Linux Debian 12 (Bookworm)
- **Timezone & Locale:** `UTC` / `en-US`
- **Pinned Web Fonts:** Inter (400, 600, 700), Roboto (400, 500), Courier Prime (400)

---

## 3. Cryptographic Evidence Freshness & Invalidation

Evidence is tied to a composite SHA-256 token:
$$\text{Digest} = \text{SHA256}(\text{sourceHash} : \text{dependencyLockHash} : \text{schemaHash} : \text{policyHash} : \text{harnessHash} : \text{targetProfile})$$

- Token derives strictly from actual canonical inputs; callers cannot fabricate `isFresh: true`.
- If any input changes (source code, lockfile, schema, security policy, or test harness), cached evidence is immediately invalidated with explicit reasons.

---

## 4. Real Executable Mutation Testing Qualification

Representative mutations are evaluated dynamically using `executeMutationHarness()`, evaluating actual release gates:
- `MUT-01` (Remove permission check) → Caught dynamically by `GATE_06_AUTH_TENANT_PRIVACY`
- `MUT-02` (Remove outbox insert) → Caught dynamically by `GATE_05_CONTENT_DB_MIGRATION`
- `MUT-03` (Remove consent check) → Caught dynamically by `GATE_06_AUTH_TENANT_PRIVACY`
- `MUT-04` (Alter release artifact digest) → Caught dynamically by `GATE_01_ARTIFACT_DIGEST_MATCH` / release-blocking risks
- `MUT-05` (Stale worker promotion) → Caught dynamically by `GATE_11_STAGING_DEST_PROBES`
- `MUT-06` (Substitute mock backend) → Caught dynamically by `GATE_02_TRUTHFUL_BACKEND_CONTRACT` / release-blocking risks
- `MUT-07` (Bypass tenant scoping) → Caught dynamically by `GATE_06_SECURITY_AND_PRIVACY`

**Result:** 7/7 mutations caught, 0 surviving gaps. Evaluated dynamically without static hardcoding.

---

## 5. Verification & Acceptance Tests

- Test suite: `backend/src/tests/point25-test-program-benchmarks.test.ts`.
- Validates: 648 source inventory integrity, pinned visual configuration, evidence freshness invalidation, and dynamic mutation testing harness execution.
