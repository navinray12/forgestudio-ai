import type http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type pg from "pg";
import { TenantPoolManager } from "../common/pool-manager.js";
import { validateIdentifier } from "./query-compiler.js";
import { verifyProjectAccess } from "../common/project-access.js";
import type { DatabaseEnvironment } from "../../../generated/prisma/client.js";

// Dedicated WebSocketServer instance for /ws/realtime upgrades
export const realtimeWss = new WebSocketServer({
  noServer: true,
  maxPayload: 32768,
  perMessageDeflate: false,
});

// Map of `${projectId}:${table}` -> Set of connected WebSockets
const channelSubscriptions = new Map<string, Set<WebSocket>>();

// Set of all channels a specific WebSocket is subscribed to: WebSocket -> Set<channelKey>
const socketChannels = new Map<WebSocket, Set<string>>();

// Active persistent LISTEN clients: projectId -> pg.PoolClient
const activeListeners = new Map<string, { client: pg.PoolClient; refCount: number }>();

/**
 * Ensures a persistent LISTEN client is active for the specified tenant database.
 */
async function ensureProjectListener(
  projectId: string,
  environment: DatabaseEnvironment = "PRODUCTION"
): Promise<void> {
  const existing = activeListeners.get(projectId);
  if (existing) {
    existing.refCount++;
    return;
  }

  let listenerClient: pg.PoolClient | null = null;
  try {
    const pool = await TenantPoolManager.getTenantPool(projectId, environment);
    const client = await pool.connect();
    listenerClient = client;

    client.on("notification", (msg) => {
      if (msg.channel === "forge_realtime" && msg.payload) {
        try {
          const payload = JSON.parse(msg.payload);
          const channelKey = `${projectId}:${payload.table}`;
          const subscribers = channelSubscriptions.get(channelKey);

          if (subscribers && subscribers.size > 0) {
            // Project membership is not row-level authorization. Never stream the
            // trigger's full NEW/OLD records to subscribers: a collaborator could
            // otherwise read rows that PostgreSQL RLS would deny through HTTP.
            // Deliver a table invalidation only; clients must refetch via the
            // authenticated, scope-checked data API.
            const outgoing = JSON.stringify({
              event: "REALTIME_EVENT",
              projectId,
              table: payload.table,
              action: payload.action,
              timestamp: payload.commit_timestamp,
            });

            for (const ws of subscribers) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(outgoing);
              }
            }
          }
        } catch (err) {
          console.warn("[RealtimeService] Error parsing notification payload:", err);
        }
      }
    });

    client.on("error", (err) => {
      console.warn(`[RealtimeService] Listener error for project ${projectId}:`, err);
      activeListeners.delete(projectId);
      try {
        client.release(true);
      } catch {
        // Ignored
      }
    });

    await client.query("LISTEN forge_realtime;");
    activeListeners.set(projectId, { client, refCount: 1 });
    listenerClient = null; // The active-listener registry now owns this connection.
  } catch (err) {
    // Failed LISTEN must not leak a PostgreSQL pool connection.
    try { listenerClient?.release(true); } catch { /* already closed */ }
    console.error(`[RealtimeService] Failed to establish listener for project ${projectId}:`, err);
    throw err; // Do not acknowledge a subscription with no active LISTEN connection.
  }
}

/**
 * Releases persistent listener when all subscribers for a project disconnect.
 */
function releaseProjectListener(projectId: string): void {
  const entry = activeListeners.get(projectId);
  if (!entry) return;

  entry.refCount--;
  if (entry.refCount <= 0) {
    activeListeners.delete(projectId);
    try {
      void entry.client.query("UNLISTEN forge_realtime;").finally(() => {
        entry.client.release();
      });
    } catch {
      // Ignored
    }
  }
}

/**
 * Enables realtime CDC triggers on a specific tenant table.
 */
