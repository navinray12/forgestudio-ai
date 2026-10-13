# Architecture Specification: Real-Time Bidirectional Synchronization (Point 34)

## 1. Overview & Principles

ForgeStudio Blueprint Point 34 establishes the authoritative bidirectional synchronization engine between visual canvas manipulation and developer source code. The core mandate is to deliver:
- Sub-second local visual responsiveness without desynchronizing underlying source files.
- Deterministic echo suppression across multiple browser tabs and collaborative sessions.
- Strict isolation of source-owned code regions, React hooks, custom state, and server logic.
- An explicit 9-state save and recovery state machine distinguishing persistence, semantic synchronization, preview execution, and release verification.

## 2. Real-Time Semantic Operations Pipeline

### 2.1 Operation Identification & Invariants
Every visual-to-code operation encapsulates:
- `projectId`: Authoritative tenant workspace boundary.
- `pageId`: Canonical page identifier in the Page Registry.
- `nodeId`: Target visual node identifier (`data-forge-id`).
- `operationType`: Semantic visual operation (`DRAG`, `PROPERTY_UPDATE`, `TEXT_EDIT`, `INSERT`, `REMOVE`, `REORDER`).
- `baseCheckpointId` & `expectedRevision`: Optimistic concurrency lock.
- `operationId`: Globally unique UUID used for idempotency deduplication and lost-response recovery.
- `viewId`: Originating client/tab identifier used for echo suppression.

### 2.2 Echo Suppression Mechanics
Echo suppression does NOT rely on timestamps or fragile boolean flags:
- The server maintains a monotonically increasing `projectSequence` counter.
- Every committed operation records the `viewId` that produced it.
- When broadcasting committed change sets, the originating `viewId` suppresses local reapplying, preventing cursor jumps, focus loss, and infinite feedback loops.
- Replayed operations with known `operationId` return the cached committed result without bumping sequence numbers or re-committing files.

## 3. Save & Recovery 9-State Machine

The lifecycle of workspace changes transitions through 9 formal states:

```
[LOCAL_CHANGES]
       │
       ▼
   [SAVING] ───────────────► [CONFLICT]
       │                          │
       ├──────────────┐           ▼ (resolution)
       ▼              ▼       [DRAFT_SAVED]
 [SYNCHRONIZED] [INVALID_SOURCE]  │
       │              │           │
       ├──────────────┴───────────┤
       ▼                          ▼
 [PREVIEW_READY] ◄────── [PROJECTION_DELAYED_FAILED]
       │
       ▼
[RELEASE_VERIFIED]
```

1. `LOCAL_CHANGES`: Optimistic canvas/buffer modifications not yet acknowledged by the server.
2. `SAVING`: Proposal in-flight to authoritative Workspace Coordinator.
3. `DRAFT_SAVED`: Source stored durably on disk even if syntax is invalid or semantic sync is deferred.
4. `SYNCHRONIZED`: Semantic AST reconciliation succeeded; source, IR, and canvas match.
5. `INVALID_SOURCE`: Syntax error in hand-written code; saved safely while canvas retains the last valid semantic checkpoint.
6. `CONFLICT`: Concurrent modification conflict requiring three-way merge or user resolution.
7. `PROJECTION_DELAYED_FAILED`: Background preview or IR compiler worker experienced delay/failure.
8. `PREVIEW_READY`: Sandboxed runtime preview bundle updated and ready for inspection.
9. `RELEASE_VERIFIED`: Artifact passed release gates, ready for production publishing.

## 4. Conflict Resolution & Actor Undo

### 4.1 Three-Way Semantic Reconciliation
- Nonoverlapping edits to the same file converge automatically without raising a conflict.
- If overlapping AST nodes or source ranges are modified concurrently, a `ConflictRecord` is persisted with:
  - Base checkpoint
  - Visual proposal vs Code proposal
  - Affected nodes, files, and line ranges
  - Supported resolution strategies: `CODE_WINS`, `VISUAL_WINS`, `MANUAL_MERGE`, `DUPLICATE_AS_DRAFT`.

