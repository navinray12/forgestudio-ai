/**
 * ForgeStudio Module 40: Architectural Boundary & Duplicate Validator
 */

import { forgeFilesystemService } from "../../../services/project/forgeFilesystem.service.js";

export interface BoundaryValidationResult {
  layerViolations: Array<{ file: string; rule: string }>;
  duplicatedModules: Array<{ fileA: string; fileB: string; similarity: number }>;
  architectureDrift: Array<{ component: string; driftDescription: string }>;
}

export async function validateBoundariesAndDuplicates(projectId: string): Promise<BoundaryValidationResult> {
  const allFiles = await forgeFilesystemService.listFiles(projectId);
  const codeFiles = allFiles.filter(
    (f: any) =>
      !f.isDirectory &&
      (f.path.endsWith(".ts") || f.path.endsWith(".tsx") || f.path.endsWith(".js")) &&
      !f.path.includes("node_modules")
  );

  const layerViolations: Array<{ file: string; rule: string }> = [];
  const duplicatedModules: Array<{ fileA: string; fileB: string; similarity: number }> = [];
  const architectureDrift: Array<{ component: string; driftDescription: string }> = [];

  // 1. Check for layer violations and architecture drift
  for (const f of codeFiles) {
    try {
      const fileData = await forgeFilesystemService.readFile(projectId, f.path);
      const content = fileData.content || "";

      // Rule A: Frontend UI components should never import database clients or node secrets directly
      if (f.path.includes("src/components") || f.path.includes("src/pages") || f.path.includes("src/features")) {
        if (content.includes("from '@prisma/client'") || content.includes('from "prisma"') || content.includes("import pg")) {
          layerViolations.push({
            file: f.path,
            rule: "Frontend UI component imports server database client directly (Layer Violation)",
          });
        }
        if (content.includes("process.env.DATABASE_URL") || content.includes("process.env.JWT_SECRET")) {
          layerViolations.push({
            file: f.path,
            rule: "Frontend component references private server environment secrets directly",
          });
        }
      }

      // Rule B: Controller business logic bloat / architecture drift
      if (f.path.includes("controllers") && content.length > 25000) {
        architectureDrift.push({
          component: f.path,
          driftDescription: `Controller exceeds 25,000 characters (${Math.round(content.length / 1000)}k chars). Business logic should be encapsulated in dedicated services.`,
        });
      }
    } catch {}
  }

  // 2. Check for duplicate services / utilities by name similarity
  const fileBasenames = codeFiles.map((f: any) => ({
    path: f.path,
    name: f.path.split("/").pop()?.replace(/\.[^/.]+$/, "").toLowerCase() || "",
  }));

  for (let i = 0; i < fileBasenames.length; i++) {
    for (let j = i + 1; j < fileBasenames.length; j++) {
      const a = fileBasenames[i];
      const b = fileBasenames[j];
      if (a.path === b.path) continue;

      // Exact base name match in different paths (e.g. src/services/auth.ts and src/modules/auth.ts)
      if (a.name.length > 4 && a.name === b.name) {
        duplicatedModules.push({
          fileA: a.path,
          fileB: b.path,
          similarity: 1.0,
        });
      }
    }
  }

  return {
    layerViolations,
    duplicatedModules: duplicatedModules.slice(0, 10),
    architectureDrift,
  };
}
