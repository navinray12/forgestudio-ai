# ForgeStudio

## Website creation options and local test access

In **Personal websites**, click **Create New Website** or **New Website** to choose
**AI site builder**, **Template**, or **Blank site**. Enter a name next. AI opens
the existing Stitch/Claude proposal panel, Template opens the existing template
library (insert a template, then save), and Blank opens the visual editor.
Choosing an option does not invoke a paid provider or publish a site. Workspace
creation retains its separate authorized workspace flow.

The isolated qualification app runs at `http://127.0.0.1:55173/login`, API at
`http://127.0.0.1:55000`. It is not the normal `start.bat` database. Operator-created
ADMIN and SUPER_ADMIN accounts open `/admin` and `/super-admin`; use a USER account
for `/dashboard` and the website chooser. Credentials are generated randomly,
never committed or automatically recreated by startup. On this local machine,
the handoff is in the Git-ignored `.data/local-test-accounts.json` file.

After submitting email/password, retrieve the development-only OTP from the
repository root in PowerShell (check the email matches your account):

```powershell
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml exec -T api cat /tmp/forge-local-otp.json
```

Enter the code in the same browser. Codes are single-use; wait at least 60 seconds
before requesting another. No passwords or OTPs are returned by the public API.
Platform control remains separately protected by recent phishing-resistant OIDC
authentication; local SUPER_ADMIN credentials do not bypass that requirement.
Live AI providers are intentionally disabled in this qualification profile.

To provision additional disposable accounts, in `backend` set `DATABASE_URL` to
`postgresql://forge:forge_local_only@127.0.0.1:55434/forge_hardening`,
`NODE_ENV=development`, `FORGE_AUTH_MODE=local`, and `FORGE_DISPOSABLE_TEST_DB=1`.
Run `npm run db:seed`, then `npm run db:provision-local-admin-test` (admin pair), or
`npm run db:provision-local-admin-test -- --builder-only` (USER). These commands
refuse other environments, never reset existing accounts, and provide a 30-day
Agency subscription fixture—not real payment/provider entitlements. Protect the
one-time credential output. Startup scripts deliberately do not provision admins.

Verification for this slice (2026-09-30):

- `frontend`: `$env:VITE_API_URL='http://127.0.0.1:55000'; npm run build` — passed (existing large-chunk warning).
- `frontend`: `npx eslint src/pages/dashboard/components/WebsiteStartChooser.tsx` — passed. Whole-repository lint was not rerun.
- `backend`: with the qualification `DATABASE_URL`, `npm run build` — passed. The first invocation without `DATABASE_URL` correctly failed configuration validation.
- `backend`: `npm run db:seed` — passed and exits cleanly after closing the PostgreSQL pool.
- `backend`: provisioning commands above — created new accounts; a production-mode invocation exited 1 as required, without provisioning.
- Root: `docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml --parallel 1 build frontend`, then `up -d --no-deps frontend` with the same Compose arguments — passed.
- Root: `node --experimental-vm-modules --test tests/hardening/document-coordinator.test.mjs tests/hardening/design-styles.test.mjs` — 10 passed.
- Root: set `FORGE_TEST_LOCAL_ACCOUNTS=1` and `FORGE_LOCAL_CREDENTIALS_FILE` to the absolute private credentials JSON path, then `npx playwright test tests/browser/website-start.spec.ts --workers=1 --reporter=line` — final run: 3 passed. Checks real password/OTP login, ADMIN stats, SUPER_ADMIN step-up rejection, chooser keyboard dismissal, mobile/desktop layouts, blank editor, template insertion/persistence and AI configuration state. Earlier runs caught an icon-sensitive test locator and hit existing OTP/rate limits; no authentication rules were relaxed. Only the disposable API was restarted before the final run. Allow the normal cooldown/rate window before repeating logins.
- Compose `config --quiet` — passed; HTTP `/api/v1/health`, `/api/ready`, and frontend `/login` — all 200.

No live AI generation or publishing qualification is claimed by these chooser tests.

## Stitch + Claude designer

The editor now has **Design with AI**; the dashboard AI dialog links to the same designer. It queues durable generation, previews native editable pages, and requires explicit **Apply changes**. You can manually edit afterward or request scoped AI text/style edits. Stale proposals cannot overwrite newer saves; Discard leaves the site unchanged. The legacy blueprint generator stays separate.

