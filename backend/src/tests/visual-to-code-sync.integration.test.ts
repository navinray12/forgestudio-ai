/**
 * Visual-to-code save flow (blueprint §31, WP-04/WP-18).
 *
 * Drives POST /api/v1/projects/:id/sync/visual-to-code on the real Express application with real
 * sessions and the persisted workspace in the disposable database: each mutation is read back from
 * the stored file, and rejected or no-op edits must leave the file and its version untouched.
 * It does not cover the browser editor UI or WebSocket transport.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/visual-to-code-sync.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

describe.skipIf(!optedIn)("Visual-to-code save flow (real app, disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const projectSvc = await import("../services/project/forgeProject.service.js");
  const { validateSourceSyntax } = await import("../services/compiler/visualCodeSync.service.js");
  const { buildWebsiteFixture } = await import("./fixtures/website-to-code.fixture.js");
  const { default: app } = await import("../app.js");

  const marker = randomUUID().slice(0, 8);
  const tokens = {} as Record<"owner" | "outsider", string>;
  const ids = {} as Record<"owner" | "outsider", string>;
  let websiteId = "";
  let projectId = "";
  let server: Server;
  let base = "";

  const FILE = "src/components/PromoBanner.tsx";
  const SOURCE = `import { useState } from "react";
import { css } from "../forge/css";

// Hand-written helper: must survive every visual edit.
const shout = (value: string) => value.toUpperCase();

export function PromoBanner({ code }: { code: string }) {
  const [seen, setSeen] = useState(false);

  return (
    <aside className="promo" style={css({ padding: 16 })} data-forge-id="promo">
      <h2 data-forge-id="promo_title">Spring sale</h2>
      <p data-forge-id="promo_code">{shout(code)}</p>
      <ul data-forge-id="promo_list">
        <li data-forge-id="promo_a">Free shipping</li>
        <li data-forge-id="promo_b">Extended returns</li>
      </ul>
      <button onClick={() => setSeen(true)} data-forge-id="promo_dismiss">{seen ? "Seen" : "Dismiss"}</button>
    </aside>
  );
}
`;

  async function api(method: string, path: string, who: "owner" | "outsider" | null, body?: unknown) {
    const res = await fetch(`${base}/api/v1/projects/${projectId}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  const sync = (elementId: string, mutation: unknown, extra: Record<string, unknown> = {}, who: "owner" | "outsider" | null = "owner") =>
    api("POST", "/sync/visual-to-code", who, { filePath: FILE, element: { id: elementId }, mutation, ...extra });

  async function stored(path = FILE): Promise<{ content: string; version: number }> {
    const { json } = await api("GET", `/files/content?path=${encodeURIComponent(path)}`, "owner");
    return { content: json.file.content, version: json.file.version };
  }

  beforeAll(async () => {
    await ensureDatabaseTables();
    for (const who of ["owner", "outsider"] as const) {
      const user = await prisma.user.create({
        data: { fullName: `Sync ${who}`, email: `vsync-${who}-${marker}@example.test`, status: "ACTIVE", authEpoch: 1 } as any,
      });
      ids[who] = user.id;
      const token = `vsync-${who}-${randomUUID()}`;
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
      data: { userId: ids.owner, name: `VSync ${marker}`, slug: `vsync-${marker}`, editorData: buildWebsiteFixture() },
    });
    websiteId = website.id;
    projectId = ((await projectSvc.getOrCreateProjectForWebsite(websiteId, { id: ids.owner, role: "USER" } as any)) as any).id;

    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const saved = await api("POST", "/files", "owner", { path: FILE, content: SOURCE });
    expect(saved.status).toBe(200);
  }, 120_000);

  afterAll(async () => {
    await new Promise((r) => server?.close(r));
    if (projectId) await pgPool.query(`DELETE FROM forge_projects WHERE id = $1`, [projectId]).catch(() => undefined);
    if (websiteId) await prisma.website.delete({ where: { id: websiteId } }).catch(() => undefined);
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  });

  it("requires a session and project access", async () => {
    const before = await stored();
    expect((await sync("promo_title", { type: "SET_TEXT", text: "x" }, {}, null)).status).toBe(401);
    expect([403, 404]).toContain((await sync("promo_title", { type: "SET_TEXT", text: "x" }, {}, "outsider")).status);
    expect(await stored()).toEqual(before);
  });

  it("persists every supported mutation and bumps the file version once per change", async () => {
    let { version } = await stored();
    const steps: Array<[string, unknown, (content: string) => void]> = [
      ["promo_title", { type: "SET_TEXT", text: "Summer sale" }, (c) => expect(c).toContain('<h2 data-forge-id="promo_title">Summer sale</h2>')],
      ["promo_title", { type: "SET_PROP", name: "title", value: "Offer" }, (c) => expect(c).toContain('<h2 data-forge-id="promo_title" title="Offer">')],
      ["promo", { type: "SET_CLASSES", add: ["promo--wide"] }, (c) => expect(c).toContain('<aside className="promo promo--wide" style=')],
      ["promo", { type: "SET_STYLE", style: { padding: 24, gap: "8px" } }, (c) => expect(c).toContain('style={css({ padding: 24, gap: "8px" })}')],
      ["promo_c", { type: "INSERT", parentId: "promo_list", element: { tag: "li", text: "Gift wrap" } }, (c) => expect(c).toContain('        <li data-forge-id="promo_b">Extended returns</li>\n        <li data-forge-id="promo_c">Gift wrap</li>\n      </ul>')],
      ["promo_c", { type: "REORDER", index: 0 }, (c) => expect(c).toContain('<ul data-forge-id="promo_list">\n        <li data-forge-id="promo_c">Gift wrap</li>\n        <li data-forge-id="promo_a">')],
      ["promo_a", { type: "REMOVE" }, (c) => expect(c).not.toContain("promo_a")],
    ];
    for (const [elementId, mutation, check] of steps) {
      const res = await sync(elementId, mutation, { expectedRevision: version });
      expect(res.status, JSON.stringify(res.json)).toBe(200);
      expect(res.json).toMatchObject({ success: true, updated: true, diagnostics: [] });
      const file = await stored();
      expect(file.content).toBe(res.json.content);
      expect(file.version).toBe(version + 1);
      expect(res.json.version).toBe(file.version);
      expect(validateSourceSyntax(file.content, FILE).isValid).toBe(true);
      check(file.content);
      version = file.version;
    }

    const { content } = await stored();
    // Everything the edits did not address is exactly as the user wrote it.
    expect(content.slice(0, content.indexOf("return ("))).toBe(SOURCE.slice(0, SOURCE.indexOf("return (")));
    expect(content).toContain('      <p data-forge-id="promo_code">{shout(code)}</p>');
    expect(content).toContain('      <button onClick={() => setSeen(true)} data-forge-id="promo_dismiss">{seen ? "Seen" : "Dismiss"}</button>');
  });

  it("moves an element to another parent through the legacy element shape as well", async () => {
    const moved = await sync("promo_title", { type: "MOVE", parentId: "promo_list", index: 0 });
    expect(moved.status).toBe(200);
    expect((await stored()).content).toContain('<ul data-forge-id="promo_list">\n        <h2 data-forge-id="promo_title" title="Offer">Summer sale</h2>');

    const legacy = await api("POST", "/sync/visual-to-code", "owner", { filePath: FILE, element: { id: "promo_b", textContent: "Thirty-day returns" } });
    expect(legacy.status).toBe(200);
    expect(legacy.json.updated).toBe(true);
    expect((await stored()).content).toContain('<li data-forge-id="promo_b">Thirty-day returns</li>');
  });

  it("answers a no-op truthfully and does not write the file", async () => {
    const before = await stored();
    const res = await sync("promo_b", { type: "SET_TEXT", text: "Thirty-day returns" });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ success: true, updated: false, code: "NO_CHANGE", version: before.version });
    expect(await stored()).toEqual(before);
  });

  it("rejects unsupported, ambiguous and source-owned edits without touching the file", async () => {
    const before = await stored();
    for (const [elementId, mutation, code] of [
      ["promo_code", { type: "SET_TEXT", text: "STATIC" }, "SOURCE_OWNED"],
      ["promo_dismiss", { type: "REMOVE" }, "SOURCE_OWNED"],
      ["promo_dismiss", { type: "SET_PROP", name: "onClick", value: "x" }, "SOURCE_OWNED"],
      ["promo", { type: "REMOVE" }, "UNSUPPORTED"],
      ["promo_missing", { type: "SET_TEXT", text: "x" }, "TARGET_NOT_FOUND"],
      ["promo_b", { type: "SET_PROP", name: "href", value: "javascript:alert(1)" }, "INVALID_MUTATION"],
      ["promo_b", { type: "INSERT", parentId: "promo_list", element: { tag: "li" } }, "INVALID_MUTATION"],
      ["promo_b", { type: "TELEPORT" }, "UNSUPPORTED"],
    ] as Array<[string, unknown, string]>) {
      const res = await sync(elementId, mutation);
      expect(res.status, `${elementId} ${JSON.stringify(mutation)}`).toBe(422);
      expect(res.json).toMatchObject({ success: false, updated: false, code });
      expect(res.json.diagnostics[0]).toMatchObject({ severity: "error", code: `VISUAL_SYNC_${code}` });
      expect(res.json.content).toBe(before.content);
    }
    expect(await stored()).toEqual(before);
  });

  it("validates the request and enforces the expected revision", async () => {
    const before = await stored();
    expect((await api("POST", "/sync/visual-to-code", "owner", { element: { id: "promo_b" }, mutation: { type: "REMOVE" } })).status).toBe(400);
    expect((await api("POST", "/sync/visual-to-code", "owner", { filePath: FILE, mutation: { type: "REMOVE" } })).status).toBe(400);
    expect((await api("POST", "/sync/visual-to-code", "owner", { filePath: FILE, element: { id: "promo_b" } })).status).toBe(400);
    expect((await sync("promo_b", "REMOVE")).status).toBe(400);
    const stale = await sync("promo_b", { type: "SET_TEXT", text: "Stale" }, { expectedRevision: before.version - 1 });
    expect(stale.status).toBe(409);
    expect(await stored()).toEqual(before);
  });

  it("refuses to edit a file whose stored source no longer parses, or holds a duplicated id", async () => {
    const broken = "src/components/Broken.tsx";
    expect((await api("POST", "/files", "owner", { path: broken, content: `export const Broken = () => <div data-forge-id="b1">Hi</div>;\n` })).status).toBe(200);
    const duplicate = `export const Broken = () => <div data-forge-id="b0"><i data-forge-id="b1">A</i><i data-forge-id="b1">B</i></div>;\n`;
    expect((await api("POST", "/files", "owner", { path: broken, content: duplicate })).status).toBe(200);
    const ambiguous = await api("POST", "/sync/visual-to-code", "owner", { filePath: broken, element: { id: "b1" }, mutation: { type: "SET_TEXT", text: "x" } });
    expect(ambiguous.status).toBe(422);
    expect(ambiguous.json.code).toBe("AMBIGUOUS_TARGET");

    const { rowCount } = await pgPool.query(
      `UPDATE forge_project_files SET content = $3 WHERE "projectId" = $1 AND path = $2`,
      [projectId, broken, `export const Broken = () => <div data-forge-id="b1">Hi</span>;\n`]
    );
    expect(rowCount).toBe(1);
    const invalid = await api("POST", "/sync/visual-to-code", "owner", { filePath: broken, element: { id: "b1" }, mutation: { type: "SET_TEXT", text: "x" } });
    expect(invalid.status).toBe(422);
    expect(invalid.json).toMatchObject({ success: false, updated: false, code: "INVALID_SOURCE" });
    expect((await stored(broken)).content).toContain("</span>");
  });

  it("edits a page the generator produced from the visual document", async () => {
    const { rows } = await pgPool.query(
      `SELECT path, content FROM forge_project_files WHERE "projectId" = $1 AND path LIKE 'src/pages/%.tsx' AND content LIKE '%data-forge-id="%' AND path <> $2 ORDER BY path LIMIT 1`,
      [projectId, FILE]
    );
    expect(rows.length, "the project should contain generated pages").toBe(1);
    const elementId = / data-forge-id="([\w-]+)"/.exec(rows[0].content)?.[1];
    expect(elementId).toBeTruthy();
    const res = await api("POST", "/sync/visual-to-code", "owner", {
      filePath: rows[0].path,
      element: { id: elementId },
      mutation: { type: "SET_CLASSES", add: ["forge-phase3-marker"] },
    });
    expect(res.status, JSON.stringify(res.json?.diagnostics)).toBe(200);
    expect(res.json.updated).toBe(true);
    const after = (await stored(rows[0].path)).content;
    // Exactly one class token was added to that element; the rest of the generated page is unchanged.
    const added = after.length - rows[0].content.length;
    expect([" forge-phase3-marker".length, ' className="forge-phase3-marker"'.length]).toContain(added);
    expect(after.split("forge-phase3-marker").length).toBe(2);
    const lines = (text: string) => text.split(/\r?\n/);
    const edited = lines(after).findIndex((l) => l.includes("forge-phase3-marker"));
    expect(lines(after)[edited]).toContain(`data-forge-id="${elementId}"`);
    expect(lines(after).filter((_, i) => i !== edited)).toEqual(lines(rows[0].content).filter((_, i) => i !== edited));
  });
});
