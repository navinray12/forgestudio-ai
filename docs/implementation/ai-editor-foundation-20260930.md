# Prompt-to-editor delivery: atomic approval and worker prerequisites

Status: **Milestone 1, partially implemented**. This is not the completed Stitch/Claude pipeline.

## Changes delivered

- `services/websites/save-document.ts`: reusable transactional authorization and internal AI provenance. Approval uses the same document policy as manual saves. Website update, AI_APPLY revision, changeset transition, minimal acknowledgement, command journal, audit and workspace outbox are one serializable commit. A failed audit rolls everything back.
- `modules/ai/site-generation.service.ts`: replay reaches the journal before checking mutable changeset state; reauthorization still runs first. Cancellation is a journaled command and races safely against approval. Reads compare website/workspace/organization ownership. Generation/retry enforce design permission in the service, not just the route. Retry preserves the stored provider/model.
- `AiChangeset`: nullable `appliedRevisionId` and `applyAcknowledgement`; expiry index on `AiExecution`. No prompt, document or provider response is written to command audit summaries.
- `AiSiteAssistant`: preserves the apply idempotency key for retries while the proposal modal remains mounted. Permission/state/unknown-outcome messages are safe. This is still the dashboard assistant, not an editor preview panel.
- Worker: fixed job-claim SQL placeholders; normal polling claims only registered job types; non-overlapping ticks; 30-second fenced leases renewed every 10 seconds; fenced completion/failure; atomic dead-letter records; safe failure codes. Expired leases become `FAILED / JOB_OUTCOME_UNKNOWN` with a retained review record, not an automatic external retry. Domain-level provider reconciliation is still required before an operator replays one.
- Prompt cleanup: runs at worker startup and every `AI_PROMPT_CLEANUP_INTERVAL_MS` (default 60000, range 1000–3600000). One batch contains at most 250 expired ciphertexts; cleanup uses row locks and SKIP LOCKED. Database expiry timestamps survive restart. No overlapping sweeps; shutdown waits for the active sweep. Cleanup does not need the encryption key.
- Startup scripts validate retention key length, retention hours and cleanup interval without displaying secrets. Empty retention key continues to disable stored-brief retries on the legacy synchronous generator.
- New AI/worker tests and CI workflow use migrated PostgreSQL, not `db push`. Existing workspace test fixtures now recognize migration-ledger entries instead of destructively replaying installed indexes/triggers.

## Migration: 20260930100000_ai_apply_acknowledgement

Upgrade: deploy with `npm run db:migrate --prefix backend` before starting the new API. Nullable columns preserve old changesets; the new index supports cleanup. The migration has a five-second lock timeout and a single transaction. On a large production table, schedule the index build in a reviewed maintenance window.

Backfill: none required. Historical APPLIED changesets retain null linkage; do not fabricate their original acknowledgements. New approvals fill linkage and acknowledgement atomically.

Compatibility: existing generation/read/apply/cancel URLs remain unchanged. New response fields are additive. Old application code can ignore these database columns, but reverting to the old approval code reintroduces the non-atomic apply bug; do not call that a safe production rollback.

Rollback/restore: leave additive columns and index in place for an application rollback. Disable AI writes operationally if rolling back to a version without atomic approval. No automatic DROP COLUMN or data downgrade. For database recovery, restore a verified backup/PITR snapshot into a separate instance, qualify it, and perform a reviewed cutover. No restore drill was executed in this increment.

Verification: all 20 previous migrations applied to an empty isolated database, then this migration applied to that database after creating AI fixtures. All 21 migrations also applied from empty in the separate Compose qualification project. Check `prisma migrate status`, schema columns/index, atomic approval contracts and normal document saves after upgrade.

## Executed verification (2026-09-30)

Commands below use fixture-only credentials. Do not point these suites at real data.

Initial isolated database:

```powershell
docker run -d --name forge-ai-qualification-20260930 -e POSTGRES_USER=forge -e POSTGRES_PASSWORD=forge_test_only -e POSTGRES_DB=forge_hardening -p 127.0.0.1:55433:5432 postgres:15-alpine
cd backend
$env:DATABASE_URL='postgresql://forge:forge_test_only@127.0.0.1:55433/forge_hardening'
npm run db:migrate
npm run build
```

Results: migration chain passed; backend build passed. After adding the migration, `npm run db:migrate` successfully upgraded the existing fixture database.

Fresh Compose qualification (repository root):

```powershell
docker compose config --quiet
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml config --quiet
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml build api worker frontend migrate
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml up -d postgres migrate
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml logs migrate --tail 100
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml ps --all
```

Results: both configs valid; all four images built; PostgreSQL healthy; migration container exited 0 after all 21 migrations. API/worker/migrate images were rebuilt once more after the final authorization and test-fixture changes.

Targeted tests (backend directory):

```powershell
$env:DATABASE_URL='postgresql://forge:forge_local_only@127.0.0.1:55434/forge_hardening'
$env:FORGE_DISPOSABLE_TEST_DB='1'
npm run build
node --test dist/tests/ai-changeset-integration.test.js dist/tests/job-leases-integration.test.js dist/tests/ai-prompt-cleanup.test.js dist/tests/ai-site-brief.test.js dist/tests/ai-site-blueprint.test.js dist/tests/ai-site-repair.test.js
node --test dist/tests/workspace-integration.test.js
```

