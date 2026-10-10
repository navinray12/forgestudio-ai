/**
 * Visual Editor <-> Code Workspace synchronisation: one project, edited from
 * both sides. Covers the page registry, code -> visual reconciliation, the page
 * workflow, conflict handling, the source preview and the ZIP export.
 * Real services, routers and auth middleware; in-memory database.
 * Run with: npm run test:website-to-code
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { transformSync } from "esbuild";
import { createMemoryDb, seedUserSession, readZip } from "./helpers/memoryDb.js";
import { buildWebsiteFixture } from "./fixtures/website-to-code.fixture.js";

const mem = vi.hoisted(() => ({ current: null as any, failNextDocumentWrite: false }));

vi.mock("../config/prisma.js", async () => {
  const { createMemoryDb: create } = await import("./helpers/memoryDb.js");
  mem.current = create();
  return {
    prisma: mem.current.db,
    pgPool: { query: async () => ({ rows: [] }), end: async () => undefined, on: () => undefined },
  };
});

// The real gateway runs the editor's save command (PostgreSQL transaction, permissions,
// journal). Its contract is kept here: the write succeeds only at the expected version.
vi.mock("../services/websites/documentGateway.js", async () => {
  const { AppError } = await import("../utils/app-error.js");
  return {
    saveDocumentFromCode: async (websiteId: string, _actorId: string, editorData: unknown, expectedVersion: number) => {
      const row = mem.current.table("website").find((r: any) => r.id === websiteId);
      if (!row) throw new AppError("Website not found", 404, "NOT_FOUND");
      const current = row.documentVersion ?? 1;
      if (mem.failNextDocumentWrite || current !== expectedVersion) {
        mem.failNextDocumentWrite = false;
        throw new AppError("The website changed after you loaded it.", 412, "DOCUMENT_VERSION_CONFLICT");
      }
      row.editorData = JSON.parse(JSON.stringify(editorData));
      row.documentVersion = current + 1;
      return { documentVersion: row.documentVersion };
    },
  };
});

const store = () => mem.current as ReturnType<typeof createMemoryDb>;

const ALICE = { id: "11111111-1111-4111-8111-111111111111", role: "USER" };
const BOB = { id: "22222222-2222-4222-8222-222222222222", role: "USER" };
const SITE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type Framework = "react" | "nextjs";

let svc: {
  project: typeof import("../services/project/forgeProject.service.js");
  fs: typeof import("../services/project/forgeFilesystem.service.js");
  generator: typeof import("../services/generator/projectGenerator.service.js");
  compiler: typeof import("../services/compiler/unifiedCompiler.service.js");
  sync: typeof import("../services/compiler/visualCodeSync.service.js");
  registry: typeof import("../services/compiler/pageRegistry.js");
  pages: typeof import("../services/project/projectPages.service.js");
  preview: typeof import("../services/preview/sourcePreview.service.js");
  react: typeof import("../services/generator/reactGenerator.service.js");
  next: typeof import("../services/generator/nextjsGenerator.service.js");
};

beforeAll(async () => {
  svc = {
    project: await import("../services/project/forgeProject.service.js"),
    fs: await import("../services/project/forgeFilesystem.service.js"),
    generator: await import("../services/generator/projectGenerator.service.js"),
    compiler: await import("../services/compiler/unifiedCompiler.service.js"),
    sync: await import("../services/compiler/visualCodeSync.service.js"),
    registry: await import("../services/compiler/pageRegistry.js"),
    pages: await import("../services/project/projectPages.service.js"),
    preview: await import("../services/preview/sourcePreview.service.js"),
    react: await import("../services/generator/reactGenerator.service.js"),
    next: await import("../services/generator/nextjsGenerator.service.js"),
  };
}, 120_000);

vi.setConfig({ testTimeout: 60_000 });

beforeEach(() => {
  store().reset();
  mem.failNextDocumentWrite = false;
});

// ------------------------------------------------------------------ helpers

function seedWebsite(editorData: any, name = "Acme Site") {
  const row = {
    id: SITE_ID,
    userId: ALICE.id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    workspaceId: null,
    organizationId: null,
    documentVersion: 1,
    editorData,
  };
  store().table("website").push(row);
  return row;
}

const site = () => store().table("website").find((r) => r.id === SITE_ID)!;
const doc = () => site().editorData as any;
const projectRow = () => store().table("forgeProject")[0];
const filesOf = (projectId: string) =>
  store()
    .table("forgeProjectFile")
    .filter((f) => f.projectId === projectId && !f.deletedAt);
const fileAt = (projectId: string, path: string) => filesOf(projectId).find((f) => f.path === path);
const sourceOf = (projectId: string, path: string) => {
  const file = fileAt(projectId, path);
  if (!file) throw new Error(`No persisted file '${path}'. Have: ${filesOf(projectId).map((f) => f.path).join(", ")}`);
  return file.content as string;
};

/** Open the Code Workspace for the website, optionally as a Next.js project */
async function openWorkspace(framework: Framework = "react") {
  let project: any = await svc.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);
  expect(project.visualSync.stale, project.visualSync.error).toBe(false);
  if (framework === "nextjs") {
    const plan = await svc.generator.createGenerationPlan(project.id, "nextjs", { scope: { type: "full" }, authorId: ALICE.id });
    expect((await svc.generator.executeGeneration(project.id, plan, ALICE.id)).success).toBe(true);
    project = projectRow();
  }
  return project;
}

/** What the Code Workspace does on Ctrl+S: persist the file, then reconcile it */
async function saveCode(project: any, path: string, edit: (source: string) => string) {
  const before = sourceOf(project.id, path);
  const edited = edit(before);
  expect(edited, `the edit to ${path} changed nothing`).not.toBe(before);
  await svc.fs.writeFile(project.id, path, { content: edited, authorId: ALICE.id });
  const result = await svc.sync.syncSourceToVisualWebsite(project.id, SITE_ID, path, ALICE.id);
  return { result, edited };
}

/** What a Visual Editor save does once the website has a developer project */
async function saveVisual(mutate: (document: any) => void) {
  const next = JSON.parse(JSON.stringify(doc()));
  mutate(next);
  site().editorData = next;
  site().documentVersion = (site().documentVersion ?? 1) + 1;
  return svc.project.syncBridgedProjectForWebsite(SITE_ID, ALICE, { snapshot: false });
}

function findElement(list: any[], id: string): any {
  for (const el of list || []) {
    if (!el || typeof el !== "object") continue;
    if (el.id === id) return el;
    const found = findElement(el.children, id) || findElement(el.elements, id);
    if (found) return found;
  }
  return undefined;
}

function findByText(list: any[], text: string): any {
  for (const el of list || []) {
    if (!el || typeof el !== "object") continue;
    if ([el.content, el.textContent, el.text, el.buttonText].includes(text)) return el;
    const found = findByText(el.children, text) || findByText(el.elements, text);
    if (found) return found;
  }
  return undefined;
}

const pageOf = (id: string) => doc().pages.find((p: any) => p.id === id);

