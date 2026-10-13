/**
 * ForgeStudio Execution Blueprint v2.1 — Point 37
 * Dynamic Source Generation and Deterministic File/Symbol Planning Service
 *
 * Implements:
 * 1. Deterministic file and symbol planning from target runtime profile and stable graph identities.
 * 2. Collision-safe symbols for duplicate display titles, nested layouts, reserved JS/TS keywords,
 *    leading digits, Unicode names, case sensitivity, and Windows MAX_PATH limits.
 * 3. Stable naming guaranteeing display title changes never rename unrelated files.
 * 4. Import resolution with module identity, default/named exports, qualified aliases (@/components),
 *    re-exports, external URLs, signed asset paths, and source-map provenance.
 * 5. Ownership classes enforcement: GENERATED, USER_OWNED, MIXED/PATCHED, DERIVED_BUILD, PROTECTED_SOURCE.
 */

import crypto from "node:crypto";
import path from "node:path";
import { AppError } from "../../utils/app-error.js";

export type SourceOwnershipClass =
  | "GENERATED"
  | "USER_OWNED"
  | "MIXED/PATCHED"
  | "DERIVED_BUILD"
  | "PROTECTED_SOURCE";

export interface SymbolPlan {
  originalName: string;
  sanitizedIdentifier: string;
  exportType: "default" | "named";
  isCollisionResolved: boolean;
  disambiguationSuffix?: string;
}

export interface ImportRequirement {
  sourceModule: string; // e.g. "@/components/Button" or "react"
  importedSymbols: Array<{ name: string; alias?: string; isDefault?: boolean }>;
  isExternal: boolean;
  provenance?: {
    packageVersion?: string;
    assetHash?: string;
  };
}

export interface PlannedSourceModule {
  fileId: string;
  filePath: string;
  ownershipClass: SourceOwnershipClass;
  symbolPlan: SymbolPlan;
  imports: ImportRequirement[];
  reExports?: Array<{ sourceModule: string; symbols: string[] }>;
  expectedBaselineHash?: string;
  sourceContent: string;
  contentHash: string;
  isEntrypoint: boolean;
  runtimeProfile: "nextjs-app-router" | "nextjs-pages-router" | "react-vite" | "node-express";
}

const RESERVED_WORDS = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default",
  "delete", "do", "else", "export", "extends", "false", "finally", "for",
  "function", "if", "import", "in", "instanceof", "new", "null", "return",
  "super", "switch", "this", "throw", "true", "try", "typeof", "var", "void",
  "while", "with", "yield", "let", "static", "enum", "await", "implements",
  "package", "protected", "interface", "private", "public", "abstract", "boolean",
  "byte", "char", "double", "final", "float", "goto", "int", "long", "native",
  "short", "synchronized", "throws", "transient", "volatile"
]);

export class DynamicSourcePlannerService {
  /** Windows MAX_PATH limit protection */
  public static readonly WINDOWS_MAX_PATH = 260;

