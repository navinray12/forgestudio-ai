# Increment 7: organization-scoped workspace command core

Adds a separate tenant-workspace router and cohesive command services without
silently changing the existing `/workspaces` team compatibility API. The router
is integrated with the customer UI only after the subsequent wiring gate.

Implemented: current organization AND workspace membership, no implied access to
sibling workspaces, explicit personal-organization provisioning, bounded lists,
owner/admin delegation checks, active same-organization member selection,
owner-removal protection and quota-checked website creation in a serializable
transaction. Each command commits its result journal, business mutation,
mandatory audit and outbox intent together. Retries reauthorize stored results.

The additive SQL migration adds forced-RLS command journal/outbox tables. Existing
business tables are not thereby certified as RLS-protected. Repository-wide RLS,
legacy ownership backfill, organization-scoped billing, archive/restore,
invitations, transfers, an outbox consumer and operational qualification remain
open. Outbox records are retained intents, not evidence of delivered messages.
The workspace count cap is a technical safety limit, not a declared pricing plan.

Local source-unit evidence: 105 tests passed, 0 failed, including 30 new workspace
checks. Run `node --experimental-vm-modules --test tests/hardening/*.test.mjs`.
These tests use explicit doubles. Actual PostgreSQL concurrency/RLS and HTTP
integration are separate gates. No production migration or deployment occurred.