/** Every generated module parses, and every relative import points at a persisted file */
function assertProjectIsCoherent(projectId: string, framework: Framework) {
  const files = filesOf(projectId);
  const paths = new Set(files.map((f) => f.path));
  const resolve = (from: string, spec: string) => {
    const base = spec.startsWith("@/")
      ? `${framework === "nextjs" ? "" : "src/"}${spec.slice(2)}`
      : new URL(spec, `file:///${from}`).pathname.slice(1);
    return [base, `${base}.tsx`, `${base}.ts`, `${base}.css`, `${base}/index.tsx`, `${base}/index.ts`].some((p) => paths.has(p));
  };
  for (const file of files) {
    if (!/\.(tsx|ts)$/.test(file.path)) continue;
    try {
      transformSync(file.content, { loader: file.path.endsWith(".tsx") ? "tsx" : "ts", jsx: "automatic", logLevel: "silent" });
    } catch (err: any) {
      throw new Error(`${file.path} does not parse: ${err.message}`);
    }
    for (const match of String(file.content).matchAll(/from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)) {
      const spec = match[1] || match[2];
      if (spec.startsWith(".") || spec.startsWith("@/")) {
        expect(resolve(file.path, spec), `${file.path} imports '${spec}', which is not in the project`).toBe(true);
      }
    }
  }
}

const HOME = { react: "src/pages/HomePage.tsx", nextjs: "app/page.tsx" } as const;
const ABOUT = { react: "src/pages/AboutUsPage.tsx", nextjs: "app/about/page.tsx" } as const;

// =========================================================================
// 1. Empty canvas
// =========================================================================
describe("1. empty canvas", () => {
  it.each(["react", "nextjs"] as const)("%s: generates a page with no fabricated visual content", async (framework) => {
    seedWebsite({ elements: [] });
    const project = await openWorkspace(framework);
    const page = sourceOf(project.id, HOME[framework]);

    // The page root exists and is empty: nothing is rendered that the canvas does not hold
    expect(page).toMatch(/data-forge-id="root_main"><\/div>/);
    for (const invented of ["EmptyState", "Welcome", "Lorem", "ready for your", "Get Started", "<h1", "<p"]) {
      expect(page, `fabricated "${invented}"`).not.toContain(invented);
    }
    expect(svc.registry.buildPageRegistry(doc(), framework)).toHaveLength(1);
    assertProjectIsCoherent(project.id, framework);

    // Saving the untouched file changes nothing in the (empty) visual document
    const again = await svc.sync.syncSourceToVisualWebsite(project.id, SITE_ID, HOME[framework], ALICE.id);
    expect(again.status).toBe("unchanged");
    expect(doc().elements).toEqual([]);
  });
});

// =========================================================================
// 2. Dynamic naming and minimal structure
// =========================================================================
describe("2. file structure and naming follow the actual pages", () => {
  const namedPages = () => ({
    pages: [
      { id: "p-home", name: "Welcome", slug: "/", isHome: true, elements: [{ id: "w", type: "heading", content: "Welcome" }] },
      { id: "p-about", name: "About Us", slug: "/about", elements: [{ id: "a", type: "heading", content: "About" }] },
      { id: "p-about-page", name: "About Us Page", slug: "/about-page", elements: [] },
      { id: "p-dup", name: "About Us", slug: "/about", elements: [] },
      { id: "p-404", name: "404", slug: "/missing", elements: [] },
      { id: "p-new", name: "new", slug: "/new", elements: [] },
      { id: "p-symbols", name: "***", slug: "", elements: [] },
      { id: "p-api", name: "Api", slug: "/api/status", elements: [] },
    ],
  });

  it("derives component, file and route from each page, resolving collisions and invalid identifiers", () => {
    const react = svc.registry.buildPageRegistry(namedPages(), "react");
    expect(react.map((p) => [p.name, p.routePath, p.filePath])).toEqual([
      ["Welcome", "/", "src/pages/WelcomePage.tsx"],
      ["About Us", "/about", "src/pages/AboutUsPage.tsx"],
      ["About Us Page", "/about-page", "src/pages/AboutUsPage2Page.tsx"],
      ["About Us", "/about-2", "src/pages/AboutUs2Page.tsx"],
      ["404", "/missing", "src/pages/Page404Page.tsx"],
      ["new", "/new", "src/pages/PageNewPage.tsx"],
      ["***", "/page7", "src/pages/Page7Page.tsx"],
      ["Api", "/page-api/status", "src/pages/ApiPage.tsx"],
    ]);
    // No two pages share a file (case-insensitively) or a route
    expect(new Set(react.map((p) => p.filePath.toLowerCase())).size).toBe(react.length);
    expect(new Set(react.map((p) => p.routePath)).size).toBe(react.length);

    const next = svc.registry.buildPageRegistry(namedPages(), "nextjs");
    expect(next.map((p) => p.filePath)).toEqual([
      "app/page.tsx",
      "app/about/page.tsx",
      "app/about-page/page.tsx",
      "app/about-2/page.tsx",
      "app/missing/page.tsx",
      "app/new/page.tsx",
      "app/page7/page.tsx",
      "app/page-api/status/page.tsx",
    ]);
  });

  it.each(["react", "nextjs"] as const)("%s: the registry, the generated files and the route table agree", async (framework) => {
    const ir = svc.compiler.visualDocumentToIR(namedPages(), { id: "p", name: "Named", slug: "named", framework });
    const plan = framework === "react" ? await svc.react.buildReactGenerationPlan(ir) : await svc.next.buildNextJsGenerationPlan(ir);
    const registry = svc.registry.buildPageRegistry(namedPages(), framework);

    expect(plan.routes.map((r) => [r.path, r.file])).toEqual(registry.map((p) => [p.routePath, p.filePath]));
    for (const page of registry) {
      const file = plan.files.find((f) => f.path === page.filePath);
      expect(file, `${page.filePath} is generated`).toBeTruthy();
      expect(file!.content).toContain(page.componentName);
    }
    if (framework === "react") {
      const routes = plan.files.find((f) => f.path === "src/routes/AppRoutes.tsx")!.content;
      for (const page of registry) {
        expect(routes).toContain(`import ${page.componentName} from '../pages/${page.componentName}';`);
        expect(routes).toContain(`<Route path="${page.routePath}" element={<${page.componentName} />} />`);
      }
    }
  });

  it.each(["react", "nextjs"] as const)("%s: only the files the project needs are persisted, and they fit together", async (framework) => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace(framework);
    const paths = filesOf(project.id).map((f) => f.path).sort();
    const pageFiles = svc.registry.buildPageRegistry(doc(), framework).map((p) => p.filePath);

    expect(paths).toEqual(expect.arrayContaining(pageFiles));
    // No page-like file exists that is not a registered page
    const pageLike = paths.filter((p) =>
      framework === "react" ? /^src\/pages\/.*\.tsx$/.test(p) && p !== "src/pages/NotFoundPage.tsx" : /^app\/(.*\/)?page\.tsx$/.test(p)
    );
    expect(pageLike.sort()).toEqual([...pageFiles].sort());
    for (const unused of ["src/contexts/AppContext.tsx", "src/hooks/useApi.ts", "src/components/EmptyState.tsx", "src/tests/App.test.tsx"]) {
      expect(paths).not.toContain(unused);
    }
    // The other framework's scaffold is not left behind
    expect(paths.some((p) => (framework === "react" ? p.startsWith("app/") || p === "next.config.mjs" : p.startsWith("src/") || p === "vite.config.ts"))).toBe(false);
    assertProjectIsCoherent(project.id, framework);
  });
});

