/**
 * Website-to-Code verification: project bridge, file persistence, regeneration
 * rules and the HTTP API (real routers, real auth middleware, in-memory database).
 * Run with: npm run test:website-to-code
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createMemoryDb, seedUserSession, readZip } from "./helpers/memoryDb.js";
import { buildWebsiteFixture } from "./fixtures/website-to-code.fixture.js";

const mem = vi.hoisted(() => ({ current: null as any }));

vi.mock("../config/prisma.js", async () => {
  const { createMemoryDb: create } = await import("./helpers/memoryDb.js");
  mem.current = create();
  return {
    prisma: mem.current.db,
    pgPool: { query: async () => ({ rows: [] }), end: async () => undefined, on: () => undefined },
  };
});

// Checkpoints and sync-state writes use PostgreSQL row locks in production; this suite's database
// is in memory, so the module is replaced by a contract-preserving in-memory version.
vi.mock("../services/workspace/workspaceCheckpoints.service.js", async (importOriginal) => {
  const real: any = await importOriginal();
  const { memoryCheckpointsModule } = await import("./helpers/memoryCheckpoints.js");
  return memoryCheckpointsModule(() => mem.current, real);
});

const store = () => mem.current as ReturnType<typeof createMemoryDb>;

const ALICE = { id: "11111111-1111-4111-8111-111111111111", role: "USER" };
const BOB = { id: "22222222-2222-4222-8222-222222222222", role: "USER" };
const ADMIN = { id: "33333333-3333-4333-8333-333333333333", role: "ADMIN" };
const SITE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_SITE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function seedWebsite(id: string, ownerId: string, editorData: any, name = "Acme Site") {
  const row = {
    id,
    userId: ownerId,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    workspaceId: null,
    organizationId: null,
    editorData,
  };
  store().table("website").push(row);
  return row;
}

const filesOf = (projectId: string) =>
  store()
    .table("forgeProjectFile")
    .filter((f) => f.projectId === projectId && !f.deletedAt);
const fileAt = (projectId: string, path: string) => filesOf(projectId).find((f) => f.path === path);

let services: {
  project: typeof import("../services/project/forgeProject.service.js");
  fs: typeof import("../services/project/forgeFilesystem.service.js");
  generator: typeof import("../services/generator/projectGenerator.service.js");
  compiler: typeof import("../services/compiler/unifiedCompiler.service.js");
};

beforeAll(async () => {
  services = {
    project: await import("../services/project/forgeProject.service.js"),
    fs: await import("../services/project/forgeFilesystem.service.js"),
    generator: await import("../services/generator/projectGenerator.service.js"),
    compiler: await import("../services/compiler/unifiedCompiler.service.js"),
  };
});

beforeEach(() => {
  store().reset();
});

describe("C. website -> project bridge and persistence", () => {
  it("provisions one project for the website and writes its generated files to that project only", async () => {
    seedWebsite(SITE_ID, ALICE.id, buildWebsiteFixture());
    seedWebsite(OTHER_SITE_ID, BOB.id, { elements: [{ id: "x", type: "heading", content: "Bob's site" }] }, "Bob Site");

    const project: any = await services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);
    const other: any = await services.project.getOrCreateProjectForWebsite(OTHER_SITE_ID, BOB);

    expect(project.websiteId).toBe(SITE_ID);
    expect(project.ownerId).toBe(ALICE.id);
    expect(project.visualSync).toEqual({ synced: true, stale: false });
    expect(other.id).not.toBe(project.id);

    const paths = filesOf(project.id).map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["package.json", "src/main.tsx", "src/pages/HomePage.tsx", "src/pages/AboutUsPage.tsx", "src/pages/ContactPage.tsx"]));
    expect(fileAt(project.id, "src/pages/HomePage.tsx")!.content).toContain("Build faster with Acme");
    // No cross-project leakage in either direction
    expect(filesOf(project.id).some((f) => f.content?.includes("Bob's site"))).toBe(false);
    expect(filesOf(other.id).some((f) => f.content?.includes("Build faster with Acme"))).toBe(false);
    expect(store().table("forgeProjectFile").every((f) => [project.id, other.id].includes(f.projectId))).toBe(true);
  });

  it("accepts editor data stored as a JSON string", async () => {
    seedWebsite(SITE_ID, ALICE.id, JSON.stringify(buildWebsiteFixture()));
    const project: any = await services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);
    expect(fileAt(project.id, "src/pages/AboutUsPage.tsx")!.content).toContain("Three levels deep and still here.");
  });

  it("reopening the workspace returns the same project and persisted files without rewriting them", async () => {
    seedWebsite(SITE_ID, ALICE.id, buildWebsiteFixture());
    const first: any = await services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);
    const before = filesOf(first.id).map((f) => [f.path, f.version, f.contentHash]);
    const revisions = store().table("forgeProjectRevision").length;

    const second: any = await services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);

    expect(second.id).toBe(first.id);
    expect(second.visualSync).toEqual({ synced: false, stale: false });
    expect(store().table("forgeProject")).toHaveLength(1);
    expect(filesOf(first.id).map((f) => [f.path, f.version, f.contentHash])).toEqual(before);
    expect(store().table("forgeProjectRevision")).toHaveLength(revisions);

    const tree = await services.fs.getProjectFileTree(first.id, false);
    expect(JSON.stringify(tree)).toContain("HomePage.tsx");
    expect((await services.fs.readFile(first.id, "src/pages/HomePage.tsx")).content).toContain("Build faster with Acme");
  });

  it("concurrent first opens create a single project", async () => {
    seedWebsite(SITE_ID, ALICE.id, buildWebsiteFixture());
    const [a, b, c]: any[] = await Promise.all([
      services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE),
      services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE),
      services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE),
    ]);
    expect(store().table("forgeProject")).toHaveLength(1);
    expect(new Set([a.id, b.id, c.id]).size).toBe(1);
  });

  it("the latest saved design reaches the project when the workspace is reopened", async () => {
    const site = seedWebsite(SITE_ID, ALICE.id, buildWebsiteFixture());
    const project: any = await services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);

    const edited = buildWebsiteFixture();
    edited.pages[0].elements[0].children[0].content = "Edited headline after save";
    edited.pages[0].elements[0].children.push({ id: "new-nested", type: "text", content: "Freshly added nested paragraph" });
    site.editorData = edited;

    const reopened: any = await services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);
    expect(reopened.visualSync).toEqual({ synced: true, stale: false });

    const home = fileAt(project.id, "src/pages/HomePage.tsx")!.content;
    expect(home).toContain("Edited headline after save");
    expect(home).toContain("Freshly added nested paragraph");
    expect(home).not.toContain("Build faster with Acme");
    // A recovery checkpoint was taken before the existing files were overwritten
    expect(store().table("forgeProjectSnapshot").some((s) => s.projectId === project.id)).toBe(true);
  });

  it("reports, rather than hides, a design that cannot be synced", async () => {
    seedWebsite(SITE_ID, ALICE.id, "{definitely not json");
    const project: any = await services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);
    expect(project.visualSync.stale).toBe(true);
    expect(project.visualSync.error).toMatch(/not valid JSON/);
    expect(filesOf(project.id)).toHaveLength(0);
  });
});

describe("C. regeneration preserves custom code", () => {
  async function bridged() {
    const site = seedWebsite(SITE_ID, ALICE.id, buildWebsiteFixture());
    const project: any = await services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);
    return { site, project };
  }

  const changeDesign = (site: any, headline: string) => {
    const doc = buildWebsiteFixture();
    doc.pages[0].elements[0].children[0].content = headline;
    site.editorData = doc;
  };

  it("keeps protected regions, user-created files and locked files across repeated regenerations", async () => {
    const { site, project } = await bridged();
    const pagePath = "src/pages/HomePage.tsx";

    // 1. Custom logic inside a protected region of a generated page
    const original = fileAt(project.id, pagePath)!.content as string;
    // "$1" / "$&" are replacement patterns: user code containing them must survive the merge verbatim
    const customised = original.replace(
      "  // Custom page logic, API hooks, and handlers\n",
      () => "  const price = '$1 & $& stay literal';\n  const [open, setOpen] = React.useState(false);\n"
    );
    expect(customised).not.toBe(original);
    await services.fs.writeFile(project.id, pagePath, { content: customised, authorId: ALICE.id });

    // 2. A file the user created
    await services.fs.writeFile(project.id, "src/lib/analytics.ts", { content: "export const track = () => {};\n", authorId: ALICE.id });

    // 3. A generated file the user locked after editing it
    await services.fs.writeFile(project.id, "src/App.tsx", { content: "// hand-written App\nexport default function App() { return null; }\n", isProtected: true, authorId: ALICE.id });

    // Regenerate three times with a changed design each time (the third used to be rejected as FILE_PROTECTED)
    for (const headline of ["Second headline", "Third headline", "Fourth headline"]) {
      changeDesign(site, headline);
      const reopened: any = await services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);
      expect(reopened.visualSync, `sync for "${headline}"`).toEqual({ synced: true, stale: false });
      const page = fileAt(project.id, pagePath)!.content as string;
      expect(page).toContain(headline);
      expect(page).toContain("const price = '$1 & $& stay literal';");
      expect(page).toContain("const [open, setOpen] = React.useState(false);");
    }

    expect(fileAt(project.id, "src/lib/analytics.ts")!.content).toBe("export const track = () => {};\n");
    expect(fileAt(project.id, "src/lib/analytics.ts")!.isGenerated).toBe(false);
    expect(fileAt(project.id, "src/App.tsx")!.content).toContain("hand-written App");
  });

  it("the explicit generate endpoint applies the same rules and reports what it did", async () => {
    const { site, project } = await bridged();
    await services.fs.writeFile(project.id, "src/lib/analytics.ts", { content: "export const track = () => {};\n", authorId: ALICE.id });
    changeDesign(site, "Generated headline");

    const plan = await services.generator.createGenerationPlan(project.id, "react", { scope: { type: "full" }, authorId: ALICE.id });
    const result = await services.generator.executeGeneration(project.id, plan, ALICE.id);

    expect(result.success).toBe(true);
    expect(result.filesMerged).toBeGreaterThan(0); // pages carry protected regions
    expect(result.filesPreserved).toBeGreaterThan(0); // unchanged scaffolding is not rewritten
    expect(fileAt(project.id, "src/pages/HomePage.tsx")!.content).toContain("Generated headline");
    expect(fileAt(project.id, "src/lib/analytics.ts")!.content).toBe("export const track = () => {};\n");
  });

  it("removes generated files for pages deleted in the editor, but never user files", async () => {
    const { site, project } = await bridged();
    await services.fs.writeFile(project.id, "src/pages/Legacy.tsx", { content: "export const Legacy = () => null;\n", authorId: ALICE.id });
    expect(fileAt(project.id, "src/pages/ContactPage.tsx")).toBeTruthy();

    const doc = buildWebsiteFixture();
    doc.pages = doc.pages.filter((p: any) => p.id !== "page-contact");
    site.editorData = doc;
    await services.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);

    expect(fileAt(project.id, "src/pages/ContactPage.tsx")).toBeUndefined();
    expect(fileAt(project.id, "src/routes/AppRoutes.tsx")!.content).not.toContain("ContactPage");
    expect(fileAt(project.id, "src/pages/Legacy.tsx")!.content).toContain("Legacy");
  });

  it("switching framework replaces the old scaffold so the new project can build", async () => {
    const { project } = await bridged();
    await services.fs.writeFile(project.id, "docs/notes.md", { content: "# keep me\n", authorId: ALICE.id });
    await services.fs.writeFile(project.id, "forge.manifest.json", { content: "{}", isGenerated: true, authorId: ALICE.id });

    const plan = await services.generator.createGenerationPlan(project.id, "nextjs", { scope: { type: "full" }, authorId: ALICE.id });
    const result = await services.generator.executeGeneration(project.id, plan, ALICE.id);
    expect(result.success).toBe(true);

    const paths = filesOf(project.id).map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["next.config.mjs", "app/layout.tsx", "app/page.tsx", "app/about/page.tsx", "docs/notes.md", "forge.manifest.json"]));
    // React-only files would break `next build` (they import react-router-dom and vite types)
    for (const stale of ["src/main.tsx", "src/routes/AppRoutes.tsx", "src/pages/HomePage.tsx", "vite.config.ts", "index.html", "src/vite-env.d.ts"]) {
      expect(paths, `${stale} should have been removed`).not.toContain(stale);
    }
    expect(store().table("forgeProject")[0].framework).toBe("nextjs");

    // And back again
    const back = await services.generator.executeGeneration(
      project.id,
      await services.generator.createGenerationPlan(project.id, "react", { scope: { type: "full" }, authorId: ALICE.id }),
      ALICE.id
    );
    expect(back.success).toBe(true);
    const after = filesOf(project.id).map((f) => f.path);
    expect(after).toContain("src/main.tsx");
    expect(after).not.toContain("app/page.tsx");
    expect(after).not.toContain("next.config.mjs");
  });

  it("a failed generation rolls every file back and reports failure", async () => {
    const { site, project } = await bridged();
    const before = Object.fromEntries(filesOf(project.id).map((f) => [f.path, f.content]));
    changeDesign(site, "This headline must not survive a failed generation");

    const plan = await services.generator.createGenerationPlan(project.id, "nextjs", { scope: { type: "full" }, authorId: ALICE.id });
    // Fail part-way through, after several files have already been written
    store().failNext("forgeProjectFile", "create", (args) => args.data.path === "app/about/page.tsx", "simulated storage outage");

    const result = await services.generator.executeGeneration(project.id, plan, ALICE.id);

    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(result.diagnostics.some((d) => d.severity === "error" && d.message.includes("simulated storage outage"))).toBe(true);
    expect(Object.fromEntries(filesOf(project.id).map((f) => [f.path, f.content]))).toEqual(before);
    expect(store().table("forgeProject")[0].framework).toBe("react");
  });

  it("rejects an unknown framework", async () => {
    const { project } = await bridged();
    await expect(services.generator.createGenerationPlan(project.id, "angular" as any, {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it("compilation surfaces generator failures instead of writing a placeholder project", async () => {
    const { project } = await bridged();
    const ir = services.compiler.visualDocumentToIR(buildWebsiteFixture(), { id: project.id, name: "x", slug: "x", framework: "react" });
    const broken = { ...ir, components: null as any };
    await expect(services.compiler.compileIRToSourceFilesAsync(broken)).rejects.toThrow();
  });
});

describe("E. HTTP API", () => {
  let server: Server;
  let base: string;
  let alice: string;
  let bob: string;
  let admin: string;

  beforeAll(async () => {
    const express = (await import("express")).default;
    const cookieParser = (await import("cookie-parser")).default;
    const { default: projectRoutes } = await import("../routes/project.routes.js");
    const { default: exportRoutes } = await import("../routes/export.routes.js");
    const { errorMiddleware } = await import("../middlewares/error.middleware.js");

    const app = express();
    app.use(express.json({ limit: "5mb" }));
    app.use(cookieParser());
    // Same mount points as src/app.ts
    app.use("/api/v1/projects", projectRoutes);
    app.use("/api/v1/websites", exportRoutes);
    app.use(errorMiddleware);

    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 120_000);

  afterAll(async () => {
    await new Promise((resolve) => server?.close(resolve));
  });

  beforeEach(() => {
    alice = seedUserSession(store(), ALICE);
    bob = seedUserSession(store(), BOB);
    admin = seedUserSession(store(), ADMIN);
    seedWebsite(SITE_ID, ALICE.id, buildWebsiteFixture());
  });

  const call = (path: string, token?: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });

  async function openWorkspace(token = alice) {
    const res = await call(`/api/v1/projects/website/${SITE_ID}`, token);
    expect(res.status).toBe(200);
    return (await res.json()).project;
  }

  it("rejects unauthenticated and invalid-token requests on every generation, file and export route", async () => {
    const project = await openWorkspace();
    const routes: Array<[string, string]> = [
      ["GET", `/api/v1/projects/website/${SITE_ID}`],
      ["GET", `/api/v1/projects/${project.id}/files`],
      ["GET", `/api/v1/projects/${project.id}/files/content?path=package.json`],
      ["POST", `/api/v1/projects/${project.id}/files`],
      ["POST", `/api/v1/projects/${project.id}/compile`],
      ["POST", `/api/v1/projects/${project.id}/generate/react`],
      ["POST", `/api/v1/projects/${project.id}/generate/next`],
      ["GET", `/api/v1/projects/${project.id}/generate/plan?framework=react`],
      ["POST", `/api/v1/projects/${project.id}/generate/scope`],
      ["GET", `/api/v1/projects/${project.id}/export/zip`],
      ["GET", `/api/v1/websites/${SITE_ID}/export/zip?type=react`],
      ["GET", `/api/v1/websites/${SITE_ID}/export/preview`],
    ];
    for (const [method, path] of routes) {
      const body = method === "POST" ? JSON.stringify({}) : undefined;
      expect((await call(path, undefined, { method, body })).status, `${method} ${path} without a session`).toBe(401);
      expect((await call(path, "not-a-real-session", { method, body })).status, `${method} ${path} with a bad token`).toBe(401);
    }
  });

  it("opens the workspace for the owner with generated files in the tree", async () => {
    const project = await openWorkspace();
    expect(project.websiteId).toBe(SITE_ID);
    expect(project.visualSync).toEqual({ synced: true, stale: false });

    const tree = await (await call(`/api/v1/projects/${project.id}/files`, alice)).json();
    expect(tree.success).toBe(true);
    expect(JSON.stringify(tree.tree)).toContain("src/pages/HomePage.tsx");

    const file = await (await call(`/api/v1/projects/${project.id}/files/content?path=src/pages/HomePage.tsx`, alice)).json();
    expect(file.file.content).toContain("Build faster with Acme");
  });

  it("isolates tenants: another user cannot bridge, read, write, generate or export", async () => {
    const project = await openWorkspace();

    // Bridging someone else's website must not return (or create) a project - also when one already exists
    expect((await call(`/api/v1/projects/website/${SITE_ID}`, bob)).status).toBe(403);

    const denied: Array<[string, string, any?]> = [
      ["GET", `/api/v1/projects/${project.id}`],
      ["GET", `/api/v1/projects/${project.id}/files`],
      ["GET", `/api/v1/projects/${project.id}/files/content?path=package.json`],
      ["POST", `/api/v1/projects/${project.id}/files`, { path: "src/pwned.ts", content: "x" }],
      ["DELETE", `/api/v1/projects/${project.id}/files?path=package.json`],
      ["POST", `/api/v1/projects/${project.id}/compile`, {}],
      ["POST", `/api/v1/projects/${project.id}/generate/react`, {}],
      ["POST", `/api/v1/projects/${project.id}/generate/next`, {}],
      ["GET", `/api/v1/projects/${project.id}/generate/plan?framework=react`],
      ["POST", `/api/v1/projects/${project.id}/generate/scope`, { framework: "react", scope: { type: "full" } }],
      ["GET", `/api/v1/projects/${project.id}/export/zip`],
    ];
    for (const [method, path, body] of denied) {
      const res = await call(path, bob, { method, body: body ? JSON.stringify(body) : undefined });
      expect(res.status, `${method} ${path} as another user`).toBe(403);
    }
    expect((await call(`/api/v1/websites/${SITE_ID}/export/zip?type=react`, bob)).status).toBe(404);
    expect((await call(`/api/v1/websites/${SITE_ID}/export/preview`, bob)).status).toBe(404);

    expect(fileAt(project.id, "src/pwned.ts")).toBeUndefined();
    expect(fileAt(project.id, "package.json")).toBeTruthy();
    expect(store().table("forgeProject")).toHaveLength(1);

    // Platform admins retain access
    expect((await call(`/api/v1/projects/${project.id}/files`, admin)).status).toBe(200);
  });

  it("returns 404 for missing websites and projects", async () => {
    const missing = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    expect((await call(`/api/v1/projects/website/${missing}`, alice)).status).toBe(404);
    expect((await call(`/api/v1/projects/${missing}/files`, alice)).status).toBe(404);
    expect((await call(`/api/v1/projects/${missing}/generate/react`, alice, { method: "POST", body: "{}" })).status).toBe(404);
    expect((await call(`/api/v1/projects/${missing}/export/zip`, alice)).status).toBe(404);
    expect((await call(`/api/v1/websites/${missing}/export/zip?type=react`, alice)).status).toBe(404);
  });

  it("blocks path traversal on file routes", async () => {
    const project = await openWorkspace();
    for (const path of ["../../etc/passwd", "..%2F..%2Fetc%2Fpasswd", "src/../../secret", "C:\\Windows\\win.ini"]) {
      const read = await call(`/api/v1/projects/${project.id}/files/content?path=${encodeURIComponent(path)}`, alice);
      expect([400, 403, 404], `read ${path} -> ${read.status}`).toContain(read.status);
      expect(read.status).not.toBe(200);
    }
    const write = await call(`/api/v1/projects/${project.id}/files`, alice, {
      method: "POST",
      body: JSON.stringify({ path: "../outside.txt", content: "x" }),
    });
    expect(write.status).toBe(403);
    expect(filesOf(project.id).some((f) => f.path.includes(".."))).toBe(false);
  });

  it("generates React then Next.js projects through the API and persists each file tree", async () => {
    const project = await openWorkspace();

    const react = await call(`/api/v1/projects/${project.id}/generate/react`, alice, { method: "POST", body: "{}" });
    expect(react.status).toBe(200);
    expect((await react.json()).result.plan.framework).toBe("react");
    expect(filesOf(project.id).map((f) => f.path)).toContain("src/routes/AppRoutes.tsx");

    const next = await call(`/api/v1/projects/${project.id}/generate/next`, alice, { method: "POST", body: "{}" });
    const nextBody = await next.json();
    expect(next.status).toBe(200);
    expect(nextBody.success).toBe(true);
    expect(nextBody.result.plan.routes.map((r: any) => r.path)).toEqual(["/", "/about", "/contact-us"]);
    const paths = filesOf(project.id).map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["next.config.mjs", "app/page.tsx", "app/about/page.tsx", "app/contact-us/page.tsx"]));
    expect(paths).not.toContain("src/routes/AppRoutes.tsx");
    expect(fileAt(project.id, "app/about/page.tsx")!.content).toContain("Three levels deep and still here.");

    const plan = await (await call(`/api/v1/projects/${project.id}/generate/plan?framework=nextjs`, alice)).json();
    expect(plan.plan.files.every((f: any) => f.action === "PRESERVE")).toBe(true);
    expect((await call(`/api/v1/projects/${project.id}/generate/plan?framework=svelte`, alice)).status).toBe(400);
  });

  it("does not report success when generation or compilation fails", async () => {
    const project = await openWorkspace();

    store().failNext("forgeProjectFile", "create", (args) => args.data.path === "app/layout.tsx", "simulated storage outage");
    const gen = await call(`/api/v1/projects/${project.id}/generate/next`, alice, { method: "POST", body: "{}" });
    const genBody = await gen.json();
    expect(gen.status).toBe(422);
    expect(genBody.success).toBe(false);
    expect(genBody.message).toContain("simulated storage outage");
    expect(genBody.result.rolledBack).toBe(true);
    expect(filesOf(project.id).map((f) => f.path)).not.toContain("app/page.tsx");

    const edited = buildWebsiteFixture();
    edited.pages.push({ id: "page-new", name: "Pricing", slug: "pricing", elements: [{ id: "pr", type: "heading", content: "Pricing" }] });
    store().table("website")[0].editorData = edited;
    store().failNext("forgeProjectFile", "create", (args) => args.data.path === "src/pages/PricingPage.tsx", "disk full");
    const compile = await call(`/api/v1/projects/${project.id}/compile`, alice, { method: "POST", body: "{}" });
    const compileBody = await compile.json();
    expect(compile.status).toBe(422);
    expect(compileBody.success).toBe(false);
    expect(compileBody.message).toContain("disk full");
  });

  it("exports the persisted project, including manual edits, as a valid ZIP", async () => {
    const project = await openWorkspace();
    await call(`/api/v1/projects/${project.id}/files`, alice, {
      method: "POST",
      body: JSON.stringify({ path: "src/lib/analytics.ts", content: "export const track = () => 'edited in workspace';\n" }),
    });
    await call(`/api/v1/projects/${project.id}/files`, alice, {
      method: "POST",
      body: JSON.stringify({ path: ".env", content: "API_SECRET_KEY=super-secret-value\n" }),
    });

    const res = await call(`/api/v1/projects/${project.id}/export/zip`, alice);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/zip");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="[a-zA-Z0-9_-]+-react\.zip"/);

    const entries = readZip(Buffer.from(await res.arrayBuffer()));
    const persisted = filesOf(project.id).filter((f) => f.path !== ".env");
    expect(entries.map((e) => e.name).sort()).toEqual(persisted.map((f) => f.path).sort());
    for (const file of persisted) {
      expect(entries.find((e) => e.name === file.path)!.data.toString("utf8")).toBe(file.content);
    }
    expect(entries.find((e) => e.name === "src/lib/analytics.ts")!.data.toString("utf8")).toContain("edited in workspace");
    expect(Buffer.concat(entries.map((e) => e.data)).toString("utf8")).not.toContain("super-secret-value");
  });

  it("exports React and Next.js website ZIPs separately, and rejects bad export types visibly", async () => {
    for (const [type, marker] of [["react", "src/routes/AppRoutes.tsx"], ["nextjs", "app/about/page.tsx"]] as const) {
      const res = await call(`/api/v1/websites/${SITE_ID}/export/zip?type=${type}`, alice);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/zip");
      const names = readZip(Buffer.from(await res.arrayBuffer())).map((e) => e.name);
      expect(names).toContain(marker);
      expect(names).toContain("package.json");
    }

    const bad = await call(`/api/v1/websites/${SITE_ID}/export/zip?type=angular`, alice);
    expect(bad.status).toBe(400);
    expect(bad.headers.get("content-type")).toContain("application/json");
    expect((await bad.json()).success).toBe(false);
  });

  it("refuses to export a project that has no files", async () => {
    store().table("website")[0].editorData = "{broken";
    const project = await openWorkspace();
    expect(project.visualSync.stale).toBe(true);
    const res = await call(`/api/v1/projects/${project.id}/export/zip`, alice);
    expect(res.status).toBe(409);
    expect((await res.json()).success).toBe(false);
  });

  it("faithfully synchronizes heading edits, nested element additions, and element/page deletions", async () => {
    // 1. Initial generation
    const project = await openWorkspace();
    expect(fileAt(project.id, "src/pages/HomePage.tsx")!.content).toContain("Build faster with Acme");

    // 2. Change page heading in visual website and save
    const updatedFixture = buildWebsiteFixture();
    const heroTitle = updatedFixture.pages[0].elements[0].children[0];
    heroTitle.textContent = "Welcome to Our New Brand";
    store().table("website")[0].editorData = updatedFixture;

    // 3. Reopening / syncing project updates the page source
    await services.project.syncProjectFromWebsite(project, store().table("website")[0], ALICE);
    expect(fileAt(project.id, "src/pages/HomePage.tsx")!.content).toContain("Welcome to Our New Brand");
    expect(fileAt(project.id, "src/pages/HomePage.tsx")!.content).not.toContain("Build faster with Acme");

    // 4. Add a nested element and verify it appears in generated source
    updatedFixture.pages[0].elements[0].children.push({
      id: "nested-promo-banner",
      type: "paragraph",
      textContent: "Summer Sale 50% Off!",
      classes: ["text-red-500", "font-bold"],
      styles: {},
      children: [],
    });
    store().table("website")[0].editorData = updatedFixture;
    await services.project.syncProjectFromWebsite(project, store().table("website")[0], ALICE);
    expect(fileAt(project.id, "src/pages/HomePage.tsx")!.content).toContain("Summer Sale 50% Off!");

    // 5. Remove an element and verify obsolete content disappears
    updatedFixture.pages[0].elements[0].children = updatedFixture.pages[0].elements[0].children.filter(
      (c: any) => c.id !== "nested-promo-banner"
    );
    store().table("website")[0].editorData = updatedFixture;
    await services.project.syncProjectFromWebsite(project, store().table("website")[0], ALICE);
    expect(fileAt(project.id, "src/pages/HomePage.tsx")!.content).not.toContain("Summer Sale 50% Off!");

    // 6. Remove an entire page (Contact Us) and verify stale file is safely deleted
    expect(fileAt(project.id, "src/pages/ContactPage.tsx")).toBeDefined();
    updatedFixture.pages = updatedFixture.pages.filter((p: any) => p.id !== "page-contact");
    store().table("website")[0].editorData = updatedFixture;
    await services.project.syncProjectFromWebsite(project, store().table("website")[0], ALICE);
    expect(fileAt(project.id, "src/pages/ContactPage.tsx")).toBeUndefined();
  });
});
