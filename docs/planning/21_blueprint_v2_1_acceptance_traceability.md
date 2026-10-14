# Blueprint v2.1 — Acceptance Traceability Matrix

Status date: 13 October 2026 · Branch `testing` · Base commit `65b0c48` plus uncommitted work.

This matrix covers the 85 executable acceptance scenarios in blueprint §50.1
(SYN 15, GEN 15, DAT 15, ENV 15, PAG 15, INT 10 — counted from the blueprint text, not assumed).
A scenario is marked **Passed** only when its required behaviour was executed and observed.
Source inspection alone never earns a pass.

## Status summary

| Group | Passed | Partial | Not executed | Blocked | Failed | Total |
|---|---|---|---|---|---|---|
| SYN — visual/code synchronization | 5 | 4 | 6 | 0 | 0 | 15 |
| GEN — AI full-stack generation | 4 | 8 | 2 | 1 | 0 | 15 |
| DAT — application data | 6 | 5 | 4 | 0 | 0 | 15 |
| ENV — Schema Studio and environments | 3 | 0 | 12 | 0 | 0 | 15 |
| PAG — page registry and files | 1 | 11 | 3 | 0 | 0 | 15 |
| INT — integration | 1 | 1 | 8 | 0 | 0 | 10 |
| **Total** | **20** | **29** | **35** | **1** | **0** | **85** |

**The product is not production-ready against this catalogue.** 20 of 85 scenarios pass.
No executed scenario is failing, but 65 are partial, not executed or blocked.

Status meanings:

- **Passed** — the scenario's action was run and its required evidence observed, within the stated scope.
- **Partial** — part of the required evidence was observed; the "Missing" column says what was not.
- **Not executed** — nothing was run. Where the capability does not exist, the row says so.
- **Blocked** — cannot run until an external dependency is supplied.

Two scope limits apply to every GEN and DAT pass:

1. The candidate application came from the **approved template** path (deterministic, no AI provider).
   No scenario here proves a live AI provider call; that is GEN-01, which is blocked.
2. The generated frontend was exercised **headlessly** (its client and view controller in a separate
   Node process). No browser was used, so nothing here proves rendered UI behaviour.

## How to reproduce

All real-database suites are opt-in and refuse to run unless `DATABASE_URL` points at
`localhost/forge_hardening`. From `backend/`:

```sh
export FORGE_DISPOSABLE_TEST_DB=1
export DATABASE_URL=postgresql://<user>:<password>@localhost:5432/forge_hardening

npx vitest run src/tests/workspace-durable-sync.integration.test.ts      # SYN
npx vitest run src/tests/app-generation.integration.test.ts              # GEN-02/09/11/13
FORGE_GENERATED_APP_E2E=1 npx vitest run src/tests/generated-app.acceptance.test.ts   # GEN-03..08, DAT (needs npm registry)
FORGE_GENERATED_APP_E2E=1 node scripts/mutation-check-generated-app.mjs  # INT-07
npx vitest run src/tests/env-migration-target.integration.test.ts        # ENV-07
npx vitest run src/tests/studio-environment-safety.test.ts               # ENV-02, ENV-14
npx vitest run src/tests/page-registry.integration.test.ts               # PAG
npx vitest run src/tests/custom-post-type-cms.integration.test.ts        # §10 CMS trash/purge
npx vitest run src/tests/website-purge.integration.test.ts               # §10 website purge
npx vitest run src/tests/lead-intake.integration.test.ts                 # §12 leads
npx vitest run src/tests/tenant-scoped-apis.integration.test.ts          # §15, §18 tenant scope
```

Results recorded on 13 October 2026: 77/77 across the eight vitest integration suites run together,
plus page-registry 5/5, env-migration-target 3/3, and all three INT-07 mutations detected.

## SYN — visual/code synchronization

Evidence file unless stated: `workspace-durable-sync.integration.test.ts` (8/8, real PostgreSQL,
service and handler level — not driven through the browser editor).

