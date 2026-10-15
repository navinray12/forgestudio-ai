# 01 — Repository and Architecture

Audit date: 2026-10-15 · Branch `sconfigtesting` (main branch for PRs: `testing`) · HEAD `fa2de24` plus 39 uncommitted/staged paths.
Finding IDs (`SEC-`, `DATA-`, `PROD-`, `ARCH-`, `QA-`) are defined in [08-verification-and-evidence-ledger.md](08-verification-and-evidence-ledger.md).

## 1. Repository inventory

| Unit | Path | Runtime | Size (TS/TSX) | Role |
|---|---|---|---|---|
| Backend API | `backend/` | Node (ESM), Express 5, Prisma 7 (`@prisma/adapter-pg`), `pg`, `ws` | 957 files / 413k lines (≈200k are generated Prisma client, ≈52k tests) | REST API, WebSocket gateways, schedulers, in-process job worker |
| Background worker | `backend/src/workers/main.ts` | Same image, `node dist/workers/main.js` | 70 lines | Polls `background_jobs` for `AI_DESIGN_EXECUTION`, `FILE_SCAN`, `DOMAIN_EVENT`; outbox dispatch; prompt cleanup |
| Platform worker | `backend/src/workers/platform-worker.ts` | `npm run worker:platform` | 53 lines | Not started by docker-compose |
| Frontend SPA | `frontend/` | React 19, React Router 7, Vite 8, Tailwind 4, Monaco | 362 files / 143k lines | Dashboard, visual editor, developer workspace, published-site renderer, admin consoles |
| WordPress plugin | `wordpress-plugin/` | PHP | not inspected in depth | Connector for WordPress publishing |
| Root test harness | `tests/` | tsx / Python / Playwright specs | — | "Part B" regression scripts, browser specs (`tests/browser/*.spec.ts`, `*.py`) |
| Ops scripts | `scripts/`, `bootstrap.ps1`, `run-dev.*`, `start*.bat`, `diagnose-port-3307.ps1` | PowerShell/batch | — | Local developer bootstrap (Windows-centric) |
| Infra | `docker-compose.yml`, `docker-compose.ai-qualification.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` | Docker | — | postgres:15, api, worker, frontend (nginx), migrate, minio |
| CI | `.github/workflows/*.yml` (25 files) | GitHub Actions | — | Fragmented, increment-specific qualification jobs |
| Documentation | `docs/` (architecture 06–49, planning 01–21, implementation, capabilities, contract, benchmark, audit) | Markdown | — | Blueprint v2/v2.1 specs and prior reports |

There is no npm workspace configuration: the root `package.json` only proxies scripts to `backend/` and `frontend/` (`npm --prefix`). Each app has its own lockfile.

### Leftover / non-product artifacts (ARCH-05)
`frontend/src/pages/dashboard/UserDashboard.tsx.rej` (failed patch hunk), `frontend/fix.js`, `frontend/test.js`, `frontend/replace_script*.cjs`, `backend/fix.js`, `backend/sync-db.ts`, `backend/create-user.ts`, `backend/test-users.ts`, root `API_RUNTIME_*.json`, `DOM_RUNTIME_INVENTORY.json`, `RUNTIME_CERTIFICATION_F484_F508.json`, `.agents/temp_section.txt`. Built outputs `backend/dist`, `frontend/dist`, and `backend/uploads/` are present in the working tree.

## 2. Entry points and runtime boundaries

| Entry | File | Notes |
|---|---|---|
| HTTP server | `backend/src/server.ts` | Runs `ensureDatabaseTables()` (runtime DDL, DATA-01), reconciles interrupted AI generation runs and migrations, then listens. **Starts even if schema creation fails.** Calls `startScheduler()` which also starts an in-process job worker. |
| Express app | `backend/src/app.ts` (`createApplication`) | ~120 router mounts, almost all duplicated under `/api/*` and `/api/v1/*`. |
| WebSocket upgrade | `backend/src/websocketGateways.ts` | `/ws/presence`, `/ws/collaboration`, `/ws/workspace-sync`, `/ws/realtime`, `/ws/terminal`. Only presence and workspace-sync authenticate (SEC-01, SEC-03). |
| Worker | `backend/src/workers/main.ts` | Claims only job types it has handlers for (`jobRunner.ts:248`). |
| Frontend | `frontend/src/main.tsx` → `App.tsx` | 25 routes; editor, workspace, database studio, admin, platform-control are lazy-loaded. |

### Mounted vs. unmounted routers
- `backend/src/routes/index.ts` builds an `apiRouter` that is **never mounted**; `app.ts` imports only named routers from it. Routers reachable only through `apiRouter` are therefore dead: `releaseIntegrity.routes.ts`, `websiteContract.routes.ts`. This is an intentional decision recorded in prior work (in-memory/fabricated-evidence routers) but the files remain (ARCH-03).
- `tenantWorkspaceRoutes` is mounted twice (`app.ts:218-221` and `app.ts:252-255`), and `/api/v1/workspaces` is bound to both `tenantWorkspaceRoutes` and `teamRoutes` (`app.ts:250-251`). Resolution depends on registration order (ARCH-03).
- Two organization billing stacks exist. `modules/billing/http/routes.ts` serves checkout at `/api/v1/organizations/:organizationId/billing`. The main router of `services/billing/billing.routes.ts` is imported but **not mounted** (dead); only its webhook router is, so two Stripe webhook endpoints are live (`/api/v1/billing/webhooks/stripe`, `/api/v1/billing/webhooks`) (PROD-02; corrected in the 2nd pass — the 1st pass wrongly said both checkouts were mounted on the same path).
- Full endpoint catalogue: [10](10-api-endpoint-catalog.md) — 1,087 live endpoint declarations in 83 routers.

