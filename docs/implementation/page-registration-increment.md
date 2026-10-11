# Blueprint v2.1 — page-registration safety increment

Date: 11 October 2026. Base: `b6b3aecc02287f711a2db6d1fa2bf82b3e699541`, branch `main`.

## Implemented scope

The existing `pageRegistry.ts` API now delegates path recognition to a pure, typed
`pageRecognition.ts`. `visualCodeSync.service.ts` uses its registration preflight.
There is still one page registry, derived from the canonical document.

- Correct nested React `HomePage` and `index` semantics; preserve physical paths.
- Match Next App Router's exact `page.tsx`/`page.jsx` leaf, not `homepage.tsx`.
- Recognize `app`, `src/app`, route groups, Pages Router indexes and dynamic route
  templates; retain URL and parameter case and produce valid suggested symbols.
- Distinguish private App Router folders from Pages Router behavior; exclude
  infrastructure, tests and stories. Parallel/intercepted routes receive an explicit
  unsupported classification. Root JSX files are not implicitly public pages.
- Reject absolute/traversal/invalid paths before filesystem normalization.
- Select an existing page by exact source association, never by its display name.
  Same-route/different-file requests, conflicting dynamic parameters and duplicate
  source ownership produce conflicts without canonical writes.
- Check the project/website binding before source access. This supplements the
  existing caller authorization; it is NOT a complete authorization audit.
- Reject the undocumented `overwrite` resolution path. Only `code` and `visual`
  are accepted resolution choices; their existing explicit reconciliation remains.
- Before registering a NEW visual page, compare the current compiler's projected
  source path and route. Preserve the source and return
  `PAGE_SOURCE_LAYOUT_UNSUPPORTED` if generation would relocate it or alter the URL.
- Return a conflict, not a generic error, when new-page registration loses its
  document-version race. No source ownership transfer or regeneration follows that
  failed save.

## Important limitation

Recognition is not lossless import. The legacy compiler still generates canonical
paths and does not yet preserve every `src/app`, route-group, nested React or
catch-all layout. Such layouts can now be recognized accurately but their automatic
visual registration is deliberately blocked when the compiler plan would change
source/route semantics. This prevents silent corruption; it does not complete the
requested page lifecycle. Full source-layout adapters, stable file IDs, atomic
workspace checkpoints, rename/delete/restore and browser persistence remain open.

The API's `componentName` is a suggested generated identifier, NOT an inferred
source export. Whole-project source-root precedence, custom pageExtensions, actual
exports/layouts and advanced router compatibility need additional qualification.
No production schema, content, protected source history or deployment was changed.

## Repeatable local checks

From `backend`, with its TypeScript dev dependency installed:

```sh
node --test scripts/verify-page-registration.cjs
node node_modules/typescript/lib/tsc.js --noEmit --strict --noUncheckedIndexedAccess --target ES2022 --module commonjs src/services/compiler/pageRecognition.ts
node scripts/report-blueprint-progress.cjs
```

The test loader compiles the ACTUAL repository modules. It stubs database,
filesystem, page parser and project compiler boundaries for service tests. It is
not an untrusted-code sandbox and it does not test real database transactions,
HTTP authorization, browser rendering, source emission or deployed routes.

## Executed evidence

In the implementation container: Node 22.16.0; available TypeScript 5.8.3.

- 106 path/preflight and mocked-service regression tests passed; 0 failed/skipped.
- Strict TypeScript check of the dependency-free recognition module and service control-flow type contract passed.
- Both changed existing TypeScript files parsed/transpiled successfully.
- Eight focused recognition assertions failed against the unchanged base module
  and passed against the replacement (nested home/index, exact page leaf, dynamic
  case/identifier, absolute path, test exclusion and nested identifier).
- Four deliberate service mutations were detected: removal of project binding,
  acceptance of `overwrite`, removal of source-layout preflight, and removal of
  route-takeover rejection. The original tested source was restored afterward.

The container could not resolve github.com for git clone or download project
packages. GitHub source was read using the connected API; original file bytes were
reconstructed locally and checked against their Git blob hashes before modification.
No complete locked dependency install, project-wide TypeScript build, existing
regression suite, real-database test, browser test or production test was run.
The available compiler version is NOT represented as the repository's resolved
TypeScript version. Hosted CI results must be observed separately after pushing.

## Requirement mapping and overall progress

Partial implementation evidence for v2.1 sections 35-37 and scenarios
FS21-AT-PAG-01/02/03/04/05/06/11/14 and SYN-05/08. These cases include broader
browser/persistence/identity obligations and remain unverified as COMPLETE cases.
Work packages WP-04, WP-18 and WP-19 have partial work recorded. None has met its
full exit contract. The whole plan has 27 work packages: verified-complete = 0/27
(0.00%). This is a verification metric, not a claim that the existing product has
zero functionality. Remaining packages are unassessed, not assumed absent.

`progress-v2.1.json` and `report-blueprint-progress.cjs` keep the denominator and
partial/unassessed statuses explicit. The report is a planning aid, NOT a release
permission or trusted test attestation. No prior blueprint or acceptance register
has been deleted, replaced or reclassified.

## Next required implementation

Persist stable source-file/page identities and a coherent source/registry checkpoint;
qualify framework source-layout adapters; add create/rename/retire/restore integration
through actual frontend/API/database flows; then run the full page-lifecycle cases.
Do not remove the new safety guard just to make an unsupported import appear green.

## References

Controlling source: ForgeStudio Execution Blueprint v2.1, sections 35-37, 47-50.
Official framework references consulted 11 October 2026:
- https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
- https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes
- https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes
- https://reactrouter.com/start/declarative/routing
