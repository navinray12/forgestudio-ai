/**
 * Locates a TypeScript compiler that exposes the JavaScript AST API
 * (`createSourceFile`). The backend's own `typescript` package is the native
 * compiler, which ships no JS API, so the classic compiler is resolved from the
 * known install locations.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const candidates = [
  "typescript-compiler-api",
  path.resolve(process.cwd(), "node_modules/typescript-compiler-api/lib/typescript.js"),
  path.resolve(process.cwd(), "../frontend/node_modules/typescript/lib/typescript.js"),
  path.resolve(__dirname, "../../../../frontend/node_modules/typescript/lib/typescript.js"),
  path.resolve(process.cwd(), "node_modules/typescript/lib/typescript.js"),
  "typescript",
];

function locate(): any {
  for (const candidate of candidates) {
    try {
      const mod = require(candidate);
      const resolved = mod && mod.createSourceFile ? mod : mod?.default;
      if (resolved && typeof resolved.createSourceFile === "function") return resolved;
    } catch {}
  }
  return undefined;
}

/** The TypeScript compiler API, or undefined when none is installed */
export const ts: any = locate();

if (!ts) {
  console.error("FATAL: Could not locate a TypeScript compiler with createSourceFile");
}

export function requireTs(): any {
  if (!ts) throw new Error("No TypeScript compiler with a JavaScript AST API is installed");
  return ts;
}
