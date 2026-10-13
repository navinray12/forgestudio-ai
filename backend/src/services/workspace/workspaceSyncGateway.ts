/**
 * Workspace sync gateway: /ws/workspace-sync (blueprint §34, WP-18).
 *
 * A transport over state that lives in PostgreSQL. A client subscribes to a project it belongs to,
 * sends visual operations, and receives the project's committed checkpoints in sequence order.
 *
 * - Authority: file versions, checkpoints (gap-free sequence per project) and operation
 *   idempotency are rows in PostgreSQL. This process keeps only per-connection delivery cursors,
 *   so a restart or another server instance loses nothing: a client reconnects with the last
 *   sequence it saw and is sent what it missed.
 * - Fan-out: recordCheckpoint issues pg_notify inside its transaction. The notification is only
 *   a wake-up; the gateway reads the checkpoints from the table and sends each subscriber exactly
 *   the ones after its cursor, in order. A lost notification is recovered by the next one, by a
 *   listener reconnect or by the periodic sweep.
 * - Scope: checkpoints are sent only to connections subscribed to that project, and a
 *   subscription requires verified project access. Session and access are re-checked on every
 *   operation and periodically; a revoked session is disconnected.
 * - Acknowledgements are the durable outcome of RealtimeSyncService.commitDurableOperation; the
 *   connection that sent an operation gets its acknowledgement, not an echo of its own checkpoint.
 */
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { z } from "zod";
import { AUTH_COOKIE_NAME, browserOrigin } from "../../config/auth.js";
import { pgPool } from "../../config/prisma.js";
import { authenticateSession } from "../session-authentication.js";
import { getForgeProjectById } from "../project/forgeProject.service.js";
import { RealtimeSyncService, type DurableOperationInput, type OperationAck } from "../compiler/realtimeSync.service.js";
import {
  WORKSPACE_CHECKPOINT_CHANNEL,
  getCheckpointState,
  listCheckpointsAfter,
  reconcileUnannouncedChanges,
  type WorkspaceCheckpoint,
} from "./workspaceCheckpoints.service.js";

export const WORKSPACE_SYNC_PATH = "/ws/workspace-sync";

interface Principal {
  user: { id: string; role?: string };
}

export interface WorkspaceSyncDeps {
  authenticate: (token: unknown) => Promise<Principal | null>;
  /** Resolves the project for a user, or throws when the user has no access to it. */
  getProject: (projectId: string, user: { id: string; role?: string }) => Promise<{ id: string; websiteId?: string | null }>;
  commit: (input: DurableOperationInput) => Promise<OperationAck>;
  listAfter: (projectId: string, afterSequence: number, limit: number) => Promise<WorkspaceCheckpoint[]>;
  latestSequence: (projectId: string) => Promise<number>;
  /** Records a checkpoint for changes that were saved without one; null when there are none. */
  reconcile: (projectId: string, options: { graceMs: number; websiteId?: string | null }) => Promise<unknown>;
  origin: () => string;
}

const defaults: WorkspaceSyncDeps = {
  authenticate: authenticateSession as WorkspaceSyncDeps["authenticate"],
  getProject: getForgeProjectById as unknown as WorkspaceSyncDeps["getProject"],
  commit: (input) => RealtimeSyncService.commitDurableOperation(input),
  listAfter: listCheckpointsAfter,
  latestSequence: async (projectId) => (await getCheckpointState(projectId)).latest?.sequence ?? 0,
  reconcile: reconcileUnannouncedChanges,
  origin: browserOrigin,
};

