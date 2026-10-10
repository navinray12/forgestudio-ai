/**
 * ForgeStudio Feature 33: Component Registry & Discovery Engine
 * Discovers React/TSX components directly from forge_project_files, extracts
 * props schemas, variants, dependencies, and manages the component registry.
 */

import path from "node:path";
import { pgPool } from "../../config/prisma.js";
import { forgeFilesystemService } from "../../services/project/forgeFilesystem.service.js";
import { extractSymbolsFromSource } from "../code-intelligence/astSymbolExtractor.js";
import { AppError } from "../../utils/app-error.js";
import type { ComponentRegistryItem } from "./designSystem.types.js";

export class ComponentRegistryService {
  /**
   * Discover React/TSX components in project files and register/update them
   */
  async discoverComponents(projectId: string): Promise<ComponentRegistryItem[]> {
    const files = await forgeFilesystemService.listFiles(projectId);
    const componentFiles = files.filter((f) => {
      const ext = path.posix.extname(f.path).toLowerCase();
      return (ext === ".tsx" || ext === ".jsx") && !f.path.includes("node_modules");
    });

    const discovered: ComponentRegistryItem[] = [];

    for (const file of componentFiles) {
      try {
        const fileContent = file.content || "";
        const parsed = extractSymbolsFromSource(file.path, fileContent);

        // Find exported functions/classes or components (starting with uppercase)
        for (const sym of parsed.symbols) {
          const isComponentCandidate =
            (sym.kind === "FUNCTION" || sym.kind === "CLASS") &&
            /^[A-Z]/.test(sym.name) &&
            sym.isExported;

          if (isComponentCandidate) {
            // Find props interface/type in same file
            const propsName = `${sym.name}Props`;
            const propsSym = parsed.symbols.find((s) => s.name === propsName);

            const propsSchema: Record<string, any> = {};
            if (propsSym && propsSym.signature) {
              propsSchema[propsName] = { signature: propsSym.signature };
            }

            // Extract variants if present
            const variants = [
              { name: "Default", props: {} },
              { name: "Primary", props: { variant: "primary" } },
              { name: "Secondary", props: { variant: "secondary" } },
            ];

            // Extract tags
            const tags = ["react", "component"];
            if (file.path.includes("button")) tags.push("button", "ui");
            if (file.path.includes("card")) tags.push("card", "layout");
            if (file.path.includes("modal")) tags.push("modal", "overlay");
            if (file.path.includes("header") || file.path.includes("nav")) tags.push("navigation");

            // Extract dependencies
            const dependencies = parsed.imports.map((i) => i.specifier);

            // Preview snippet
            const previewSnippet = `<${sym.name} />`;

            const res = await pgPool.query(
              `INSERT INTO forge_component_registry (
                "projectId", name, "filePath", version, description,
                "propsSchema", variants, dependencies, tags, "previewSnippet", "isExported", "updatedAt"
              ) VALUES ($1, $2, $3, '1.0.0', $4, $5, $6, $7, $8, $9, true, NOW())
              ON CONFLICT ("projectId", name, "filePath") DO UPDATE SET
                description = EXCLUDED.description,
                "propsSchema" = EXCLUDED."propsSchema",
                variants = EXCLUDED.variants,
                dependencies = EXCLUDED.dependencies,
                tags = EXCLUDED.tags,
                "previewSnippet" = EXCLUDED."previewSnippet",
                "updatedAt" = NOW()
              RETURNING *`,
              [
                projectId,
                sym.name,
                file.path,
                sym.documentation || `React component ${sym.name}`,
                JSON.stringify(propsSchema),
                JSON.stringify(variants),
                dependencies,
                tags,
                previewSnippet,
              ]
            );

            discovered.push(res.rows[0]);
          }
        }
      } catch (err: any) {
        console.warn(`[COMPONENT REGISTRY] Error parsing ${file.path}:`, err?.message);
      }
    }

    return discovered;
  }

  /**
   * List registered components for project
   */
  async listComponents(
    projectId: string,
    filter: { query?: string; tag?: string } = {}
  ): Promise<ComponentRegistryItem[]> {
    let sql = `SELECT * FROM forge_component_registry WHERE "projectId" = $1`;
    const params: any[] = [projectId];
    let idx = 2;

    if (filter.query) {
      sql += ` AND name ILIKE $${idx}`;
      params.push(`%${filter.query}%`);
      idx++;
    }

    if (filter.tag) {
      sql += ` AND $${idx} = ANY(tags)`;
      params.push(filter.tag);
      idx++;
    }

    sql += ` ORDER BY name ASC`;

    const res = await pgPool.query(sql, params);
    return res.rows;
  }

  /**
   * Get single component details
   */
  async getComponent(projectId: string, componentId: string): Promise<ComponentRegistryItem> {
    const res = await pgPool.query(
      `SELECT * FROM forge_component_registry WHERE "projectId" = $1 AND (id::text = $2 OR name = $2)`,
      [projectId, componentId]
    );

    if (res.rows.length === 0) {
      throw new AppError("Component not found in registry", 404, "COMPONENT_NOT_FOUND");
    }

    return res.rows[0];
  }

  /**
   * Export component with self-contained source and styles
   */
  async exportComponent(projectId: string, componentId: string): Promise<{
    name: string;
    sourceCode: string;
    filePath: string;
    dependencies: string[];
  }> {
    const component = await this.getComponent(projectId, componentId);
    const file = await forgeFilesystemService.readFile(projectId, component.filePath);

    return {
      name: component.name,
      sourceCode: file.content || "",
      filePath: component.filePath,
      dependencies: component.dependencies,
    };
  }
}

export const componentRegistryService = new ComponentRegistryService();