// =========================================================================
// 3. Visual Editor -> Code Workspace
// =========================================================================
describe("3. a Visual Editor save updates the persisted source", () => {
  it.each(["react", "nextjs"] as const)("%s: text, nesting, styles, links, element removal and new pages reach the files", async (framework) => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace(framework);
    const linkAttr = framework === "react" ? "to" : "href";

    const result = await saveVisual((d) => {
      const hero = d.pages[0].elements[0];
      hero.children[0].content = "A headline edited on the canvas";
      hero.styles.paddingTop = "72px";
      hero.children.push({ id: "nested-note", type: "text", content: "Nested paragraph from the canvas" });
      hero.children = hero.children.filter((c: any) => c.id !== "hero-image");
      const cta = findElement(d.pages[0].elements, "hero-cta");
      cta.pageId = "page-contact";
      d.pages.push({ id: "page-pricing", name: "Pricing", slug: "/pricing", elements: [{ id: "pr", type: "heading", content: "Plans" }] });
    });
    expect(result).toMatchObject({ synced: true, stale: false });

    const home = sourceOf(project.id, HOME[framework]);
    expect(home).toContain("A headline edited on the canvas");
    expect(home).not.toContain("Build faster with Acme");
    expect(home).toContain(`paddingTop: "72px"`);
    expect(home).toMatch(/data-forge-id="hero"[\s\S]*data-forge-id="nested-note">Nested paragraph from the canvas/);
    expect(home).not.toContain("hero-image");
    expect(home).toContain(`<Link ${linkAttr}="/contact-us"`);

    const pricingPath = framework === "react" ? "src/pages/PricingPage.tsx" : "app/pricing/page.tsx";
    expect(sourceOf(project.id, pricingPath)).toContain("Plans");
    if (framework === "react") {
      expect(sourceOf(project.id, "src/routes/AppRoutes.tsx")).toContain(`<Route path="/pricing" element={<PricingPage />} />`);
    }
    assertProjectIsCoherent(project.id, framework);

    // Deleting the page removes its file and route again
    await saveVisual((d) => {
      d.pages = d.pages.filter((p: any) => p.id !== "page-pricing");
    });
    expect(fileAt(project.id, pricingPath)).toBeUndefined();
    if (framework === "react") expect(sourceOf(project.id, "src/routes/AppRoutes.tsx")).not.toContain("Pricing");
    assertProjectIsCoherent(project.id, framework);
  });

  it("does not report success when generation fails, and catches up on the next save", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();

    store().failNext("forgeProjectFile", "create", (args) => args.data.path === "src/pages/PricingPage.tsx", "disk full");
    const failed = await saveVisual((d) => {
      d.pages.push({ id: "page-pricing", name: "Pricing", slug: "/pricing", elements: [] });
    });
    expect(failed).toMatchObject({ synced: false, stale: true });
    expect(failed!.error).toContain("disk full");

    // The failure is not forgotten: the source is still known to be out of date
    const retried = await svc.project.syncBridgedProjectForWebsite(SITE_ID, ALICE, { snapshot: false });
    expect(retried).toMatchObject({ synced: true, stale: false });
    expect(fileAt(project.id, "src/pages/PricingPage.tsx")).toBeTruthy();
  });

  it("a website without a developer project is left alone", async () => {
    seedWebsite(buildWebsiteFixture());
    expect(await svc.project.syncBridgedProjectForWebsite(SITE_ID, ALICE)).toBeNull();
    expect(store().table("forgeProject")).toHaveLength(0);
  });
});

// =========================================================================
// 4. Code Workspace -> Visual Editor
// =========================================================================
describe("4. a Code Workspace save updates the visual document", () => {
  it.each(["react", "nextjs"] as const)("%s: untouched generated source round-trips to an identical document", async (framework) => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace(framework);
    const before = JSON.stringify(doc());

    for (const page of svc.registry.buildPageRegistry(doc(), framework)) {
      const result = await svc.sync.syncSourceToVisualWebsite(project.id, SITE_ID, page.filePath, ALICE.id);
      expect(result.status, `${page.filePath}: ${JSON.stringify(result.diagnostics)}`).toBe("unchanged");
    }
    expect(JSON.stringify(doc())).toBe(before);
    expect(site().documentVersion).toBe(1);
  });

  it.each(["react", "nextjs"] as const)("%s: text, new elements, nesting, styles, links and deletions are applied", async (framework) => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace(framework);
    const path = HOME[framework];
    const linkAttr = framework === "react" ? "to" : "href";

    const { result } = await saveCode(project, path, (src) =>
      src
        // text
        .replace("Build faster with Acme", "Typed in the code editor")
        // style: an inline value, and a Tailwind utility that came from a style
        .replace(`paddingTop: "48px"`, `paddingTop: "64px"`)
        .replace(/(data-forge-id="hero-title")/, `$1`)
        .replace(/className="hero-title ([^"]*)font-bold([^"]*)"/, (_m, a, b) => `className="hero-title ${a}${b} tracking-tight"`)
        // link target of a page-linked button
        .replace(new RegExp(`(<Link ${linkAttr}=")/about("[^>]*data-forge-id="hero-cta")`), `$1/contact-us$2`)
        // a new nested element, without an id
        .replace(/(\n\s*)(<div[^>]*data-forge-id="hero-row")/, `$1<section className="callout">$1  <h3>Added in code</h3>$1  <p>Nested paragraph</p>$1</section>$1$2`)
        // delete an element
        .replace(/\n\s*<(?:img|Image)[^>]*data-forge-id="hero-image"[^>]*\/>/, "")
    );

    expect(result.status, JSON.stringify(result.diagnostics)).toBe("synced");
    expect(result.success).toBe(true);
    expect(site().documentVersion).toBe(2);

    const elements = pageOf("page-home").elements;
    const title = findElement(elements, "hero-title");
    expect(title.content).toBe("Typed in the code editor");
    expect(title.styles).toMatchObject({ color: "#0f172a", fontSize: "32px", lineHeight: "1.2" });
    expect(title.styles.fontWeight).toBeUndefined();
    expect(title.classes).toEqual(["hero-title", "tracking-tight"]);
    expect(title.headingLevel).toBe("h1");

    expect(findElement(elements, "hero").styles.paddingTop).toBe("64px");
    expect(findElement(elements, "hero").layout).toEqual({ direction: "column", justifyContent: "center", alignItems: "stretch", gap: 10 });
    expect(findElement(elements, "hero-cta")).toMatchObject({ linkType: "page", pageId: "page-contact", buttonText: "Read our story" });
    expect(findElement(elements, "hero-image")).toBeUndefined();

    const callout = findElement(elements, "hero").children.find((el: any) => el.htmlTag === "section");
    expect(callout).toMatchObject({ type: "container", classes: ["callout"] });
    expect(callout.children.map((c: any) => [c.type, c.content, c.headingLevel])).toEqual([
      ["heading", "Added in code", "h3"],
      ["text", "Nested paragraph", undefined],
    ]);
    // It sits where the code put it: before the button row
    const order = findElement(elements, "hero").children.map((c: any) => c.id);
    expect(order.indexOf(callout.id)).toBe(order.indexOf("hero-row") - 1);

    // The persisted source is regenerated from the document: same content, ids assigned
    const regenerated = sourceOf(project.id, path);
    expect(result.updatedFiles).toContain(path);
    expect(regenerated).toContain("Typed in the code editor");
    expect(regenerated).toContain(`data-forge-id="${callout.id}"`);
    expect(regenerated).toMatch(new RegExp(`<section className="callout" data-forge-id="${callout.id}">`));
    assertProjectIsCoherent(project.id, framework);

    // Stable: reconciling the regenerated file again changes nothing
    const again = await svc.sync.syncSourceToVisualWebsite(project.id, SITE_ID, path, ALICE.id);
    expect(again.status).toBe("unchanged");
    expect(site().documentVersion).toBe(2);
  });

  it("an edit to the shared header in one page file applies to every page", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();

    const { result } = await saveCode(project, HOME.react, (src) => src.replace(">Contact</", ">Get in touch</"));
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("synced");
    expect(result.diagnostics.map((d) => d.code)).toContain("SHARED_HEADER_UPDATED");

    const items = doc().siteParts.header.elements[0].navMenuItems;
    expect(items.map((i: any) => i.label)).toEqual(["Home", "About", "Get in touch", "Docs"]);
    expect(items[1]).toMatchObject({ linkType: "page", pageId: "page-about" });
    for (const path of [HOME.react, ABOUT.react, "src/pages/ContactPage.tsx"]) {
      expect(sourceOf(project.id, path)).toContain(">Get in touch</");
    }
    expect(result.updatedFiles).toEqual(expect.arrayContaining([ABOUT.react, "src/pages/ContactPage.tsx"]));
  });

  it("custom logic inside a protected region is kept, and does not block synchronisation", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();

    const { result } = await saveCode(project, HOME.react, (src) =>
      src
        .replace("  // Custom page logic, API hooks, and handlers\n", "  const [open, setOpen] = React.useState(false);\n  void open; void setOpen;\n")
        .replace("Build faster with Acme", "Headline with custom logic")
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("synced");
    expect(sourceOf(project.id, HOME.react)).toContain("const [open, setOpen] = React.useState(false);");

    // ...and it survives a later visual change to the same page
    await saveVisual((d) => {
      findElement(d.pages[0].elements, "hero-title").content = "Changed on the canvas afterwards";
    });
    const page = sourceOf(project.id, HOME.react);
    expect(page).toContain("Changed on the canvas afterwards");
    expect(page).toContain("const [open, setOpen] = React.useState(false);");
  });

  it("saving a component that is not a page does not touch the visual document", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();
    const before = JSON.stringify(doc());

    await svc.fs.writeFile(project.id, "src/components/Badge.tsx", {
      content: `export function Badge() {\n  return <span className="badge">New</span>;\n}\n`,
      authorId: ALICE.id,
    });
    const result = await svc.sync.syncSourceToVisualWebsite(project.id, SITE_ID, "src/components/Badge.tsx", ALICE.id);

    expect(result.status).toBe("not-a-page");
    expect(JSON.stringify(doc())).toBe(before);
    expect(svc.registry.buildPageRegistry(doc(), "react").map((p) => p.name)).toEqual(["Home", "About Us", "Contact"]);
  });
});

