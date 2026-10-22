/**
 * Site-part visibility in the backend compilers must follow the editor's rule: a part is shown
 * unless explicitly disabled; `enabled` (draft spelling) wins over `isEnabled` (published-snapshot
 * and legacy spelling); a part with neither flag is shown.
 *
 * Before alignment the compilers disagreed:
 *  - staticCompiler header/footer used `isEnabled || enabled` (no flag -> hidden; enabled:false +
 *    isEnabled:true -> shown);
 *  - codeGenerator used `enabled` truthiness (no flag or isEnabled-only -> hidden);
 *  - unifiedCompiler and pageSourceSync used `enabled !== false` (legacy isEnabled:false -> shown).
 * staticCompiler's 404/archive/search templates already followed the rule and are locked here.
 *
 * config/prisma is replaced by a stub that throws on any use: these compile paths are pure.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/prisma.js", () => {
  const deny = new Proxy({}, { get(_t, key) { if (key === "then") return undefined; throw new Error(`database accessed: ${String(key)}`); } });
  return { prisma: deny, pgPool: deny };
});

const { isSitePartEnabled } = await import("../../utils/site-part-visibility.js");
const { parseEditorDataToCanonicalDoc } = await import("../../services/codeGenerator.service.js");
const { compileCanonicalToStaticBundle } = await import("../../services/destinations/staticCompiler.js");
const { visualDocumentToIR } = await import("../../services/compiler/unifiedCompiler.service.js");

/** [label, flags, expected visibility] */
const VARIANTS: Array<[string, Record<string, boolean>, boolean]> = [
  ["enabled: false", { enabled: false }, false],
  ["isEnabled: false (legacy)", { isEnabled: false }, false],
  ["enabled: false wins over isEnabled: true", { enabled: false, isEnabled: true }, false],
  ["enabled: true wins over isEnabled: false", { enabled: true, isEnabled: false }, true],
  ["no flag", {}, true],
  ["enabled: true", { enabled: true }, true],
  ["isEnabled: true (legacy)", { isEnabled: true }, true],
];
const MARK = { header: "HEADERMARKER", footer: "FOOTERMARKER", notFound404: "NOTFOUNDMARKER", archive: "ARCHIVEMARKER", searchResults: "SEARCHMARKER" } as const;
const part = (name: keyof typeof MARK, flags: Record<string, boolean>) => ({ ...flags, elements: [{ id: `${name}Element`, type: "heading", content: MARK[name], styles: {} }] });

function editorDocument(siteParts: Record<string, unknown>) {
  const pages = [{ id: "home", name: "Home", slug: "/", isHome: true, elements: [{ id: "bodyElement", type: "text", content: "BODYMARKER", styles: {} }] }];
  return { version: 1, homePageId: "home", pages, elements: pages[0].elements, siteParts };
}

const compilers: Array<[string, (doc: any) => string]> = [
  ["codeGenerator.parseEditorDataToCanonicalDoc", (doc) => JSON.stringify(parseEditorDataToCanonicalDoc(doc))],
  ["staticCompiler.compileCanonicalToStaticBundle (page html)", (doc) => compileCanonicalToStaticBundle("site1", 1, { id: "site1", name: "Site", ...doc }).files.filter((f: any) => f.path.endsWith(".html")).map((f: any) => f.content).join("\n")],
  ["unifiedCompiler.visualDocumentToIR", (doc) => JSON.stringify(visualDocumentToIR(doc))],
];

describe("isSitePartEnabled (backend copy of the editor rule)", () => {
  it.each(VARIANTS)("%s", (_label, flags, expected) => {
    expect(isSitePartEnabled(flags)).toBe(expected);
  });
  it("treats a missing part as enabled and never throws on malformed input", () => {
    for (const value of [undefined, null, {}, [], "x", 0]) expect(isSitePartEnabled(value as any)).toBe(true);
  });
});

describe.each(compilers)("%s", (_name, compile) => {
  it("always includes the page body (sanity)", () => {
    expect(compile(editorDocument({}))).toContain("BODYMARKER");
  });
  for (const partName of ["header", "footer"] as const) {
    it.each(VARIANTS)(`${partName} %s`, (_label, flags, expected) => {
      const other = partName === "header" ? "footer" : "header";
      const output = compile(editorDocument({ [partName]: part(partName, flags), [other]: part(other, { enabled: true }) }));
      expect(output.includes(MARK[partName])).toBe(expected);
      expect(output).toContain(MARK[other]);
    });
  }
  it("documents without siteParts compile without header or footer", () => {
    const output = compile({ ...editorDocument({}), siteParts: undefined });
    expect(output).toContain("BODYMARKER");
    expect(output).not.toContain(MARK.header);
  });
});

describe("staticCompiler theme templates (already rule-compliant; locked)", () => {
  for (const name of ["notFound404", "archive", "searchResults"] as const) {
    it.each(VARIANTS)(`${name} %s`, (_label, flags, expected) => {
      const bundle = compileCanonicalToStaticBundle("site1", 1, { id: "site1", name: "Site", ...editorDocument({ [name]: part(name, flags) }) });
      const all = bundle.files.map((f: any) => String(f.content)).join("\n");
      expect(all.includes(MARK[name])).toBe(expected);
    });
  }
});

describe("pageSourceSync uses the same rule", () => {
  // reconcilePageSource needs the TypeScript compiler JS API, which the backend's TypeScript 7
  // toolchain does not provide here, so it cannot run in this suite. It must at least resolve
  // header/footer membership through the shared helper, exactly like unifiedCompiler, which
  // generates the page files it reconciles.
  it("pageSourceSync and unifiedCompiler decide site-part membership with isSitePartEnabled", () => {
    for (const rel of ["../../services/compiler/pageSourceSync.ts", "../../services/compiler/unifiedCompiler.service.ts"]) {
      const source = readFileSync(new URL(rel, import.meta.url), "utf8");
      expect(source, rel).toMatch(/import \{ isSitePartEnabled \} from "\.\.\/\.\.\/utils\/site-part-visibility\.js";/);
      expect(source, rel).toMatch(/part && isSitePartEnabled\(part\) && Array\.isArray\(part\.elements\)/);
      expect(source, rel).not.toMatch(/part\.enabled !== false/);
    }
  });
});