### 4.2 Actor Undo as Inverse Operation
- Canvas undo does NOT roll back live database transactions or purge historical commits.
- Undo pushes a new inverse operation (`inv_...`) against the actor's history stack with inverted properties (`oldValue` <-> `newValue`, `INSERT` <-> `REMOVE`).

### 4.3 Reconnect Resumption & Offline Queue Limits
- Clients reconnect by presenting their `lastAcknowledgedSequence`.
- Gaps trigger resynchronization against `lastValidSemanticCheckpoint`.
- Offline queues are bounded to 100 draft operations.
- Queued actions cannot replay production deployments, credential updates, or database schema mutations.

## 5. Live Transport: Workspace Sync Gateway (WP-18)

`/ws/workspace-sync` (`backend/src/services/workspace/workspaceSyncGateway.ts`, attached in
`websocketGateways.ts`, used by `server.ts`) is the live transport for this pipeline. It is a
transport over durable state, not a state engine.

### 5.1 Where state lives

| Concern | Authority |
| --- | --- |
| File content and version | `forge_project_files` (`version`, compare-and-set on `expectedVersion`) |
| Ordered history, sequence numbers | `forge_workspace_checkpoints` (gap-free `sequence` per project) |
| Operation idempotency | `forge_workspace_checkpoints.changeSetId = op:<operationId>` (unique per project) with the stored acknowledgement |
| Fan-out across instances | `pg_notify('forge_workspace_checkpoint')`, issued inside the checkpoint transaction |

The gateway process keeps only per-connection delivery cursors. `RealtimeSyncService.processVisualOperation`
and `WorkspaceCoordinatorService` still hold their in-memory Maps; they serve the single-process
unit tests and the reference benchmark and are not used by the gateway. The live operation path is
`RealtimeSyncService.commitDurableOperation`.

### 5.2 Connection and authorization

- Upgrade requires a valid session: the session cookie (only from the configured frontend origin)
  or an `Authorization: Bearer` header. Otherwise 401/403.
- `subscribe` and every `operation` re-authenticate the session and verify project access
  (`getForgeProjectById`). A user without access gets `ACCESS_DENIED`, identical for unknown projects.
- A periodic check (30 s) re-validates each connection; a revoked session is closed with code 1008,
  lost project access ends that subscription.
- Checkpoints are sent only to connections subscribed to that project.

### 5.3 Events

Client → server (JSON, validated; invalid input gets `error` / `INVALID_MESSAGE`):

| Event | Fields |
| --- | --- |
| `subscribe` | `projectId`, `afterSequence?` (resume point) |
| `operation` | `projectId`, `operationId`, `filePath`, `elementId`, `expectedRevision`, and `mutation` (see Point 31) or `operation` (`operationType`, `propertyKey`, `newValue`, `reorderIndex`, `parentNodeId`), `viewId?` |
| `unsubscribe`, `ping` | |

Server → client:

| Event | Meaning |
| --- | --- |
| `ready` | Connection authenticated |
| `subscribed` | `sequence` (project's latest), `resumedFrom`; followed by any checkpoints after `afterSequence`, in order |
| `ack` | Durable outcome of one operation: `applied` (`version`, `sequence`), `unchanged`, `rejected` (`code`), `conflict` (`version` = current file version), `error`; `replayed: true` for a repeated `operationId` |
| `checkpoint` | A committed change by anyone, from the WebSocket or HTTP: `sequence`, `origin`, `kind`, `filePath`, `fileVersion`, `documentVersion`, `changeSetId`, `createdById` |
| `error`, `unsubscribed`, `pong` | |

### 5.4 Guarantees

- **Truthful acknowledgements**: `applied` is sent only after the file write and the checkpoint
  have committed. Nothing is broadcast for an operation that did not commit.
- **Idempotency**: repeating an `operationId` returns the stored acknowledgement and writes nothing,
  including after a restart.
- **Version checks**: an operation against an older file version gets `conflict` with the current
  version. Of two concurrent operations on the same version exactly one is applied.
- **Ordering and recovery**: each subscriber receives checkpoints strictly in sequence order. A
  notification is only a wake-up; the gateway reads the checkpoints after each connection's cursor
  from the table, so a lost or out-of-order notification cannot cause a gap. After a disconnect or a
  restart the client resubscribes with `afterSequence`.
- **Echo suppression**: the connection that sent an operation receives its `ack`, not its own
  checkpoint. The frontend client also ignores checkpoints whose `changeSetId` it issued.

### 5.5 Client

`frontend/.../services/workspaceSyncClient.ts` (`connectWorkspaceSync`) subscribes, tracks the last
sequence, reconnects with backoff, resumes from that sequence and re-sends unacknowledged
operations under their original IDs. The Code Workspace uses it to refresh its file tree, pages and
open files when another client commits a change.

### 5.6 Limitations

- The visual editor (canvas) page deliberately holds no gateway connection (see 5.7).
- Clients receive checkpoints (what changed and at which version), not content; they re-read the
  changed files over HTTP.
- An HTTP save cannot be attributed to a browser tab, so the tab that made it also receives its
  checkpoint and refreshes.
- The file write and its checkpoint are two statements, not one transaction (see 5.8 for the
  recovery that closes the gap). A recovered change is announced, but its operation ID is not on
  record: repeating that operation reports `unchanged`, not `replayed`.
- Fan-out needs a session-level PostgreSQL connection for `LISTEN`; behind a transaction-mode
  pooler it must connect directly. While the listener is down, delivery is caught up by the
  periodic check.
- Rate limits and connection caps are per process.
- Undo, the save-state machine and three-way reconciliation (sections 3–4) remain in-memory
  service logic and are not exposed over the gateway.

### 5.7 The canvas editor's path

The canvas page already holds one socket (presence) and is not given a second one:

- Canvas → workspace: the canvas saves over HTTP. Each save (document, regenerated source,
  element edits to held pages) records a checkpoint, which the gateway delivers to workspace
  subscribers like any other.
- Workspace → canvas: correctness does not depend on a push. Every canvas save carries the
  document version it was loaded at (`If-Match`); if a code edit has changed the document since,
  the save is refused and nothing is overwritten. The canvas reloads the document on a
  same-browser sync event and when its tab regains focus or visibility.
- Consequence: a canvas open on another device learns of a code-side change when it regains focus
  or when its next save is refused, not instantly. If instant refresh is wanted there, the
  checkpoint's `documentVersion` is the signal to subscribe to.

### 5.8 A write whose checkpoint was not recorded

A file write that committed while its checkpoint insert failed would be a change nobody is told
about. Three layers prevent that from lasting:

1. `commitDurableOperation` retries the checkpoint insert (three attempts).
2. If that fails it records a recovery checkpoint (`reconcileUnannouncedChanges`): under the
   project lock it compares the stored file versions with the latest checkpoint's manifest and
   checkpoints the difference. The operation is acknowledged `applied` with `code: CHECKPOINT_RECOVERED`.
3. If the database is unreachable for that too, the acknowledgement is `error` /
   `CHECKPOINT_PENDING` (never `applied`), and the same comparison runs on every instance at each
   periodic check for subscribed projects and whenever a client subscribes. Changes younger than a
   short grace period (5 s) are left to their own request.

The recovery covers every writer, including HTTP saves, because it compares state rather than
replaying a log. Its bound: a change is announced within the grace period plus one check interval
(30 s) while anyone is subscribed, otherwise when the next client subscribes.

### 5.9 Verification

Live tests (disposable PostgreSQL): `workspace-sync-gateway.integration.test.ts`,
`workspace-sync-closure.integration.test.ts` (recovery, workspace member access and removal,
LISTEN loss, two backend processes, the canvas path) and the opt-in
`workspace-sync-browser.smoke.test.ts` (headless Chrome over the DevTools protocol against a
disposable backend process and Vite server).