Configure backend-only `STITCH_API_KEY`, `ANTHROPIC_API_KEY`, `AI_CLAUDE_DESIGN_MODEL`, and a stable 32-byte base64 `AI_PROMPT_ENCRYPTION_KEY`, then run `start.bat` to rebuild/start the API, worker and frontend. Existing `.env` secrets are not modified by the launcher. Optional limits are `AI_DESIGN_MAX_PAGES` (1–8), `AI_DESIGN_DAILY_UNITS` (reserved provider calls, not dollars), and `AI_PROMPT_RETENTION_HOURS` (default 24). The worker persists encrypted exports in a private volume; it must remain running for progress.

**Current scope:** native multi-page layouts and existing-element text/style edits. Automatic CMS/forms, image import, separate Stitch mobile screens, Claude Design imports and complete visual/publishing parity are still incomplete; unsupported exports fail safely. A Chromium fixture-provider journey passed through preview, Apply, manual edit, AI edit and Discard. Live Stitch/Claude acceptance is not yet verified. See [configuration, APIs, exact verification, migration/rollback notes and remaining work](docs/implementation/stitch-claude-workflow.md).

Local recovery verification (2026-09-30): after an approved Docker Desktop restart, all four qualification images rebuilt sequentially, migration deploy exited successfully with all 22 migrations applied, and 57 AI/worker tests, 30 workspace/document tests, 10 frontend tests and the running-worker smoke check passed. Health/readiness/login probes returned HTTP 200. The isolated test UI is at `http://127.0.0.1:55173/login`; its database is separate from the normal app and live provider keys are intentionally disabled. No volumes were deleted. Live Stitch/Claude qualification and the feature limitations above remain open.

## Start on Windows

Run `start.bat` (or the `strt.bat` alias). The default `start.bat` chooses Docker
when Docker Desktop is available; otherwise it tries native Node.js mode. Use
`start.bat menu` for an interactive choice, `start.bat docker gemini` or
`start.bat docker anthropic` to select a provider for this launch,
`start.bat docker gemini no-build` to reuse existing images, and
`start.bat status` for Compose and HTTP readiness. Provider overrides do not
modify `.env`; without an override, its `AI_SITE_PROVIDER` is used. A normal
Docker start rebuilds changed images, applies migrations, seeds plans, and
checks API/frontend readiness. Use `no-build` only when the current images
already include your code changes.

Native mode validates Node.js 22+, dependencies, and a PostgreSQL
`DATABASE_URL` on localhost/127.0.0.1 in root `.env` or `backend/.env`. Root
`.env` supplies AI keys in native mode too; API, worker, and Vite run as hidden
local processes with timestamped logs under `logs/native-start-*`. Native mode
writes development-only sign-in codes to
`%TEMP%\forge-local-otp.json`; no SMTP account is required. Configure AI keys
in root `.env` for Compose or `backend/.env` for native startup.
The browser never receives provider credentials.
The dashboard's AI website draft action proposes up to eight editable pages and
ten sections per page. A draft is saved as a changeset; review its page summary
and click **Apply draft** before the website document changes. The generated
draft now includes editable navigation, a hero, varied content sections, calls
to action, and a footer. Use **Use sample brief** in the AI dialog for an
accounting academy example, then replace its name, audience, content, and
visual direction with your own requirements before generating. The generated
brief can be up to 64,000 characters; the dialog shows the count and a safe
error for rejected briefs or provider failures. If the provider's first draft
fails schema validation, the API makes one bounded format-repair attempt before
returning an error; neither attempt edits the website until you apply the
changeset. The generated
widgets are limited to container, heading, text, and button. A blog page is
only a page layout: AI does not yet create CMS collections, entries, assets, or
publish the site. After applying, open the visual editor to make manual edits.

