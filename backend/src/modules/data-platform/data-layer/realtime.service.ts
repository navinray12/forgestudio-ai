import type http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type pg from "pg";
import { TenantPoolManager } from "../common/pool-manager.js";
import { validateIdentifier } from "./query-compiler.js";
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

  try {
    const pool = await TenantPoolManager.getTenantPool(projectId, environment);
    const client = await pool.connect();

    client.on("notification", (msg) => {
      if (msg.channel === "forge_realtime" && msg.payload) {
        try {
          const payload = JSON.parse(msg.payload);
          const channelKey = `${projectId}:${payload.table}`;
          const subscribers = channelSubscriptions.get(channelKey);

          if (subscribers && subscribers.size > 0) {
            const outgoing = JSON.stringify({
              event: "REALTIME_EVENT",
              projectId,
              table: payload.table,
              action: payload.action,
              record: payload.record,
              oldRecord: payload.old_record,
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
  } catch (err) {
    console.error(`[RealtimeService] Failed to establish listener for project ${projectId}:`, err);
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
 */
export function handleRealtimeWebSocketConnection(
  ws: WebSocket,
  _req: http.IncomingMessage
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
          ws.send(JSON.stringify({ event: "error", message: "projectId and table required" }));
          return;
        }

        const safeTable = validateIdentifier(table);
        const channelKey = `${projectId}:${safeTable}`;

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

        // Ensure database listener is active
        await ensureProjectListener(projectId);

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

        const subscribers = channelSubscriptions.get(channelKey);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) channelSubscriptions.delete(channelKey);
        }

        const userChannels = socketChannels.get(ws);
        if (userChannels) userChannels.delete(channelKey);

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
