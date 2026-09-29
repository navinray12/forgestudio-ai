# Increment 10: apply verified workspace/editor integration

Eight exact source replacements were qualified in GitHub Actions run
36410179462 at base 468ac8c2f1dce2752474a8d3a53732c0cd9821e6. The run passed
both production builds, 167 source-unit checks, and all nine nested PostgreSQL/
HTTP scenarios (10 reported tests including their parent). Exported Git blob
hashes were checked against the locally reviewed replacements before application.

The real-database scenarios cover concurrent duplicate workspace commands,
changed-payload conflicts, sibling-workspace isolation, role/owner protection,
concurrent last-slot website quotas, audit rollback, forced RLS for the new
journal/outbox under a non-owner role, route validation and organization
revocation. This is not repository-wide isolation or performance certification.

## Live application wiring in source

The app now mounts /api/v1/tenant-workspaces. Existing /workspaces team aliases
remain compatible. The customer dashboard renders genuine workspace selection,
creation, scoped sites and current organization-member management. Switching
between team/personal/workspace contexts clears incompatible selection/modal
state. Workspace kit import remains explicitly disabled until implemented.

The legacy website resolver now checks current organization/workspace scope;
creator attribution cannot bypass revoked membership. New personal websites
receive a personal organization/default workspace and transactional quota check.
Importing website.service no longer invokes its old schema initialization.

Editor routing keys the editor instance by website ID. Initial loading requires
an authorized server response and cannot recover a denied site from old browser
storage. Pending load requests are cancelled on unmount. Unknown UI roles default
to VIEWER. Manual save/autosave advance their saved baseline only after a valid
server acknowledgement, not after writing browser storage or catching an error.

## Deployment prerequisites and limitations

Apply the reviewed additive migration
20260928090000_workspace_command_journal through the controlled migration
process after a backup and migration-drift review, before exposing the new
workspace commands. Do not use db push on production. The schema now records the
journal/outbox models; SQL remains authoritative for forced RLS/partial indexes.
No production migration was executed during this implementation session.

Workspace archive/restore, invitations, ownership transfer, cross-organization
moves, organization-scoped subscriptions, complete legacy ownership backfill and
repository-wide forced RLS are still pending. The new outbox retains intents;
its production dispatcher/delivery contract is not implemented. Legacy editor
revision/ETag and durable save idempotency remain open; truthful save errors do
not by themselves solve concurrent editing. Browser E2E, customer-content origin
provisioning, cloud/load/restore qualification and production deployment remain
unverified. Historical bootstrap credentials require operator rotation.

The one-time contents-write qualification workflows are retired after their
validated blobs were applied. Ongoing production-build, source-unit and disposable
PostgreSQL/HTTP workflows remain enabled, as does the original Part B workflow.
That legacy workflow has not been certified passing and must not be hidden by
this new evidence.
