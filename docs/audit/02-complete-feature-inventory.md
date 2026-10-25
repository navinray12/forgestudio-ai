# 02 — Complete Feature Inventory (canonical ledger, 2nd pass)

This is the single list of every feature and sub-feature found in the repository, with one primary status each. It supersedes the 1st-pass list (100 rows); IDs from the 1st pass are kept, new rows were added and some statuses changed with new evidence (marked **Δ**).

**Statuses.** `VERIFIED` = implemented and verified by tests executed in this audit · `UNVERIFIED` = implemented, behaviour not verified · `PARTIAL` = some required behaviour missing · `MISSING` · `BROKEN` = confirmed defect (code-confirmed unless marked exec) · `DISCONNECTED` = code exists but not wired into the product · `REDUNDANT` = duplicate implementation · `BLOCKED` = verification needs an external system that was unavailable.
Evidence IDs (`SEC-`, `DATA-`, `PROD-`, `ARCH-`, `QA-`) → [08](08-verification-and-evidence-ledger.md). Supporting catalogues: endpoints [10](10-api-endpoint-catalog.md), UI↔API defects and dead code [11](11-ui-api-contract-and-dead-code.md), widgets [12](12-editor-widget-catalog.md).
"UI" column: **Y** a live screen uses it · **N** no live screen · **D** UI exists only in dead files.

## Summary

| Area | Features | VERIFIED | UNVERIFIED | PARTIAL | MISSING | BROKEN | DISCONNECTED | REDUNDANT | BLOCKED |
|---|---|---|---|---|---|---|---|---|---|
| Accounts and identity | 11 | 0 | 7 | 0 | 0 | 0 | 2 | 0 | 2 |
| Authorization, workspaces, tenancy | 15 | 1 | 9 | 3 | 0 | 1 | 0 | 1 | 0 |
| User dashboard | 19 | 1 | 14 | 2 | 0 | 1 | 1 | 0 | 0 |
| Managed-site console | 18 | 0 | 9 | 1 | 0 | 6 | 0 | 0 | 2 |
| Website lifecycle and persistence | 10 | 1 | 8 | 1 | 0 | 0 | 0 | 0 | 0 |
| Visual editor | 27 | 1 | 19 | 2 | 1 | 2 | 2 | 0 | 0 |
| AI | 14 | 0 | 12 | 2 | 0 | 0 | 0 | 0 | 0 |
| Media and assets | 7 | 0 | 0 | 1 | 1 | 3 | 2 | 0 | 0 |
| Templates, reusable content, CMS | 10 | 2 | 6 | 0 | 0 | 2 | 0 | 0 | 0 |
| Publishing, preview, hosting | 13 | 0 | 5 | 3 | 0 | 4 | 0 | 0 | 1 |
| Billing, plans, quotas, agency | 11 | 0 | 7 | 0 | 1 | 0 | 2 | 1 | 0 |
| Site runtime features | 7 | 0 | 4 | 1 | 0 | 2 | 0 | 0 | 0 |
| Integrations and developer access | 9 | 0 | 7 | 0 | 0 | 2 | 0 | 0 | 0 |
| WordPress management console | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 16 |
| Developer platform | 22 | 2 | 14 | 3 | 0 | 3 | 0 | 0 | 0 |
| Data platform | 12 | 2 | 7 | 0 | 0 | 3 | 0 | 0 | 0 |
| Blueprint v2 governance routers | 14 | 0 | 13 | 0 | 0 | 0 | 1 | 0 | 0 |
| Platform administration, support, community | 13 | 0 | 13 | 0 | 0 | 0 | 0 | 0 | 0 |
| Security, operations, quality | 15 | 0 | 7 | 3 | 4 | 1 | 0 | 0 | 0 |
| **Total** | **263** | **10** | **161** | **22** | **7** | **30** | **10** | **2** | **21** |

---

## 1. Accounts and identity

| ID | Feature | Status | UI | Evidence | Gaps / verification needed |
|---|---|---|---|---|---|
| F-AUTH-01 | Email + password signup with email OTP | UNVERIFIED | Y | `modules/identity/*` local path | SEC-04 (uncommitted OTP leak); run `identity-security`, `local-otp-delivery` |
| F-AUTH-02 | Login + OTP + session cookie | UNVERIFIED | Y | same | SEC-04 |
| F-AUTH-03 | Logout | UNVERIFIED | Y | `oauth.routes.ts:10` | — |
| F-AUTH-04 | Managed OIDC sign-in, account linking | BLOCKED | Y | `oidc.routes.ts`, `features/identity/AuthenticationPage.tsx` | Needs an identity provider |
| F-AUTH-05 | Platform-admin step-up session (separate audience) | BLOCKED | Y | `platform-auth.routes.ts`, platform-control UI | Needs OIDC |
| F-AUTH-06 | Session list / revoke / revoke-all | UNVERIFIED | N | `auth.routes.ts:12-24` | No screen calls it |
| F-AUTH-07 | Create password for OAuth-created accounts | UNVERIFIED | N | `oauth.routes.ts:7` | — |
| F-AUTH-08 | Auth rate limiting (IP + DB buckets) | UNVERIFIED | — | `app.ts:100-179`, `LocalAuthentication.rateLimit` | — |
| F-AUTH-09 | Social login Google/GitHub | DISCONNECTED | N | returns `410 LEGACY_OAUTH_RETIRED` (intentional) | `GOOGLE_*`/`GITHUB_*` env vars unused |
| F-AUTH-10 | Support impersonation token | DISCONNECTED | N | returns `410 SUPPORT_TOKEN_RETIRED` (intentional) | — |
| F-AUTH-11 | Current user (`/auth/me`) | UNVERIFIED | Y | `me.routes.ts`, `AuthContext` | — |

