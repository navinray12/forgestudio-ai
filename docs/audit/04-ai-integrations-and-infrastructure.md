# 04 — AI, Integrations and Infrastructure

Finding IDs refer to [08](08-verification-and-evidence-ledger.md).

## 1. AI subsystem (`backend/src/modules/ai`, ~13k lines)

| Aspect | What exists | Status / gaps |
|---|---|---|
| Providers | OpenAI, Anthropic, Gemini adapters (`openai.provider.ts`, `anthropic.provider.ts`, `gemini.provider.ts`, `gateway/providerAdapters.ts`); Google Stitch SDK for design (`design/stitch-*`); image providers (`images/image-provider.ts`) | Keys are configured locally (names only checked). **No live call was made in this audit** (cost, external side effects) → live behaviour UNVERIFIED. |
| Routing | `provider-routing.ts`: `AI_SITE_PROVIDER` selects provider, unknown value fails closed, default prefers OpenAI then Anthropic then Gemini. Retries reuse the recorded provider snapshot. Site generation falls back to another configured provider on availability/auth errors. | Implemented. Fallback can silently change cost profile. |
| Timeouts | Anthropic 60 s abort (`anthropic.provider.ts:22`); `max_tokens` 4096–8192 | Site generation is synchronous inside the HTTP request — slow providers hold the connection and a worker thread. |
| Structured output / validation | `generateValidatedSiteBlueprint`, `site-blueprint.ts`, `site-brief.ts` validation; changesets store `proposedDocument` and are applied only through the version-checked save path (`save-document.ts:47-98`) | Strong design: AI never writes the document directly. |
| Durable execution | `ai_executions` table; design pipeline runs as `AI_DESIGN_EXECUTION` jobs in the worker; `reconcileInterruptedRuns()` at boot marks interrupted runs failed | Site generation is **not** a durable job (in-request). |
| Quotas / cost | `ai-quota.ts` daily per-workspace units for sub-generators; design executions bounded by `AI_DESIGN_DAILY_UNITS` | PROD-03: site generation unquoted; plan `aiCreditLimit` unused; usage reports constant 0. |
| Prompt privacy | Prompts encrypted with `AI_PROMPT_ENCRYPTION_KEY`, retention hours, cleanup scheduler | Implemented, UNVERIFIED. |
| Mocks / hard-coded results | No mocked provider found on the production path. `browserEngine.ts`, `toolRegistry.ts`, `mcpRegistry.service.ts` contain simulation language; not inspected in depth. | See 09 for remaining scope. |
| Other agents | planning, architecture, coding, website, multi-agent orchestrator, MCP server/client, project memory, context engine | Mostly serve the developer platform; UNVERIFIED. |

## 2. Jobs and background processing

- Queue: `background_jobs` (PostgreSQL), claims with `FOR UPDATE SKIP LOCKED` restricted to the claimant's registered handler types (`jobRunner.ts:248-254`), leases, max attempts, dead letters. In-memory fallback only when `NODE_ENV !== "production"` **and** `FORGE_ALLOW_MEMORY_JOB_FALLBACK=1` (the local `.env` sets this flag).
- Two pollers: the API process (`startScheduler` → `initJobHandlers` → all handlers: `SCHEDULED_PUBLISH`, `DEPLOYMENT_VERIFY`, `WEBHOOK_RETRY`, `MEDIA_OPTIMIZATION`, `FORM_NOTIFICATION_EMAIL`, 11 WordPress job types) and the worker process (`AI_DESIGN_EXECUTION`, `FILE_SCAN`, `DOMAIN_EVENT`). Scaling the API horizontally multiplies job pollers; jobs and HTTP compete for the same event loop.
- `DOMAIN_EVENT` handler only acknowledges (no consumers).
- Custom-code scheduled publication polls every 60 s in the API process (`scheduleWorker.ts`).

## 3. Storage

