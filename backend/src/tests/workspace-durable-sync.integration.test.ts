/**
 * Durable Visual Editor <-> Code Workspace synchronization on real PostgreSQL
 * (blueprint §33.3, §34.3, §34.4; FS21-AT-SYN-02, SYN-03, SYN-04, SYN-05, SYN-07).
 *
 * Uses the real save path (writeFileHandler -> syncSourceToVisualWebsite), the real compiler and
 * the real document store. "Restart" is a separate Node process that reads the state back from
 * the database, so nothing can come from this process's memory.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/workspace-durable-sync.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

const HOME = "src/pages/HomePage.tsx";

describe.skipIf(!optedIn)("Durable visual/code synchronization (disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const projectSvc = await import("../services/project/forgeProject.service.js");
  const fs = await import("../services/project/forgeFilesystem.service.js");
  const controller = await import("../controllers/project.controller.js");
  const checkpoints = await import("../services/workspace/workspaceCheckpoints.service.js");
  const { buildWebsiteFixture } = await import("./fixtures/website-to-code.fixture.js");

  const marker = randomUUID().slice(0, 8);
  let user: { id: string; role: string };
  let websiteId = "";
  let projectId = "";

  async function call(handler: any, opts: { params?: any; body?: any; query?: any; headers?: Record<string, string> }) {
    let status = 0;
    let payload: any;
    let error: any;
    const res: any = {
      locals: { user },
      status(c: number) { status = c; return res; },
      json(b: any) { payload = b; return res; },
    };
    const headers = opts.headers || {};
    await handler(
      { params: opts.params || {}, body: opts.body || {}, query: opts.query || {}, get: (h: string) => headers[h] },
      res,
      (e: any) => { error = e; }
    );
    if (error) throw error;
    return { status, payload };
  }

  const source = async () => (await fs.readFile(projectId, HOME)).content as string;
  const documentText = async () => JSON.stringify((await prisma.website.findUnique({ where: { id: websiteId } }))!.editorData);

  async function saveCode(content: string, idempotencyKey?: string) {
    return call(controller.writeFileHandler, {
      params: { id: projectId },
      body: { path: HOME, content },
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    });
  }

  beforeAll(async () => {
    await ensureDatabaseTables();
    const created = await prisma.user.create({ data: { fullName: "Sync owner", email: `sync-${marker}@example.test`, status: "ACTIVE" } });
    user = { id: created.id, role: "USER" };
    const site = await prisma.website.create({
      data: { userId: user.id, name: `Sync ${marker}`, slug: `sync-${marker}`, editorData: buildWebsiteFixture() },
    });
    websiteId = site.id;
    const project: any = await projectSvc.getOrCreateProjectForWebsite(websiteId, user);
    projectId = project.id;
    expect(project.visualSync?.stale ?? false).toBe(false);
  }, 60_000);

  afterAll(async () => {
    if (projectId) await pgPool.query(`DELETE FROM forge_projects WHERE id = $1`, [projectId]);
    if (websiteId) await prisma.website.delete({ where: { id: websiteId } }).catch(() => undefined);
    // The append-only workspace journal restricts deleting the fixture user's organization, so the
    // fixture user may remain in the disposable database.
    await prisma.user.deleteMany({ where: { email: `sync-${marker}@example.test` } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  });

  let syncedCheckpointId = "";

  it("records the initial visual -> code generation as a synchronized checkpoint", async () => {
    const state = await checkpoints.getCheckpointState(projectId);
    expect(state.lastSynchronized?.origin).toBe("VISUAL");
    expect(state.lastSynchronized?.sourceManifest.some((f) => f.path === HOME)).toBe(true);
  });

  it("applies a supported code edit to the visual document and checkpoints both sides", async () => {
    const edited = (await source()).replace("Build faster with Acme", "Typed in the code editor");
    const { payload } = await saveCode(edited, `save-${marker}-1`);
    expect(payload.sync.status).toBe("synced");
    expect(payload.checkpoint.kind).toBe("SYNCHRONIZED");
    syncedCheckpointId = payload.checkpoint.id;
    expect(await documentText()).toContain("Typed in the code editor");

    const site = await prisma.website.findUnique({ where: { id: websiteId } });
    const state = await checkpoints.getCheckpointState(projectId);
    expect(state.latest?.id).toBe(syncedCheckpointId);
    expect(state.latest?.documentVersion).toBe(site!.documentVersion);
    const file = await fs.readFile(projectId, HOME);
    expect(state.latest?.sourceManifest.find((f) => f.path === HOME)).toMatchObject({ version: file.version, contentHash: file.contentHash });
  });

  it("returns the committed result for a retried save instead of writing twice", async () => {
    const before = await fs.readFile(projectId, HOME);
    const countBefore = (await checkpoints.listCheckpointsAfter(projectId, 0)).length;
    const replay = await saveCode(before.content + "\n// a different body that must not be written", `save-${marker}-1`);
    expect(replay.payload.replayed).toBe(true);
    expect(replay.payload.checkpoint.id).toBe(syncedCheckpointId);
    expect((await fs.readFile(projectId, HOME)).version).toBe(before.version);
    expect((await checkpoints.listCheckpointsAfter(projectId, 0)).length).toBe(countBefore);
  });

  it("survives a restart: a new process reads the same checkpoint, document and source", async () => {
    const script = path.join(process.cwd(), `.restart-probe-${marker}.ts`);
    writeFileSync(script, `
      import { getCheckpointState } from "./src/services/workspace/workspaceCheckpoints.service.ts";
      import { readFile } from "./src/services/project/forgeFilesystem.service.ts";
      import { prisma, pgPool } from "./src/config/prisma.ts";
      const state = await getCheckpointState(${JSON.stringify(projectId)});
      const file = await readFile(${JSON.stringify(projectId)}, ${JSON.stringify(HOME)});
      const site = await prisma.website.findUnique({ where: { id: ${JSON.stringify(websiteId)} } });
      console.log("PROBE" + JSON.stringify({ checkpoint: state.lastSynchronized?.id, version: file.version, hasCode: file.content.includes("Typed in the code editor"), hasDoc: JSON.stringify(site?.editorData).includes("Typed in the code editor"), pid: process.pid }));
      await prisma.$disconnect(); await pgPool.end();
    `);
    try {
      const out = execFileSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), script], {
        env: process.env,
        encoding: "utf8",
        timeout: 60_000,
      });
      const probe = JSON.parse(out.slice(out.indexOf("PROBE") + 5).trim().split("\n")[0]);
      expect(probe.pid).not.toBe(process.pid);
      expect(probe).toMatchObject({ checkpoint: syncedCheckpointId, version: (await fs.readFile(projectId, HOME)).version, hasCode: true, hasDoc: true });
    } finally {
      rmSync(script, { force: true });
    }
  }, 90_000);

  it("keeps an invalid draft without touching the visual document", async () => {
    const lastValid = (await checkpoints.getCheckpointState(projectId)).lastSynchronized!.id;
    const docBefore = await documentText();
    const broken = (await source()) + "\nexport const = ;\n";
    const { payload } = await saveCode(broken);
    expect(payload.sync.status).toBe("invalid");
    expect(payload.checkpoint.kind).toBe("DRAFT");
    expect(await source()).toContain("export const = ;");
    expect(await documentText()).toBe(docBefore);
    expect((await checkpoints.getCheckpointState(projectId)).lastSynchronized!.id).toBe(lastValid);

    const repaired = (await source()).replace("\nexport const = ;\n", "");
    expect((await saveCode(repaired)).payload.sync.status).toMatch(/synced|unchanged/);
  });

  it("detects edits on both sides, preserves both, and resolves only on an explicit choice", async () => {
    // Visual Editor save: the heading is changed visually and the project re-synchronised.
    const site = await prisma.website.findUnique({ where: { id: websiteId } });
    const nextDoc = JSON.parse(JSON.stringify(site!.editorData).replace("Typed in the code editor", "Changed on the canvas"));
    await prisma.website.update({ where: { id: websiteId }, data: { editorData: nextDoc, documentVersion: (site!.documentVersion ?? 1) + 1 } });

    // Code Workspace save based on the old generated source (made before the visual sync ran).
    const stale = (await source()).replace("Typed in the code editor", "Changed in the code");
    const { payload } = await saveCode(stale);
    expect(payload.sync.status).toBe("conflict");
    expect(payload.checkpoint.kind).toBe("CONFLICT");
    expect(await source()).toContain("Changed in the code");
    expect(await documentText()).toContain("Changed on the canvas");

    const resolved = await call(controller.syncCodeToVisualHandler, { params: { id: projectId }, body: { filePath: HOME, resolve: "code" } });
    expect(resolved.payload.status).toBe("synced");
    expect(resolved.payload.checkpoint.kind).toBe("SYNCHRONIZED");
    expect(await documentText()).toContain("Changed in the code");
  });

  it("lets a reconnecting client fetch exactly the checkpoints it missed", async () => {
    const all = await checkpoints.listCheckpointsAfter(projectId, 0);
    const sequences = all.map((c) => c.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(new Set(sequences).size).toBe(sequences.length);
    const midpoint = sequences[Math.floor(sequences.length / 2)];
    const { payload } = await call(controller.listWorkspaceCheckpointsHandler, { params: { id: projectId }, query: { after: String(midpoint) } });
    expect(payload.checkpoints.map((c: any) => c.sequence)).toEqual(sequences.filter((s) => s > midpoint));
  });

  it("does not lose concurrent sync-state updates", async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        checkpoints.updateProjectMetadataAtomic(projectId, (meta) => {
          meta.concurrencyProbe = { ...(meta.concurrencyProbe || {}), [`k${i}`]: i };
        })
      )
    );
    const { rows } = await pgPool.query(`SELECT metadata FROM forge_projects WHERE id = $1`, [projectId]);
    expect(Object.keys(rows[0].metadata.concurrencyProbe).sort()).toEqual(Array.from({ length: 8 }, (_, i) => `k${i}`).sort());
    expect(rows[0].metadata.visualSync).toBeDefined();
  });
});
