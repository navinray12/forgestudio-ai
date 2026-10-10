/**
 * Build verification for Website-to-Code output.
 *
 * Generates the React and Next.js projects from the representative fixture, writes
 * them to isolated temp directories (once straight from the generator, once by
 * extracting the export ZIP), then runs a real `npm install` + production build and
 * serves each build to check every route and its content.
 *
 * Usage: npm run test:generated-builds [-- --only=react|nextjs] [--source=plan|zip] [--keep]
 * Needs network access for npm (and Google Fonts for the Next.js build). Touches no database.
 */
import { execSync, spawn, ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { visualDocumentToIR } from "../src/services/compiler/unifiedCompiler.service.js";
import { buildReactGenerationPlan } from "../src/services/generator/reactGenerator.service.js";
import { buildNextJsGenerationPlan } from "../src/services/generator/nextjsGenerator.service.js";
import { buildProjectZipStream } from "../src/services/codeGenerator.service.js";
import { buildWebsiteFixture } from "../src/tests/fixtures/website-to-code.fixture.js";
import { readZip } from "../src/tests/helpers/memoryDb.js";

type Framework = "react" | "nextjs";
type Source = "plan" | "zip";

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.split("=")[1] as Framework | undefined;
const sourceArg = args.find((a) => a.startsWith("--source="))?.split("=")[1] as Source | undefined;
const keep = args.includes("--keep");

const ROUTES = ["/", "/about", "/contact-us"];
const PAGE_TEXT: Record<string, string[]> = {
  "/": ["Build faster with Acme", "Read our story"],
  "/about": ["Three levels deep and still here."],
  "/contact-us": ["Send Us a Message", "Email us"],
};

// Importing backend services loads backend/.env (NODE_ENV=development). The generated
// projects must be built in a clean environment, exactly as a user would build them.
const childEnv: NodeJS.ProcessEnv = { ...process.env, CI: "1", NEXT_TELEMETRY_DISABLED: "1" };
for (const key of ["NODE_ENV", "DATABASE_URL", "PORT"]) delete childEnv[key];

const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-w2c-builds-"));
const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function run(cmd: string, cwd: string, label: string) {
  const started = Date.now();
  process.stdout.write(`  $ ${cmd}\n`);
  try {
    const out = execSync(cmd, { cwd, stdio: "pipe", env: childEnv, maxBuffer: 64 * 1024 * 1024 });
    const text = out.toString();
    const tail = text.trim().split(/\r?\n/).slice(-25).join("\n");
    process.stdout.write(`${tail.replace(/^/gm, "    ")}\n    (${label} ok in ${((Date.now() - started) / 1000).toFixed(1)}s)\n`);
    return text;
  } catch (err: any) {
    const output = `${err.stdout?.toString() || ""}\n${err.stderr?.toString() || ""}`;
    throw new Error(`${label} failed (exit ${err.status}):\n${output.trim().split(/\r?\n/).slice(-80).join("\n")}`);
  }
}

function writeFiles(dir: string, files: Array<{ path: string; content: string | Buffer }>) {
  for (const file of files) {
    const target = path.resolve(dir, file.path);
    if (!target.startsWith(path.resolve(dir) + path.sep)) throw new Error(`Refusing to write outside ${dir}: ${file.path}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

function stop(child: ChildProcess) {
  if (!child.pid) return;
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    else child.kill("SIGTERM");
  } catch {
    /* already exited */
  }
}

async function waitFor(url: string, child: ChildProcess, log: () => string, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited early (code ${child.exitCode}):\n${log()}`);
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not start within ${timeoutMs / 1000}s:\n${log()}`);
}

async function serveAndCheck(framework: Framework, dir: string) {
  const port = await freePort();
  const cmd = framework === "nextjs" ? `npx next start -p ${port} -H 127.0.0.1` : `npx vite preview --port ${port} --strictPort --host 127.0.0.1`;
  process.stdout.write(`  $ ${cmd}\n`);
  let output = "";
  const child = spawn(cmd, { cwd: dir, shell: true, env: childEnv });
  child.stdout?.on("data", (d) => (output += d));
  child.stderr?.on("data", (d) => (output += d));

  try {
    const base = `http://127.0.0.1:${port}`;
    await waitFor(base, child, () => output);

    if (framework === "nextjs") {
      // Server-rendered: each route's HTML must carry that page's own content
      for (const route of ROUTES) {
        const res = await fetch(`${base}${route}`);
        const html = await res.text();
        if (res.status !== 200) throw new Error(`GET ${route} -> ${res.status}`);
        for (const text of PAGE_TEXT[route]) {
          if (!html.includes(text)) throw new Error(`GET ${route}: served HTML is missing "${text}"`);
        }
        for (const [other, texts] of Object.entries(PAGE_TEXT)) {
          if (other !== route && html.includes(texts[0])) throw new Error(`GET ${route}: contains content of ${other}`);
        }
        process.stdout.write(`    GET ${route} -> 200, content verified\n`);
      }
      const missing = await fetch(`${base}/this-route-does-not-exist`);
      if (missing.status !== 404) throw new Error(`Unknown route returned ${missing.status}, expected 404`);
      process.stdout.write(`    GET /this-route-does-not-exist -> 404\n`);
      const css = await (await fetch(`${base}/`)).text();
      if (!css.includes(`data-forge-id="hero"`)) throw new Error("Rendered home page lost its responsive hook");
    } else {
      // Client-rendered SPA: every route serves the app shell; content lives in the bundle
      for (const route of ROUTES) {
        const res = await fetch(`${base}${route}`);
        const html = await res.text();
        if (res.status !== 200 || !html.includes(`<div id="root">`)) throw new Error(`GET ${route} -> ${res.status} (no app shell)`);
        process.stdout.write(`    GET ${route} -> 200 (app shell)\n`);
      }
      const shell = await (await fetch(base)).text();
      const scriptSrc = shell.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
      const cssHref = shell.match(/<link[^>]+href="([^"]+\.css)"/)?.[1];
      if (!scriptSrc || !cssHref) throw new Error("Built index.html has no bundled script or stylesheet");
      const js = await (await fetch(`${base}${scriptSrc}`)).text();
      const css = await (await fetch(`${base}${cssHref}`)).text();
      for (const [route, texts] of Object.entries(PAGE_TEXT)) {
        for (const text of texts) if (!js.includes(text)) throw new Error(`Bundle is missing "${text}" (${route})`);
        if (route !== "/" && !js.includes(`"${route}"`)) throw new Error(`Bundle has no route "${route}"`);
      }
      if (!/padding-top:\s*16px\s*!important/.test(css)) throw new Error("Built CSS lost the responsive override");
      process.stdout.write(`    bundle ${scriptSrc}: all page content and routes present; ${cssHref}: responsive rules present\n`);
    }
  } finally {
    stop(child);
  }
}