For Compose, set `AI_SITE_PROVIDER=openai` and `OPENAI_API_KEY` in the root
`.env`, or `AI_SITE_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`. For Gemini,
set `GEMINI_API_KEY` and `AI_SITE_PROVIDER=gemini`. If the provider remains
`openai` but `OPENAI_API_KEY` is empty, a configured `GEMINI_API_KEY` is used
automatically for AI website drafts. This is a **missing-key fallback**, not a
silent failover after an OpenAI timeout, rate limit, or invalid model output.
If both keys are set, OpenAI remains selected unless `AI_SITE_PROVIDER=gemini`.
`AI_MODEL_GEMINI` defaults to `gemini-3.5-flash-lite` (validated with a live
site-blueprint request on the local test key) and is separate from
`AI_MODEL_PLANNER`, which overrides only the OpenAI/Anthropic model. Native
mode uses `backend/.env`. Secrets stay server-side
and the UI cannot change them. Do not put keys in `frontend/.env` or a browser
request. No live AI generation is available without a configured provider key.
The app uses the OpenAI Responses API, Anthropic Messages API, or Gemini
generateContent API and validates
their structured output before constructing editor elements. Provider errors
are intentionally not returned to the browser. Prompt retry requires
`AI_PROMPT_ENCRYPTION_KEY` (base64-encoded 32-byte key); without it prompts are
not retained. Production qualification still requires live provider tests,
CMS-generation support, end-to-end publishing verification, and broader
security/load testing.
Latest local qualification: the Docker stack rebuilt and `start.bat docker
gemini` plus `start.bat docker gemini no-build` completed; PostgreSQL, API,
worker, and frontend were running; `/api/v1/health`, `/api/ready`, and
`/login` returned HTTP 200. A live provider-only Gemini site-blueprint probe
validated two editable pages on `gemini-3.5-flash-lite`; the previously
configured `gemini-3.8-flash` returned HTTP 503 from Google. The authenticated
dashboard generate/apply journey has **not** been replayed in this
qualification. This test key's Anthropic request returned HTTP 400 mentioning
workspace selection; configure `ANTHROPIC_WORKSPACE_ID` from the Anthropic
Console before selecting that provider. Never put provider keys in the browser.
For an opt-in live provider-only test (may incur usage), run:
`$env:DOTENV_CONFIG_PATH=(Resolve-Path .env).Path; npm --prefix backend run ai:check -- gemini`.

Use the explicit IPv4 address above: another local development server may own
`localhost` on IPv6 while Docker owns the IPv4 port. Compose binds API and
frontend to loopback only; its nginx frontend supports direct `/login` and
other client-side routes.

### Disposable local Agency test account

After the Docker stack is up, run these commands once in PowerShell:

```powershell
docker compose run --rm migrate npm run db:seed
docker compose run --rm -e FORGE_DISPOSABLE_TEST_DB=1 -e FORGE_AUTH_MODE=local -e NODE_ENV=development migrate npm run db:provision-local-test
```

The second command prints a randomly generated password once. Sign in at
`http://127.0.0.1:5173/login` as `agency-tester@example.test`; after entering
the password, obtain the one-time code with:

```powershell
docker compose exec -T api cat /tmp/forge-local-otp.json
```

This is a **local, disposable fixture**, not a paid subscription or verified
provider entitlement. The Agency plan and organization entitlement expire after
30 days; the script refuses to overwrite an existing account. The local code
file is never exposed by HTTP or logged. Production mode forbids local code
delivery and local password login. Do not use this account or Compose's default
database credentials on any public deployment.

For a fresh test database only, `docker compose down -v` removes all local
PostgreSQL data; then run `docker compose up -d --build` and provision again.

> Multi-tenant SaaS visual website builder with workspace administration, managed identity, version-aware editing, realtime presence, dynamic content, WordPress/SFTP publishing, and production-hardening pipelines.

## Status

ForgeStudio contains substantial working product functionality and an active production-hardening program.

**Implemented and qualified:** managed identity boundaries, session revocation, workspace lifecycle/isolation, version-aware editor saves, WebSocket authorization, production builds, PostgreSQL/HTTP contracts, regression tests and browser journeys.

**Still being completed for production:** repository-wide tenant RLS, full organization billing, universal durable workers, production object-storage quarantine/scanning, the Platform Control Center, AWS/IaC deployment, restore exercises and contracted load qualification.

See `docs/architecture/CURRENT_PIPELINE.md` for the detailed request/data/deployment pipeline.

## Implementation matrix

| Area | Current state |
| --- | --- |
| Visual editor | Implemented: drag/drop editing, responsive tooling, widgets, Monaco code editing and revisions |
| Editor concurrency | Implemented: document versions, `If-Match`, idempotency, stale-save rejection and conflict-aware browser behavior |
| Organizations/workspaces | Implemented foundation/lifecycle: membership boundaries, settings, roles, eligible-member invitations, archive/restore and ownership administration |
| Managed authentication | Implemented: OIDC authorization code flow, state, nonce, PKCE S256, signed-token checks and issuer+subject binding |
| Local/test authentication | Browser-bound, expiring, single-use challenges with attempt/rate controls |
| Sessions | Active-account checks, revocation/security versioning, session listing/revocation |
| Authorization | Server-side RBAC/capability enforcement with fail-closed hardening on reviewed paths |
| Realtime presence | Authenticated WebSockets, origin/resource checks, limits and authorization refresh/revocation |
| PostgreSQL | Prisma/PostgreSQL source of truth, committed migrations and selected RLS-backed qualification |
| WordPress | Connector plugin and publishing/synchronization functionality |
| SFTP/static publishing | Existing functionality; complete durable reconciliation migration remains in progress |
| Billing | Unsafe unverified paid activation blocked; full provider-backed organization lifecycle remains in progress |
| CI | Builds, hardening tests, PostgreSQL/HTTP contracts, Part B regression and identity qualification |

