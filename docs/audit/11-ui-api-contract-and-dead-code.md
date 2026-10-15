# 11 — UI ↔ API Contract Defects and Dead Code

All results are read-only static analysis (2026-10-15). "Live" means the file is reachable from `frontend/src/main.tsx` (or, for the backend, from `server.ts` / workers) through imports.

## 1. Frontend calls to endpoints that do not exist (live code) — PROD-11

| # | User-facing feature | Frontend location | Call | Backend reality | Effect |
|---|---|---|---|---|---|
| 1 | Template library → **Website Kits** tab | `features/website-kits/services/websiteKitService.ts:9,40` (used by `WebsiteKitLibrary` inside `TemplateLibrary`) | `GET /api/website-kits`, `POST /api/website-kits/apply` | No such route | Kit library cannot load or apply kits |
| 2 | **Global widgets** — update | `features/global-widget/services/globalWidgetService.ts:172` | `PUT /api/templates/:id` | Only `PATCH /api/templates/:id` (`template.routes.ts:23`) | Editing a saved global widget fails |
| 3 | Publish modal → **Submit for approval** | `pages/editor/components/PublishModal.tsx:813` | `POST /api/approval-requests` (relative URL → frontend origin) | No route; `services/approval.service.ts` is dead code | When a site has the approval workflow enabled, non-owners are blocked from publishing (`publishing.service.ts:334-348`) and have no working way to request approval |
| 4 | Managed site → **test integration** (Google Sheets / Mailchimp / Zapier) | `pages/dashboard/components/ManagedSiteModal.tsx:161` | `POST /api/integrations/:type/test` | Router mounted only at `/api/v1/integrations` (`app.ts:362`) | 404 |
| 5 | **PayPal button widget** (create/capture order) | `pages/editor/widgets/renderers.tsx:5301,5329` | `POST /api/integrations/paypal/{create,capture}-order` | Same — only `/api/v1/integrations` | Payment button fails in editor preview and on the published site |
| 6 | **Video upload** in editor | `pages/editor/WebsiteEditor.tsx:4029,4036` | `POST /api/v1/uploads/video`, fallback `/api/uploads/video` | Only `POST /uploads/image` exists | Video upload fails |
| 7 | Dynamic widget inspector **file upload** | `pages/editor/inspector/DynamicWidgetInspectors.tsx:44` | `POST /api/upload` (relative, no credentials) | No route | Upload fails |
| 8 | Publish modal → **Download WordPress plugin** link | `PublishModal.tsx:3506` | `href="/api/plugins/wordpress/download"` (relative) | No such route (plugin download is `GET /api/websites/:id/wordpress/download-plugin`) | Broken link |
| 9 | Atomic form widget default submit target | `features/atomic-editor/services/atomicFormService.ts:42,76` | `actionUrl: "/api/contact"`, `"/api/subscribe"` | No route | Default contact/subscribe forms post to nothing unless the user changes the action |

Calls in **dead** files that would also fail (no user impact today): `pages/editor/integrations/IntegrationRenderers.tsx` (`/api/integrations/{paypal,stripe,crm,dynamic-data,webhook}`, unversioned).
Client functions with **no callers**: `scheduleCodePublish`, `listScheduledCodePublishes`, `cancelScheduledCodePublish` in `features/publishing/services/publishingService.ts:1679-1710` call `/scheduled-publish`, which does not exist (backend uses `/schedule-publish` and `/cancel-scheduled-publish`).

False positives checked and excluded: CPT purge approve/execute, CPT entry PATCH, project `database/:id/api/*` and `quality/api/*` routes, design-note resolve/reopen, experiments, export preview/zip — all exist.

## 2. Backend features whose UI exists only in dead files — PROD-12

| Feature | Backend | Frontend component | State |
|---|---|---|---|
| Media library (browse / rename / delete uploads) | `GET/PATCH/DELETE /api/media` | `pages/editor/components/media/MediaLibraryModal.tsx` — never imported | No way to browse previously uploaded media in the editor |
| Design notes / comments | `/api/design-notes` (7 endpoints) | `pages/editor/components/NotesPanel.tsx` — never imported; `isNotesOpen` state declared, never set | Missing in UI |
| Component access manager | `/api/component-access` | `ComponentAccessModal.tsx` never imported; the editor only *reads* access (`WebsiteEditor.tsx:1955`) | Cannot be managed from UI |
| Code export modal (preview + ZIP) | `/api/websites/:id/export/{preview,zip}` | `CodeExportModal.tsx` never imported (PublishModal still links the ZIP) | Partial |
| Editor form inspector / form templates / in-editor submissions | `/api/forms` | `pages/editor/components/forms/*` never imported (dashboard `FormSubmissionsModal` is live) | Partial |
| Popup settings panel, performance settings panel | — | `PopupSettingsPanel.tsx`, `PerformanceSettingsPanel.tsx` never imported | Popup manager exists elsewhere; performance-settings panel missing |
| Frontend plugin system | — | `plugins/PluginManager.ts`, `plugins/init.ts`, `PluginSettingsPanel.tsx` never imported | Not wired |
| Keyboard accessibility helpers | — | `utils/keyboardAccessibility.ts` never imported | — |