## 2. Authorization, workspaces, tenancy

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-ACL-01 | Website roles (OWNER/ADMIN/EDITOR/…) and capability checks | UNVERIFIED | Y | `permission.service.ts:9-55` fail-closed | tests `point11-dynamic-permissions`, `milestoneA-permissions` not run |
| F-ACL-02 | Granular ALLOW/DENY overrides per resource | UNVERIFIED | Y | `RoleManagerModal`, `/:id/permissions` | — |
| F-ACL-03 | Content-only editing mode | UNVERIFIED | Y | `ContentOnlyInspector.tsx` | — |
| F-ACL-04 | Component access (allow-list per user) | PARTIAL **Δ** | D | editor reads `/component-access/:id/all`; manager UI `ComponentAccessModal` is dead (PROD-12) | Management UI |
| F-WS-01 | Personal organization + workspace auto-provisioning | UNVERIFIED | Y | `create-personal-website.ts:31-45` | — |
| F-WS-02 | Onboarding / free-plan assignment | PARTIAL | Y | PROD-01 | Explicit provisioning |
| F-WS-03 | Tenant workspaces: create, list, switch | UNVERIFIED | Y | `tenant-workspace.routes.ts`, `WorkspaceSwitcher` | — |
| F-WS-04 | Workspace invitations: send / inbox / accept / decline / revoke | UNVERIFIED | Y | `workspace-lifecycle.routes.ts:25-110`, `WorkspaceInvitationInbox` | — |
| F-WS-05 | Workspace archive / restore (read-only when archived) | UNVERIFIED | Y | lifecycle routes; `save-document.ts` | failed migration on dev DB (DATA-01) |
| F-WS-06 | Workspace ownership transfer | UNVERIFIED | Y | `workspace-lifecycle.routes.ts:52` | — |
| F-WS-07 | Workspace administration screen | UNVERIFIED | Y | `WorkspaceAdministration.tsx` | — |
| F-WS-08 | Teams (`/api/teams`, TeamSwitcher, TeamDashboardView) | REDUNDANT | Y | overlaps tenant workspaces; `/api/v1/workspaces` bound to both routers (ARCH-03) | Choose one model |
| F-WS-09 | Tenant isolation — application layer | VERIFIED | — | `tenant-scoped-apis.integration` 11/11 | Tested APIs only |
| F-WS-10 | Tenant isolation — SQL row-level security | PARTIAL | — | `tenant-rls.integration` 14/14 (4 tables); SEC-08 | Non-superuser role |
| F-WS-11 | Data-platform database ownership binding | BROKEN **Δ** | — | SEC-14 | Bind `databaseId` to project |

## 3. User dashboard (`/dashboard`, 12 tabs)

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-DASH-01 | Websites tab: list, search, create, open, delete | UNVERIFIED | Y | `UserDashboard.tsx` | — |
| F-DASH-02 | Start chooser (AI / template / blank) | UNVERIFIED | Y | `WebsiteStartChooser.tsx` | — |
| F-DASH-03 | Bulk verify / sync / delete | UNVERIFIED | Y | `website.routes.ts:215-217` | — |
| F-DASH-04 | Trash list / restore | UNVERIFIED | Y | `/trash/list`, restore | — |
| F-DASH-05 | Licensing tab | UNVERIFIED | Y | `LicensingPanel`, `license.routes.ts` | — |
| F-DASH-06 | Usage & limits tab | PARTIAL | Y | `UsageTelemetryWidget`; AI credits constant 0 (PROD-03); triggers plan provisioning (PROD-01) | Real usage |
| F-DASH-07 | White-label tab | UNVERIFIED | Y | `WhiteLabelPanel`, `/agency` | — |
| F-DASH-08 | Subscription & billing tab | PARTIAL | Y | `SubscriptionBillingPanel`; no paid upgrade (PROD-02) | — |
| F-DASH-09 | Developer API tab (API keys) | UNVERIFIED | Y | `DeveloperApiSettings`, `/apikeys` | — |
| F-DASH-10 | Plugin hub tab | UNVERIFIED | Y | `PluginHub`, `/plugins` | — |
| F-DASH-11 | Custom code snippets (incl. scheduled publication) | UNVERIFIED | Y | `CustomCodePanel`, `/custom-code`, scheduler 60 s | — |
| F-DASH-12 | Advanced code tab | UNVERIFIED | Y | `AdvancedCodePanel` | — |
| F-DASH-13 | Custom post types tab | VERIFIED | Y | `custom-post-type-cms.integration` 12/12 | — |
| F-DASH-14 | Composer installation tab | UNVERIFIED | Y | `ComposerPanel`, `/composer` | — |
| F-DASH-15 | Performance tab | BROKEN | Y | PROD-05 fabricated metrics | — |
| F-DASH-16 | Activity log | UNVERIFIED | Y | `ActivityLogModal`, `/audit-logs` | — |
| F-DASH-17 | Role manager | UNVERIFIED | Y | `RoleManagerModal` | — |
| F-DASH-18 | Workspace dashboard view (incl. organization billing panel) | UNVERIFIED | Y | `WorkspaceDashboardView` | — |
| F-DASH-19 | Developer features overview | DISCONNECTED | D | `DeveloperFeaturesOverview.tsx` dead | — |

