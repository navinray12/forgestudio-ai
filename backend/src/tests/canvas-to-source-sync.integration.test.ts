/**
 * Canvas → source round trip for hand-written pages (blueprint §31, WP-04/WP-18).
 *
 * Reproduces what the visual editor does on save, using the editor's own client modules
 * (frontend forgeProjectService and canvasSourceSync) against the real Express application and the
 * persisted workspace in the disposable database:
 *   canvas change → document save (PUT /api/websites/:id) → held pages reported → edit plan →
 *   AST mutation endpoint per element → stored source → code-to-visual readback.
 * It does not drive the React editor component or a browser.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/canvas-to-source-sync.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

const HOME = "src/pages/HomePage.tsx";
const ABOUT = "src/pages/AboutUsPage.tsx";

describe.skipIf(!optedIn)("Canvas edits reach hand-written page source (real app, disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const projectSvc = await import("../services/project/forgeProject.service.js");
  const { parseSourceCodeToElements, validateSourceSyntax } = await import("../services/compiler/visualCodeSync.service.js");
  const { buildWebsiteFixture } = await import("./fixtures/website-to-code.fixture.js");
  const { default: app } = await import("../app.js");

  const marker = randomUUID().slice(0, 8);
  const tokens = {} as Record<"owner" | "outsider", string>;
  const ids = {} as Record<"owner" | "outsider", string>;
  let websiteId = "";
  let projectId = "";
  let server: Server;
  let base = "";
  let document: any = buildWebsiteFixture();
  let documentVersion = 1;
  // The editor's own client modules, loaded from the frontend source tree.
  let service: any;
  let canvas: any;
  const mutationCalls: Array<{ filePath: string; elementId: string; type: string; expectedRevision: number }> = [];

  const element = (doc: any, id: string): any => {
    const find = (list: any[]): any => {
      for (const el of list || []) {
        if (el.id === id) return el;
        const hit = find(el.children || el.elements);
        if (hit) return hit;
      }
      return null;
    };
    for (const page of doc.pages) {
      const hit = find(page.elements);
      if (hit) return hit;
    }
    return null;
  };

  const stored = async (filePath = HOME): Promise<{ content: string; version: number }> => {
    const { file } = await service.readFile(projectId, filePath);
    return { content: file.content, version: file.version };
  };

  /** The editor's save: persist the document, then send the change to the held pages (WebsiteEditor.persistDocument). */
  async function canvasSave(change: (doc: any) => void, api: any = service) {
    const before = JSON.parse(JSON.stringify(document));
    const after = JSON.parse(JSON.stringify(document));
    change(after);
    const res = await fetch(`${base}/api/websites/${websiteId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.owner}`,
        "X-Forge-Intent": "document-command",
        "If-Match": `"${websiteId}:document:${documentVersion}"`,
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({ editorData: after }),
    });
    const json = await res.json();
    expect(res.status, JSON.stringify(json).slice(0, 300)).toBe(200);
    document = after;
    documentVersion = json.website.documentVersion;
    const codeSync = json.codeSync;
    const outcome = await canvas.syncAcknowledgedSave(api, { codeSync }, before, after);
    return { codeSync, outcome };
  }

  beforeAll(async () => {
    await ensureDatabaseTables();
    for (const who of ["owner", "outsider"] as const) {
      const user = await prisma.user.create({
        data: { fullName: `Canvas ${who}`, email: `canvas-${who}-${marker}@example.test`, status: "ACTIVE", authEpoch: 1 } as any,
      });
      ids[who] = user.id;
      const token = `canvas-${who}-${randomUUID()}`;
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
    const website = await prisma.website.create({
      data: { userId: ids.owner, name: `Canvas ${marker}`, slug: `canvas-${marker}`, editorData: document },
    });
    websiteId = website.id;
    documentVersion = (website as any).documentVersion ?? 1;
    projectId = ((await projectSvc.getOrCreateProjectForWebsite(websiteId, { id: ids.owner, role: "USER" } as any)) as any).id;

    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    vi.stubEnv("VITE_API_URL", base);
    vi.stubGlobal("localStorage", { getItem: (key: string) => (key === "token" ? tokens.owner : null) });
    const services = path.resolve(process.cwd(), "../frontend/src/features/developer-workspace/services");
    const load = (file: string) => import(/* @vite-ignore */ pathToFileURL(path.join(services, file)).href);
    const real = (await load("forgeProjectService.ts")).forgeProjectService;
    canvas = await load("canvasSourceSync.ts");
    // Same client, with every mutation request recorded.
    service = Object.create(real);
    service.syncVisualToCode = async (project: string, filePath: string, el: { id: string }, options: any) => {
      mutationCalls.push({ filePath, elementId: el.id, type: options.mutation.type, expectedRevision: options.expectedRevision });
      return real.syncVisualToCode(project, filePath, el, options);
    };
  }, 120_000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await new Promise((r) => server?.close(r));
    if (projectId) await pgPool.query(`DELETE FROM forge_projects WHERE id = $1`, [projectId]).catch(() => undefined);
    if (websiteId) await prisma.website.delete({ where: { id: websiteId } }).catch(() => undefined);
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  });

  it("regenerates a generator-owned page on save without any element edit", async () => {
    const { codeSync, outcome } = await canvasSave((doc) => {
      element(doc, "about-title").content = "Our story, retold";
    });
    expect(codeSync).toMatchObject({ synced: true, stale: false, projectId });
    expect(codeSync.conflicts).toBeUndefined();
    expect(outcome).toBeUndefined();
    expect(mutationCalls).toEqual([]);
    expect((await stored(ABOUT)).content).toContain("Our story, retold");
  });

  it("holds a page back once it carries hand-written code", async () => {
    const generated = await stored();
    const handWritten = generated.content
      .replace('data-forge-id="hero-plain-button"', 'onClick={() => console.log("hand-written handler")} data-forge-id="hero-plain-button"');
    expect(handWritten).not.toBe(generated.content);
    const saved = await service.writeFile(projectId, HOME, { content: handWritten, expectedVersion: generated.version });
    expect(saved.sync?.status).toBe("unsupported");
  });

  it("sends a canvas change to the held page as element edits and persists them", async () => {
    const before = await stored();
    const { codeSync, outcome } = await canvasSave((doc) => {
      const hero = element(doc, "hero");
      element(doc, "hero-title").content = "Ship faster with Acme";
      element(doc, "hero-title").classes = ["hero-title", "promo-heading"];
      hero.children = hero.children.filter((child: any) => child.id !== "hero-copy");
      hero.children.splice(1, 0, { id: "hero-note", type: "text", content: "Launch week offer" });
      const image = hero.children.find((child: any) => child.id === "hero-image");
      hero.children = [image, ...hero.children.filter((child: any) => child !== image)];
    });

    expect(codeSync.conflicts).toEqual([HOME]);
    expect(outcome.error).toBeUndefined();
    const file = outcome.files[0];
    expect(file, JSON.stringify(outcome)).toMatchObject({ filePath: HOME, rejected: [], unsupported: [] });
    expect(file.conflict).toBeUndefined();
    expect(file.applied).toBeGreaterThanOrEqual(5);

    // Every edit went through the mutation endpoint, bound to the revision the previous one produced.
    const calls = mutationCalls.filter((call) => call.filePath === HOME);
    expect(calls.map((call) => call.type)).toEqual(expect.arrayContaining(["SET_TEXT", "SET_CLASSES", "REMOVE", "INSERT", "REORDER"]));
    expect(calls[0].expectedRevision).toBe(before.version);
    calls.forEach((call, i) => i > 0 && expect(call.expectedRevision).toBeGreaterThanOrEqual(calls[i - 1].expectedRevision));

    const after = await stored();
    expect(after.version).toBe(before.version + file.applied);
    expect(file.version).toBe(after.version);
    expect(validateSourceSyntax(after.content, HOME).isValid).toBe(true);
    expect(after.content).toContain("Ship faster with Acme");
    expect(after.content).toContain("promo-heading");
    expect(after.content).toContain("Launch week offer");
    expect(after.content).not.toContain('data-forge-id="hero-copy"');

    // Hand-written code and everything outside the edited elements is exactly as it was.
    const line = (source: string, needle: string) => source.split("\n").find((l) => l.includes(needle));
    expect(line(after.content, "hand-written handler")).toBe(line(before.content, "hand-written handler"));
    expect(after.content.slice(0, after.content.indexOf("return ("))).toBe(before.content.slice(0, before.content.indexOf("return (")));
    expect(line(after.content, 'data-forge-id="hero-cta"')).toBe(line(before.content, 'data-forge-id="hero-cta"'));

    // Code-to-visual readback of the stored source shows the canvas state.
    const readback = parseSourceCodeToElements(after.content, [], HOME);
    expect(readback.success).toBe(true);
    const flat: any[] = [];
    const walk = (list: any[]) => list.forEach((el) => { flat.push(el); walk(el.children || []); });
    walk(readback.elements);
    expect(flat.find((el) => el.id === "hero-title")).toMatchObject({ type: "heading", content: "Ship faster with Acme" });
    expect(flat.find((el) => el.id === "hero-title").classes).toContain("promo-heading");
    expect(flat.find((el) => el.id === "hero-note")).toMatchObject({ content: "Launch week offer" });
    expect(flat.find((el) => el.id === "hero").children.map((el: any) => el.id)).toEqual(["hero-image", "hero-title", "hero-note", "hero-row"]);
  });

  it("creates no source version when the saved canvas has nothing new for the page", async () => {
    const before = await stored();
    const calls = mutationCalls.length;
    const { codeSync, outcome } = await canvasSave((doc) => {
      doc.pageCss = `${doc.pageCss}\n/* unrelated save */`;
    });
    expect(codeSync.conflicts).toEqual([HOME]);
    expect(outcome.files[0]).toMatchObject({ applied: 0, unchanged: 0, rejected: [], unsupported: [] });
    expect(mutationCalls.length).toBe(calls);
    expect(await stored()).toEqual(before);
    expect(canvas.describeCanvasSourceSync(outcome)).toBeNull();
  });

  it("reports a rejected edit, keeps the source, and still applies the rest", async () => {
    const before = await stored();
    const { outcome } = await canvasSave((doc) => {
      const row = element(doc, "hero-row");
      row.elements = row.elements.filter((child: any) => child.id !== "hero-plain-button");
      element(doc, "hero-note").content = "Offer extended";
    });
    const file = outcome.files[0];
    expect(file.applied).toBe(1);
    expect(file.rejected).toEqual([expect.objectContaining({ elementId: "hero-plain-button", mutation: "REMOVE", code: "SOURCE_OWNED" })]);
    const after = await stored();
    expect(after.version).toBe(before.version + 1);
    expect(after.content).toContain("hand-written handler");
    expect(after.content).toContain("Offer extended");
    const message = canvas.describeCanvasSourceSync(outcome);
    expect(message.isProblem).toBe(true);
    expect(message.text).toContain("1 edit applied");
    expect(message.text).toContain("hero-plain-button");
  });

  it("re-reads the revision after a concurrent code edit instead of overwriting it", async () => {
    let interfered = false;
    const racing = Object.create(service);
    racing.syncVisualToCode = async (...args: any[]) => {
      if (!interfered) {
        interfered = true;
        const current = await stored();
        await service.writeFile(projectId, HOME, { content: `// edited in the Code Workspace meanwhile\n${current.content}`, expectedVersion: current.version });
      }
      return service.syncVisualToCode(...args);
    };
    const before = await stored();
    const { outcome } = await canvasSave((doc) => {
      element(doc, "hero-note").content = "Offer ends Friday";
    }, racing);
    expect(outcome.files[0]).toMatchObject({ applied: 1, rejected: [] });
    expect(outcome.files[0].conflict).toBeUndefined();
    const after = await stored();
    expect(after.content.startsWith("// edited in the Code Workspace meanwhile\n")).toBe(true);
    expect(after.content).toContain("Offer ends Friday");
    expect(after.version).toBe(before.version + 2);
  });

  it("stops and reports a conflict when the file keeps changing", async () => {
    const racing = Object.create(service);
    let n = 0;
    racing.syncVisualToCode = async (...args: any[]) => {
      const current = await stored();
      await service.writeFile(projectId, HOME, { content: `// concurrent edit ${++n}\n${current.content}`, expectedVersion: current.version });
      return service.syncVisualToCode(...args);
    };
    const { outcome } = await canvasSave((doc) => {
      element(doc, "hero-note").content = "Never written";
    }, racing);
    expect(outcome.files[0].applied).toBe(0);
    expect(outcome.files[0].conflict).toContain("Revision conflict");
    const after = await stored();
    expect(after.content).not.toContain("Never written");
    expect(after.content).toContain("// concurrent edit 2");
    expect(canvas.describeCanvasSourceSync(outcome)).toMatchObject({ isProblem: true });
  });

  it("plans only held pages and requires project access", async () => {
    const plan = await service.planVisualToCode(projectId, { before: document, after: document, paths: [ABOUT, HOME] });
    expect(plan.skipped).toEqual([expect.objectContaining({ filePath: ABOUT })]);
    expect(plan.files).toEqual([expect.objectContaining({ filePath: HOME, edits: [], unsupported: [] })]);

    const request = (token: string | null, body: unknown) =>
      fetch(`${base}/api/v1/projects/${projectId}/sync/visual-to-code/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
    expect((await request(null, { before: document, after: document })).status).toBe(401);
    expect([403, 404]).toContain((await request(tokens.outsider, { before: document, after: document })).status);
    expect((await request(tokens.owner, { after: document })).status).toBe(400);
    expect((await request(tokens.owner, { before: document, after: document, paths: "x" })).status).toBe(400);
  });
});
