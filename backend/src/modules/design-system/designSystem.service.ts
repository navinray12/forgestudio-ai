/**
 * ForgeStudio Feature 34: Project-Level Design System Engine
 * Manages color, typography, spacing, radius, shadow, breakpoint, and semantic tokens.
 * Compiles project tokens directly into CSS variables, Tailwind configurations,
 * and TypeScript definitions saved to forge_project_files.
 */

import { pgPool } from "../../config/prisma.js";
import { forgeFilesystemService } from "../../services/project/forgeFilesystem.service.js";
import { AppError } from "../../utils/app-error.js";
import type { DesignTokenEntity, TokenCategory } from "./designSystem.types.js";

const DEFAULT_TOKENS: Array<{ category: TokenCategory; name: string; value: any; theme: "default" | "light" | "dark" }> = [
  // Colors - Default
  { category: "color", name: "primary", value: "#3b82f6", theme: "default" },
  { category: "color", name: "secondary", value: "#64748b", theme: "default" },
  { category: "color", name: "accent", value: "#8b5cf6", theme: "default" },
  { category: "color", name: "background", value: "#ffffff", theme: "light" },
  { category: "color", name: "background", value: "#0f172a", theme: "dark" },
  { category: "color", name: "text", value: "#0f172a", theme: "light" },
  { category: "color", name: "text", value: "#f8fafc", theme: "dark" },
  { category: "color", name: "surface", value: "#f1f5f9", theme: "light" },
  { category: "color", name: "surface", value: "#1e293b", theme: "dark" },
  // Typography
  { category: "typography", name: "fontSans", value: "'Inter', sans-serif", theme: "default" },
  { category: "typography", name: "fontMono", value: "'JetBrains Mono', monospace", theme: "default" },
  { category: "typography", name: "fontSizeSm", value: "0.875rem", theme: "default" },
  { category: "typography", name: "fontSizeBase", value: "1rem", theme: "default" },
  { category: "typography", name: "fontSizeLg", value: "1.25rem", theme: "default" },
  { category: "typography", name: "fontSizeXl", value: "1.5rem", theme: "default" },
  // Spacing
  { category: "spacing", name: "space1", value: "0.25rem", theme: "default" },
  { category: "spacing", name: "space2", value: "0.5rem", theme: "default" },
  { category: "spacing", name: "space4", value: "1rem", theme: "default" },
  { category: "spacing", name: "space6", value: "1.5rem", theme: "default" },
  { category: "spacing", name: "space8", value: "2rem", theme: "default" },
  // Radius
  { category: "radius", name: "radiusSm", value: "0.25rem", theme: "default" },
  { category: "radius", name: "radiusMd", value: "0.375rem", theme: "default" },
  { category: "radius", name: "radiusLg", value: "0.5rem", theme: "default" },
  { category: "radius", name: "radiusFull", value: "9999px", theme: "default" },
  // Shadows
  { category: "shadow", name: "shadowSm", value: "0 1px 2px 0 rgb(0 0 0 / 0.05)", theme: "default" },
  { category: "shadow", name: "shadowMd", value: "0 4px 6px -1px rgb(0 0 0 / 0.1)", theme: "default" },
  { category: "shadow", name: "shadowLg", value: "0 10px 15px -3px rgb(0 0 0 / 0.1)", theme: "default" },
  // Semantic
  { category: "semantic", name: "success", value: "#10b981", theme: "default" },
  { category: "semantic", name: "danger", value: "#ef4444", theme: "default" },
  { category: "semantic", name: "warning", value: "#f59e0b", theme: "default" },
  { category: "semantic", name: "info", value: "#06b6d4", theme: "default" },
];

export class DesignSystemService {
  /**
   * Initialize default design system tokens for project if empty
   */
  async ensureProjectTokens(projectId: string): Promise<DesignTokenEntity[]> {
    const existing = await pgPool.query(
      `SELECT * FROM forge_design_tokens WHERE "projectId" = $1`,
      [projectId]
    );

    if (existing.rows.length > 0) {
      return existing.rows;
    }

    // Insert defaults
    for (const t of DEFAULT_TOKENS) {
      await pgPool.query(
        `INSERT INTO forge_design_tokens ("projectId", category, name, value, "resolvedValue", theme)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ("projectId", category, name, theme) DO NOTHING`,
        [projectId, t.category, t.name, JSON.stringify(t.value), JSON.stringify(t.value), t.theme]
      );
    }

    const res = await pgPool.query(
      `SELECT * FROM forge_design_tokens WHERE "projectId" = $1 ORDER BY category ASC, name ASC`,
      [projectId]
    );
    return res.rows;
  }

  /**
   * Get all tokens for a project
   */
  async getTokens(projectId: string): Promise<DesignTokenEntity[]> {
    return this.ensureProjectTokens(projectId);
  }

