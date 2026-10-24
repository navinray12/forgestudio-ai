# WP-03–WP-10: Current-source feature cross-check and SaaS gap register

**Audit baseline:** 24 October 2026. **Base:** `sconfigtesting` at `3c7b0c791e84c6d48b7742cbdd3594b6c3dbdb5d`. **Development branch checked:** `phase2/production-hardening` at `7ec89dcea0b576a7a97737a0e09d9ca1ba363d2b`. **Draft PR:** [#42](https://github.com/navinray12/forgestudio-ai/pull/42).

**Purpose:** user-requested FEATURE AUDIT FIRST, BEFORE WP-03–WP-10 IMPLEMENTATION. This cross-check used the current recursive Git tree, source modules and route files, exact-head GitHub CI, and the existing [product ledger](./PRODUCT_COMPLETION_SCOPE_AND_LEDGER.md). The ledger's `NOT STARTED` on WP-05–WP-10 describes **dedicated scope qualification**, NOT absence of all corresponding code.

**Critical evidence rule:** Source files establish **implemented code paths**, named tests establish **some test coverage**, a green CI run establishes **only what it exercises**, and an externally deployed persistent journey establishes a **product release**. None implies the next. Every item below is `SOURCE PRESENT / RELEASE UNVERIFIED` unless otherwise stated; avoid artificial percentages or feature-complete claims.

## Current repository footprint

- 2,482 tracked files in branch tree, including 73 files under `backend/src/routes/`, 315 files under `frontend/src/pages/editor/`, 260 files under `backend/src/tests/`, 129 files under `frontend/tests/`, and 26 workflow files. These are **file counts**, not unique endpoints, widgets, tests run or working features.
- [Latest Phase 2 CI](https://github.com/navinray12/forgestudio-ai/actions/runs/40090546561) passed on the audited SHA. Frontend full lint and AI/worker qualification also passed on the same SHA.
- **Identity boundary workflow on the same SHA failed:** [run 40090546569](https://github.com/navinray12/forgestudio-ai/actions/runs/40090546569), `identity-contracts`. The browser app could not start because `form_delivery_policies` was missing: identity workflow browser setup uses `prisma db push`, which cannot apply this raw-SQL-only migration. This is a real WP-07/WP-00 acceptance blocker, NOT a flaky-test waiver.

## Feature cross-check and precise release gaps

| ID | Scope and feature | Current source evidence | Verified claim | Release gap / required cross-check |
| --- | --- | --- | --- | --- |
| F03-01 | WP-03 visual editor | `frontend/src/pages/editor/WebsiteEditor.tsx`, `pages/editor/widgets/` | Editor sources and dedicated save/history/page tests exist | Every advertised widget must render, save/reopen, preview and publish; run real browser matrix |
| F03-02 | WP-03 templates / global widgets | `frontend/src/features/templates/services/templateService.ts`, `frontend/src/features/global-widget/services/globalWidgetService.ts`, `backend/src/services/template.service.ts` | Backend persistence/error contracts and frontend tests exist | Linked-instance semantics, version/concurrency and published parity |
| F03-03 | WP-03 conflict/version recovery | `backend/src/services/websites/save-document.ts`, `frontend/tests/website-editor/manual-save.test.tsx` | Conflict/version code and tests present | Competing authenticated browsers, conflict resolution with no data loss |
| F04-01 | WP-04 CMS/dynamic pages | `backend/src/services/cms/contentLifecycle.service.ts`, `backend/src/tests/custom-post-type-cms.integration.test.ts` | CMS lifecycle code and tests present | Real published schema, entries, list/detail bindings, cache/SEO and cross-tenant E2E |
| F04-02 | WP-04 public forms/leads | `backend/src/services/form/form.service.ts`, `backend/src/services/leads/leadIntake.service.ts`, `backend/src/services/form/formDeliveryPolicy.service.ts` | Durable intake and encrypted form policy code; PostgreSQL tests exist | Live visitor submit → owner notification → durable retry; credential rotation, consent and abuse checks |
| F04-03 | WP-04 production media | `backend/src/modules/data-platform/storage/upload-presigner.service.ts`, `storage/s3-client.ts` | Upload/confirm safeguards and tests exist | Real persistent object store, CORS, CDN URL, transformation, tenant retrieval, retention/restore E2E |
| F04-04 | WP-04 website kits | `backend/src/modules/design-system/projectTemplate.service.ts`, `backend/src/services/template.service.ts` | Template code exists | Preview/apply full multi-page kit, linked assets, revisions and publish |
| F05-01 | WP-05 hosting/publishing | `backend/src/services/publishing.service.ts`, `services/publishing/integratedPublishingRelease.service.ts`, `controllers/publishing.controller.ts` | Publish/release sources and regression tests exist | Real immutable artifact deployed on public URL; authorized publish/rollback and health checks |
| F05-02 | WP-05 custom domains/TLS | `backend/src/services/domains/customDomain.service.ts`, `controllers/customDomain.controller.ts`, `backend/src/tests/phase2-domains-server-sftp.test.ts` | Domain/hosting source and tests exist | Real DNS ownership, HTTPS certificate issuance/renewal and rollback verified in staging |
| F05-03 | WP-05 hosted artifact delivery | `backend/src/routes/hosted.routes.ts` | **Deliberately disabled**: legacy route returns 404 for all deployments | Authorized immutable deployment artifact resolver with containment and no cross-project access; no false readiness |
| F06-01 | WP-06 AI generation/proposals | `backend/src/modules/ai/design/converter.ts`, `modules/ai/ai-provider.ts`, `controllers/ai-design.controller.ts` | Provider, conversion and workflow code plus provider qualification exist | Real paid/sandbox provider brief → durable job → preview → Apply → published site |
| F06-02 | WP-06 cost/quotas | `backend/src/modules/ai/ai-quota.ts`, `backend/src/workers/main.ts` | Quota and worker source exists | Budget enforcement, rate/abuse limits, retries and no simulated provider success |
| F07-01 | WP-07 identity / OTP | `backend/src/modules/identity/application/local-authentication.ts`, `adapters/identity/smtp-otp-delivery.ts` | Real identity adapter contracts exist; dependency gate passed | **Current browser CI fails due missing SQL migration**, then real signup/account replay/revocation proof |
| F07-02 | WP-07 billing / entitlements | `backend/src/modules/billing/billing.service.ts`, `modules/billing/stripe.adapter.ts`, `modules/billing/http/webhook.routes.ts` | Billing code and tests exist | Provider test-mode checkout, webhook signature/replay/order handling, entitlement upgrade/cancel/downgrade |
| F07-03 | WP-07 onboarding workspace | `backend/src/modules/identity/application/account-sessions.ts`, workspace integration/fixture tests | Session/workspace source and tests exist | Fresh user → OTP → workspace/site → permission/entitlement E2E |
| F08-01 | WP-08 WordPress adapter | `backend/src/services/wordpress/connector/publishing.ts`, `connector/rollback.ts`, `connector/media.ts` | WordPress publisher/rollback/diagnostic code and tests exist | Real WordPress test server credentials, publish/rollback, media and failure reconciliation |
| F08-02 | WP-08 third-party connectors | `backend/src/services/integration.service.ts`, `platform/integrations/safe-egress.ts`, `platform/integrations/connector-credentials.ts` | Connector/secret/egress source exists | Explicit provider sandbox tests, destination ownership, revocation, retries and truthful degraded state |
| F08-03 | WP-08 extensibility/MCP | `backend/src/modules/ai/mcp/mcpRegistry.service.ts`, `modules/extensions/pluginLifecycle.service.ts` | Registry and plugin lifecycle source/tests exist | SSRF/network containment, auth, trust and permitted plugin execution in deployed runtime |
| F09-01 | WP-09 telemetry/SLO/alerts | `backend/src/services/monitoring.service.ts`, `services/serviceObjectives/incidentAlertOperations.service.ts` | Metrics/alerts/SLO source exists | Live metrics pipeline, operator alert delivery, on-call test, latency/saturation thresholds |
| F09-02 | WP-09 disaster recovery | `backend/src/modules/data-platform/database/database-backup.service.ts`, `services/backups/websiteBackup.service.ts` | Backup/checksum/rollback tests exist | Actual deployed backup + restore and time-bound RPO/RTO measurement with tenant data |
| F09-03 | WP-09 incident/release operations | `backend/src/services/releaseIntegrity/mandatoryReleaseGates.service.ts`, `services/securityAudit/durableAuditDenialLedger.service.ts` | Release/audit operations code exists | Runbooks, incident simulations, immutable audit artifacts and independent security signoff |
| F10-01 | WP-10 safe decomposition | `backend/src/controllers/project.controller.ts` and split `backend/src/controllers/project/*.controller.ts` | Split modules already present; full module still exists | Export/import reachability, unused code removal only behind whole-repo regression gates |
| F10-02 | WP-10 performance | `backend/src/services/sitePerformance.service.ts`, `modules/runtime-platform/queues/taskQueue.service.ts` | Analysis/queue services exist | Real page load, queue latency, Web Vitals, load/concurrency test and budgets |
| F10-03 | WP-10 compatibility | `frontend/src/pages/editor/`, `backend/src/routes/`, `backend/src/tests/` | Large existing surface with automated tests | No behavior regression or wide structural rewrite without passing contract coverage |

## Blueprint business journeys: current evidence vs acceptance

The existing blueprint specifies **J01–J12**, not a smaller invented feature list.

| Journey | Audit result |
| --- | --- |
| J01 Signup → OTP → workspace/subscription → first site | Code/test present; current Identity browser job **FAILED**; **NOT ACCEPTED** |
| J02 Blank site → responsive edit → save/reload → publish | Editor tests present; real published URL parity **UNVERIFIED** |
| J03 Template kit → pages/assets → publish | Template sources present; multi-page kit published E2E **UNVERIFIED** |
| J04 AI brief → durable job/proposal → edit/publish | AI source + CI present; live provider/publication **UNVERIFIED** |
| J05 CMS schema/entries → public SEO list/detail | CMS source + integration tests present; live journey **UNVERIFIED** |
| J06 Form setup → visitor submit → lead → owner notification | Durable lead + encrypted policies present; live delivery/retries **UNVERIFIED** |
| J07 Durable image/video upload/browse/remove/publish | Storage source present; real object store and CDN **UNVERIFIED** |
| J08 Publish → default URL → domain/TLS → rollback | Hosting source present; public origin/DNS/TLS **UNVERIFIED** |
| J09 Merchant checkout/payment order state (conditional scope) | Payment services present; real provider acceptance **UNVERIFIED**, release inclusion unresolved |
| J10 Checkout/webhook → entitlement/cancel | Billing source present; real signed webhook lifecycle **UNVERIFIED** |
| J11 Invite/role/revoke with cross-tenant denial | Authorization tests exist; deployed multi-user acceptance **UNVERIFIED** |
| J12 Incident → logs → restore → verify | Monitoring/backup sources present; incident and recovery drill **UNVERIFIED** |

## Audit corrections and confirmed issues, 24 October 2026

**QA-01: test-count reliability, WP-08.** `backend/src/tests/wordpress-publish-f495.test.ts` contains many `record(name, true)` statements instead of executing the claimed scenario; `wordpress-publish-rollback-f497.test.ts` similarly records many unconditional passes. `wordpress-webhooks-f505.test.ts` contains placeholder `assert(true)` scenarios and imports `assert` from `console`, where a false assertion logs rather than throwing. Their headline 74/77/100 counts are **NOT independent production acceptance evidence**. New qualification includes `regression/wordpress-connector-characterization.test.ts`, which has actual test assertions. All provider journeys remain unverified without an actual sandbox WordPress server.

**GAP-05A: domain mutation access** at `controllers/customDomain.controller.ts`: missing principal formerly skipped website authorization, and a read-only collaborator could mutate domain configuration. New canonical `verifyProjectAccess` check requires a principal, and owner/admin permission is required for domain mutations; negative tests `wp05-domain-authorization.test.ts` added.

**GAP-05B: fabricated SSL readiness** at `services/domains/customDomain.service.ts` and `controllers/customDomain.controller.ts`: earlier DNS verification falsely asserted that a Let's Encrypt certificate had been issued, set 90-day expiry and advertised renewal despite no real ACME/edge installer. This unsafe success path now fails closed with `SSL_ISSUANCE_UNAVAILABLE`; DNS ownership is reported separately from HTTPS readiness. `wp05-ssl-truthfulness.test.ts` added. **This does not implement ACME issuance**, which remains OPEN and mandatory before publishing production custom domains.

**GAP-07A: migration authority** at `.github/workflows/identity-boundary.yml`: the Identity browser runner previously used `prisma db push`, omitting the raw SQL `form_delivery_policies` table. It now applies the full versioned migration ledger. A subsequent run proved `workspaces.isDefault` and `isArchived` were absent from clean migrations; `20261024004000_workspace_flags_schema_alignment/migration.sql` adds them. The presence-security fixture now creates workspace + owner membership atomically, respecting its deferred PostgreSQL invariant. Workspace browser fixture no longer drops tables and replays old migrations on top of canonical migration state. These changes **require a passing final Identity browser run** before marking J01/J11 accepted.

**AUDIT-AUTO:** `scripts/saas-feature-crosscheck.mjs` and the Phase 2 CI artifact record source/test evidence for the 23 named features at each commit, with `productionAcceptance: NOT_VERIFIED` explicitly. The new source-level CI job exercises real assertions for AI capabilities, WordPress characterization, operational telemetry, maintenance and project ownership. **Source, test file, and live provider success remain different acceptance levels.**

## Current-head feature cross-check addendum — 24 October 2026

The existing 23-row source/test matrix is an **inventory**, not a feature completion count. Reviewed against `phase2/production-hardening` branch head `b2d754a0` before this fix. The user requested **audit first, then completion of WP-03 through WP-10**; the following issue was confirmed by inspecting actual WP-05 domain implementation.

**GAP-05C / P0 — PROD DOMAIN OWNERSHIP SPOOFING:** `backend/src/services/domains/customDomain.service.ts#verifyDomainDns` formerly reported verification successful with a matching A record, platform CNAME, or `ALLOW_LOCAL_DNS_FALLBACK=true` even in production. These are routing clues, not a website owner's unique challenge proof. Remediation committed at `2b9b4fc5`: production only accepts an **exact** domain-specific TXT verification token; A/CNAME and synthetic development fallback can no longer assert ownership. Regression cases in `backend/src/tests/wp05-ssl-truthfulness.test.ts` were added at `5b07cc9e`, covering CNAME/A spoofing, fallback flag and substring TXT acceptance. **CI for this commit is pending as this text was authored**. This does not deliver ACME SSL issuance, domain edge routing, or public publishing.

**Remaining priority P0:** WP-03 full widget/publish browser parity; WP-04 CMS/media/form delivery on real cloud services; WP-05 immutable hosted artifacts + DNS/TLS + rollback; WP-06 AI provider/usage enforcement E2E; WP-07 Stripe signed real webhooks/entitlements and signup; WP-08 WordPress/provider sandboxes; WP-09 real incident + restore + telemetry; WP-10 measured performance and narrowly proved dead-code removal. J01–J12 still **NOT PRODUCTION CERTIFIED**. Preserve the issue matrix; continue with narrow verification-backed corrections, not full repo re-audits.

## Order of implementation (no blind refactor)

1. **Repair the confirmed WP-07 Identity browser blocker** using real `prisma migrate deploy` rather than `db push` on clean databases. Verify CI on exact SHA; never weaken startup migration checks.
2. Pin this feature inventory in CI to the current SHA, explicitly separating code presence from runtime and external acceptance.
3. Qualify WP-03 editor parity and WP-04 CMS/media/form journeys against a real browser and persisted environment; record missing behaviors with single owner files.
4. Qualify WP-05 hosted artifacts, domain and release pipeline rather than enabling insecure `/api/hosted` fallback.
5. Run WP-06 real provider + quota/budget and WP-07 real payment/entitlement flows on explicitly provisioned sandbox credentials.
6. Run WP-08 WordPress/connector sandbox + revocation; WP-09 observability and restore drills; perform WP-10 **only as verified, small, behavior-preserving extractions**.
7. Formal cross-tenant/SSRF/XSS threat review, load test and release evidence for J01–J12. If credentials or infrastructure are absent, mark that acceptance **BLOCKED**, not **PASS**.

**Production-go-live decision on audited SHA: NO-GO.** No request here authorizes merging the draft PR or exposing insecure runtimes. The full 8-scope delivery is not already complete; no automation report or green unit suite is equivalent to all external acceptance.