const uuid = z.string().uuid();
const message = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping") }),
  z.object({ type: z.literal("subscribe"), projectId: uuid, afterSequence: z.number().int().min(0).optional() }),
  z.object({ type: z.literal("unsubscribe"), projectId: uuid }),
  z.object({
    type: z.literal("operation"),
    projectId: uuid,
    operationId: z.string().regex(/^[A-Za-z0-9._:-]{8,100}$/),
    viewId: z.string().max(100).optional(),
    filePath: z.string().min(1).max(500),
    elementId: z.string().min(1).max(120),
    expectedRevision: z.number().int().min(1),
    mutation: z.object({ type: z.string().max(40) }).passthrough().optional(),
    operation: z
      .object({
        operationType: z.enum(["DRAG", "PROPERTY_UPDATE", "TEXT_EDIT", "INSERT", "REMOVE", "REORDER"]),
        propertyKey: z.string().max(120).optional(),
        newValue: z.unknown().optional(),
        reorderIndex: z.number().int().min(0).optional(),
        parentNodeId: z.string().max(120).optional(),
      })
      .optional(),
  }),
]);

interface Peer {
  ws: WebSocket;
  token: string;
  userId: string;
  /** projectId -> last checkpoint sequence sent to (or produced by) this connection */
  cursors: Map<string, number>;
  /** Change sets this connection submitted; their checkpoints are acknowledged, not echoed. */
  ownChangeSets: Set<string>;
  queue: Promise<void>;
  windowStart: number;
  windowCount: number;
  alive: boolean;
}

const MAX_PEERS = 2000;
const MAX_PEERS_PER_USER = 16;
const MAX_SUBSCRIPTIONS = 10;
const MESSAGES_PER_10S = 120;

function bearerOrCookie(request: IncomingMessage): { token: string; viaCookie: boolean } | null {
  const header = request.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) return { token: header.slice(7).trim(), viaCookie: false };
  const matches = (request.headers.cookie ?? "").split(";").map((v) => v.trim()).filter((v) => v.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (matches.length !== 1) return null;
  try {
    return { token: decodeURIComponent(matches[0].slice(AUTH_COOKIE_NAME.length + 1)), viaCookie: true };
  } catch {
    return null;
  }
}

/** What a subscriber is told about a checkpoint (no source manifest, no stored responses). */
function publicCheckpoint(cp: WorkspaceCheckpoint) {
  return {
    sequence: cp.sequence,
    origin: cp.origin,
    kind: cp.kind,
    filePath: cp.filePath,
    fileVersion: cp.filePath ? cp.sourceManifest.find((f) => f.path === cp.filePath)?.version ?? null : null,
    documentVersion: cp.documentVersion,
    message: cp.message,
    changeSetId: cp.changeSetId,
    createdById: cp.createdById,
    createdAt: cp.createdAt,
  };
}