## SaaS ownership model

```text
User identity
  -> Organization membership
     -> Organization / tenant
        -> Workspace membership
           -> Workspace
              -> Website
                 -> Editor document / revisions
                 -> Content / media
                 -> Deployments / integrations
```

Organization is the business tenant. Workspace membership is an additional authorization boundary. Organization membership alone does not grant access to every restricted workspace or website. Backend authorization is authoritative.

## Request pipeline

```text
React/Vite Studio
  -> API request
  -> browser-origin/security admission where applicable
  -> authenticated session
  -> active-account + session-security checks
  -> organization/workspace context
  -> resource authorization
  -> validation
  -> application/service operation
  -> PostgreSQL transaction
       -> business state
       -> audit where mandatory
       -> idempotency/command state where applicable
       -> outbox intent where applicable
  -> stable HTTP result
```

## Identity and sessions

Production identity is designed around managed OpenID Connect:

```text
Browser
  -> OIDC authorization
  -> state + nonce + PKCE S256
  -> identity provider
  -> callback
  -> issuer/audience/signature/expiry/nonce validation
  -> issuer + subject binding
  -> active Forge account
  -> Forge browser session
```

Key rules:

- email equality alone does not prove external identity ownership;
- production OIDC configuration is explicit;
- privileged operations can require stronger authentication assurance;
- session revocation is server-enforced;
- local password/verification flows are for approved non-production/test modes;
- managed-identity cutover has a preflight to prevent account lockout.

Configuration template: `backend/identity.env.example`.

## Workspaces

Implemented/hardened workspace behavior includes creation, switching, scoped dashboards, settings, member/role administration, owner protection, controlled ownership changes, eligible in-organization invitations, archive/restore, read-only archived state, workspace-scoped websites, sibling-workspace isolation, command idempotency and transactional audit/outbox intent on reviewed paths.

Frontend:

```text
frontend/src/features/workspaces/
  WorkspaceSwitcher.tsx
  WorkspaceDashboardView.tsx
  WorkspaceAdministration.tsx
  WorkspaceInvitationInbox.tsx
  workspace-api.ts
```

Backend entry points include:

```text
backend/src/routes/tenant-workspace.routes.ts
backend/src/routes/workspace-lifecycle.routes.ts
backend/src/services/workspaces/
```

## Editor consistency

Editor load requires current server authorization before document state is accepted.

Reviewed saves use:

```http
If-Match: <expected-document-version>
Idempotency-Key: <logical-command-id>
X-Forge-Intent: document-command
```

A stale editor receives a conflict/precondition response instead of overwriting newer content. Browser qualification covers stale-tab behavior.

## Realtime presence

The WebSocket boundary includes authenticated admission, approved browser origins, website/workspace authorization, server-derived identity, connection/payload/buffer limits and authorization refresh/revocation.

This is a qualified security foundation, **not** a claim of horizontally distributed realtime capacity.

## Commercial SaaS

Historical behavior that could treat plan selection as proof of payment has been hardened. The production contract is:

```text
organization plan selection
  -> trusted checkout
  -> payment provider
  -> verified provider event
  -> durable event inbox
  -> idempotent reconciliation
  -> organization subscription
  -> entitlements
  -> seats / quotas / usage
```

Complete provider checkout, signed webhooks, reconciliation, seats and usage reservations remain a dedicated implementation stream.

## Publishing, files and integrations

ForgeStudio contains WordPress connector and remote/static publishing functionality. Publishing is being migrated toward immutable revisions, durable deployment records/jobs, verification and explicit reconciliation of uncertain remote outcomes.

Production file handling is being migrated toward:

```text
authorized upload
  -> tenant/workspace object identity
  -> quarantine
  -> size/type/signature validation
  -> malware/archive checks
  -> immutable approved object
  -> processing
  -> authorized download
```

Complete production S3 quarantine/scanning coverage remains in progress.

## Architecture

