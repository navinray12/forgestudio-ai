# Point 31: Visual Editor ↔ Code Workspace Synchronization & Stable Page Registry

## 1. Overview
Point 31 establishes bidirectional synchronization reliability between the visual composition canvas and the underlying code workspace, along with deterministic page and router registration across React/Vite and Next.js App Router.

## 2. Architectural Components

### 2.1 AST Range-Based Source Edits (`visualCodeSync.service.ts`)
- Replaces fragile regex text replacements with surgical TypeScript AST range replacements (`updateJsxElementViaAst`).
- Locates target JSX elements via `data-forge-id` attributes.
- Preserves source-owned dynamic expressions (e.g. `{item.title}`, hooks, custom expressions); refuses to overwrite them with static visual text.
- Supports `expectedRevision` validation to detect and reject stale concurrent updates with `REVISION_CONFLICT`.

### 2.2 Ownership Boundaries
- `VISUAL_COMPOSITION`: visual tags, layout direction, inline styles, text content.
- `SOURCE_OWNED`: hooks (`useState`, `useEffect`), custom event handlers, API fetchers, backend controllers.
- `CMS_CONTENT`: dynamic CMS collection bindings.
- `APPLICATION_SPEC_OWNED`: entity schemas, transactional operations, security policies.

### 2.3 Page & Router Registration (`pageRegistry.ts`)
- Stable Identifiers: Every registered page possesses `stablePageId` and `fileId` preserved across title or route changes.
- Next.js App Router Discovery: Supports `src/app/**/page.tsx` as well as root `app/**/page.tsx`.
- Route Group Handling: Strips parenthesized route groups (e.g. `(marketing)`, `(auth)`) from `routePath` while retaining group metadata.
- Infrastructure Exclusions: Explicitly ignores `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`, and `middleware.ts`.
- Collision Detection: `detectRouteCollisions` identifies duplicate routes across files.
- Safe Deletion: `retirePage` marks entries retired without purging historical commits, CMS collections, revisions, or media assets.
