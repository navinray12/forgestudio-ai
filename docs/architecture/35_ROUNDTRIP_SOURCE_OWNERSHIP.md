# Architecture Specification: Supported Round-Trip and Source Ownership Contract (Point 35)

## 1. Overview & Principles

ForgeStudio Blueprint Point 35 governs the code-to-visual and visual-to-code ownership contract. It guarantees that developer code is never silently degraded, reformatted destructively, or approximated as static placeholders.

## 2. Supported Construct Compatibility Matrix

Source code is evaluated against an 8-category compatibility matrix:

| Category | Description | Visual Editing | Preservation Strategy |
| :--- | :--- | :--- | :--- |
| **NATIVE_JSX** | Standard JSX elements (`div`, `h1`, `p`), text literals, attributes, SVG, escaping. | Fully Editable | Two-Way Sync |
| **REGISTERED_COMPONENTS** | Design system components with declared slots, exposed controls, and versioned props. | Editable Props & Slots | Two-Way Sync |
| **STYLES** | Inline styles, Tailwind classes, CSS modules without cascading disruption. | Editable Styles | Two-Way Sync |
| **IMPORTED_CUSTOM_COMPONENTS** | Imported custom React components reflecting declared props. | Editable Props | Two-Way Sync |
| **CONDITIONAL_REPEATED_UI** | Declarative array maps (`.map()`) and conditional ternaries. | Sample-State Preview | Two-Way Sync |
| **OPAQUE_SOURCE_OWNED** | React hooks (`useState`, `useEffect`), async functions, arbitrary logic expressions. | Read-Only in Canvas | Isolated Preview / Untouched |
| **BACKEND_SCHEMA_SOURCE** | Next.js API routes (`route.ts`), Prisma schemas, database queries. | Contracts Displayed | Untouched in Source Tree |
| **PARSE_FAILURES_UNRESOLVED_IMPORTS** | Syntax errors, unparseable code, missing dependencies. | Preserved Draft | Diagnostic Overlay & Draft Save |

## 3. Stable Mappings & Component Identity

Component identity is maintained through multi-facet mappings:
- `pageId`: Canonical registry ID.
- `fileId`: Persistent file hash ID.
- `componentDefId`: Symbol definition ID in project graph.
- `nodeId`: Target DOM / JSX element marker (`data-forge-id`).
- `sourceLocationMapping`: Exact line/col and character offsets.
- `sourceHash` & `sourceRevision`: Offsets are strictly validated against matching source hashes; stale offsets are invalidated immediately.

### 3.1 Protection of Dynamic & CMS Query Bindings
When visual elements are bound to CMS fields (e.g. `{cms.post.title}`) or database queries:
- Visual updates cannot replace the dynamic binding with a plain static string.
- The `RoundTripContractService.preserveQueryBindings` barrier intercepts attempted overwrites, preserving the dynamic binding while permitting draft preview updates.

### 3.2 Duplicate ID Detection & Repair
- Duplicate `data-forge-id` markers created by developer copy-pasting are detected via AST inspection.
- The engine re-tags duplicated instances with unique deterministic suffixes while maintaining canvas bindings.

## 4. Formal Round-Trip Laws

The round-trip engine adheres to five verifiable laws:

1. **Law 1 (No-op parse/emit):** A no-op parse/emit pass produces zero semantic changes and preserves formatting.
2. **Law 2 (Visual -> Source -> Visual):** Applying supported visual edits and re-parsing regenerates the exact visual IR model.
3. **Law 3 (Source -> Visual -> Source):** Reconciling code edits into the visual canvas and emitting code preserves all unowned comments, hooks, and logic.
4. **Law 4 (Idempotent Replay):** Replaying the same committed change set is an idempotent no-op.
5. **Law 5 (Non-overlapping Convergence):** Non-overlapping concurrent visual and code edits converge into a clean merge without conflicts.