```mermaid
flowchart TD
    User[User / Designer] -->|HTTPS| Studio[React 19 + Vite]
    Studio -->|REST| API[Express 5 API]
    Studio -->|WebSocket| Presence[Authenticated Presence]
    API --> Identity[Identity + Sessions]
    API --> Access[Organization + Workspace Authorization]
    Identity --> DB[(PostgreSQL)]
    Access --> DB
    API --> Editor[Website + Document Services]
    Editor --> DB
    API --> WP[WordPress Integration]
    API --> SFTP[SFTP / Static Deployment]
    WP --> WordPress[Remote WordPress]
    SFTP --> Remote[Remote Host]
```

Target production topology:

```text
Route53 -> CloudFront -> WAF -> ALB
  -> private API/realtime/integration/worker workloads
  -> managed PostgreSQL
  -> S3
  -> durable queues
  -> optional Redis/search/AI adapters
  -> Secrets Manager/KMS
  -> OpenTelemetry-compatible observability
```

The codebase is being migrated incrementally toward explicit modules, ports/adapters, durable execution and a separately secured Platform Control Center.

## Technology stack

| Layer | Current package |
| --- | --- |
| Frontend | React `^19.2.8` |
| Build | Vite `^8.2.0` |
| Frontend TypeScript | `~6.0.2` |
| Styling | Tailwind CSS `^4.3.3` |
| Editor | Monaco `^0.56.0` |
| Backend | Express `^5.2.1` |
| Backend TypeScript | `^7.0.2` |
| ORM | Prisma `^7.10.0` |
| Database | PostgreSQL / `pg ^8.23.0` |
| OIDC | `openid-client 6.8.8` |
| Password hashing | Argon2 `^0.45.1` |
| Validation | Zod `^4.4.3` |
| Realtime | `ws ^8.21.3` |
| Mail | Nodemailer `9.1.1` |
| Images | Sharp `^0.35.4` |
| SFTP | `ssh2-sftp-client ^12.1.1` |

## Repository structure

```text
forge/
├── frontend/src/
│   ├── components/
│   ├── context/
│   ├── features/identity/
│   ├── features/workspaces/
│   ├── pages/auth/
│   ├── pages/editor/
│   └── services/
├── backend/
│   ├── prisma/{schema.prisma,migrations/}
│   ├── src/adapters/
│   ├── src/middlewares/
│   ├── src/modules/identity/
│   ├── src/platform/ports/
│   ├── src/routes/
│   ├── src/services/
│   ├── src/tests/
│   └── identity.env.example
├── wordpress-plugin/
├── tests/{api,browser,database,hardening,performance,recovery,security,wordpress}/
├── docs/architecture/CURRENT_PIPELINE.md
├── docs/implementation/
├── .github/workflows/
└── README.md
```

## Recent hardening migrations

| Migration | Purpose |
| --- | --- |
| `20260928090000_workspace_command_journal` | Workspace command/idempotency foundations |
| `20260928122000_workspace_lifecycle` | Workspace lifecycle/settings/member hardening |
| `20260928140000_document_concurrency` | Version-aware document saves |
| `20260928170000_identity_boundary` | Managed identity/session-security metadata |

Production schema changes use committed migrations:

```bash
npm run db:migrate --prefix backend
```

This runs `prisma migrate deploy`. `db:push` is for disposable development/test databases and CI fixtures, not production migration.

## Local development

Prerequisites: Node.js 22.x recommended, compatible npm, PostgreSQL 15+, Git, and WordPress/PHP only when exercising the connector.

```bash
git clone https://github.com/ooarchitect92/forge.git
cd forge

npm ci
npm ci --prefix backend
npm ci --prefix frontend
```

Configure `DATABASE_URL`.

Disposable local database:

```bash
npm run db:generate --prefix backend
npm run db:push --prefix backend
```

Migration-driven environment:

```bash
npm run db:migrate --prefix backend
```

Managed authentication starts from `backend/identity.env.example`. Inject `OIDC_CLIENT_SECRET` from an approved secret store; never commit it.

Run:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

Typical local endpoints are backend `http://localhost:5000` and frontend `http://localhost:5173`.

## Build and test

Production builds:

```bash
npm run build --prefix backend
npm run build --prefix frontend
```

Root regression commands:

```bash
npm run test:part-b
npm run test:api
npm run test:db
npm run test:wp
npm run test:security
npm run test:performance
npm run test:recovery
```

## CI and qualification

Current workflows include:

```text
build-validation.yml
hardening-unit.yml
workspace-integration.yml
part-b-regression.yml
identity-boundary.yml
qualify-saas-increment.yml
dependency-candidate.yml
identity-toolchain.yml
postgres-toolchain.yml
toolchain-snapshot.yml
```

