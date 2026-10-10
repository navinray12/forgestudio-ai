/**
 * Website-to-Code verification: compiler, React / Next.js generators and ZIP export.
 * Run with: npm run test:website-to-code
 *
 * Generated source is syntax-checked with a real TSX parser (esbuild), so these
 * tests fail on invalid output rather than only on a missing substring.
 */
import { describe, it, expect } from "vitest";
import { transformSync } from "esbuild";
import {
  visualDocumentToIR,
  normalizeRoutePath,
  compileIRToSourceFilesAsync,
  ElementIR,
} from "../services/compiler/unifiedCompiler.service.js";
import { buildReactGenerationPlan } from "../services/generator/reactGenerator.service.js";
import { buildNextJsGenerationPlan } from "../services/generator/nextjsGenerator.service.js";
import { validateGenerationPlan } from "../services/generator/projectGenerator.service.js";
import { buildProjectZipStream, buildZipFromFiles } from "../services/codeGenerator.service.js";
import { sanitizeHref, toComponentIdentifier } from "../services/generator/jsxRenderer.js";
import {
  visualCodeSyncService,
  parseSourceCodeToElements,
  validateSourceSyntax,
  detectUnsupportedConstructs,
} from "../services/compiler/visualCodeSync.service.js";
import type { GenerationPlan } from "../services/generator/generatorTypes.js";
import { buildWebsiteFixture, TRICKY_TEXT, EXPECTED_PAGE_TEXT } from "./fixtures/website-to-code.fixture.js";
import { readZip } from "./helpers/memoryDb.js";

const PROJECT = { id: "proj-1", name: "Acme Site", slug: "acme-site" };

function fileOf(plan: { files: Array<{ path: string; content: string }> }, path: string): string {
  const file = plan.files.find((f) => f.path === path);
  if (!file) throw new Error(`Expected generated file '${path}'. Got: ${plan.files.map((f) => f.path).join(", ")}`);
  return file.content;
}

/** Every generated TS/TSX/JS module must parse; JSON must be valid JSON */
function assertAllSourcesParse(files: Array<{ path: string; content: string }>) {
  for (const file of files) {
    if (/\.(tsx|ts|mjs|js)$/.test(file.path)) {
      const loader = file.path.endsWith(".tsx") ? "tsx" : file.path.endsWith(".ts") ? "ts" : "js";
      try {
        transformSync(file.content, { loader, jsx: "automatic", logLevel: "silent" });
      } catch (err: any) {
        throw new Error(`Generated file ${file.path} is not valid ${loader}:\n${err.message}\n${file.content}`);
      }
    } else if (file.path.endsWith(".json")) {
      expect(() => JSON.parse(file.content), `${file.path} must be valid JSON`).not.toThrow();
    }
  }
}

function flatten(el: ElementIR): ElementIR[] {
  return [el, ...el.children.flatMap(flatten)];
}

function irOf(doc: any, framework: "react" | "nextjs" = "react") {
  return visualDocumentToIR(doc, { ...PROJECT, framework });
}

