/**
 * Source preview: bundles the project's persisted source files and returns a
 * self-contained HTML document that runs them. What the preview shows is the
 * code in the project filesystem (the same files the ZIP export contains), not
 * the visual document.
 *
 * React + Vite projects run from their real entrypoint (src/main.tsx). Next.js
 * App Router projects run their `app/**\/page.tsx` components through a small
 * client-side router; the root layout and server-only features are not executed.
 */
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listFiles } from "../project/forgeFilesystem.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface PreviewSourceFile {
  path: string;
  content: string;
}

export interface PreviewError {
  file?: string;
  line?: number;
  column?: number;
  message: string;
}

export interface SourceBundle {
  ok: boolean;
  js: string;
  css: string;
  errors: PreviewError[];
  warnings: string[];
  /** "local": every package was bundled from disk; "cdn": packages load from esm.sh in the browser */
  mode: "local" | "cdn";
  importMap: Record<string, string>;
  routes: string[];
  metafile?: any;
}

export interface SourcePreviewResult {
  success: boolean;
  html: string;
  framework: "react" | "nextjs";
  route: string;
  routes: string[];
  errors: PreviewError[];
  warnings: string[];
  mode: "local" | "cdn";
  sourceHash: string;
  metafile?: any;
}

const SOURCE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json", ".css"];
const ENTRY = "forge-entry.tsx";
const VIRTUAL = "forge-virtual";
const REAL_PREFIX = "forge-real:";

const vendorDirs = Array.from(
  new Set([
    path.resolve(process.cwd(), "../frontend"),
    path.resolve(__dirname, "../../../../frontend"),
    process.cwd(),
    path.resolve(__dirname, "../../.."),
  ])
);

const DEDUPE_PACKAGES = new Set([
  "react",
  "react-dom",
  "scheduler",
  "react-router",
  "react-router-dom",
]);

function loaderFor(filePath: string): "tsx" | "ts" | "jsx" | "js" | "json" | "css" | "text" {
  const ext = path.posix.extname(filePath).toLowerCase();
  if (ext === ".tsx") return "tsx";
  if (ext === ".ts" || ext === ".mts") return "ts";
  if (ext === ".jsx") return "jsx";
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") return "js";
  if (ext === ".json") return "json";
  if (ext === ".css") return "css";
  return "text";
}

function resolveInProject(files: Map<string, string>, framework: "react" | "nextjs", importer: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = `${framework === "nextjs" ? "" : "src/"}${spec.slice(2)}`;
  else if (spec.startsWith("/")) base = spec.slice(1);
  else base = path.posix.normalize(path.posix.join(path.posix.dirname(importer), spec));
  if (base.startsWith("../") || base === "..") return null;

  const candidates = [base, ...SOURCE_EXTENSIONS.map((ext) => `${base}${ext}`), ...SOURCE_EXTENSIONS.map((ext) => `${base}/index${ext}`)];
  return candidates.find((candidate) => files.has(candidate)) ?? null;
}

