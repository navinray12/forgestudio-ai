import type { EditorElement } from "../../types";
import type { ImportResult } from "./types";
import { collectScopeVariables } from "./expressionScope";
import { convertJsxNodeToElement } from "./jsxToElement";
import { findRootJsx } from "./jsxAst";
import { importVanillaDOMCode } from "./vanillaDom";
import ts from "typescript";

// Import orchestration: parse, diagnostics, scope, root JSX, conversion and result status.
// Moved verbatim from codeImporter.ts (now a compatibility entry point that re-exports the public API).

/**
 * Main Public API: Imports JSX/TSX/JS/TS code back into an EditorElement tree
 */
export function importCodeToElement(
  code: string,
  options?: {
    existingElement?: EditorElement;
    language?: "jsx" | "tsx" | "js" | "ts";
  }
): ImportResult {
  if (!code || !code.trim()) {
    return {
      success: false,
      status: "INVALID",
      errors: ["Cannot import empty code."],
      warnings: [],
      unsupportedConstructs: [],
    };
  }

  const { existingElement, language = "tsx" } = options || {};

  try {
    const sourceFile = ts.createSourceFile(
      "importedComponent.tsx",
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );

    // 1. Check for fatal syntax diagnostics
    const diagnostics: ts.Diagnostic[] = (sourceFile as any).parseDiagnostics || [];
    const errors: string[] = [];

    for (const diag of diagnostics) {
      if (diag.category === ts.DiagnosticCategory.Error) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(diag.start || 0);
        const msg = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
        errors.push(`Line ${line + 1}, Col ${character + 1}: ${msg}`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        status: "INVALID",
        errors,
        warnings: [],
        unsupportedConstructs: [],
      };
    }

    // 2. Collect scope variables (const posts = [...], props destructuring, etc.)
    const scope = collectScopeVariables(sourceFile);

    // 3. Find the root JSX element
    const rootJsx = findRootJsx(sourceFile);

    if (!rootJsx) {
      // If no JSX element found, check if it's Vanilla JS DOM script (e.g. document.createElement)
      if (code.includes("document.createElement")) {
        return importVanillaDOMCode(code, existingElement);
      }

      return {
        success: false,
        status: "INVALID",
        errors: ["No valid JSX root element or component return statement found in code."],
        warnings: [],
        unsupportedConstructs: [],
      };
    }

    // 4. Convert JSX AST tree into EditorElement
    const warnings: string[] = [];
    const element = convertJsxNodeToElement(rootJsx, scope, existingElement, warnings);

    return {
      success: true,
      element,
      status: warnings.length > 0 ? "PARTIAL" : "VALID",
      errors: [],
      warnings,
      unsupportedConstructs: [],
    };
  } catch (err: any) {
    return {
      success: false,
      status: "INVALID",
      errors: [err?.message || "Internal parser exception occurred"],
      warnings: [],
      unsupportedConstructs: [],
    };
  }
}
