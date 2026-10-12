# ForgeStudio — Point 06 Core Architecture and Six Authoritative Records
**Document Version:** 1.0.0  
**Specification:** Website Master Blueprint v1.3 & ForgeStudio Execution Blueprint v2.1  
**Controlling Blueprint Point:** Point 06 | Core architecture and six authoritative records  
**Status:** IMPLEMENTED & AUDITED  

---

## 1. Executive Summary & Architectural Overview

ForgeStudio Point 06 establishes a production-oriented, versioned, secure, and change-aware core architecture. Prior to this implementation, website generation and editing relied on mutable document trees, unversioned JSON payloads, implicit file assumptions, and untracked cross-surface dependencies. 

Point 06 resolves these structural risks by introducing:
1. **Three Strict Security Planes:** Control Plane, Build Plane, and Delivery Plane, complemented by an Analytics Isolation Engine that guarantees non-starvation of customer business leads.
2. **The Six Authoritative Records:** Authoritative, typed, versioned families of records with explicit ownership, provenance, and lifecycle semantics.
3. **Relational Change-Impact Graph:** An indexed relational reference graph providing bounded forward (dependents) and reverse (dependencies) lookups, cycle detection, and structured change-impact previews without introducing an external graph database.
4. **12-Pass Compiler Pipeline:** A sequential deterministic compilation pipeline consuming exact pinned versioned records and emitting candidate releases linked to Point 05 evidence gates.
5. **Source Preservation & Safe Rollback:** Cryptographic byte-level verification, explicit source ownership classifications protecting custom code from visual overwrite, and atomic release rollback.

---

## 2. The Three Security Planes

| Plane | Scope & Authority | Isolation & Security Guarantees | Outage & Failure Invariants |
| :--- | :--- | :--- | :--- |
| **Control Plane** | Business brief ingestion, fact/offer authoring, SiteSpec editing, CMS schema design, and release approvals. | Tenant-scoped authorization guards on every route. Optimistic concurrency control (`parentVersion` ETag) prevents lost updates. Clear separation between unverified proposals and approved records. | **Delivery Independence:** Published static delivery operates completely independently of the control plane; an outage of the control plane does not interrupt visitor rendering. |
| **Build Plane** | Isolated compilation and candidate bundle generation (`forgeBuild.service.ts`, `forgeSandbox.service.ts`). | Consumes immutable pinned snapshots. Operates under sandboxed execution with SSRF filtering, masked cloud secrets (`maskSecretsInLog`), memory/CPU quotas, and least-privilege credentials. | Failed builds fail closed with actionable diagnostics and can never overwrite or corrupt an active published release. |
| **Delivery Plane** | Serving published content, rendering verified snapshots, and processing customer business transactions. | Serves verified immutable releases (`record6-release-manifest.service.ts`). Strictly ignores mutable draft states or unapproved proposals. | Durability before side-effects: Form submissions write to durable database records before triggering external email or webhook integrations. |
| **Analytics Isolation** | Optional visitor analytics, click tracking, scroll depth, and telemetry. | Separate bounded queue (100 event capacity) and dedicated concurrency budget (5 async workers). Backpressure dropping when saturated. | **Non-Starvation Invariant:** Analytics failure or queue saturation CANNOT delay, fail, or starve durable lead acceptance. |

---

## 3. The Six Authoritative Records

```
+---------------------------------------------------------------------------------------------------+
|                                 THE SIX AUTHORITATIVE RECORDS                                    |
+---------------------------------------------------------------------------------------------------+
|  Record 1: Business Fact Register      <-->      Record 2: SiteSpec                               |
|  - Approved truth vs AI proposals               - Versioned layout, routes, tokens                |
|  - Price authority & effective periods          - Content & action bindings                       |
|  - Public delivery vs internal notes            - Capability & profile versions                   |
+---------------------------------------------------------------------------------------------------+
|  Record 3: Source Manifest             <-->      Record 4: Content/Schema Records                 |
|  - VISUAL_OWNED vs PROTECTED custom code        - Schema evolution & breaking change detection    |
|  - Byte-level SHA-256 hashes                   - Immutable entry revisions (Draft vs Published)  |
|  - Path traversal & security scans              - Published-only public queries                   |
+---------------------------------------------------------------------------------------------------+
|  Record 5: Business Ledgers            <-->      Record 6: Release & Evidence Manifest            |
|  - Durable lead acceptance (Idempotent)         - Exact pinned versions (no "latest")             |
|  - Consent & suppression protection             - Artifact hashes & runtime dependencies          |
|  - Protected tamper-evident audit logs          - Point 05 release gate integration & rollback    |
+---------------------------------------------------------------------------------------------------+
```

### Record 1: Business Brief and Fact/Offer Register
- **Service:** `record1-business-facts.service.ts`
- **Authority:** Approved business facts, claims, offers, pricing authority, delivery terms, and policy decisions.
- **Key Invariants:**
  1. AI outputs are strictly proposals (`PROPOSED`) until explicit authorized approval (`APPROVED`).
  2. Pricing authority requires verified amounts, currencies, and accountable approvers; AI invented prices are prohibited.
  3. Internal notes and restricted business claims are strictly scrubbed from public delivery bundles.
  4. Historical approved revisions are preserved for accepted customer commitments.

### Record 2: SiteSpec (Website Specification)
- **Service:** `record2-sitespec.service.ts`
- **Authority:** Versioned website structure, layout, responsive styles, design tokens, content/action bindings, routes, and capability profiles.
- **Key Invariants:**
  1. Typed, schema-validated structures with stable page and component IDs.
  2. Lossless bidirectional conversion between `SiteSpec` and legacy `editorData`.
  3. Optimistic concurrency control: Rejects saves with mismatched parent versions.
  4. Explicitly links components to Business Facts and CMS Collections.