function packageName(spec: string): string {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

const REACT_ROUTER_SHIM = `
export * from "${REAL_PREFIX}react-router-dom";
import { MemoryRouter, useLocation } from "${REAL_PREFIX}react-router-dom";
import { createElement, useEffect } from "react";

function RouteReporter() {
  const location = useLocation();
  useEffect(() => {
    try { window.parent.postMessage({ type: "forge:preview:route-changed", route: location.pathname }, "*"); } catch {}
  }, [location.pathname]);
  return null;
}

// The preview document has no URL of its own, so routing is kept in memory
export function BrowserRouter(props: any) {
  return createElement(
    MemoryRouter,
    { initialEntries: [(window as any).__FORGE_PREVIEW_ROUTE__ || "/"] },
    createElement(RouteReporter),
    props.children
  );
}
export const HashRouter = BrowserRouter;
`;

const NEXT_SHIMS: Record<string, string> = {
  "next/link": `
import { createElement } from "react";
export default function Link({ href, children, prefetch, replace, scroll, shallow, passHref, legacyBehavior, ...rest }: any) {
  const to = typeof href === "string" ? href : (href && href.pathname) || "/";
  return createElement("a", {
    ...rest,
    href: to,
    onClick: (event: any) => {
      if (rest.onClick) rest.onClick(event);
      if (!event.defaultPrevented && to.startsWith("/") && !to.startsWith("//") && rest.target !== "_blank") {
        event.preventDefault();
        (window as any).__forgeNavigate?.(to);
      }
    },
  }, children);
}
`,
  "next/image": `
import { createElement } from "react";
export default function Image({ src, alt, width, height, fill, priority, quality, placeholder, blurDataURL, loader, unoptimized, sizes, style, ...rest }: any) {
  const url = typeof src === "string" ? src : (src && src.src) || "";
  const fillStyle = fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : {};
  return createElement("img", { ...rest, src: url, alt: alt ?? "", width: fill ? undefined : width, height: fill ? undefined : height, loading: priority ? "eager" : "lazy", style: { ...fillStyle, ...(style || {}) } });
}
`,
  "next/navigation": `
const go = (to: string) => (window as any).__forgeNavigate?.(to);
export function useRouter() { return { push: go, replace: go, back() {}, forward() {}, refresh() {}, prefetch() {} }; }
export function usePathname() { return (window as any).__FORGE_PREVIEW_PATH__ || "/"; }
export function useSearchParams() { return new URLSearchParams(); }
export function useParams() { return (window as any).__FORGE_PREVIEW_PARAMS__ || {}; }
export function notFound(): never { throw new Error("notFound() was called"); }
export function redirect(to: string): never { go(to); throw new Error("redirect(" + to + ")"); }
`,
  next: `export {};`,
  "next/server": `export {};`,
};

/** App Router page files -> route patterns ("app/blog/[slug]/page.tsx" -> "/blog/:slug") */
export function discoverNextRoutes(paths: Iterable<string>): Array<{ route: string; file: string }> {
  const routes: Array<{ route: string; file: string }> = [];
  for (const file of paths) {
    const match = file.match(/^app\/(?:(.*)\/)?page\.(tsx|jsx|ts|js)$/);
    if (!match) continue;
    const segments = (match[1] || "")
      .split("/")
      .filter((segment) => segment && !/^\(.*\)$/.test(segment) && !segment.startsWith("@"));
    if (segments.some((segment) => segment.startsWith("_") || segment === "api")) continue;
    const route = `/${segments.map((s) => (/^\[.+\]$/.test(s) ? `:${s.slice(1, -1).replace(/^\.\.\./, "")}` : s)).join("/")}`;
    routes.push({ route, file });
  }
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}

function nextEntrySource(files: Map<string, string>): { source: string; routes: string[] } {
  const routes = discoverNextRoutes(files.keys());
  const styles = ["app/globals.css", "app/forge.css"].filter((file) => files.has(file));
  const notFound = ["app/not-found.tsx", "app/not-found.jsx"].find((file) => files.has(file));
  const strip = (file: string) => `./${file.replace(/\.(tsx|jsx|ts|js)$/, "")}`;

  const source = `
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
${styles.map((file) => `import "./${file}";`).join("\n")}
${routes.map((r, i) => `import Page${i} from "${strip(r.file)}";`).join("\n")}
${notFound ? `import NotFound from "${strip(notFound)}";` : "const NotFound = () => <div style={{ padding: 24 }}>404 - This page could not be found.</div>;"}

const routes: Array<{ pattern: string; Component: any }> = [
${routes.map((r, i) => `  { pattern: ${JSON.stringify(r.route)}, Component: Page${i} },`).join("\n")}
];

function clean(path: string) {
  const bare = (path.split(/[?#]/)[0] || "/").replace(/\\/+$/, "");
  return bare || "/";
}

function match(path: string) {
  const parts = clean(path).split("/").filter(Boolean);
  for (const route of routes) {
    const segments = route.pattern.split("/").filter(Boolean);
    if (segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (segments.every((segment, i) => (segment.startsWith(":") ? ((params[segment.slice(1)] = decodeURIComponent(parts[i])), true) : segment === parts[i]))) {
      return { route, params };
    }
  }
  return null;
}

function App() {
  const [path, setPath] = useState<string>(clean((window as any).__FORGE_PREVIEW_ROUTE__ || "/"));
  (window as any).__FORGE_PREVIEW_PATH__ = path;
  useEffect(() => {
    (window as any).__forgeNavigate = (to: string) => { setPath(clean(to)); window.scrollTo(0, 0); };
  }, []);
  useEffect(() => {
    try { window.parent.postMessage({ type: "forge:preview:route-changed", route: path }, "*"); } catch {}
  }, [path]);
  const found = match(path);
  if (!found) return <NotFound />;
  (window as any).__FORGE_PREVIEW_PARAMS__ = found.params;
  const Page = found.route.Component;
  return <Page params={Promise.resolve(found.params)} searchParams={Promise.resolve({})} />;
}

createRoot(document.getElementById("root")!).render(<App />);
`;
  return { source, routes: routes.map((r) => r.route) };
}

function reactEntrySource(files: Map<string, string>): string | null {
  const main = ["src/main.tsx", "src/main.jsx", "src/main.ts", "src/main.js", "src/index.tsx", "src/index.jsx"].find((file) =>
    files.has(file)
  );
  return main ? `import "./${main.replace(/\.(tsx|jsx|ts|js)$/, "")}";\n` : null;
}

async function runBundle(
  files: Map<string, string>,
  framework: "react" | "nextjs",
  entrySource: string,
  mode: "local" | "cdn"
): Promise<{ js: string; css: string; errors: PreviewError[]; warnings: string[]; unresolved: Set<string>; externals: Set<string>; metafile?: any }> {
  const esbuild = await import("esbuild");
  const unresolved = new Set<string>();
  const externals = new Set<string>();
  const shims: Record<string, string> = framework === "nextjs" ? NEXT_SHIMS : { "react-router-dom": REACT_ROUTER_SHIM };

  const plugin = {
    name: "forge-project-source",
    setup(build: any) {
      build.onResolve({ filter: /.*/ }, async (args: any) => {
        if (args.pluginData?.forgeDisk) return undefined;
        if (args.kind === "entry-point") return { path: ENTRY, namespace: VIRTUAL };
        let spec: string = args.path;
        const real = spec.startsWith(REAL_PREFIX);
        if (real) spec = spec.slice(REAL_PREFIX.length);

        const isDedupe = DEDUPE_PACKAGES.has(packageName(spec));
        // Inside packages read from disk, the default resolution applies,
        // EXCEPT for singleton packages (React, React-DOM, Scheduler, React-Router) which must be deduplicated
        if (args.namespace === "file" && !isDedupe) return undefined;
        if (/^(https?:)?\/\//.test(args.path) || args.path.startsWith("data:")) return { path: args.path, external: true };

        const isProjectPath = spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/");
        if (isProjectPath) {
          const importer = args.namespace === VIRTUAL ? ENTRY : args.importer;
          const resolved = resolveInProject(files, framework, importer, spec);
          if (resolved) return { path: resolved, namespace: "vfs" };
          return { errors: [{ text: `Cannot find module '${spec}' imported from ${importer === ENTRY ? "the preview entry" : importer}` }] };
        }

        if (!real && shims[spec] !== undefined) return { path: `shim:${spec}`, namespace: VIRTUAL };

        if (mode === "local") {
          for (const dir of vendorDirs) {
            const found = await build.resolve(spec, { resolveDir: dir, kind: args.kind, pluginData: { forgeDisk: true } });
            if (found.errors.length === 0 && found.path) return { path: found.path, namespace: found.namespace, sideEffects: found.sideEffects };
          }
          unresolved.add(packageName(spec));
        }
        externals.add(spec);
        return { path: spec, external: true };
      });

      build.onLoad({ filter: /.*/, namespace: VIRTUAL }, (args: any) => {
        if (args.path === ENTRY) return { contents: entrySource, loader: "tsx" };
        return { contents: shims[args.path.slice("shim:".length)] ?? "export {};", loader: "tsx" };
      });

      build.onLoad({ filter: /.*/, namespace: "vfs" }, (args: any) => {
        let contents = files.get(args.path) ?? "";
        const loader = loaderFor(args.path);
        // Tailwind is compiled for the preview after bundling
        if (loader === "css") contents = contents.replace(/@import\s+["']tailwindcss[^"']*["'][^;]*;/g, "");
        return { contents, loader };
      });
    },
  };

  try {
    const result = await esbuild.build({
      entryPoints: [ENTRY],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      target: "es2020",
      jsx: "automatic",
      outdir: "forge-preview-out",
      logLevel: "silent",
      metafile: true,
      plugins: [plugin],
      define: {
        "process.env.NODE_ENV": '"development"',
        "process.env": "{}",
        "import.meta.env": '{"MODE":"development","DEV":true,"PROD":false,"SSR":false,"BASE_URL":"/"}',
      },
    });
    const js = result.outputFiles.filter((f) => f.path.endsWith(".js")).map((f) => f.text).join("\n");
    const css = result.outputFiles.filter((f) => f.path.endsWith(".css")).map((f) => f.text).join("\n");
    return { js, css, errors: [], warnings: result.warnings.map((w) => w.text), unresolved, externals, metafile: result.metafile };
  } catch (err: any) {
    const errors: PreviewError[] = Array.isArray(err?.errors)
      ? err.errors.map((e: any) => ({
          file: e.location?.file ? String(e.location.file).replace(/^vfs:/, "") : undefined,
          line: e.location?.line,
          column: e.location?.column,
          message: e.text,
        }))
      : [{ message: err?.message || "The project source could not be bundled" }];
    return { js: "", css: "", errors, warnings: [], unresolved, externals };
  }
}

function dependencyVersions(files: Map<string, string>): Record<string, string> {
  try {
    const pkg = JSON.parse(files.get("package.json") || "{}");
    return { ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) };
  } catch {
    return {};
  }
}

function buildImportMap(externals: Set<string>, versions: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  const all = new Set([...externals, "react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"]);
  for (const spec of all) {
    const name = packageName(spec);
    const version = String(versions[name] || "").replace(/^[\^~>=<\s]+/, "").split(/\s/)[0];
    const pinned = /^\d/.test(version) ? `${name}@${version}` : name;
    const subpath = spec.slice(name.length);
    const external = name === "react" ? "" : name === "react-dom" ? "?external=react" : "?external=react,react-dom";
    map[spec] = `https://esm.sh/${pinned}${subpath}${external}`;
  }
  return map;
}

/** Compile the Tailwind utilities the bundled source uses (the generated projects style with Tailwind classes) */
async function compileTailwind(css: string, files: Map<string, string>, warnings: string[]): Promise<string> {
  const imports: string[] = [];
  const body = css.replace(/^\s*@import\s+[^;]+;/gm, (line) => {
    imports.push(line.trim());
    return "";
  });
  try {
    const postcss = (await import("postcss")).default;
    const tailwindcss = (await import("tailwindcss")).default as any;
    const raw = Array.from(files.entries())
      .filter(([file]) => /\.(tsx|jsx|ts|js|html)$/.test(file))
      .map(([, content]) => content)
      .join("\n");
    const compiled = await postcss([
      tailwindcss({ content: [{ raw, extension: "tsx" }], theme: {}, plugins: [] }),
    ]).process(`@tailwind base;\n@tailwind components;\n@tailwind utilities;\n${body}`, { from: undefined });
    return `${imports.join("\n")}\n${compiled.css}`;
  } catch (err: any) {
    warnings.push(`Tailwind utilities could not be compiled for the preview: ${err?.message || err}`);
    return css;
  }
}

function discoverReactRoutes(files: Map<string, string>): string[] {
  const routes = new Set<string>(["/"]);
  const routerFile = files.get("src/routes/AppRoutes.tsx") || files.get("src/App.tsx") || "";
  if (routerFile) {
    const routeMatches = routerFile.matchAll(/path=["']([^"']+)["']/g);
    for (const m of routeMatches) {
      const r = m[1];
      if (r && r !== "*") {
        routes.add(r.startsWith("/") ? r : `/${r}`);
      }
    }
  }
  for (const file of files.keys()) {
    const match = file.match(/^src\/pages\/(.+)\.(tsx|jsx|ts|js)$/);
    if (!match) continue;
    let name = match[1];
    if (name.endsWith("Page")) name = name.slice(0, -4);
    if (name.toLowerCase() === "home" || name.toLowerCase() === "index") continue;
    if (name.toLowerCase() === "notfound") continue;
    const slug = `/${name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
    routes.add(slug);
  }
  return Array.from(routes).sort();
}

/** Bundle a set of project source files for the browser. Pure: touches no storage. */
export async function bundleProjectSource(
  sourceFiles: PreviewSourceFile[],
  framework: "react" | "nextjs"
): Promise<SourceBundle> {
  const files = new Map(sourceFiles.map((f) => [f.path, f.content ?? ""]));
  const warnings: string[] = [];
  let entrySource: string | null;
  let routes: string[] = [];

  if (framework === "nextjs") {
    const entry = nextEntrySource(files);
    entrySource = entry.routes.length > 0 ? entry.source : null;
    routes = entry.routes;
  } else {
    entrySource = reactEntrySource(files);
    routes = discoverReactRoutes(files);
  }

  if (!entrySource) {
    return {
      ok: false,
      js: "",
      css: "",
      errors: [
        {
          message:
            framework === "nextjs"
              ? "No app/**/page.tsx route was found in the project source."
              : "No src/main.tsx entrypoint was found in the project source.",
        },
      ],
      warnings,
      mode: "local",
      importMap: {},
      routes,
    };
  }

  let mode: "local" | "cdn" = "local";
  let built = await runBundle(files, framework, entrySource, "local");
  if (built.errors.length === 0 && built.unresolved.size > 0) {
    // A package is not installed on this server: load every package from the CDN so only one React is used
    mode = "cdn";
    warnings.push(`Loaded from esm.sh in the browser: ${Array.from(built.unresolved).join(", ")}`);
    built = await runBundle(files, framework, entrySource, "cdn");
  }
  warnings.push(...built.warnings);

  if (built.errors.length > 0) {
    return { ok: false, js: "", css: "", errors: built.errors, warnings, mode, importMap: {}, routes };
  }

  return {
    ok: true,
    js: built.js,
    css: await compileTailwind(built.css, files, warnings),
    errors: [],
    warnings,
    mode,
    importMap: mode === "cdn" ? buildImportMap(built.externals, dependencyVersions(files)) : {},
    routes,
    metafile: built.metafile,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const RUNTIME_SCRIPT = `
(function () {
  function post(type, payload) { try { window.parent.postMessage(Object.assign({ type: type }, payload), "*"); } catch (e) {} }
  function show(message) {
    var box = document.getElementById("forge-preview-error");
    if (!box) {
      box = document.createElement("pre");
      box.id = "forge-preview-error";
      box.style.cssText = "position:fixed;left:0;right:0;bottom:0;max-height:45%;overflow:auto;margin:0;padding:12px 16px;background:#450a0a;color:#fecaca;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;z-index:2147483647";
      document.body.appendChild(box);
    }
    box.textContent += message + "\\n";
  }
  window.addEventListener("error", function (e) { show("Runtime error: " + (e.message || e.error)); post("forge:preview:console", { logType: "error", message: String(e.message || e.error) }); });
  window.addEventListener("unhandledrejection", function (e) { var m = e.reason && e.reason.message ? e.reason.message : String(e.reason); show("Unhandled rejection: " + m); post("forge:preview:console", { logType: "error", message: m }); });
  ["log", "info", "warn", "error"].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      try { post("forge:preview:console", { logType: level === "info" ? "log" : level, message: Array.prototype.map.call(arguments, function (a) { return typeof a === "string" ? a : (a && a.message) || JSON.stringify(a); }).join(" ") }); } catch (e) {}
      return original.apply(console, arguments);
    };
  });
})();
`;

/** Wrap a bundle in a standalone document suitable for an iframe `srcdoc` */
export function renderPreviewDocument(bundle: SourceBundle, route: string): string {
  if (!bundle.ok) {
    const items = bundle.errors
      .map((e) => `<li><strong>${escapeHtml([e.file, e.line].filter(Boolean).join(":") || "Project")}</strong><br />${escapeHtml(e.message)}</li>`)
      .join("");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Preview unavailable</title></head>
<body style="margin:0;font:14px/1.6 system-ui,sans-serif;background:#0f172a;color:#e2e8f0">
<div style="padding:24px"><h1 style="font-size:16px;color:#fca5a5;margin:0 0 4px">The project source does not compile</h1>
<p style="margin:0 0 16px;color:#94a3b8">The preview runs the saved source files. Fix the error below and save again.</p>
<ul style="margin:0;padding-left:18px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px">${items}</ul></div>
</body></html>`;
  }

  const importMap =
    Object.keys(bundle.importMap).length > 0
      ? `<script type="importmap">${JSON.stringify({ imports: bundle.importMap }).replace(/</g, "\\u003c")}</script>`
      : "";
  const js = bundle.js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
  const css = bundle.css.replace(/<\/style/gi, "<\\/style");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Source preview</title>
