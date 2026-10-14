/**
 * Client for the workspace sync gateway (/ws/workspace-sync).
 *
 * Subscribes to one project and reports its committed checkpoints in sequence order. The server
 * holds all state durably; this client keeps the last sequence it has seen and, after any
 * disconnect, resubscribes from it so nothing committed in between is missed. Operations are sent
 * with a client-generated ID and re-sent with the same ID after a reconnect, so a lost
 * acknowledgement never applies an edit twice.
 */
import type { VisualSourceMutation } from "./forgeProjectService";

export interface WorkspaceCheckpointEvent {
  sequence: number;
  origin: "CODE" | "VISUAL";
  kind: string;
  filePath: string | null;
  fileVersion: number | null;
  documentVersion: number | null;
  message: string | null;
  changeSetId: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface WorkspaceOperation {
  /** Reuse an ID to retry the same operation; a new one is generated when omitted. */
  operationId?: string;
  viewId?: string;
  filePath: string;
  elementId: string;
  /** The file version the edit was made against. */
  expectedRevision: number;
  mutation: VisualSourceMutation;
}

export interface WorkspaceOperationAck {
  operationId: string;
  status: "applied" | "unchanged" | "rejected" | "conflict" | "error";
  filePath: string;
  elementId: string;
  version?: number;
  sequence?: number | null;
  code?: string;
  message?: string;
  changedRange?: { startLine: number; endLine: number };
  replayed?: boolean;
}

export type WorkspaceSyncStatus = "connecting" | "online" | "offline" | "denied" | "closed";

/** The subset of the browser WebSocket this client uses. */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface WorkspaceSyncOptions {
  url: string;
  projectId: string;
  onCheckpoint: (checkpoint: WorkspaceCheckpointEvent) => void;
  onStatus?: (status: WorkspaceSyncStatus) => void;
  /** Resume from a known sequence instead of starting at the project's present. */
  afterSequence?: number;
  createSocket?: (url: string) => SocketLike;
  reconnectMs?: number;
}

/** ws://host/ws/workspace-sync for an http(s) API base URL. */
export function workspaceSyncUrl(apiBase: string): string {
  const parsed = new URL(apiBase);
  return `${parsed.protocol === "https:" ? "wss:" : "ws:"}//${parsed.host}/ws/workspace-sync`;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function connectWorkspaceSync(options: WorkspaceSyncOptions) {
  const createSocket = options.createSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
  const pending = new Map<string, { payload: Record<string, unknown>; resolve: (ack: WorkspaceOperationAck) => void; reject: (err: Error) => void }>();
  const ownChangeSets = new Set<string>();
  let lastSequence: number | null = options.afterSequence ?? null;
  let socket: SocketLike | null = null;
  let subscribed = false;
  let stopped = false;
  let attempts = 0;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let status: WorkspaceSyncStatus = "connecting";

  const setStatus = (next: WorkspaceSyncStatus) => {
    if (status === next) return;
    status = next;
    options.onStatus?.(next);
  };

  const transmit = (payload: Record<string, unknown>) => {
    if (socket && socket.readyState === 1) socket.send(JSON.stringify(payload));
  };

  function stop(final: WorkspaceSyncStatus, reason: string) {
    stopped = true;
    if (retry) clearTimeout(retry);
    if (heartbeat) clearInterval(heartbeat);
    setStatus(final);
    for (const [, entry] of pending) entry.reject(new Error(reason));
    pending.clear();
    try { socket?.close(1000, "client closed"); } catch { /* already closed */ }
  }

  function onMessage(raw: unknown) {
    let msg: Record<string, unknown> & { type?: string };
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "ready") {
      transmit({ type: "subscribe", projectId: options.projectId, ...(lastSequence !== null ? { afterSequence: lastSequence } : {}) });
    } else if (msg.type === "subscribed" && msg.projectId === options.projectId) {
      if (lastSequence === null || msg.reset) lastSequence = Number(msg.sequence);
      subscribed = true;
      attempts = 0;
      setStatus("online");
      // Anything not yet acknowledged is sent again under its original ID.
      for (const [, entry] of pending) transmit(entry.payload);
    } else if (msg.type === "checkpoint" && msg.projectId === options.projectId) {
      const cp = msg.checkpoint as WorkspaceCheckpointEvent;
      if (lastSequence !== null && cp.sequence <= lastSequence) return;
      lastSequence = cp.sequence;
      if (cp.changeSetId && ownChangeSets.has(cp.changeSetId)) return; // our own edit, already acknowledged
      options.onCheckpoint(cp);
    } else if (msg.type === "ack" && typeof msg.operationId === "string" && pending.has(msg.operationId)) {
      const entry = pending.get(msg.operationId)!;
      pending.delete(msg.operationId);
      const ack = { ...msg };
      delete ack.type;
      delete ack.projectId;
      entry.resolve(ack as unknown as WorkspaceOperationAck);
    } else if ((msg.type === "error" && msg.code === "ACCESS_DENIED") || (msg.type === "unsubscribed" && msg.reason === "ACCESS_REVOKED")) {
      stop("denied", "Access to this project was denied.");
    }
  }

  function connect() {
    if (stopped) return;
    subscribed = false;
    setStatus(attempts === 0 && status !== "offline" ? "connecting" : "offline");
    let current: SocketLike;
    try {
      current = createSocket(options.url);
    } catch {
      scheduleReconnect();
      return;
    }
    socket = current;
    current.onmessage = (event) => onMessage(event.data);
    current.onerror = () => undefined;
    current.onclose = (event) => {
      if (socket !== current || stopped) return;
      subscribed = false;
      // 1008: the server ended the session (revoked or policy); reconnecting would not help.
      if (event?.code === 1008) return stop("denied", event.reason || "The session is no longer valid.");
      setStatus("offline");
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (stopped) return;
    const delay = Math.min(15_000, (options.reconnectMs ?? 1000) * 2 ** Math.min(attempts++, 4));
    retry = setTimeout(connect, delay);
  }

  heartbeat = setInterval(() => transmit({ type: "ping" }), 25_000);
  (heartbeat as unknown as { unref?: () => void }).unref?.();
  connect();

  return {
    /** Resolves with the server's durable outcome; rejects only if the client is closed or denied first. */
    sendOperation(operation: WorkspaceOperation): Promise<WorkspaceOperationAck> {
      if (stopped) return Promise.reject(new Error("The workspace sync connection is closed."));
      const operationId = operation.operationId ?? newId();
      ownChangeSets.add(`op:${operationId}`);
      const payload = { type: "operation", projectId: options.projectId, ...operation, operationId };
      return new Promise((resolve, reject) => {
        pending.set(operationId, { payload, resolve, reject });
        if (subscribed) transmit(payload);
      });
    },
    lastSequence: () => lastSequence,
    status: () => status,
    close: () => stop("closed", "The workspace sync connection was closed."),
  };
}

export type WorkspaceSyncConnection = ReturnType<typeof connectWorkspaceSync>;