| ID | Scenario | Status | Evidence | Missing / blocker |
|---|---|---|---|---|
| SYN-01 | Visual text and styles reach source | Partial | Initial visual→code generation recorded as a SYNCHRONIZED checkpoint; text round trips in `website-to-code-sync` (memory harness). | Spacing and breakpoint edits, and receipt/canvas/source agreement, on a real database. |
| SYN-02 | Supported source edit reaches canvas | Passed | "applies a supported code edit to the visual document and checkpoints both sides". | — |
| SYN-03 | Acknowledged save survives restart | Passed | "survives a restart": a separate process reads the same checkpoint, document and source. | Labelling of unacknowledged edits in the UI. |
| SYN-04 | Invalid syntax does not erase design | Passed | "keeps an invalid draft without touching the visual document". | — |
| SYN-05 | Overlapping edit conflict | Passed | "detects edits on both sides, preserves both, and resolves only on an explicit choice". | — |
| SYN-06 | Nonoverlapping changes reconcile | Partial | Three-way reconcile unit test (`point34-realtime-sync`, in memory). | The durable path with two revision-bound change sets. |
| SYN-07 | Network duplicate and lost acknowledgement | Passed | "returns the committed result for a retried save instead of writing twice"; "lets a reconnecting client fetch exactly the checkpoints it missed". | — |
| SYN-08 | Out-of-order and stale projections | Not executed | — | No test delivers results out of order. |
| SYN-09 | Offline recovery with concurrent server edit | Not executed | — | Needs the editor client. |
| SYN-10 | Multi-file change is coherent | Not executed | — | No multi-file change-set test. |
| SYN-11 | Undo does not erase another editor | Not executed | In-memory undo unit test only (`point34`), which is not the durable path. | Durable undo/redo with a second editor. |
| SYN-12 | Hooks remain code-owned | Partial | `page-registry.integration` PAG-11: a page with hooks is stored byte-identical and not converted. | Editing wrapper props visually next to hook source; ownership marking in the UI. |
| SYN-13 | Formatting and no-op stability | Partial | No-op and regeneration cases in `website-to-code-verification` (memory harness, 75 tests). | Real database; formatting-only changes. |
| SYN-14 | Revoked session and shared device | Not executed | — | — |
| SYN-15 | Large-workspace responsiveness | Not executed | — | Needs the editor UI and measurement. |

## GEN — AI full-stack generation

Evidence files: `app-generation.integration.test.ts` (11/11) and
`generated-app.acceptance.test.ts` (11/11). The acceptance harness generates through
`AppGenerationService`, exports the persisted files, runs `npm install --ignore-scripts` and the
build in a temporary directory, migrates a disposable schema, runs the API as a separate process
with a scrubbed environment, and verifies each effect with independent SQL.

| ID | Scenario | Status | Evidence | Missing / blocker |
|---|---|---|---|---|
| GEN-01 | Actual provider request | **Blocked** | Last live attempt was rejected by Anthropic (`req_011Cfxqw7SdDxaPg48skmxzj`): the API key is not workspace-scoped. The run was recorded as FAILED, not faked. | Set `ANTHROPIC_WORKSPACE_ID`, or use a workspace-scoped key. Also check `AI_MODEL_PLANNER`: it names `claude-3-5-sonnet-20241022`, which may be retired. |
| GEN-02 | Provider failure is truthful | Passed | "reports provider failures truthfully"; "repairs invalid output at most twice, then fails without writing files" (scripted provider). | — |
| GEN-03 | Frontend and server dependency closure | Partial | Install with scripts disabled and build succeed; server, client and web outputs exist; every package import is a declared, exactly pinned dependency. | The package has no worker; the runner was a temp directory on the same machine, not a clean CI runner. |
| GEN-04 | Real persistent creation | Partial | The generated client and controller create a nonce-tagged task; SQL finds one row with the right tenant, project and state, plus its `Task.created` event. | Creation through a rendered browser UI. |
| GEN-05 | Persistence after complete restart | Passed | API process stopped and restarted; a new session reads the same task from the database. | — |
| GEN-06 | Database outage does not fake success | Partial | With the database unreachable: API returns 503 `DB_UNAVAILABLE` (retryable), no row is written, and the view controller holds a failed, retryable state with no fabricated record. | The rendered failure state in a browser. |
| GEN-07 | Generated domain command | Partial | Generic PATCH cannot change status; completion needs evidence, the right state and the current revision; the valid command writes state, audit and outbox atomically. | "Project members only": the generated policy is tenant scope, with no per-project membership. |
| GEN-08 | User and tenant boundaries | Passed | Another tenant gets 404 on read, update and command, cannot reference tenant A's project (422), and a direct SQL insert is refused by a composite foreign key. | — |
| GEN-09 | Provider data minimization | Partial | The provider receives only the brief, instructions and model contract — no IDs, emails, database URL or keys. The candidate runs with a scrubbed environment. | Proof that production data and credentials are unreachable from the build. |
| GEN-10 | Sandboxed build and custom logic | Not executed | — | **No sandbox exists.** The candidate runs as an ordinary child process with network access. |
| GEN-11 | Bounded repairs preserve gates | Partial | Repairs stop at 2; an unresolved candidate ends FAILED with no files written. | Protection of tests/policies against removal during repair; cost policy. |
| GEN-12 | Incremental application change | Not executed | — | No incremental change flow; regeneration emits a full package and only one initial migration. |
| GEN-13 | Deterministic build without AI | Passed | Template mode emits and validates with the provider factory throwing if called; the run is labelled a template, never AI. | — |
| GEN-14 | Independent verification rejects a fake test report | Partial | Self-reporting endpoints were removed (§44 qualification, release gates, passport). INT-07 shows the candidate's own passing tests do not override the independent harness. | A release-eligibility gate that consumes the independent evidence. |
| GEN-15 | Portable application plus blog | Partial | The exported package installs and runs in a fresh directory and schema with new credentials; tasks are created and read. | The package contains no blog/CMS; no second machine. |

