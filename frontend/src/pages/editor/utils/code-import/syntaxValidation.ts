import ts from "typescript";

// Quick syntax validation (parse diagnostics only, no conversion).
// Moved verbatim from codeImporter.ts (now a compatibility entry point that re-exports the public API).

/**
 * Quick AST syntax validation without full element conversion
 */
export function validateCodeSyntax(
  code: string,
  _language = "tsx"
): { isValid: boolean; status: "VALID" | "PARTIAL" | "INVALID"; errors: string[]; warnings: string[] } {
  if (!code || !code.trim()) {
    return {
      isValid: false,
      status: "INVALID",
      errors: ["Code is empty."],
      warnings: [],
    };
  }

  try {
    const sourceFile = ts.createSourceFile(
      "validation.tsx",
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );

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
      return { isValid: false, status: "INVALID", errors, warnings: [] };
    }

    return { isValid: true, status: "VALID", errors: [], warnings: [] };
  } catch (err: any) {
    return {
      isValid: false,
      status: "INVALID",
      errors: [err?.message || "Syntax parsing failed"],
      warnings: [],
    };
  }
}