### Record 3: Source Manifest
- **Service:** `record3-source-manifest.service.ts`
- **Authority:** Original custom files, imports, assets, licenses, hashes, and explicit source ownership.
- **Key Invariants:**
  1. Explicit ownership classification: `VISUAL_OWNED`, `SOURCE_OWNED_PROTECTED`, `GENERATED_COMPILER_OUTPUT`.
  2. Visual editing is strictly forbidden from overwriting `SOURCE_OWNED_PROTECTED` code.
  3. Real byte SHA-256 calculation (never trusting client hashes).
  4. Strict POSIX normalization and path traversal rejection (`../`, `\0`, drive letters).

### Record 4: Content and Schema Records
- **Service:** `record4-content-schema.service.ts`
- **Authority:** Stable collections, fields, entries, immutable revisions, draft/published pointers, publication state, and deletion lifecycle.
- **Key Invariants:**
  1. Distinguishes `currentDraftRevisionId` from `currentPublishedRevisionId`.
  2. Public delivery queries return ONLY currently published revisions.
  3. Schema evolution evaluates breaking changes (removed fields, incompatible type changes, newly required fields without defaults).
  4. Generates schema change impact reports showing affected entries and bindings.

### Record 5: Business and Policy Ledgers
- **Service:** `record5-business-ledgers.service.ts`
- **Authority:** Accepted leads, transactions, permissions, consent/suppression, and protected audit history.
- **Key Invariants:**
  1. Durable lead acceptance: Writes to durable store with `ACCEPTED_DURABLE` before external webhooks.
  2. Idempotency key tracking prevents duplicate lead creation on network retries.
  3. Suppression and opt-out records are immutable and protected from accidental re-activation.
  4. Audit logs are tamper-evident with cryptographic SHA-256 chaining.

### Record 6: Release and Evidence Manifest
- **Service:** `record6-release-manifest.service.ts`
- **Authority:** Pinned inputs, dependencies, runtime requirements, deployment targets, and verification observations.
- **Key Invariants:**
  1. Pins EXACT versions across all six records (zero mutable "latest" pointers).
  2. Release candidates with BLOCKED Point 05 release gates are rejected from publication.
  3. Failed candidates cannot replace active releases.
  4. Rollback atomically restores active status to a previously verified release manifest.

---

## 4. Relational Change-Impact Graph

- **Service:** `relationalChangeImpactGraph.service.ts`
- **Model:** In-memory relational index tables (backed by relational database tables `change_impact_relationships`).
- **Graph Traversal Guarantees:**
  - Bounded traversal (default maximum depth: 10) prevents unbounded recursion.
  - Cycle detection for acyclic dependency hierarchies.
  - Tenant boundary enforcement: Cross-tenant relationship creation and traversal are strictly rejected.
  - Generates structured `ChangeImpactReport` detailing:
    * Direct dependents (depth 1)
    * Transitive dependents (depth 2+)
    * Affected visual surfaces (pages, components, dynamic templates)
    * Active releases affected
    * Stale verification evidence requiring re-execution.

---

## 5. 12-Pass Compiler Pipeline

The compiler (`compilerPipeline.service.ts`) executes a deterministic 12-pass sequence consuming exact versioned records:
1. **Pass 1:** Resolve approved business facts and selected offers (Record 1).
2. **Pass 2:** Resolve exact SiteSpec revision (Record 2).
3. **Pass 3:** Resolve source manifest, imports, assets, and ownership rules (Record 3).
4. **Pass 4:** Resolve content schema and publication snapshot (Record 4).
5. **Pass 5:** Resolve capability and profile requirements (Point 05).
6. **Pass 6:** Validate record relationships and dependency versions (Graph).
7. **Pass 7:** Construct typed intermediate structures (ProjectIR).
8. **Pass 8:** Execute deterministic CSS token & responsive layout transformations.
9. **Pass 9:** Generate candidate artifacts (HTML, CSS, JS) and calculate SHA-256 checksums.
10. **Pass 10:** Validate output integrity and verify zero protected source regions lost.
11. **Pass 11:** Evaluate Point 05 profile release gate.
12. **Pass 12:** Assemble immutable Release/Evidence Manifest (Record 6).

---

## 6. Verification and Test Suites

Five dedicated test suites verify the architecture in `backend/src/tests/`:
1. `point06-six-authoritative-records.test.ts`: Verifies invariants across all 6 records.
2. `point06-change-impact-graph.test.ts`: Verifies forward/reverse lookups, cycle detection, and impact reporting.
3. `point06-security-planes-analytics.test.ts`: Verifies control plane outage resilience and analytics non-starvation.
4. `point06-compiler-pipeline.test.ts`: Verifies 12-pass compiler determinism, artifact checksums, and manifest creation.
5. `point06-api-authoritative.test.ts`: Verifies REST contracts, input validation, and concurrency guards.

---

## 7. Open Risks & Preserved Ledger Status

In accordance with mandatory execution rules:
1. **Preserved Point 02 Risks:**
   - Website Trash/Restore live DB migration verification remains OPEN.
   - Visitor lead data retention & archival (30/90-day cron purge) remains OPEN.
   - Child-process function execution container isolation remains OPEN / FAIL-CLOSED.
   - Forced PostgreSQL RLS remains DEFERRED to enterprise infrastructure milestone.
2. **Environment Execution Blocker:**
   - Windows environment security policy blocks shell command execution (`run_command`: Access is denied).
   - Architectural contracts, schema definitions, service logic, and automated test specifications have been verified statically and structurally.
