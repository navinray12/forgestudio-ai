# Point 31: Visual Editor ↔ Code Workspace Synchronization & Stable Page Registry

## 1. Overview
Point 31 establishes bidirectional synchronization reliability between the visual composition canvas and the underlying code workspace, along with deterministic page and router registration across React/Vite and Next.js App Router.

## 2. Architectural Components

### 2.1 AST Range-Based Source Edits (`visualCodeSync.service.ts`)
- Replaces fragile regex text replacements with surgical TypeScript AST range replacements (`updateJsxElementViaAst`).
- Locates target JSX elements via `data-forge-id` attributes.
- Preserves source-owned dynamic expressions (e.g. `{item.title}`, hooks, custom expressions); refuses to overwrite them with static visual text.
- Supports `expectedRevision` validation to detect and reject stale concurrent updates with `REVISION_CONFLICT`.

#### Visual-to-code mutation contract (`jsxAstMutation.ts`, WP-04/WP-18)

`updateJsxElementViaAst(source, elementId, change, fileName)` applies one mutation and returns
`{ updated, content, code?, diagnostic?, changedRange? }`. `updated` is true only when `content`
differs from the source; otherwise `content` is the source unchanged and `code` says why. A string
`change` is shorthand for `SET_TEXT`.

| Mutation | Effect | Accepted when |
| --- | --- | --- |
| `SET_TEXT { text }` | Replaces the element's text (escaped; surrounding line breaks kept) | Children are plain text only |
| `SET_PROP { name, value }` | Sets a literal attribute; `null` removes it | The existing value is a literal; not `data-forge-id`, `key`, `ref`, `style`, `className`, `on*`; URL attributes use a safe scheme |
| `SET_CLASSES { classes }` or `{ add, remove }` | Replaces or adjusts `className`; an empty list removes it | `className` is a string literal or absent |
| `SET_STYLE { style }` | Merges inline style properties; `null` removes one; an emptied style is removed | `style` is `{{…}}` or `css({…})` with plain properties, and every touched value is a literal |
| `INSERT { parentId, index?, element }` | Adds a new element (`tag`, `text`, `classes`, `props`, `style`) with the given ID | The ID is unused; lowercase tag that is not script/style/iframe/…; parent has only element children |
| `REMOVE` | Deletes the element and its own lines | Not the component root; the subtree has no code expressions, handlers or spread props |
| `REORDER { index }` | Moves the element among its siblings | Parent has only element children |
| `MOVE { parentId, index? }` | Moves the element under another parent, re-indented | As `REORDER`, and not into itself or a descendant |

Rejection codes: `INVALID_SOURCE` (the file does not parse), `INVALID_MUTATION`, `TARGET_NOT_FOUND`,
`AMBIGUOUS_TARGET` (the ID matches more than one element), `SOURCE_OWNED` (computed values, handlers,
code-driven children, protected regions), `UNSUPPORTED`, `NO_CHANGE`, `INVALID_RESULT` (the edit would
not parse or would change the set of `data-forge-id` values), `TS_UNAVAILABLE`.

Guarantees: edits are text ranges located through the AST, so imports, hooks, comments and all
other lines are byte-for-byte unchanged; the result is re-parsed before it is accepted; element IDs
are never rewritten.

Integration:
- `POST /api/v1/projects/:id/sync/visual-to-code` with `{ filePath, element: { id }, mutation, expectedRevision? }`
  (`element.textContent` alone still means `SET_TEXT`). 200 `{ success, updated, content, version, changedRange }`;
  a no-op is 200 with `updated: false, code: "NO_CHANGE"`; a rejected edit is 422 with `success: false`,
  `code` and diagnostics. The file is written, and its version bumped, only when `updated` is true.
- `RealtimeSyncService.processVisualOperation` maps `TEXT_EDIT`, `PROPERTY_UPDATE`, `INSERT`, `REMOVE`,
  `REORDER` and `DRAG` (with a parent or index) to these mutations and commits only when the source
  changed (`sourceChanged`, `rejectionCode`).

