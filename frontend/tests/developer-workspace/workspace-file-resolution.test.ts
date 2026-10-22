// @vitest-environment jsdom
/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Developer Workspace file / route resolution helpers (features/developer-workspace/utils/
 * workspaceFileResolution.ts, moved verbatim from pages/DeveloperWorkspace.tsx). Pins which files count
 * as pages, the default file chosen for a project and the file chosen for a route, and that the page
 * module still re-exports the same functions.
 */
import * as helpers from "../../src/features/developer-workspace/utils/workspaceFileResolution";
import * as page from "../../src/features/developer-workspace/pages/DeveloperWorkspace";

const { isHelperOrNonPageFile, resolveDefaultWorkspaceFile, resolveFileForRoute } = helpers;
const tree = (...paths: string[]) => paths.map((p) => ({ name: p.split("/").pop(), path: p, isDirectory: false })) as any[];
const nested = [
  { name: "src", path: "src", isDirectory: true, children: [
    { name: "pages", path: "src/pages", isDirectory: true, children: tree("src/pages/AboutPage.tsx", "src/pages/EmptyState.tsx") },
    { name: "components", path: "src/components", isDirectory: true, children: tree("src/components/Hero.tsx") },
  ] },
  ...tree("src/App.tsx"),
] as any[];

describe("DeveloperWorkspace re-exports", () => {
  it("re-exports the same helper functions", () => {
    expect(page.isHelperOrNonPageFile).toBe(helpers.isHelperOrNonPageFile);
    expect(page.resolveDefaultWorkspaceFile).toBe(helpers.resolveDefaultWorkspaceFile);
    expect(page.resolveFileForRoute).toBe(helpers.resolveFileForRoute);
    expect(typeof page.DeveloperWorkspace).toBe("function");
    expect(page.default).toBe(page.DeveloperWorkspace);
  });
});

describe("isHelperOrNonPageFile", () => {
  it.each([
    ["src/components/Button.tsx", true],
    ["/components/Card.tsx", true],
    ["app/components/Nav.tsx", true],
    ["src\\utils\\format.ts", true],
    ["public/logo.svg", true],
    ["src/pages/EmptyState.tsx", true],
    ["Button.jsx", true],
    ["src/pages/HomePage.tsx", false],
    ["app/page.tsx", false],
    ["src/App.tsx", false],
  ])("%s -> %s", (p, expected) => expect(isHelperOrNonPageFile(p)).toBe(expected));
});

describe("resolveDefaultWorkspaceFile", () => {
  it("returns null for an empty tree", () => expect(resolveDefaultWorkspaceFile([], null)).toBeNull());
  it("prefers the home page from the pages registry", () => {
    const pages = [{ routePath: "/about", filePath: "src/pages/AboutPage.tsx" }, { routePath: "/", isHome: true, filePath: "src/pages/HomePage.tsx" }] as any[];
    expect(resolveDefaultWorkspaceFile(tree("src/pages/HomePage.tsx", "src/pages/AboutPage.tsx"), null, pages)).toBe("src/pages/HomePage.tsx");
  });
  it("skips registry pages that are helpers or missing, then uses another registry page", () => {
    const pages = [{ routePath: "/", isHome: true, filePath: "src/components/EmptyState.tsx" }, { routePath: "/x", filePath: "src/pages/Missing.tsx" }, { routePath: "/about", filePath: "src/pages/AboutPage.tsx" }] as any[];
    expect(resolveDefaultWorkspaceFile(tree("src/components/EmptyState.tsx", "src/pages/AboutPage.tsx"), null, pages)).toBe("src/pages/AboutPage.tsx");
  });
  it("uses the manifest entry point", () => {
    expect(resolveDefaultWorkspaceFile(tree("src/main.tsx", "src/Entry.tsx"), { build: { entryPoint: "src/Entry.tsx" } })).toBe("src/Entry.tsx");
  });
  it("falls back to Next.js, React page, src/pages, app shell and any source file, in that order", () => {
    expect(resolveDefaultWorkspaceFile(tree("src/App.tsx", "app/page.tsx"), null)).toBe("app/page.tsx");
    expect(resolveDefaultWorkspaceFile(tree("src/App.tsx", "src/pages/IndexPage.jsx"), null)).toBe("src/pages/IndexPage.jsx");
    expect(resolveDefaultWorkspaceFile(nested, null)).toBe("src/pages/AboutPage.tsx");
    expect(resolveDefaultWorkspaceFile(tree("src/components/Hero.tsx", "src/main.tsx", "index.html"), null)).toBe("src/main.tsx");
    expect(resolveDefaultWorkspaceFile(tree("src/components/Hero.tsx", "lib/x.ts", "feature.test.tsx", "other/thing.ts"), null)).toBe("other/thing.ts");
    expect(resolveDefaultWorkspaceFile(tree("src/components/Hero.tsx", "README.md"), null)).toBeNull();
  });
});

describe("resolveFileForRoute", () => {
  const pages = [{ routePath: "/About", filePath: "src/pages/AboutPage.tsx" }, { routePath: "/helper", filePath: "src/components/Helper.tsx" }] as any[];
  it("matches the pages registry (case-insensitive)", () => expect(resolveFileForRoute("/about", [], pages)).toBe("src/pages/AboutPage.tsx"));
  it("uses the home page for / when no route matches", () => {
    expect(resolveFileForRoute("/", [], [{ routePath: "/home", isHome: true, filePath: "src/pages/Start.tsx" }] as any[])).toBe("src/pages/Start.tsx");
  });
  it("ignores helper files and falls back to file-name heuristics", () => {
    expect(resolveFileForRoute("/helper", tree("src/pages/helper.tsx"), pages)).toBe("src/pages/helper.tsx");
    expect(resolveFileForRoute("/contact", tree("src/pages/ContactPage.tsx"), [])).toBe("src/pages/ContactPage.tsx");
    expect(resolveFileForRoute("/blog/", tree("app/blog/page.tsx"), [])).toBe("app/blog/page.tsx");
    expect(resolveFileForRoute("", tree("pages/index.tsx"), [])).toBe("pages/index.tsx");
    expect(resolveFileForRoute("/", tree("src/pages/homepage.tsx"), [])).toBe("src/pages/homepage.tsx");
  });
  it("returns null when nothing matches", () => expect(resolveFileForRoute("/nope", nested, [])).toBeNull());
});