## 3. Dead code — ARCH-06

| Side | Source files (excl. tests/generated) | Unreachable from entry points | Lines in unreachable files |
|---|---|---|---|
| Backend (`server.ts`, `workers/main.ts`, `workers/platform-worker.ts`, `cli/`) | 738 | **87** | ~12,700 |
| Frontend (`main.tsx`) | 362 | **37** | ~8,900 |

Backend highlights: `services/approval.service.ts`, `signup.service.ts`, `login.service.ts`, `otp.service.ts`, `oauth.service.ts`, `session.service.ts`, `email.service.ts`, `organization.service.ts`, `workspace.service.ts`, `platformHealth.service.ts`, `services/generator/fullStackGenerator.service.ts` (modified in the working tree but loaded only by tests), `services/publishing/integratedPublishingRelease.service.ts`, `services/showcase/teamProjectTracker.service.ts`, `services/telemetry/acceptanceMetricsTelemetry.service.ts`, three `services/authoritative/*` services, two `services/compiler/*` services, 6 files each in `services/components` and `services/formsLeads`, 4 each in `services/marketingAnalytics` and `services/workflowsCommunication`, all of `repositories/`, `validators/`, `sdk/`, `plugins/`, and the three unmounted routers.

Method: static import graph (`import … from`, `export … from`, dynamic `import("…")`) resolved for relative paths. A file loaded through a string-built path would be reported as unreachable; treat the list as "no static importer" and confirm before any deletion.

## 4. Simulated or fabricated success on production paths — PROD-13 (in addition to PROD-04/05/08)

| Location | Behaviour |
|---|---|
| `services/jobs/handlers.ts:100-115` (`MEDIA_OPTIMIZATION` job) | Never touches the file; always reports 35% savings |
| `services/imageOptimization.service.ts:126-136` | If the image cannot be fetched (or no URL is given), optimises a 1×1 pixel or a 240 KB filler buffer and reports that as the site's result |
| `services/siteSecurity.service.ts:612-630` | Generates 15 "edge HTTP access log" entries with invented IPs and paths and presents them as site traffic |
| `services/serverConfig.service.ts:190-196` | SFTP connection test reports **success** in any non-production environment when the connection actually failed |
| `services/pluginIntegration.service.ts:52-58` | Plugin field sync returns a hard-coded `mappedFieldsCount: 15` without syncing |
| `services/domains/customDomain.service.ts:218` | DNS verification falls back to simulated success in local/development/test environments |
| `services/hosting/forgeDomain.service.ts:240` | Simulated propagation check in dev mode |
| `services/siteMailer.service.ts:345` | With no SMTP configured, logs the delivery as `SIMULATED` (honestly labelled) |
| `services/integration.service.ts:118-126` | PayPal demo order only when `PAYPAL_DEMO_MODE=1` outside production (honestly labelled) |
| `modules/containers/dockerfileGenerator.ts:180` | Simulated container build with log streaming and digest (developer platform) |

## 5. Full unreachable file lists

### Backend (87)

