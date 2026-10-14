# Blueprint Point 41 — One Consistent Database Schema Studio

## 1. Overview & Single Studio Authority

Blueprint Point 41 unifies all database browsing, modeling, and schema editing operations under a single consistent service architecture: [DatabaseStudioViewsService](file:///c:/Users/navin/Downloads/forge-main/forge-main/backend/src/services/database/databaseStudioViews.service.ts).

All Studio views reuse the same authoritative [EnvironmentBinding](file:///c:/Users/navin/Downloads/forge-main/forge-main/backend/src/services/environment/environmentBinding.service.ts), target-resolution provider, and [ApplicationSpec](file:///c:/Users/navin/Downloads/forge-main/forge-main/backend/src/services/authoritative/applicationSpec.service.ts) used by generated applications.

---

## 2. The 10 Authoritative Studio Views

| View Index | View Name | Purpose & Safeguards |
| :--- | :--- | :--- |
| **1** | **Overview** | Application, environment, database binding, connectivity status, schema version, drift metrics, last verification timestamp, and actionable warnings. |
| **2** | **Model Designer** | Desired entities, fields, relationships, and constraints with stable IDs (`ent_`, `fld_`, `rel_`). |
| **3** | **Relationship View** | Accessible visual graph visualization + keyboard-readable table alternative; distinguishes logical from physical relationships. |
| **4** | **Schema Inspector** | Observed tables, columns, data types, physical constraints, indexes, grants, policies, and unsupported objects. |
| **5** | **Change Planner** | Desired-versus-observed diff, SQL preview, 5 impact classifications (`SAFE_ADDITIVE`, `DATA_TRANSFORMATION_BACKFILL`, `LOCKING_TABLE_REWRITE_RISK`, `PERMISSION_GRANT_CHANGE`, `IRREVERSIBLE_CHANGE`), affected APIs/screens, and approval requirements. |
| **6** | **Migration History** | Immutable plans, checksums, target identity, phases, approvals, progress, failure, and recovery actions. |
| **7** | **Data Browser** | Scoped, paginated records; private field masking; record mutations routed strictly through authorized domain commands (never raw table updates). Production browsing is read-only by default. |
| **8** | **API / Binding Explorer** | Entity-to-use-case-to-endpoint-to-screen mapping and actual connection test evidence. |
| **9** | **Environments** | Development, staging, and production bindings; connection rotation; clone policy; and promotion prerequisites. |
| **10** | **Recovery** | Verified backup references, isolated restore rehearsals, suppression replay, and operator recovery steps. |

---

## 3. Production Safeguards & Invariants

1. **Schema Proposals vs Direct DDL:**
   - Changing a field or relationship creates a schema proposal; it never automatically executes DDL in production.
2. **Stable Field Identity Rename Preservation:**
   - Column renames preserve stable field ID (`fld_xxx`), preventing destructive drop-and-add operations.
3. **No Hidden Environment Defaults:**
   - Every view requires an explicit environment and carries an immutable binding ID. Missing or ambiguous environments fail closed with `MISSING_ENVIRONMENT` errors (zero fallback to production).
4. **Expert Raw SQL Guard:**
   - Raw SQL is a separately authorized expert capability restricted to administrators. Bounded query timeouts (<= 10s), row limits (<= 500), credential redaction, and auditable logging are enforced.
