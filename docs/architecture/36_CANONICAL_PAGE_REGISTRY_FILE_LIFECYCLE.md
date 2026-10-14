# Architecture Specification: Canonical Page Registry and File Lifecycle (Point 36)

## 1. Overview & Principles

ForgeStudio Blueprint Point 36 defines the single canonical source of truth mapping visual canvas pages, framework routing declarations, and underlying filesystem files.
It guarantees:
- Page identity (`stablePageId`) remains decoupled from file names, filesystem moves, and public titles.
- Public route modifications are separate from filesystem renames.
- Framework router profiles accurately classify Next.js App Router, Pages Router, and React/Vite architectures.
- Lifecycle actions (create, rename/move, reversible retirement, restore) are transactional and preserve history, CMS assets, and media.

## 2. Extended Page Registry Schema

Each record in `RegisteredPage` maintains:
- `stablePageId`: Unique immutable page identifier.
- `fileId`: Deterministic file identity hash.
- `routerProfile`: `"nextjs-app-router" | "nextjs-pages-router" | "react-vite"`.
- `routeTemplate`: Parametrized route pattern (e.g. `/projects/[projectId]` or `/docs/[...slug]`).
- `routeParameters`: Array of typed route parameters (`"static" | "dynamic" | "catch-all" | "optional-catch-all"`).
- `layoutAncestry`: Enclosing layout file paths (e.g. `["app/layout.tsx", "app/(marketing)/layout.tsx"]`).
- `ownership`: `"VISUAL_PAGE" | "SOURCE_OWNED_PAGE" | "HYBRID_PAGE"`.
- `syncStatus`: `"SYNCHRONIZED" | "PENDING_SYNC" | "CONFLICT" | "RETIRED"`.
- `isRetired`: Boolean flag enabling reversible soft deletion.
- `retirementReason` & `retiredAt`: Metadata tracking retirement provenance.

## 3. Framework Route Recognition Engine

### 3.1 Next.js App Router
- Dynamic segments: `app/projects/[projectId]/page.tsx` -> route template `/projects/[projectId]`, dynamic parameter `projectId`.
- Catch-all routes: `app/docs/[...slug]/page.tsx` -> catch-all parameter `slug`.
- Optional catch-all routes: `app/shop/[[...filter]]/page.tsx` -> optional catch-all parameter `filter`.
- Route groups: `src/app/(marketing)/about/page.tsx` -> public route `/about`, group tag `"marketing"`.
- Private folders: Folders starting with `_` (e.g. `app/_components/page.tsx`) are strictly excluded from public page routes.
- Infrastructure exclusions: `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`, `@slot` parallel routes, and intercepted routes are excluded from visual canvas pages.

### 3.2 Next.js Pages Router
- Index normalization: `pages/index.tsx` -> `/`.
- Exclusions: `pages/api/*`, `_app.tsx`, `_document.tsx`, `_error.tsx`, `404.tsx`, `500.tsx`.

### 3.3 React / Vite
- Pages located in `src/pages/*.tsx`.
- Exclusions: Test files (`*.test.tsx`, `*.spec.tsx`), stories (`*.stories.tsx`), atomic components (`Button.tsx`).

## 4. Lifecycle Operations Contract

1. **Create (`createPageLifecycle`):**
   - Validates that target route is not already claimed by an active page.
   - Generates initial boilerplate source code matching project framework.
   - Commits source, registry entry, and visual page simultaneously to a new checkpoint.

2. **Rename / Move (`renameOrMovePage`):**
   - Strictly preserves `stablePageId` and `fileId`.
   - Safely handles Windows case-only renames (e.g. `HomePage.tsx` to `homepage.tsx`).
   - Reports affected public links, menus, and router configuration updates.

3. **Reversible Retirement (`retirePageReversible`):**
   - Soft-retires the page (`isRetired = true`).
   - Preserves all historical commits, source files, CMS entries, and uploaded media.

4. **Restore Draft (`restorePageDraft`):**
   - Restores the retired page into draft state.
   - Re-validates that the route is not currently occupied by another active page before re-activating.

5. **Watcher & Checkpoint Reconciliation (`reconcilePersistedCheckpoint`):**
   - On workspace startup or reload, reconciles filesystem paths with registered pages.
   - Filters out transient atomic save files (`*.tmp`, `*.tmp.*`) to prevent false page deletions during rapid editor saves.
