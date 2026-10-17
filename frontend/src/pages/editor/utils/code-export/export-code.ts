/**
 * Code exporter: export-code. Moved verbatim from codeExporter.ts, which re-exports the public API.
 */
import type { EditorElement } from "../../types";
import { generateJSCode, generateTSCode } from "./vanilla";
import { generateJSXCode, generateTSXCode } from "./react-components";

/**
 * Universal code export helper for any element and format
 */
export function exportCode(el: EditorElement, format: "js" | "ts" | "jsx" | "tsx" = "jsx"): string {
  switch (format) {
    case "js":
      return generateJSCode(el);
    case "ts":
      return generateTSCode(el);
    case "jsx":
      return generateJSXCode(el);
    case "tsx":
      return generateTSXCode(el);
    default:
      return generateJSXCode(el);
  }
}
