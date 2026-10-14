# 48. Acceptance Architecture and Evidence

## 1. Executive Summary & Mission
Blueprint Point 48 establishes the comprehensive acceptance architecture, evidence collection pipeline, and release-gate enforcement framework for ForgeStudio.

In accordance with Point 48 rules:
1. **Preservation of Historical Populations**: The 648 historical source items (120 capabilities, 408 requirements, 40 core scenarios, 80 test cases) are strictly preserved without deletion or renumbering.
2. **Additive Extension**: 85 new application verification scenarios are added:
   - Track A: Foundation & Synchronization (15 scenarios: `SCN-TRK-A-01` .. `SCN-TRK-A-15`)
   - Track B: Data Model & Database Studio (15 scenarios: `SCN-TRK-B-01` .. `SCN-TRK-B-15`)
   - Track C: Contract-First API & Auth (15 scenarios: `SCN-TRK-C-01` .. `SCN-TRK-C-15`)
   - Track D: Generator & Source Ownership (15 scenarios: `SCN-TRK-D-01` .. `SCN-TRK-D-15`)
   - Track E: Release Qualification & Portability (15 scenarios: `SCN-TRK-E-01` .. `SCN-TRK-E-15`)
   - Cross-Track: End-to-End Scenarios (10 scenarios: `SCN-XTRK-01` .. `SCN-XTRK-10`)
   - **Total Extended Inventory**: 733 items.
3. **Execution Status Policy**: Every new scenario initializes strictly to `NOT_EXECUTED`. Success is never inferred by default from stubs, mocks, or self-reported application results.
4. **Verifier Independence**: Applications under test cannot self-verify or sign their own release evidence (`SELF_VERIFICATION_PROHIBITED`).

---

## 2. Acceptance Register Architecture

```
Authoritative Source Register (733 items)
├── Historical Populations (648 items)
│   ├── CAPABILITY_REGISTRY_120 (120 capabilities)
│   ├── CHAPTER_30_REQ_12 (12 system requirements)
│   ├── APPENDIX_B_REQ_32 (32 data model requirements)
│   ├── APPENDIX_G_REQ_68 (68 visual & component requirements)
│   ├── APPENDIX_I_REQ_192 (192 execution requirements)
│   ├── APPENDIX_N_REQ_104 (104 non-functional & security requirements)
│   ├── CORE_PLAN_SCENARIOS_40 (40 master scenarios)
│   └── FORGESTUDIO_TEST_CASES_80 (80 acceptance test cases)
└── Point 48 Application Verification Scenarios (85 items)
    ├── TRACK_A_FOUNDATION_SYNC_15 (15 scenarios)
    ├── TRACK_B_DATAMODEL_STUDIO_15 (15 scenarios)
    ├── TRACK_C_CONTRACT_API_AUTH_15 (15 scenarios)
    ├── TRACK_D_GENERATOR_SOURCE_15 (15 scenarios)
    ├── TRACK_E_RELEASE_PORTABILITY_15 (15 scenarios)
    └── CROSS_TRACK_SCENARIOS_10 (10 scenarios)
```

### Mandatory Metadata Schema
Every scenario in the 85-item register contains:
- `sourceId`: Unique scenario identifier (e.g. `SCN-TRK-A-01`)
- `sourceRegister`: Corresponding track enum
- `wording`: Concrete objective and scope
- `capabilityCode`: Mapped capability (`CAP-001` .. `CAP-120`)
- `affectedModule`: Component / module under verification
- `testType`: `UNIT`, `INTEGRATION`, `CONTRACT`, `BROWSER_JOURNEY`, `SECURITY_NEGATIVE`, or `FAULT_INJECTION`
- `testCaseId`: Mapped test case identifier
- `executionStatus`: Initialized to `NOT_EXECUTED`
- `result`: Initialized to `NOT_EXECUTED`
- `evidenceDigest`: Cryptographic hash or `null`
- `setup`: Explicit preconditions and fixtures
- `action`: Specific operation executed
- `expectedEvidence`: Observable verification artifacts
- `requirementIds`: Mapped requirement references
- `controllingSections`: `['Point 48', 'Point 49']`
- `workPackage`: `WP-48-ACCEPTANCE`
- `targetProfile`: Target environment profile (`MANAGED_DECLARATIVE`, `CODE_CENTRIC`, or `HYBRID`)
- `executionEnvironment`: Test environment identity
- `runner`: Authorized test runner identity
- `evidenceLinks`: Immutable artifact paths

---

## 3. Independent Evidence Collection and Verification

Release qualification enforces strict verifier independence:
- **No Self-Verification**: The application under test is prohibited from authorizing its own requirements (`SELF_VERIFICATION_PROHIBITED`). If `verifierIdentity === applicationId` or `verifierIdentity === "self"`, the qualification run is rejected.
- **Evidence Provenance**: All qualification tokens bind:
  - ApplicationSpec revision & digest
  - Source checkpoint & tree hash
  - API contract digest
  - Schema & migration set hash
  - Environment binding ID & credential reference version
  - Runtime image digest
  - Independent trusted verifier identity
- **Freshness Invalidation**: If source code, package locks, schema definitions, or policy files change, cached evidence tokens become stale and require re-execution.

---

## 4. Operational Acceptance Telemetry (12 Metrics)

Implemented in `AcceptanceMetricsTelemetryService`:

| Metric Key | Name | Numerator | Denominator | Units |
| :--- | :--- | :--- | :--- | :--- |
| `EDIT_TO_PROJECTION_LAG` | Edit-to-Projection Lag | Total projection latency | Projected edits count | ms |
| `SAVE_ACKNOWLEDGEMENT_LATENCY` | Save Ack Latency | Total save round-trip time | Save operations count | ms |
| `CONFLICT_RECOVERY_TIME_AND_OUTCOME` | Conflict Recovery | Total resolution time | Resolved conflicts count | ms / outcome |
| `SOURCE_LOSS_INCIDENTS` | Source Loss Incidents | Total source loss events | Total regeneration ops | count |
| `INCORRECT_PAGE_REGISTRATION` | Incorrect Page Registration | Total route mismatches | Total created pages | count |
| `MANUAL_REPAIR_EFFORT` | Manual Repair Effort | Human engineering minutes | Repaired apps count | minutes |
| `ACTUAL_DATABASE_APPLICATION_GENERATION_PASS_RATE` | Real DB Generation Pass Rate | Passed live DB generations | Total live DB attempts | % (first-run vs repaired) |
| `ESCAPED_APPLICATION_DEFECTS` | Escaped Defects | Post-release defect count | Total qualified releases | count |
| `ENVIRONMENT_MISROUTING` | Environment Misrouting | Cross-env traffic events | Total routed requests | count |
| `MIGRATION_FAILURE_RATE` | Migration Failure Rate | Failed migration executions | Total executed migrations | % |
| `RESTORE_OUTCOMES` | Restore Outcomes | Verified persistence restores | Total restore attempts | % |
| `COST_PER_VERIFIED_APPLICATION` | Cost Per Verified App | Total compute/LLM cost ($) | Verified apps count | USD ($) |

### Key Policy Rules for Telemetry
1. **Mock Exclusion**: Mock-only runs are rejected (`MOCK_ONLY_DISQUALIFIED`) from qualifying as actual-database generation attempts.
2. **Repaired vs First-Run**: First-run pass rates and repaired pass rates (automatic vs manual) are segregated.
3. **Secret Hygiene**: All event payloads are sanitized to scrub passwords, connection strings, and authorization tokens.
