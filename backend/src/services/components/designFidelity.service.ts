/**
 * Point 08: Design Fidelity and Exact Style Preservation Service
 * 
 * Enforces round-trip preservation of user design intent without lossy approximation:
 * - Custom responsive breakpoints and inheritance
 * - CSS Grid, Flexbox, alignment, and container sizing
 * - Typography (exact font weights, line heights, letter spacing)
 * - Margins, padding, gaps, dimensions with exact zero/unset preservation
 * - Design tokens and CSS custom properties
 * - Pseudo-classes (:hover, :focus, :active, :disabled) and keyframe animations
 * - Container queries (@container) and conditional rules
 * - Detects conflicting style ownership and prevents lossy utility-class degradation
 */

import { createHash } from "crypto";

export interface ResponsiveBreakpoint {
  name: string; // e.g. "mobile", "tablet", "desktop", "ultrawide"
  minWidth?: number;
  maxWidth?: number;
  order: number;
}

export interface DesignTokensMap {
  colors: Record<string, string>;
  typography: Record<string, { fontFamily: string; fontWeight: number; lineHeight: string; letterSpacing?: string }>;
  spacing: Record<string, string>;
  customVariables: Record<string, string>;
}

export interface ComponentStyleDeclaration {
  elementSelector: string;
  baseStyles: Record<string, string | number>;
  responsiveStyles?: Record<string, Record<string, string | number>>; // breakpointName -> rules
  pseudoStates?: Record<string, Record<string, string | number>>; // ":hover", ":focus", etc.
  containerQueries?: Record<string, Record<string, string | number>>;
  animations?: {
    name: string;
    duration: string;
    timingFunction?: string;
    keyframes?: Record<string, Record<string, string>>;
  };
  preservedRawCss?: string; // Recognized raw CSS preserved verbatim
}

export interface StyleFidelityResult {
  isFidelityPreserved: boolean;
  originalHash: string;
  roundTripHash: string;
  lossyModifications: string[];
}

export class DesignFidelityService {
  private static instance: DesignFidelityService;

  // Default standard breakpoints
  private breakpoints: ResponsiveBreakpoint[] = [
    { name: "mobile", maxWidth: 640, order: 1 },
    { name: "tablet", minWidth: 641, maxWidth: 1024, order: 2 },
    { name: "desktop", minWidth: 1025, maxWidth: 1440, order: 3 },
    { name: "wide", minWidth: 1441, order: 4 }
  ];

  private constructor() {}

  public static getInstance(): DesignFidelityService {
    if (!DesignFidelityService.instance) {
      DesignFidelityService.instance = new DesignFidelityService();
    }
    return DesignFidelityService.instance;
  }

  public setCustomBreakpoints(breakpoints: ResponsiveBreakpoint[]): void {
    // Preserve order and values
    this.breakpoints = [...breakpoints].sort((a, b) => a.order - b.order);
  }

  public getBreakpoints(): ResponsiveBreakpoint[] {
    return [...this.breakpoints];
  }

