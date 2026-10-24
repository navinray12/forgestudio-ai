# WP-00–WP-04 — Six-task delivery verification and blockers

**Date:** 24 October 2026  
**Branch:** `phase2/production-hardening` into draft [PR #42](https://github.com/navinray12/forgestudio-ai/pull/42). Source `sconfigtesting` untouched.  
**Verified code commit:** `e2956e0d88717d0e457542787e1f7170a315dded`.  
**CI evidence:** [Phase 2 qualification #40084498359](https://github.com/navinray12/forgestudio-ai/actions/runs/40084498359), **9/9 jobs passed**; frontend full lint separately passed. Identity and AI/worker workflows were in progress when last checked and are not counted.

This is a **surgical change report**, NOT a declaration that the five scopes, six product tasks, or the entire SaaS product are certified for production. Update the canonical issue registers when new failures are discovered instead of repeating an unbounded refactor.

## Six requests — implementation evidence and incomplete requirements

| # | Scope/task | Specific delivered code | Verified result | Remaining release gate |
|---|---|---|---|---|
| 1 | WP-04 trusted public forms & integrations | `services/form/trustedFormPolicy.service.ts` resolves persisted website-owned form settings; `form.service.ts` ignores visitor-supplied webhook/email/Sheets/Zapier/Mailchimp destinations, secrets and spam policy; notification HTML escaped. Unknown legacy forms are **database-only** rather than secretly dispatching visitors' requested integrations. | `wp04-trusted-form-actions.test.ts` in focused CI; lead intake continues to use durable `acceptSubmission`. | Move outbound credentials out of editor/public document into encrypted server-only integration settings; verify actual provider delivery, retries, consent and owner notification E2E. |
| 2 | WP-02 shared-schema database + recovery | `forgeDatabase.service.ts` no longer creates database as side effect of GET; `connectionManager.ts` removes public from tenant search_path and refuses shared control-plane admin SQL execution in production. | `wp02-legacy-read-provision.test.ts`, existing tenant isolation tests, 42 migrations, 11 real HTTP/Postgres cases and 14 restricted-role RLS cases passed. | Replace production legacy shared-schema path with independently restricted tenant identities or formally retire it, then verify rotation, backup/restore, limits and failover in staging. Production legacy path currently **UNAVAILABLE**. |
| 3 | WP-01 runtime & WebSocket security | Existing production host-shell quarantine remains. `realtime.service.ts` revalidates website access before each event, closes revoked sockets, and no longer includes row data in PostgreSQL NOTIFY. | `wp01-realtime-subscription-isolation.test.ts` includes revoked-member negative case. | An independently attested container/microVM runner with network/filesystem quotas, resource caps, logging and adversarial tests is **NOT IMPLEMENTED**. No production customer-code execution certification. |
| 4 | WP-03 visual editor reliability | Existing optimistic document version/conditional update and 412 conflict path preserved. Added dedicated editor CI job for manual save, history, publish, page management and payloads; did not rewrite editor architecture. | **41/41 editor-flow tests**, plus 21 global-widget/template frontend contract tests and successful frontend build. | Full real-browser editor → preview → live domain rendering parity matrix, concurrent-actor E2E, linked global-widget behavior and CMS pages are still OPEN. |
| 5 | WP-04 media/CMS | `storage.controller.ts` limits public image transforms to registered object in same website's explicitly PUBLIC bucket. `s3-client.ts` requires production HTTPS and non-default credentials, HEAD checks actual objects; `upload-presigner.service.ts` requires website/bucket ownership, content length/type match and quota inside transaction. Local media fallback remains blocked in production. | Media authorization, signed-upload confirmation, image-transform and storage-config contract suites in 126 focused backend tests; build passed. | Real configured S3/MinIO direct upload → confirm → published signed/public URL, CDN/retention/restore; CMS templates/kits list/detail and live pages not fully delivered. |
| 6 | WP-00 one-time repo inventory/audit | `scripts/phase2-source-inventory.mjs` hashes checked-in route/controller/editor/CMS/migration/test source groups at exact commit. CI uploads immutable manifest artifact; preserve existing canonical issue IDs and code layout. `form.service.ts` removed import-time DDL; `server.ts` verifies the existing migrated submission table before HTTP starts. | Source inventory CI passed; artifact attached to [run #40084498359](https://github.com/navinray12/forgestudio-ai/actions/runs/40084498359). **87 backend route source files** and **310 editor source files** are counted by deterministic patterns, NOT 87 functional routes or 310 delivered features. | Human-reviewed feature/route acceptance matrix, owner-tested staging flows and product release signoff remain OPEN. |

## Exact run evidence, not projections

[GitHub Phase 2 qualification 40084498359](https://github.com/navinray12/forgestudio-ai/actions/runs/40084498359), commit `e2956e0d88717d0e457542787e1f7170a315dded`:

- Source inventory: passed, manifest artifact uploaded.
- Backend build / frontend build: passed.
- Legacy hosting / WP-01–WP-04 focused backend tests: **126/126 passed**, 19 test files.
- Global Widget/template frontend contract tests: **21/21 passed**, 3 files.
- Editor save/history/publish/page management regression: **41/41 passed**, 5 files.
- MCP/authorization/XSS regression: **247/247 passed**, 5 files.
- Fresh PostgreSQL migration: **42 applied**, status current; actual dedicated-tenant HTTP integration **11/11 passed**.
- Independent restricted PostgreSQL role/RLS integration: **14/14 passed**.

The separate frontend lint workflow on the same SHA passed; separate identity/AI jobs must be verified individually at that SHA. Passing automated tests does not prove an Internet-exposed runtime, CDN, object store, external provider, full website publishing, or all tenant boundaries.

## Required production decisions

1. Select and provision a genuine isolated executor or remove untrusted code execution from production scope.
2. Select the permanent tenant DB model for legacy ForgeDatabase; execute a data migration or disable all production legacy entry points (currently blocked).
3. Configure production secrets and durable S3/MinIO; prove end-to-end uploads, public/private delivery, and rollback.
4. Move form integration secrets to server-only encrypted store; prohibit publishing raw credentials in editor document.
5. Complete browser E2E for every advertised widget, CMS page, form, media, publish/domain TLS and concurrent edits.
6. Complete comprehensive feature matrix and production recovery/security review. **No merge/release without independent approval and these gates.**

**Status:** Verified security/data/editor groundwork and tests; WP-00/WP-01/WP-02/WP-03/WP-04 remain **IN PROGRESS**. Overall release **NO-GO**.
