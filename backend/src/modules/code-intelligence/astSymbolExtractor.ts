/**
 * ForgeStudio Module 35: Production AST Symbol & Relationship Extractor
 * Supports TypeScript (.ts), TSX (.tsx), JavaScript (.js, .mjs, .cjs), JSX (.jsx).
 * Tolerant to incomplete or malformed code.
 */

import path from "node:path";
import type {
  ExtractedSymbol,
  ExtractedReference,
  ExtractedImport,
  ExtractedExport,
  FileParseResult,
  SymbolLocation,
  CodeSymbolKind,
} from "./codeIntelligence.types.js";

/**
 * Compute line start offsets for efficient offset-to-line/col mapping
 */
function computeLineOffsets(source: string): number[] {
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") {
      lineStarts.push(i + 1);
    }
  }
  return lineStarts;
}

/**
 * Convert 0-indexed character offset into 1-indexed line and column
 */
function offsetToPosition(offset: number, lineStarts: number[]): { line: number; col: number } {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= offset) {
      if (mid === lineStarts.length - 1 || lineStarts[mid + 1] > offset) {
        return {
          line: mid + 1,
          col: offset - lineStarts[mid] + 1,
        };
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return { line: 1, col: offset + 1 };
}

function createLocation(startOffset: number, endOffset: number, lineStarts: number[]): SymbolLocation {
  const start = offsetToPosition(startOffset, lineStarts);
  const end = offsetToPosition(Math.max(startOffset, endOffset), lineStarts);
  return {
    startLine: start.line,
    startCol: start.col,
    endLine: end.line,
    endCol: end.col,
    startOffset,
    endOffset,
  };
}

/**
 * Extract leading JSDoc / comments immediately preceding a given offset
 */
function extractDocumentation(source: string, offset: number): string | undefined {
  const preceding = source.slice(0, offset).trimEnd();
  if (preceding.endsWith("*/")) {
    const docStart = preceding.lastIndexOf("/**");
    if (docStart !== -1) {
      return preceding.slice(docStart).trim();
    }
  } else {
    // Check for single line comments
    const lines = preceding.split("\n");
    const commentLines: string[] = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith("//")) {
        commentLines.unshift(line.replace(/^\/\/\s*/, ""));
      } else {
        break;
      }
    }
    if (commentLines.length > 0) {
      return commentLines.join("\n");
    }
  }
  return undefined;
}

/**
 * Parse an entire source file and extract symbols, references, imports, exports
 */