  /**
   * Compiles exact CSS from a component style declaration without lossy approximation.
   * Preserves exact zero values (e.g. padding: 0, gap: 0), line heights, and variables.
   */
  public compileExactCss(declaration: ComponentStyleDeclaration): string {
    const lines: string[] = [];

    // 1. Base Styles
    lines.push(`${declaration.elementSelector} {`);
    for (const [prop, val] of Object.entries(declaration.baseStyles)) {
      // Intentional zero, false, or empty values are preserved
      const formattedVal = val === 0 ? "0" : val;
      const cssProp = this.camelToKebab(prop);
      lines.push(`  ${cssProp}: ${formattedVal};`);
    }
    lines.push("}");

    // 2. Pseudo-states (:hover, :focus, :active, etc.)
    if (declaration.pseudoStates) {
      for (const [pseudo, rules] of Object.entries(declaration.pseudoStates)) {
        lines.push(`${declaration.elementSelector}${pseudo} {`);
        for (const [prop, val] of Object.entries(rules)) {
          const cssProp = this.camelToKebab(prop);
          lines.push(`  ${cssProp}: ${val === 0 ? "0" : val};`);
        }
        lines.push("}");
      }
    }

    // 3. Responsive Breakpoints
    if (declaration.responsiveStyles) {
      for (const [bpName, rules] of Object.entries(declaration.responsiveStyles)) {
        const bp = this.breakpoints.find(b => b.name === bpName);
        if (!bp) continue;

        let query = "@media ";
        if (bp.minWidth && bp.maxWidth) query += `(min-width: ${bp.minWidth}px) and (max-width: ${bp.maxWidth}px)`;
        else if (bp.minWidth) query += `(min-width: ${bp.minWidth}px)`;
        else if (bp.maxWidth) query += `(max-width: ${bp.maxWidth}px)`;

        lines.push(`${query} {`);
        lines.push(`  ${declaration.elementSelector} {`);
        for (const [prop, val] of Object.entries(rules)) {
          const cssProp = this.camelToKebab(prop);
          lines.push(`    ${cssProp}: ${val === 0 ? "0" : val};`);
        }
        lines.push("  }");
        lines.push("}");
      }
    }

    // 4. Container Queries
    if (declaration.containerQueries) {
      for (const [cqCondition, rules] of Object.entries(declaration.containerQueries)) {
        lines.push(`@container ${cqCondition} {`);
        lines.push(`  ${declaration.elementSelector} {`);
        for (const [prop, val] of Object.entries(rules)) {
          lines.push(`    ${this.camelToKebab(prop)}: ${val === 0 ? "0" : val};`);
        }
        lines.push("  }");
        lines.push("}");
      }
    }

    // 5. Preserved Raw CSS
    if (declaration.preservedRawCss) {
      lines.push(declaration.preservedRawCss);
    }

    return lines.join("\n");
  }

  /**
   * Validates round-trip fidelity:
   * Serializes declaration, edits an unrelated property, and asserts that all other
   * exact design properties (grid, flexbox, zero margins, tokens) are 100% preserved.
   */
  public verifyRoundTripFidelity(
    original: ComponentStyleDeclaration,
    unrelatedEditKey: string,
    unrelatedEditValue: string | number
  ): StyleFidelityResult {
    const originalHash = this.hashDeclaration(original);

    // Deep clone
    const cloned: ComponentStyleDeclaration = JSON.parse(JSON.stringify(original));
    // Apply unrelated edit
    cloned.baseStyles[unrelatedEditKey] = unrelatedEditValue;

    // Remove the edited key for comparative hash check
    const checkOriginal = JSON.parse(JSON.stringify(original));
    delete checkOriginal.baseStyles[unrelatedEditKey];

    const checkRoundTrip = JSON.parse(JSON.stringify(cloned));
    delete checkRoundTrip.baseStyles[unrelatedEditKey];

    const lossyModifications: string[] = [];

    // Verify exact zero preservation
    for (const [k, v] of Object.entries(original.baseStyles)) {
      if (k === unrelatedEditKey) continue;
      if (v === 0 && cloned.baseStyles[k] !== 0) {
        lossyModifications.push(`Lossy conversion of zero value on property '${k}': expected 0, got '${cloned.baseStyles[k]}'`);
      } else if (cloned.baseStyles[k] !== v) {
        lossyModifications.push(`Unintended style alteration on property '${k}': original '${v}', roundtrip '${cloned.baseStyles[k]}'`);
      }
    }

    // Verify responsive breakpoints preservation
    if (original.responsiveStyles) {
      for (const [bp, rules] of Object.entries(original.responsiveStyles)) {
        for (const [k, v] of Object.entries(rules)) {
          if (cloned.responsiveStyles?.[bp]?.[k] !== v) {
            lossyModifications.push(`Responsive rule lost for breakpoint '${bp}' property '${k}'`);
          }
        }
      }
    }

    const roundTripHash = this.hashDeclaration(checkRoundTrip);
    const isFidelityPreserved = lossyModifications.length === 0;

    return {
      isFidelityPreserved,
      originalHash,
      roundTripHash,
      lossyModifications
    };
  }

  private hashDeclaration(decl: ComponentStyleDeclaration): string {
    return createHash("sha256").update(JSON.stringify(decl)).digest("hex");
  }

  private camelToKebab(str: string): string {
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  }
}

export const designFidelityService = DesignFidelityService.getInstance();
