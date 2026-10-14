/**
 * Browser smoke test of the Code Workspace's live sync (blueprint §34, WP-18).
 *
 * Starts a disposable stack (a backend process on the disposable database, a Vite dev server for
 * the frontend, headless Chrome driven over the DevTools protocol) and signs in with a disposable
 * account by session cookie. It observes the browser's own WebSocket to /ws/workspace-sync:
 * authenticated subscription, a live update, the refresh it triggers, and reconnect with catch-up
 * after the backend was stopped and restarted. Nothing touches a developer's running servers.
 *
 * Opt-in: FORGE_BROWSER_SMOKE=1 FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening
 *         [FORGE_CHROME_PATH=…] npx vitest run src/tests/workspace-sync-browser.smoke.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const chromePath = [
  process.env.FORGE_CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((candidate) => candidate && existsSync(candidate));
const optedIn =
  process.env.FORGE_BROWSER_SMOKE === "1" &&
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening" &&
  !!chromePath;

const FILE = "src/components/SmokeCard.tsx";
const SOURCE = `export function SmokeCard() {
  return (
    <section data-forge-id="smoke">
      <h2 data-forge-id="smoke_title">Title</h2>
    </section>
  );
}
`;

const freePort = () =>
  new Promise<number>((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "localhost", () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!optedIn)("Code Workspace live sync in a real browser (disposable stack)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const { AUTH_COOKIE_NAME } = await import("../config/auth.js");
  const files = await import("../services/project/forgeFilesystem.service.js");
  const checkpoints = await import("../services/workspace/workspaceCheckpoints.service.js");

  const marker = randomUUID().slice(0, 8);
  const processes: ChildProcess[] = [];
  let userId = "";
  let projectId = "";
  let token = "";
  let backendPort = 0;
  let frontendPort = 0;
  let backend: ChildProcess;
  let cdp: WebSocket;
  let sessionId = "";
  let nextId = 0;
  const replies = new Map<number, (result: any) => void>();

  // What the browser did, as reported by its own network stack.
  const socketsOpened: Array<{ requestId: string; url: string; status?: number; closed?: boolean }> = [];
  const framesIn: Array<{ requestId: string; data: any }> = [];
  const framesOut: Array<{ requestId: string; data: any }> = [];
  const requests: Array<{ url: string; at: number }> = [];

  const until = async (what: string, check: () => unknown, ms = 60_000) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const value = check();
      if (value) return value;
      await wait(100);
    }
    throw new Error(`timed out waiting for: ${what}`);
  };

  function run(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }, ready: RegExp, label: string): Promise<{ child: ChildProcess; match: RegExpExecArray }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
      processes.push(child);
      let output = "";
      const timer = setTimeout(() => reject(new Error(`${label} did not start: ${output.slice(-600)}`)), 120_000);
      const onData = (chunk: Buffer) => {
        output += chunk.toString().replace(/\u001b\[[0-9;]*m/g, "");
        const match = ready.exec(output);
        if (match) { clearTimeout(timer); resolve({ child, match }); }
      };
      child.stdout!.on("data", onData);
      child.stderr!.on("data", onData);
      child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`${label} exited with ${code}: ${output.slice(-600)}`)); });
    });
  }

  const startBackend = async () => {
    backend = (await run(
      process.execPath,
      ["--import", "tsx", path.resolve(process.cwd(), "src/tests/helpers/syncGatewayInstance.ts")],
      { cwd: process.cwd(), env: { ...process.env, INSTANCE_PORT: String(backendPort), INSTANCE_HOST: "localhost", FRONTEND_URL: `http://localhost:${frontendPort}`, NODE_ENV: "development" } },
      /READY (\d+)/,
      "backend"
    )).child;
  };

  function send(method: string, params: Record<string, unknown> = {}, inSession = true): Promise<any> {
    const id = ++nextId;
    cdp.send(JSON.stringify({ id, method, params, ...(inSession && sessionId ? { sessionId } : {}) }));
    return new Promise((resolve) => replies.set(id, resolve));
  }

  const syncSockets = () => socketsOpened.filter((s) => s.url.includes("/ws/workspace-sync"));
  const received = (type: string, requestId?: string) => framesIn.filter((f) => f.data?.type === type && (!requestId || f.requestId === requestId));

  beforeAll(async () => {
    await ensureDatabaseTables();
    const user = await prisma.user.create({
      data: { fullName: "Browser Smoke", email: `browser-smoke-${marker}@example.test`, status: "ACTIVE", authEpoch: 1 } as any,
    });
    userId = user.id;
    token = `browser-smoke-${randomUUID()}`;
    await prisma.session.create({
      data: {
        userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000),
        authEpoch: 1, audience: "TENANT", authTime: new Date(Date.now() - 1000), authMethod: "local", lastUsedAt: new Date(),
      },
    });
    projectId = (await (prisma as any).forgeProject.create({ data: { name: `smoke ${marker}`, slug: `smoke-${marker}`, ownerId: userId, framework: "react" } })).id;
    await files.writeFile(projectId, FILE, { content: SOURCE, authorId: userId });
    await checkpoints.recordCheckpoint({ projectId, origin: "CODE", kind: "SOURCE_ONLY", filePath: FILE, message: "baseline", actorId: userId });

    [backendPort, frontendPort] = [await freePort(), await freePort()];
    await startBackend();
    const frontend = path.resolve(process.cwd(), "../frontend");
    await run(
      process.execPath,
      [path.join(frontend, "node_modules/vite/bin/vite.js"), "--port", String(frontendPort), "--strictPort", "--host", "localhost"],
      { cwd: frontend, env: { ...process.env, VITE_API_URL: `http://localhost:${backendPort}` } },
      /Local:\s+http/,
      "vite"
    );

    const chrome = await run(
      chromePath!,
      ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "forge-smoke-"))}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank"],
      { cwd: process.cwd(), env: process.env },
      /DevTools listening on (ws:\/\/\S+)/,
      "chrome"
    );
    cdp = new WebSocket(chrome.match[1]);
    await new Promise((r) => cdp.once("open", r));
    cdp.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && replies.has(msg.id)) { replies.get(msg.id)!(msg.result ?? msg.error); replies.delete(msg.id); return; }
      const p = msg.params;
      const json = (text: string) => { try { return JSON.parse(text); } catch { return text; } };
      if (msg.method === "Network.webSocketCreated") socketsOpened.push({ requestId: p.requestId, url: p.url });
      else if (msg.method === "Network.webSocketHandshakeResponseReceived") { const s = socketsOpened.find((x) => x.requestId === p.requestId); if (s) s.status = p.response.status; }
      else if (msg.method === "Network.webSocketClosed") { const s = socketsOpened.find((x) => x.requestId === p.requestId); if (s) s.closed = true; }
      else if (msg.method === "Network.webSocketFrameReceived") framesIn.push({ requestId: p.requestId, data: json(p.response.payloadData) });
      else if (msg.method === "Network.webSocketFrameSent") framesOut.push({ requestId: p.requestId, data: json(p.response.payloadData) });
      else if (msg.method === "Network.requestWillBeSent") requests.push({ url: p.request.url, at: Date.now() });
    });
    const { targetId } = await send("Target.createTarget", { url: "about:blank" }, false);
    sessionId = (await send("Target.attachToTarget", { targetId, flatten: true }, false)).sessionId;
    await send("Network.enable");
    await send("Page.enable");
    await send("Runtime.enable");
    // The disposable account's session, as the login would have set it.
    const cookie = await send("Network.setCookie", { name: AUTH_COOKIE_NAME, value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" });
    expect(cookie.success).toBe(true);
    await send("Page.navigate", { url: `http://localhost:${frontendPort}/workspace/${projectId}` });
  }, 300_000);

  afterAll(async () => {
    try { cdp?.close(); } catch { /* already closed */ }
    for (const child of processes) child.kill();
    if (projectId) await pgPool.query(`DELETE FROM forge_projects WHERE id = $1`, [projectId]).catch(() => undefined);
    await prisma.session.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  }, 60_000);

  it("subscribes with the signed-in session, shows a live update, and catches up after the backend restarts", async () => {
    // 1. Authenticated subscription from the Code Workspace page.
    await until("the workspace to open its sync socket", () => syncSockets().length > 0, 120_000);
    const first = syncSockets()[0];
    await until("the socket handshake", () => first.status !== undefined);
    expect(first.status).toBe(101);
    expect(first.url).toBe(`ws://localhost:${backendPort}/ws/workspace-sync`);
    await until("the subscription", () => received("subscribed", first.requestId).length > 0);
    expect(received("ready", first.requestId)[0].data.userId).toBe(userId);
    expect(framesOut.find((f) => f.requestId === first.requestId && f.data?.type === "subscribe")?.data).toMatchObject({ projectId });
    const subscribed = received("subscribed", first.requestId)[0].data;
    expect(subscribed.projectId).toBe(projectId);
    const page = await send("Runtime.evaluate", { expression: "location.pathname + '|' + document.title", returnByValue: true });
    expect(String(page.result.value)).toContain(`/workspace/${projectId}`);

    // 2. A change committed by another client arrives in the browser and makes the page re-read the project.
    const other = new WebSocket(`ws://localhost:${backendPort}/ws/workspace-sync`, { headers: { Authorization: `Bearer ${token}` } });
    const acks: any[] = [];
    other.on("message", (raw) => { const m = JSON.parse(raw.toString()); if (m.type === "ready") other.send(JSON.stringify({ type: "subscribe", projectId })); if (m.type === "ack") acks.push(m); });
    await new Promise((r) => other.once("open", r));
    await wait(500);
    const editAt = Date.now();
    other.send(JSON.stringify({ type: "operation", projectId, operationId: `op-${randomUUID()}`, filePath: FILE, elementId: "smoke_title", expectedRevision: (await files.readFile(projectId, FILE)).version, mutation: { type: "SET_TEXT", text: "Edited elsewhere" } }));
    await until("the other client's acknowledgement", () => acks.length > 0);
    expect(acks[0].status).toBe("applied");
    await until("the checkpoint in the browser", () => received("checkpoint", first.requestId).some((f) => f.data.checkpoint.sequence === acks[0].sequence));
    await until("the page to re-read the project", () => requests.some((r) => r.at >= editAt && r.url.includes(`/api/v1/projects/${projectId}/files`)), 15_000);
    other.close();

    // 3. The backend goes away; a change is committed meanwhile; the browser reconnects and catches up.
    backend.kill();
    await until("the browser to see the socket close", () => first.closed === true, 20_000);
    const current = await files.readFile(projectId, FILE);
    await files.writeFile(projectId, FILE, { content: `${current.content}// committed during the outage\n`, expectedVersion: current.version });
    const missed = await checkpoints.recordCheckpoint({ projectId, origin: "CODE", kind: "SOURCE_ONLY", filePath: FILE, actorId: userId });
    await startBackend();

    await until("the browser to reconnect", () => syncSockets().some((s) => s.requestId !== first.requestId && s.status === 101), 60_000);
    const second = syncSockets().filter((s) => s.requestId !== first.requestId && s.status === 101).pop()!;
    await until("the resumed subscription", () => received("subscribed", second.requestId).length > 0);
    const resume = framesOut.find((f) => f.requestId === second.requestId && f.data?.type === "subscribe")!.data;
    expect(resume.afterSequence).toBe(acks[0].sequence); // it resumes from the last checkpoint it saw
    await until("the missed checkpoint", () => received("checkpoint", second.requestId).some((f) => f.data.checkpoint.sequence === missed.sequence));
    expect(received("checkpoint", second.requestId).map((f) => f.data.checkpoint.sequence)).toEqual([missed.sequence]);
  }, 300_000);
});