describe("A. compiler: visual document -> IR", () => {
  it("compiles a single-page document to one '/' route containing its elements", () => {
    const ir = irOf({ elements: [{ id: "h", type: "heading", content: "Solo page" }] });
    expect(ir.components).toHaveLength(1);
    expect(ir.routes).toEqual([expect.objectContaining({ path: "/" })]);
    expect(flatten(ir.components[0].rootElement).map((e) => e.textContent)).toContain("Solo page");
  });

  it("compiles a multi-page document to unique routes with exactly one home page", () => {
    const ir = irOf(buildWebsiteFixture());
    expect(ir.routes.map((r) => r.path)).toEqual(["/", "/about", "/contact-us"]);
    expect(ir.components.map((c) => c.name)).toEqual(["Home", "AboutUs", "Contact"]);
    expect(ir.routes.filter((r) => r.path === "/")).toHaveLength(1);
  });

  it("keeps nested nodes from both `children` and `elements`, at any depth", () => {
    const ir = irOf(buildWebsiteFixture());
    const home = flatten(ir.components[0].rootElement).map((e) => e.id);
    expect(home).toEqual(expect.arrayContaining(["hero", "hero-title", "hero-row", "hero-cta", "hero-plain-button", "hero-image"]));
    const about = flatten(ir.components[1].rootElement).map((e) => e.id);
    expect(about).toEqual(expect.arrayContaining(["about-inner", "about-deep", "about-deep-text"]));
  });

  it("resolves text from every supported field without leaking editor labels", () => {
    const ir = irOf({
      elements: [
        { id: "a", type: "heading", content: "from content" },
        { id: "b", type: "text", text: "from text" },
        { id: "c", type: "paragraph", textContent: "from textContent" },
        { id: "d", type: "button", content: "Click Me", buttonText: "from buttonText" },
        { id: "e", type: "heading", props: { content: "from props.content" } },
        { id: "f", type: "container", content: "Container", children: [] },
        { id: "g", type: "image", content: "Image", src: "https://example.com/a.png" },
      ],
    });
    const byId = Object.fromEntries(flatten(ir.components[0].rootElement).map((e) => [e.id, e.textContent]));
    expect(byId).toMatchObject({
      a: "from content",
      b: "from text",
      c: "from textContent",
      d: "from buttonText",
      e: "from props.content",
    });
    expect(byId.f).toBeUndefined();
    expect(byId.g).toBeUndefined();
  });

  it("honours heading levels from `headingLevel` and from an explicit tag", () => {
    const ir = irOf({
      elements: [
        { id: "a", type: "heading", headingLevel: "h1", content: "x" },
        { id: "b", type: "heading", tag: "h3", content: "x" },
        { id: "c", type: "heading", content: "x" },
      ],
    });
    expect(ir.components[0].rootElement.children.map((e) => e.tag)).toEqual(["h1", "h3", "h2"]);
  });

  it("normalises page paths and slugs into unique, URL-safe routes and valid identifiers", () => {
    const ir = irOf({
      homePageId: "p2",
      pages: [
        { id: "p1", name: "Landing", slug: "home" }, // slug says home, but homePageId wins
        { id: "p2", name: "Real Home", slug: "start" },
        { id: "p3", name: "404 Deals!", slug: "deals" },
        { id: "p4", name: "Pricing", path: "pricing" },
        { id: "p5", name: "Pricing", path: "/pricing/" }, // duplicate name and route
        { id: "p6", name: "日本語", slug: "" }, // no ASCII to build a name or slug from
        { id: "p7", name: "Blog Post", path: "/Blog/:postId" },
        { id: "p8", name: "Api Docs", path: "/api/docs" }, // would collide with Next.js route handlers
        { id: "p9", name: "Not Found", slug: "missing" }, // would collide with the 404 page component
      ],
    });
    const paths = ir.routes.map((r) => r.path);
    const names = ir.components.map((c) => c.name);

    expect(paths.filter((p) => p === "/")).toEqual(["/"]);
    expect(ir.components[paths.indexOf("/")].name).toBe("RealHome");
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[A-Z][A-Za-z0-9]*$/);
    for (const path of paths) expect(path).toMatch(/^\/[a-z0-9_~\-/:A-Za-z]*$/);
    expect(paths).toEqual(expect.arrayContaining(["/home", "/deals", "/pricing", "/pricing-2", "/blog/:postId", "/page-api/docs"]));
    expect(names).not.toContain("NotFound");
  });

  it("normalizeRoutePath handles assorted valid formats", () => {
    expect(normalizeRoutePath("about")).toBe("/about");
    expect(normalizeRoutePath("/About Us/")).toBe("/about-us");
    expect(normalizeRoutePath("\\docs\\Getting Started")).toBe("/docs/getting-started");
    expect(normalizeRoutePath("blog/[slug]")).toBe("/blog/:slug");
    expect(normalizeRoutePath("../../etc/passwd")).toBe("/etc/passwd");
    expect(normalizeRoutePath("")).toBe("/");
  });

  it("renders shared header and footer site parts on every page", () => {
    const ir = irOf(buildWebsiteFixture());
    for (const comp of ir.components) {
      const ids = flatten(comp.rootElement).map((e) => e.id);
      expect(ids).toContain("site-nav");
      expect(ids).toContain("site-footer-text");
    }
  });

  it("resolves page-linked buttons and menu items to the linked page's route", () => {
    const ir = irOf(buildWebsiteFixture());
    const home = flatten(ir.components[0].rootElement);
    expect(home.find((e) => e.id === "hero-cta")?.props?.href).toBe("/about");
    expect(home.find((e) => e.id === "site-nav_item_2")?.props?.href).toBe("/about");
  });

  it("reports unsupported widgets instead of silently dropping them", () => {
    const ir = irOf(buildWebsiteFixture());
    expect(ir.metadata?.warnings).toEqual(expect.arrayContaining([expect.stringContaining("Widget 'slides'")]));
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty object", {}],
    ["array", []],
    ["unparseable string", "{not json"],
    ["null pages", { pages: null }],
    ["non-array elements", { elements: "nope" }],
    ["pages with junk entries", { pages: [null, "x", 7, { name: "Ok", elements: [null, "x", { type: "heading", content: "kept" }] }] }],
    ["children with junk entries", { elements: [{ type: "container", children: [null, 5, { type: "text", content: "kept" }] }] }],
    ["page without elements", { pages: [{ id: "a" }] }],
  ])("tolerates malformed input: %s", async (_label, doc) => {
    const ir = irOf(doc);
    expect(ir.components.length).toBeGreaterThanOrEqual(1);
    expect(ir.routes.filter((r) => r.path === "/")).toHaveLength(1);
    for (const framework of ["react", "nextjs"] as const) {
      const files = await compileIRToSourceFilesAsync(irOf(doc, framework));
      assertAllSourcesParse(files);
    }
  });

  it("keeps real content from a partially malformed document", () => {
    const ir = irOf({ pages: [null, { name: "Ok", elements: [null, { type: "heading", content: "kept" }] }] });
    expect(flatten(ir.components[0].rootElement).map((e) => e.textContent)).toContain("kept");
  });
});

