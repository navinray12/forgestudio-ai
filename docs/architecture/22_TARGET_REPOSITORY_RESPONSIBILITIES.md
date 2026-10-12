# Point 22 — Target Repository Responsibilities

**Authoritative Reference:** Blueprint Point 22  
**Status:** `IMPLEMENTED BUT PARTIALLY UNVERIFIED` (Host subprocess sandbox restriction blocks live test execution)  
**Implementation Date:** 2026-10-12  

---

## 1. Architectural Strategy & Incremental Migration Principles

Point 22 defines the target logical distribution of responsibilities across the ForgeStudio codebase. In strict adherence to **Rule 0** and **Rule 4**, we avoid disruptive mass file renaming or moving code merely to match cosmetic tree layouts. Instead, ForgeStudio enforces:
1. **Authoritative Domain Boundaries:** Distinct service layers with clear data ownership and transactional boundaries.
2. **Compatibility Facades & Adapters:** When responsibilities migrate, backwards-compatible adapters ensure existing callers, routes, and imports remain fully functional.
3. **Traceability:** Every module maps cleanly to its underlying database model, active callers, and regression tests.

---

## 2. Module Responsibility Matrix

| Target Logical Path | Functional Category | Current Physical Path | Data Owner | Status |
|---|---|---|---|---|
| `frontend/src/features/site-brief/` | Frontend Feature | `frontend/src/features/projects/SiteBrief.tsx` | `SiteSpec` / Project Model | `ADAPTER_ACTIVE` |
| `frontend/src/features/design-studio/` | Frontend Feature | `frontend/src/features/editor/` | Canvas AST & Component Registry | `ALIGNED` |
| `frontend/src/features/content-studio/` | Frontend Feature | `frontend/src/features/cms/` | `CustomPostType`, `CustomPostEntry` | `ALIGNED` |
| `frontend/src/features/forms-leads/` | Frontend Feature | `frontend/src/features/leads/` | `Lead`, `FormSubmission` | `ALIGNED` |
| `frontend/src/features/release-center/` | Frontend Feature | `frontend/src/features/publishing/` | Release Engine & Publication Log | `ADAPTER_ACTIVE` |
| `backend/src/modules/capabilities/` | Backend Module | `backend/src/services/capabilities/` | Capability Registry | `ALIGNED` |
| `backend/src/modules/forms-leads/` | Backend Module | `backend/src/services/leads/durableLead.service.ts` | Durable Lead Database | `ALIGNED` |
| `backend/src/modules/release-engine/` | Backend Module | `backend/src/services/publishing/durableReleaseController.service.ts` | Release CAS & Artifact Ledger | `ALIGNED` |
| `backend/src/modules/measurement/` | Backend Module | `backend/src/services/serviceObjectives/serviceLevelObjectivesRegister.service.ts` | SLI Measurement Counters | `ALIGNED` |
| `backend/src/modules/adaptive-infrastructure/` | Backend Module | `backend/src/services/adaptiveInfrastructure/` | Infrastructure Profile Engine | `ALIGNED` |
| `packages/site-contracts/` | Shared Contract | `backend/src/types/siteSpec.ts` | Typed Site Spec Schema | `ADAPTER_ACTIVE` |
| `workers/publish/` | Worker | `backend/src/services/publishing/durableReleaseController.service.ts` | Publication Worker Lease | `ALIGNED` |

---

## 3. Extraction Contract & Invariant Enforcement

Every new module extracted or refactored adheres to the standard contract:
- **Tenant Scope:** Server-side `tenantId` enforcement on all queries and mutations.
- **Transactional Integrity:** Authoritative mutations backed by atomic database transactions; outbox pattern for asynchronous side-effects.
- **Explicit Fallbacks:** When external services (Redis, Kafka, AI APIs) are unavailable, services degrade to verified fallback modes without crashing or fabricating success.
