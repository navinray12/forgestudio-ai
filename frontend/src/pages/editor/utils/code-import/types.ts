import type { EditorElement } from "../../types";

// Result type of the code importer.
// Moved verbatim from codeImporter.ts (now a compatibility entry point that re-exports the public API).

/**
 * Result structure returned by the AST Code Importer
 */
export interface ImportResult {
  success: boolean;
  element?: EditorElement;
  status: "VALID" | "PARTIAL" | "INVALID";
  errors: string[];
  warnings: string[];
  unsupportedConstructs: string[];
}