<style>${css}</style>
${importMap}
</head>
<body class="antialiased">
<div id="root"></div>
<script>window.__FORGE_PREVIEW_ROUTE__ = ${JSON.stringify(route).replace(/</g, "\\u003c")};${RUNTIME_SCRIPT}</script>
<script type="module">${js}</script>
</body>
</html>`;
}

const bundleCache = new Map<string, { hash: string; bundle: SourceBundle }>();

export function normalizePreviewRoute(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.length > 500) return "/";
  return value;
}

/** Build the preview document for a project's persisted source */
export async function buildSourcePreview(
  projectId: string,
  framework: string,
  route: unknown = "/"
): Promise<SourcePreviewResult> {
  const persisted = (await listFiles(projectId)).filter((f: any) => !f.isDirectory && (f.encoding || "utf-8") === "utf-8");
  const resolvedFramework: "react" | "nextjs" =
    framework === "nextjs" || (framework !== "react" && persisted.some((f: any) => f.path === "next.config.mjs"))
      ? "nextjs"
      : "react";
  const sourceHash = crypto
    .createHash("sha256")
    .update(resolvedFramework)
    .update(JSON.stringify(persisted.map((f: any) => [f.path, f.contentHash]).sort()))
    .digest("hex");

  let cached = bundleCache.get(projectId);
  if (!cached || cached.hash !== sourceHash) {
    const bundle = await bundleProjectSource(
      persisted.map((f: any) => ({ path: f.path, content: f.content || "" })),
      resolvedFramework
    );
    cached = { hash: sourceHash, bundle };
    bundleCache.delete(projectId);
    bundleCache.set(projectId, cached);
    if (bundleCache.size > 20) bundleCache.delete(bundleCache.keys().next().value as string);
  }

  const cleanRoute = normalizePreviewRoute(route);
  return {
    success: cached.bundle.ok,
    html: renderPreviewDocument(cached.bundle, cleanRoute),
    framework: resolvedFramework,
    route: cleanRoute,
    routes: cached.bundle.routes,
    errors: cached.bundle.errors,
    warnings: cached.bundle.warnings,
    mode: cached.bundle.mode,
    sourceHash,
    metafile: cached.bundle.metafile,
  };
}

export const sourcePreviewService = {
  buildSourcePreview,
  bundleProjectSource,
  renderPreviewDocument,
};
