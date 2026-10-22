import type { EditorElement } from "../../types";
import type { ImportResult } from "./types";
import { generateId } from "./ids";

// Fallback for vanilla JavaScript DOM scripts (no JSX root).
// Moved verbatim from codeImporter.ts (now a compatibility entry point that re-exports the public API).

/**
 * Fallback parser for pure Vanilla JS DOM code
 */
export function importVanillaDOMCode(code: string, existingElement?: EditorElement): ImportResult {
  const warnings: string[] = ["Parsed from Vanilla JavaScript DOM manipulation script."];
  const elementId = existingElement ? existingElement.id : generateId();

  // If Vanilla JS contains posts data
  const postsMatch = code.match(/const\s+posts\s*=\s*(\[[\s\S]*?\]);/);
  if (postsMatch) {
    try {
      const posts = JSON.parse(postsMatch[1]);
      return {
        success: true,
        element: {
          ...(existingElement || {}),
          id: elementId,
          type: "posts",
          content: "Blog Posts",
          posts,
          styles: existingElement?.styles || {},
        },
        status: "VALID",
        errors: [],
        warnings,
        unsupportedConstructs: [],
      };
    } catch {}
  }

  // General Vanilla JS fallback
  return {
    success: true,
    element: {
      ...(existingElement || {}),
      id: elementId,
      type: existingElement?.type || "container",
      content: existingElement?.content || "",
      styles: existingElement?.styles || {},
    },
    status: "PARTIAL",
    errors: [],
    warnings,
    unsupportedConstructs: ["Complex Vanilla JS DOM callbacks preserved safely."],
  };
}
