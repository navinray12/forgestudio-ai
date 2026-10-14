# 49. Evidence and Maintenance Boundaries

## 1. Executive Summary & Mission
Blueprint Point 49 codifies the technical and maintenance boundaries reconciling ForgeStudio's architectural invariants with real code-level enforcement.

These boundaries protect against:
- Destructive code regeneration destroying custom user logic.
- Route directory collisions between Next.js App Router and Pages Router.
- Unvetted framework major upgrades that break migration compatibility.
- Multi-tenancy vulnerabilities where isolation is inferred solely from `search_path` or schema names.
- PostgreSQL transaction aborts from nontransactional DDL (`CREATE INDEX CONCURRENTLY` in `BEGIN...COMMIT`).
- Uncontrolled proliferation of parallel migration runners.
- Treating dated competitor research as fresh verified facts.

---

## 2. The 10 Maintenance Boundaries (A21-R1 through A21-R10)

Implemented in `MaintenanceBoundariesService`:

### A21-R1: AST Surgical Edits Boundary
- **Rule**: Code modifications must preserve user code regions and avoid destructive full-file replacement.
- **Enforcement**: Protected region markers (`/* FORGE:CUSTOM_LOGIC_START */` ... `/* FORGE:CUSTOM_LOGIC_END */`) must be preserved character-for-character across regenerations. Catastrophic truncation (>500 lines to <50 lines) is rejected.

### A21-R2: Next.js / React-Vite Routing Boundary
- **Rule**: Next.js App Router (`app/`), Pages Router (`pages/`), and Vite SPA route structures must not collide.
- **Enforcement**: Simultaneous `app/` and `pages/` routing without an explicit migration boundary is flagged. Route slug collisions across pages are rejected.

### A21-R3: Pinned Framework & Prisma Versions Boundary
- **Rule**: Dependencies must respect pinned versions without unauthorized major upgrades.
- **Pinned Matrix**:
  - `next`: `14.x` (expected major 14)
  - `react`: `18.x` (expected major 18)
  - `@prisma/client`: `5.x` (expected major 5)
  - `prisma`: `5.x` (expected major 5)
  - `typescript`: `5.x` (expected major 5)
  - `node`: `20+`
  - `postgresql`: `15 / 16`

### A21-R4: PostgreSQL Multi-Tenancy & Authorization Boundary
- **Rule**: Tenant authorization and isolation must NEVER be inferred solely from `search_path` or schema names.
- **Enforcement**: Mandatory physical Row-Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`), parameter-scoped `tenantId` in queries, and dedicated scoped database credentials.

### A21-R5: Nontransactional DDL Boundary
- **Rule**: PostgreSQL operations requiring nontransactional execution—such as `CREATE INDEX CONCURRENTLY`, `DROP INDEX CONCURRENTLY`, and `VACUUM`—must execute outside transaction wrappers (`BEGIN...COMMIT`).
- **Enforcement**: The migration engine intercepts nontransactional statements and executes them outside transactional blocks with individual error recovery.

### A21-R6: Unified Auth & Session Identity Boundary
- **Rule**: Developer platform sessions and tenant end-user sessions must not cross boundaries.
- **Enforcement**: Token audience validation (`FORGE_STUDIO_PLATFORM` vs `TENANT_APPLICATION`) strictly prevents tenant tokens from executing platform administrative mutations.

### A21-R7: Dated Competitor & Ecosystem Intelligence Boundary
- **Rule**: Historical competitor benchmarks and external claims are dated context and cannot be marked as reverified without fresh, trusted evidence.
- **Enforcement**: All competitor intelligence records require an inspection timestamp and explicit verification method; claims older than baseline require fresh revalidation reports.

### A21-R8: Contract-First ApplicationSpec & API Boundary
- **Rule**: `ApplicationSpec` is the single source of truth for the entire application stack.
- **Enforcement**: OpenAPI 3.1 schemas, Prisma schemas, and frontend client SDKs must derive directly from `ApplicationSpec` entity and endpoint definitions.

### A21-R9: Bidirectional Visual/Code Projection Boundary
- **Rule**: Visual canvas changes and AST code modifications must converge to deterministic checkpoints.
- **Enforcement**: Canvas node counts and AST node counts must match, and sync lag p95 must remain under 1000ms.

### A21-R10: Safe Migration Authority & Cleanup Boundary
- **Rule**: Exactly one authoritative migration engine exists (`unifiedMigrationAuthorityService`); dual or secondary migration runners are strictly prohibited.
- **Enforcement**: Secondary runner registration attempts throw `DUAL_MIGRATION_AUTHORITY_PROHIBITED`.
