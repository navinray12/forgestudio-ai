import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";

const h = vi.hoisted(() => ({
  authorize: vi.fn(),
  getPool: vi.fn(),
  connect: vi.fn(),
  query: vi.fn(),
  release: vi.fn(),
}));

vi.mock("../services/project/forgeProject.service.js", () => ({
  getForgeProjectById: h.authorize,
}));
vi.mock("../modules/data-platform/common/pool-manager.js", () => ({
  TenantPoolManager: { getTenantPool: h.getPool },
}));

import { handleRealtimeWebSocketConnection } from "../modules/data-platform/data-layer/realtime.service.js";

class SocketDouble extends EventEmitter {
  readyState = 1;
  sent: Array<Record<string, unknown>> = [];
  send(frame: string) { this.sent.push(JSON.parse(frame)); }
  ping() {}
  terminate() { this.close(); }
  close() { this.readyState = 3; this.emit("close"); }
  receive(frame: Record<string, unknown>) { this.emit("message", Buffer.from(JSON.stringify(frame))); }
}

const sockets: SocketDouble[] = [];
async function untilFrame(ws: SocketDouble, event: string) {
  for (let i = 0; i < 30; i++) {
    const frame = ws.sent.find((message) => message.event === event);
    if (frame) return frame;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Missing ${event} response: ${JSON.stringify(ws.sent)}`);
}
function socket(userId = "owner") {
  const ws = new SocketDouble();
  sockets.push(ws);
  handleRealtimeWebSocketConnection(ws as unknown as WebSocket, { url: "/ws/realtime" } as never, { id: userId });
  return ws;
}
beforeEach(() => {
  vi.clearAllMocks();
  h.authorize.mockResolvedValue({ id: "proj-a" });
  h.query.mockResolvedValue({});
  h.release.mockReturnValue(undefined);
  h.connect.mockResolvedValue({ on: vi.fn(), query: h.query, release: h.release });
  h.getPool.mockResolvedValue({ connect: h.connect });
});
afterEach(() => {
  for (const ws of sockets.splice(0)) ws.close();
});

describe("WP-01 realtime subscription isolation", () => {
  it("rejects cross-project subscriptions without opening a DB listener", async () => {
    h.authorize.mockRejectedValue(new Error("foreign project"));
    const ws = socket("intruder");
    ws.receive({ event: "subscribe", projectId: "proj-a", table: "orders" });
    const frame = await untilFrame(ws, "error");
    expect(frame.code).toBe("FORBIDDEN");
    expect(h.getPool).not.toHaveBeenCalled();
  });

  it("prevents foreign unsubscribe frames from releasing another socket's listener", async () => {
    const owner = socket("owner");
    owner.receive({ event: "subscribe", projectId: "proj-a", table: "orders" });
    await untilFrame(owner, "subscribed");
    expect(h.connect).toHaveBeenCalledOnce();

    const intruder = socket("other");
    intruder.receive({ event: "unsubscribe", projectId: "proj-a", table: "orders" });
    const rejected = await untilFrame(intruder, "error");
    expect(rejected.code).toBe("NOT_SUBSCRIBED");
    expect(h.release).not.toHaveBeenCalled();

    owner.receive({ event: "unsubscribe", projectId: "proj-a", table: "orders" });
    await untilFrame(owner, "unsubscribed");
    await vi.waitFor(() => expect(h.release).toHaveBeenCalledOnce());
  });

  it("repeated subscribe is idempotent and releases only one listener reference", async () => {
    const ws = socket();
    ws.receive({ event: "subscribe", projectId: "proj-a", table: "items" });
    await untilFrame(ws, "subscribed");
    ws.receive({ event: "subscribe", projectId: "proj-a", table: "items" });
    await vi.waitFor(() => expect(ws.sent.filter((x) => x.event === "subscribed")).toHaveLength(2));
    expect(h.connect).toHaveBeenCalledOnce();
    ws.close();
    await vi.waitFor(() => expect(h.release).toHaveBeenCalledOnce());
  });

  it("does not acknowledge a subscription when the database LISTEN setup fails", async () => {
    h.query.mockRejectedValueOnce(new Error("LISTEN failed"));
    const ws = socket();
    ws.receive({ event: "subscribe", projectId: "proj-a", table: "items" });
    await untilFrame(ws, "error");
    expect(ws.sent.some((x) => x.event === "subscribed")).toBe(false);
    expect(h.release).toHaveBeenCalledExactlyOnceWith(true);
  });
});
