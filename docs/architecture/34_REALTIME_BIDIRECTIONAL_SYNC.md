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
