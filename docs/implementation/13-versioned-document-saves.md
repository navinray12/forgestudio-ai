# Increment 13 — versioned, idempotent document saves

## Implemented contract

The document write handlers share one application command. Every request carries
`X-Forge-Intent: document-command`, a scoped `Idempotency-Key`, and an `If-Match`
value obtained from an authorized website read: `"<website-id>:document:<version>"`.
Missing preconditions return 428; stale documents return 412. A repeated key with
changed input returns 409. A successful acknowledgement is minimal and never
contains the saved document. The command rechecks current account, organization,
workspace, and granular permissions inside its serializable transaction; the
mutation, mandatory audit, outbox intent and replay result commit together.

The additive document migration advances `documentVersion` for every writer,
including transitional legacy publishing/revision adapters. It does not make
those legacy writers themselves idempotent or complete their workflow migration.
Protected components cannot be silently removed. Content-only actors cannot add
pages or alter layout through a broad editor JSON update. Draft writes cannot set
publication state, published snapshots, deployment/hosting data or backup state.
The public renderer no longer treats JSON publication status or a working draft
as a published release.

Manual save and autosave share one per-editor command coordinator. It sequences
writes using acknowledged versions. A lost response retains the original bytes
and key; retry reconciles that command before newer edits. A conflict blocks
further saves until the editor explicitly reloads canonical state. Unsaved edits
remain in the editor; no automatic merge/overwrite is attempted. A failed save
is displayed as an error, not a green success. The performance settings panel now
checks responses, handles scope changes and persists its actual allowlisted
settings through the versioned command. Kit import checks its save acknowledgement.

## Migration and compatibility

Run `20260928140000_document_concurrency` through the reviewed migration process,
after the two workspace migrations and a verified backup/drift review. There is
no request-time schema repair. No production migration was executed here.
Old API clients must send the new headers. The developer/API-v1/SEO/cookie write
adapters propagate the contract rather than retaining a hidden blind-write path.
Non-browser integrations need to update their clients before rollout. An existing
site without canonical organization/workspace ownership is readable but cannot
use this new write command until the controlled legacy ownership backfill; it
returns `TENANT_MIGRATION_REQUIRED` instead of guessing a tenant.

Existing published sites without a retained publish snapshot now return 404.
Reconcile those legacy records through authorized publishing before rollout; do
not restore draft fallback. Content-only edits outside the declared text fields
are rejected, not silently dropped. No new platform permission is inferred from
creator identity. Browser custom-code isolation remains a separate boundary.

## Evidence and remaining gates

Focused unit tests cover canonical/complexity limits, malformed JSON values,
publication forgery, protected elements, content restrictions, versions, request
headers, save sequencing, ambiguous response replay and stale-client blocking.
Real PostgreSQL/HTTP tests cover contended saves, replay, explicit denial, role
restrictions, native writer version increments, audit failure rollback, protected
nodes, public draft rejection, HTTP validation and revocation. The browser journey
exercises a compiled editor save and a second-tab conflict against the actual API.
The exact qualifying commit/results are recorded in the implementation report.

Repository-wide RLS, legacy ownership migration, fully durable publishing,
organization billing, external payment/identity providers, control-plane changes,
cloud/load/restore qualification and additional legacy feature suites are NOT
established by these tests. No production-readiness percentage is inferred.