export async function enableTableRealtime(
  projectId: string,
  table: string,
  environment: DatabaseEnvironment = "PRODUCTION"
): Promise<void> {
  const safeTable = validateIdentifier(table);
  const pool = await TenantPoolManager.getTenantPool(projectId, environment);
  const client = await pool.connect();

  try {
    await client.query("BEGIN;");

    // Install notification function
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_forge_realtime() RETURNS trigger AS $$
      BEGIN
        PERFORM pg_notify('forge_realtime', json_build_object(
          'table', TG_TABLE_NAME,
          'action', TG_OP,
          'record', CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE row_to_json(NEW) END,
          'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
          'commit_timestamp', clock_timestamp()
        )::text);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Install trigger on table
    await client.query(`
      DROP TRIGGER IF EXISTS trg_forge_realtime ON "public"."${safeTable}";
      CREATE TRIGGER trg_forge_realtime
      AFTER INSERT OR UPDATE OR DELETE ON "public"."${safeTable}"
      FOR EACH ROW EXECUTE FUNCTION notify_forge_realtime();
    `);

    await client.query("COMMIT;");
  } catch (error) {
    await client.query("ROLLBACK;");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Handles incoming WebSocket connection on `/ws/realtime`.
 * Enforces session authentication and per-project authorization before allowing subscriptions.
 */
export function handleRealtimeWebSocketConnection(
  ws: WebSocket,
  _req: http.IncomingMessage,
  user?: { id?: string; role?: string }
): void {
  socketChannels.set(ws, new Set());

  // Ping-pong liveness
  let isAlive = true;
  ws.on("pong", () => {
    isAlive = true;
  });

  const heartbeatInterval = setInterval(() => {
    if (!isAlive) {
      cleanupSocket(ws);
      ws.terminate();
      return;
    }
    isAlive = false;
    ws.ping();
  }, 30000);

  function cleanupSocket(socket: WebSocket) {
    clearInterval(heartbeatInterval);
    const channels = socketChannels.get(socket);
    if (channels) {
      for (const channelKey of channels) {
        const subscribers = channelSubscriptions.get(channelKey);
        if (subscribers) {
          subscribers.delete(socket);
          if (subscribers.size === 0) {
            channelSubscriptions.delete(channelKey);
          }
        }
        const [projId] = channelKey.split(":");
        if (projId) {
          releaseProjectListener(projId);
        }
      }
      socketChannels.delete(socket);
    }
  }

  ws.on("close", () => {
    cleanupSocket(ws);
  });

  ws.on("error", () => {
    cleanupSocket(ws);
  });

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.event === "ping" || msg.type === "PING") {
        ws.send(JSON.stringify({ event: "pong", timestamp: Date.now() }));
        return;
      }

      if (msg.event === "subscribe") {
        const { projectId, table } = msg;
        if (!projectId || !table) {
          ws.send(JSON.stringify({ event: "error", code: "BAD_REQUEST", message: "projectId and table required" }));
          return;
        }

        // SEC-03: Realtime data exposure remediation
        if (!user || !user.id) {
          ws.send(JSON.stringify({ event: "error", code: "UNAUTHORIZED", message: "Authentication required to subscribe to realtime events" }));
          return;
        }

        // Verify project authorization for authenticated user
        try {
          // Realtime subscriptions refer to Website IDs, just like the data API.
          await verifyProjectAccess(projectId, user.id);
        } catch (authErr: any) {
          ws.send(JSON.stringify({
            event: "error",
            code: "FORBIDDEN",
            message: authErr?.message || "Forbidden: Access to project realtime data denied",
          }));
          return;
        }

        const safeTable = validateIdentifier(table);
        const channelKey = `${projectId}:${safeTable}`;
        const existingChannels = socketChannels.get(ws);
        if (existingChannels?.has(channelKey)) {
          // Repeated subscribe frames must not acquire additional listener refs.
          ws.send(JSON.stringify({ event: "subscribed", projectId, table: safeTable, channel: channelKey }));
          return;
        }

        // Acquire a DB listener before acknowledging subscription success.
        await ensureProjectListener(projectId);
        if (ws.readyState !== WebSocket.OPEN) {
          releaseProjectListener(projectId);
          return;
        }

        if (!channelSubscriptions.has(channelKey)) {
          channelSubscriptions.set(channelKey, new Set());
        }
        channelSubscriptions.get(channelKey)!.add(ws);
        let userChannels = socketChannels.get(ws);
        if (!userChannels) {
          userChannels = new Set();
          socketChannels.set(ws, userChannels);
        }
        userChannels.add(channelKey);

        ws.send(
          JSON.stringify({
            event: "subscribed",
            projectId,
            table: safeTable,
            channel: channelKey,
          })
        );
      } else if (msg.event === "unsubscribe") {
        const { projectId, table } = msg;
        if (!projectId || !table) return;

        const safeTable = validateIdentifier(table);
        const channelKey = `${projectId}:${safeTable}`;

        const userChannels = socketChannels.get(ws);
        if (!userChannels?.has(channelKey)) {
          ws.send(JSON.stringify({ event: "error", code: "NOT_SUBSCRIBED", message: "No active subscription for this channel" }));
          return;
        }
        userChannels.delete(channelKey);

        const subscribers = channelSubscriptions.get(channelKey);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) channelSubscriptions.delete(channelKey);
        }
        releaseProjectListener(projectId);

        ws.send(
          JSON.stringify({
            event: "unsubscribed",
            projectId,
            table: safeTable,
          })
        );
      }
    } catch (err: any) {
      ws.send(
        JSON.stringify({
          event: "error",
          message: err?.message || "Invalid message format",
        })
      );
    }
  });
}