// =========================================================================
// 5 + 6. Pages: create, rename, delete; routes, file tree and imports
// =========================================================================
describe("5/6. page workflow keeps the registry, routes, files and imports in step", () => {
  it.each(["react", "nextjs"] as const)("%s: create, edit in code, rename and delete a page", async (framework) => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace(framework);

    // Create
    const created = await svc.pages.createProjectPage(projectRow(), ALICE, { name: "About The Team" });
    const pagePath = framework === "react" ? "src/pages/AboutTheTeamPage.tsx" : "app/about-the-team/page.tsx";
    expect(created.visualSync).toMatchObject({ synced: true, stale: false });
    expect(created.page).toMatchObject({ name: "About The Team", routePath: "/about-the-team", filePath: pagePath });

    // It is a real visual page: the Visual Editor's page list is the document's `pages`
    const visualPage = doc().pages.find((p: any) => p.name === "About The Team");
    expect(visualPage).toMatchObject({ slug: "/about-the-team", elements: [], isHome: false });
    expect(visualPage.pageSettings).toMatchObject({ title: "About The Team", path: "/about-the-team" });
    expect(fileAt(project.id, pagePath)).toBeTruthy();
    if (framework === "react") {
      expect(sourceOf(project.id, "src/routes/AppRoutes.tsx")).toContain(`<Route path="/about-the-team" element={<AboutTheTeamPage />} />`);
    }
    assertProjectIsCoherent(project.id, framework);

    // Fill it in from the Code Workspace, with custom logic in its protected region
    const marker = framework === "react" ? "  // Custom page logic, API hooks, and handlers\n" : "  // Custom server data fetching, actions, or client hooks\n";
    const { result } = await saveCode(project, pagePath, (src) =>
      src
        .replace(marker, "  const teamSize = 12; void teamSize;\n")
        .replace(/(\n\s*)(<p[^>]*data-forge-id="site-footer-text")/, `$1<h1>Meet the team</h1>$1<p>Written in code</p>$1$2`)
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("synced");
    const pageId = created.page!.pageId!;
    expect(pageOf(pageId).elements.map((el: any) => [el.type, el.content])).toEqual([
      ["heading", "Meet the team"],
      ["text", "Written in code"],
    ]);

    // Rename and re-route: the file moves and keeps its custom code
    const renamed = await svc.pages.updateProjectPage(projectRow(), ALICE, pageId, { name: "Team", route: "/team" });
    const renamedPath = framework === "react" ? "src/pages/TeamPage.tsx" : "app/team/page.tsx";
    expect(renamed.page).toMatchObject({ name: "Team", routePath: "/team", filePath: renamedPath });
    expect(fileAt(project.id, pagePath)).toBeUndefined();
    const moved = sourceOf(project.id, renamedPath);
    expect(moved).toContain("Meet the team");
    expect(moved).toContain("const teamSize = 12;");
    expect(pageOf(pageId)).toMatchObject({ name: "Team", slug: "/team" });
    if (framework === "react") {
      const routes = sourceOf(project.id, "src/routes/AppRoutes.tsx");
      expect(routes).toContain(`<Route path="/team" element={<TeamPage />} />`);
      expect(routes).not.toContain("AboutTheTeam");
    }
    assertProjectIsCoherent(project.id, framework);

    // Delete
    const deleted = await svc.pages.deleteProjectPage(projectRow(), ALICE, pageId);
    expect(deleted.visualSync).toMatchObject({ synced: true, stale: false });
    expect(pageOf(pageId)).toBeUndefined();
    expect(fileAt(project.id, renamedPath)).toBeUndefined();
    expect(deleted.pages.map((p) => p.name)).toEqual(["Home", "About Us", "Contact"]);
    if (framework === "react") expect(sourceOf(project.id, "src/routes/AppRoutes.tsx")).not.toContain("TeamPage");
    assertProjectIsCoherent(project.id, framework);

    // The persisted tree is exactly what the generator produces for the document
    const plan = await svc.generator.createGenerationPlan(project.id, framework, { scope: { type: "full" }, authorId: ALICE.id });
    expect(plan.files.every((f) => f.action === "PRESERVE"), JSON.stringify(plan.files.filter((f) => f.action !== "PRESERVE").map((f) => [f.path, f.action]))).toBe(true);
  });

  it("refuses route and name collisions, and protects the home page", async () => {
    seedWebsite(buildWebsiteFixture());
    await openWorkspace();
    const before = JSON.stringify(doc());

    await expect(svc.pages.createProjectPage(projectRow(), ALICE, { name: "Our Story", route: "/about" })).rejects.toMatchObject({ statusCode: 409, code: "ROUTE_CONFLICT" });
    await expect(svc.pages.createProjectPage(projectRow(), ALICE, { name: "about us" })).rejects.toMatchObject({ statusCode: 409 });
    await expect(svc.pages.createProjectPage(projectRow(), ALICE, { name: "Root", route: "/" })).rejects.toMatchObject({ statusCode: 409 });
    await expect(svc.pages.createProjectPage(projectRow(), ALICE, { name: "Status", route: "/api/status" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(svc.pages.createProjectPage(projectRow(), ALICE, { name: "   " })).rejects.toMatchObject({ statusCode: 400 });
    await expect(svc.pages.deleteProjectPage(projectRow(), ALICE, "page-home")).rejects.toMatchObject({ statusCode: 400 });
    await expect(svc.pages.updateProjectPage(projectRow(), ALICE, "page-home", { route: "/start" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(svc.pages.updateProjectPage(projectRow(), ALICE, "page-contact", { route: "/about" })).rejects.toMatchObject({ statusCode: 409 });
    await expect(svc.pages.deleteProjectPage(projectRow(), ALICE, "nope")).rejects.toMatchObject({ statusCode: 404 });

    expect(JSON.stringify(doc())).toBe(before);
  });

  it("the first extra page of a single-page website keeps the existing page as home", async () => {
    seedWebsite({ elements: [{ id: "solo", type: "heading", content: "Only page" }], pageSettings: { title: "Landing" } });
    const project = await openWorkspace();
    expect(fileAt(project.id, "src/pages/LandingPage.tsx")).toBeTruthy();

    const created = await svc.pages.createProjectPage(projectRow(), ALICE, { name: "About" });
    expect(created.page).toMatchObject({ routePath: "/about", filePath: "src/pages/AboutPage.tsx" });
    expect(doc().pages.map((p: any) => [p.id, p.name, p.slug])).toEqual([
      ["home", "Landing", "/"],
      [created.page!.pageId, "About", "/about"],
    ]);
    expect(sourceOf(project.id, "src/pages/LandingPage.tsx")).toContain("Only page");
    const routes = sourceOf(project.id, "src/routes/AppRoutes.tsx");
    expect(routes).toContain(`<Route path="/" element={<LandingPage />} />`);
    expect(routes).toContain(`<Route path="/about" element={<AboutPage />} />`);
  });

  it("registers a hand-written component file as a page only on request, and only if it is representable", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();

    await svc.fs.writeFile(project.id, "src/pages/Careers.tsx", {
      content: `export default function Careers() {\n  return (\n    <section className="careers">\n      <h1>Work with us</h1>\n      <a href="/about">About us</a>\n    </section>\n  );\n}\n`,
      authorId: ALICE.id,
    });
    // Writing the file registered nothing
    expect(doc().pages).toHaveLength(3);

    const created = await svc.pages.createProjectPage(projectRow(), ALICE, { name: "Careers", sourcePath: "src/pages/Careers.tsx" });
    expect(created.page).toMatchObject({ routePath: "/careers", filePath: "src/pages/CareersPage.tsx" });
    const [section] = pageOf(created.page!.pageId!).elements;
    expect(section).toMatchObject({ type: "container", htmlTag: "section", classes: ["careers"] });
    expect(section.children[0]).toMatchObject({ type: "heading", headingLevel: "h1", content: "Work with us" });
    expect(section.children[1]).toMatchObject({ type: "button", href: "/about", linkType: "page", pageId: "page-about" });
    // The file became the page's file
    expect(fileAt(project.id, "src/pages/Careers.tsx")).toBeUndefined();
    const page = sourceOf(project.id, "src/pages/CareersPage.tsx");
    expect(page).toContain("Work with us");
    expect(page).toContain(`<Link to="/about"`);
    assertProjectIsCoherent(project.id, "react");

    // A component with logic the visual document cannot hold is refused, untouched
    const dynamic = `import { useState } from "react";\nexport default function Counter() {\n  const [n, setN] = useState(0);\n  return <button onClick={() => setN(n + 1)}>{n}</button>;\n}\n`;
    await svc.fs.writeFile(project.id, "src/pages/Counter.tsx", { content: dynamic, authorId: ALICE.id });
    const before = JSON.stringify(doc());
    const refused = await svc.pages.createProjectPage(projectRow(), ALICE, { name: "Counter", sourcePath: "src/pages/Counter.tsx" }).catch((e) => e);
    expect(refused).toMatchObject({ statusCode: 422, code: "PAGE_SOURCE_UNSUPPORTED" });
    expect(refused.diagnostics.map((d: any) => d.code)).toEqual(expect.arrayContaining(["UNSUPPORTED_EVENT_HANDLER", "UNSUPPORTED_EXPRESSION"]));
    expect(JSON.stringify(doc())).toBe(before);
    expect(sourceOf(project.id, "src/pages/Counter.tsx")).toBe(dynamic);
  });
});

describe("5b. a page-convention file saved in the workspace", () => {
  it("is never registered or rewritten when it holds code the visual document cannot represent", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();
    const before = JSON.stringify(doc());
    const dynamic = `import { useState } from "react";\nexport default function Dashboard() {\n  const [n, setN] = useState(0);\n  return <button onClick={() => setN(n + 1)}>{n}</button>;\n}\n`;

    await svc.fs.writeFile(project.id, "src/pages/Dashboard.tsx", { content: dynamic, authorId: ALICE.id });
    const result = await svc.sync.syncSourceToVisualWebsite(project.id, SITE_ID, "src/pages/Dashboard.tsx", ALICE.id);

    expect(result.success).toBe(false);
    expect(result.status).toBe("unsupported");
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
    // No page, no invented content, and the hand-written file is byte-for-byte intact
    expect(JSON.stringify(doc())).toBe(before);
    expect(sourceOf(project.id, "src/pages/Dashboard.tsx")).toBe(dynamic);
    expect(fileAt(project.id, "src/pages/DashboardPage.tsx")).toBeUndefined();
    expect(sourceOf(project.id, "src/routes/AppRoutes.tsx")).not.toContain("Dashboard");
  });

  it("is registered as a real page with its own content when it is representable", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();

    await svc.fs.writeFile(project.id, "src/pages/Pricing.tsx", {
      content: `export default function Pricing() {\n  return (\n    <div className="pricing">\n      <h1>Simple pricing</h1>\n    </div>\n  );\n}\n`,
      authorId: ALICE.id,
    });
    const result = await svc.sync.syncSourceToVisualWebsite(project.id, SITE_ID, "src/pages/Pricing.tsx", ALICE.id);

    expect(result.status, JSON.stringify(result.diagnostics)).toBe("synced");
    const page = doc().pages.find((p: any) => p.name === "Pricing");
    expect(page.slug).toBe("/pricing");
    // The page holds exactly what the file contained
    expect(JSON.stringify(page.elements)).toContain("Simple pricing");
    expect(page.elements).toHaveLength(1);
    expect(page.elements[0].children.map((c: any) => c.content)).toEqual(["Simple pricing"]);
    expect(sourceOf(project.id, "src/pages/PricingPage.tsx")).toContain("Simple pricing");
    expect(sourceOf(project.id, "src/routes/AppRoutes.tsx")).toContain(`<Route path="/pricing" element={<PricingPage />} />`);
    assertProjectIsCoherent(project.id, "react");
  });
});

// =========================================================================
// 7. Persistence across reloads
// =========================================================================
describe("7. both editors load the latest saved state", () => {
  it("a code edit survives reopening the workspace and reloading the Visual Editor", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();
    await saveCode(project, HOME.react, (src) => src.replace("Build faster with Acme", "Persisted from code"));
    const snapshot = filesOf(project.id).map((f) => [f.path, f.version, f.contentHash]);

    // Reopen the workspace: nothing is regenerated, the edit is there
    const reopened: any = await svc.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);
    expect(reopened.id).toBe(project.id);
    expect(reopened.visualSync).toEqual({ synced: false, stale: false });
    expect(filesOf(project.id).map((f) => [f.path, f.version, f.contentHash])).toEqual(snapshot);
    expect((await svc.fs.readFile(project.id, HOME.react)).content).toContain("Persisted from code");

    // Reload the Visual Editor: it reads the website document
    const loaded = JSON.parse(JSON.stringify(site().editorData));
    expect(findElement(loaded.pages[0].elements, "hero-title").content).toBe("Persisted from code");

    // A visual save made from that loaded state keeps the code edit and adds to it
    await saveVisual((d) => {
      findElement(d.pages[0].elements, "hero-copy").content = "Then edited on the canvas";
    });
    const page = sourceOf(project.id, HOME.react);
    expect(page).toContain("Persisted from code");
    expect(page).toContain("Then edited on the canvas");
  });
});

// =========================================================================
// 8. Unsupported code and conflicting edits
// =========================================================================
describe("8. unsupported code and conflicts never overwrite either side", () => {
  const unsupportedEdits: Array<[string, (src: string) => string, string]> = [
    ["a dynamic expression", (s) => s.replace("Build faster with Acme", "{new Date().getFullYear()}"), "UNSUPPORTED_EXPRESSION"],
    ["an event handler", (s) => s.replace(`<button type="button"`, `<button onClick={() => alert("hi")} type="button"`), "UNSUPPORTED_EVENT_HANDLER"],
    ["a custom component", (s) => s.replace(/(data-forge-id="hero-title">[^<]*<\/h1>)/, `$1\n<Carousel />`), "UNSUPPORTED_COMPONENT"],
    ["a spread attribute", (s) => s.replace(`data-forge-id="hero-title"`, `{...props} data-forge-id="hero-title"`), "UNSUPPORTED_SPREAD"],
    ["a tag with no visual equivalent", (s) => s.replace(/(data-forge-id="hero-title">[^<]*<\/h1>)/, `$1\n<table></table>`), "UNSUPPORTED_TAG"],
    ["an attribute outside the model", (s) => s.replace(`data-forge-id="hero-title"`, `data-forge-id="hero-title" title="tip"`), "UNSUPPORTED_ATTRIBUTE"],
    ["text after a child element", (s) => s.replace(/(data-forge-id="hero-title">[^<]*<\/h1>)/, `$1\ntrailing text`), "UNSUPPORTED_MIXED_CONTENT"],
    ["code outside a protected region", (s) => s.replace("  return (", "  const tracked = window.location.href; void tracked;\n  return ("), "CUSTOM_CODE_OUTSIDE_PROTECTED_REGION"],
    ["a change to the generated page shell", (s) => s.replace(`<main className="w-full">`, `<main className="w-full bg-black">`), "UNSUPPORTED_ROUNDTRIP"],
    ["an element moved outside the page root", (s) => s.replace(`<main className="w-full">`, `<main className="w-full">\n<h2>Outside</h2>`), "UNSUPPORTED_ROUNDTRIP"],
  ];

  it.each(unsupportedEdits)("%s is preserved in the file and reported, not applied", async (_name, edit, code) => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();
    const before = JSON.stringify(doc());

    const { result, edited } = await saveCode(project, HOME.react, edit);

    expect(result.status).toBe("unsupported");
    expect(result.success).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain(code);
    expect(result.diagnostics.every((d) => d.severity !== "error" || d.message.length > 10)).toBe(true);
    // Source kept byte for byte; document and its version untouched
    expect(sourceOf(project.id, HOME.react)).toBe(edited);
    expect(JSON.stringify(doc())).toBe(before);
    expect(site().documentVersion).toBe(1);
    expect((await svc.pages.listProjectPages(projectRow())).find((p) => p.filePath === HOME.react)).toMatchObject({
      ownership: "code",
      sync: { status: "unsupported" },
    });
  });

  it("a syntax error is saved, reported with its position, and applied nowhere", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();
    const before = JSON.stringify(doc());

    const { result, edited } = await saveCode(project, HOME.react, (s) => s.replace("</main>", "</mian>"));
    expect(result.status).toBe("invalid");
    expect(result.diagnostics[0]).toMatchObject({ severity: "error", code: "TSX_SYNTAX_ERROR" });
    expect(result.diagnostics[0].line).toBeGreaterThan(1);
    expect(sourceOf(project.id, HOME.react)).toBe(edited);
    expect(JSON.stringify(doc())).toBe(before);
  });

  it("hand-written code is not overwritten by a later visual save, and syncs again once it is representable", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();
    const { edited } = await saveCode(project, HOME.react, (s) => s.replace("Build faster with Acme", "{siteName}"));

    // Visual save on another page and on this page: the held file stays exactly as written
    const visual = await saveVisual((d) => {
      findElement(d.pages[1].elements, "about-title").content = "About, edited visually";
    });
    expect(visual).toMatchObject({ synced: true, stale: false });
    expect(visual!.conflicts).toEqual([HOME.react]);
    expect(sourceOf(project.id, HOME.react)).toBe(edited);
    expect(sourceOf(project.id, ABOUT.react)).toContain("About, edited visually");

    // Full regeneration and reopening the workspace do not replace it either
    const plan = await svc.generator.createGenerationPlan(project.id, "react", { scope: { type: "full" }, authorId: ALICE.id });
    await svc.generator.executeGeneration(project.id, plan, ALICE.id);
    await svc.project.getOrCreateProjectForWebsite(SITE_ID, ALICE);
    expect(sourceOf(project.id, HOME.react)).toBe(edited);

    // Once the code is representable again it synchronises and the file is managed as before
    const fixed = await saveCode(project, HOME.react, (s) => s.replace("{siteName}", "Representable again"));
    expect(fixed.result.status, JSON.stringify(fixed.result.diagnostics)).toBe("synced");
    expect(findElement(pageOf("page-home").elements, "hero-title").content).toBe("Representable again");
    expect((await svc.pages.listProjectPages(projectRow())).find((p) => p.filePath === HOME.react)).toMatchObject({ ownership: "generated", sync: null });
  });

  it("detects a page edited on both sides and applies neither until the user chooses", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();

    // The code becomes hand-written (unsupported), then the same page changes in the Visual Editor
    await saveCode(project, HOME.react, (s) => s.replace("Build faster with Acme", "{siteName}"));
    await saveVisual((d) => {
      findElement(d.pages[0].elements, "hero-copy").content = "Visual edit made in the meantime";
    });
    const visualDoc = JSON.stringify(doc());

    // The code is fixed and saved: it was written against the older visual page
    const { result, edited } = await saveCode(project, HOME.react, (s) => s.replace("{siteName}", "Code headline"));
    expect(result.status).toBe("conflict");
    expect(result.success).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(JSON.stringify(doc())).toBe(visualDoc);
    expect(sourceOf(project.id, HOME.react)).toBe(edited);

    // Keep the visual version: the file is regenerated from the document
    const keepVisual = await svc.sync.syncSourceToVisualWebsite(project.id, SITE_ID, HOME.react, ALICE.id, { resolve: "visual" });
    expect(keepVisual.status).toBe("reverted");
    const page = sourceOf(project.id, HOME.react);
    expect(page).toContain("Visual edit made in the meantime");
    expect(page).toContain("Build faster with Acme");
    expect(page).not.toContain("Code headline");
    expect(JSON.stringify(doc())).toBe(visualDoc);
  });

  it("keeping the code in a conflict applies it to the visual document", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();
    await saveCode(project, HOME.react, (s) => s.replace("Build faster with Acme", "{siteName}"));
    await saveVisual((d) => {
      findElement(d.pages[0].elements, "hero-copy").content = "Visual edit made in the meantime";
    });
    const { result } = await saveCode(project, HOME.react, (s) => s.replace("{siteName}", "Code headline"));
    expect(result.status).toBe("conflict");

    const keepCode = await svc.sync.syncSourceToVisualWebsite(project.id, SITE_ID, HOME.react, ALICE.id, { resolve: "code" });
    expect(keepCode.status, JSON.stringify(keepCode.diagnostics)).toBe("synced");
    expect(findElement(pageOf("page-home").elements, "hero-title").content).toBe("Code headline");
    // The code did not contain the visual edit, and the code was chosen
    expect(findElement(pageOf("page-home").elements, "hero-copy").content).not.toBe("Visual edit made in the meantime");
  });

  it("a visual page changed without its source being regenerated is a conflict for a code save", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();
    // The document moved on, but generation has not run (e.g. it failed)
    const next = JSON.parse(JSON.stringify(doc()));
    findElement(next.pages[0].elements, "hero-copy").content = "Unsynchronised visual edit";
    site().editorData = next;
    site().documentVersion = 2;

    const { result, edited } = await saveCode(project, HOME.react, (s) => s.replace("Build faster with Acme", "Code headline"));
    expect(result.status).toBe("conflict");
    expect(findElement(pageOf("page-home").elements, "hero-copy").content).toBe("Unsynchronised visual edit");
    expect(findElement(pageOf("page-home").elements, "hero-title").content).toBe("Build faster with Acme");
    expect(sourceOf(project.id, HOME.react)).toBe(edited);
  });

  it("a document saved while the code was being reconciled is a conflict, not a lost update", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();
    const before = JSON.stringify(doc());
    mem.failNextDocumentWrite = true;

    const { result, edited } = await saveCode(project, HOME.react, (s) => s.replace("Build faster with Acme", "Code headline"));
    expect(result.status).toBe("conflict");
    expect(JSON.stringify(doc())).toBe(before);
    expect(sourceOf(project.id, HOME.react)).toBe(edited);
  });

  it("does not claim synchronisation when the source cannot be regenerated", async () => {
    seedWebsite(buildWebsiteFixture());
    const project = await openWorkspace();
    await svc.fs.writeFile(project.id, HOME.react, {
      content: sourceOf(project.id, HOME.react).replace(/(\n\s*)(<p[^>]*data-forge-id="site-footer-text")/, `$1<p>Added without an id</p>$1$2`),
      authorId: ALICE.id,
    });
    // Regeneration assigns the new element an id, which rewrites the file: that write fails
    store().failNext("forgeProjectFile", "update", (args) => typeof args.data?.content === "string" && args.data.content.includes("Added without an id"), "storage offline");
    const result = await svc.sync.syncSourceToVisualWebsite(project.id, SITE_ID, HOME.react, ALICE.id);

    expect(result.status).toBe("error");
    expect(result.success).toBe(false);
    expect(result.message).toContain("storage offline");
    // The failure stays visible: the project is not recorded as in step with the document
    expect(projectRow().metadata.visualSync.sourceHash).not.toBe(svc.registry.hashValue(doc()));
  });
});

