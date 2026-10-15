# 10 — API Endpoint Catalogue

Computed read-only on 2026-10-15 from every Express router in `backend/src` and the mounts in `backend/src/app.ts`.

## Totals

| Measure | Value |
|---|---|
| Live endpoint declarations (unique `router.<method>(...)` lines on mounted routers) | **1,087** in **83** routers |
| Of which in `routes/project.routes.ts` (developer platform) | 406 |
| Of which in `routes/website.routes.ts` (website builder + WordPress console) | 193 |
| Path prefixes per router | most routers are mounted twice (`/api/...` and `/api/v1/...`); some 3–4 times |
| Declared but **not mounted** (dead) | `routes/releaseIntegrity.routes.ts` (5), `routes/websiteContract.routes.ts` (4), main router of `services/billing/billing.routes.ts` (checkout etc.; only its webhook router is mounted) |
| WebSocket gateways | 5 paths (`/ws/presence`, `/ws/collaboration`, `/ws/workspace-sync`, `/ws/realtime`, `/ws/terminal`) |
| Frontend call sites resolved | 380 call sites / 276 unique paths (plus ~120 service-client calls resolved by hand) |

"Matched to a UI call" is a mechanical lower bound: it counts declarations whose path matched a frontend URL literal. "UI wiring" adds manual verification for clients whose URLs are built from a base variable (forum, support, workspaces, platform control, billing, identity).

## Developer-platform feature segments (`/api/v1/projects/:id/<segment>`)

| Segment | Endpoints | UI calls found | Segment | Endpoints | UI calls found |
|---|---|---|---|---|---|
| runtime | 47 | 38 | ai | 43 | 37 |
| database | 36 | 30 | devops | 29 | 24 |
| git | 24 | 24 | quality | 20 | 16 |
| intelligence | 19 | 19 | collaboration | 15 | 13 |
| github | 13 | 11 | storage | 9 | 7 |
| pages | 8 | 4 | domains / extensions / containers | 7 each | 6 / 7 / 7 |
| files / deployments / pipelines | 6 each | 6 / 6 / 6 | environment | 5 | 0 |
| debug / mcp / data / design-system | 5 each | 5 / 3 / 0 / 0 | generator, app-generations, preview, generate, dependencies, knowledge-graph, components | 4 each | 0–4 |
| sync, terminal, import, monorepo, infra | 3 each | 3 each | snapshots, manifest, application-spec, workspace, roundtrip, benchmark, data-model, auth, architecture, workspace-state, builds, templates | 2 each | 0–2 |

No UI at all: `environment`, `data`, `design-system`, `application-spec`, `architecture`, `auth`, `benchmark`, `components`, `data-model`, `generator`, `roundtrip`, `templates`, `workspace`.

## Per-router catalogue

UI wiring values: **Wired** (every endpoint reachable from some screen), **Mostly / Partially wired**, **API-only (no UI)** (no screen calls it — usable only by scripts/external clients), **BROKEN wiring** (UI calls a path that does not exist), **Provider/Ops/External/Public runtime** (not meant for UI).

