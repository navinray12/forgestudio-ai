# ForgeStudio Architecture — Blueprint Point 46: Reconcile Architecture and API Contracts

## 1. Overview and Core Philosophy

Blueprint Point 46 directs ForgeStudio to reconcile proposed modules, routes, and package layouts without duplicating functional systems or introducing parallel endpoints. 

Rather than creating parallel `/api/v2/...` endpoints when equivalent authoritative routes exist, existing controllers and services are extended in a backward-compatible manner. Control-plane operations are strictly segregated from generated end-user application APIs.

---

## 2. Control Plane vs. Generated Application Boundaries

1. **Control Plane (`/api/projects/:id/...`):**
   - Manages workspace synchronization, visual AST edits, ApplicationSpec generation, database binding, migration rehearsals, and release qualifications.
   - Requires ForgeStudio platform operator or workspace collaborator authentication.
   - Provides administrative diagnostic, schema drift, and environment qualification tools.

2. **Generated Application Endpoints (`/api/...` inside exported package):**
   - Independent, standalone REST/GraphQL endpoints generated specifically for the target domain (e.g., Team Project Tracker).
   - Operates with independent user sessions, tenant isolation, and application database pools.
   - Possesses zero privileged dependence on ForgeStudio control plane infrastructure.

---

## 3. Standardized Safe Error Envelopes

To prevent credential leakage, stack traces, and unhelpful opaque failures, all control-plane and generated endpoints adhere to the standardized safe error envelope contract:

```typescript
interface SafeErrorEnvelope {
  success: false;
  error: {
    code: string;                 // Machine-readable uppercase code (e.g. STALE_REVISION_CONFLICT)
    message: string;              // Safe, sanitized description
    operationId: string;          // Traceable UUID for log correlation
    timestamp: string;            // ISO timestamp
    affectedResourceId?: string;  // Resource ID when applicable
    expectedRevision?: number;    // Concurrency revision tracking
    actualRevision?: number;      // Observed revision in database
    remediationGuidance: string;  // Actionable remediation steps for the caller
  };
}
```

### Sanitization Invariants
- Any message containing connection strings, basic auth tokens (`://user:pass@`), passwords (`password=***`), or private keys is automatically stripped and replaced with sanitized tokens.
- Internal stack traces are suppressed in HTTP responses and directed to secure platform logs keyed by `operationId`.

---

## 4. Generated Application Package Manifest Completeness

Qualified application exports must satisfy the 11-tier package manifest requirements validated by `ControlPlaneReconciliationService.validateGeneratedPackageManifest`:

| Tier | Required Manifest Key | Required Artifact Content |
|---|---|---|
| **1. Frontend Pages** | `frontendPages` | Client pages, routing components, forms, empty/loading/error states |
| **2. Backend Domain Modules** | `backendDomainModules` | Domain entities, service handlers, business validation logic |
| **3. Background Workers** | `workerModules` | Async queue workers, scheduled tasks, outbox event consumers |
| **4. Runtime Schemas & Clients** | `runtimeSchemasAndClients` | Zod/TypeScript schemas, typed fetch/Axios API clients |
| **5. Server-Only Modules** | `serverOnlyDomainModules` | Secure database repositories, session validation, secret handlers |
| **6. Migration Set** | `databaseMigrations` | Sequential SQL migration files, rollback scripts, schema checksums |
| **7. Specs & Manifests** | `specificationsAndManifests`| ApplicationSpec, SourceManifest, PageRegistry, ReleaseManifest |
| **8. Environment Specs** | `environmentRequirements` | Config schema, `.env.example`, secret binding requirements |
| **9. Test Suites** | `testSuites` | Integration tests, end-to-end tests, tenant isolation test suites |
| **10. Infra Configuration** | `infrastructureConfig` | Dockerfile, docker-compose.yml, helm/terraform manifests |
| **11. Tooling & Documentation**| `toolingAndDocumentation` | README.md, package-lock.json / pnpm-lock.yaml, setup scripts |

Missing any of these 11 tiers marks the generated package as `DISQUALIFIED_PACKAGE_MANIFEST` and prevents promotion to staging or production.

---

## 5. Control Plane Operations Mapping

| Blueprint Proposed Route / Concept | Authoritative Implementation Endpoint | Service Authority |
|---|---|---|
| Commit workspace changeset | `POST /api/projects/:id/workspace/commit` | `VisualCodeSyncService` / `WorkspaceCoordinator` |
| Read coherent checkpoint | `GET /api/projects/:id/checkpoints/:checkpointId` | `CheckpointService` |
| Resume ordered project events | `GET /api/projects/:id/workspace/events` | `VisualCodeSyncService` |
| Resolve conflicts | `POST /api/projects/:id/workspace/conflicts/resolve` | `VisualCodeSyncService` |
| Page lifecycle planning & execution | `POST /api/projects/:id/pages/lifecycle` | `PageRegistryService` |
| Application generation jobs | `POST /api/projects/:id/generator/jobs` | `ApplicationGenerationService` |
| Desired vs. observed schema inspection | `GET /api/projects/:id/schema/environments/:envId/drift` | `DatabaseMigrationEngine` |
| Migration plan preview & execution | `POST /api/projects/:id/schema/migrations/execute` | `DatabaseMigrationEngine` |
| Diagnostic verification | `POST /api/projects/:id/architecture/verify-diagnostics` | `ControlPlaneReconciliationService` |
| Package completeness validation | `POST /api/projects/:id/architecture/validate-package` | `ControlPlaneReconciliationService` |
