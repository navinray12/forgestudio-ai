/**
 * Workspace sync gateway, closure checks (blueprint §34, WP-18), all live against the disposable
 * PostgreSQL database:
 *  1. a change whose checkpoint could not be recorded is announced by the recovery path;
 *  2. a non-owner workspace member: access, and loss of access;
 *  3. loss of the PostgreSQL LISTEN connection and automatic recovery;
 *  4. two separate backend processes on the same database: cross-instance delivery, concurrent
 *     edits and duplicate operation IDs.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/workspace-sync-closure.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import http, { type Server } from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

const FILE = "src/components/SyncCard.tsx";
const SOURCE = `export function SyncCard() {
  return (
    <section className="card" data-forge-id="card">
      <h2 data-forge-id="card_title">Title</h2>
      <p data-forge-id="card_body">Body</p>
    </section>
  );
}
`;

type Who = "owner" | "member" | "outsider";

describe.skipIf(!optedIn)("Workspace sync gateway closure (live, disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const files = await import("../services/project/forgeFilesystem.service.js");
  const checkpoints = await import("../services/workspace/workspaceCheckpoints.service.js");
  const { RealtimeSyncService } = await import("../services/compiler/realtimeSync.service.js");
  const { createWorkspaceSyncGateway } = await import("../services/workspace/workspaceSyncGateway.js");
  const { default: app } = await import("../app.js");

  const marker = randomUUID().slice(0, 8);
  const tokens = {} as Record<Who, string>;
  const users = {} as Record<Who, string>;
  const sockets: WebSocket[] = [];
  const children: ChildProcess[] = [];
  let projectId = "";
  let workspaceId = "";
  let server: Server;
  let gateway: ReturnType<typeof createWorkspaceSyncGateway>;
  let port = 0;

  const version = async () => (await files.readFile(projectId, FILE)).version as number;
  const latest = async () => (await checkpoints.getCheckpointState(projectId)).latest;
  const announcedVersion = async () => (await latest())?.sourceManifest.find((f) => f.path === FILE)?.version ?? null;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  interface Client {
    ws: WebSocket;
    messages: any[];
    closed: Promise<number>;
    send: (payload: unknown) => void;
    next: (match: (m: any) => boolean, ms?: number) => Promise<any>;
    none: (match: (m: any) => boolean, ms?: number) => Promise<void>;
  }

  function connect(who: Who, onPort = port): Promise<Client> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${onPort}/ws/workspace-sync`, { headers: { Authorization: `Bearer ${tokens[who]}` } });
      sockets.push(ws);
      const messages: any[] = [];
      const waiters: Array<{ match: (m: any) => boolean; resolve: (m: any) => void }> = [];
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        const waiter = waiters.find((w) => w.match(msg));
        if (waiter) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(msg); } else messages.push(msg);
      });
      const client: Client = {
        ws,
        messages,
        closed: new Promise((r) => ws.once("close", (code) => r(code))),
        send: (payload) => ws.send(JSON.stringify(payload)),
        next: (match, ms = 8000) => {
          const seen = messages.find(match);
          if (seen) { messages.splice(messages.indexOf(seen), 1); return Promise.resolve(seen); }
          return new Promise((res, rej) => {
            const timer = setTimeout(() => rej(new Error(`no matching message within ${ms}ms; got ${JSON.stringify(messages).slice(0, 300)}`)), ms);
            waiters.push({ match, resolve: (m) => { clearTimeout(timer); res(m); } });
          });
        },
        none: async (match, ms = 400) => {
          await wait(ms);
          expect(messages.filter(match)).toEqual([]);
        },
      };
      ws.once("unexpected-response", (_req, res) => reject(new Error(`upgrade rejected with ${res.statusCode}`)));
      ws.once("error", () => undefined);
      ws.once("open", () => client.next((m) => m.type === "ready").then(() => resolve(client), reject));
    });
  }

  async function subscribe(client: Client, afterSequence?: number) {
    client.send({ type: "subscribe", projectId, ...(afterSequence !== undefined ? { afterSequence } : {}) });
    return client.next((m) => m.type === "subscribed" || m.type === "error");
  }

  const operation = (elementId: string, text: string, expectedRevision: number, operationId = `op-${randomUUID()}`) => ({
    type: "operation", projectId, operationId, filePath: FILE, elementId, expectedRevision, mutation: { type: "SET_TEXT", text },
  });
  const act = async (client: Client, op: any) => {
    client.send(op);
    return client.next((m) => m.type === "ack" && m.operationId === op.operationId);
  };
  const isCheckpoint = (m: any) => m.type === "checkpoint" && m.projectId === projectId;
  const commitInput = (text: string, expectedRevision: number) => ({
    projectId, actorId: users.owner, operationId: `op-${randomUUID()}`, filePath: FILE, elementId: "card_title",
    expectedRevision, mutation: { type: "SET_TEXT" as const, text },
  });
  const failing = async () => { throw new Error("connection terminated unexpectedly"); };

  beforeAll(async () => {
    await ensureDatabaseTables();
    for (const who of ["owner", "member", "outsider"] as const) {
      const user = await prisma.user.create({
        data: { fullName: `Closure ${who}`, email: `closure-${who}-${marker}@example.test`, status: "ACTIVE", authEpoch: 1 } as any,
      });
      users[who] = user.id;
      const token = `closure-${who}-${randomUUID()}`;
      await prisma.session.create({
        data: {
          userId: user.id,
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
    // The database requires a workspace to be created together with its OWNER member.
    workspaceId = (await prisma.workspace.create({
      data: {
        name: `Closure ${marker}`, slug: `closure-${marker}`, ownerId: users.owner,
        members: { create: [{ userId: users.owner, role: "OWNER" }, { userId: users.member, role: "MEMBER" }] },
      } as any,
    })).id;
    projectId = (await (prisma as any).forgeProject.create({
      data: { name: `closure ${marker}`, slug: `closure-${marker}`, ownerId: users.owner, workspaceId, framework: "react" },
    })).id;
    await files.writeFile(projectId, FILE, { content: SOURCE, authorId: users.owner });
    await checkpoints.recordCheckpoint({ projectId, origin: "CODE", kind: "SOURCE_ONLY", filePath: FILE, message: "baseline", actorId: users.owner });

    // An in-process instance with no grace period, so recovery can be observed immediately.
    gateway = createWorkspaceSyncGateway({}, { reconcileGraceMs: 0 });
    server = http.createServer(app);
    server.on("upgrade", (req, socket, head) => void gateway.upgrade(req, socket, head));
    await gateway.ready;
    await new Promise<void>((r) => server.listen(0, r));
    port = (server.address() as AddressInfo).port;
  }, 120_000);

  afterAll(async () => {
    for (const child of children) child.kill();
    for (const ws of sockets) ws.terminate();
    await gateway?.close().catch(() => undefined);
    await new Promise((r) => server?.close(r));
    if (projectId) await pgPool.query(`DELETE FROM forge_projects WHERE id = $1`, [projectId]).catch(() => undefined);
    if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(users) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  }, 60_000);

  describe("1. a committed write whose checkpoint failed", () => {
    it("is announced at once through the recovery checkpoint when the database is reachable", async () => {
      const watcher = await connect("owner");
      await subscribe(watcher);
      const before = await version();
      const ack = await RealtimeSyncService.commitDurableOperation(commitInput("Recovered at once", before), {
        recordCheckpoint: failing,
        reconcile: checkpoints.reconcileUnannouncedChanges,
      });
      expect(ack).toMatchObject({ status: "applied", code: "CHECKPOINT_RECOVERED", version: before + 1 });
      expect((await watcher.next(isCheckpoint)).checkpoint).toMatchObject({ sequence: ack.sequence, filePath: FILE, fileVersion: before + 1 });
      expect(await announcedVersion()).toBe(before + 1);
      watcher.ws.close();
    });

    it("is reported as pending, never as applied, and announced by the next periodic check", async () => {
      const watcher = await connect("owner");
      await subscribe(watcher);
      const before = await version();
      const input = commitInput("Stored but unannounced", before);
      const ack = await RealtimeSyncService.commitDurableOperation(input, { recordCheckpoint: failing, reconcile: failing });
      expect(ack).toMatchObject({ status: "error", code: "CHECKPOINT_PENDING", version: before + 1, sequence: null });

      // The defect being guarded against: the file moved on and no checkpoint says so.
      expect(await version()).toBe(before + 1);
      expect(await announcedVersion()).toBe(before);
      await watcher.none(isCheckpoint);

      await gateway.sweep();
      const recovered = (await watcher.next(isCheckpoint)).checkpoint;
      expect(recovered).toMatchObject({ filePath: FILE, fileVersion: before + 1, kind: "SOURCE_ONLY" });
      expect(recovered.message).toContain("saved without a checkpoint");
      expect(await announcedVersion()).toBe(before + 1);

      // Nothing left to recover; a repeat of the operation finds the source already as requested.
      const sequence = (await latest())!.sequence;
      await gateway.sweep();
      expect((await latest())!.sequence).toBe(sequence);
      expect(await RealtimeSyncService.commitDurableOperation({ ...input, expectedRevision: before + 1 })).toMatchObject({ status: "unchanged" });
      watcher.ws.close();
    });

    it("is announced to a client that connects later, when nobody was subscribed at the time", async () => {
      const seen = (await latest())!.sequence;
      const before = await version();
      const ack = await RealtimeSyncService.commitDurableOperation(commitInput("Nobody was watching", before), { recordCheckpoint: failing, reconcile: failing });
      expect(ack.code).toBe("CHECKPOINT_PENDING");
      expect(await announcedVersion()).toBe(before);

      const late = await connect("owner");
      const subscribed = await subscribe(late, seen);
      expect(subscribed.sequence).toBe(seen + 1);
      expect((await late.next(isCheckpoint)).checkpoint).toMatchObject({ sequence: seen + 1, filePath: FILE, fileVersion: before + 1 });
      late.ws.close();
    });

    it("leaves a write that is still inside its own request alone", async () => {
      const current = await files.readFile(projectId, FILE);
      await files.writeFile(projectId, FILE, { content: `${current.content}// in flight\n`, expectedVersion: current.version });
      expect(await checkpoints.reconcileUnannouncedChanges(projectId)).toBeNull(); // default grace period
      const own = await checkpoints.recordCheckpoint({ projectId, origin: "CODE", kind: "SOURCE_ONLY", filePath: FILE, actorId: users.owner });
      expect(await checkpoints.reconcileUnannouncedChanges(projectId, { graceMs: 0 })).toBeNull(); // already announced
      expect((await latest())!.sequence).toBe(own.sequence);
    });
  });

  describe("2. a non-owner workspace member", () => {
    it("can subscribe and edit, and loses both when the membership is removed", async () => {
      const [owner, member, outsider] = await Promise.all([connect("owner"), connect("member"), connect("outsider")]);
      expect((await subscribe(owner)).type).toBe("subscribed");
      expect((await subscribe(member)).type).toBe("subscribed");
      expect(await subscribe(outsider)).toMatchObject({ type: "error", code: "ACCESS_DENIED" });

      const applied = await act(member, operation("card_body", "Edited by a member", await version()));
      expect(applied).toMatchObject({ status: "applied" });
      const seen = (await owner.next(isCheckpoint)).checkpoint;
      expect(seen).toMatchObject({ sequence: applied.sequence, createdById: users.member });
      const fromOwner = await act(owner, operation("card_title", "Owner replies", applied.version));
      expect((await member.next(isCheckpoint)).checkpoint.sequence).toBe(fromOwner.sequence);

      await (prisma as any).workspaceMember.deleteMany({ where: { workspaceId, userId: users.member } });
      const before = await version();
      expect(await act(member, operation("card_body", "After removal", before))).toMatchObject({ status: "rejected", code: "ACCESS_DENIED" });
      expect(await version()).toBe(before);
      // The denied operation ended the subscription: later changes are not delivered.
      await act(owner, operation("card_title", "Private again", before));
      await member.none(isCheckpoint);
      expect(await subscribe(member)).toMatchObject({ type: "error", code: "ACCESS_DENIED" });

      // Removal is also noticed without the member sending anything.
      await (prisma as any).workspaceMember.create({ data: { workspaceId, userId: users.member, role: "MEMBER" } });
      const idle = await connect("member");
      expect((await subscribe(idle)).type).toBe("subscribed");
      await (prisma as any).workspaceMember.deleteMany({ where: { workspaceId, userId: users.member } });
      await gateway.sweep();
      expect(await idle.next((m) => m.type === "unsubscribed")).toMatchObject({ projectId, reason: "ACCESS_REVOKED" });
      await act(owner, operation("card_title", "Still private", await version()));
      await idle.none(isCheckpoint);
      for (const c of [owner, member, outsider, idle]) c.ws.close();
    });
  });

  describe("3. loss of the LISTEN connection", () => {
    it("reconnects and delivers what was committed while it was not listening", async () => {
      const watcher = await connect("owner");
      await subscribe(watcher);
      expect(gateway.stats().listening).toBe(true);

      // Only this test database's listener sessions are ended.
      const killed = await pgPool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid() AND query ILIKE 'LISTEN forge_workspace_checkpoint%'`
      );
      expect(killed.rowCount).toBeGreaterThanOrEqual(1);
      for (let i = 0; i < 40 && gateway.stats().listening; i++) await wait(25);
      expect(gateway.stats().listening).toBe(false);

      // Committed by an HTTP-style writer while this instance hears no notifications.
      const current = await files.readFile(projectId, FILE);
      await files.writeFile(projectId, FILE, { content: `${current.content}// during the outage\n`, expectedVersion: current.version });
      const missed = await checkpoints.recordCheckpoint({ projectId, origin: "CODE", kind: "SOURCE_ONLY", filePath: FILE, actorId: users.owner });

      expect((await watcher.next(isCheckpoint, 10_000)).checkpoint.sequence).toBe(missed.sequence);
      expect(gateway.stats().listening).toBe(true);

      // And notifications work again afterwards.
      const after = await checkpoints.recordCheckpoint({ projectId, origin: "CODE", kind: "SOURCE_ONLY", filePath: FILE, actorId: users.owner });
      expect((await watcher.next(isCheckpoint)).checkpoint.sequence).toBe(after.sequence);
      watcher.ws.close();
    }, 30_000);
  });

  describe("5. the canvas editor without a gateway connection of its own", () => {
    it("reaches workspace subscribers through its HTTP save, and cannot overwrite a change it has not loaded", async () => {
      const projectSvc = await import("../services/project/forgeProject.service.js");
      const { buildWebsiteFixture } = await import("./fixtures/website-to-code.fixture.js");
      const HOME = "src/pages/HomePage.tsx";
      const document = buildWebsiteFixture();
      const website = await prisma.website.create({ data: { userId: users.owner, name: `Canvas ${marker}`, slug: `closure-canvas-${marker}`, editorData: document } });
      const bridged = ((await projectSvc.getOrCreateProjectForWebsite(website.id, { id: users.owner, role: "USER" } as any)) as any).id as string;
      const http = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
        fetch(`http://127.0.0.1:${port}${url}`, {
          method,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.owner}`, ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      const canvasSave = (editorData: unknown, documentVersion: number) =>
        http("PUT", `/api/websites/${website.id}`, { editorData }, {
          "X-Forge-Intent": "document-command",
          "If-Match": `"${website.id}:document:${documentVersion}"`,
          "Idempotency-Key": randomUUID(),
        });
      try {
        const workspace = await connect("owner");
        workspace.send({ type: "subscribe", projectId: bridged });
        await workspace.next((m) => m.type === "subscribed" && m.projectId === bridged);
        const fromBridged = (m: any) => m.type === "checkpoint" && m.projectId === bridged;
        const loaded = (website as any).documentVersion ?? 1;

        // Canvas → workspace: the HTTP save is a checkpoint, and the gateway delivers it.
        const edited = JSON.parse(JSON.stringify(document));
        edited.pages[0].elements[0].children[0].content = "Saved from the canvas";
        const saved = await canvasSave(edited, loaded);
        expect(saved.status).toBe(200);
        const afterCanvas = (await saved.json()).website.documentVersion as number;
        const visual = (await workspace.next((m) => fromBridged(m) && m.checkpoint.origin === "VISUAL")).checkpoint;
        expect(visual.documentVersion).toBe(afterCanvas);
        expect((await files.readFile(bridged, HOME)).content).toContain("Saved from the canvas");

        // Workspace → canvas: a code edit changes the document. A canvas still holding the old
        // version is refused, and reloading returns the new document.
        const source = await files.readFile(bridged, HOME);
        const written = await http("POST", `/api/v1/projects/${bridged}/files`, {
          path: HOME, content: String(source.content).replace("Saved from the canvas", "Edited in the Code Workspace"), expectedVersion: source.version,
        });
        expect(written.status).toBe(200);
        expect((await written.json()).sync).toMatchObject({ status: "synced" });
        const code = (await workspace.next((m) => fromBridged(m) && m.checkpoint.origin === "CODE")).checkpoint;
        expect(code.documentVersion).toBeGreaterThan(afterCanvas);

        const stale = JSON.parse(JSON.stringify(edited));
        stale.pages[0].elements[0].children[0].content = "Stale canvas overwrite";
        const refused = await canvasSave(stale, afterCanvas);
        expect(refused.status).toBeGreaterThanOrEqual(400);
        const reloaded = await (await http("GET", `/api/websites/${website.id}`)).json();
        const current = reloaded.website ?? reloaded.data ?? reloaded;
        expect(current.documentVersion).toBe(code.documentVersion);
        expect(JSON.stringify(current.editorData)).toContain("Edited in the Code Workspace");
        expect(JSON.stringify(current.editorData)).not.toContain("Stale canvas overwrite");
        workspace.ws.close();
      } finally {
        await pgPool.query(`DELETE FROM forge_projects WHERE id = $1`, [bridged]).catch(() => undefined);
        await prisma.website.delete({ where: { id: website.id } }).catch(() => undefined);
      }
    }, 60_000);
  });

  describe("4. two backend processes on one database", () => {
    const ports: number[] = [];

    function startInstance(): Promise<number> {
      return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ["--import", "tsx", path.resolve(process.cwd(), "src/tests/helpers/syncGatewayInstance.ts")], {
          cwd: process.cwd(),
          env: { ...process.env, INSTANCE_PORT: "0" },
          stdio: ["ignore", "pipe", "pipe"],
        });
        children.push(child);
        let output = "";
        const timer = setTimeout(() => reject(new Error(`instance did not start: ${output.slice(-400)}`)), 90_000);
        const onData = (chunk: Buffer) => {
          output += chunk.toString();
          const ready = /READY (\d+)/.exec(output);
          if (ready) { clearTimeout(timer); resolve(Number(ready[1])); }
        };
        child.stdout!.on("data", onData);
        child.stderr!.on("data", onData);
        child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`instance exited with ${code}: ${output.slice(-400)}`)); });
      });
    }

    beforeAll(async () => {
      ports.push(...(await Promise.all([startInstance(), startInstance()])));
    }, 120_000);

    it("delivers a change committed on one instance to a subscriber of the other", async () => {
      expect(new Set(ports).size).toBe(2);
      const [onFirst, onSecond] = await Promise.all([connect("owner", ports[0]), connect("owner", ports[1])]);
      await Promise.all([subscribe(onFirst), subscribe(onSecond)]);

      const ack = await act(onFirst, operation("card_title", "From instance one", await version()));
      expect(ack.status).toBe("applied");
      expect((await onSecond.next(isCheckpoint)).checkpoint).toMatchObject({ sequence: ack.sequence, fileVersion: ack.version });
      await onFirst.none(isCheckpoint);

      const back = await act(onSecond, operation("card_body", "From instance two", ack.version));
      expect(back).toMatchObject({ status: "applied", sequence: ack.sequence + 1 });
      expect((await onFirst.next(isCheckpoint)).checkpoint.sequence).toBe(back.sequence);
      for (const c of [onFirst, onSecond]) c.ws.close();
    });

    it("lets one of two concurrent edits sent to different instances win", async () => {
      const [onFirst, onSecond] = await Promise.all([connect("owner", ports[0]), connect("owner", ports[1])]);
      await Promise.all([subscribe(onFirst), subscribe(onSecond)]);
      for (let round = 0; round < 3; round++) {
        const base = await version();
        const [a, b] = await Promise.all([
          act(onFirst, operation("card_title", `Race ${round} one`, base)),
          act(onSecond, operation("card_body", `Race ${round} two`, base)),
        ]);
        expect([a.status, b.status].sort(), `round ${round}`).toEqual(["applied", "conflict"]);
        expect(await version()).toBe(base + 1);
        const [loser, loserClient] = a.status === "conflict" ? [a, onFirst] : [b, onSecond];
        expect(loser.version).toBe(base + 1);
        await loserClient.next(isCheckpoint);
      }
      for (const c of [onFirst, onSecond]) c.ws.close();
    });

    it("applies a duplicated operation ID once, whichever instances receive it", async () => {
      const [onFirst, onSecond] = await Promise.all([connect("owner", ports[0]), connect("owner", ports[1])]);
      await Promise.all([subscribe(onFirst), subscribe(onSecond)]);
      const count = async () => Number((await pgPool.query(`SELECT count(*) FROM forge_workspace_checkpoints WHERE "projectId" = $1`, [projectId])).rows[0].count);

      // Sequential: applied on one instance, replayed by the other.
      const base = await version();
      const op = operation("card_title", "Sent twice", base);
      const first = await act(onFirst, op);
      const second = await act(onSecond, op);
      expect(first).toMatchObject({ status: "applied", version: base + 1 });
      expect(second).toMatchObject({ status: "applied", version: base + 1, sequence: first.sequence, replayed: true });
      expect(await version()).toBe(base + 1);

      // Simultaneous: one write, one checkpoint, and both answers describe that single commit.
      for (let round = 0; round < 3; round++) {
        const before = await count();
        const start = await version();
        const twin = operation("card_body", `Twin ${round}`, start);
        const [a, b] = await Promise.all([act(onFirst, twin), act(onSecond, twin)]);
        expect([a.status, b.status], `round ${round}`).toEqual(["applied", "applied"]);
        expect(a.sequence).toBe(b.sequence);
        expect([a.replayed, b.replayed].filter(Boolean).length).toBe(1);
        expect(await version()).toBe(start + 1);
        expect(await count()).toBe(before + 1);
      }
      for (const c of [onFirst, onSecond]) c.ws.close();
    });
  });
});
