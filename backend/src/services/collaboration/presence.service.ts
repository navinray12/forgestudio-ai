import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer, IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AUTH_COOKIE_NAME, browserOrigin } from "../../config/auth.js";
import { authenticateSession } from "../session-authentication.js";
import { canReadWebsitePresence } from "../websites/scoped-access.js";

export interface PeerUser { userId: string; name: string; color: string }
export interface PeerState {
  socketId: string; user: PeerUser; websiteId: string;
  cursor?: { x: number; y: number }; selectedElementId?: string | null; lastSeen: number;
}
type Principal = { id: string; user: { id: string; fullName: string | null }; expiresAt: Date };
type Dependencies = {
  authenticate: (token: unknown) => Promise<Principal | null>;
  canRead: (site: string, actor: string) => Promise<boolean>;
  origin: () => string;
};
const messageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("JOIN"), websiteId: z.uuid(), user: z.unknown().optional() }).strict(),
  z.object({ type: z.literal("CURSOR"), cursor: z.object({ x: z.number().finite().min(-100000).max(100000), y: z.number().finite().min(-100000).max(100000) }).strict() }).strict(),
  z.object({ type: z.literal("SELECT"), elementId: z.string().max(128).nullable() }).strict(),
  z.object({ type: z.literal("PING") }).strict(),
]);
let observed = { connections: 0, rooms: 0 };
export function getPresenceRoomsSummary() { return { ...observed }; }
function sessionCookie(request: IncomingMessage): string | null {
  const matches = (request.headers.cookie ?? "").split(";").map(v => v.trim()).filter(v => v.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (matches.length !== 1) return null;
  try { return decodeURIComponent(matches[0].slice(AUTH_COOKIE_NAME.length + 1)); } catch { return null; }
}
export function initPresenceWebSocketServer(server: HttpServer, deps: Dependencies = {
  authenticate: authenticateSession, canRead: canReadWebsitePresence, origin: browserOrigin,
}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
  const peers = new Map<WebSocket, { principal: Principal; token: string; state: PeerState | null;
    verifiedAt: number; busy: boolean; lastSeen: number; windowAt: number; messages: number; joins: number }>();
  const rooms = new Map<string, Set<WebSocket>>();
  let pending = 0;
  const observe = () => { observed = { connections: peers.size, rooms: rooms.size }; };
  function send(ws: WebSocket, payload: object) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 65536) { ws.terminate(); return; }
    ws.send(JSON.stringify(payload));
  }
  function broadcast(site: string, payload: object, except?: WebSocket) {
    for (const ws of rooms.get(site) ?? []) {
      const p = peers.get(ws);
      if (ws !== except && p && Date.now() - p.verifiedAt <= 10_000) send(ws, payload);
    }
  }
  function leave(ws: WebSocket) {
    const p = peers.get(ws); if (!p?.state) return;
    const { websiteId, socketId } = p.state; p.state = null;
    const room = rooms.get(websiteId); room?.delete(ws);
    if (!room?.size) rooms.delete(websiteId);
    broadcast(websiteId, { type: "PEER_LEFT", socketId }); observe();
  }
  function attach(ws: WebSocket, principal: Principal, token: string) {
    const socketId = randomUUID();
    const p = { principal, token, state: null as PeerState | null, verifiedAt: 0, busy: false,
      lastSeen: Date.now(), windowAt: Date.now(), messages: 0, joins: 0 };
    peers.set(ws, p); observe();
    const cleanup = () => { leave(ws); peers.delete(ws); observe(); };
    ws.on("close", cleanup); ws.on("error", cleanup);
    ws.on("message", async raw => {
      const now = Date.now();
      if (now - p.windowAt >= 1000) { p.messages = 0; p.windowAt = now; }
      if (++p.messages > 30) { ws.close(1008, "Message limit exceeded"); return; }
      const parsed = (() => { try { return messageSchema.safeParse(JSON.parse(raw.toString())); } catch { return null; } })();
      if (!parsed?.success) { ws.close(1008, "Invalid presence message"); return; }
      if (p.busy) return; // Drop expendable presence frames rather than queue work during revalidation.
      p.lastSeen = now; const msg = parsed.data;
      try {
        if (msg.type === "JOIN") {
          if (++p.joins > 20) { ws.close(1008, "Join limit exceeded"); return; }
          leave(ws); p.busy = true;
          const current = await deps.authenticate(token);
          if (!current || current.id !== principal.id || !await deps.canRead(msg.websiteId, current.user.id)) {
            ws.close(1008, "Access denied"); return;
          }
          if (ws.readyState !== WebSocket.OPEN || !peers.has(ws)) return;
          if ((rooms.get(msg.websiteId)?.size ?? 0) >= 100) { ws.close(1013, "Room capacity reached"); return; }
          p.verifiedAt = Date.now();
          // Client-supplied name, identity and role are deliberately ignored.
          p.state = { socketId, websiteId: msg.websiteId,
            user: { userId: current.user.id, name: current.user.fullName?.slice(0,120) || "Collaborator", color: "#3b82f6" }, lastSeen: now };
          if (!rooms.has(msg.websiteId)) rooms.set(msg.websiteId, new Set());
          rooms.get(msg.websiteId)!.add(ws); observe();
          const active = [...rooms.get(msg.websiteId)!].flatMap(s => {
            const peer = peers.get(s); return peer?.state && Date.now() - peer.verifiedAt <= 10_000 ? [peer.state] : [];
          });
          send(ws, { type: "SYNC", selfSocketId: socketId, peers: active });
          broadcast(msg.websiteId, { type: "PEER_JOINED", peer: p.state }, ws);
        } else if (msg.type === "PING") {
          send(ws, { type: "PONG" });
        } else if (p.state && now - p.verifiedAt <= 10_000) {
          if (msg.type === "CURSOR") {
            p.state.cursor = msg.cursor; broadcast(p.state.websiteId, { type: "PEER_CURSOR", socketId, cursor: msg.cursor }, ws);
          } else {
            p.state.selectedElementId = msg.elementId;
            broadcast(p.state.websiteId, { type: "PEER_SELECT", socketId, elementId: msg.elementId }, ws);
          }
        }
      } catch { ws.close(1008, "Access unavailable"); }
      finally { p.busy = false; }
    });
  }
  const upgrade = async (request: IncomingMessage, socket: import("node:stream").Duplex, head: Buffer) => {
    const reject = (status = 401) => { if (!socket.destroyed) socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`); };
    try {
      if ((request.url?.length ?? 0) > 2048 || request.method !== "GET") return reject(400);
      const path = new URL(request.url ?? "", "http://presence.invalid").pathname;
      if (!["/ws/presence", "/ws/collaboration"].includes(path)) return reject(404);
      if (request.headers.origin !== deps.origin()) return reject(403);
      if (pending >= 16 || peers.size + pending >= 1000) return reject(503);
      const token = sessionCookie(request); if (!token) return reject();
      pending++; const timer = setTimeout(() => socket.destroy(), 2500);
      try {
        const principal = await deps.authenticate(token);
        if (!principal || socket.destroyed) return reject();
        if ([...peers.values()].filter(p => p.principal.user.id === principal.user.id).length >= 8) return reject(429);
        wss.handleUpgrade(request, socket, head, ws => attach(ws, principal, token));
      } finally { pending--; clearTimeout(timer); }
    } catch { reject(); }
  };
  server.on("upgrade", upgrade);
  const timer = setInterval(() => {
    for (const [ws, p] of peers) {
      if (Date.now() - p.lastSeen > 45000 || p.principal.expiresAt.getTime() <= Date.now()) { ws.terminate(); continue; }
      if (!p.state || p.busy || Date.now() - p.verifiedAt < 5000) continue;
      p.busy = true; const site = p.state.websiteId;
      void deps.authenticate(p.token).then(async current => {
        if (!current || current.id !== p.principal.id || !await deps.canRead(site, current.user.id)) { ws.close(1008, "Access revoked"); return; }
        if (p.state?.websiteId === site) p.verifiedAt = Date.now();
      }).catch(() => ws.close(1008, "Access unavailable")).finally(() => { p.busy = false; });
    }
  }, 1000);
  timer.unref();
  wss.on("close", () => { clearInterval(timer); server.off("upgrade", upgrade); peers.clear(); rooms.clear(); observe(); });
  return wss;
}
