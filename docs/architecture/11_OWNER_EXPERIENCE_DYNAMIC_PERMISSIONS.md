# 11 | Owner Experience and Dynamic Permissions Architecture
## ForgeStudio Execution Blueprint v2.1 — Point 11 Technical Specification

---

## 1. Executive Summary & Core Objectives

Point 11 establishes a unified, progressive-disclosure workspace experience across three distinct operator profiles:
1. **Simple Owner View**: Tailored for non-technical small business owners, emphasizing plain business terminology, prioritized action items, inbound lead alerts, and draft content editing.
2. **Design/Developer View**: Exposes technical controls for responsive page layouts, design tokens, component contracts, content-schema bindings, source ownership, and reconciliation conflicts.
3. **Agency/Platform View**: Empowers multi-tenant agency operators and platform administrators with multi-project oversight, release approvals, provider diagnostics, budget controls, custom role administration, and delegated support access.

Crucially, **all three experience tiers operate over the exact same authoritative backend services, centralized policy engines, tenant boundaries, and immutable audit logs**. Frontend visibility is purely presentational; switching view modes never alters or elevates backend permissions.

---

## 2. Progressive Disclosure & 8-Area Navigation Architecture

The workspace navigation manifest is dynamically assembled by `progressiveDisclosure.service.ts` and organized into eight coherent functional areas:

```
[ progressiveDisclosure.service.ts ]
                 │
                 ├── 1. Overview & Tasks       ──► Authoritative metrics (Leads, Pub Failures, Budget)
                 ├── 2. Design & Pages         ──► Visual editing, brand tokens, contracts, conflicts
                 ├── 3. Content & Media        ──► Blog posts, collections, asset rights, trash/restore
                 ├── 4. Leads & Conversations  ──► Form capture, lead inbox, stages, audited PII export
                 ├── 5. Growth & Campaigns     ──► Deterministic UTM links, workflows, calendar
                 ├── 6. Search & Measurement   ──► SEO metadata, crawl health, source coverage
                 ├── 7. Publish & Operations   ──► Live release status, custom domains, diagnostics
                 └── 8. Governance             ──► Members, custom roles, audit log, support access
```

### Truthful, Non-Fabricated Metrics Guarantee
Metrics and counts in the Overview area derive strictly from authoritative records:
- `newLeadsCount` and `overdueLeadsCount`: Inbound form submissions awaiting response.
- `pendingReviewsCount`: Content items submitted to the publication review gate.
- `publicationFailuresCount`: Failed releases requiring operator diagnosis.
- `spendingSummary`: Exact generative unit consumption versus monthly budget limits.
- No synthetic or invented metrics are displayed to create an artificial appearance of activity.

---

## 3. Versioned Dynamic Permission Model

Roles in ForgeStudio are editable compositions of explicit, versioned permission definitions managed by `dynamicPermissionEngine.service.ts`.

### Strict Separation of High-Risk Authorities
To prevent privilege escalation and catastrophic accidents, critical operational authorities are isolated into independent permissions:

| Permission ID | Name | Risk Classification | Required Approval | Audit Requirement |
| :--- | :--- | :--- | :--- | :--- |
| `perm:content:edit` | Edit Content | `LOW` | `NONE` | `STANDARD` |
| `perm:content:publish` | Publish Content | `HIGH` | `NONE` | `MANDATORY_AUDIT` |
| `perm:schema:migrate` | Migrate Schema | `HIGH` | `NONE` | `MANDATORY_AUDIT` |
| `perm:code:approve` | Approve Custom Code | `HIGH` | `STEP_UP_MFA` | `MANDATORY_AUDIT` |
| `perm:secrets:manage` | Manage Integration Secrets | `CRITICAL` | `STEP_UP_MFA` | `MANDATORY_AUDIT` |
| `perm:billing:override` | Override Spending Limits | `CRITICAL` | `STEP_UP_MFA` | `MANDATORY_AUDIT` |
| `perm:pii:export` | Export Customer PII | `HIGH` | `STEP_UP_MFA` | `MANDATORY_AUDIT` |
| `perm:domain:transfer` | Transfer Domain | `CRITICAL` | `STEP_UP_MFA` | `MANDATORY_AUDIT` |
| `perm:purge:execute` | Execute Permanent Purge | `CRITICAL` | `INDEPENDENT_APPROVER` | `MANDATORY_AUDIT` |
| `perm:roles:admin` | Administer Roles & Permissions | `HIGH` | `NONE` | `MANDATORY_AUDIT` |
| `perm:account:transfer` | Transfer Account Ownership | `CRITICAL` | `INDEPENDENT_APPROVER` | `MANDATORY_AUDIT` |
| `perm:support:delegate` | Delegate Time-Limited Support | `HIGH` | `STEP_UP_MFA` | `MANDATORY_AUDIT` |

### Built-in Role Definitions
- **OWNER**: Holds all permissions including purge and account transfer.
- **ADMIN**: Operations manager. Purge and account transfer require dual-custody independent approval.
- **DESIGNER**: Visual design, brand tokens, draft content editing. Direct publishing restricted.
- **DEVELOPER**: Component code, schema migration, release diagnostics. PII export restricted.
- **CONTENT_EDITOR**: Draft authoring and media management. Strictly separated from `perm:content:publish`.
- **CLIENT**: Simple owner view, content authoring, lead review.
- **REVIEWER**: Read-only inspection and sign-off.
- **VIEWER**: Minimal preview.

### Delegation & Anti-Escalation Rule
An administrator or role creator **cannot delegate any permission they do not personally possess**. Creating a custom role or assigning an existing role with unheld permissions immediately throws `UNAUTHORIZED_DELEGATION`.

