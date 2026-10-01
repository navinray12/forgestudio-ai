# Stitch + Claude implementation and qualification

## Delivered path

Open the editor and select **Design with AI**, or open **AI draft → Open Stitch + Claude designer** on the dashboard. Supply a brief (12–64,000 characters), select generation or an existing-document text/style edit, and generate a proposal. The worker persists plan, project, screen, export and conversion checkpoints. Polling reports actual stage state. Preview uses the native public renderer at desktop/tablet/mobile sizes. Compare the saved website, explicitly Apply, or Discard. Apply uses the document save coordinator and server command transaction; publishing remains separate.

The default maximum is eight pages. Claude plans, Stitch generates a desktop HTML/CSS screen per page, and deterministic conversion resolves responsive CSS into editable containers, headings, text and links. One Claude HTML repair is allowed per page. Stable native IDs are retained for existing-document text/style edits. Selection, page and site scopes are enforced server-side. Large HTML conversion runs in a bounded worker thread with no script evaluation or remote stylesheet loading. A worker thread is a resource boundary, not an OS security sandbox.

This is **not the entire six-milestone feature specification**. In particular:

- Separate Stitch mobile designs, screenshot artifact capture and reviewed pixel-diff baselines are not implemented.
- Images/SVG, rich inline content, external CSS, scripts, forms and unsupported CSS fail conversion rather than silently disappearing. Repair must produce a supported native design. Existing CMS/form services are not yet orchestrated by this workflow; the UI discloses separate setup requirements.
- AI edits support existing text/styles, not insertion/movement, shared-component/token editing, content-only roles, CMS commands or Claude Design imports.
- Call-unit reservations bound admission, not actual dollar cost. Provider billing metering, distributed circuit breakers and provider reconciliation UI remain work.
- Interruptions with uncertain paid outcomes become `RECONCILIATION_REQUIRED`; automatic retry is deliberately blocked. An operator must inspect the provider project before recovery tooling is added. Completed checkpoints are reusable on ordinary safe failures at the same document version.
- Private artifacts are encrypted but do not yet have an automatic artifact-expiry/orphan sweeper. Prompt ciphertext itself has scheduled retention cleanup. Back up the artifact volume and encryption key together; do not rotate/delete the key without a re-encryption plan.
- Apply rehydrates the editor by reloading after acknowledgment. Persisted revisions exist, but coordinated document/CMS undo and full publishing/static-compiler fidelity are not qualified by these tests.

## Configuration and startup

Keep these in root `.env` for Compose, or server environment for native startup; never `frontend/.env` or `VITE_*`:

```dotenv
STITCH_API_KEY=
ANTHROPIC_API_KEY=
AI_CLAUDE_DESIGN_MODEL=
AI_STITCH_MODEL=GEMINI_3_1_PRO
AI_PROMPT_ENCRYPTION_KEY=
AI_PROMPT_RETENTION_HOURS=24
AI_DESIGN_MAX_PAGES=8
AI_DESIGN_DAILY_UNITS=100
AI_ARTIFACT_DIRECTORY=.data/ai-artifacts
```

Select an explicit Claude model enabled for your Anthropic account. `AI_MODEL_PLANNER` is a compatibility fallback for that model name, not a fallback provider. The encryption key must be a stable base64 encoding of 32 random bytes and is not a provider key. Credentials are presence-checked locally; successful provider authorization/model availability requires an opt-in live run. `ANTHROPIC_WORKSPACE_ID` remains supported when required by the account.

`start.bat` / `strt.bat` report missing designer settings without printing values. Docker startup rebuilds API/worker/frontend and runs migrations. Native startup builds the worker first so its isolated converter entry point exists. Keep the worker running. Compose persists encrypted exports in the private `ai-artifacts` volume. The legacy Gemini/OpenAI/Anthropic blueprint action remains independently available; it never substitutes for a selected Stitch workflow.

## HTTP interfaces

All routes require a current tenant session and website access. Writes require `X-Forge-Intent: document-command` and an `Idempotency-Key`; create/retry/apply also require `If-Match: "<website UUID>:document:<version>"`.

