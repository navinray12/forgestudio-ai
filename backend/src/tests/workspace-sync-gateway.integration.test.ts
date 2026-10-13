/**
 * Workspace sync gateway (blueprint §34, WP-18), live: a real HTTP server with the production
 * upgrade wiring (websocketGateways.ts), real WebSocket connections, real sessions and the
 * disposable PostgreSQL database. Covers authentication, project scoping, acknowledgements,
 * duplicates, stale and concurrent edits, fan-out from WebSocket and HTTP commits, reconnect
 * recovery, revoked sessions, a restart, a persistence failure and the frontend client module.
 * It does not drive a browser; cookie authentication is exercised with an explicit Cookie header.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/workspace-sync-gateway.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import http, { type Server } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

const FILE = "src/components/SyncCard.tsx";
const SOURCE = `import { useState } from "react";

// hand-written: must survive every synchronized edit
export function SyncCard() {
  const [open, setOpen] = useState(false);
  return (
    <section className="card" data-forge-id="card">
      <h2 data-forge-id="card_title">Title</h2>
      <p data-forge-id="card_body">Body</p>
      <button onClick={() => setOpen(!open)} data-forge-id="card_toggle">{open ? "Close" : "Open"}</button>
    </section>
  );
}
`;

type Who = "ownerA" | "ownerB" | "ownerC" | "outsider";

interface Client {
  ws: WebSocket;
  messages: any[];
  closed: Promise<{ code: number; reason: string }>;
  send: (payload: unknown) => void;
  next: (match: (m: any) => boolean, ms?: number) => Promise<any>;
  none: (match: (m: any) => boolean, ms?: number) => Promise<void>;
}

describe.skipIf(!optedIn)("Workspace sync gateway (live server, disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const { browserOrigin, AUTH_COOKIE_NAME } = await import("../config/auth.js");

  const marker = randomUUID().slice(0, 8);
  const tokens = {} as Record<Who, string>;
  const users = {} as Record<"owner" | "outsider", string>;
  const pools: Array<{ end: () => Promise<void> }> = [pgPool];
  const sockets: WebSocket[] = [];
  let projectId = "";
  let otherProjectId = "";
  let server: Server;
  let gateways: { workspaceSync: any; close: () => Promise<void> };
  let port = 0;
  let files: typeof import("../services/project/forgeFilesystem.service.js");

  const wsUrl = () => `ws://127.0.0.1:${port}/ws/workspace-sync`;
  const version = async (project = projectId) => (await files.readFile(project, FILE)).version as number;
  const content = async () => (await files.readFile(projectId, FILE)).content as string;
  const sequences = async (project = projectId) =>
    (await pgPool.query(`SELECT sequence FROM forge_workspace_checkpoints WHERE "projectId" = $1 ORDER BY sequence`, [project])).rows.map((r: any) => Number(r.sequence));

  /** Starts the application server with the production WebSocket wiring, on fresh module instances. */
  async function start() {
    vi.resetModules();
    const { default: app } = await import("../app.js");
    const { attachWebSocketGateways } = await import("../websocketGateways.js");
    files = await import("../services/project/forgeFilesystem.service.js");
    pools.push((await import("../config/prisma.js")).pgPool);
    server = http.createServer(app);
    gateways = attachWebSocketGateways(server);
    await gateways.workspaceSync.ready;
    await new Promise<void>((r) => server.listen(0, r));
    port = (server.address() as AddressInfo).port;
  }

  async function stop() {
    await gateways.close();
    await new Promise((r) => server.close(r));
  }

  /** Opens a socket; `early` holds whatever the server sent before the caller could listen. */
  function attempt(headers: Record<string, string>): Promise<{ status: number } | { ws: WebSocket; early: any[] }> {
    return new Promise((resolve) => {
      const ws = new WebSocket(wsUrl(), { headers });
      const early: any[] = [];
      ws.on("message", (data) => early.push(JSON.parse(data.toString())));
      ws.once("unexpected-response", (_req, res) => resolve({ status: res.statusCode ?? 0 }));
      ws.once("open", () => { sockets.push(ws); resolve({ ws, early }); });
      ws.once("error", () => undefined);
    });
  }

  async function connect(who: Who): Promise<Client> {
    const opened = await attempt({ Authorization: `Bearer ${tokens[who]}` });
    if (!("ws" in opened)) throw new Error(`upgrade rejected with ${opened.status}`);
    const { ws, early } = opened;
    ws.removeAllListeners("message");
    const messages: any[] = [...early];
    const waiters: Array<{ match: (m: any) => boolean; resolve: (m: any) => void }> = [];
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      messages.push(msg);
      for (const waiter of [...waiters]) {
        if (waiter.match(msg)) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(msg); }
      }
    });
    const client: Client = {
      ws,
      messages,
      closed: new Promise((resolve) => ws.once("close", (code, reason) => resolve({ code, reason: reason.toString() }))),
      send: (payload) => ws.send(JSON.stringify(payload)),
      next: (match, ms = 5000) => {
        const seen = messages.find(match);
        if (seen) { messages.splice(messages.indexOf(seen), 1); return Promise.resolve(seen); }
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`no matching message within ${ms}ms; got ${JSON.stringify(messages).slice(0, 400)}`)), ms);
          waiters.push({ match, resolve: (m) => { clearTimeout(timer); messages.splice(messages.indexOf(m), 1); resolve(m); } });
        });
      },
      none: async (match, ms = 400) => {
        await new Promise((r) => setTimeout(r, ms));
        expect(messages.filter(match)).toEqual([]);
      },
    };
    await client.next((m) => m.type === "ready");
    return client;
  }

  async function subscribe(client: Client, project = projectId, afterSequence?: number) {
    client.send({ type: "subscribe", projectId: project, ...(afterSequence !== undefined ? { afterSequence } : {}) });
    return client.next((m) => m.type === "subscribed" && m.projectId === project);
  }

  const operation = (elementId: string, text: string, expectedRevision: number, extra: Record<string, unknown> = {}) => ({
    type: "operation",
    projectId,
    operationId: `op-${randomUUID()}`,
    filePath: FILE,
    elementId,
    expectedRevision,
    mutation: { type: "SET_TEXT", text },
    ...extra,
  });

  async function act(client: Client, op: any) {
    client.send(op);
    return client.next((m) => m.type === "ack" && m.operationId === op.operationId);
  }

  const isCheckpoint = (project = projectId) => (m: any) => m.type === "checkpoint" && m.projectId === project;

  beforeAll(async () => {
    await ensureDatabaseTables();
    for (const name of ["owner", "outsider"] as const) {
      const user = await prisma.user.create({
        data: { fullName: `Sync ${name}`, email: `wsync-${name}-${marker}@example.test`, status: "ACTIVE", authEpoch: 1 } as any,
      });
      users[name] = user.id;
    }
    for (const [who, user] of [["ownerA", users.owner], ["ownerB", users.owner], ["ownerC", users.owner], ["outsider", users.outsider]] as const) {
      const token = `wsync-${who}-${randomUUID()}`;
      await prisma.session.create({
        data: {
          userId: user,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 3_600_000),
          authEpoch: 1,
          audience: "TENANT",
          authTime: new Date(Date.now() - 1000),
          authMethod: "local",
          lastUsedAt: new Date(),
        },
      });
      tokens[who] = token;
    }
    const project = (owner: string, label: string) =>
      (prisma as any).forgeProject.create({ data: { name: `${label} ${marker}`, slug: `${label}-${marker}`, ownerId: owner, framework: "react" } });
    projectId = (await project(users.owner, "wsync")).id;
    otherProjectId = (await project(users.outsider, "wsync-other")).id;
    await start();
    await files.writeFile(projectId, FILE, { content: SOURCE, authorId: users.owner });
    await files.writeFile(otherProjectId, FILE, { content: SOURCE, authorId: users.outsider });
  }, 120_000);

  afterAll(async () => {
    for (const ws of sockets) ws.terminate();
    await stop().catch(() => undefined);
    await pgPool.query(`DELETE FROM forge_projects WHERE id = ANY($1::uuid[])`, [[projectId, otherProjectId].filter(Boolean)]).catch(() => undefined);
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(users) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } }).catch(() => undefined);
    await prisma.$disconnect();
    for (const pool of pools) await pool.end().catch(() => undefined);
  });

  it("refuses the upgrade without a valid session, and a session cookie from another origin", async () => {
    expect(await attempt({})).toEqual({ status: 401 });
    expect(await attempt({ Authorization: "Bearer not-a-session" })).toEqual({ status: 401 });
    const cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(tokens.ownerA)}`;
    expect(await attempt({ Cookie: cookie, Origin: "https://evil.example" })).toEqual({ status: 403 });
    expect(await attempt({ Cookie: cookie })).toEqual({ status: 403 });
    const sameOrigin = await attempt({ Cookie: cookie, Origin: browserOrigin() });
    expect("ws" in sameOrigin).toBe(true);
    if ("ws" in sameOrigin) sameOrigin.ws.close();
  });

  it("denies a user who does not belong to the project, for reading and for mutating", async () => {
    const outsider = await connect("outsider");
    outsider.send({ type: "subscribe", projectId });
    expect(await outsider.next((m) => m.type === "error")).toMatchObject({ code: "ACCESS_DENIED", projectId });
    const before = await version();
    const ack = await act(outsider, operation("card_title", "Hijacked", before));
    expect(ack).toMatchObject({ status: "rejected", code: "ACCESS_DENIED" });
    expect(await version()).toBe(before);
    expect(await content()).not.toContain("Hijacked");
    outsider.send({ nonsense: true });
    expect(await outsider.next((m) => m.type === "error")).toMatchObject({ code: "INVALID_MESSAGE" });
    outsider.ws.close();
  });

  it("acknowledges an applied operation to its sender and delivers the checkpoint to the other subscribers only", async () => {
    const [a, b, outsider] = await Promise.all([connect("ownerA"), connect("ownerB"), connect("outsider")]);
    const [subA] = await Promise.all([subscribe(a), subscribe(b), subscribe(outsider, otherProjectId)]);
    const before = await version();

    const op = operation("card_title", "Edited by A", before);
    const ack = await act(a, op);
    expect(ack).toMatchObject({ status: "applied", filePath: FILE, elementId: "card_title", version: before + 1 });
    expect(ack.sequence).toBe(subA.sequence + 1);
    expect(ack.replayed).toBeUndefined();

    const seen = await b.next(isCheckpoint());
    expect(seen.checkpoint).toMatchObject({ sequence: ack.sequence, origin: "VISUAL", filePath: FILE, fileVersion: before + 1, changeSetId: `op:${op.operationId}`, createdById: users.owner });
    await a.none(isCheckpoint()); // no echo to the sender
    await outsider.none((m) => m.type === "checkpoint"); // nothing crosses projects
    expect(await content()).toContain('<h2 data-forge-id="card_title">Edited by A</h2>');
    expect(await content()).toContain("// hand-written: must survive every synchronized edit");

    // A duplicate of the same operation returns the stored acknowledgement and changes nothing.
    const again = await act(a, { ...op, expectedRevision: 1 });
    expect(again).toMatchObject({ status: "applied", sequence: ack.sequence, version: before + 1, replayed: true });
    expect(await version()).toBe(before + 1);
    await b.none(isCheckpoint());
    expect(await sequences()).toEqual(Array.from({ length: ack.sequence }, (_, i) => i + 1));
    for (const c of [a, b, outsider]) c.ws.close();
  });

  it("answers stale, unchanged, rejected and unsupported operations truthfully without broadcasting", async () => {
    const [a, b] = await Promise.all([connect("ownerA"), connect("ownerB")]);
    await Promise.all([subscribe(a), subscribe(b)]);
    const current = await version();
    const before = await sequences();

    expect(await act(a, operation("card_title", "Too late", current - 1))).toMatchObject({ status: "conflict", code: "REVISION_CONFLICT", version: current });
    expect(await act(a, operation("card_title", "Edited by A", current))).toMatchObject({ status: "unchanged", code: "NO_CHANGE", version: current });
    expect(await act(a, operation("card_toggle", "Static", current))).toMatchObject({ status: "rejected", code: "SOURCE_OWNED" });
    expect(await act(a, operation("card_missing", "x", current))).toMatchObject({ status: "rejected", code: "TARGET_NOT_FOUND" });
    expect(await act(a, { ...operation("card_title", "x", current), mutation: undefined, operation: { operationType: "DRAG", newValue: { x: 1 } } })).toMatchObject({ status: "rejected", code: "UNSUPPORTED" });
    expect(await act(a, { ...operation("card_title", "x", current), filePath: "src/Nope.tsx" })).toMatchObject({ status: "rejected" });

    await b.none(isCheckpoint());
    expect(await version()).toBe(current);
    expect(await sequences()).toEqual(before);

    // The semantic operation form used by the editor maps onto the same mutations.
    const semantic = await act(a, { ...operation("card_body", "", current), mutation: undefined, operation: { operationType: "PROPERTY_UPDATE", propertyKey: "className", newValue: "lead muted" } });
    expect(semantic).toMatchObject({ status: "applied", version: current + 1 });
    expect(await content()).toContain('<p className="lead muted" data-forge-id="card_body">Body</p>');
    await b.next(isCheckpoint());
    for (const c of [a, b]) c.ws.close();
  });

  it("lets exactly one of two concurrent edits to the same revision win, and the other retry", async () => {
    const [a, b] = await Promise.all([connect("ownerA"), connect("ownerB")]);
    await Promise.all([subscribe(a), subscribe(b)]);
    const base = await version();
    const opA = operation("card_title", "Concurrent A", base);
    const opB = operation("card_body", "Concurrent B", base);
    const [ackA, ackB] = await Promise.all([act(a, opA), act(b, opB)]);
    expect([ackA.status, ackB.status].sort()).toEqual(["applied", "conflict"]);
    expect(await version()).toBe(base + 1);

    const [winner, loser, loserClient, loserOp] = ackA.status === "applied" ? [ackA, ackB, b, opB] : [ackB, ackA, a, opA];
    expect(loser.version).toBe(base + 1);
    // The loser learns of the winning edit, then retries against the new revision under a new ID.
    expect((await loserClient.next(isCheckpoint())).checkpoint.sequence).toBe(winner.sequence);
    const retry = await act(loserClient, { ...loserOp, operationId: `op-${randomUUID()}`, expectedRevision: loser.version });
    expect(retry).toMatchObject({ status: "applied", version: base + 2, sequence: winner.sequence + 1 });

    const final = await content();
    expect(final).toContain(">Concurrent A</h2>");
    expect(final).toContain(">Concurrent B</p>");
    const all = await sequences();
    expect(all).toEqual(Array.from({ length: all.length }, (_, i) => i + 1)); // gap-free
    for (const c of [a, b]) c.ws.close();
  });

  it("delivers changes committed over HTTP, and replays what a client missed while disconnected", async () => {
    const [a, b] = await Promise.all([connect("ownerA"), connect("ownerB")]);
    const [, subB] = await Promise.all([subscribe(a), subscribe(b)]);

    const save = async (text: string) => {
      const current = await files.readFile(projectId, FILE);
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.ownerC}` },
        body: JSON.stringify({ path: FILE, content: `${current.content}// ${text}\n`, expectedVersion: current.version }),
      });
      expect(res.status).toBe(200);
      return (await res.json()).checkpoint.sequence as number;
    };

    const httpSequence = await save("saved over HTTP");
    expect(httpSequence).toBe(subB.sequence + 1);
    for (const client of [a, b]) {
      expect((await client.next(isCheckpoint())).checkpoint).toMatchObject({ sequence: httpSequence, origin: "CODE", filePath: FILE });
    }

    // B drops off; three more changes are committed; B resumes from the last sequence it saw.
    b.ws.close();
    await b.closed;
    const first = await act(a, operation("card_title", "While B was away", await version()));
    const second = await save("second HTTP save");
    const third = await act(a, operation("card_body", "Also while away", await version()));
    expect([first.sequence, second, third.sequence]).toEqual([httpSequence + 1, httpSequence + 2, httpSequence + 3]);

    const b2 = await connect("ownerB");
    const resumed = await subscribe(b2, projectId, httpSequence);
    expect(resumed).toMatchObject({ sequence: httpSequence + 3, resumedFrom: httpSequence });
    const missed = [await b2.next(isCheckpoint()), await b2.next(isCheckpoint()), await b2.next(isCheckpoint())];
    expect(missed.map((m) => m.checkpoint.sequence)).toEqual([httpSequence + 1, httpSequence + 2, httpSequence + 3]);
    expect(missed.map((m) => m.checkpoint.origin)).toEqual(["VISUAL", "CODE", "VISUAL"]);
    await b2.none(isCheckpoint());
    for (const c of [a, b2]) c.ws.close();
  });

  it("disconnects a revoked session on its next operation and on the periodic check", async () => {
    const [a, b, c] = await Promise.all([connect("ownerA"), connect("ownerB"), connect("ownerC")]);
    await Promise.all([subscribe(a), subscribe(b), subscribe(c)]);
    const revoke = (who: Who) =>
      prisma.session.updateMany({ where: { tokenHash: createHash("sha256").update(tokens[who]).digest("hex") }, data: { revokedAt: new Date() } });

    await revoke("ownerB");
    const before = await version();
    b.send(operation("card_title", "After revocation", before));
    expect(await b.closed).toMatchObject({ code: 1008 });
    expect(await version()).toBe(before);

    await revoke("ownerC");
    await gateways.workspaceSync.sweep();
    expect(await c.closed).toMatchObject({ code: 1008 });
    expect(await attempt({ Authorization: `Bearer ${tokens.ownerC}` })).toEqual({ status: 401 });

    // The unrevoked connection keeps working and the revoked ones receive nothing further.
    expect(await act(a, operation("card_title", "Still connected", before))).toMatchObject({ status: "applied" });
    a.ws.close();
  });

  it("keeps history and idempotency across a server restart", async () => {
    const a = await connect("ownerA");
    await subscribe(a);
    const op = operation("card_title", "Before restart", await version());
    const ack = await act(a, op);
    expect(ack.status).toBe("applied");
    const history = await sequences();

    await stop();
    expect((await a.closed).code).toBe(1001);
    await start();

    const again = await connect("ownerA");
    const resumed = await subscribe(again, projectId, 0);
    expect(resumed.sequence).toBe(history[history.length - 1]);
    const replayed: number[] = [];
    for (let i = 0; i < history.length; i++) replayed.push((await again.next(isCheckpoint())).checkpoint.sequence);
    expect(replayed).toEqual(history);

    // The acknowledgement that may have been lost in the restart is still on record.
    expect(await act(again, op)).toMatchObject({ status: "applied", sequence: ack.sequence, replayed: true });
    expect(await sequences()).toEqual(history);
    expect(gateways.workspaceSync.stats()).toMatchObject({ listening: true });
    again.ws.close();
  }, 60_000);

  it("reports a persistence failure as an error and broadcasts nothing", async () => {
    const { createWorkspaceSyncGateway } = await import("../services/workspace/workspaceSyncGateway.js");
    const failing = createWorkspaceSyncGateway({ commit: async () => { throw new Error("connection terminated unexpectedly"); } });
    const extra = http.createServer();
    extra.on("upgrade", (req, socket, head) => void failing.upgrade(req, socket, head));
    await new Promise<void>((r) => extra.listen(0, r));
    const url = `ws://127.0.0.1:${(extra.address() as AddressInfo).port}/ws/workspace-sync`;
    const open = (who: Who) =>
      new Promise<WebSocket>((resolve) => {
        const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${tokens[who]}` } });
        sockets.push(ws);
        ws.once("open", () => resolve(ws));
      });
    const collect = (ws: WebSocket) => { const list: any[] = []; ws.on("message", (d) => list.push(JSON.parse(d.toString()))); return list; };
    const until = async (list: any[], match: (m: any) => boolean) => {
      for (let i = 0; i < 100 && !list.some(match); i++) await new Promise((r) => setTimeout(r, 50));
      return list.find(match);
    };
    const [wsA, wsB] = await Promise.all([open("ownerA"), open("ownerA")]);
    const [inA, inB] = [collect(wsA), collect(wsB)];
    for (const ws of [wsA, wsB]) ws.send(JSON.stringify({ type: "subscribe", projectId }));
    await until(inA, (m) => m.type === "subscribed");
    await until(inB, (m) => m.type === "subscribed");

    const before = await version();
    const op = operation("card_title", "Never stored", before);
    wsA.send(JSON.stringify(op));
    expect(await until(inA, (m) => m.type === "ack")).toMatchObject({ operationId: op.operationId, status: "error", code: "PERSISTENCE_ERROR" });
    await new Promise((r) => setTimeout(r, 300));
    expect(inB.filter((m) => m.type === "checkpoint")).toEqual([]);
    expect(await version()).toBe(before);
    await failing.close();
    await new Promise((r) => extra.close(r));
  });

  it("works through the frontend client: checkpoints, operations, and recovery after the connection drops", async () => {
    const services = path.resolve(process.cwd(), "../frontend/src/features/developer-workspace/services");
    const { connectWorkspaceSync, workspaceSyncUrl } = await import(/* @vite-ignore */ pathToFileURL(path.join(services, "workspaceSyncClient.ts")).href);
    expect(workspaceSyncUrl(`http://127.0.0.1:${port}`)).toBe(wsUrl());

    const received: any[] = [];
    const statuses: string[] = [];
    const browserSockets: WebSocket[] = [];
    const client = connectWorkspaceSync({
      url: workspaceSyncUrl(`http://127.0.0.1:${port}`),
      projectId,
      reconnectMs: 100,
      // A browser authenticates the socket with its session cookie; here the header is explicit.
      createSocket: (url: string) => {
        const ws = new WebSocket(url, { headers: { Cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(tokens.ownerA)}`, Origin: browserOrigin() } });
        browserSockets.push(ws);
        sockets.push(ws);
        return ws as any;
      },
      onCheckpoint: (cp: any) => received.push(cp),
      onStatus: (status: string) => statuses.push(status),
    });
    const until = async (check: () => boolean) => {
      for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 25));
      expect(check()).toBe(true);
    };
    await until(() => client.status() === "online");

    // Someone else's edit arrives as a checkpoint.
    const other = await connect("ownerA");
    await subscribe(other);
    const theirs = await act(other, operation("card_body", "From another client", await version()));
    await until(() => received.some((cp) => cp.sequence === theirs.sequence));

    // The client's own operation is acknowledged, and not reported back to it as a checkpoint.
    const own = await client.sendOperation({ filePath: FILE, elementId: "card_title", expectedRevision: theirs.version, mutation: { type: "SET_TEXT", text: "From the client module" } });
    expect(own).toMatchObject({ status: "applied", version: theirs.version + 1, sequence: theirs.sequence + 1 });
    expect((await other.next(isCheckpoint())).checkpoint.sequence).toBe(own.sequence);
    expect(await content()).toContain(">From the client module</h2>");

    // The connection drops; an edit is committed meanwhile; the client reconnects and catches up.
    browserSockets[0].terminate();
    await until(() => statuses.includes("offline"));
    const during = await act(other, operation("card_body", "Committed during the outage", own.version));
    expect(during.status).toBe("applied");
    await until(() => client.status() === "online" && received.some((cp) => cp.sequence === during.sequence));
    expect(received.map((cp) => cp.sequence)).toEqual([theirs.sequence, during.sequence]); // own edit never echoed, nothing missed
    expect(browserSockets.length).toBeGreaterThanOrEqual(2);
    expect(client.lastSequence()).toBe(during.sequence);

    client.close();
    expect(client.status()).toBe("closed");
    other.ws.close();
  }, 30_000);
});