- `cli/bin/forge.ts`
- `config/database.ts`
- `config/db-init.ts`
- `config/index.ts`
- `config/passport.ts`
- `controllers/index.ts`
- `controllers/login.controller.ts`
- `controllers/signup.controller.ts`
- `middlewares/index.ts`
- `middlewares/ipFirewall.middleware.ts`
- `middlewares/subscription.middleware.ts`
- `modules/ai/design/converter-worker.ts`
- `operations/identity-cutover-preflight.ts`
- `plugins/PluginManager.ts`
- `plugins/init.ts`
- `repositories/auth.repository.ts`
- `repositories/index.ts`
- `repositories/login.repository.ts`
- `repositories/session.repository.ts`
- `repositories/signup.repository.ts`
- `scripts/generateFixtures.ts`
- `sdk/client.ts`
- `sdk/embeddedEvents.ts`
- `sdk/index.ts`
- `services/approval.service.ts`
- `services/architectureResponsibilities/moduleResponsibilityMatrix.service.ts`
- `services/architectureResponsibilities/workPackagesRegister.service.ts`
- `services/architecture/maintenanceBoundaries.service.ts`
- `services/auth.service.ts`
- `services/authoritative/record5-business-ledgers.service.ts`
- `services/authoritative/relationalChangeImpactGraph.service.ts`
- `services/authoritative/securityPlanes.service.ts`
- `services/capabilities/lifecycleGovernor.ts`
- `services/commercialOperations/commercialAgencySupport.service.ts`
- `services/compiler/bidirectionalVerification.service.ts`
- `services/compiler/unifiedCompilerNormalization.service.ts`
- `services/components/behavioralReviewGate.service.ts`
- `services/components/componentSupportState.service.ts`
- `services/components/designFidelity.service.ts`
- `services/components/editorRuntimeParity.service.ts`
- `services/components/previewSecurity.service.ts`
- `services/components/threeWaySourceReconciliation.service.ts`
- `services/email.service.ts`
- `services/formsLeads/atomicSubmissionBoundary.service.ts`
- `services/formsLeads/disasterRecoveryAudit.service.ts`
- `services/formsLeads/durableOutboxWorker.service.ts`
- `services/formsLeads/formSchema.service.ts`
- `services/formsLeads/leadLifecycle.service.ts`
- `services/formsLeads/quarantinedUpload.service.ts`
- `services/generator/fullStackGenerator.service.ts`
- `services/index.ts`
- `services/login.service.ts`
- `services/marketingAnalytics/exposureValidator.service.ts`
- `services/marketingAnalytics/growthCapabilityGate.service.ts`
- `services/marketingAnalytics/providerAdapters.service.ts`
- `services/marketingAnalytics/telemetryAnalyticsBoundary.service.ts`
- `services/migrationProtection/migrationExistingCustomerProtection.service.ts`
- `services/oauth.service.ts`
- `services/organization.service.ts`
- `services/otp.service.ts`
- `services/ownerExperience/ownerAcceptanceJourneys.service.ts`
- `services/ownerExperience/progressiveDisclosure.service.ts`
- `services/ownerExperience/truthfulEditorState.service.ts`
- `services/platformHealth.service.ts`
- `services/publishing/integratedPublishingRelease.service.ts`
- `services/searchQuality/aiSearchGuidance.service.ts`
- `services/searchQuality/searchReadinessWorkspace.service.ts`
- `services/session.service.ts`
- `services/showcase/teamProjectTracker.service.ts`
- `services/signup.service.ts`
- `services/telemetry/acceptanceMetricsTelemetry.service.ts`
- `services/workflowsCommunication/communicationAdapters.service.ts`
- `services/workflowsCommunication/contextualChatService.service.ts`
- `services/workflowsCommunication/experimentationEngine.service.ts`
- `services/workflowsCommunication/preActionPolicyValidator.service.ts`
- `services/workspace.service.ts`
- `types/auth.types.ts`
- `types/declarations.d.ts`
- `types/login.types.ts`
- `types/vitest.d.ts`
- `utils/index.ts`
- `utils/safe-egress.ts`
- `utils/session.ts`
- `validators/auth.validator.ts`
- `validators/index.ts`
- `validators/login.validator.ts`
- `validators/signup.validator.ts`

### Frontend (37)

- `components/CustomCodeModal.tsx`
- `components/LazySection.tsx`
- `features/ai/index.ts`
- `features/blocks/components/AdvancedBlockControlsUI.tsx`
- `features/blocks/engine/attributeSanitizer.ts`
- `features/blocks/types/block.types.ts`
- `features/developer-workspace/services/codeIntelligenceService.ts`
- `features/fonts/index.ts`
- `features/global-widget/index.ts`
- `features/website-kits/index.ts`
- `pages/dashboard/components/DeveloperFeaturesOverview.tsx`
- `pages/editor/components/CodeExportModal.tsx`
- `pages/editor/components/ComponentAccessModal.tsx`
- `pages/editor/components/IframeModal.tsx`
- `pages/editor/components/NotesPanel.tsx`
- `pages/editor/components/PerformanceSettingsPanel.tsx`
- `pages/editor/components/PopupSettingsPanel.tsx`
- `pages/editor/components/StyleSourceBadge.tsx`
- `pages/editor/components/forms/FormInspectorPanel.tsx`
- `pages/editor/components/forms/FormSubmissionsModal.tsx`
- `pages/editor/components/forms/FormTemplatesModal.tsx`
- `pages/editor/components/forms/FormWidgetRenderer.tsx`
- `pages/editor/components/media/MediaLibraryModal.tsx`
- `pages/editor/integrations/IntegrationRenderers.tsx`
- `pages/editor/integrations/IntegrationSettings.tsx`
- `pages/editor/integrations/index.ts`
- `pages/editor/integrations/integrationDefaults.ts`
- `pages/editor/integrations/integrationTypes.ts`
- `pages/editor/navigation/index.ts`
- `pages/editor/widgets/WpLegacyWidgetRenderer.tsx`
- `plugins/PluginManager.ts`
- `plugins/components/PluginSettingsPanel.tsx`
- `plugins/init.ts`
- `services/auth.service.ts`
- `types/form.types.ts`
- `utils/customCodeOrdering.ts`
- `utils/keyboardAccessibility.ts`