Final results: **39/39 AI/worker tests; 30/30 workspace/document tests**. Provider tests use deterministic HTTP fixtures, never paid/live providers. Lease-interruption coverage expires persisted leases; it is not a full process-kill/chaos exercise. A pg-client concurrent-query deprecation warning remains and needs separate adapter/toolchain qualification before a pg major upgrade.

Initial failures, retained as evidence:

- Test compilation inferred a UUID template-literal type for a free-text fixture argument; corrected with an explicit string annotation.
- The old workspace suite attempted to replay a migration over a migrated schema (`workspaces_tenant_identity already exists`). The fixture setup now recognizes migration history; all original contract assertions remain.
- Host/container clock differences made some just-enqueued jobs not yet due. Job tests now explicitly enqueue past-due fixtures rather than depending on synchronized clocks or adding sleeps.

Frontend (frontend directory): `npm run build` passed; `npx eslint src/features/ai/AiSiteAssistant.tsx` passed. Vite reports oversized chunks. Docker frontend installation reported two dependency advisories (one low, one moderate); they were not automatically force-upgraded. Full frontend lint was not run or claimed green.

Launcher: `cmd /d /c .\start.bat help` and `cmd /d /c .\strt.bat status` passed. Status probes on the original app returned ready for API health, API readiness and frontend login. Setting `AI_PROMPT_CLEANUP_INTERVAL_MS=0` then running `start.bat native` was correctly rejected with exit 1 before launching anything. A successful native full startup was not tested. The original running app was not redeployed by these checks.

Updated-image runtime probes:

```powershell
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml up -d api worker frontend
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml ps --all
foreach ($url in @('http://127.0.0.1:55000/api/v1/health','http://127.0.0.1:55000/api/ready','http://127.0.0.1:55173/login')) {
  (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10).StatusCode
}
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml logs worker --tail 30
```

Results: all three HTTP probes returned 200; API, frontend and worker were running; PostgreSQL was healthy; migration exited 0. Worker logs contained no tick/cleanup failures during this observation.

Actual worker restart/cleanup probe: stopped only the qualification worker, inserted one expired fixture ciphertext (`promptVersion=cleanup-probe-20260930`) in its disposable database, and restarted that worker. Before restart: one retained ciphertext. After startup: one execution record, zero retained ciphertexts. The worker logged graceful `SIGTERM` shutdown. This verifies the startup sweep, not long-term throughput or a provider-stage crash recovery.

Cleanup commands stop test processes without deleting their volumes:

```powershell
docker compose -p forge-ai-qualification -f docker-compose.yml -f docker-compose.ai-qualification.yml stop
docker stop forge-ai-qualification-20260930
```

## Remaining work in the accepted plan

1. Finish Milestone 1: versioned revision restoration through the document command, editor save-coordinator integration, scoped CMS services, durable asynchronous execution creation/stages/cancellation/retry, provider attempt records, quota/budget reservations and checkpoint recovery. The generic DOMAIN_EVENT consumer is not an AI stage handler. Existing generation is still synchronous.
2. Stitch + Claude adapters, pinned tested SDK/model versions, capability checks, private artifacts, isolated HTML/CSS conversion and one-page editor proposal preview. No Stitch integration or Claude Design import is exposed yet.
3. Shared components/tokens/navigation, controlled assets and up to eight coherent responsive pages; independent page retries.
4. Typed scoped AI operations and selection/section/page/site editing; preview state isolated from autosave; persisted undo; stale detection and manual/AI alternation.
5. Real CMS collections/templates/bindings/draft entries and inquiry form commands, with atomic resource-version checks. Do not describe the current blueprint layout as a functional CMS.
6. Visual reference fixtures and deterministic parity at 390/768/1440 plus 320 overflow, browser journeys, publishing/rollback, security, budget/outage tests and opt-in live provider qualification. None of these broader acceptance runs was performed here.

## Next implementation prompt

Continue ForgeStudio Milestone 1 from the current dirty worktree. Preserve the implemented atomic AI approval, original-provider retry, prompt cleanup and job fencing. Read this implementation record and inspect current git status first.

Implement revision restoration through `saveWebsiteDocument` with explicit expected version, stable idempotency and authorization on replay. Coordinate the restore with pending manual/autosaves; hydrate the acknowledged version and all restored page/site state. Remove the frontend's local-success fallback when server restore fails. Do not publish or delete later CMS entries/form submissions. Add tests for concurrent manual save/restore, protected elements, content-only roles, lost acknowledgements and permission revocation.

Then add the new asynchronous execution API without changing the legacy synchronous generation response. Persist encrypted prompt, expected version, operation/scope, provider/model snapshot, execution and job intent in one PostgreSQL transaction. Worker jobs carry execution IDs only. Add actual staged dispatch with checkpoint persistence, cancellation and expiry, and reconcile uncertain provider outcomes before retry. Do not silently substitute the blueprint provider for Stitch. Until the Stitch/Claude adapters and budgets are ready, fail the requested workflow with an explicit unavailable capability, never a mock success.

Use the isolated Compose overlay and migrated `forge_hardening` database. Re-run the 39 AI/worker and 30 workspace/document tests above, backend/frontend builds, changed-file lint, API health/readiness and worker probes. Add empty/existing migration checks for any new schema. Update README, environment/Compose/startup files and this verification record with exact results, unresolved blockers and the next dependency-safe prompt.
