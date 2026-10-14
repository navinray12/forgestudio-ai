# ForgeStudio Architecture — Blueprint Point 45: Team Project Tracker Vertical Acceptance Slice

## 1. Overview and Purpose

Blueprint Point 45 specifies a complete application-domain vertical acceptance slice: the **Team Project Tracker**. 
This application model serves as the authoritative qualification standard to prove that ForgeStudio's full-stack generation, transactional database persistence, role-based authorization, visual/code workspace editing, and CMS integration function cleanly in harmony without conflating CMS content and transactional application state.

---

## 2. Key Architecture Invariants

1. **Separation of Concerns:**
   - Transactional business records (`Organization`, `Membership`, `Project`, `ProjectMember`, `Task`, `Comment`, `CommandReceipt`, `OutboxRecord`) are stored strictly within the application database schema.
   - CMS content (pages, blog posts, authors, site metadata) resides in the CMS schema/collection and uses its own draft/publish/trash lifecycle.
   - Private task comments and project records are strictly isolated; they never leak into CMS pages, site search, public chatbot retrieval, or public analytics.

2. **Zero Browser-Supplied Trust:**
   - Browser requests must NEVER be trusted regarding tenant identity (`tenantId`, `organizationId`).
   - The caller's authorization context is strictly resolved from the verified session identity and membership mappings. Cross-tenant access is rejected with `UNAUTHORIZED_CROSS_TENANT_ACCESS`.

3. **Field Protection and Controlled Transitions:**
   - Generic task updates (`editTaskDetails`) are restricted to safe mutable fields (`title`, `description`, `dueDate`, `priority`).
   - Generic updates CANNOT alter:
     - `organizationId` (immutable tenant boundary)
     - `createdById` (immutable audit provenance)
     - `status` (protected state machine transition reserved for `completeTask`)
     - Assigned roles or audit revision counters.
   - State transition to `COMPLETED` is only accessible via the transactional command `completeTask`, requiring:
     - Explicit business preconditions (assignee membership active, task not already completed/archived).
     - Expected revision validation for optimistic concurrency control (`STALE_REVISION_CONFLICT`).
     - Writing an immutable `CommandReceipt` with idempotency token verification.
     - Writing an immutable `OutboxRecord` for domain event dispatching.

---

## 3. Data Model Hierarchy

```
Organization (tenant root)
  ├── Membership (user scope, role: OWNER, ADMIN, MEMBER, VIEWER, revocation state)
  └── Project (organization ownership, slug, lifecycle, optimistic revision)
        ├── ProjectMember (scoped to project, explicit role: LEAD, CONTRIBUTOR, OBSERVER)
        └── Task (project scoped, task number, status, priority, due date)
              ├── Comment (task scoped, author membership, bounded text, immutable attribution)
              ├── CommandReceipt (command idempotency token, execution timestamp)
              └── OutboxRecord (event type: TASK_COMPLETED, payload, publication status)
```

---

## 4. Required Operations Specification

| Operation | Input Signature | Authorization Constraint | Audit & Concurrency |
|---|---|---|---|
| `listProjectTasks` | `projectId, callerMembershipId` | Caller must have active membership in project | Returns task list with total count |
| `createTask` | `projectId, callerMembershipId, title, description, priority, assigneeMembershipId, dueDate` | Caller must be project contributor or above | Emits `TASK_CREATED` outbox record, initial revision 1 |
| `editTaskDetails` | `taskId, callerMembershipId, expectedRevision, patch` | Caller must be project contributor; cannot mutate status/tenant/author | Enforces `expectedRevision == currentRevision`, increments revision |
| `assignTask` | `taskId, callerMembershipId, assigneeMembershipId` | Caller must have project assign permission; assignee must belong to same organization | Re-evaluates assignee active membership status |
| `completeTask` | `taskId, callerMembershipId, expectedRevision, idempotencyKey, resolutionNotes` | Caller must be project member; task must be non-terminal | Enforces `idempotencyKey` replay guard; records `CommandReceipt` & `OutboxRecord` |
| `addComment` | `taskId, callerMembershipId, content` | Caller must be member of project; content 1..4000 chars | Creates immutable comment, never exposed to CMS |

---

## 5. Authoritative 15-Step Demonstration Protocol

The vertical slice satisfies Blueprint Point 45 through an explicit 15-step qualification lifecycle executed via `TeamProjectTrackerService.executeFifteenStepAcceptanceProtocol`:

1. **Step 1 — Provider-Backed Generation:** Generate models, migrations, and API contracts from approved specifications.
2. **Step 2 — Specification Review:** Review generated schema, policies, and contracts for strict multi-tenancy.
3. **Step 3 — Isolated DB Provisioning:** Provision synthetic tenant database schema and execute forward migrations.
4. **Step 4 — UI Task Creation:** Create unique synthetic task (`TASK-001`) via verified application API payload.
5. **Step 5 — Independent Verification:** Independently observe database row, tenant scope, and outbox event record.
6. **Step 6 — Persistence Restart Verification:** Restart application runtime context and verify data remains queryable.
7. **Step 7 — Cross-Tenant Denial:** Attempt cross-organization read and update; verify strict denial (`UNAUTHORIZED_CROSS_TENANT_ACCESS`).
8. **Step 8 — Dynamic Route Workspace Registration:** Register dynamic page route (`/projects/:id/board`) in Code Workspace and verify template.
9. **Step 9 — Visual/Code Bidirectional Edit:** Modify visual header property in AST and verify bidirectional synchronization.
10. **Step 10 — Concurrent Edit Conflict Resolution:** Introduce competing revisions and verify non-destructive merge.
11. **Step 11 — Route Renaming Propagation:** Rename route and verify AST imports and links cleanly update.
12. **Step 12 — Page Retirement Data Preservation:** Retire draft page and confirm transactional business rows remain untouched.
13. **Step 13 — Schema Studio Extension & Migration:** Add optional custom task field, review migration plan, and promote via environment binding.
14. **Step 14 — CMS Article Lifecycle Separation:** Create, publish, trash, and restore a CMS blog post; verify zero impact on project records.
15. **Step 15 — Fresh-Host Portability:** Verify second operator can install application on fresh infrastructure and run independently.

---

## 6. Integration and API Endpoints

The control plane exposes the acceptance vertical slice via:

- `POST /api/projects/:id/showcase/team-project-tracker`
  - Action `listProjectTasks`: queries project tasks with tenant validation.
  - Action `createTask`: creates task and emits outbox event.
  - Action `editTaskDetails`: validates patch and enforces optimistic concurrency.
  - Action `assignTask`: verifies assignee organization scope.
  - Action `completeTask`: executes transactional completion command.
  - Action `addComment`: creates immutable private comment.
  - Action `executeDemonstration`: triggers the full 15-step acceptance protocol.
