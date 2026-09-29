# Increment 12 — workspace lifecycle, settings and recipient-bound invitations

Adds settings (name, canonical locale and time zone), strong workspace-version
preconditions, role changes, atomic ownership transfer, archive/restore, and
in-app invitations with acceptance, seven-day expiry, renewal and revocation.
The customer dashboard and invitation inbox use these real endpoints.

Decisions for this slice: organization is the security/billing tenant; only the
workspace owner transfers ownership or archives/restores; the previous owner
becomes an administrator. Invitations are authenticated recipient-bound in-app
records for existing organization members with verified email. An invitation ID
is not a bearer credential. No email is sent or advertised as sent. External
organization onboarding, guest-seat commercial policy and email delivery remain
separate contracts, not implicit membership grants.

A replacement requires If-Match: "<resource UUID>:<version>" plus an idempotency
key. Replays are reauthorized. Mandatory audit, result and outbox intent share
the mutation's serializable transaction. Owner continuity is checked by deferred
SQL constraint triggers, including legacy direct member writes.

Archiving preserves data and live published artifacts; it is not deletion.
Pending deployments, scheduled snippets and website jobs must drain or reconcile.
Archived sites resolve to viewer; permission overrides cannot restore mutation
rights. Database triggers block website and directly site-owned business writes,
serialize admission with archive, and prevent parent/tenant inconsistencies.
Telemetry delivery logs remain writable. Existing indirect child paths and
external workers still require their wider isolation/side-effect qualification.

Migration 20260928122000_workspace_lifecycle is additive and uses bounded locks.
Review drift and take a verified backup first. No live migration was executed.
Legacy invalid owners fail future mutations; do not silently rewrite their data.
Restore prior application only while retaining expanded schema; do not use a
physical down-migration to discard invitation history or archived-state semantics.

Tests cover ETags, replay, copied invitation IDs, expiry, renewal, revocation,
verified identity, escalation, owner continuity, archive child-write denial,
busy-deployment rejection and restore. Real PostgreSQL/HTTP results are emitted
by workspace-integration.yml, separately from source-unit policy tests.
