# Architecture Specification: General-Purpose Application Data-Model Generation (Point 39)

## 1. Overview & Principles

ForgeStudio Blueprint Point 39 defines the standards for domain model generation, multi-domain boundary enforcement, secure CRUD DTOs, and external database introspection. It guarantees:
- Strict segregation among three data domains (CMS, Application, Platform). Generated applications never access the platform database through platform superusers.
- Precision domain modeling: stable entity (`ent_xxx`) and field (`fld_xxx`) identifiers, integer minor-unit money modeling (`cents`), UTC timestamps, and explicit relationship cardinalities.
- Justified indexes with declared query purposes and write-cost estimates, strictly prohibiting indiscriminate indexing.
- Secure mutation DTOs barring user manipulation of server-owned fields (`tenantId`, `status`, `id`, `createdAt`, `updatedAt`, `deletedAt`).
- Read-only external database introspection preserving legacy tables, views, procedures, and extensions without accidental deletion.

## 2. Three-Domain Data Boundary Separation

ForgeStudio strictly enforces architectural boundaries across three distinct data planes:

| Domain Plane | Scope | Access Policy |
| :--- | :--- | :--- |
| **CMS Domain** | Marketing pages, blog posts, revisions, protected media, public content projections. | Editorial workflows. Cannot be directly mutated by application domain entities without explicit mapping. |
| **Application Domain** | Customer business models (e.g. Products, Bookings, Invoices), transactional rows, operational state. | Scoped to customer workspace and tenant ID. Completely isolated from ForgeStudio platform control plane. |
| **Platform Domain** | Multi-tenant billing, user authentication, cluster configurations, internal audit ledgers. | Restricted strictly to `PLATFORM_SUPERUSER`. Never accessible by generated customer code. |

## 3. Data-Model Specifications & Standards

### 3.1 Financial Money Representation
- Floating-point representations (e.g. `FLOAT`, `DOUBLE`) for currency are strictly prohibited.
- Modeled as integer minor units:
  - `amountCents`: `BIGINT` / `INTEGER` representing lowest currency unit (e.g. 1500 for $15.00).
  - `currency`: ISO 4217 3-letter currency code (e.g. `"USD"`).
  - `minorUnits`: 2 for decimal currencies (USD, EUR), 0 for zero-decimal currencies (JPY).

### 3.2 Justified Indexing Invariant
Indexes must declare their architectural justification and write-cost estimate:
- `EQUALITY_FILTER`: Single or composite tenant/status lookups (e.g. `(tenant_id, status)`).
- `FOREIGN_KEY_LOOKUP`: Optimizing join performance on relational constraints.
- `UNIQUE_CONSTRAINT`: Enforcing natural business keys within a tenant scope.
- Indiscriminate indexing (indexing every column by default) is strictly rejected to prevent write performance degradation.

## 4. Secure Application CRUD & Server-Owned Fields Protection

Public REST/GraphQL endpoints generated for application entities enforce DTO contracts:
- **Allowed Create/Update Fields:** Explicitly declared user-editable attributes (e.g. `title`, `description`, `priceCents`).
- **Server-Owned Protected Fields:** Fields permanently barred from user request bodies:
  - `tenantId` (derived from auth session)
  - `status` (transitioned via privileged commands like `approve` or `cancel`)
  - `id` (system-generated UUID)
  - `createdAt`, `updatedAt`, `deletedAt` (managed by database triggers or ORM lifecycle).
- **Rejected Unknown Fields:** Any field not in the explicit DTO allowlist triggers validation errors (`400 Bad Request`).

## 5. External Database Introspection Contract

When integrating existing customer databases:
1. **Read-Only Inspection:** Queries catalog tables (`information_schema`, `pg_catalog`) without creating or altering schema objects.
2. **Object Ownership Classification:**
   - `MANAGED_FORGE`: Tables created and maintained by ForgeStudio full-stack generator.
   - `EXTERNAL_PRE_EXISTING`: Pre-existing customer database objects.
3. **Immutability of External Schema:**
   - Automated migration plans are barred from generating `DROP TABLE` or `DROP VIEW` statements targeting `EXTERNAL_PRE_EXISTING` objects.
   - Unsupported database features (materialized views, stored procedures, proprietary extensions) remain untouched and surfaced in diagnostics.