## 4. Managed-site console (`ManagedSiteModal`, 18 tabs)

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-MS-01 | Overview / managed details | UNVERIFIED | Y | `/:id/managed-details` | — |
| F-MS-02 | Deployments list | UNVERIFIED | Y | publishing service | — |
| F-MS-03 | Domains + SSL | BROKEN | Y | PROD-04 (fabricated SSL, no Host routing), PROD-13 (simulated DNS outside production) | — |
| F-MS-04 | Staging environments | UNVERIFIED | Y | `staging.routes.ts` | — |
| F-MS-05 | Backups | PARTIAL | Y | in-row JSON backups (DATA-03) | Real backups |
| F-MS-06 | Server config / SFTP connection test | BROKEN | Y | PROD-13 (reports success outside production when it failed) | — |
| F-MS-07 | Security view (access logs, firewall) | BROKEN | Y | PROD-13 (fake access logs) | — |
| F-MS-08 | Performance | BROKEN | Y | PROD-05 | — |
| F-MS-09 | Image optimization | BROKEN | Y | PROD-13 | — |
| F-MS-10 | Mailer (SMTP config, test) | UNVERIFIED | Y | `mailer.routes.ts`; `SIMULATED` log when no SMTP (honest) | — |
| F-MS-11 | Email delivery logs | UNVERIFIED | Y | `/mailer/logs` | — |
| F-MS-12 | Forms & submissions | UNVERIFIED | Y | `FormSubmissionsModal` (dashboard), `/forms` | Export endpoint exists |
| F-MS-13 | Integrations tests (Sheets / Mailchimp / Zapier) | BROKEN | Y | PROD-11 #4 (wrong prefix → 404) | — |
| F-MS-14 | Client billing (agency invoicing) | UNVERIFIED | Y | `clientBilling.routes.ts` | — |
| F-MS-15 | Cookie consent | UNVERIFIED | Y | `/cookie-consent`, `CookieConsentBanner` | — |
| F-MS-16 | Logs transfer | UNVERIFIED | Y | tab present | — |
| F-MS-17 | WordPress tab | BLOCKED | Y | see §14 | Needs WordPress |
| F-MS-18 | WP-admin SSO / remote overview / DB optimise | BLOCKED | Y | `website.routes.ts:254-256` | Needs WordPress |

## 5. Website lifecycle and persistence

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-SITE-01 | Create website with plan limit | UNVERIFIED | Y | `create-personal-website.ts` | depends on F-WS-02 |
| F-SITE-02 | Load / rename / slug change | UNVERIFIED | Y | `save-document.ts` field permissions | — |
| F-SITE-03 | Versioned save (CAS, idempotency, 412 conflict) | UNVERIFIED | Y | `save-document.ts:40-140` | strong design; not executed |
| F-SITE-04 | Autosave + status indicator | UNVERIFIED | Y | `features/autosave` | browser test |
| F-SITE-05 | Trash / restore | UNVERIFIED | Y | — | — |
| F-SITE-06 | Approved permanent purge | VERIFIED | Y | `website-purge.integration` 6/6 | — |
| F-SITE-07 | Revision history panel / restore | UNVERIFIED | Y | `RevisionHistoryPanel`, `/revisions` | — |
| F-SITE-08 | Website-kit import (dashboard file import) | PARTIAL | Y | PROD-06 (first page only) | — |
| F-SITE-09 | Website members / invitations / roles | UNVERIFIED | Y | service-level OWNER/ADMIN checks | — |
| F-SITE-10 | Enterprise multisite (site network) | UNVERIFIED | Y | `enterpriseMultisite.routes.ts` (15/16 endpoints called) | — |

