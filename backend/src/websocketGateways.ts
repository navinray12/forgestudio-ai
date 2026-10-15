import type http from "node:http";
import { initPresenceWebSocketServer } from "./services/collaboration/presence.service.js";
import { realtimeWss, handleRealtimeWebSocketConnection } from "./modules/data-platform/data-layer/realtime.service.js";
import { terminalWss, handleTerminalWebSocketConnection } from "./services/terminal/forgeTerminal.service.js";
import { createWorkspaceSyncGateway, WORKSPACE_SYNC_PATH } from "./services/workspace/workspaceSyncGateway.js";

import { AUTH_COOKIE_NAME, browserOrigin } from "./config/auth.js";
import { authenticateSession } from "./services/session-authentication.js";

function bearerOrCookie(request: http.IncomingMessage): { token: string; viaCookie: boolean } | null {
  const header = request.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return { token: header.slice(7).trim(), viaCookie: false };
  }
  const url = new URL(request.url ?? "", "http://localhost");
  const queryToken = url.searchParams.get("token");
  if (queryToken) {
    return { token: queryToken, viaCookie: false };
  }
  const matches = (request.headers.cookie ?? "").split(";").map((v) => v.trim()).filter((v) => v.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (matches.length !== 1) return null;
  try {
    return { token: decodeURIComponent(matches[0].slice(AUTH_COOKIE_NAME.length + 1)), viaCookie: true };
  } catch {
    return null;
  }
}

function rejectUpgrade(socket: import("node:stream").Duplex, status = 401, text = "Unauthorized") {
  if (!socket.destroyed) {
    socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${text}`);
  }
}

/**
 * Routes HTTP upgrade requests on the application server to the WebSocket gateways. Kept apart
 * from server.ts so the same wiring can be attached to a server under test.
 */
export function attachWebSocketGateways(server: http.Server) {
  const presenceWss = initPresenceWebSocketServer(server, undefined, { attachUpgradeListener: false });
  const workspaceSync = createWorkspaceSyncGateway();

  const onUpgrade = async (req: http.IncomingMessage, socket: import("node:stream").Duplex, head: Buffer) => {
    try {
      const pathname = new URL(req.url ?? "", "http://localhost").pathname;
      if (pathname.startsWith("/ws/presence") || pathname.startsWith("/ws/collaboration")) {
        (presenceWss as any).upgrade(req, socket, head);
      } else if (pathname === WORKSPACE_SYNC_PATH) {
        void workspaceSync.upgrade(req, socket, head);
      } else if (pathname.startsWith("/ws/realtime")) {
        // Enforce authentication & origin checks before upgrading realtime connection
        const credential = bearerOrCookie(req);
        if (!credential) {
          rejectUpgrade(socket, 401, "Authentication Required");
          return;
        }
        if (credential.viaCookie && req.headers.origin !== browserOrigin()) {
          rejectUpgrade(socket, 403, "Origin Forbidden");
          return;
        }
        const session = await authenticateSession(credential.token).catch(() => null);
        if (!session || !session.user) {
          rejectUpgrade(socket, 401, "Invalid Session");
          return;
        }

        realtimeWss.handleUpgrade(req, socket, head, (ws) => {
          handleRealtimeWebSocketConnection(ws, req, session.user);
        });
      } else if (pathname.startsWith("/ws/terminal")) {
        // Enforce authentication & origin checks before upgrading terminal connection
        const credential = bearerOrCookie(req);
        if (!credential) {
          rejectUpgrade(socket, 401, "Authentication Required");
          return;
        }
        if (credential.viaCookie && req.headers.origin !== browserOrigin()) {
          rejectUpgrade(socket, 403, "Origin Forbidden");
          return;
        }
        const session = await authenticateSession(credential.token).catch(() => null);
        if (!session || !session.user) {
          rejectUpgrade(socket, 401, "Invalid Session");
          return;
        }

        terminalWss.handleUpgrade(req, socket, head, (ws) => {
          handleTerminalWebSocketConnection(ws, req, session.user);
        });
      } else {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  };
  server.on("upgrade", onUpgrade);

  return {
    workspaceSync,
    async close() {
      server.off("upgrade", onUpgrade);
      await workspaceSync.close();
      try { (presenceWss as any).close?.(); } catch { /* already closed */ }
    },
  };
}