Limitations:
- Targets are lowercase or component elements carrying a literal `data-forge-id` (or literal `id`);
  elements without one cannot be addressed.
- Structural edits are refused for elements rendered inside `{…}` expressions (`map`, conditionals)
  and for parents that mix text with elements. Text and literal props of such elements can be edited;
  an edit inside a `map` body changes every rendered instance.
- Inserted elements are plain intrinsic elements; components, event handlers and expressions are not generated.
- New styles are written as `style={{…}}`; responsive (media-query) styles in the generated stylesheet are not edited.
- Text is single-run: line breaks and leading/trailing spaces in the new text collapse under JSX rules.
- A style object that contains comments cannot have properties added or removed.
- Removing the last child leaves the parent's opening and closing tags on separate lines.
- Free-position drags (coordinates without a parent or index) are rejected as `UNSUPPORTED`.
- WebSocket transport is out of scope (Phase 4).

#### Canvas → source: regeneration versus element edits

The canvas edits the visual document. How a saved change reaches a page's source depends on who
owns that page file:

| Page file | Mechanism | Trigger |
| --- | --- | --- |
| Generator-owned (a pure projection of the document) | Whole-project generation rewrites the file | Every document save (`PUT /api/websites/:id` → `syncBridgedProjectForWebsite`), and "Sync Visual Changes to Source Files" / Compile in the Code Workspace |
| Held (hand-written code the reconciler could not represent; listed in `codeSync.conflicts`) | Element-level AST mutations; the file is never regenerated | Every document save from the canvas |

Whole-project generation stays required for generator-owned pages, new pages, routes, layout and
the stylesheet. It must not rewrite a held page, so for those the editor does this after each
acknowledged save (manual save and autosave both go through `persistDocument`):

1. `POST /api/v1/projects/:id/sync/visual-to-code/plan` with the visual document before and after
   the save and the held paths. The planner (`canvasEditPlanner.ts`) renders the page from both
   documents with the project generator, compares the element trees by `data-forge-id`, and
   returns `{ files: [{ filePath, version, edits: [{ elementId, mutation }], unsupported }], skipped }`.
   It is read-only and plans held pages only; other paths come back in `skipped`.
2. Each edit is sent to `POST …/sync/visual-to-code` with `expectedRevision` set to the file
   version, advanced by each applied edit (`canvasSourceSync.ts`, via `forgeProjectService.syncVisualToCode`).
3. Outcomes are reported in the editor status line, never assumed:
   - applied: the file changed (one version per applied edit);
   - unchanged (`NO_CHANGE`): no version is created;
   - rejected (`TARGET_NOT_FOUND`, `AMBIGUOUS_TARGET`, `SOURCE_OWNED`, `UNSUPPORTED`, …): the source is
     kept, the rejection is shown, and the remaining edits continue;
   - stale revision (409): the file revision is re-read once and the same edit is re-validated by
     the server against the current source; if the file changes again, the remaining edits for
     that file are not applied and a conflict is reported.

Canvas operations covered: text, classes, inline style, link/image attributes, insertion, deletion,
reordering and moving between parents, as far as the generator expresses them on the element
carrying the canvas element's ID. Classes are adjusted (add/remove), so classes added in code survive.

Limitations of the canvas path:
- Only the change made by the save being acknowledged is sent. If the edits cannot be applied
  (network failure, rejection, conflict), they are reported but not retried by a later save; the
  remaining difference is resolved in the Code Workspace ("Sync Code to Visual" → keep code or
  regenerate from the visual document).
- The "Sync Visual Changes to Source Files" action does not re-send element edits; it regenerates
  generator-owned files and now lists the held pages it skipped.
- Changes the generator renders outside the element itself (responsive styles in the stylesheet,
  page shell, navigation items, widget types rendered as several elements without IDs) are reported
  as unsupported or not planned.
- Positions are indexes among the generated siblings; hand-written sibling elements in the file can
  shift where an inserted or reordered element lands.
- A new component element (`<Link>`, `<Image>`) or a changed tag needs the page to be regenerated.
- Verified by integration tests through the editor's client modules against the real API; the React
  editor component itself has not been exercised in a browser test.

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
