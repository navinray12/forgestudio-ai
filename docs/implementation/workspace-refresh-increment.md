# Blueprint v2.1 — workspace refresh and build-contract repair

Date: 11 October 2026. Original source baseline: `66dfc6da62b70ec79ddb2d71227b1305d56440f4`. Runtime source commit: `51c5e7e82dedf2a49d041027917488c627a17208`. Branch: `main` only.

## Implemented behavior

- `WebsiteEditor.tsx` now evaluates the current dirty-state predicate instead of treating the function itself as a boolean. Newer clean snapshots apply; dirty local work remains. Request sequencing prevents obsolete responses or results arriving after listener cleanup from replacing current state. Explicit refresh still cannot roll an acknowledged revision backwards.
- `PublishedSite.tsx` reloads through one effect, a reload counter, AbortController and an active-load guard. The preview message handler no longer calls an out-of-scope function. Removed optional fields are cleared on the next snapshot; malformed saved JSON fails rather than silently becoming an empty website.
- `loadSiteSnapshot.ts` uses the existing authorized website loader for draft previews. Denied draft requests do not fall back to public data. Public reads use the canonical endpoint without credentials and validate response identity.
- `workspaceRefreshPolicy.ts` accepts commands only from the actual same-origin parent of an embedded preview. Other windows/origins, public pages, top-level pages, opaque origins and malformed/external route commands are rejected. Outgoing messages name an exact origin.
- `app.ts` retains existing route wiring but removes its duplicate import.
- Collaboration heartbeat resolves display name from the authenticated user record and supplies a deterministic display color. It does not accept a request-supplied name as authoritative.
- CLI diagnostics use the real monorepo, container and infrastructure result properties, reporting secret-reference counts rather than detected secret values.
- The legacy full-stack generator now calls the template service with its supported options and counts the actual `filesCreated` result. This is a contract repair, NOT completion of real application generation. Its sample backend and placeholder AI branch remain outstanding.

## Actual integration boundaries inspected

| Caller | Boundary | Limit |
|---|---|---|
| Editor workspace refresh | authorized website loader -> page hydration | Not the complete atomic checkpoint/merge protocol |
| Embedded preview reload | same-origin parent message -> snapshot effect | Cross-origin/opaque embedding needs a separately qualified channel |
| Draft snapshot | existing authenticated loader and returned scope | Full server/session authorization still requires integration tests |
| Public snapshot | canonical v1 public endpoint | Not certification of the whole publication/privacy implementation |
| Collaboration heartbeat | user lookup -> presence/session service | Full project authorization remains an independent gate |
| Scaffold caller | template options -> created-file list -> audit count | No application-specific AI/DB behavior is proved |
| CLI diagnostics | actual service result contracts | Deployment/orchestration not runtime-certified |

## Tests and repeatable commands

From the repository root, with the committed dependencies installed:

```sh
NODE_PATH="$PWD/backend/node_modules" node --test backend/scripts/verify-page-registration.cjs backend/scripts/verify-workspace-refresh.cjs
node frontend/node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --moduleResolution bundler --module ESNext --lib ES2022,DOM frontend/src/features/developer-workspace/services/workspaceRefreshPolicy.ts frontend/src/features/developer-workspace/services/loadSiteSnapshot.ts
npm --prefix frontend run build
node backend/scripts/report-blueprint-progress.cjs
```

The 57 new tests execute real helpers, services and AST-extracted callbacks from the actual React files. Transport, React setters, database and other boundaries have explicit doubles. They are not real-browser, real-database, penetration or complete blueprint acceptance tests.

Local Node 22.16.0 / available TypeScript 5.8.3: **163 passed, 0 failed, 0 skipped** (106 previous + 57 new). Strict helper checks passed. Ten of the new assertions failed against unchanged original effect/service source, and all passed against the candidate. Clean patch application was rehearsed locally. Local compiler availability is not represented as the repository's resolved version.

## Hosted candidate verification

Read-only run `38130419951`, verification job `114443394018`, applied the exact reviewed source patch before qualification. Committed dependency graphs were installed. Node 22.16.0 and the installed frontend TypeScript 6.0.3 JavaScript API ran the source tests; the backend native TypeScript CLI remained installed for backend diagnostics.

| Check | Observed result |
|---|---|
| Full frontend production build, TypeScript plus Vite | Passed; large-bundle warnings remain |
| Strict refresh/access helper type checks | Passed |
| Combined source/effect/service regressions | 163 passed / 0 failed / 0 skipped |
| Backend TypeScript diagnostics | 28 before -> 13 after; 15 corrected; no new diagnostics |
| Complete backend build | Still blocked |
| Real database/browser/full blueprint acceptance | Not executed |

The first candidate run stopped on an overly specific expected no-emit exit code. The second passed frontend build but its source-test loader tried to call the native compiler's absent JS API. Both harness issues were corrected without disabling assertions or application type checks. The successful third run used an explicit JS API locator, matching the production fallback approach, without changing dependency versions.

A separate fresh job `114443703728` verified before/after source hashes and prepared 11 unattached Git blobs. It did not execute project build output with write credentials or update a branch. Exact checked blobs were applied through a separate fast-forward commit on main. The temporary write-capable preparation workflow has been replaced by a read-only recurring regression workflow; reviewed patches/manifests remain as history, not general mutation authority.

Runtime patch SHA-256: `99318dbecfcb9891dc611072b3dd2d3e52c1cee1f1c028d72b3af66a362c742d`.
Test-loader supplement SHA-256: `a40490d9dc4658bc30a3cb605618c0991d2914388e0008a49b4734a433aa449b`.

## Direct verification of applied main source

Ordinary Production build validation ran directly on runtime commit `51c5e7e82dedf2a49d041027917488c627a17208`, without applying a candidate patch: run `38130677152`, frontend job `114444165107` **passed**, backend job `114444165323` **failed with the same 13 diagnostics**.

The read-only Workspace refresh regression workflow also ran directly on that main commit: run `38130677139`, job `114444165339`, **163 passed / 0 failed / 0 skipped**. Downloaded artifacts were checksum-verified and inspected.

Remaining backend errors: ten missing `forgeBuild.service.js` imports, two absent repository-acquisition methods, and one hosting URL-helper argument mismatch. These require real implementation and contract repair; no fake successful build adapter was introduced. Dependency audit and bundle-size warnings remain separate work.

## Whole-document progress and remaining work

**Verified-complete work packages: 0/27 = 0.00%.** Four packages have partial contributions: WP-04, WP-16, WP-18 and WP-19. The other 23 have not been fully assessed against their complete exit contracts. This does not imply that the existing product has zero functionality.

This increment adds partial evidence for SYN-04/05/08/14 and WP-16/WP-18. It does not declare those entire scenarios or packages complete. Complete create/rename/retire/restore, atomic multi-file checkpoints, application-specific generation, CMS provisioning, real DB persistence, server/browser integration and independent hosting remain open. A successful frontend build is not a complete application or document sign-off.

All previous blueprint requirements and earlier evidence are retained. No production database migration, production deployment, original source-content purge, force push or implementation commit on another branch was performed.

## References

- Candidate verification: https://github.com/navinray12/forgestudio-ai/actions/runs/38130419951
- Applied-source production builds: https://github.com/navinray12/forgestudio-ai/actions/runs/38130677152
- Applied-source regression: https://github.com/navinray12/forgestudio-ai/actions/runs/38130677139
- React effect cleanup: https://react.dev/reference/react/useEffect
- postMessage source/origin controls: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