  /**
   * Upsert a token
   */
  async setToken(
    projectId: string,
    token: {
      category: TokenCategory;
      name: string;
      value: any;
      theme?: "default" | "light" | "dark";
      description?: string;
    }
  ): Promise<DesignTokenEntity> {
    const theme = token.theme || "default";
    const res = await pgPool.query(
      `INSERT INTO forge_design_tokens (
        "projectId", category, name, value, "resolvedValue", theme, description, "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT ("projectId", category, name, theme) DO UPDATE SET
        value = EXCLUDED.value,
        "resolvedValue" = EXCLUDED."resolvedValue",
        description = EXCLUDED.description,
        "updatedAt" = NOW()
      RETURNING *`,
      [
        projectId,
        token.category,
        token.name,
        JSON.stringify(token.value),
        JSON.stringify(token.value),
        theme,
        token.description || null,
      ]
    );

    return res.rows[0];
  }

  /**
   * Delete a token
   */
  async deleteToken(projectId: string, category: TokenCategory, name: string, theme: string = "default"): Promise<boolean> {
    const res = await pgPool.query(
      `DELETE FROM forge_design_tokens WHERE "projectId" = $1 AND category = $2 AND name = $3 AND theme = $4`,
      [projectId, category, name, theme]
    );
    return (res.rowCount || 0) > 0;
  }

  /**
   * Compile tokens into CSS Variables, Tailwind Config, and TypeScript exports
   */
  async compileTokens(projectId: string): Promise<{
    cssVariables: string;
    tailwindConfig: string;
    typeDefinitions: string;
  }> {
    const tokens = await this.getTokens(projectId);

    // 1. Generate CSS Variables
    const defaultAndLight = tokens.filter((t) => t.theme === "default" || t.theme === "light");
    const darkTokens = tokens.filter((t) => t.theme === "dark");

    let css = `/* ForgeStudio Generated Design System Tokens */\n\n:root {\n`;
    for (const t of defaultAndLight) {
      const val = typeof t.value === "string" ? t.value : JSON.stringify(t.value);
      css += `  --forge-${t.category}-${t.name}: ${val};\n`;
    }
    css += `}\n\n.dark {\n`;
    for (const t of darkTokens) {
      const val = typeof t.value === "string" ? t.value : JSON.stringify(t.value);
      css += `  --forge-${t.category}-${t.name}: ${val};\n`;
    }
    css += `}\n`;

    // 2. Generate Tailwind Theme Extension
    const colorsObj: Record<string, string> = {};
    const spacingObj: Record<string, string> = {};
    const radiusObj: Record<string, string> = {};

    for (const t of tokens) {
      if (t.category === "color" || t.category === "semantic") {
        colorsObj[t.name] = `var(--forge-${t.category}-${t.name})`;
      } else if (t.category === "spacing") {
        spacingObj[t.name] = `var(--forge-spacing-${t.name})`;
      } else if (t.category === "radius") {
        radiusObj[t.name] = `var(--forge-radius-${t.name})`;
      }
    }

    const tailwind = `/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: ${JSON.stringify(colorsObj, null, 8).replace(/}$/, "      }")},
      spacing: ${JSON.stringify(spacingObj, null, 8).replace(/}$/, "      }")},
      borderRadius: ${JSON.stringify(radiusObj, null, 8).replace(/}$/, "      }")},
    },
  },
  plugins: [],
};
`;

    // 3. Generate TypeScript Typed Tokens
    const ts = `/** ForgeStudio Typed Design Tokens */
export const forgeTokens = {
${tokens.map((t) => `  "${t.category}.${t.name}": "var(--forge-${t.category}-${t.name})",`).join("\n")}
} as const;

export type ForgeTokenKey = keyof typeof forgeTokens;
`;

    return {
      cssVariables: css,
      tailwindConfig: tailwind,
      typeDefinitions: ts,
    };
  }

  /**
   * Apply compiled tokens to forge_project_files
   */
  async applyTokensToProject(projectId: string, userId?: string): Promise<{
    updatedFiles: string[];
  }> {
    const compiled = await this.compileTokens(projectId);
    const updatedFiles: string[] = [];

    // Write CSS Tokens
    await forgeFilesystemService.writeFile(projectId, "src/theme/tokens.css", {
      content: compiled.cssVariables,
      userId,
      reason: "Automated design token compilation",
    });
    updatedFiles.push("src/theme/tokens.css");

    // Write Tailwind Config
    await forgeFilesystemService.writeFile(projectId, "tailwind.config.js", {
      content: compiled.tailwindConfig,
      userId,
      reason: "Automated Tailwind token synchronization",
    });
    updatedFiles.push("tailwind.config.js");

    // Write TypeScript Token Helper
    await forgeFilesystemService.writeFile(projectId, "src/theme/tokens.ts", {
      content: compiled.typeDefinitions,
      userId,
      reason: "Automated TypeScript token types",
    });
    updatedFiles.push("src/theme/tokens.ts");

    return { updatedFiles };
  }
}

export const designSystemService = new DesignSystemService();
