# Identity increment dependency remediation

This record supplements the original identity-boundary report. Earlier dependency
counts in that report describe the original lockfile, not this revised candidate.
Neither an audit result nor these notes certify the full product for production.

## Reviewed changes

- Nodemailer 9.0.6 -> 9.1.1, exact direct dependency.
- qs 6.15.3 -> 6.16.0 through its existing compatible dependency range.
- `@prisma/config`'s pinned deepmerge-ts 7.1.5 -> 8.0.2 through a scoped override.
- Prisma's pinned optional mysql2 3.15.3 -> 3.24.4 through a scoped override.
- Prisma/client versions and the PostgreSQL adapter are not downgraded.

The generated lockfile adds sql-escaper and removes mysql2's old denque,
seq-queue and sqlstring dependencies. Other package versions remain unchanged.
The candidate was prepared without executing package install scripts and inspected
against its input lockfile before being selected for qualification.

Deepmerge v8 changes nested Map merging and fixes nested mutation. Forge's trusted
Prisma configuration uses plain object fields (schema, migrations, datasource), not
Maps or deepmergeInto. Qualification must exercise actual Prisma generation and
PostgreSQL migration/HTTP tests with this override. The MySQL provider is not a
supported Forge deployment; the optional CLI dependency remains patched rather
than excluded from scanning. Review these scoped overrides on every Prisma upgrade
and remove them once upstream pins a qualified patched dependency.

Upstream references:
- https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0
- https://github.com/advisories/GHSA-ggr8-5vv4-36mx
- https://github.com/sidorares/node-mysql2/releases/tag/v3.23.1
- https://github.com/nodemailer/nodemailer

## Evidence and gates

Preparation run 36461811163 produced a backend audit with zero findings for the
candidate. That is preparation evidence, not application compatibility evidence.
The reviewed-increment qualifier reruns a fresh audit, both production builds,
source tests, signed-token/TLS-mail contracts, PostgreSQL identity and document
contracts, WebSocket tests and real browser journeys before exporting application
blobs. High or critical dependency findings block that qualification. Findings
below that threshold remain visible and require separate remediation, not a
claim that all scans are clean. Final execution status belongs to the matching
GitHub Actions run and exact tested tree, not to a copied checklist.

No credentials, production database, provider tenant or deployment were changed.