## DAT — general-purpose application data

Evidence file: `generated-app.acceptance.test.ts`, plus `app-model-contract.test.ts` (9/9).

| ID | Scenario | Status | Evidence | Missing / blocker |
|---|---|---|---|---|
| DAT-01 | Application entities separate from CMS | Partial | Generated tables live in the application's own schema; CMS tables are untouched. | The template has Project and Task only (no ProjectMember, Comment); public-delivery exposure not probed. |
| DAT-02 | Field types and defaults | Passed | Introspected column types, nullability and defaults match the model; entity/field IDs are identical across regenerations. | — |
| DAT-03 | Relationship cardinality | Partial | Valid reference works; dangling and cross-tenant references are refused by the API and by the composite foreign key; hard delete of a referenced project is refused. | ProjectMember; cross-project (same tenant) rules. |
| DAT-04 | Concurrent uniqueness | Not executed | — | The model contract has no uniqueness rules yet. |
| DAT-05 | Constraints apply beyond browser checks | Passed | Wrongly typed input → 422; out-of-set status and missing required column are rejected by the database itself. | — |
| DAT-06 | Mass assignment and safe responses | Passed | `tenantId`, `revision` and unknown fields are rejected; responses never contain `tenantId` or `deletedAt`. | — |
| DAT-07 | Permission across transports and jobs | Partial | Enforced on the HTTP API. | No worker transport exists. |
| DAT-08 | Query-specific indexes | Not executed | — | No index proposals or measured plans. |
| DAT-09 | Bounded pagination and filters | Passed | Pages do not overlap under a total order; limit above 100, bad offsets, unknown parameters, `tenantId` and non-UUID filters are rejected with 400. | — |
| DAT-10 | Explicit command instead of generic state patch | Passed | PATCH of status → 422; `complete` enforces state, revision and evidence and commits one transition. | — |
| DAT-11 | Replay-safe command effects | Passed | Same key and input returns the original result with `Idempotent-Replay`; changed input → 409; one audit row and one outbox row. | — |
| DAT-12 | Model evolution preserves field identity | Not executed | — | No model-evolution migrations. |
| DAT-13 | Existing database adoption | Not executed | — | — |
| DAT-14 | Deletion honors relation and retention rules | Partial | Archiving a project with live tasks → 409 `HAS_DEPENDENTS`; after its tasks are archived it succeeds; rows are soft-deleted, never removed. | Protected CMS references are not part of the generated app. |
| DAT-15 | Migration authority and contract coherence | Partial | One migration authority with a checksum ledger: re-run is a no-op, and a changed checksum blocks with "checksum drift". | Detecting a schema changed outside the ledger; requalifying DTOs/clients. |

## ENV — Schema Studio and environments

