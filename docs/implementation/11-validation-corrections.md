# Validation correction: health query configuration

Full-build validation caught a QueryConfig mismatch in the new health controller:
the pinned pg type contract does not expose a per-query query_timeout field.
Remove that unsupported per-query option rather than suppressing TypeScript.
The client still uses the explicit pool acquisition and server-side statement
budgets configured in config/prisma.ts (defaults 2 and 5 seconds respectively).
No 1.5-second end-to-end health guarantee is claimed.

All 175 local source-unit checks pass after this correction. Final GitHub build
and real PostgreSQL/HTTP results must be recorded against the resulting commit,
not inferred from the earlier integration candidate. Earlier failed runs remain
visible; they are not deleted or counted as passing.