describe.each([
  ["react", buildReactGenerationPlan],
  ["nextjs", buildNextJsGenerationPlan],
] as const)("B. %s generator", (framework, buildPlan) => {
  const build = async (doc: any = buildWebsiteFixture()): Promise<GenerationPlan> =>
    buildPlan(irOf(doc, framework), [], { scope: { type: "full" } });

  const pagePath = (page: "home" | "about" | "contact") =>
    framework === "react"
      ? { home: "src/pages/HomePage.tsx", about: "src/pages/AboutUsPage.tsx", contact: "src/pages/ContactPage.tsx" }[page]
      : { home: "app/page.tsx", about: "app/about/page.tsx", contact: "app/contact-us/page.tsx" }[page];

  it("emits only syntactically valid source and a plan that passes validation", async () => {
    const plan = await build();
    assertAllSourcesParse(plan.files);
    const validation = validateGenerationPlan(plan);
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);
  });

  it("includes every required configuration file", async () => {
    const paths = (await build()).files.map((f) => f.path);
    const required =
      framework === "react"
        ? ["package.json", "tsconfig.json", "vite.config.ts", "index.html", "src/main.tsx", "src/App.tsx", "src/index.css",
           "src/vite-env.d.ts", "src/routes/AppRoutes.tsx", "src/styles/forge.css", "src/lib/forgeStyle.ts"]
        : ["package.json", "tsconfig.json", "next.config.mjs", "postcss.config.mjs", "app/layout.tsx", "app/globals.css",
           "app/forge.css", "app/not-found.tsx", "lib/forgeStyle.ts"];
    expect(paths).toEqual(expect.arrayContaining(required));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("declares every package the generated source imports", async () => {
    const plan = await build();
    const pkg = JSON.parse(fileOf(plan, "package.json"));
    const declared = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)]);
    expect(pkg.name).toMatch(/^[a-z0-9][a-z0-9._-]*$/);

    for (const file of plan.files.filter((f) => /\.(tsx?|mjs|js)$/.test(f.path))) {
      for (const match of file.content.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = match[1];
        if (spec.startsWith(".") || spec.startsWith("@/") || spec === "path") continue;
        const pkgName = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
        expect(declared.has(pkgName), `${file.path} imports undeclared package '${pkgName}'`).toBe(true);
      }
    }
  });

  it("writes one page file per route and wires every route", async () => {
    const plan = await build();
    expect(plan.routes.map((r) => r.path)).toEqual(["/", "/about", "/contact-us"]);
    for (const page of ["home", "about", "contact"] as const) fileOf(plan, pagePath(page));

    if (framework === "react") {
      const routes = fileOf(plan, "src/routes/AppRoutes.tsx");
      expect(routes).toContain(`<Route path="/" element={<HomePage />} />`);
      expect(routes).toContain(`<Route path="/about" element={<AboutUsPage />} />`);
      expect(routes).toContain(`<Route path="/contact-us" element={<ContactPage />} />`);
      for (const name of ["HomePage", "AboutUsPage", "ContactPage"]) {
        expect(routes).toContain(`import ${name} from '../pages/${name}';`);
      }
    }
  });

  it("renders each page's own content, including deeply nested nodes", async () => {
    const plan = await build();
    for (const page of ["home", "about", "contact"] as const) {
      const source = fileOf(plan, pagePath(page));
      for (const text of EXPECTED_PAGE_TEXT[page]) {
        expect(source, `${pagePath(page)} must contain "${text}"`).toContain(text);
      }
    }
    // Content stays on its own page
    expect(fileOf(plan, pagePath("home"))).not.toContain("Send Us a Message");
    expect(fileOf(plan, pagePath("contact"))).not.toContain("Build faster with Acme");
    // Nesting order is preserved: about-title precedes the nested paragraph
    const about = fileOf(plan, pagePath("about"));
    expect(about.indexOf("Our Story")).toBeLessThan(about.indexOf("Three levels deep"));
  });

  it("does not replace the design with a generic placeholder or leak editor labels", async () => {
    const plan = await build();
    for (const page of ["home", "about", "contact"] as const) {
      const source = fileOf(plan, pagePath(page));
      expect(source).not.toMatch(/>\s*Container\s*</);
      expect(source).not.toMatch(/>\s*Image\s*</);
      expect(source).not.toContain("Navigation Menu");
      expect(source).not.toContain("Click Me");
    }
  });

  it("escapes quotes, angle brackets, braces and Unicode in text and attributes", async () => {
    const home = fileOf(await build(), pagePath("home"));
    expect(home).toContain(`She said "it's &lt;b&gt;&#123;great&#125;&lt;/b&gt;" &amp; left — naïve café ✓ 日本語`);
    expect(home).not.toContain(TRICKY_TEXT);
    expect(home).toContain(`alt="Team &quot;at work&quot; &lt;2026&gt;"`);
  });

  it("stays valid when every user-controlled string is hostile", async () => {
    const hostile = `"}</div>{alert(1)}<script>'\`\${x}\\ \n */ //`;
    const plan = await buildPlan(
      visualDocumentToIR(
        {
          pages: [
            {
              id: "p",
              name: hostile,
              slug: hostile,
              elements: [
                { id: hostile, type: "heading", content: hostile, classes: [hostile], styles: { color: hostile, fontFamily: hostile } },
                { id: "i", type: "image", src: `https://example.com/a.png?${hostile}`, alt: hostile },
                { id: "b", type: "button", buttonText: hostile, href: `/x"${hostile}` },
                { id: "r", type: "container", responsiveStyles: { mobile: { color: `red;} body{display:none` } } },
              ],
            },
          ],
          pageCss: "</style><script>alert(1)</script>",
        },
        { id: "p", name: hostile, slug: hostile, framework }
      ),
      [],
      {}
    );
    assertAllSourcesParse(plan.files);
    const css = fileOf(plan, framework === "react" ? "src/styles/forge.css" : "app/forge.css");
    expect(css).not.toContain("display:none");
    expect(css.toLowerCase()).not.toContain("</style");
    expect(JSON.parse(fileOf(plan, "package.json")).name).toMatch(/^[a-z0-9][a-z0-9._-]*$/);
  });

  it("preserves supported styles, container layout and responsive overrides", async () => {
    const plan = await build();
    const home = fileOf(plan, pagePath("home"));
    // Longhand and non-utility values survive as inline styles
    expect(home).toContain(`paddingTop: "48px"`);
    expect(home).toContain(`lineHeight: "1.2"`);
    expect(home).toContain(`padding: "10px 22px"`);
    expect(home).toContain("opacity: 1");
    // Exact utility matches become Tailwind classes
    expect(home).toMatch(/className="[^"]*\bflex\b[^"]*\bflex-col\b[^"]*\bjustify-center\b/);
    expect(home).toContain("font-bold");
    // Editor-only style keys are not emitted as CSS
    expect(home).not.toContain("backgroundType");
    // Responsive overrides become media queries bound to the element
    expect(home).toContain(`data-forge-id="hero"`);
    const css = fileOf(plan, framework === "react" ? "src/styles/forge.css" : "app/forge.css");
    expect(css).toMatch(/@media \(max-width: 1024px\) \{\s*\[data-forge-id="hero"\] \{\s*padding-top: 32px !important;/);
    expect(css).toMatch(/@media \(max-width: 767px\) \{\s*\[data-forge-id="hero"\] \{\s*padding-top: 16px !important;\s*padding-bottom: 16px !important;/);
    // Design tokens and custom CSS are carried over
    expect(css).toContain("--forge-colors-primary: #2563eb;");
    expect(css).toContain(".hero-title { letter-spacing: -0.02em; }");
  });

  it("imports helpers only where they are used", async () => {
    const plan = await build();
    const linkImport = framework === "react" ? "from 'react-router-dom'" : "from 'next/link'";
    for (const file of plan.files.filter((f) => /page\.tsx$|Page\.tsx$/.test(f.path) && !f.path.includes("NotFound"))) {
      const usesLink = /<Link\s/.test(file.content);
      const usesCss = /css\(\{/.test(file.content);
      const usesImage = /<Image\s/.test(file.content);
      expect(file.content.includes(linkImport), `${file.path} Link import`).toBe(usesLink);
      expect(/import \{ css \}/.test(file.content), `${file.path} css import`).toBe(usesCss);
      if (framework === "nextjs") {
        expect(file.content.includes("from 'next/image'"), `${file.path} Image import`).toBe(usesImage);
      }
    }

    const plain = await build({ elements: [{ id: "t", type: "text", content: "Just text" }] });
    const only = fileOf(plain, framework === "react" ? "src/pages/HomePage.tsx" : "app/page.tsx");
    expect(only).not.toContain("<Link");
    expect(only).not.toContain("next/image");
    expect(only).not.toContain("forgeStyle");
  });

  it("generates safe, working links", async () => {
    const plan = await build();
    const home = fileOf(plan, pagePath("home"));
    const contact = fileOf(plan, pagePath("contact"));
    const internal = framework === "react" ? `<Link to="/about"` : `<Link href="/about"`;

    expect(home).toContain(internal); // page-linked button and menu item
    expect(home).toContain(`<a href="https://docs.example.com/guide?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"`);
    expect(home).toMatch(/<button type="button"[^>]*>Subscribe<\/button>/); // button without a link stays a button
    expect(home).not.toMatch(/<button[^>]*\shref=/); // href is not a valid <button> attribute
    expect(contact).toContain(`<a href="mailto:hello@example.com"`);
    expect(contact).not.toContain("javascript:");
    expect(plan.warnings).toEqual(expect.arrayContaining([expect.stringContaining("unsafe URL scheme")]));
  });

  it("resolves image assets and reports the ones it cannot", async () => {
    const plan = await build();
    const home = fileOf(plan, pagePath("home"));
    const about = fileOf(plan, pagePath("about"));
    const tag = framework === "nextjs" ? "<Image" : "<img";

    expect(home).toContain(`${tag} src="https://images.unsplash.com/photo-1551434678-e076c223a692"`);
    expect(about).not.toMatch(/<(img|Image)\s/); // the image with no source is not rendered as a broken tag
    expect(plan.warnings).toEqual(expect.arrayContaining([expect.stringContaining("Image 'about-no-src' has no usable source")]));

    const local = await build({ elements: [{ id: "up", type: "image", src: "/uploads/hero.png", alt: "Hero" }] });
    expect(local.warnings).toEqual(expect.arrayContaining([expect.stringContaining("not bundled with the export")]));
    const scripted = await build({ elements: [{ id: "x", type: "image", src: "javascript:alert(1)", alt: "x" }] });
    expect(scripted.files.map((f) => f.content).join("\n")).not.toContain("javascript:alert");
  });

  it("carries compiler warnings about unsupported widgets into the plan", async () => {
    expect((await build()).warnings).toEqual(expect.arrayContaining([expect.stringContaining("Widget 'slides'")]));
  });
});

describe("B. framework-specific structure", () => {
  it("React: entrypoint mounts the router and loads generated styles", async () => {
    const plan = await buildReactGenerationPlan(irOf(buildWebsiteFixture(), "react"));
    const main = fileOf(plan, "src/main.tsx");
    expect(main).toContain("<BrowserRouter>");
    expect(main).toContain("import './styles/forge.css';");
    expect(fileOf(plan, "index.html")).toContain(`<script type="module" src="/src/main.tsx"></script>`);
    expect(fileOf(plan, "src/vite-env.d.ts")).toContain(`/// <reference types="vite/client" />`);
  });

  it("Next.js: App Router pages are Server Components with valid segment config and metadata", async () => {
    const plan = await buildNextJsGenerationPlan(irOf(buildWebsiteFixture(), "nextjs"));
    const about = fileOf(plan, "app/about/page.tsx");
    expect(about).not.toContain("use client");
    expect(about).toContain("export const metadata: Metadata = {");
    expect(about).toContain("title: 'About Us',");
    expect(about).toContain("description: 'Who we are and what we\\'re building',");
    expect(about).toContain("export const revalidate = 60;");
    expect(about).toMatch(/export default function AboutUsPage\(\)/);

    const layout = fileOf(plan, "app/layout.tsx");
    expect(layout).toContain("import './globals.css';");
    expect(layout).toContain("import './forge.css';");
    expect(layout).toContain("<html lang=");
    expect(fileOf(plan, "next.config.mjs")).toContain("export default nextConfig;");
    expect(fileOf(plan, "app/sitemap.ts")).toContain(`["/","/about","/contact-us"]`);
  });

  it("Next.js: a page with event handlers is a Client Component without server-only exports", async () => {
    const plan = await buildNextJsGenerationPlan(
      irOf({ elements: [{ id: "b", type: "button", buttonText: "Go", attributes: { onClick: "handleGo" } }] }, "nextjs")
    );
    const page = fileOf(plan, "app/page.tsx");
    expect(page.startsWith(`"use client";`)).toBe(true);
    expect(page).not.toContain("export const revalidate");
    expect(page).not.toContain("export const metadata");
    expect(plan.components.find((c) => c.file === "app/page.tsx")?.isClient).toBe(true);
  });

  it("Next.js: dynamic route params map to bracket folders", async () => {
    const plan = await buildNextJsGenerationPlan(
      irOf({ pages: [{ id: "h", name: "Home", isHome: true }, { id: "p", name: "Post", path: "/blog/:slug" }] }, "nextjs")
    );
    expect(plan.files.map((f) => f.path)).toContain("app/blog/[slug]/page.tsx");
    expect(fileOf(plan, "app/blog/[slug]/page.tsx")).toContain("export const dynamic = 'force-dynamic';");
    expect(fileOf(plan, "app/sitemap.ts")).toContain(`["/"]`);
  });

  it("reports each page's generated file path on the IR for both frameworks", () => {
    expect(irOf(buildWebsiteFixture(), "react").components.map((c) => c.filePath)).toEqual([
      "src/pages/HomePage.tsx",
      "src/pages/AboutUsPage.tsx",
      "src/pages/ContactPage.tsx",
    ]);
    expect(irOf(buildWebsiteFixture(), "nextjs").components.map((c) => c.filePath)).toEqual([
      "app/page.tsx",
      "app/about/page.tsx",
      "app/contact-us/page.tsx",
    ]);
  });
});

describe("renderer helpers", () => {
  it("sanitizeHref only allows navigational schemes", () => {
    expect(sanitizeHref("/about")).toEqual({ href: "/about", blocked: false });
    expect(sanitizeHref("https://example.com")).toEqual({ href: "https://example.com", blocked: false });
    expect(sanitizeHref("#section")).toEqual({ href: "#section", blocked: false });
    expect(sanitizeHref("tel:+123")).toEqual({ href: "tel:+123", blocked: false });
    for (const bad of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "data:text/html,<script>", "vbscript:x", "file:///etc/passwd"]) {
      expect(sanitizeHref(bad)).toEqual({ href: "#", blocked: true });
    }
  });

  it("toComponentIdentifier always yields a valid identifier", () => {
    expect(toComponentIdentifier("about us")).toBe("AboutUs");
    expect(toComponentIdentifier("404")).toBe("Page404");
    expect(toComponentIdentifier("---")).toBe("Page");
    expect(toComponentIdentifier("日本語", "Home")).toBe("Home");
  });
});

describe.each(["react", "nextjs"] as const)("D. %s ZIP export", (framework) => {
  it("produces a structurally valid archive whose contents equal the generated project", async () => {
    const doc = buildWebsiteFixture();
    const zip = await buildProjectZipStream(doc, framework, "full", undefined, { projectName: "Acme Site", projectSlug: "acme-site" });
    const entries = readZip(zip); // throws on bad structure, size or CRC

    const ir = visualDocumentToIR(doc, { id: "x", name: "Acme Site", slug: "acme-site", framework });
    const plan = framework === "react" ? await buildReactGenerationPlan(ir) : await buildNextJsGenerationPlan(ir);

    expect(entries.map((e) => e.name).sort()).toEqual(plan.files.map((f) => f.path).sort());
    for (const file of plan.files) {
      const entry = entries.find((e) => e.name === file.path)!;
      expect(entry.data.toString("utf8"), `ZIP entry ${file.path}`).toBe(file.content);
    }

    const names = entries.map((e) => e.name);
    const required =
      framework === "react"
        ? ["package.json", "index.html", "vite.config.ts", "src/main.tsx", "src/pages/HomePage.tsx", "src/pages/AboutUsPage.tsx", "src/pages/ContactPage.tsx"]
        : ["package.json", "next.config.mjs", "app/layout.tsx", "app/page.tsx", "app/about/page.tsx", "app/contact-us/page.tsx"];
    expect(names).toEqual(expect.arrayContaining(required));
    expect(JSON.parse(entries.find((e) => e.name === "package.json")!.data.toString("utf8")).name).toBe("acme-site");
  });

  it("contains no real secrets, dependencies or unsafe entry names", async () => {
    const entries = readZip(await buildProjectZipStream(buildWebsiteFixture(), framework, "full"));
    for (const entry of entries) {
      expect(entry.name).not.toMatch(/(^|\/)\.\.(\/|$)|^\/|\\|^[a-zA-Z]:/);
      expect(entry.name).not.toMatch(/(^|\/)node_modules\//);
      expect(entry.name).not.toMatch(/(^|\/)\.env$/);
    }
  });
});

describe("D. ZIP packaging safety", () => {
  it("rejects an unsupported export type instead of returning an empty archive", async () => {
    await expect(buildProjectZipStream(buildWebsiteFixture(), "angular" as any, "full")).rejects.toThrow(/Unsupported export type/);
  });

  it("refuses path-traversal entries and omits secrets and node_modules", async () => {
    await expect(buildZipFromFiles([{ path: "../evil.txt", content: "x" }])).rejects.toThrow(/unsafe path/);
    await expect(buildZipFromFiles([{ path: "a/../../evil.txt", content: "x" }])).rejects.toThrow(/unsafe path/);
    await expect(buildZipFromFiles([{ path: "C:\\Windows\\evil.txt", content: "x" }])).rejects.toThrow(/unsafe path/);

    const entries = readZip(
      await buildZipFromFiles([
        { path: "src/a.ts", content: "export const a = 1;" },
        { path: ".env", content: "SECRET=real" },
        { path: ".env.local", content: "SECRET=real" },
        { path: "config/server.pem", content: "KEY" },
        { path: "node_modules/x/index.js", content: "x" },
        { path: ".env.example", content: "SECRET=" },
        { path: "assets/pixel.png", content: "iVBORw0KGgo=", encoding: "base64" },
      ])
    );
    expect(entries.map((e) => e.name).sort()).toEqual([".env.example", "assets/pixel.png", "src/a.ts"]);
    expect(entries.find((e) => e.name === "assets/pixel.png")!.data).toEqual(Buffer.from("iVBORw0KGgo=", "base64"));
  });

  it("fails loudly when there is nothing to export", async () => {
    await expect(buildZipFromFiles([])).rejects.toThrow(/no files to export/);
  });

  it("the test ZIP reader itself rejects corrupt archives", async () => {
    const zip = await buildZipFromFiles([{ path: "a.txt", content: "hello world hello world hello world" }]);
    expect(() => readZip(Buffer.from("<!doctype html><html></html>"))).toThrow(/Not a ZIP archive/);
    const corrupt = Buffer.from(zip);
    corrupt[30 + "a.txt".length + 2] ^= 0xff; // flip a byte inside the compressed data (after the 30-byte local header + name)
    expect(() => readZip(corrupt)).toThrow();
  });
});

describe("E. Critical Fix Regressions: Empty Canvas & Dynamic Naming", () => {
  it("empty canvas produces minimal clean output and NO fake empty state content", async () => {
    const emptyDoc = { elements: [] };
    const reactPlan = await buildReactGenerationPlan(
      visualDocumentToIR(emptyDoc, { id: "empty-1", name: "ABC Store", slug: "abc-store", framework: "react" })
    );

    // 1. Must not scaffold EmptyState.tsx
    const paths = reactPlan.files.map((f) => f.path);
    expect(paths).not.toContain("src/components/EmptyState.tsx");

    // 2. Generated home page must not render fake empty state or fabricated text
    const homeFile = fileOf(reactPlan, "src/pages/HomePage.tsx");
    expect(homeFile).not.toContain("EmptyState");
    expect(homeFile).not.toContain("∅");
    expect(homeFile).not.toContain("This page is ready for your visual elements.");
    expect(homeFile).not.toContain("useAppContext");
    expect(homeFile).not.toContain("useResponsive");

    // 3. Infrastructure must remain valid and parse cleanly
    assertAllSourcesParse(reactPlan.files);

    // 4. Next.js empty canvas
    const nextPlan = await buildNextJsGenerationPlan(
      visualDocumentToIR(emptyDoc, { id: "empty-2", name: "ABC Store", slug: "abc-store", framework: "nextjs" })
    );
    const nextPage = fileOf(nextPlan, "app/page.tsx");
    expect(nextPage).not.toContain("EmptyState");
    expect(nextPage).toContain("export default function HomePage()");
    assertAllSourcesParse(nextPlan.files);
  });

  it("dynamically generates correct component and package names from actual site metadata", async () => {
    const siteDoc = {
      pages: [
        { id: "p1", name: "About Us", slug: "/about-us", elements: [{ id: "h1", type: "heading", content: "About Us" }] },
        { id: "p2", name: "Contact Us", slug: "/contact-us", elements: [{ id: "h2", type: "heading", content: "Contact Us" }] },
        { id: "p3", name: "Product Details", slug: "/product-details", elements: [{ id: "h3", type: "heading", content: "Details" }] },
        { id: "p4", name: "About Us", slug: "/about-us", elements: [{ id: "h4", type: "heading", content: "Second About Us" }] },
        { id: "p5", name: "Function", slug: "/function", elements: [{ id: "h5", type: "heading", content: "Reserved Word" }] },
        { id: "p6", name: "404", slug: "/404-custom", elements: [{ id: "h6", type: "heading", content: "Number Name" }] },
      ],
    };

    const reactPlan = await buildReactGenerationPlan(
      visualDocumentToIR(siteDoc, { id: "abc", name: "ABC Store", slug: "abc-store", framework: "react" })
    );

    // Dynamic package name
    const pkg = JSON.parse(fileOf(reactPlan, "package.json"));
    expect(pkg.name).toBe("abc-store");

    const paths = reactPlan.files.map((f) => f.path);
    // Page filenames match page titles
    expect(paths).toContain("src/pages/AboutUsPage.tsx");
    expect(paths).toContain("src/pages/ContactUsPage.tsx");
    expect(paths).toContain("src/pages/ProductDetailsPage.tsx");
    // Duplicate page name resolved without collision
    expect(paths).toContain("src/pages/AboutUs2Page.tsx");
    // Reserved word and number names handled safely
    expect(paths).toContain("src/pages/PageFunctionPage.tsx");
    expect(paths).toContain("src/pages/Page404Page.tsx");

    // Component source identifiers
    const aboutSource = fileOf(reactPlan, "src/pages/AboutUsPage.tsx");
    expect(aboutSource).toContain("export const AboutUsPage: React.FC");
    expect(aboutSource).not.toContain("AboutUsPagePage");

    const contactSource = fileOf(reactPlan, "src/pages/ContactUsPage.tsx");
    expect(contactSource).toContain("export const ContactUsPage: React.FC");

    const detailsSource = fileOf(reactPlan, "src/pages/ProductDetailsPage.tsx");
    expect(detailsSource).toContain("export const ProductDetailsPage: React.FC");

    // Routes wiring
    const routesSource = fileOf(reactPlan, "src/routes/AppRoutes.tsx");
    expect(routesSource).toContain("import AboutUsPage from '../pages/AboutUsPage';");
    expect(routesSource).toContain("import ContactUsPage from '../pages/ContactUsPage';");
    expect(routesSource).toContain("import ProductDetailsPage from '../pages/ProductDetailsPage';");
    expect(routesSource).toContain("import AboutUs2Page from '../pages/AboutUs2Page';");

    // Valid syntax across all files
    assertAllSourcesParse(reactPlan.files);
  });

  it("produces a minimal, document-driven project structure without unused boilerplate scaffold", async () => {
    const singleParaDoc = {
      pages: [
        {
          id: "home",
          name: "abc",
          slug: "/",
          isHome: true,
          elements: [
            {
              id: "el_text_1",
              type: "text",
              content: "Hey This is for testing purpose . Am i able to generate the code yes or no....",
            },
          ],
        },
      ],
    };

    const reactPlan = await buildReactGenerationPlan(
      visualDocumentToIR(singleParaDoc, { id: "p-abc", name: "abc", slug: "abc", framework: "react" })
    );

    const paths = new Set(reactPlan.files.map((f) => f.path));

    // 1. Required runtime infrastructure and config must be present
    expect(paths.has("package.json")).toBe(true);
    expect(paths.has("tsconfig.json")).toBe(true);
    expect(paths.has("vite.config.ts")).toBe(true);
    expect(paths.has("index.html")).toBe(true);
    expect(paths.has("src/main.tsx")).toBe(true);
    expect(paths.has("src/App.tsx")).toBe(true);
    expect(paths.has("src/routes/AppRoutes.tsx")).toBe(true);
    expect(paths.has("src/pages/AbcPage.tsx")).toBe(true);
    expect(paths.has("src/pages/NotFoundPage.tsx")).toBe(true);
    expect(paths.has("src/components/ErrorBoundary.tsx")).toBe(true);
    expect(paths.has("src/index.css")).toBe(true);
    expect(paths.has("src/styles/forge.css")).toBe(true);
    expect(paths.has("src/lib/forgeStyle.ts")).toBe(true);
    expect(paths.has("src/vite-env.d.ts")).toBe(true);

    // 2. Unused boilerplate scaffold must NOT be generated
    expect(paths.has("src/contexts/AppContext.tsx")).toBe(false);
    expect(paths.has("src/hooks/useApi.ts")).toBe(false);
    expect(paths.has("src/hooks/useResponsive.ts")).toBe(false);
    expect(paths.has("src/services/apiClient.ts")).toBe(false);
    expect(paths.has("src/components/LoadingSpinner.tsx")).toBe(false);
    expect(paths.has("src/components/EmptyState.tsx")).toBe(false);
    expect(paths.has("src/tests/App.test.tsx")).toBe(false);
    expect(paths.has("src/tests/setup.ts")).toBe(false);
    expect(paths.has("vitest.config.ts")).toBe(false);
    expect(paths.has("eslint.config.js")).toBe(false);

    // 3. Main entrypoint uses ErrorBoundary directly without AppProvider
    const mainContent = fileOf(reactPlan, "src/main.tsx");
    expect(mainContent).toContain("<ErrorBoundary>");
    expect(mainContent).toContain("<BrowserRouter>");
    expect(mainContent).not.toContain("AppProvider");
    expect(mainContent).not.toContain("AppContext");

    // 4. AppRoutes renders clean Routes without Suspense or LoadingSpinner
    const routesContent = fileOf(reactPlan, "src/routes/AppRoutes.tsx");
    expect(routesContent).toContain("<Route path=\"/\" element={<AbcPage />} />");
    expect(routesContent).toContain("<Route path=\"*\" element={<NotFoundPage />} />");
    expect(routesContent).not.toContain("LoadingSpinner");
    expect(routesContent).not.toContain("<Suspense");

    // 5. Page content faithfully renders the exact canvas paragraph
    const pageContent = fileOf(reactPlan, "src/pages/AbcPage.tsx");
    expect(pageContent).toContain("Hey This is for testing purpose . Am i able to generate the code yes or no....");
    expect(pageContent).not.toContain("EmptyState");
    expect(pageContent).not.toContain("useAppContext");

    // 6. Valid syntax
    assertAllSourcesParse(reactPlan.files);
  });
});

describe("G. Bidirectional Visual-Code Synchronization & AST Transformation", () => {
  it("Scenario A: Visual to Code - adds button and removes paragraph faithfully", async () => {
    // 1. Initial page with heading and paragraph
    const initialDoc = {
      pages: [
        {
          id: "p1",
          name: "Home",
          slug: "/",
          isHome: true,
          elements: [
            { id: "el_h1", type: "heading", content: "Welcome to Forge" },
            { id: "el_p1", type: "text", content: "This is an introductory paragraph." },
          ],
        },
      ],
    };

    const initialPlan = await buildReactGenerationPlan(
      visualDocumentToIR(initialDoc, { id: "p1", name: "Test Site", slug: "test-site", framework: "react" })
    );
    const initialPage = fileOf(initialPlan, "src/pages/HomePage.tsx");
    expect(initialPage).toContain("Welcome to Forge");
    expect(initialPage).toContain("This is an introductory paragraph.");
    expect(initialPage).toContain('data-forge-id="el_h1"');
    expect(initialPage).toContain('data-forge-id="el_p1"');

    // 2. Visual modification: add button, remove paragraph
    const updatedDoc = {
      pages: [
        {
          id: "p1",
          name: "Home",
          slug: "/",
          isHome: true,
          elements: [
            { id: "el_h1", type: "heading", content: "Welcome to Forge" },
            { id: "el_btn1", type: "button", content: "Get Started Now", href: "/signup" },
          ],
        },
      ],
    };

    const updatedPlan = await buildReactGenerationPlan(
      visualDocumentToIR(updatedDoc, { id: "p1", name: "Test Site", slug: "test-site", framework: "react" })
    );
    const updatedPage = fileOf(updatedPlan, "src/pages/HomePage.tsx");
    expect(updatedPage).toContain("Welcome to Forge");
    expect(updatedPage).toContain("Get Started Now");
    expect(updatedPage).toContain('data-forge-id="el_btn1"');
    expect(updatedPage).not.toContain("This is an introductory paragraph.");
    assertAllSourcesParse(updatedPlan.files);
  });

  it("Scenario B: Code to Visual - parses TSX AST into visual document and preserves IDs", () => {
    const code = `
import React from "react";

export default function HomePage() {
  return (
    <div data-forge-id="container_root" className="container mx-auto p-8" style={{ backgroundColor: "#0f172a" }}>
      <h1 data-forge-id="el_heading" className="text-3xl font-bold text-white">Modified Heading from Code Workspace</h1>
      <p data-forge-id="el_intro" className="text-slate-300 mt-2">New intro text written directly in Monaco editor.</p>
      <button data-forge-id="el_action" className="px-4 py-2 bg-blue-600 text-white rounded mt-4">Explore Platform</button>
    </div>
  );
}
`;

    const existingElements = [
      { id: "container_root", type: "container", children: [] },
      { id: "el_heading", type: "heading", content: "Original Heading" },
      { id: "el_intro", type: "text", content: "Original text" },
      { id: "el_action", type: "button", content: "Original Button" },
    ];

    const result = parseSourceCodeToElements(code, existingElements, "src/pages/HomePage.tsx");
    expect(result.success).toBe(true);
    expect(result.elements).toHaveLength(1);

    const rootContainer = result.elements[0];
    expect(rootContainer.id).toBe("container_root");
    expect(rootContainer.type).toBe("container");
    expect(rootContainer.styles.backgroundColor).toBe("#0f172a");

    const children = rootContainer.children;
    expect(children).toHaveLength(3);

    // Heading updated from code
    expect(children[0].id).toBe("el_heading");
    expect(children[0].type).toBe("heading");
    expect(children[0].content).toBe("Modified Heading from Code Workspace");

    // Paragraph updated from code
    expect(children[1].id).toBe("el_intro");
    expect(children[1].type).toBe("text");
    expect(children[1].content).toBe("New intro text written directly in Monaco editor.");

    // Button updated from code
    expect(children[2].id).toBe("el_action");
    expect(children[2].type).toBe("button");
    expect(children[2].content).toBe("Explore Platform");
  });

  it("Scenario B2: Code to Visual - generates precise diagnostics for unsupported React hooks without corrupting elements", () => {
    const codeWithHook = `
import React, { useState, useEffect } from "react";

export default function CustomPage() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    console.log("Mounted");
  }, []);

  return (
    <div data-forge-id="root_box" className="p-4">
      <h2 data-forge-id="box_title">Declarative Title</h2>
    </div>
  );
}
`;

    const result = parseSourceCodeToElements(codeWithHook, [], "src/pages/CustomPage.tsx");
    expect(result.success).toBe(true);

    // Diagnostics should record the unsupported hooks
    const hookDiags = result.diagnostics.filter((d) => d.code === "UNSUPPORTED_HOOK");
    expect(hookDiags.length).toBeGreaterThan(0);
    expect(hookDiags.some((d) => d.message.includes("useState"))).toBe(true);
    expect(hookDiags.some((d) => d.message.includes("useEffect"))).toBe(true);

    // The declarative JSX element tree is still faithfully extracted!
    expect(result.elements[0].id).toBe("root_box");
    expect(result.elements[0].children[0].content).toBe("Declarative Title");
  });

  it("Scenario B3: Code to Visual - rejects invalid syntax without partial document corruption", () => {
    const brokenCode = `
import React from "react";
export default function Broken() {
  return (
    <div>
      <h1>Unclosed tag
  );
}
`;

    const validation = validateSourceSyntax(brokenCode);
    expect(validation.isValid).toBe(false);
    expect(validation.diagnostics.length).toBeGreaterThan(0);
    expect(validation.diagnostics[0].severity).toBe("error");

    const fallbackElements = [{ id: "keep_safe", type: "heading", content: "Safe Existing Data" }];
    const parseResult = parseSourceCodeToElements(brokenCode, fallbackElements);
    expect(parseResult.success).toBe(false);
    // Original elements must not be corrupted
    expect(parseResult.elements).toEqual(fallbackElements);
  });

  it("Scenario C: Source preservation - protected regions survive targeted synchronization", () => {
    const codeWithProtected = `
import React from "react";

// [forge-protect-start: custom-analytics]
export function trackEvent(name: string) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name });
}
// [forge-protect-end: custom-analytics]

export default function AnalyticsView() {
  return (
    <div data-forge-id="box">
      <h1 data-forge-id="el_title">Analytics Dashboard</h1>
    </div>
  );
}
`;

    const regions = visualCodeSyncService.extractProtectedRegions(codeWithProtected);
    expect(regions.has("custom-analytics")).toBe(true);
    expect(regions.get("custom-analytics")).toContain("window.dataLayer.push");

    const newCode = `
import React from "react";

export default function AnalyticsView() {
  return (
    <div data-forge-id="box">
      <h1 data-forge-id="el_title">Updated Analytics Dashboard</h1>
    </div>
  );
}
`;

    const restored = visualCodeSyncService.injectProtectedRegions(newCode, regions);
    expect(restored).toContain("// [forge-protect-start: custom-analytics]");
    expect(restored).toContain("window.dataLayer.push({ event: name });");
    expect(restored).toContain("// [forge-protect-end: custom-analytics]");
  });
});