export function createWorkspaceSyncGateway(
  overrides: Partial<WorkspaceSyncDeps> = {},
  options: { sweepMs?: number; reconcileGraceMs?: number } = {}
) {
  const deps = { ...defaults, ...overrides };
  const graceMs = options.reconcileGraceMs ?? 5000;

  /** Announces anything that was written to the project without a checkpoint. Never throws. */
  async function recover(projectId: string) {
    try {
      await deps.reconcile(projectId, { graceMs });
    } catch (err: any) {
      console.warn("[workspace-sync] recovery check failed:", err?.message || err);
    }
  }
  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
  const peers = new Set<Peer>();
  const rooms = new Map<string, Set<Peer>>();
  const delivering = new Map<string, Promise<void>>();
  let pendingUpgrades = 0;
  let closed = false;

  const send = (peer: Peer, payload: unknown) => {
    if (peer.ws.readyState === peer.ws.OPEN) peer.ws.send(JSON.stringify(payload));
  };

  function leave(peer: Peer, projectId: string) {
    peer.cursors.delete(projectId);
    const room = rooms.get(projectId);
    room?.delete(peer);
    if (room?.size === 0) rooms.delete(projectId);
  }

  /**
   * Sends every subscriber of a project the checkpoints after its cursor, in sequence order.
   * Runs one at a time per project; callers only signal that there may be something new.
   */
  function deliver(projectId: string): Promise<void> {
    const run = async () => {
      for (;;) {
        const room = rooms.get(projectId);
        if (!room || room.size === 0) return;
        const from = Math.min(...[...room].map((peer) => peer.cursors.get(projectId) ?? 0));
        const checkpoints = await deps.listAfter(projectId, from, 200);
        if (checkpoints.length === 0) return;
        for (const peer of room) {
          for (const cp of checkpoints) {
            const cursor = peer.cursors.get(projectId);
            if (cursor === undefined || cp.sequence <= cursor) continue;
            const own = cp.changeSetId !== null && peer.ownChangeSets.has(cp.changeSetId);
            if (!own) send(peer, { type: "checkpoint", projectId, checkpoint: publicCheckpoint(cp) });
            peer.cursors.set(projectId, cp.sequence);
          }
        }
        if (checkpoints.length < 200) return;
      }
    };
    const next = (delivering.get(projectId) ?? Promise.resolve()).then(run).catch((err) => {
      console.warn("[workspace-sync] checkpoint delivery failed:", err?.message || err);
    });
    delivering.set(projectId, next);
    void next.finally(() => {
      if (delivering.get(projectId) === next) delivering.delete(projectId);
    });
    return next;
  }

  /** The session behind a connection, or null (after closing it) when it is no longer valid. */
  async function currentUser(peer: Peer): Promise<{ id: string; role?: string } | null> {
    let principal: Principal | null = null;
    try {
      principal = await deps.authenticate(peer.token);
    } catch {
      principal = null;
    }
    if (!principal || principal.user.id !== peer.userId) {
      peer.ws.close(1008, "Session revoked");
      return null;
    }
    return principal.user;
  }

  async function handle(peer: Peer, raw: string) {
    let parsed: z.infer<typeof message>;
    try {
      parsed = message.parse(JSON.parse(raw));
    } catch {
      send(peer, { type: "error", code: "INVALID_MESSAGE", message: "The message is not a valid workspace sync event." });
      return;
    }

    if (parsed.type === "ping") return send(peer, { type: "pong", timestamp: Date.now() });
    if (parsed.type === "unsubscribe") {
      leave(peer, parsed.projectId);
      return send(peer, { type: "unsubscribed", projectId: parsed.projectId });
    }

    const user = await currentUser(peer);
    if (!user) return;
    const { projectId } = parsed;
    let project: { id: string; websiteId?: string | null };
    try {
      project = await deps.getProject(projectId, user);
    } catch {
      // No distinction between "does not exist" and "not yours".
      leave(peer, projectId);
      if (parsed.type === "operation") {
        return send(peer, { type: "ack", projectId, operationId: parsed.operationId, filePath: parsed.filePath, elementId: parsed.elementId, status: "rejected", code: "ACCESS_DENIED", message: "Project not found or access denied." });
      }
      return send(peer, { type: "error", projectId, code: "ACCESS_DENIED", message: "Project not found or access denied." });
    }

    if (parsed.type === "subscribe") {
      if (!peer.cursors.has(projectId) && peer.cursors.size >= MAX_SUBSCRIPTIONS) {
        return send(peer, { type: "error", projectId, code: "SUBSCRIPTION_LIMIT", message: "Too many project subscriptions on this connection." });
      }
      // A change saved without a checkpoint is announced before the client is told where the
      // project stands, so it cannot be missed by someone joining later.
      await recover(projectId);
      const latest = await deps.latestSequence(projectId);
      // A cursor ahead of the project's history (e.g. after a restore) restarts from the present.
      const reset = parsed.afterSequence !== undefined && parsed.afterSequence > latest;
      const cursor = parsed.afterSequence === undefined || reset ? latest : parsed.afterSequence;
      peer.cursors.set(projectId, cursor);
      if (!rooms.has(projectId)) rooms.set(projectId, new Set());
      rooms.get(projectId)!.add(peer);
      send(peer, { type: "subscribed", projectId, sequence: latest, resumedFrom: cursor, ...(reset ? { reset: true } : {}) });
      if (cursor < latest) await deliver(projectId);
      return;
    }

    // operation
    if (!peer.cursors.has(projectId)) {
      return send(peer, { type: "ack", projectId, operationId: parsed.operationId, filePath: parsed.filePath, elementId: parsed.elementId, status: "rejected", code: "NOT_SUBSCRIBED", message: "Subscribe to the project before sending operations." });
    }
    const changeSetId = `op:${parsed.operationId}`.slice(0, 128);
    peer.ownChangeSets.add(changeSetId);
    if (peer.ownChangeSets.size > 1000) peer.ownChangeSets.delete(peer.ownChangeSets.values().next().value as string);

    let ack: OperationAck;
    try {
      ack = await deps.commit({
        projectId,
        websiteId: project.websiteId ?? null,
        actorId: user.id,
        operationId: parsed.operationId,
        viewId: parsed.viewId,
        filePath: parsed.filePath,
        elementId: parsed.elementId,
        expectedRevision: parsed.expectedRevision,
        mutation: parsed.mutation as DurableOperationInput["mutation"],
        operation: parsed.operation as DurableOperationInput["operation"],
      });
    } catch (err: any) {
      console.error("[workspace-sync] commit failed:", err?.message || err);
      ack = { operationId: parsed.operationId, filePath: parsed.filePath, elementId: parsed.elementId, status: "error", code: "PERSISTENCE_ERROR", message: "The operation could not be completed." };
    }
    send(peer, { type: "ack", projectId, ...ack });
    // Other subscribers are told from the checkpoint table; nothing is broadcast for an operation
    // that did not commit.
    if (ack.status === "applied") void deliver(projectId);
  }

  function attach(ws: WebSocket, principal: Principal, token: string) {
    const peer: Peer = {
      ws, token, userId: principal.user.id, cursors: new Map(), ownChangeSets: new Set(),
      queue: Promise.resolve(), windowStart: Date.now(), windowCount: 0, alive: true,
    };
    peers.add(peer);
    ws.on("pong", () => { peer.alive = true; });
    ws.on("message", (data, isBinary) => {
      if (isBinary) return ws.close(1003, "Text messages only");
      const now = Date.now();
      if (now - peer.windowStart > 10_000) { peer.windowStart = now; peer.windowCount = 0; }
      if (++peer.windowCount > MESSAGES_PER_10S) return ws.close(1008, "Message limit exceeded");
      const raw = data.toString();
      // One message at a time per connection, in arrival order.
      peer.queue = peer.queue.then(() => handle(peer, raw)).catch((err) => {
        console.error("[workspace-sync] message handling failed:", err?.message || err);
        send(peer, { type: "error", code: "INTERNAL_ERROR", message: "The message could not be processed." });
      });
    });
    const detach = () => {
      for (const projectId of [...peer.cursors.keys()]) leave(peer, projectId);
      peers.delete(peer);
    };
    ws.on("close", detach);
    ws.on("error", detach);
    send(peer, { type: "ready", userId: peer.userId });
  }

  async function upgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
    const reject = (status = 401) => {
      if (!socket.destroyed) socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`);
    };
    try {
      if (closed) return reject(503);
      if ((request.url?.length ?? 0) > 2048 || request.method !== "GET") return reject(400);
      if (new URL(request.url ?? "", "http://sync.invalid").pathname !== WORKSPACE_SYNC_PATH) return reject(404);
      const credential = bearerOrCookie(request);
      if (!credential) return reject(401);
      // A browser sends the session cookie to any origin's WebSocket; only our own origin may use it.
      if (credential.viaCookie && request.headers.origin !== deps.origin()) return reject(403);
      if (pendingUpgrades >= 32 || peers.size + pendingUpgrades >= MAX_PEERS) return reject(503);
      pendingUpgrades++;
      const timer = setTimeout(() => socket.destroy(), 5000);
      try {
        const principal = await deps.authenticate(credential.token);
        if (!principal || socket.destroyed) return reject(401);
        if ([...peers].filter((p) => p.userId === principal.user.id).length >= MAX_PEERS_PER_USER) return reject(429);
        wss.handleUpgrade(request, socket, head, (ws) => attach(ws, principal, credential.token));
      } finally {
        pendingUpgrades--;
        clearTimeout(timer);
      }
    } catch {
      reject(401);
    }
  }

  /** Re-checks every connection's session and project access, drops dead sockets, and catches up deliveries. */
  async function sweep() {
    for (const peer of [...peers]) {
      if (!peer.alive) { peer.ws.terminate(); continue; }
      peer.alive = false;
      try { peer.ws.ping(); } catch { /* closing */ }
      const user = await currentUser(peer);
      if (!user) continue;
      for (const projectId of [...peer.cursors.keys()]) {
        try {
          await deps.getProject(projectId, user);
        } catch {
          leave(peer, projectId);
          send(peer, { type: "unsubscribed", projectId, reason: "ACCESS_REVOKED" });
        }
      }
    }
    await Promise.all([...rooms.keys()].map(async (projectId) => {
      await recover(projectId);
      await deliver(projectId);
    }));
  }
  const sweepTimer = setInterval(() => void sweep().catch(() => undefined), options.sweepMs ?? 30_000);
  sweepTimer.unref?.();

  // --- PostgreSQL LISTEN: checkpoints committed by any instance or any HTTP request -------------
  let listener: import("pg").PoolClient | null = null;
  let listenerRetry: ReturnType<typeof setTimeout> | null = null;
  let listening = false;
  async function listen(attempt = 0): Promise<void> {
    if (closed) return;
    try {
      const client = await pgPool.connect();
      const lost = () => {
        if (listener !== client) return;
        listener = null;
        listening = false;
        try { client.release(true); } catch { /* already gone */ }
        if (!closed) listenerRetry = setTimeout(() => void listen(1), 1000);
      };
      client.on("error", lost);
      client.on("end", lost);
      client.on("notification", (note) => {
        if (note.channel !== WORKSPACE_CHECKPOINT_CHANNEL || !note.payload) return;
        try {
          const { projectId } = JSON.parse(note.payload);
          if (typeof projectId === "string" && rooms.has(projectId)) void deliver(projectId);
        } catch { /* not ours */ }
      });
      await client.query(`LISTEN ${WORKSPACE_CHECKPOINT_CHANNEL}`);
      if (closed) { client.release(true); return; }
      listener = client;
      listening = true;
      // Anything committed while we were not listening is picked up from the table.
      if (attempt > 0) await Promise.all([...rooms.keys()].map((projectId) => deliver(projectId)));
    } catch (err: any) {
      if (closed) return;
      console.warn("[workspace-sync] checkpoint listener unavailable, retrying:", err?.message || err);
      listenerRetry = setTimeout(() => void listen(attempt + 1), Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)));
    }
  }
  const listenerReady = listen();

  async function close() {
    closed = true;
    clearInterval(sweepTimer);
    if (listenerRetry) clearTimeout(listenerRetry);
    await listenerReady.catch(() => undefined);
    for (const peer of peers) peer.ws.close(1001, "Server shutting down");
    const client = listener;
    listener = null;
    if (client) {
      try { await client.query(`UNLISTEN ${WORKSPACE_CHECKPOINT_CHANNEL}`); } catch { /* connection gone */ }
      client.release(true);
    }
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  }

  return {
    wss,
    upgrade,
    sweep,
    close,
    /** Resolves once the checkpoint listener has been set up (or its first attempt failed). */
    ready: listenerReady,
    stats: () => ({ connections: peers.size, projects: rooms.size, listening }),
  };
}

export type WorkspaceSyncGateway = ReturnType<typeof createWorkspaceSyncGateway>;