| Route | Response |
| --- | --- |
| `POST /api/v1/ai/websites/:id/executions` | `202`, execution ID; body `{workflow:"stitch-claude", operation:"GENERATE_SITE"|"EDIT_DOCUMENT", prompt, scope:{type:"site"|"page"|"selection",pageId?,elementId?}}` |
| `GET /api/v1/ai/executions/:id` | Safe status, stage history, changeset ID and retry availability; no prompts, artifacts or keys |
| `POST /api/v1/ai/executions/:id/cancel` | Durable cancellation and command acknowledgement |
| `POST /api/v1/ai/executions/:id/retry` | New linked execution, original provider/model snapshot, no original overwrite |
| `GET /api/v1/ai/capabilities` | Nonsecret configuration availability and supported limits |
| Existing `/api/v1/ai/changesets/:id[/apply\|/cancel]` | Authorized proposal review and explicit application/discard |

## Migration, compatibility and rollback

`20260930120000_ai_design_pipeline` adds nullable execution metadata, a default-zero call reservation and an execution-stage table. Upgrade with `prisma migrate deploy`, never `db push`. No prior documents or legacy generation contracts are rewritten. The preceding atomic-apply migration remains required.

Back up PostgreSQL and the private artifact volume before upgrading. Verify pending job counts, migration status and API readiness. Do not run old and new workers against the same active design jobs. For an application rollback, stop new execution admission and drain/cancel/reconcile jobs, stop the new worker, retain the additive schema and artifact volume, and run the prior compatible application release. The prior UI does not understand the new asynchronous API. A database rollback is a separately tested backup/PITR restore, never a destructive automatic down migration. If migration lock timeout occurs, resolve long transactions and retry deploy; do not mark failed migrations applied without examining their actual state.

## Reproducible qualification

Disposable database only; never point these fixture writers at customer data. The qualification overlay disables live provider credentials. PostgreSQL listens at 55434, API at 55000 and frontend at 55173. Stop the qualification worker when running fixture job tests so it cannot race their injected handlers.

```powershell
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml config --quiet
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml build migrate api worker frontend
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml up -d postgres migrate api worker frontend
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml ps
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml logs migrate --tail 25
$env:DATABASE_URL='postgresql://forge:forge_local_only@127.0.0.1:55434/forge_hardening'
$env:FORGE_DISPOSABLE_TEST_DB='1'
$env:FORGE_TEST_RUNNING_WORKER='1'
npm --prefix backend run build
# From backend:
npx --no-install tsx --test src/tests/ai-worker-smoke.test.ts
# Stop qualification worker before the rest of the database test suites.
npx --no-install tsx --test src/tests/ai-design.test.ts src/tests/ai-design-integration.test.ts src/tests/ai-changeset-integration.test.ts src/tests/job-leases-integration.test.ts src/tests/ai-prompt-cleanup.test.ts src/tests/ai-site-brief.test.ts src/tests/ai-site-blueprint.test.ts src/tests/ai-site-repair.test.ts
npx --no-install tsx --test src/tests/workspace-integration.test.ts
# From repository root:
node --experimental-vm-modules --test tests/hardening/document-coordinator.test.mjs tests/hardening/design-styles.test.mjs
npm --prefix frontend run build
```

Browser fixture composition: build the backend; set `NODE_ENV=test`, `FORGE_AUTH_MODE=local`, `PORT=55001`, `FRONTEND_URL=http://127.0.0.1:55174`, and an absolute private `FORGE_BROWSER_FIXTURE_PATH`, in addition to the disposable database variables. Run `node dist/tests/fixtures/design-browser-server.js` from backend. Start Vite separately with `VITE_API_URL=http://127.0.0.1:55001` and `npm run dev -- --host 127.0.0.1 --port 55174`. From root run `npm ci`, `npx --no-install playwright install chromium`, then `npx --no-install playwright test tests/browser/design-journey.spec.ts --workers=1 --reporter=line` with the same private fixture-file path. Only the test composition injects deterministic provider ports. Production entry points do not import it.

### Executed evidence, 2026-09-30

