/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Export compatibility for src/pages/editor/WebsiteEditor.tsx: the runtime surface is exactly the
 * default component (lazy-loaded by EditorRoute), and the type re-export that 31 modules import from
 * "pages/editor/WebsiteEditor" stays in place. Any Phase 5 extraction must keep both.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as editorModule from "../../src/pages/editor/WebsiteEditor";

const source = readFileSync(fileURLToPath(new URL("../../src/pages/editor/WebsiteEditor.tsx", import.meta.url)), "utf8");

describe("WebsiteEditor export surface", () => {
  it("exposes only the default WebsiteEditor component at runtime", () => {
    expect(Object.keys(editorModule).sort()).toEqual(["default"]);
    expect(typeof editorModule.default).toBe("function");
    expect(editorModule.default.name).toBe("WebsiteEditor");
  });

  it("keeps the type re-export its consumers depend on", () => {
    const typeExports = [...source.matchAll(/^export type \{([^}]*)\} from "([^"]+)";/gm)].map((m) => [m[1].split(",").map((s) => s.trim()).sort(), m[2]]);
    expect(typeExports).toEqual([[["Breakpoint", "ContainerLayout", "EditorElement", "ElementStyles", "ElementType"], "./types"]]);
  });

  it("is still lazily imported by the editor route", () => {
    const route = readFileSync(fileURLToPath(new URL("../../src/features/editor-access/EditorRoute.tsx", import.meta.url)), "utf8");
    expect(route).toContain(`lazy(() => import("../../pages/editor/WebsiteEditor"))`);
  });
});