| ID | Scenario | Status | Evidence | Missing / blocker |
|---|---|---|---|---|
| ENV-01 | Schema Studio desired versus observed | Not executed | — | — |
| ENV-02 | Missing environment is rejected | Passed | `studio-environment-safety` (15/15): missing or unknown environment is rejected before any database is touched. The data API (`/api/v1/data`) previously fell back to PRODUCTION and now uses the same check. | No HTTP-level test of the data API itself. |
| ENV-03 | Target identity cannot be relabelled | Not executed | — | — |
| ENV-04 | Credential isolation and rotation | Not executed | — | — |
| ENV-05 | Least privilege and poisoned pool | Not executed | — | The acceptance harness uses `search_path`, which the blueprint says is not isolation. |
| ENV-06 | Migration preview and approval | Not executed | — | — |
| ENV-07 | Wrong-database migration ID | Passed | `env-migration-target.integration` (3/3): another database's migration ID → 403 before any DDL; wrong project or environment → 403; the migration row is unchanged and its table was never created. | — |
| ENV-08 | Drift after approval | Not executed | SQL edited after its checksum was recorded is refused (same file), which is related but not target drift. | — |
| ENV-09 | Partial DDL outcome reconciliation | Not executed | — | — |
| ENV-10 | Concurrent index failure | Not executed | — | — |
| ENV-11 | Safe schema promotion | Not executed | — | — |
| ENV-12 | Actual application connection check | Not executed | — | — |
| ENV-13 | Restore preserves obligations | Not executed | — | — |
| ENV-14 | Expert SQL is not a domain bypass | Passed | `studio-environment-safety`: PRODUCTION read-only mode rejects DDL with PostgreSQL's own error and cannot be escaped with a COMMIT-prefixed batch or `SET TRANSACTION`. | Hidden-function mutation and export paths. |
| ENV-15 | Migration contention and operating budgets | Not executed | — | — |

## PAG — page registry and file lifecycle

Evidence files: `page-registry.integration.test.ts` (5/5, real workspace, React project) and the
pure-function suites `point36-page-lifecycle` and `point31-page-registry` (unit level, no persistence).
No PAG scenario was run through the page selector UI, preview, a Next.js project, export or a runtime probe.

| ID | Scenario | Status | Evidence | Missing / blocker |
|---|---|---|---|---|
| PAG-01 | Code-created Next page | Not executed | — | Needs a Next.js project fixture. |
| PAG-02 | Next src/app and route group | Partial | Unit: `(marketing)` is stripped from the route. | Real workspace with a Next.js project. |
| PAG-03 | React uses explicit configured routing | Partial | Saving `src/pages/ReportsPage.tsx` registers exactly one page at `/reports`; saving again adds no duplicate; published state is unchanged. | Assertion on the generated router entry. |
| PAG-04 | Infrastructure exclusions | Partial | Helper, test, story, util and hook files never become pages (real workspace). | Next.js `pages/api`, `_app`, `_document` in a real workspace (unit only). |
| PAG-05 | Route-group collision | Partial | Unit: collisions are detected. | Checkpoint qualification with both file IDs. |
| PAG-06 | Nested and dynamic route templates | Partial | Unit: dynamic and catch-all segments are recognised. | Preview with fixture params. |
| PAG-07 | File-only rename | Partial | Renaming keeps the page key and leaves one entry (real workspace). | Keep-URL file rename with import/export mapping. |
| PAG-08 | Route move and link impact | Partial | Route change keeps identity; the old route is gone from the draft. | Redirect/link impact plan; release-time behaviour. |
| PAG-09 | Batch folder move | Not executed | — | — |
| PAG-10 | Page deletion and restore | Partial | Home page deletion refused; deleting a page retires its route while unrelated hand-written files stay byte-identical. | Restore after deletion. |
| PAG-11 | Ambiguous new source is preserved | Passed | A page file the canvas cannot represent is stored exactly, not registered, and not converted. | — |
| PAG-12 | Safe obsolete-file cleanup | Partial | Unit: removal plan only covers generated files (`point37-to-39`). | Real workspace with recoverable history. |
| PAG-13 | Modified and user-created files survive cleanup | Partial | `app-generation.integration`: generation refuses to overwrite a hand-written file (`SOURCE_CONFLICT`). | Cleanup + regeneration with a modified generated file. |
| PAG-14 | Naming, imports and case-only moves | Partial | Unit: case-only rename does not raise a false collision. | Compile on a case-sensitive runner. |
| PAG-15 | Registry source canvas export agreement | Not executed | — | — |

## INT — integration

