# Point 32: Genuine Full-Stack Generation & ApplicationSpec Domain Contract

## 1. Overview
Point 32 replaces incomplete mock array generation (e.g. `/api/items`) with a truthful, 10-step full-stack generation pipeline backed by configured AI providers and explicit schema proposals, underpinned by the independent `ApplicationSpec` domain contract.

## 2. Architectural Components

### 2.1 ApplicationSpec (`applicationSpec.service.ts`)
- Schema Version: `1.0.0`
- Stable IDs: Entity IDs prefixed with `ent_`, field IDs with `fld_`, operations with `op_`, relationships with `rel_`.
- Credential Safety Invariant: Strictly rejects raw passwords, private keys, or API tokens embedded in the specification.
- Tenancy Invariant: Under `MULTI_TENANT_ROW`, validates that entities include tenant scoping keys.
- Separation of Concerns: Distinct from `SiteSpec` (visual), `SourceManifest` (files), and `SchemaPlan` (database migrations). CMS collection definitions remain separate from transactional application models.

### 2.2 Full-Stack Generation Pipeline (`realFullStackPipeline.service.ts`)
1. Application Plan: Formulates versioned domain entities, fields, and operations from user prompt.
2. Provider Execution: Dispatches to configured AI providers (`siteGenerationProvider()`) with timeouts and fallbacks.
3. Reviewable SchemaPlan: Generates up/down SQL migrations with tenant indexes and soft deletes; requires explicit review before DDL execution.
4. Typed Backend Modules: Generates Express/Prisma routers with authentication and tenant boundaries.
5. Frontend API Clients: Generates typed TypeScript interfaces and fetchers.
6. Automated Tests: Generates test suites verifying business invariants and tenant isolation.