// =========================================================================
// 9 + 10. Preview, build and export use the persisted source (HTTP API)
// =========================================================================
describe("9/10. HTTP API: save-time sync, pages, preview and ZIP export", () => {
  let server: Server;
  let base: string;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    const express = (await import("express")).default;
    const cookieParser = (await import("cookie-parser")).default;
    const { default: projectRoutes } = await import("../routes/project.routes.js");
    const { default: exportRoutes } = await import("../routes/export.routes.js");
    const { errorMiddleware } = await import("../middlewares/error.middleware.js");

    const app = express();
    app.use(express.json({ limit: "5mb" }));
    app.use(cookieParser());
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
    seedWebsite(buildWebsiteFixture());
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
  const post = (path: string, body: unknown, token = alice, method = "POST") =>
    call(path, token, { method, body: JSON.stringify(body) });

  async function open() {
    const res = await call(`/api/v1/projects/website/${SITE_ID}`, alice);
    expect(res.status).toBe(200);
    return (await res.json()).project;
  }

  it("saving a page file reconciles it in the same request and returns the regenerated file", async () => {
    const project = await open();
    const file = { ...fileAt(project.id, HOME.react)! };

    const res = await post(`/api/v1/projects/${project.id}/files`, {
      path: HOME.react,
      content: (file.content as string).replace("Build faster with Acme", "Saved through the API"),
      expectedVersion: file.version,
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sync).toMatchObject({ success: true, status: "synced" });
    expect(body.file.content).toContain("Saved through the API");
    expect(body.file.isGenerated).toBe(true);
    expect(findElement(pageOf("page-home").elements, "hero-title").content).toBe("Saved through the API");

    // A stale editor buffer is rejected instead of overwriting the newer file
    const stale = await post(`/api/v1/projects/${project.id}/files`, {
      path: HOME.react,
      content: "// stale buffer",
      expectedVersion: file.version,
    });
    expect(stale.status).toBe(409);
    expect(sourceOf(project.id, HOME.react)).toContain("Saved through the API");
  });

  it("reports unsupported code on save without failing the save", async () => {
    const project = await open();
    const file = fileAt(project.id, HOME.react)!;
    const content = (file.content as string).replace("Build faster with Acme", "{headline}");

    const res = await post(`/api/v1/projects/${project.id}/files`, { path: HOME.react, content, expectedVersion: file.version });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sync).toMatchObject({ success: false, status: "unsupported" });
    expect(body.sync.diagnostics[0]).toMatchObject({ code: "UNSUPPORTED_EXPRESSION", filePath: HOME.react });
    expect(body.file.content).toBe(content);
    expect(body.file.isGenerated).toBe(false);

    // Resolving in favour of the visual document through the sync endpoint
    const revert = await post(`/api/v1/projects/${project.id}/sync/code-to-visual`, { filePath: HOME.react, resolve: "visual" });
    expect((await revert.json()).status).toBe("reverted");
    expect(sourceOf(project.id, HOME.react)).toContain("Build faster with Acme");
    expect((await post(`/api/v1/projects/${project.id}/sync/code-to-visual`, { filePath: HOME.react, resolve: "both" })).status).toBe(400);
  });

  it("an edited generated file that is not a page becomes the user's and survives regeneration", async () => {
    const project = await open();
    const routes = fileAt(project.id, "src/routes/AppRoutes.tsx")!;
    const content = `${routes.content}\n// hand-tuned by the user\n`;

    const res = await post(`/api/v1/projects/${project.id}/files`, { path: "src/routes/AppRoutes.tsx", content, expectedVersion: routes.version });
    const body = await res.json();
    expect(body.sync).toMatchObject({ status: "not-a-page" });
    expect(body.file.isGenerated).toBe(false);

    await saveVisual((d) => {
      findElement(d.pages[0].elements, "hero-title").content = "Another visual change";
    });
    expect(sourceOf(project.id, "src/routes/AppRoutes.tsx")).toBe(content);
    expect(sourceOf(project.id, HOME.react)).toContain("Another visual change");
  });

  it("page endpoints create, list, rename and delete pages for the owner only", async () => {
    const project = await open();

    const created = await post(`/api/v1/projects/${project.id}/pages`, { name: "About The Team", route: "/team" });
    const createdBody = await created.json();
    expect(created.status).toBe(201);
    expect(createdBody.page).toMatchObject({ name: "About The Team", routePath: "/team", filePath: "src/pages/AboutTheTeamPage.tsx" });

    const list = await (await call(`/api/v1/projects/${project.id}/pages`, alice)).json();
    expect(list.pages.map((p: any) => [p.name, p.routePath, p.ownership])).toEqual([
      ["Home", "/", "generated"],
      ["About Us", "/about", "generated"],
      ["Contact", "/contact-us", "generated"],
      ["About The Team", "/team", "generated"],
    ]);

    expect((await post(`/api/v1/projects/${project.id}/pages`, { name: "Dup", route: "/team" })).status).toBe(409);

    const pageId = createdBody.page.pageId;
    const renamed = await post(`/api/v1/projects/${project.id}/pages/${pageId}`, { name: "Team" }, alice, "PATCH");
    expect((await renamed.json()).page).toMatchObject({ name: "Team", filePath: "src/pages/TeamPage.tsx" });

    // Another user can neither see nor change the pages
    for (const [method, path, payload] of [
      ["GET", `/api/v1/projects/${project.id}/pages`, undefined],
      ["POST", `/api/v1/projects/${project.id}/pages`, { name: "Intruder" }],
      ["PATCH", `/api/v1/projects/${project.id}/pages/${pageId}`, { name: "Owned" }],
      ["DELETE", `/api/v1/projects/${project.id}/pages/${pageId}`, undefined],
      ["GET", `/api/v1/projects/${project.id}/preview/source`, undefined],
    ] as const) {
      const res = await call(path, bob, { method, body: payload ? JSON.stringify(payload) : undefined });
      expect(res.status, `${method} ${path} as another user`).toBe(403);
      expect((await call(path, undefined, { method })).status, `${method} ${path} without a session`).toBe(401);
    }
    expect(pageOf(pageId).name).toBe("Team");

    const deleted = await call(`/api/v1/projects/${project.id}/pages/${pageId}`, alice, { method: "DELETE" });
    expect(deleted.status).toBe(200);
    expect(pageOf(pageId)).toBeUndefined();
    expect(fileAt(project.id, "src/pages/TeamPage.tsx")).toBeUndefined();
  });

  it("reports a page whose source could not be generated as a failure", async () => {
    const project = await open();
    store().failNext("forgeProjectFile", "create", (args) => args.data.path === "src/pages/PricingPage.tsx", "disk full");
    const res = await post(`/api/v1/projects/${project.id}/pages`, { name: "Pricing" });
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.message).toContain("disk full");
  });

  it.each(["react", "nextjs"] as const)("%s: the preview is built from the persisted source, including code-only edits", async (framework) => {
    const project = await open();
    if (framework === "nextjs") {
      expect((await post(`/api/v1/projects/${project.id}/generate/next`, {})).status).toBe(200);
    }
    const path = HOME[framework];

    // A synchronised edit and, on another page, code the visual document cannot hold
    const home = fileAt(project.id, path)!;
    await post(`/api/v1/projects/${project.id}/files`, { path, content: (home.content as string).replace("Build faster with Acme", "Previewed from source"), expectedVersion: home.version });
    const about = fileAt(project.id, ABOUT[framework])!;
    const held = await post(`/api/v1/projects/${project.id}/files`, { path: ABOUT[framework], content: (about.content as string).replace("Our Story &amp; Vision", `{String("only-in-the-code")}`), expectedVersion: about.version });
    expect((await held.json()).sync.status).toBe("unsupported");

    const res = await call(`/api/v1/projects/${project.id}/preview/source?route=/about`, alice);
    const { preview } = await res.json();
    expect(res.status).toBe(200);
    expect(preview.success, JSON.stringify(preview.errors)).toBe(true);
    expect(preview.framework).toBe(framework);
    expect(preview.route).toBe("/about");
    expect(preview.routes).toEqual(["/", "/about", "/contact-us"]);
    // The running bundle is the saved code, not the visual document
    expect(preview.html).toContain("Previewed from source");
    expect(preview.html).toContain(`String("only-in-the-code")`);
    expect(JSON.stringify(doc())).not.toContain("only-in-the-code");
    expect(preview.html).toContain(`window.__FORGE_PREVIEW_ROUTE__ = "/about"`);
    expect(preview.html).not.toContain("/preview/site/");

    // Source that does not compile is shown as such, never as an older build
    const broken = fileAt(project.id, path)!;
    await post(`/api/v1/projects/${project.id}/files`, { path, content: `${broken.content}\nexport const = ;\n`, expectedVersion: broken.version });
    const failed = (await (await call(`/api/v1/projects/${project.id}/preview/source`, alice)).json()).preview;
    expect(failed.success).toBe(false);
    expect(failed.errors[0].file).toBe(path);
    expect(failed.html).toContain("does not compile");
    expect(failed.html).not.toContain("Previewed from source");
  }, 120_000);

  it.each(["react", "nextjs"] as const)("%s: the ZIP holds exactly the persisted source, with code and visual edits", async (framework) => {
    const project = await open();
    if (framework === "nextjs") {
      expect((await post(`/api/v1/projects/${project.id}/generate/next`, {})).status).toBe(200);
    }
    const path = HOME[framework];
    const home = fileAt(project.id, path)!;
    await post(`/api/v1/projects/${project.id}/files`, { path, content: (home.content as string).replace("Build faster with Acme", "Exported code edit"), expectedVersion: home.version });
    await post(`/api/v1/projects/${project.id}/pages`, { name: "Pricing" });

    // A visual save whose generation has not been picked up yet must still be in the archive
    const next = JSON.parse(JSON.stringify(doc()));
    findElement(next.pages[1].elements, "about-title").content = "Exported visual edit";
    site().editorData = next;
    site().documentVersion += 1;

    for (const url of [`/api/v1/projects/${project.id}/export/zip`, `/api/v1/websites/${SITE_ID}/export/zip?type=${framework}`]) {
      const res = await call(url, alice);
      expect(res.status, url).toBe(200);
      const entries = readZip(Buffer.from(await res.arrayBuffer()));
      const persisted = filesOf(project.id);

      expect(entries.map((e) => e.name).sort()).toEqual(persisted.map((f) => f.path).sort());
      for (const file of persisted) {
        expect(entries.find((e) => e.name === file.path)!.data.toString("utf8"), file.path).toBe(file.content);
      }
      const text = (name: string) => entries.find((e) => e.name === name)!.data.toString("utf8");
      expect(text(path)).toContain("Exported code edit");
      expect(text(ABOUT[framework])).toContain("Exported visual edit");
      expect(entries.map((e) => e.name)).toContain(framework === "react" ? "src/pages/PricingPage.tsx" : "app/pricing/page.tsx");
      expect(JSON.parse(text("package.json")).name).toBe("acme-site");
    }
    assertProjectIsCoherent(project.id, framework);
  });
});
