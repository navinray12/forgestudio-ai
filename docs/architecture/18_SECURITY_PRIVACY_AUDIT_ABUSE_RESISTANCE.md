# 18. Security, Privacy, Audit and Abuse Resistance

**Document Version:** 1.0.0  
**Blueprint Reference:** Point 18 — Security, privacy, audit and abuse resistance  
**Repository:** `navinray12/forgestudio-ai`

---

## 1. Executive Architecture Summary

Point 18 establishes a comprehensive security, privacy, and audit defense architecture: 13-vector threat model mapped to OWASP ASVS v4.0.3, 8-plane trust boundary separation, server-side tenant scoping rejecting ID substitution, non-superuser PostgreSQL RLS contract, strict SSRF/DNS-rebinding quarantine, shared universal redaction, tamper-evident cryptographic audit hash chain with durable denial logging, and 10-quota category abuse resistance preserving committed leads and protected source.

### Core Invariants:
1. **No Client Tenant ID Trust:** Tenant scope is resolved strictly from validated server session tokens; client-supplied header substitutions (`x-tenant-id`) are rejected.
2. **Non-Superuser RLS Defense:** PostgreSQL RLS is defense in depth; queries executed under superuser or table-owner roles fail validation to prevent accidental RLS bypass.
3. **Fail-Closed Custom Code Sandbox:** Untrusted customer scripts are blocked unless executed inside qualified kernel-level container/gVisor boundaries with restricted network egress.
4. **SSRF Quarantine:** Webhooks and crawlers block loopback (`127.0.0.1`), RFC 1918 private subnets, and cloud metadata (`169.254.169.254`). Redirects are rechecked at every hop.
5. **Universal Redaction:** Passwords, tokens, API keys, emails, phone numbers, and credit cards are scrubbed across logs, errors, AI model traces, and exports.
6. **Durable Denial Logging:** Denied authorization requests are recorded to a durable denial ledger that does NOT roll back when transactions fail.
7. **Tamper-Evident Hash Chain:** Critical mutations are linked via SHA-256 cryptographic hash chains verifying audit immutability.
8. **Abuse Response Preserves Source & Leads:** Quota exhaustion pauses expensive operations, but NEVER silently purges protected source history or discards committed leads.

---

## 2. Security Trust Planes

```
┌────────────────────────────────────────────────────────┐
│ 1. Platform Admin Plane (Cross-tenant super-governance)│
├────────────────────────────────────────────────────────┤
│ 2. Tenant Owner / Member Plane (Scoped to tenantId)   │
├────────────────────────────────────────────────────────┤
│ 3. Public Visitor Plane (Read-only published routes)  │
├────────────────────────────────────────────────────────┤
│ 4. Build Worker Plane (Isolated container builds)     │
├────────────────────────────────────────────────────────┤
│ 5. Runtime Worker Plane (Fenced leased jobs)          │
├────────────────────────────────────────────────────────┤
│ 6. Deployment Agent Plane (Staging & CDN probes)      │
├────────────────────────────────────────────────────────┤
│ 7. Provider Service Plane (OAuth credentials)         │
├────────────────────────────────────────────────────────┤
│ 8. External Callback Plane (Signed webhook verifier)  │
└────────────────────────────────────────────────────────┘
```

---

## 3. Services Overview

### 3.1 Threat Model Matrix (`threatModelMatrix.service.ts`)
- Maps 13 threats (account takeover, tenant substitution, sandbox escape, SSRF, malicious uploads, forged callbacks, source corruption, attestation tampering, AI costs, attribution hijacking, chat tool abuse, queue exhaustion, privilege escalation) to OWASP ASVS v4.0.3 controls.

### 3.2 Security Planes & RLS (`securityPlanesAuthorization.service.ts`)
- Enforces server-side tenant scoping and validates non-superuser RLS contracts.

### 3.3 SSRF Network Quarantine (`ssrfNetworkQuarantine.service.ts`)
- Blocks outbound requests to loopback, private IP ranges, and cloud metadata endpoints. Validates redirect chains hop-by-hop.

### 3.4 Data Policy Retention & Redaction (`dataPolicyRetentionRedaction.service.ts`)
- Manages retention classes (`OPERATIONAL_30D`, `LEAD_90D`, `STATUTORY_7Y`, `PERMANENT`) and deeply scrubs PII, secrets, and credentials.

### 3.5 Durable Audit Denial Ledger (`durableAuditDenialLedger.service.ts`)
- Maintains tamper-evident SHA-256 hash chains, out-of-transaction denial logs, and 10-quota category abuse pausing.

## Row-level security rollout (WP-02, WP-19)

Row security is being introduced table by table. A table is enforced only after every path that
reads or writes it runs inside a row-security transaction. This section states what is enforced
today, what is not, and what each next step needs. It makes no claim beyond that.

### How enforcement works

- `platform/tenancy/rls.ts` opens a transaction, switches to a restricted role with
  `SET LOCAL ROLE`, and names the tenant with `set_config('app.tenant_id', …, true)`. Both are
  transaction-local, so nothing is left on a pooled connection.
- The tenant is never client input. It is the owning tenant of a website or project the caller
  was already authorised for, read from the database.
- Policies are written for the restricted roles only. Missing or empty context matches no row;
  a value that is not a UUID is an error; the helpers refuse to start without a valid tenant.
- Roles: `forge_tenant_rls` (tenant data) and `forge_platform_rls` (platform data, and only in a
  transaction marked `app.platform_admin`). Neither can log in, both are NOINHERIT, and each
  holds only the grants listed below.

### Ownership is not uniform

Counted from the catalog (219 tables in the reference database): 106 carry `projectId`,
30 `websiteId`, 12 `organizationId`, 6 `workspaceId`, 22 only a user column, 43 none of these.
The tenant of a row is therefore derived per family:

| Family | Tenant of a row | Function |
| --- | --- | --- |
| Website-owned | the website's workspace, else its organization, else its owner | `forge_website_tenant(websiteId)` |
| Project-owned | the project's workspace, else its owner | `forge_project_tenant(projectId)` |
| Organization-owned (existing policies) | `organizationId` | column compared with `app.tenant_id` |
| Platform | no tenant | platform role only |

Ownership is read live, so rows follow a website or project that moves to another tenant.

### Stage 1: enforced tables

| Table | Family | Policy | Grants | Access paths (all converted) |
| --- | --- | --- | --- | --- |
| `forge_website_records` | website | tenant of website = context; inserted `tenantId` must equal context | SELECT, INSERT, UPDATE | `websiteRecords.service.ts` (v2 feature routers: facts, consent, drafts, source imports) |
| `forge_workflow_definitions` | website | tenant of website = context | SELECT, INSERT, UPDATE | `durableWorkflowDefinitions.service.ts` |
| `forge_environment_bindings` | project | tenant of project = context | SELECT, INSERT, UPDATE | `PostgresEnvironmentBindingStore` (binding API, target resolution, migration preflight) |
| `forge_benchmark_runs` | platform | `app.platform_admin = on`, platform role | SELECT, INSERT | `benchmarkRunStore.service.ts` via `withPlatformAdminRls` (administrator check, stated purpose, audit log entry per use) |

Deletion of a website or project still removes these rows: PostgreSQL exempts foreign-key
cascades from row security. No worker, job or CLI command touches these tables other than through
the services above. Tests reach them through the services, or directly as the database owner for
setup and assertions.

Stage 1 is applied by migration `20261013170000_tenant_rls_stage1` (mirrored in
`ensure-schema.ts`) and reversed by `prisma/rls/rollback_stage1.sql`. It also makes the existing
trigger function `forge_workspace_child_admission()` SECURITY DEFINER, because that trigger reads
`websites` and `workspaces`, which the restricted roles must not be able to read.

### What stage 1 does not do

- **It does not restrict queries outside those transactions.** RLS is enabled, not forced: the
  table owner is exempt, and a superuser or BYPASSRLS role is always exempt. `rlsPosture()` reports
  the connection role and warns when it is privileged.
- **The existing organization policies** on `workspace_command_journal`, `workspace_outbox` and
  `workspace_invitations` are forced, but `withTenantTransaction` (`platform/tenancy/context.ts`)
  sets the tenant without switching role. They are enforced only if the application does not
  connect as a superuser or BYPASSRLS role. In the reference environment it connects as
  `postgres`, so those policies are bypassed there.
- **Under a superuser login the role switch can be undone** (`RESET ROLE`, or `SET ROLE` to another
  role) by SQL running in the transaction, and the tenant setting can be changed by it. All SQL in
  the converted services is parameterised; the protection is against mistaken or missing
  predicates and forged scopes, not against arbitrary SQL execution under a superuser session.
- All other tables rely on application-level checks, as before.

### Deployment requirement for the guarantee to be complete

Connect the application as a dedicated login role that is not a superuser, has no BYPASSRLS, does
not own the tables, is a member of `forge_tenant_rls` and `forge_platform_rls`, and has EXECUTE on
`forge_website_tenant` and `forge_project_tenant`. With that, a query that forgets the tenant
transaction returns no rows from the enforced tables even with table grants, and the session
cannot switch to any role it is not a member of. This configuration is exercised in
`tenant-rls.integration.test.ts` with a real login role. Schema changes then need a separate owner
connection; the application currently applies them itself at start-up (`ensure-schema.ts`), which
is the open item for adopting this.

### Stage 2: FORCE

`prisma/rls/stage2_force.sql` makes the owner subject to the policies on the four stage-1 tables;
`rollback_stage2.sql` reverses it. It is not applied automatically and is not under
`prisma/migrations`. It is safe for those four tables (no owner-level path remains), has no effect
while the application connects as a superuser, and is verified in the test suite inside a
transaction that is rolled back.

### Next tables and what blocks each

| Table(s) | Family | Blocker before enabling |
| --- | --- | --- |
| `forge_leads`, `forge_lead_events`, `form_submissions` | website | Lead intake writes `form_submissions` and `background_jobs` in the same transaction; lead-by-ID lookups need the website before the tenant is known (a SECURITY DEFINER lookup); `websitePurge.service.ts` deletes across tenants and needs an explicit administrative path |
| `forge_workspace_checkpoints` | project | The workspace sync gateway reads checkpoints for many projects from one listener; `recordCheckpoint` reads `websites` and `forge_project_files` in the same transaction |
| `forge_database_migrations` | project | The migration authority's start-up reconciliation is cross-tenant; rows are also read through the generic Prisma fallback delegate |
| `forge_projects`, `forge_project_files` and the other project tables | project | Hundreds of query sites through the Prisma fallback delegate with no tenant transaction; needs the delegate itself to carry a tenant context |
| `websites` | website | Same, through Prisma |

### Verification

`backend/src/tests/tenant-rls.integration.test.ts` (real PostgreSQL, real roles): catalog posture;
no rows and no writes without a tenant; malformed tenant is an error; cross-tenant reads, updates,
inserts and re-parenting refused in each table; per-family ownership including a website that
belongs to a workspace and one that changes tenant; pooled-connection reuse after success and
failure; a real non-superuser login role with and without the tenant transaction; the converted
services, including a forged scope; platform administration, its refusal for non-administrators
and its audit entries; stage 2 and both rollbacks inside a rolled-back transaction; cascade deletes.