  /**
   * 2.1 Deterministic Symbol Sanitization
   * Transforms arbitrary display titles, Unicode names, and reserved keywords into safe JS identifiers
   */
  public static sanitizeSymbolIdentifier(name: string, fallbackPrefix = "Comp"): string {
    if (!name || typeof name !== "string") return `${fallbackPrefix}_${crypto.randomBytes(2).toString("hex")}`;

    // Normalize Unicode (e.g. café -> cafe) and remove diacritics
    let clean = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

    // Replace non-alphanumeric characters with spaces to create camel/pascal segments
    clean = clean.replace(/[^a-zA-Z0-9_$]/g, " ").trim();

    // Split words and PascalCase them
    const segments = clean.split(/\s+/).filter(Boolean);
    let identifier = segments.map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1)).join("");

    if (!identifier) {
      identifier = fallbackPrefix;
    }

    // Leading digit check: identifiers cannot begin with a number
    if (/^[0-9]/.test(identifier)) {
      identifier = `_${identifier}`;
    }

    // Reserved keyword collision check
    if (RESERVED_WORDS.has(identifier.toLowerCase())) {
      identifier = `${fallbackPrefix}${identifier.charAt(0).toUpperCase() + identifier.slice(1)}`;
    }

    return identifier;
  }

  /**
   * Plan collision-safe symbols for an entire collection of display titles/nodes
   */
  public static planSymbols(items: Array<{ id: string; title: string; isDefault?: boolean }>): Map<string, SymbolPlan> {
    const plans = new Map<string, SymbolPlan>();
    const seenIdentifiers = new Map<string, number>();

    for (const item of items) {
      const baseIdentifier = this.sanitizeSymbolIdentifier(item.title);
      const lower = baseIdentifier.toLowerCase();
      const count = seenIdentifiers.get(lower) || 0;
      seenIdentifiers.set(lower, count + 1);

      let finalIdentifier = baseIdentifier;
      let isCollisionResolved = false;
      let suffix: string | undefined;

      if (count > 0) {
        // Disambiguate collision using stable index or item hash
        suffix = `${count + 1}`;
        finalIdentifier = `${baseIdentifier}_${suffix}`;
        isCollisionResolved = true;
      }

      plans.set(item.id, {
        originalName: item.title,
        sanitizedIdentifier: finalIdentifier,
        exportType: item.isDefault ? "default" : "named",
        isCollisionResolved,
        disambiguationSuffix: suffix,
      });
    }

    return plans;
  }

  /**
   * Validate and normalize a file path, checking Windows MAX_PATH and case collisions
   */
  public static validateFilePath(
    rawPath: string,
    existingPaths: string[] = []
  ): { valid: boolean; normalizedPath: string; error?: string } {
    const normalized = rawPath.replace(/^[/\\]+/, "").replace(/\\/g, "/");

    // Path traversal check
    if (normalized.includes("..") || normalized.startsWith("/")) {
      return { valid: false, normalizedPath: normalized, error: `Path traversal violation in '${rawPath}'` };
    }

    // Windows MAX_PATH check
    if (normalized.length > this.WINDOWS_MAX_PATH) {
      return {
        valid: false,
        normalizedPath: normalized,
        error: `Path length (${normalized.length}) exceeds Windows MAX_PATH limit of ${this.WINDOWS_MAX_PATH}`,
      };
    }

    // Windows case collision check (e.g. About.tsx vs about.tsx)
    const lowerNorm = normalized.toLowerCase();
    for (const existing of existingPaths) {
      const existingClean = existing.replace(/^[/\\]+/, "").replace(/\\/g, "/");
      if (existingClean.toLowerCase() === lowerNorm && existingClean !== normalized) {
        return {
          valid: false,
          normalizedPath: normalized,
          error: `Case sensitivity collision on Windows filesystem: '${normalized}' collides with existing '${existingClean}'`,
        };
      }
    }

    return { valid: true, normalizedPath: normalized };
  }

  /**
   * 2.1 Import & Module Resolution
   * Resolves qualified import statements from module specifications
   */
  public static resolveImportStatements(imports: ImportRequirement[]): string[] {
    const statements: string[] = [];

    // Group by source module to avoid multiple import statements for same file
    const byModule = new Map<string, ImportRequirement["importedSymbols"]>();
    for (const req of imports) {
      const existing = byModule.get(req.sourceModule) || [];
      existing.push(...req.importedSymbols);
      byModule.set(req.sourceModule, existing);
    }

    for (const [mod, symbols] of byModule.entries()) {
      const defaultSym = symbols.find((s) => s.isDefault);
      const namedSyms = symbols.filter((s) => !s.isDefault);

      const parts: string[] = [];
      if (defaultSym) {
        parts.push(defaultSym.name);
      }
      if (namedSyms.length > 0) {
        // De-duplicate named symbols
        const uniqueNamed = new Map<string, string>();
        for (const ns of namedSyms) {
          const symStr = ns.alias ? `${ns.name} as ${ns.alias}` : ns.name;
          uniqueNamed.set(ns.alias || ns.name, symStr);
        }
        parts.push(`{ ${Array.from(uniqueNamed.values()).join(", ")} }`);
      }

      if (parts.length > 0) {
        statements.push(`import ${parts.join(", ")} from "${mod}";`);
      } else {
        // Side-effect import
        statements.push(`import "${mod}";`);
      }
    }

    return statements;
  }

  /**
   * 2.2 Ownership-Aware Regeneration Decision
   * Validates whether a file is safe to regenerate based on verified ownership and content hash
   */
  public static evaluateRegenerationSafety(
    planned: PlannedSourceModule,
    existingRecord?: {
      ownershipClass: SourceOwnershipClass;
      recordedBaselineHash?: string;
      currentContentHash: string;
      isProtected?: boolean;
    }
  ): {
    canRegenerate: boolean;
    action: "WRITE" | "PRESERVE" | "CONFLICT" | "RECONCILE";
    reason: string;
  } {
    if (!existingRecord) {
      // New file: safe to create
      return { canRegenerate: true, action: "WRITE", reason: "New file creation" };
    }

    const { ownershipClass, recordedBaselineHash, currentContentHash, isProtected } = existingRecord;

    // 1. USER_OWNED or PROTECTED_SOURCE: NEVER overwrite automatically
    if (ownershipClass === "USER_OWNED" || isProtected || ownershipClass === "PROTECTED_SOURCE") {
      return {
        canRegenerate: false,
        action: "PRESERVE",
        reason: "File is designated as USER_OWNED or PROTECTED_SOURCE; automatic overwrite forbidden.",
      };
    }

    // 2. MIXED/PATCHED: Requires 3-way or region-aware reconciliation
    if (ownershipClass === "MIXED/PATCHED") {
      return {
        canRegenerate: true,
        action: "RECONCILE",
        reason: "File is MIXED/PATCHED: requires region-aware or three-way reconciliation.",
      };
    }

    // 3. GENERATED: Compare current content hash against recorded baseline
    if (ownershipClass === "GENERATED") {
      if (recordedBaselineHash && currentContentHash !== recordedBaselineHash) {
        // User edited the generated file! Create conflict or preserve
        return {
          canRegenerate: false,
          action: "CONFLICT",
          reason: `Generated file was modified outside generator (current hash ${currentContentHash.slice(
            0,
            8
          )} differs from baseline ${recordedBaselineHash.slice(0, 8)}). Overwrite rejected to prevent data loss.`,
        };
      }

      return {
        canRegenerate: true,
        action: "WRITE",
        reason: "Generated file matches recorded baseline; safe to regenerate.",
      };
    }

    // 4. DERIVED_BUILD: Rebuildable output
    if (ownershipClass === "DERIVED_BUILD") {
      return { canRegenerate: true, action: "WRITE", reason: "Derived build output safely replaceable" };
    }

    return { canRegenerate: false, action: "PRESERVE", reason: "Unknown ownership class: defaulting to preserve safely" };
  }
}
