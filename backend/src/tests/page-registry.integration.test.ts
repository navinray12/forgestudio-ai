/**
 * Page registry behaviour on the persisted workspace (blueprint §36; FS21-AT-PAG-03, PAG-04,
 * PAG-07/08 (identity part), PAG-10 (delete part), PAG-11).
 *
 * Drives the real save and page handlers against the disposable database with a React project.
 * It does not cover the page selector UI, preview, Next.js projects, export or runtime probes, so
 * the scenarios above are evidenced only for the parts asserted here.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/page-registry.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

describe.skipIf(!optedIn)("Page registry on the persisted workspace (disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const projectSvc = await import("../services/project/forgeProject.service.js");
  const fs = await import("../services/project/forgeFilesystem.service.js");
  const controller = await import("../controllers/project.controller.js");
  const { buildWebsiteFixture } = await import("./fixtures/website-to-code.fixture.js");

  const marker = randomUUID().slice(0, 8);
  let user: { id: string; role: string };
  let websiteId = "";
  let projectId = "";

  async function call(handler: any, opts: { params?: any; body?: any; query?: any } = {}) {
    let status = 0;
    let payload: any;
    let error: any;
    const res: any = {
      locals: { user },
      status(c: number) { status = c; return res; },
      json(b: any) { payload = b; return res; },
    };
    await handler({ params: { id: projectId, ...(opts.params || {}) }, body: opts.body || {}, query: opts.query || {}, get: () => undefined }, res, (e: any) => { error = e; });
    return { status, payload, error };
  }

  const save = (path: string, content: string) => call(controller.writeFileHandler, { body: { path, content } });
  const pages = async () => (await call(controller.listPagesHandler)).payload.pages as any[];
  const site = () => prisma.website.findUnique({ where: { id: websiteId } });

  const REPORTS = "src/pages/ReportsPage.tsx";
  const reportsSource = `export default function ReportsPage() {
  return (
    <main>
      <h1>Quarterly reports</h1>
      <p>Figures are published each quarter.</p>
    </main>
  );
}
`;

  beforeAll(async () => {
    await ensureDatabaseTables();
    const created = await prisma.user.create({ data: { fullName: "Pages owner", email: `pages-${marker}@example.test`, status: "ACTIVE" } });
    user = { id: created.id, role: "USER" };
    const website = await prisma.website.create({
      data: { userId: user.id, name: `Pages ${marker}`, slug: `pages-${marker}`, editorData: buildWebsiteFixture() },
    });
    websiteId = website.id;
    projectId = ((await projectSvc.getOrCreateProjectForWebsite(websiteId, user)) as any).id;
  }, 60_000);

  afterAll(async () => {
    if (projectId) await pgPool.query(`DELETE FROM forge_projects WHERE id = $1`, [projectId]).catch(() => undefined);
    if (websiteId) await prisma.website.delete({ where: { id: websiteId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: `pages-${marker}@example.test` } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  });

  let reportsKey = "";

  it("PAG-03: a page file saved in the workspace registers one page without publishing anything", async () => {
    const before = await pages();
    const published = await site();
    const saved = await save(REPORTS, reportsSource);
    expect(saved.error).toBeUndefined();

    const after = await pages();
    const added = after.filter((p) => !before.some((b) => b.key === p.key));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ filePath: REPORTS, fileExists: true });
    expect(added[0].routePath).toBe("/reports");
    reportsKey = added[0].key;
    expect(JSON.stringify((await site())!.editorData)).toContain("Quarterly reports");

    // Saving it again does not create a second selector entry.
    await save(REPORTS, reportsSource.replace("each quarter", "every quarter"));
    expect((await pages()).filter((p) => p.filePath === REPORTS)).toHaveLength(1);

    // The draft changed; the public state did not.
    const now = await site();
    expect({ status: now!.status, publishedAt: (now as any).publishedAt ?? null })
      .toEqual({ status: published!.status, publishedAt: (published as any).publishedAt ?? null });
  }, 60_000);

  it("PAG-03/04: helpers, tests and stories never become pages because of their names", async () => {
    const before = (await pages()).map((p) => p.key).sort();
    for (const path of [
      "src/components/ReportsPageHelper.tsx",
      "src/pages/ReportsPage.test.tsx",
      "src/pages/ReportsPage.stories.tsx",
      "src/utils/aboutPage.ts",
      "src/hooks/usePage.ts",
    ]) {
      const saved = await save(path, `export const helper = ${JSON.stringify(path)};\n`);
      expect(saved.error, path).toBeUndefined();
      expect((await fs.readFile(projectId, path)).content).toContain(path);
    }
    expect((await pages()).map((p) => p.key).sort()).toEqual(before);
  }, 60_000);

  it("PAG-11: a page file the canvas cannot represent is kept exactly and not force-registered", async () => {
    const path = "src/pages/DashboardPage.tsx";
    const source = `import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [rows, setRows] = useState<string[]>([]);
  useEffect(() => { fetch("/api/rows").then((r) => r.json()).then(setRows); }, []);
  return <ul>{rows.map((row) => <li key={row}>{row}</li>)}</ul>;
}
`;
    const before = (await pages()).map((p) => p.key).sort();
    const saved = await save(path, source);
    expect(saved.error).toBeUndefined();
    expect((await fs.readFile(projectId, path)).content).toBe(source);
    expect((await pages()).map((p) => p.key).sort()).toEqual(before);
    expect(JSON.stringify((await site())!.editorData)).not.toContain("DashboardPage");
    expect(saved.payload.sync?.status).not.toBe("synced");
  }, 60_000);

  it("PAG-07/08: renaming a page keeps its identity and leaves a single selector entry", async () => {
    const renamed = await call(controller.updatePageHandler, { params: { pageId: reportsKey }, body: { name: "Insights", route: "/insights" } });
    expect(renamed.error).toBeUndefined();
    const list = await pages();
    const page = list.find((p) => p.key === reportsKey);
    expect(page).toMatchObject({ routePath: "/insights" });
    expect(list.filter((p) => p.routePath === "/reports")).toHaveLength(0);
    expect(list.filter((p) => p.key === reportsKey)).toHaveLength(1);
    expect(JSON.stringify((await site())!.editorData)).toContain("Quarterly reports");
  }, 60_000);

  it("PAG-10: deleting a page retires its route, keeps other source and refuses to delete the home page", async () => {
    const list = await pages();
    const home = list.find((p) => p.isHome)!;
    const refused = await call(controller.deletePageHandler, { params: { pageId: home.key } });
    expect(refused.error).toMatchObject({ code: "HOME_PAGE" });

    const helperBefore = (await fs.readFile(projectId, "src/components/ReportsPageHelper.tsx")).content;
    const deleted = await call(controller.deletePageHandler, { params: { pageId: reportsKey } });
    expect(deleted.error).toBeUndefined();
    expect((await pages()).some((p) => p.key === reportsKey)).toBe(false);
    expect(JSON.stringify((await site())!.editorData)).not.toContain("Quarterly reports");
    // Unrelated hand-written source survives the retirement.
    expect((await fs.readFile(projectId, "src/components/ReportsPageHelper.tsx")).content).toBe(helperBefore);
    expect((await fs.readFile(projectId, "src/pages/DashboardPage.tsx")).content).toContain("useEffect");
  }, 60_000);
});
