# Increment 3: remove privileged startup side effects

The database client previously rewrote migration history, altered schema and
upserted privileged accounts with built-in passwords on import. These behaviors
are removed, not hidden behind a production flag. Restarts now construct a bounded
pool/client only; migrations and account provisioning require explicit operators.
No existing account, credential, schema or production database was modified by
this source change.

Before deploying: inspect migration drift in a disposable restore, reconcile it
through an approved migration procedure, and rotate/revoke any existing bootstrap
credentials and their sessions. Removing the seed code does not revoke credentials
that were already written. Preserve legitimate account ownership and customer data.
Do not restore default-password seeding as a recovery method.

Pool defaults: 5 connections; 2-second acquisition; 30-second idle lifetime;
5-second statement timeout; 10-second idle transaction timeout. Validate these
against the workload and total replica/worker budget. They are bounded defaults,
not proof of reference-load capacity. Invalid overrides fail at configuration.

Tests: `node --experimental-vm-modules --test tests/hardening/*.test.mjs`.
10 new source-unit checks exercise import purity and invalid configuration.
Database connection/failover, migrations and deployment remain separate gates.