export function extractSymbolsFromSource(filePath: string, source: string): FileParseResult {
  const symbols: ExtractedSymbol[] = [];
  const references: ExtractedReference[] = [];
  const imports: ExtractedImport[] = [];
  const exports: ExtractedExport[] = [];
  const errors: string[] = [];

  const lineStarts = computeLineOffsets(source);

  try {
    // 1. EXTRACT IMPORTS
    // Matches:
    // import defaultMember from 'module';
    // import * as name from 'module';
    // import { member1, member2 as alias } from 'module';
    // import 'module';
    const importRegex =
      /import\s+(?:type\s+)?(?:([\w$]+)\s*(?:,\s*)?)?(?:(?:\*\s+as\s+([\w$]+))|(?:\s*\{([^}]+)\}))?\s*from\s*['"]([^'"]+)['"]/g;

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(source)) !== null) {
      const fullMatch = match[0];
      const defaultImport = match[1]?.trim();
      const namespaceImport = match[2]?.trim();
      const namedImportsRaw = match[3];
      const specifier = match[4];
      const startOffset = match.index;
      const pos = offsetToPosition(startOffset, lineStarts);

      const namedImports: Array<{ name: string; alias?: string }> = [];
      if (namedImportsRaw) {
        const parts = namedImportsRaw.split(",");
        for (const p of parts) {
          const item = p.trim().replace(/^type\s+/, "");
          if (!item) continue;
          if (item.includes(" as ")) {
            const [orig, alias] = item.split(/\s+as\s+/).map((s) => s.trim());
            namedImports.push({ name: orig, alias });
          } else {
            namedImports.push({ name: item });
          }
        }
      }

      const isExternal = !specifier.startsWith(".") && !specifier.startsWith("/");

      imports.push({
        specifier,
        defaultImport: defaultImport || undefined,
        namespaceImport: namespaceImport || undefined,
        namedImports,
        line: pos.line,
        isExternal,
      });

      // Record as reference kind IMPORT
      if (defaultImport) {
        references.push({
          symbolName: defaultImport,
          kind: "IMPORT",
          line: pos.line,
          col: pos.col,
          snippet: fullMatch,
          metadata: { specifier, isDefault: true },
        });
      }
      if (namespaceImport) {
        references.push({
          symbolName: namespaceImport,
          kind: "IMPORT",
          line: pos.line,
          col: pos.col,
          snippet: fullMatch,
          metadata: { specifier, isNamespace: true },
        });
      }
      for (const ni of namedImports) {
        references.push({
          symbolName: ni.name,
          kind: "IMPORT",
          line: pos.line,
          col: pos.col,
          snippet: fullMatch,
          metadata: { specifier, alias: ni.alias },
        });
      }
    }

    // Bare imports: import 'style.css';
    const bareImportRegex = /import\s+['"]([^'"]+)['"]/g;
    while ((match = bareImportRegex.exec(source)) !== null) {
      const specifier = match[1];
      const pos = offsetToPosition(match.index, lineStarts);
      if (!imports.some((i) => i.specifier === specifier && i.line === pos.line)) {
        imports.push({
          specifier,
          namedImports: [],
          line: pos.line,
          isExternal: !specifier.startsWith(".") && !specifier.startsWith("/"),
        });
      }
    }

    // Dynamic imports: import('...')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(source)) !== null) {
      const specifier = match[1];
      const pos = offsetToPosition(match.index, lineStarts);
      imports.push({
        specifier,
        namedImports: [],
        line: pos.line,
        isExternal: !specifier.startsWith(".") && !specifier.startsWith("/"),
      });
    }

    // 2. EXTRACT EXPORTS
    // Named re-exports or object exports: export { a, b as c } from '...'; or export { a, b };
    const exportNamedRegex = /export\s+(?:type\s+)?\{([^}]+)\}(?:\s*from\s*['"]([^'"]+)['"])?/g;
    while ((match = exportNamedRegex.exec(source)) !== null) {
      const namedRaw = match[1];
      const sourceSpecifier = match[2];
      const pos = offsetToPosition(match.index, lineStarts);

      const parts = namedRaw.split(",");
      for (const p of parts) {
        const item = p.trim().replace(/^type\s+/, "");
        if (!item) continue;
        let name = item;
        let originalName: string | undefined = undefined;
        if (item.includes(" as ")) {
          const [orig, alias] = item.split(/\s+as\s+/).map((s) => s.trim());
          originalName = orig;
          name = alias;
        }
        exports.push({
          name,
          isDefault: name === "default",
          isReExport: !!sourceSpecifier,
          sourceSpecifier,
          originalName,
          line: pos.line,
        });
      }
    }

    // Export default expression or identifier: export default Foo; or export default function ...
    const exportDefaultIdentRegex = /export\s+default\s+([A-Za-z_$][\w$]*)\s*;/g;
    while ((match = exportDefaultIdentRegex.exec(source)) !== null) {
      const name = match[1];
      const pos = offsetToPosition(match.index, lineStarts);
      exports.push({
        name,
        isDefault: true,
        isReExport: false,
        line: pos.line,
      });
    }

    // 3. EXTRACT CLASSES
    // class ClassName extends BaseClass implements Interface1, Interface2 { ... }
    const classRegex =
      /(export\s+)?(default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)(?:\s*<[^>]+>)?(?:\s+extends\s+([A-Za-z_$][\w$.]*))?(?:\s+implements\s+([^{]+))?\s*\{/g;
    while ((match = classRegex.exec(source)) !== null) {
      const isExported = !!match[1];
      const isDefault = !!match[2];
      const className = match[3];
      const extendsName = match[4]?.trim();
      const implementsRaw = match[5]?.trim();
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      const loc = createLocation(startOffset, endOffset, lineStarts);
      const doc = extractDocumentation(source, startOffset);

      symbols.push({
        name: className,
        kind: "CLASS",
        location: loc,
        signature: match[0].replace(/\{$/, "").trim(),
        documentation: doc,
        isExported: isExported || isDefault,
        isDefaultExport: isDefault,
        metadata: {
          extends: extendsName,
          implements: implementsRaw ? implementsRaw.split(",").map((s) => s.trim()) : [],
        },
      });

      if (isExported || isDefault) {
        exports.push({
          name: className,
          isDefault,
          isReExport: false,
          line: loc.startLine,
        });
      }

      if (extendsName) {
        references.push({
          symbolName: extendsName,
          kind: "HERITAGE_EXTENDS",
          line: loc.startLine,
          col: loc.startCol,
          snippet: match[0],
        });
      }

      if (implementsRaw) {
        for (const iface of implementsRaw.split(",")) {
          const trimmed = iface.trim();
          if (trimmed) {
            references.push({
              symbolName: trimmed,
              kind: "HERITAGE_IMPLEMENTS",
              line: loc.startLine,
              col: loc.startCol,
              snippet: match[0],
            });
          }
        }
      }
    }

    // 4. EXTRACT INTERFACES
    // interface InterfaceName extends BaseInterface { ... }
    const interfaceRegex =
      /(export\s+)?interface\s+([A-Za-z_$][\w$]*)(?:\s*<[^>]+>)?(?:\s+extends\s+([^{]+))?\s*\{/g;
    while ((match = interfaceRegex.exec(source)) !== null) {
      const isExported = !!match[1];
      const interfaceName = match[2];
      const extendsRaw = match[3]?.trim();
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      const loc = createLocation(startOffset, endOffset, lineStarts);
      const doc = extractDocumentation(source, startOffset);

      symbols.push({
        name: interfaceName,
        kind: "INTERFACE",
        location: loc,
        signature: match[0].replace(/\{$/, "").trim(),
        documentation: doc,
        isExported,
        isDefaultExport: false,
        metadata: {
          extends: extendsRaw ? extendsRaw.split(",").map((s) => s.trim()) : [],
        },
      });

      if (isExported) {
        exports.push({
          name: interfaceName,
          isDefault: false,
          isReExport: false,
          line: loc.startLine,
        });
      }

      if (extendsRaw) {
        for (const ext of extendsRaw.split(",")) {
          const trimmed = ext.trim();
          if (trimmed) {
            references.push({
              symbolName: trimmed,
              kind: "HERITAGE_EXTENDS",
              line: loc.startLine,
              col: loc.startCol,
              snippet: match[0],
            });
          }
        }
      }
    }

    // 5. EXTRACT TYPE ALIASES
    // type TypeName = ...;
    const typeAliasRegex = /(export\s+)?type\s+([A-Za-z_$][\w$]*)(?:\s*<[^>]+>)?\s*=\s*([^;]+);/g;
    while ((match = typeAliasRegex.exec(source)) !== null) {
      const isExported = !!match[1];
      const typeName = match[2];
      const typeDef = match[3]?.trim();
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      const loc = createLocation(startOffset, endOffset, lineStarts);
      const doc = extractDocumentation(source, startOffset);

      symbols.push({
        name: typeName,
        kind: "TYPE_ALIAS",
        location: loc,
        signature: `type ${typeName} = ${typeDef}`,
        documentation: doc,
        isExported,
        isDefaultExport: false,
      });

      if (isExported) {
        exports.push({
          name: typeName,
          isDefault: false,
          isReExport: false,
          line: loc.startLine,
        });
      }
    }

    // 6. EXTRACT ENUMS
    // enum EnumName { ... }
    const enumRegex = /(export\s+)?enum\s+([A-Za-z_$][\w$]*)\s*\{([^}]*)\}/g;
    while ((match = enumRegex.exec(source)) !== null) {
      const isExported = !!match[1];
      const enumName = match[2];
      const membersBody = match[3];
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      const loc = createLocation(startOffset, endOffset, lineStarts);
      const doc = extractDocumentation(source, startOffset);

      symbols.push({
        name: enumName,
        kind: "ENUM",
        location: loc,
        signature: `enum ${enumName}`,
        documentation: doc,
        isExported,
        isDefaultExport: false,
      });

      if (isExported) {
        exports.push({
          name: enumName,
          isDefault: false,
          isReExport: false,
          line: loc.startLine,
        });
      }

      // Extract enum members
      if (membersBody) {
        const memberRegex = /([A-Za-z_$][\w$]*)\s*(?:=\s*([^,\n]+))?/g;
        let memberMatch: RegExpExecArray | null;
        while ((memberMatch = memberRegex.exec(membersBody)) !== null) {
          const memberName = memberMatch[1];
          if (memberName) {
            const memberOffset = startOffset + match[0].indexOf(membersBody) + memberMatch.index;
            symbols.push({
              name: memberName,
              kind: "PROPERTY",
              containerName: enumName,
              location: createLocation(memberOffset, memberOffset + memberName.length, lineStarts),
              isExported,
              isDefaultExport: false,
            });
          }
        }
      }
    }

    // 7. EXTRACT FUNCTIONS
    // function name(...) { ... }
    const functionRegex =
      /(export\s+)?(default\s+)?(?:async\s+)?function(?:\s+([A-Za-z_$][\w$]*))?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g;
    while ((match = functionRegex.exec(source)) !== null) {
      const isExported = !!match[1];
      const isDefault = !!match[2];
      const fnName = match[3] || (isDefault ? "default" : undefined);
      if (!fnName) continue;

      const params = match[4]?.trim() || "";
      const returnType = match[5]?.trim();
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      const loc = createLocation(startOffset, endOffset, lineStarts);
      const doc = extractDocumentation(source, startOffset);

      symbols.push({
        name: fnName,
        kind: "FUNCTION",
        location: loc,
        signature: `function ${fnName}(${params})${returnType ? `: ${returnType}` : ""}`,
        documentation: doc,
        isExported: isExported || isDefault,
        isDefaultExport: isDefault,
        metadata: { params, returnType },
      });

      if (isExported || isDefault) {
        exports.push({
          name: fnName,
          isDefault,
          isReExport: false,
          line: loc.startLine,
        });
      }
    }

    // 8. EXTRACT ARROW FUNCTIONS & VARIABLE DECLARATIONS
    // const/let/var name = (...) => ... or function(...) ...
    const varDeclRegex =
      /(export\s+)?(const|let|var)\s+([A-Za-z_$][\w$]*)(?:\s*:\s*([^=;]+))?\s*=\s*(?:(?:(?:async\s+)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>)|(?:(?:async\s+)?function\s*\(([^)]*)\))|(?:[^;,\n]+))/g;

    while ((match = varDeclRegex.exec(source)) !== null) {
      const isExported = !!match[1];
      const keyword = match[2]; // const, let, var
      const varName = match[3];
      const typeAnnotation = match[4]?.trim();
      const isArrow = match[5] !== undefined || match[6] !== undefined;
      const isFnExpr = match[7] !== undefined;

      const isFunction = isArrow || isFnExpr;
      const kind: CodeSymbolKind = isFunction
        ? "FUNCTION"
        : keyword === "const"
        ? "CONSTANT"
        : "VARIABLE";

      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      const loc = createLocation(startOffset, endOffset, lineStarts);
      const doc = extractDocumentation(source, startOffset);

      symbols.push({
        name: varName,
        kind,
        location: loc,
        signature: `${keyword} ${varName}${typeAnnotation ? `: ${typeAnnotation}` : ""}`,
        documentation: doc,
        isExported,
        isDefaultExport: false,
        metadata: {
          keyword,
          typeAnnotation,
          isArrowFunction: isArrow,
        },
      });

      if (isExported) {
        exports.push({
          name: varName,
          isDefault: false,
          isReExport: false,
          line: loc.startLine,
        });
      }
    }

    // 9. EXTRACT MODULES / NAMESPACES
    const moduleRegex = /(export\s+)?(?:module|namespace)\s+([A-Za-z_$][\w$]*)\s*\{/g;
    while ((match = moduleRegex.exec(source)) !== null) {
      const isExported = !!match[1];
      const modName = match[2];
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      const loc = createLocation(startOffset, endOffset, lineStarts);

      symbols.push({
        name: modName,
        kind: "MODULE",
        location: loc,
        signature: `namespace ${modName}`,
        isExported,
        isDefaultExport: false,
      });

      if (isExported) {
        exports.push({
          name: modName,
          isDefault: false,
          isReExport: false,
          line: loc.startLine,
        });
      }
    }

    // 10. EXTRACT CALL EXPRESSIONS & REFERENCES
    // functionCall(args) or Object.method(args)
    const callRegex = /([A-Za-z_$][\w$]*)\s*\(/g;
    const reservedKeywords = new Set([
      "if",
      "for",
      "while",
      "switch",
      "catch",
      "function",
      "return",
      "import",
      "export",
      "typeof",
      "instanceof",
      "new",
      "super",
      "this",
      "case",
      "require",
    ]);

    while ((match = callRegex.exec(source)) !== null) {
      const callee = match[1];
      if (reservedKeywords.has(callee)) continue;

      const pos = offsetToPosition(match.index, lineStarts);
      references.push({
        symbolName: callee,
        kind: "CALL",
        line: pos.line,
        col: pos.col,
        snippet: source.slice(match.index, Math.min(source.length, match.index + 50)).trim(),
      });
    }

    // 11. EXTRACT TYPE REFERENCES
    // : InterfaceName or <TypeName> or extends TypeName
    const typeRefRegex = /:\s*([A-Z][\w$]*)\b|<([A-Z][\w$]*)\b/g;
    while ((match = typeRefRegex.exec(source)) !== null) {
      const typeRef = match[1] || match[2];
      if (!typeRef || ["Promise", "Array", "Record", "Set", "Map", "Partial", "Pick", "Omit", "Required"].includes(typeRef)) {
        continue;
      }
      const pos = offsetToPosition(match.index, lineStarts);
      references.push({
        symbolName: typeRef,
        kind: "TYPE_REFERENCE",
        line: pos.line,
        col: pos.col,
        snippet: match[0],
      });
    }
  } catch (err: any) {
    errors.push(`Parser error in ${filePath}: ${err?.message || String(err)}`);
  }

  return {
    filePath,
    success: errors.length === 0,
    symbols,
    references,
    imports,
    exports,
    errors,
  };
}
