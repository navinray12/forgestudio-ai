# Blueprint Point 44 — End-to-End Application/Database Release Qualification

## 1. Overview & Dedicated Evidence Chain

Blueprint Point 44 introduces [ApplicationReleaseQualificationService](file:///c:/Users/navin/Downloads/forge-main/forge-main/backend/src/services/qualification/applicationReleaseQualification.service.ts), extending release qualification with an immutable, cryptographically verifiable application-data evidence chain.

Each qualification run binds:
- `ApplicationSpec` revision & digest.
- Source checkpoint and source tree hashes.
- API contract digest.
- Schema version and complete migration set hashes.
- Environment binding ID & credential-reference version.
- Runtime container image digest.
- Verifier identity and timestamped test reports.
- **CRITICAL HYGIENE:** Never stores raw secrets or connection passwords in qualification evidence.

---

## 2. The 9 Required Qualification Layers

| Layer | Focus & Criteria | Highest Observation Level |
| :--- | :--- | :--- |
| **1. Schema** | Database catalog inspection, verified owned models, physical foreign key constraints, indexes, RLS policies, and preservation of unknown externally managed objects. | `COMMITTED_DB_ROW` |
| **2. API** | Real CRUD operations plus authorized retirement, typed schema validation, forbidden field injection checks, and declared HTTP status codes. | `ACCEPTED_API_REQUEST` |
| **3. Domain** | Business state transitions, transaction rollback on failure, concurrent updates, optimistic concurrency validation, and idempotency. | `COMMITTED_DB_ROW` |
| **4. Frontend** | Actual screens invoke actual API endpoints; verified rendering across loading, empty, denied, conflict, and committed states. | `SUCCESSFULLY_RENDERED_FRONTEND_STATE` |
| **5. Persistence** | Creation of unique synthetic data, application restart, fresh browser session reload, and independent observation proving data availability without mock/memory substitutes. | `INDEPENDENTLY_OBSERVED_PERSISTED_RESULT` |
| **6. Environment Isolation** | Development operations strictly isolated from staging/production; target bindings verified; production approval gates enforced. | `COMMITTED_DB_ROW` |
| **7. Editing** | Visual/code edits and page lifecycle operations converge on the correct checkpoint without mutating unrelated business data. | `COMMITTED_DB_ROW` |
| **8. Upgrade** | Backward compatibility across migrations: dual rehearsal passed on empty DB and prior-release DB with realistic synthetic data; drift detection verified. | `COMMITTED_DB_ROW` |
| **9. Portability** | Clean installation on fresh infrastructure with new credentials, creating genuine transactional data and publishing a CMS blog post without ForgeStudio superuser access. | `INDEPENDENTLY_OBSERVED_PERSISTED_RESULT` |

---

## 3. Evidence Quality Distinction

The service explicitly distinguishes:
1. `DB_PING` (basic socket connectivity).
2. `ACCEPTED_API_REQUEST` (HTTP 200/201 response).
3. `COMMITTED_DB_ROW` (transaction committed on target).
4. `INDEPENDENTLY_OBSERVED_PERSISTED_RESULT` (read by separate authorized database observer).
5. `SUCCESSFULLY_RENDERED_FRONTEND_STATE` (DOM/UI element rendered with server-committed revision).
