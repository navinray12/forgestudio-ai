/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * The backend keeps its own dependency-free copy of the site-part visibility rule
 * (backend/src/utils/site-part-visibility.ts). It must agree with the editor's isSitePartEnabled,
 * which callers use for truthiness, on every input shape.
 */
import { isSitePartEnabled as editorRule } from "../../src/pages/editor/core/siteParts";
import { isSitePartEnabled as backendRule } from "../../../backend/src/utils/site-part-visibility";

const VALUES = [undefined, null, true, false, 0, 1, "", "yes"];

describe("site-part visibility rule: editor and backend agree", () => {
  it("for every combination of enabled / isEnabled values, and for missing or malformed parts", () => {
    const parts: unknown[] = [undefined, null, {}, [], "text", 0];
    for (const enabled of VALUES) for (const isEnabled of VALUES) {
      const p: Record<string, unknown> = {};
      if (enabled !== undefined) p.enabled = enabled;
      if (isEnabled !== undefined) p.isEnabled = isEnabled;
      parts.push(p);
    }
    for (const p of parts) expect([JSON.stringify(p), backendRule(p)]).toEqual([JSON.stringify(p), Boolean(editorRule(p as any))]);
  });
});