## 3. Architecture summary

```
Browser SPA (React) ──REST (cookie session)──► Express API ──Prisma/pg──► PostgreSQL
      │                                         │   │                       ├─ app schema (Prisma models + 173 runtime-DDL tables)
      │                                         │   │                       └─ customer schemas forge_cust_* (data platform)
      ├──WS /ws/presence, /ws/workspace-sync────┤   ├─► AI providers (OpenAI / Anthropic / Gemini / Google Stitch)
      ├──WS /ws/realtime (anonymous) ───────────┤   ├─► Stripe, PayPal, SMTP, WordPress sites, SFTP, DNS
      └──WS /ws/terminal (anonymous host shell)─┘   └─► local disk: uploads/, os.tmpdir() deployments & sandboxes
                                                 Worker process ──► background_jobs / outbox (PostgreSQL)
```

### Two product models
1. **Website** (`websites` table): the visual-builder document lives in one JSONB column `editorData`, which also holds the published snapshot (`publishedData`), up to 50 release snapshots, up to 25 backups, custom domains, hosting config, commerce orders and scheduled-publish state (DATA-03).
2. **ForgeProject** (`forge_projects`, `forge_project_files`, …): a code-first developer workspace (files, git, terminal, runtime, build, preview, data platform). A visual↔code bridge keeps generator-owned page files in sync with the website document (`compiler/visualCodeSync.service.ts`, frontend `canvasSourceSync.ts`).

The product is therefore two platforms in one: a website builder and a full-stack app-generation/developer platform (Supabase-like data platform, terminal, runtime, CI/CD, code intelligence). Most launch risk for a *website-builder* release comes from the second platform being reachable on the same server (SEC-01/02/03).

### Schema authorities (DATA-01, DATA-04)
- Prisma schema: 95 models, 36 migrations.
- `config/ensure-schema.ts` (3,567 lines) runs at every boot: `CREATE TABLE IF NOT EXISTS` for 173 tables and 83 `ALTER TABLE … ADD COLUMN IF NOT EXISTS`; errors are logged and boot continues. 12 other services also run their own `CREATE TABLE IF NOT EXISTS`.
- `config/prisma-fallback.ts` (914 lines) + a `Proxy` in `config/prisma.ts` fabricates raw-SQL "model delegates" for tables that are not Prisma models (support, forum, forge_* …), so `prisma.<model>` calls compile and run without schema typing.

## 4. Major data flows

| Flow | Path (evidence) | Status |
|---|---|---|
| Signup / login | `LoginPage`/`SignupPage` → `POST /api/auth/{signup,login}` → `modules/identity/http/local.routes.ts` → `LocalAuthentication` (challenge + email OTP) → session cookie | Implemented; working-tree change leaks OTP outside `production` (SEC-04) |
| Plan provisioning | `GET /api/v1/subscriptions/current` or `GET /api/v1/users/me/usage` lazily call `assignDefaultFreePlan` | Side effect of reads (PROD-01) |
| Create site | `UserDashboard` → `POST /api/websites` → `createPersonalWebsite` (serializable txn, plan limit, personal org/workspace) | Implemented |
| Edit/save | `WebsiteEditor` → `createDocumentSaveCoordinator` → `PUT` with `If-Match`/`Idempotency-Key` → `services/websites/save-document.ts` (CAS on `documentVersion`) | Implemented, strong design |
| AI generate | `POST /api/ai/websites/:id/generate` → `generateSiteDraft` (synchronous provider call, validated blueprint) → `ai_changesets` → review → `POST /ai/changesets/:id/apply` (version-bound) | Implemented; no quota on this path (PROD-03) |
| Publish | `PublishModal` → `POST /api/websites/:id/publish` → `publishing.service.publishWebsite` → snapshot written into `editorData.publishedData` | Bypasses document CAS (DATA-02) |
| View site | `/site/:websiteId` (SPA route) → `GET /api/websites/public/:id` → client-side render in `PublishedSite.tsx` | Client-rendered only; no host/domain routing (PROD-04) |

## 5. Architectural risks

1. **Unauthenticated remote shell and anonymous data feeds on the main API server** (SEC-01, SEC-03) and host-level "sandbox" execution (SEC-02). These make the current server unfit for any multi-tenant or internet-facing deployment.
2. **Dual schema authority** (migrations vs. boot-time DDL) with a broken migration history on the developer database (DATA-01).
3. **Single-row document aggregation** (`editorData` JSONB holding drafts, releases, backups, domains, orders) — write amplification, row bloat, and no relational integrity for operational data (DATA-03).
4. **Monolithic frontend files** — `WebsiteEditor.tsx` 21,151 lines, `renderers.tsx` 10,030, `DynamicWidgetInspectors.tsx` 9,995, `ManagedSiteModal.tsx` 4,815 (ARCH-01). No frontend unit-test runner.
5. **Route sprawl**: every router mounted twice (`/api` and `/api/v1`), ~120 mounts, overlapping routers on `/api/v1/websites` (14 routers) and `/api/v1/workspaces` (ARCH-03).
6. **Duplicated subsystems**: two Stripe adapters and billing services, two custom-domain services (`services/domains/customDomain.service.ts`, `services/hosting/forgeDomain.service.ts`), two upload paths (legacy disk vs. governed `file_objects`), two job pollers (API process and worker) (ARCH-04).
7. **Local-disk state** (`uploads/`, `os.tmpdir()/forgestudio_deployments`, sandbox workspaces) prevents horizontal scaling and is lost on container replacement unless volumes are configured.
