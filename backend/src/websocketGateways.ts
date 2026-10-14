import type http from "node:http";
import { initPresenceWebSocketServer } from "./services/collaboration/presence.service.js";
import { realtimeWss, handleRealtimeWebSocketConnection } from "./modules/data-platform/data-layer/realtime.service.js";
import { terminalWss, handleTerminalWebSocketConnection } from "./services/terminal/forgeTerminal.service.js";
import { createWorkspaceSyncGateway, WORKSPACE_SYNC_PATH } from "./services/workspace/workspaceSyncGateway.js";

/**
 * Routes HTTP upgrade requests on the application server to the WebSocket gateways. Kept apart
 * from server.ts so the same wiring can be attached to a server under test.
 */
export function attachWebSocketGateways(server: http.Server) {
  const presenceWss = initPresenceWebSocketServer(server, undefined, { attachUpgradeListener: false });
  const workspaceSync = createWorkspaceSyncGateway();

  const onUpgrade = (req: http.IncomingMessage, socket: import("node:stream").Duplex, head: Buffer) => {
    try {
      const pathname = new URL(req.url ?? "", "http://localhost").pathname;
      if (pathname.startsWith("/ws/presence") || pathname.startsWith("/ws/collaboration")) {
        (presenceWss as any).upgrade(req, socket, head);
      } else if (pathname === WORKSPACE_SYNC_PATH) {
        void workspaceSync.upgrade(req, socket, head);
      } else if (pathname.startsWith("/ws/realtime")) {
        realtimeWss.handleUpgrade(req, socket, head, (ws) => {
          handleRealtimeWebSocketConnection(ws, req);
        });
      } else if (pathname.startsWith("/ws/terminal")) {
        terminalWss.handleUpgrade(req, socket, head, (ws) => {
          handleTerminalWebSocketConnection(ws, req);
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