The reviewed identity/SaaS qualification pipeline covers locked installs, frontend/backend production builds, source/architecture checks, signed OIDC fixtures, real local TLS SMTP contracts, PostgreSQL workspace/document contracts, identity migration/negative HTTP contracts, WebSocket authorization, compiled workspace/editor browser journeys, identity browser journeys and dependency release gates.

A failed run remains failure evidence; it is not rewritten as a pass.

## Security principles

- server-side authorization on protected actions;
- organization/workspace/resource scope validation;
- fail-closed security decisions;
- no runtime schema repair from HTTP handlers;
- no committed production secrets;
- OIDC issuer+subject identity binding;
- revocable sessions;
- browser-origin protection where required;
- versioned/idempotent sensitive commands;
- bounded WebSocket admission/payloads;
- controlled external destinations;
- mandatory audit for sensitive reviewed mutations;
- versioned production migrations.

## Remaining production-readiness work

### Earlier foundation qualification (2026-09-30)

This is the earlier foundation checkpoint. See the **Stitch + Claude designer** section above and its linked report for the subsequent asynchronous workflow and browser qualification.

Milestone 1 is **partial**, not a completed Stitch/Claude website builder. AI approval now commits the document, revision, changeset status, acknowledgement, audit and outbox together. Apply retries preserve their idempotency key in the open assistant; backend replays reauthorize the actor. Retry keeps the original provider/model. Worker job claims and lease fencing are repaired, and expired retained prompts are cleaned in bounded database batches.

Apply `npm run db:migrate --prefix backend` before using the updated API. `start.bat docker` (or the `strt.bat` alias) builds and migrates normally; the launcher now validates prompt-retention settings. Backend-only configuration: `AI_PROMPT_ENCRYPTION_KEY` is a base64-encoded 32-byte key, `AI_PROMPT_RETENTION_HOURS` defaults to 24, and `AI_PROMPT_CLEANUP_INTERVAL_MS` defaults to 60000. Keep the worker running for expiry cleanup. No API keys belong in frontend settings.

Verification: 39 targeted AI/worker tests and 30 workspace/document tests passed on disposable migrated PostgreSQL; backend/frontend builds and changed AI UI lint passed. All 21 migrations passed from empty, and the new additive migration passed on existing fixtures. Full UI visual fidelity, live Stitch/Claude, CMS/forms generation and complete browser acceptance are **not yet qualified**.

For an isolated local qualification stack, use `docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml up -d --build` (Compose v2.24.4+). It uses API 55000, frontend 55173 and PostgreSQL 55434, disables live provider keys and does not reuse the normal app volume. Never use fixture credentials for deployment.

See [implementation evidence, migration/rollback notes and the next implementation prompt](docs/implementation/ai-editor-foundation-20260930.md). Keep additive schema when rolling back compatible application code; never perform an automatic destructive database downgrade. The legacy revision-restore path and asynchronous AI stage dispatch still require work before the new pipeline is enabled.

1. **Tenant isolation:** legacy ownership backfill and forced RLS across all applicable tables/execution paths.
2. **Commercial SaaS:** organization checkout, verified webhooks, reconciliation, seats and usage reservations.
3. **Durable execution:** production outbox dispatch, queues, bounded workers, DLQ/replay and reconciliation.
4. **Object storage:** S3 authorization, quarantine/scanning and authorized downloads.
5. **Integrations:** complete credential governance and egress/SSRF controls.
6. **Control plane:** capability registry, governed switches and separately secured Platform Control Center.
7. **Frontend:** continued editor decomposition, capability consistency and broader accessibility/browser qualification.
8. **Operations:** IaC/AWS provisioning, secret stores, observability/alerts, restore exercises, failure tests and declared load qualification.

## Documentation

- `docs/architecture/CURRENT_PIPELINE.md` — end-to-end request, data, CI/CD, deployment and recovery pipeline.
- `docs/implementation/` — incremental hardening records, migration notes and validation evidence.
- `docs/implementation/14-identity-boundary.md` — managed identity implementation.
- `docs/implementation/identity-threat-model.md` — identity threat model.

## Production release rule

A successful build is necessary but not sufficient. A capability is production-ready only when its authorization/tenant boundaries, durable behavior, migrations, failure/degraded behavior, telemetry, recovery path and reproducible acceptance evidence are complete for the declared deployment profile.

## License

Proprietary software. All rights reserved.