| Router file | Mounted at | Endpoints | Matched to a UI call | UI wiring | Notes |
|---|---|---|---|---|---|
| `routes/project.routes.ts` | /api/v1/projects | 406 | 7 | Mostly wired | Developer workspace calls ~40 of 55 feature segments (runtime, ai, database, git, devops, quality, intelligence, collaboration, github, storage, extensions, containers, pipelines, files, domains, deployments …). No UI for: application-spec, architecture, auth, benchmark, components, data-model, design-system, environment, generator, roundtrip, templates. |
| `routes/website.routes.ts` | /api/v1/websites | 193 | 130 | Partially wired |  |
| `routes/ai.routes.ts` | /api/v1/ai | 34 | 11 | Partially wired |  |
| `routes/support.routes.ts` | /api/v1/support | 29 | 1 | Wired | via `features/support/services/ticketService.ts` |
| `routes/forum.routes.ts` | /api/v1/forum | 20 | 0 | Wired | via `features/forum/services/forumService.ts` |
| `routes/enterpriseMultisite.routes.ts` | /api/v1/websites | 16 | 15 | Partially wired |  |
| `routes/customPostType.routes.ts` | /api/v1/cpt | 15 | 12 | Partially wired |  |
| `routes/operations.routes.ts` | /api/v1/operations | 15 | 8 | Partially wired |  |
| `routes/commerce.routes.ts` | /api/v1/websites | 14 | 4 | Partially wired |  |
| `routes/team.routes.ts` | /api/v1/teams, /api/v1/workspaces | 12 | 7 | Partially wired |  |
| `platform/control/routes.ts` | /api/v1/platform | 11 | 0 | Wired | via `features/platform-control/platform-control-api.ts` |
| `routes/designSystem.routes.ts` | /api/v1/design-system, /api/v1/websites | 11 | 0 | API-only (no UI) |  |
| `routes/health.routes.ts` | /api | 11 | 0 | Ops | health/readiness + staff diagnostics |
| `routes/api-v1.routes.ts` | /api/v1 | 10 | 3 | Partially wired |  |
| `routes/form.routes.ts` | /api/v1/forms | 10 | 5 | Partially wired |  |
| `routes/benchmark.routes.ts` | /api/v1/benchmark | 9 | 0 | API-only (no UI) |  |
| `routes/hosting.routes.ts` | /api/v1/websites | 9 | 9 | Wired |  |
| `routes/integration.routes.ts` | /api/v1/integrations | 9 | 0 | BROKEN wiring | Mounted only at `/api/v1/integrations`; live UI calls `/api/integrations/...` (404) |
| `routes/workspace-lifecycle.routes.ts` | — | 9 | 0 | Wired | nested in tenant-workspace router; via workspace-api |
| `modules/data-platform/studio/studio.routes.ts` | /api/v1/projects/:projectId/studio | 9 | 9 | Wired |  |
| `modules/data-platform/data-layer/data.routes.ts` | /api/v1/data, /api/v1/projects/:projectId/sdk | 8 | 0 | External API | Data API/SDK for generated apps (API keys) |
| `routes/designNotes.routes.ts` | /api/v1/design-notes | 7 | 7 | Wired |  |
| `routes/experiment.routes.ts` | /api/v1/websites | 7 | 7 | Wired |  |
| `routes/tenant-workspace.routes.ts` | /api/v1/tenant-invitations, /api/v1/tenant-workspaces, /api/v1/workspaces | 7 | 0 | Wired | via `features/workspaces/workspace-api.ts` |
| `modules/billing/http/routes.ts` | /api/v1/organizations/:organizationId/billing | 6 | 0 | Wired | via `features/billing/OrganizationBillingPanel.tsx` (workspace dashboard) |
| `routes/codeIntelligence.routes.ts` | /api/v1/intelligence | 6 | 0 | API-only (no UI) |  |
| `routes/securityAudit.routes.ts` | /api/v1/security-audit | 6 | 0 | API-only (no UI) |  |
| `routes/template.routes.ts` | /api/v1/templates | 6 | 6 | Wired |  |
| `routes/workflowsCommunication.routes.ts` | /api/v1/workflows-communication | 6 | 0 | API-only (no UI) |  |
| `services/control/control.routes.ts` | /platform/v1 | 6 | 0 | API-only (no UI) |  |
| `modules/data-platform/database/database.routes.ts` | /api/v1/projects/:projectId/database | 6 | 3 | Partially wired |  |
| `modules/data-platform/storage/storage.routes.ts` | /api/v1/projects/:projectId/storage | 6 | 0 | API-only (no UI) |  |
| `routes/adaptiveInfrastructure.routes.ts` | /api/v1/adaptive-infrastructure | 5 | 0 | API-only (no UI) |  |
| `routes/auth.routes.ts` | /api/v1/auth | 5 | 2 | Partially wired |  |
| `routes/componentAccess.routes.ts` | /api/v1/component-access | 5 | 2 | Partially wired |  |
| `routes/hostingExport.routes.ts` | /api/v1/hosting-export | 5 | 0 | API-only (no UI) |  |
| `routes/license.routes.ts` | /api/v1/licenses | 5 | 4 | Partially wired |  |
| `routes/marketingAnalytics.routes.ts` | /api/v1/marketing-analytics | 5 | 0 | API-only (no UI) |  |
| `routes/subscription.routes.ts` | /api/v1/subscriptions | 5 | 5 | Wired |  |
| `modules/identity/http/local.routes.ts` | — | 4 | 0 | Wired | login/signup pages, `features/identity` |
| `modules/identity/http/oidc.routes.ts` | — | 4 | 0 | Wired | `features/identity/AuthenticationPage.tsx` |
| `routes/component.routes.ts` | /api/v1/components | 4 | 0 | API-only (no UI) |  |
| `routes/customCode.routes.ts` | /api/v1/custom-code | 4 | 4 | Wired |  |
| `routes/designToken.routes.ts` | /api/v1/websites | 4 | 0 | Partial | design-system endpoints under /websites/:id |
| `routes/developer.routes.ts` | /api/v1/developer | 4 | 0 | API-only (no UI) |  |
| `routes/export.routes.ts` | /api/v1/plugins/wordpress, /api/v1/websites | 4 | 3 | Partially wired |  |
| `routes/knowledgeGraph.routes.ts` | /api/v1/knowledge-graph | 4 | 0 | API-only (no UI) |  |
| `routes/mailer.routes.ts` | /api/v1/websites | 4 | 3 | Partially wired |  |
| `routes/media.routes.ts` | /api/v1/media | 4 | 4 | Wired |  |
| `routes/searchQuality.routes.ts` | /api/v1/search-quality | 4 | 0 | API-only (no UI) |  |
| `routes/serverConfig.routes.ts` | /api/v1/websites | 4 | 4 | Wired |  |
| `routes/serviceObjectives.routes.ts` | /api/v1/service-objectives | 4 | 0 | API-only (no UI) |  |
| `routes/sftp.routes.ts` | /api/v1/sftp | 4 | 4 | Wired |  |
| `routes/staging.routes.ts` | /api/v1/websites | 4 | 4 | Wired |  |
| `modules/files/http/routes.ts` | /api/v1/organizations/:organizationId/files | 3 | 0 | API-only (no UI) |  |
| `routes/apiKeys.routes.ts` | /api/v1/apikeys | 3 | 3 | Wired |  |
| `routes/capability.routes.ts` | /api/v1/capabilities | 3 | 0 | API-only (no UI) |  |
| `routes/clientBilling.routes.ts` | /api/v1/websites | 3 | 3 | Wired |  |
| `routes/composer.routes.ts` | /api/v1/composer | 3 | 3 | Wired |  |
| `routes/deliveryAndCommercial.routes.ts` | /api/v1/delivery-governance | 3 | 0 | API-only (no UI) |  |
| `routes/multisite.routes.ts` | /api/v1/multisite | 3 | 0 | API-only (no UI) |  |
| `routes/oauth.routes.ts` | /api/v1/auth | 3 | 1 | Partially wired |  |
| `routes/ownerExperience.routes.ts` | /api/v1/owner-experience | 3 | 0 | API-only (no UI) |  |
| `routes/pluginIntegration.routes.ts` | /api/v1/plugins-integration | 3 | 0 | API-only (no UI) |  |
| `routes/whitelabel.routes.ts` | /api/v1/agency | 3 | 2 | Partially wired |  |
| `services/files/file.routes.ts` | /api/v1/files | 3 | 0 | API-only (no UI) |  |
| `services/integrations/secret-reference.routes.ts` | /api/v1/organizations | 3 | 0 | API-only (no UI) |  |
| `platform/integrations/connector-credential.routes.ts` | /api/v1/organizations/:organizationId/connectors/credentials | 2 | 0 | API-only (no UI) |  |
| `routes/aiHosting.routes.ts` | /api/v1/websites | 2 | 0 | API-only (no UI) |  |
| `routes/elementorCloud.routes.ts` | /api/v1/elementor-cloud | 2 | 0 | API-only (no UI) |  |
| `routes/formsLeads.routes.ts` | /api/v1/forms-leads | 2 | 0 | API-only (no UI) |  |
| `routes/imageOptimization.routes.ts` | /api/v1/websites | 2 | 2 | Wired |  |
| `routes/performance.routes.ts` | /api/v1/websites | 2 | 2 | Wired |  |
| `routes/platform-auth.routes.ts` | /api/v1/platform-auth | 2 | 0 | Wired | via platform-control-api |
| `routes/pluginCompat.routes.ts` | /api/v1/plugins | 2 | 2 | Wired |  |
| `modules/billing/http/webhook.routes.ts` | /api/v1/billing/webhooks/stripe | 1 | 0 | Provider | Stripe webhook |
| `routes/auditLog.routes.ts` | /api/v1/audit-logs | 1 | 1 | Wired |  |
| `routes/hosted.routes.ts` | /api/hosted | 1 | 0 | Public runtime | SEC-06 |
| `routes/me.routes.ts` | /api/v1/auth | 1 | 0 | Wired | `context/AuthContext.tsx` |
| `routes/upload.routes.ts` | /api/v1/uploads | 1 | 1 | Wired |  |
| `routes/usage.routes.ts` | /api/v1/users/me | 1 | 1 | Wired |  |
| `services/capabilities/tenant-capabilities.routes.ts` | /api/v1/organizations | 1 | 0 | API-only (no UI) |  |
| `services/billing/billing.routes.ts(webhook)` | — | 1 | 0 | Provider | second Stripe webhook (`/api/v1/billing/webhooks`) |

## API-only routers (28) — backend features with no screen

Blueprint v2 governance routers (`service-objectives`, `adaptive-infrastructure`, `hosting-export`, `security-audit`, `workflows-communication`, `marketing-analytics`, `search-quality`, `delivery-governance`, `owner-experience`, `forms-leads`, `components`, `benchmark`, `capabilities`), organization files (`modules/files`, `services/files`), secret references and connector credentials, tenant capabilities, SaaS control plane (`/platform/v1`), code intelligence and knowledge graph (the developer workspace uses the per-project equivalents instead), multisite, plugin integration, AI hosting tool, Elementor Cloud, developer settings, data-platform storage, design-system library.
These are classified **IMPLEMENTED, UNVERIFIED (API-only)** unless a test executed in this audit covers them (`v2-feature-routers.integration` verifies that the v2 routers are mounted with auth and tenant scope).