## 6. Visual editor

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-ED-01 | Canvas, drag/drop, selection, structure | UNVERIFIED | Y | `WebsiteEditor.tsx` (21k lines) | No browser test (QA-04) |
| F-ED-02 | Widgets that work in editor **and** on the published site (84 of 127 types incl. containers) | UNVERIFIED | Y | [12](12-editor-widget-catalog.md) | Browser test |
| F-ED-03 | Widgets that vanish on the published site (21) / no renderer (1) | BROKEN **Δ** | Y | PROD-10 | — |
| F-ED-04 | Declared widget types with no implementation (20) | MISSING **Δ** | N | [12](12-editor-widget-catalog.md) | — |
| F-ED-05 | Custom HTML element in canvas | BROKEN | Y | SEC-05 | — |
| F-ED-06 | Inspectors (style, layout, typography, dynamic widget settings) | UNVERIFIED | Y | `inspector/*` | — |
| F-ED-07 | Responsive breakpoints / device preview | UNVERIFIED | Y | — | — |
| F-ED-08 | Undo / redo, copy/paste elements and styles | UNVERIFIED | Y | client state | — |
| F-ED-09 | Page manager (multi-page) | UNVERIFIED | Y | `PageManagerModal` | — |
| F-ED-10 | Popup manager + runtime preview | UNVERIFIED | Y | `PopupManagerModal`, `PopupRuntimePreview` | `PopupSettingsPanel` dead |
| F-ED-11 | Class manager (global CSS classes) | UNVERIFIED | Y | `ClassManagerModal` | — |
| F-ED-12 | Variables / design tokens manager | UNVERIFIED | Y | `VariablesManagerModal`, `/websites/:id/design-system` | — |
| F-ED-13 | Icon picker, font picker / dynamic fonts | UNVERIFIED | Y | `IconPickerModal`, `FontPickerModal` | — |
| F-ED-14 | Motion / interactions | UNVERIFIED | Y | `MotionInteractionInspector` | — |
| F-ED-15 | Developer modal (code import / page CSS) | UNVERIFIED | Y | `DeveloperModal`, `utils/codeImporter.ts` | — |
| F-ED-16 | Code export (preview + ZIP) from editor | PARTIAL **Δ** | D | `CodeExportModal` dead; ZIP link in PublishModal | — |
| F-ED-17 | A/B experiments manager + impression/conversion tracking | UNVERIFIED | Y | `ExperimentManagerModal` (7/7 endpoints wired) | — |
| F-ED-18 | SEO analyzer | UNVERIFIED | Y | `SeoAnalyzerModal`, `/seo/*` | — |
| F-ED-19 | Multilingual export | UNVERIFIED | Y | `MultilingualExportModal` | — |
| F-ED-20 | Accessibility statement / widgets for visitors | UNVERIFIED | Y | `components/accessibility/*` | — |
| F-ED-21 | Support credentials modal | UNVERIFIED | Y | `SupportCredentialsModal` | — |
| F-ED-22 | Design notes (create / resolve / reopen) | PARTIAL **Δ** | D | overlay renders; `NotesPanel` dead; open flag never set (PROD-12) | — |
| F-ED-23 | Live presence / cursors | UNVERIFIED | Y | `/ws/presence` | `presence-security` test needs own DB |
| F-ED-24 | Visual ↔ code synchronization | VERIFIED | Y | 145/146 + 16/16 tests (QA-08 one failure) | — |
| F-ED-25 | Atomic editor: forms, grid, loop, classes, variables, reusable components, global elements | UNVERIFIED | Y | `features/atomic-editor/*` (33 components) | Default form action broken (PROD-11 #9) |
| F-ED-26 | Keyboard accessibility helpers | DISCONNECTED | D | `utils/keyboardAccessibility.ts` dead | — |
| F-ED-27 | Frontend plugin system | DISCONNECTED | D | `plugins/*` dead | — |

## 7. AI

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-AI-01 | Site generation → changeset → review → version-bound apply | UNVERIFIED | Y | `site-generation.service.ts`, `save-document.ts:47-98` | No live provider call; PROD-03 |
| F-AI-02 | Text / refine / section / container / layout generation | UNVERIFIED | Y | `modules/ai/*` | — |
| F-AI-03 | Animation / dynamic-property / SEO generation, site analysis | UNVERIFIED | Y | — | — |
| F-AI-04 | Image generation / edit / background removal / variations / replace | UNVERIFIED | Y | `modules/ai/images/*` | — |
| F-AI-05 | Code generation / preview / explain | UNVERIFIED | Y | `code/code-generation.service.ts` | — |
| F-AI-06 | Design assistant (Stitch / Claude design executions, durable job) | UNVERIFIED | Y | `DesignAssistant.tsx`, worker `AI_DESIGN_EXECUTION` | — |
| F-AI-07 | Unified AI assistant (intent routing) | UNVERIFIED | Y | `UnifiedAiAssistant`, `assistant-orchestrator` | — |
| F-AI-08 | Provider routing + fallback | UNVERIFIED | — | `provider-routing.ts` | — |
| F-AI-09 | AI quota / cost control | PARTIAL | Y | PROD-03 | — |
| F-AI-10 | Prompt library (CRUD) | UNVERIFIED | Y | `/ai/prompts` | — |
| F-AI-11 | Prompt encryption, retention, cleanup | UNVERIFIED | — | `prompt-vault.ts`, cleanup scheduler | — |
| F-AI-12 | AI hosting tool | UNVERIFIED | N | `aiHosting.routes.ts` (API-only) | — |
| F-AI-13 | Developer-workspace AI agents (planning, architecture, coding, multi-agent, MCP, memory) | UNVERIFIED | Y | 43 `/projects/:id/ai/*` endpoints, 37 called | — |
| F-AI-14 | Full-stack application generation (Blueprint v2.1) | PARTIAL | Y | `app-generation.integration` 12/12 (template path) | Live AI, DATA-06 |

## 8. Media and assets

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-MED-01 | Editor image upload | PARTIAL | Y | SEC-07 | — |
| F-MED-02 | Media library browse / rename / delete | DISCONNECTED **Δ** | D | API exists; `MediaLibraryModal` never imported (PROD-12) | — |
| F-MED-03 | Video upload | BROKEN **Δ** | Y | PROD-11 #6 | — |
| F-MED-04 | Dynamic-widget file upload | BROKEN **Δ** | Y | PROD-11 #7 | — |
| F-MED-05 | Governed organization file storage (S3, quarantine, scan) | DISCONNECTED | N | PROD-07 | — |
| F-MED-06 | Image optimization | BROKEN **Δ** | Y | PROD-13 | — |
| F-MED-07 | Storage quota | MISSING | — | not enforced | — |

## 9. Templates, reusable content, CMS

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-TPL-01 | Built-in templates (home/about/contact/career/pro) | UNVERIFIED | Y | static data | — |
| F-TPL-02 | Template library: save / rename / replace / delete / import | UNVERIFIED | Y | `features/templates/components/*` | — |
| F-TPL-03 | Template share link + public preview page | UNVERIFIED | Y | `/template/share/:token` | — |
| F-TPL-04 | Template transfer | UNVERIFIED | Y | `TransferTemplateDialog` | — |
| F-TPL-05 | Global widgets: list / save / delete | UNVERIFIED | Y | `GlobalWidgetLibrary` | — |
| F-TPL-06 | Global widgets: update | BROKEN **Δ** | Y | PROD-11 #2 | — |
| F-TPL-07 | Website-kit library (browse / apply) | BROKEN **Δ** | Y | PROD-11 #1 | — |
| F-TPL-08 | Custom post types: types, fields, entries, trash, purge requests | VERIFIED | Y | 12/12 tests | — |
| F-TPL-09 | Forms (builder, submissions, export) | UNVERIFIED | Y | `form.routes.ts`; in-editor form panels dead | — |
| F-TPL-10 | Lead intake (durable) | VERIFIED | N | `lead-intake.integration` 5/5 | No UI |

## 10. Publishing, preview, hosting

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-PUB-01 | Pre-publish validation | UNVERIFIED | Y | `validateWebsiteForPublish` | — |
| F-PUB-02 | Publish to internal snapshot | PARTIAL | Y | DATA-02 | — |
| F-PUB-03 | Public site `/site/:id[/:slug]` | PARTIAL | — | PROD-04(c), PROD-10 | SSR/static, widget parity |
| F-PUB-04 | Draft preview `/preview/site/:id` | PARTIAL **Δ** | Y | same renderer → same widget gaps (PROD-10) | — |
| F-PUB-05 | Deployments, releases, instant rollback, promote | UNVERIFIED | Y | `publishing.service.ts:751-1360` | DATA-03 |
| F-PUB-06 | Scheduled site publish | UNVERIFIED | ? | backend `/schedule-publish`; unused client functions call a non-existent path (11 §1) | — |
| F-PUB-07 | Publish approval workflow | BROKEN **Δ** | Y | PROD-11 #3 — enforcement exists, request creation impossible | — |
| F-PUB-08 | Static ZIP export | UNVERIFIED | Y | `export.routes.ts`, `staticCompiler.ts` | — |
| F-PUB-09 | SFTP publishing | BLOCKED | Y | needs SFTP target | — |
| F-PUB-10 | Custom domains + SSL | BROKEN | Y | PROD-04 | — |
| F-PUB-11 | Project hosting runtime `/api/hosted` | BROKEN | — | SEC-06 | — |
| F-PUB-12 | Hello-theme export (WordPress theme ZIP) | UNVERIFIED | N | `export.routes.ts:17-18` | — |
| F-PUB-13 | WordPress plugin download link in publish modal | BROKEN **Δ** | Y | PROD-11 #8 | — |

## 11. Billing, plans, quotas, agency

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-BIL-01 | Plan catalogue | UNVERIFIED | Y | auto-created on `GET /plans` | — |
| F-BIL-02 | Paid upgrade that changes enforced limits | DISCONNECTED | Y | PROD-02 | — |
| F-BIL-03 | Organization Stripe checkout + webhook | UNVERIFIED | Y | `modules/billing`, `OrganizationBillingPanel` | Stripe test keys |
| F-BIL-04 | Second Stripe implementation (`services/billing`) | REDUNDANT | — | dead checkout, live 2nd webhook | — |
| F-BIL-05 | PayPal payment integrity | UNVERIFIED | — | test not run | — |
| F-BIL-06 | Website-count limit | UNVERIFIED | — | `create-personal-website.ts:25-29` | — |
| F-BIL-07 | Storage limit | MISSING | — | — | — |
| F-BIL-08 | AI credit limit per plan | DISCONNECTED | — | PROD-03 | — |
| F-BIL-09 | Quota reservation API | UNVERIFIED | N | `billing.service.ts:212` (no consumer) | — |
| F-BIL-10 | Licences | UNVERIFIED | Y | `license.routes.ts` | — |
| F-BIL-11 | White-label branding | UNVERIFIED | Y | `/agency` | — |

## 12. Site runtime features (visitor-facing)

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-RUN-01 | Contact / subscribe forms (atomic form default action) | BROKEN **Δ** | Y | PROD-11 #9 | — |
| F-RUN-02 | PayPal button widget | BROKEN **Δ** | Y | PROD-11 #5 | — |
| F-RUN-03 | Commerce: products, cart, coupons, orders | PARTIAL | Y | PROD-08 (no payment capture) | — |
| F-RUN-04 | Cookie consent banner | UNVERIFIED | Y | — | — |
| F-RUN-05 | Custom code injection (sandboxed JS, sanitized HTML) | UNVERIFIED | Y | `CodeInjectionRuntime.tsx` | — |
| F-RUN-06 | Dynamic tokens, structured data, meta tags | UNVERIFIED | Y | `PublishedSite.tsx:1200-1240` (client-side only) | Crawlers see no content (PROD-04) |
| F-RUN-07 | Experiment impression / conversion tracking | UNVERIFIED | Y | `PublishedSite.tsx:1059,1075` | — |

## 13. Integrations and developer access

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-INT-01 | API keys | UNVERIFIED | Y | — | — |
| F-INT-02 | Public API v1 (`/api/v1/...`) | UNVERIFIED | N | `api-v1.routes.ts` | — |
| F-INT-03 | Outgoing webhooks / retries | UNVERIFIED | — | `WEBHOOK_RETRY` | — |
| F-INT-04 | Third-party integration endpoints (PayPal, Stripe session, CRM, dynamic data, Sheets/Mailchimp/Zapier tests) | BROKEN | Y | all UI calls use `/api/integrations`, router only at `/api/v1` (PROD-11) | — |
| F-INT-05 | Plugin compatibility registry | UNVERIFIED | Y | `/plugins` | — |
| F-INT-06 | Plugin integration field sync | BROKEN **Δ** | N | PROD-13 (constant result) | — |
| F-INT-07 | Elementor Cloud | UNVERIFIED | N | API-only | — |
| F-INT-08 | Secret references / connector credentials | UNVERIFIED | N | API-only | — |
| F-INT-09 | Multisite (legacy `/api/multisite`) | UNVERIFIED | N | API-only | — |

## 14. WordPress management console (`/websites/:id/wordpress/*`, ~110 endpoints, 25 tests not run)

| ID | Feature | Status | UI | Evidence |
|---|---|---|---|---|
| F-WP-01 | Connect / verify / status / disconnect / revoke | BLOCKED | Y | f484–f487 tests |
| F-WP-02 | Site information and health | BLOCKED | Y | f488–f489 |
| F-WP-03 | Pages CRUD, duplicate, reorder, import | BLOCKED | Y | f490–f492 |
| F-WP-04 | Media upload / management | BLOCKED | Y | f493–f494 |
| F-WP-05 | Publish (HTML / Gutenberg), status, rollback, jobs | BLOCKED | Y | f495–f500 |
| F-WP-06 | Forms + submissions sync | BLOCKED | Y | f501 |
| F-WP-07 | SEO sync / reconcile | BLOCKED | Y | f502 |
| F-WP-08 | Analytics config / sync | BLOCKED | Y | f503 |
| F-WP-09 | Menus and locations | BLOCKED | Y | f504 |
| F-WP-10 | Webhooks (outgoing config + inbound delivery) | BLOCKED | Y | f505; SEC-15 |
| F-WP-11 | Plugins install / activate / update / delete | BLOCKED | Y | f506 |
| F-WP-12 | Themes install / activate / update / delete | BLOCKED | Y | f507 |
| F-WP-13 | Cache purge / clear / warm | BLOCKED | Y | f508 |
| F-WP-14 | ACF / Toolset / Pods fields, Gutenberg sync, multisite sites | BLOCKED | Y | — |
| F-WP-15 | WP-admin SSO, DB optimise | BLOCKED | Y | — |
| F-WP-16 | WordPress plugin (PHP, `wordpress-plugin/`) | BLOCKED | — | not inspected |

## 15. Developer platform (`/workspace/:projectId`, 406 endpoints)

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-DEV-01 | Projects, manifest, lifecycle, clone, import | UNVERIFIED | Y | project routes | — |
| F-DEV-02 | File tree, multi-file Monaco editor, snapshots | UNVERIFIED | Y | `ProjectExplorer`, `MultiFileEditor` | — |
| F-DEV-03 | Realtime workspace sync (`/ws/workspace-sync`) | VERIFIED | Y | 28/28 tests | — |
| F-DEV-04 | Page registry and roundtrip ownership | VERIFIED | Y | `page-registry.integration` 5/5 | QA-08 |
| F-DEV-05 | Terminal (HTTP + WebSocket) | BROKEN | Y | SEC-01, SEC-02 | — |
| F-DEV-06 | Runtime (run app, logs, ports) — 47 endpoints | BROKEN (security) | Y | host execution (SEC-02) | Isolation |
| F-DEV-07 | Build, compile, preview | UNVERIFIED | Y | `BuildPanel`, `LivePreviewPanel` | — |
| F-DEV-08 | Git (24) and GitHub (13) | UNVERIFIED | Y | `GitPanel` | — |
| F-DEV-09 | DevOps / CI-CD pipelines | UNVERIFIED | Y | `CicdPanel`, `DeveloperOpsSecurityPanel` | — |
| F-DEV-10 | Containers | PARTIAL | Y | simulated container build (PROD-13 list) | — |
| F-DEV-11 | Dependencies | PARTIAL | Y | offline "known packages" simulation (`forgeDependency.service.ts:75`) | — |
| F-DEV-12 | Quality: API collections, test runner, analyzers | UNVERIFIED | Y | `DeveloperQualityPanel` | — |
| F-DEV-13 | Code intelligence / knowledge graph (per project) | UNVERIFIED | Y | `DeveloperIntelligencePanel` | — |
| F-DEV-14 | Collaboration (project) | UNVERIFIED | Y | 15 endpoints | — |
| F-DEV-15 | Extensions, MCP servers | UNVERIFIED | Y | — | — |
| F-DEV-16 | Debug sessions | UNVERIFIED | Y | `DebugPanel` | — |
| F-DEV-17 | Project domains / hosting / deployments | PARTIAL | Y | `DomainPanel`, `HostingPanel`; SEC-06 | — |
| F-DEV-18 | Monorepo, infra, architecture analysis | UNVERIFIED | Y/N | architecture has no UI | — |
| F-DEV-19 | Command palette | UNVERIFIED | Y | `CommandPaletteModal` | — |
| F-DEV-20 | Endpoints with no UI (application-spec, data-model, environment, generator, roundtrip, templates, auth, benchmark, components, design-system, workspace) | UNVERIFIED | N | [10](10-api-endpoint-catalog.md) | — |
| F-DEV-21 | Durable ApplicationSpec revisions | BROKEN (exec) | N | DATA-06, 4 failing tests | — |
| F-DEV-22 | CLI | UNVERIFIED | N | `backend/src/cli`, `forgeCli.service.ts` | — |

## 16. Data platform (per-project databases)

| ID | Feature | Status | UI | Evidence | Gaps |
|---|---|---|---|---|---|
| F-DATA-01 | Database provisioning per environment | UNVERIFIED | Y | `database-provisioner.service.ts` | — |
| F-DATA-02 | Schema Studio (tables, columns, visual designer, schema visualizer, data grid) | UNVERIFIED | Y | `features/database-studio/*` | — |
| F-DATA-03 | Table create / alter | BROKEN **Δ** | Y | SEC-13 (DDL injection) | — |
| F-DATA-04 | SQL console | BROKEN **Δ** | Y | SEC-12 | — |
| F-DATA-05 | Migration authority (preflight, rehearsal, approval, fenced execution, reconciliation) | VERIFIED | Y | 27/27 + 3/3 | — |
| F-DATA-06 | Environment bindings / secrets isolation | VERIFIED | N | 8/8 | — |
| F-DATA-07 | Row CRUD, pagination, sort | UNVERIFIED | Y | studio routes | — |
| F-DATA-08 | Auto-generated REST API configs, OpenAPI, typed client | UNVERIFIED | Y | `project.routes.ts:607-610` | — |
| F-DATA-09 | Data API / SDK for generated apps | UNVERIFIED | N | `data.routes.ts` | — |
| F-DATA-10 | Object storage per project | UNVERIFIED | Y/N | `ObjectStoragePanel`; storage router has no UI caller | — |
| F-DATA-11 | Realtime change feed | BROKEN | — | SEC-03 | — |
| F-DATA-12 | Database backup | UNVERIFIED | — | `database-backup.service.ts` | — |

## 17. Blueprint v2 governance routers (all API-only; mount + auth verified by `v2-feature-routers.integration` 14/14)

| ID | Router | Status | UI |
|---|---|---|---|
| F-V2-01 | service-objectives | UNVERIFIED | N |
| F-V2-02 | adaptive-infrastructure | UNVERIFIED | N |
| F-V2-03 | hosting-export | UNVERIFIED | N |
| F-V2-04 | security-audit (incl. quota/abuse check) | UNVERIFIED | N |
| F-V2-05 | workflows-communication (definitions, simulation) | UNVERIFIED | N |
| F-V2-06 | forms-leads | UNVERIFIED | N |
| F-V2-07 | owner-experience | UNVERIFIED | N |
| F-V2-08 | marketing-analytics | UNVERIFIED | N |
| F-V2-09 | search-quality | UNVERIFIED | N |
| F-V2-10 | delivery-governance | UNVERIFIED | N |
| F-V2-11 | components (contracts) | UNVERIFIED | N |
| F-V2-12 | benchmark (platform admins) | UNVERIFIED | N |
| F-V2-13 | capabilities (registry) | UNVERIFIED | N |
| F-V2-14 | release-integrity, website-contract (unmounted) | DISCONNECTED | N |

## 18. Platform administration, support, community

| ID | Feature | Status | UI | Evidence |
|---|---|---|---|---|
| F-ADM-01 | Platform control: capabilities, change requests, approve/apply | UNVERIFIED | Y | `PlatformControlPage` |
| F-ADM-02 | SaaS control plane `/platform/v1` | UNVERIFIED | N | API-only |
| F-ADM-03 | Admin dashboard | UNVERIFIED | Y | `AdminDashboard.tsx` |
| F-ADM-04 | Super-admin dashboard | UNVERIFIED | Y | `SuperAdminDashboard.tsx` |
| F-ADM-05 | Audit log API | UNVERIFIED | Y | `/audit-logs` |
| F-ADM-06 | Operations (jobs, dead letters, outbox) | UNVERIFIED | Y | `operations.routes.ts` (8/15 called) |
| F-ADM-07 | Health / diagnostics / migration status | UNVERIFIED | N | SEC-09 |
| F-SUP-01 | Support tickets: create, list, detail, messages | UNVERIFIED | Y | 29 endpoints, `ticketService` |
| F-SUP-02 | Ticket ops: assign, priority, status, merge, split, bulk, duplicates | UNVERIFIED | Y | — |
| F-SUP-03 | SLA, canned responses, teams, categories, CSAT, analytics, audit | UNVERIFIED | Y | `SupportAdminView` |
| F-FOR-01 | Forum: categories, topics, posts, tags | UNVERIFIED | Y | 20 endpoints |
| F-FOR-02 | Forum: reactions, accepted answer, bookmarks, follow | UNVERIFIED | Y | — |
| F-FOR-03 | Forum: reports, moderation queue, analytics | UNVERIFIED | Y | — |

## 19. Security, operations, quality

| ID | Feature | Status | UI | Evidence |
|---|---|---|---|---|
| F-SEC-01 | API security headers (helmet) / CORS allow-list | UNVERIFIED | — | `app.ts:122-150` |
| F-SEC-02 | SPA security headers | MISSING | — | SEC-11 |
| F-SEC-03 | Cookie-mutation origin checks | UNVERIFIED | — | `browser-origin.ts` |
| F-SEC-04 | Per-user API rate limit (v2 routers) | UNVERIFIED | — | `userRateLimit.middleware.ts` |
| F-SEC-05 | Audit logging | PARTIAL | Y | failures swallowed (DATA-05) |
| F-SEC-06 | Secrets handling (`.env` ignored, encrypted prompts) | UNVERIFIED | — | — |
| F-OPS-01 | Background jobs (leases, retries, dead letters, outbox) | UNVERIFIED | — | `jobRunner.ts` |
| F-OPS-02 | Structured logging / error tracking / metrics / alerts | MISSING | — | QA-06 |
| F-OPS-03 | Platform DB backups | MISSING | — | QA-07 |
| F-OPS-04 | Schema migrations (fresh install) | BROKEN (exec) | — | DATA-01 |
| F-OPS-05 | Docker compose stack | UNVERIFIED | — | not started |
| F-OPS-06 | CI/CD | PARTIAL | — | QA-05 |
| F-OPS-07 | Onboarding guidance | MISSING | — | — |
| F-OPS-08 | App accessibility audit (dashboard / editor) | UNVERIFIED | — | — |
| F-OPS-09 | Consistent UI states (no `alert()`) | PARTIAL | Y | PROD-09 |

## 20. Status changes since the 1st pass (Δ)

| ID | 1st pass | 2nd pass | Reason |
|---|---|---|---|
| F-MED-02 media library | UNVERIFIED | DISCONNECTED | UI component never imported |
| F-PUB-04 preview | UNVERIFIED | PARTIAL | shares the published renderer's widget gaps |
| F-ED-16, F-ED-22, F-ACL-04 | — / UNVERIFIED | PARTIAL | management UI only in dead files |
| F-ED-03, F-ED-04 | (inside F-ED-01) | BROKEN / MISSING | widget catalogue |
| F-MED-03/04, F-TPL-06/07, F-PUB-07/13, F-RUN-01/02, F-INT-04 | — / UNVERIFIED | BROKEN | endpoint contract analysis |
| F-MED-06, F-INT-06 | UNVERIFIED | BROKEN | fabricated outputs |
| F-DATA-03/04, F-WS-11 | (inside F-INT-04) | BROKEN | SQL console, DDL injection, database IDOR |
| F-BIL-03 | REDUNDANT | UNVERIFIED (live) + F-BIL-04 REDUNDANT | the 2nd checkout router is dead, not mounted |

## 21. Status counts

| Status | Count | Share |
|---|---|---|
| VERIFIED | 10 | 4% |
| UNVERIFIED | 161 | 61% |
| PARTIAL | 22 | 8% |
| MISSING | 7 | 3% |
| BROKEN | 30 | 11% |
| DISCONNECTED | 10 | 4% |
| REDUNDANT | 2 | 1% |
| BLOCKED | 21 | 8% |
| **Total** | **263** | 100% |

Counting rule: one primary status per row (the first word of the Status cell). Rows that group several sub-features (e.g. F-ED-02 = 84 widget types, F-ED-03 = 22, F-ED-04 = 20) count once; the per-widget breakdown is in [12](12-editor-widget-catalog.md) and per-endpoint detail in [10](10-api-endpoint-catalog.md).
