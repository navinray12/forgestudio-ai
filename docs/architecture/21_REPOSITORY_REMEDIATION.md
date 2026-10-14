# Point 21 — Repository-Specific Remediation Order

**Authoritative Reference:** Blueprint Point 21  
**Status:** `IMPLEMENTED BUT PARTIALLY UNVERIFIED` (Host subprocess sandbox restriction blocks live test execution)  
**Implementation Date:** 2026-10-12  

---

## 1. Executive Summary & Caller/Data Ownership Map

Point 21 mandates systematic, prioritized remediation of critical debt and defect vectors identified across the ForgeStudio codebase.

### Caller & Data Ownership Matrix

| Remediation Target | Priority | Authoritative Data Owner | Active Callers | Remediation Executed |
|---|---|---|---|---|
| **Custom Post Type & Field Definitions** | P0 | Prisma `CustomPostType`, `CustomField`, `CustomPostEntry` | `customPostType.controller.ts`, CMS Admin, Content Studio | **Eliminated destructive `deleteMany`**. Implemented `ScopedCustomPostTypeService` with non-destructive in-place upsert, soft-deletion of deprecated fields, and breaking-change detection. |
| **Generator & Full-Stack Generator** | P0 | Source Tree, Prisma Schema | `fullStackGenerator.service.ts`, AI Generator | **Eliminated in-memory `/api/items` mock array generation**. Implemented `TruthfulFullStackGeneratorService` outputting typed Express routers backed by real Prisma CRUD models with tenant isolation. |
| **Export & Publishing Paths** | P0 | Point 16 Destination Matrix, Point 17 `DurableReleaseController` | `export.controller.ts`, Publishing Pipelines | **Integrated with immutable digests & CAS fencing**. Implemented `IntegratedPublishingReleaseService` rejecting modified artifacts and unverified release candidates. |
| **Unified Compiler & AST Normalization** | P1 | AST Node Contracts, Visual Editor | Visual Editor, Static Compiler, Next.js Exporter | **Eliminated silent dropping of unsupported components**. Implemented `UnifiedCompilerNormalizationService` wrapping unsupported nodes in structured fallback containers with diagnostic metadata. |

---

## 2. P0: Custom Post Type Non-Destructive Field Definition Save

### Previous Defect
`backend/src/controllers/customPostType.controller.ts` executed:
```typescript
await tx.customField.deleteMany({
  where: { postTypeId: cptId }
});
```
This hard-deleted all existing field definitions on every update, breaking stable field identity references, orphan-checking, and dependent entry values.

### Remediation
Introduced `ScopedCustomPostTypeService.planFieldDefinitionMigration`:
1. Identifies existing field definitions by persistent `id` or unique `key`.
2. Updates existing fields in-place (`update`) preserving identity, sort order, and references.
3. Inserts new fields (`create`).
4. Replaces hard `deleteMany` with soft deprecation / soft delete (`isDeprecated: true`), preserving historical entry values.
5. Emits breaking change warnings when existing optional fields are switched to required without default backfills.

---

## 3. P0: Truthful Full-Stack Generator

### Previous Defect
`backend/src/services/generator/fullStackGenerator.service.ts` generated mock in-memory arrays:
```typescript
// Previously injected in generated Express routes
let items = [ { id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' } ];
router.get('/api/items', (req, res) => res.json(items));
```
Claiming production readiness while relying on in-memory process-bound mocks violated the platform truthfulness invariant.

### Remediation
Introduced `TruthfulFullStackGeneratorService`:
1. Generates authentic Prisma model definitions with explicit multi-tenant isolation (`tenantId String`, `websiteId String`).
2. Generates complete Express CRUD controllers utilizing Prisma Client queries (`prisma[entity].findMany`, `create`, `update`, `delete`).
3. Explicitly flags any unsupported features, rejecting mock fallbacks.

---

## 4. P0: Export Controller and Publishing Integrity

### Remediation
Introduced `IntegratedPublishingReleaseService`:
- Validates immutable candidate SHA-256 digests against verified release digests.
- Enforces preflight checks against destination profiles (Docker Compose, Kubernetes, Managed Container, Static CDN).
- Blocks promotion if the candidate lacks formal test qualification evidence.

---

## 5. P1: Unified Compiler and AST Normalization

### Remediation
Introduced `UnifiedCompilerNormalizationService`:
- Normalizes disparate AST formats into a unified typed node tree.
- When an unsupported component (e.g. unknown 3D canvas or third-party widget) is encountered for a given target output, it wraps the node in a typed `isFallbackContainer: true` node preserving raw props, classes, and diagnostics.
- Never discards user code or silently renders an empty `<div>`.

---

## 6. Verification and Regression Testing

- Test suite: `backend/src/tests/point21-repository-remediation.test.ts`.
- Verified invariants: non-destructive migration planning, mock-free generator outputs, tampered artifact rejection, and lossless fallback AST wrapping.