async function verify(framework: Framework, source: Source) {
  const name = `${framework} (${source === "zip" ? "extracted from export ZIP" : "generator output"})`;
  const dir = path.join(root, `${framework}-${source}`);
  console.log(`\n=== ${name} ===\n  dir: ${dir}`);

  try {
    const doc = buildWebsiteFixture();
    const info = { id: "build-check", name: "Acme Site", slug: "acme-site", framework };
    const plan = framework === "react" ? await buildReactGenerationPlan(visualDocumentToIR(doc, info)) : await buildNextJsGenerationPlan(visualDocumentToIR(doc, info));

    if (source === "zip") {
      const zip = await buildProjectZipStream(doc, framework, "full", undefined, { projectName: "Acme Site", projectSlug: "acme-site" });
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(root, `${framework}.zip`), zip);
      const entries = readZip(zip);
      writeFiles(dir, entries.map((e) => ({ path: e.name, content: e.data })));
      console.log(`  extracted ${entries.length} files from a ${zip.length}-byte ZIP`);
      for (const file of plan.files) {
        if (fs.readFileSync(path.join(dir, file.path), "utf8") !== file.content) throw new Error(`Extracted ${file.path} differs from generated source`);
      }
      console.log(`  extracted files are byte-identical to the generated project`);
    } else {
      writeFiles(dir, plan.files.map((f) => ({ path: f.path, content: f.content })));
      console.log(`  wrote ${plan.files.length} generated files`);
    }

    run("npm install --no-audit --no-fund --loglevel=error", dir, "npm install");
    run("npm run build", dir, "npm run build");
    if (framework === "react") {
      run("npx tsc --noEmit", dir, "type-check");
      if (!fs.existsSync(path.join(dir, "dist", "index.html"))) throw new Error("dist/index.html was not produced");
    } else if (!fs.existsSync(path.join(dir, ".next", "BUILD_ID"))) {
      throw new Error(".next/BUILD_ID was not produced");
    }
    await serveAndCheck(framework, dir);

    results.push({ name, ok: true, detail: "install, build and route checks passed" });
  } catch (err: any) {
    console.error(`\n  FAILED: ${err.message}\n`);
    results.push({ name, ok: false, detail: String(err.message).split("\n")[0] });
  }
}

const frameworks: Framework[] = only ? [only] : ["react", "nextjs"];
const sources: Source[] = sourceArg ? [sourceArg] : ["plan", "zip"];
for (const framework of frameworks) for (const source of sources) await verify(framework, source);

console.log("\n================ Generated project build verification ================");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name} - ${r.detail}`);

if (keep) {
  console.log(`\nBuild directories kept at ${root}`);
} else {
  try {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch (err: any) {
    console.warn(`Could not remove ${root}: ${err.message}`);
  }
}

process.exit(results.every((r) => r.ok) ? 0 : 1);