---

## 4. Authoritative Server-Side Authorization & Job Revalidation

Implemented in `authoritativeAuthorization.service.ts`:
Every sensitive read and write operation evaluates an 8-factor policy:
1. **Authenticated Principal & Session Status**: Active user and non-expired session.
2. **Active Membership & Role Version**: Verified tenant membership.
3. **Required Permission ID**: Explicitly checked against the versioned catalog.
4. **Tenant Scope**: Strict bounding to `{ organizationId, workspaceId, websiteId }`.
5. **Capability Prerequisites**: Validates that required Point 05 capabilities (e.g. `CAP-101`, `CAP-102`) are enabled.
6. **Resource Lifecycle**: Blocks mutative actions on archived or soft-deleted resources.
7. **Step-Up MFA / Dual-Custody Approval**: Enforced for high/critical risks.
8. **Pre-Commit Execution Check**: Current authority confirmed immediately before state persistence.

### Long-Running Background Job Re-authorization
Background jobs (e.g., batch publishing, bulk exports, large-scale migrations) receive a cryptographically bounded `JobAuthorizationToken` at submission. 
Before committing output or modifying database records, the worker invokes `revalidateJobExecutionAuthority()`. If the user's role was downgraded, membership deleted, account deactivated, or required permission revoked while the job was in flight, the commit is blocked with `STALE_JOB_AUTHORITY_REVOKED` and logged to the security audit trail.

---

## 5. Truthful 11-State Editing and Publication Model

Implemented in `truthfulEditorState.service.ts`:

```
 [ UNSAVED ] ──► [ SAVING ] ──┬──► [ DRAFT_ACKNOWLEDGED ] ──┬──► [ PENDING_APPROVAL ] ──► [ APPROVED ]
                              │                              │                                  │
                              ├──► [ CONFLICT ]              └──► [ FAILED ]                    ├──► [ SCHEDULED ]
                              │                                                                 │          │
                              └──► [ FAILED ]                                                   ▼          ▼
                                                                                       [ PUBLISHING ]
                                                                                               │
                                                                                               ├──► [ PARTIALLY_PROPAGATED ] ──► [ LIVE_VERIFIED ]
                                                                                               └──► [ FAILED ]
```

### Concurrency Protection & Conflict Resolution
- Optimistic version checks compare client `expectedVersion` against server `documentVersion`.
- On version mismatch, the session enters `CONFLICT`. Both client and server versions are preserved in a `ConflictSnapshot`.
- **AI auto-regeneration is automatically locked** for the affected scope to prevent corrupted overwrites.
- Conflicts are resolved via explicit base-aware strategies: `ACCEPT_SERVER`, `FORCE_AUTHORIZED_OVERWRITE`, or `MERGE_RESOLVED`.

---

## 6. Privacy-Safe Local Draft Recovery

Implemented in `privacySafeDraftRecovery.service.ts`:
- **Tenancy Scoping**: Recovery records are strictly keyed by `{ userId, workspaceId, websiteId, draftId }`.
- **PII & Secret Scrubbing**: Passwords, API tokens, integration keys, and form submission PII are stripped before saving to local recovery caches.
- **Truthful Labeling Invariant**: Local recovery copies are explicitly flagged `isServerAcknowledged = false`. They are never represented as saved.
- **Stale Detection**: If the authoritative server version has advanced past the local snapshot, recovery halts with `CONFLICT_RESOLUTION_REQUIRED`.
- **Shared-Device Quarantine**: On logout or account switch, local drafts are quarantined and require re-authentication before restoration.

---

## 7. Ten Owner Acceptance Journeys

Implemented in `ownerAcceptanceJourneys.service.ts`:
1. **Journey 1**: Create a collection and page (defines schema, binds public route with empty states).
2. **Journey 2**: Publish a blog post (verifies draft creation and role separation between drafting and live publishing).
3. **Journey 3**: Resolve a source or content conflict (simulates concurrent edit, preserves dual copies, locks AI auto-regen, merges safely).
4. **Journey 4**: Change site navigation (adds link, checks route collisions, persists without component invalidation).
5. **Journey 5**: Replace a media asset (preserves asset ID, updates rights and provenance).
6. **Journey 6**: Build and configure a form (configures fields, spam honeypot, keeps unverified outbound webhooks inactive).
7. **Journey 7**: Receive and qualify a lead (manages inbox, updates stage, enforces PII export authorization).
8. **Journey 8**: Create a UTM campaign link (deterministic link generation, creative calendar linking).
9. **Journey 9**: Pause a workflow or experiment (pauses active headline test, routes 100% traffic to control, logs audit event).
10. **Journey 10**: Restore a trashed article and inspect blocked release (restores to unpublished, inspects release gate diagnostics, repairs missing fields).

---

## 8. Verification & Regression Strategy

### Automated Suites
- `backend/src/tests/point11-dynamic-permissions.test.ts`: Role composition, high-risk separation, delegation bounds, job authority revalidation.
- `backend/src/tests/point11-owner-workspaces-states.test.ts`: Progressive disclosure, 8-area navigation, 11 editor states, optimistic concurrency, draft recovery.
- `backend/src/tests/point11-acceptance-journeys.test.ts`: All 10 owner journeys verified with realistic roles.
- `backend/src/tests/point11-regression-gate.test.ts`: Cross-verifies Points 05 through 10 compatibility.

### Verification Status
Due to host Windows environment execution policy restrictions blocking direct child process spawning (`Access is denied`), Point 11 is recorded as **`IMPLEMENTED BUT PARTIALLY UNVERIFIED`**. Code contracts, types, schema mappings, Express routes, and test suites are fully authored and structurally integrated.