- Backend and frontend production builds passed. Targeted new AI UI/coordinator ESLint passed. Frontend build still reports large chunks; repository-wide lint is not certified here.
- After the initial Docker failure, the final native backend rebuild and 29 compiled provider/converter/cleanup/blueprint unit tests still passed. Database tests were temporarily blocked; the approved recovery and fresh rerun below supersede that blocker. Launcher help and PowerShell syntax validation passed; no normal-stack rebuild was attempted.
- All 22 migrations applied to empty `forge_design_bootstrap_20260930`; `prisma migrate status` reported up to date. The new migration also applied to the existing `forge_hardening` fixture database.
- 57 targeted AI/worker/provider/converter tests passed after correcting a shared-cutoff fixture collision. 30 workspace/document tests and 10 frontend coordinator/style tests passed.
- Chromium journey passed: generation, desktop/mobile native preview, Apply, manual edit, AI text edit, Discard and persistence after reload. An initial browser test failed because its locator matched the old heading after editing it; using the focused keyboard target fixed the test.
- First Compose image build passed; migrate exited successfully; PostgreSQL was healthy; API/worker/frontend ran; health, readiness and login probes returned HTTP 200. Later, Docker Desktop became unresponsive during a final parallel rebuild and its container API returned HTTP 500. The overlapping compiled integration rerun failed with database connection timeouts. That rebuild was cancelled, not reported as passing. Docker Desktop was subsequently restarted with explicit user approval; see the successful recovery below.
- The smoke probe initially expected a persisted result/claim count that this legacy job schema does not record. The corrected probe checks started/completed timestamps and released fencing token; it passed against the rebuilt running container worker after recovery.
- No live Stitch/Claude acceptance run: this local environment lacks `STITCH_API_KEY` and `AI_PROMPT_ENCRYPTION_KEY`. Existing Anthropic key values were not displayed or changed. Browser and backend results above are fixture-provider evidence, not provider-quality or visual-reference certification.

## Next dependency-safe implementation prompt

Continue from the real asynchronous design workflow, preserving dirty worktree changes. First configure server-side Stitch/Claude/vault credentials and perform an opt-in live one-page acceptance run; do not silently switch providers. Capture the real export privately, extend deterministic conversion only where native renderer support exists, and measure visual fidelity at 320/390/768/1440. Add authorized artifact retrieval, screenshots, explicit mobile design generation and reconciliation tooling before promising exact design parity. Then implement shared authorized CMS/form commands and atomically apply their versioned proposals with the document; never expose mock CMS or form success. Add per-stage actual usage/cost accounting, safe provider health, artifact retention, scoped structural edits and coordinated revision restore. Keep schema additive, update README/startup/Compose/runbooks, run all existing AI/worker/document/browser contracts plus new negative cases, and report exact results and remaining limitations.

### Approved Docker recovery and fresh verification

The user approved restarting Docker Desktop. The ordinary `docker desktop restart` stalled and was cancelled. Recovery used the following scoped commands; no factory reset, prune, volume deletion, or Ubuntu WSL termination was performed:

```powershell
Get-Process -Name 'Docker Desktop','com.docker.backend' -ErrorAction SilentlyContinue | Stop-Process -Force
wsl --terminate docker-desktop
Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe' -WindowStyle Hidden
docker desktop start --timeout 60
docker info --format '{{.ServerVersion}}'
```

Docker engine `29.6.2` became available. Other containers with restart policies resumed; only the Forge qualification stack was explicitly rebuilt/started. Sequential commands below all exited successfully:

```powershell
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml config --quiet
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml --parallel 1 build migrate
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml up -d postgres
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml up -d migrate
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml --parallel 1 build api
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml --parallel 1 build worker
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml --parallel 1 build frontend
```

With the qualification worker stopped, from `backend` using the disposable database variables documented above:

```powershell
node --test --test-concurrency=1 dist/tests/ai-design.test.js dist/tests/ai-design-integration.test.js dist/tests/ai-changeset-integration.test.js dist/tests/job-leases-integration.test.js dist/tests/ai-prompt-cleanup.test.js dist/tests/ai-site-brief.test.js dist/tests/ai-site-blueprint.test.js dist/tests/ai-site-repair.test.js
node --test dist/tests/workspace-integration.test.js
```

Results: **57/57** and **30/30**, respectively. From root, `node --experimental-vm-modules --test tests/hardening/document-coordinator.test.mjs tests/hardening/design-styles.test.mjs` passed **10/10**. These are fresh reruns after recovery, not reused earlier results.

Then `docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml up -d api worker frontend` passed. With `FORGE_TEST_RUNNING_WORKER=1`, `node --test dist/tests/ai-worker-smoke.test.js` from backend passed **1/1**, proving the real running worker claimed and completed a queued job.

Final `docker compose ... ps -a`: PostgreSQL healthy, migrate exited **0**, API/worker/frontend running. `Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 -Uri <URL>` returned **200** for `http://127.0.0.1:55000/api/v1/health`, `http://127.0.0.1:55000/api/ready`, and `http://127.0.0.1:55173/login`. Container builds still report two moderate dependency advisories and large frontend chunks. Browser/live-provider acceptance was not rerun during this recovery. Keep future builds sequential on this shared machine; the remaining live-provider and feature work listed above is unchanged.