| ID | Scenario | Status | Evidence | Missing / blocker |
|---|---|---|---|---|
| INT-01 | Complete five-track owner demonstration | Not executed | — | Depends on GEN-01 and most of the scenarios above. |
| INT-02 | Concurrent AI and human changes | Not executed | — | — |
| INT-03 | Simultaneous schema and frontend evolution | Not executed | — | — |
| INT-04 | Code-only page uses generated API | Not executed | — | — |
| INT-05 | CMS deletion invariants under app cleanup | Partial | CMS trash/restore/approved purge (12/12) and website purge (6/6) hold on a real database. | Interaction with code cleanup and model retirement; retention simulation. |
| INT-06 | Wrong environment disguised by healthy ping | Not executed | — | — |
| INT-07 | Mutation testing of critical gates | Passed | `scripts/mutation-check-generated-app.mjs`: removing the tenant check, the outbox write, or the commit each makes the independent harness fail (3/3 detected), while the candidate's own unit tests would still pass. | Scope is the generated application's gates, not platform gates. |
| INT-08 | Post-save worker crash | Not executed | — | — |
| INT-09 | Restore and schema/data compatibility | Not executed | — | — |
| INT-10 | Fresh operator and independent installation | Not executed | — | Needs a second operator. |

## Requirement-level changes behind this matrix

| Blueprint | Expected behaviour | Implementation | Verification |
|---|---|---|---|
| §07, §38 | Provider configuration is honoured; failures are truthful | `modules/ai/anthropic.provider.ts` uses the configured model as given (it used to substitute a hard-coded one); `provider-routing.ts` rejects an unrecognised `AI_SITE_PROVIDER` | `ai-site-blueprint` 10/10 |
| §33, §39, §45 | Model contract with same-tenant references and command-only state | `services/appGeneration/appModel.ts` | `app-model-contract` 9/9 |
| §38.2, §40, §43.1, §46.2 | Generated package has real behaviour and one migration authority | `services/appGeneration/appSourceEmitter.ts` | `generated-app.acceptance` 11/11 |
| §10 | Website purge needs an independent approver, expiring approval and an exact manifest | `services/websitePurge.service.ts`, `website_purge_requests`; direct purge returns 409 | `website-purge.integration` 6/6 |
| §12 | Receipt only after the submission, lead, audit event and notification jobs commit | `services/leads/leadIntake.service.ts`, `forge_leads`, `forge_lead_events`; `services/form/form.service.ts` | `lead-intake.integration` 5/5 |
| §15 | Published workflow definitions are immutable | `services/workflowsCommunication/durableWorkflowDefinitions.service.ts`, `forge_workflow_definitions` (trigger + partial unique index) | `tenant-scoped-apis.integration` 11/11 |
| §17, §44 | One durable release authority; no self-issued evidence | `release-integrity` router and §44 qualification routes unmounted; `deployments` + `publishing.service` remain the authority | `tenant-scoped-apis.integration` (404 assertions) |
| §42.2 | Environment classes are development, staging, production | `modules/data-platform/common/project-access.ts`: STAGING canonical, PREVIEW kept as legacy label; data API fails closed | `studio-environment-safety` 15/15 |
| §45 | The Team Project Tracker is generated, not hard-coded | Showcase route unmounted; `teamProjectTracker.service.ts` reports unexecuted steps as `NOT_EXECUTED` | `point45` and `point44-to-47` |

## Decisions recorded

- **PREVIEW vs STAGING.** §42.2 names the classes development, staging and production, so `STAGING`
  is canonical. `PREVIEW` remains a valid, addressable label and no stored value was renamed.
  Neither the development database nor `forge_hardening` holds a `PREVIEW` or `STAGING` row today.
  Retiring `PREVIEW` later needs, per deployment: confirm no website has both labels, then
  `UPDATE project_databases SET environment = 'STAGING' WHERE environment = 'PREVIEW'`
  (rollback is the reverse update). This has not been run anywhere.
- **Release state.** `DurableReleaseController` duplicated the persisted `deployments` lifecycle in
  memory, so it was unmounted rather than given a second persistence engine. §17's compare-and-swap
  active pointer and fencing token are not yet implemented on `deployments`.
- **API groups left unmounted:** forms-leads (superseded by the durable lead service),
  owner-experience, marketing-analytics, search-quality, delivery-governance, components, benchmark
  and capabilities. Every one keeps all of its state in process memory with no database use (checked
  per service directory), so its records would be shared across tenants and lost on restart.
  forms-leads and components also read the tenant from the request, and the forms-leads controller
  defaults a missing tenant to `"tenant-1"`. delivery-governance additionally exposes a commerce
  webhook and ownership transfer with no authentication middleware on its router. Mounting any of
  them needs a durable store and server-derived membership first; none was required for a scenario
  in this catalogue.