| Store | Used by | Notes |
|---|---|---|
| `backend/uploads/images` (local disk, public static `/uploads`) | editor uploads, media library | SEC-07, PROD-07; lost without a volume; not shared across instances |
| S3 / MinIO via `@aws-sdk/client-s3` (`modules/files`, `services/files`, data-platform storage) | governed org files, project storage | Not used by the website editor; compose ships `minio/minio:latest` (unpinned) |
| `os.tmpdir()/forgestudio_deployments`, sandbox workspaces | `/api/hosted`, runtime/terminal | Ephemeral; SEC-02, SEC-06 |
| `AI_ARTIFACT_DIRECTORY` (compose volume `ai-artifacts`) | AI design artifacts | — |

## 4. Hosting, publishing and domains

- **Internal publishing** stores the snapshot in `editorData.publishedData` and release snapshots in `editorData.releases` (≤50). Public reads resolve `currentReleaseId`. Rollback switches the pointer. (DATA-02, DATA-03)
- **Serving**: only the SPA route `/site/:websiteId[/:pageSlug]` on the application origin. No static HTML generation for the live site, no SSR, no CDN integration, no per-tenant origin (PROD-04).
- **Custom domains**: DNS preflight (TXT/CNAME/A lookups against `EDGE_SERVER_IP`, default `76.76.21.21`) is real; SSL issuance is fabricated; no request routing by host. Two domain services exist (`services/domains/customDomain.service.ts`, `services/hosting/forgeDomain.service.ts`).
- **Other destinations**: WordPress (extensive, job-based, rollback targets), SFTP, static ZIP export. All UNVERIFIED at runtime (need external targets).
- **Project hosting** (`/api/hosted`): serves from tmpdir, fake health (SEC-06). `forgeHosting.service.ts`, `forgeCicd.service.ts` (developer platform) not inspected in depth.

## 5. External integrations

| Integration | Evidence | Status |
|---|---|---|
| Stripe | two adapters (`modules/billing/stripe.adapter.ts`, `services/billing/stripe.adapter.ts`), signed raw-body webhooks mounted before JSON parsing | REDUNDANT, disconnected from entitlements (PROD-02) |
| PayPal | `paypal-payment-integrity` test + CI workflow | UNVERIFIED |
| SMTP (nodemailer) | identity delivery, site mailer | UNVERIFIED; local delivery failures ignored in non-production (SEC-04) |
| WhatsApp | env vars present | Not traced |
| WordPress | plugin + ~110 routes + jobs | UNVERIFIED (needs WP) |
| GitHub / git | `services/git`, developer workspace `GitPanel.tsx` | UNVERIFIED |
| DNS | `node:dns/promises` | Real lookups |
| Google Stitch | `@google/stitch-sdk` | UNVERIFIED |

## 6. Deployment and environments

- `docker-compose.yml`: postgres:15, api (`NODE_ENV: development`), worker (`NODE_ENV: development`), frontend (nginx on 127.0.0.1:5173), `migrate` (`prisma migrate deploy`), minio (`latest`). Ports bound to localhost. The compose file was **not started** in this audit.
- The local developer database runs PostgreSQL 18; compose and CI use PostgreSQL 15 — version skew.
- `backend/Dockerfile` sets `NODE_ENV=production`; `frontend/nginx.conf` sets no security headers (SEC-11).
- No infrastructure-as-code, CDN, TLS termination, secrets manager, or production deployment manifest exists in the repository. Windows-specific bootstrap scripts (`bootstrap.ps1`, `run-dev.*`, `start*.bat`, `diagnose-port-3307.ps1`) target local development.
- `STAGING` is the canonical environment label; `PREVIEW` is legacy (prior decision).

## 7. Confirmed capability vs. placeholder summary

| Confirmed real | Placeholder / fabricated / assumed |
|---|---|
| Versioned document saves; AI changeset review/apply; job queue with leases; migration authority for customer DBs (27 tests); workspace realtime sync (28 tests); CPT CMS (12); lead intake (5); purge (6); RLS helpers (14, scoped) | SSL issuance; custom-domain serving; `/api/hosted` health; performance metrics; CPU/latency metrics; commerce orders; AI credit accounting (`used: 0`) |
