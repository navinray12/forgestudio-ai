/**
 * Code importer entry point (Developer modal: code -> editor element). The implementation lives in
 * ./code-import/: syntax validation, expression / scope evaluation, JSX AST helpers, the JSX-to-element
 * converter, the vanilla-DOM fallback and the import orchestration. This file keeps the original import path
 * and public API (importCodeToElement, validateCodeSyntax, ImportResult).
 */
export type { ImportResult } from "./code-import/types";
export { validateCodeSyntax } from "./code-import/syntaxValidation";
export { importCodeToElement } from "./code-import/importCodeToElement";
