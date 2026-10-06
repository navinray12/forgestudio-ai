/**
 * ForgeStudio Module 62: Optimization Engine Service
 * Bundle weight analysis, tree shaking, dead code detection,
 * code splitting suggestions, Core Web Vitals predictions, and AI patches.
 */

import crypto from "crypto";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { forgeProjectService } from "../../../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../../../services/project/forgeFilesystem.service.js";
import { aiGatewayService } from "../../ai/gateway/aiGateway.service.js";
import {
  OptimizationAuditRecord,
  OptimizationRecommendation,
  OptimizationMetrics,
} from "./optimization.types.js";

const db = prisma as any;

export class OptimizationEngineService {
  /**
   * Registry of known heavy packages with lightweight modern alternatives
   */
  private readonly HEAVY_PACKAGES: Record<
    string,
    { sizeKb: number; alternative: string; impact: string }
  > = {
    moment: {
      sizeKb: 290,
      alternative: "dayjs or date-fns",
      impact: "Saves ~280 KB minified payload with identical chainable date API.",
    },
    lodash: {
      sizeKb: 72,
      alternative: "lodash-es or native ES2022 methods",
      impact: "Enables tree-shaking and reduces bundle size by ~65 KB.",
    },
    xlsx: {
      sizeKb: 450,
      alternative: "exceljs (dynamic import) or backend export",
      impact: "Removes ~450 KB from client bundle by deferring spreadsheet parsing.",
    },
    "crypto-js": {
      sizeKb: 180,
      alternative: "Web Crypto API (crypto.subtle)",
      impact: "Replaces 180 KB polyfill with native browser cryptographic primitives.",
    },
    axios: {
      sizeKb: 34,
      alternative: "native fetch() with wrapper",
      impact: "Zero-dependency HTTP client saves ~34 KB and improves startup time.",
    },
  };

  /**
   * Run a deep optimization audit of the project
   */
  async runOptimizationAudit(projectId: string): Promise<OptimizationAuditRecord> {
    await forgeProjectService.getProjectById(projectId);

    const files = await forgeFilesystemService.listFiles(projectId);
    const recommendations: OptimizationRecommendation[] = [];

    let jsBytes = 0;
    let cssBytes = 0;
    let assetBytes = 0;

    const fileContentMap: Map<string, string> = new Map();

    for (const f of files) {
      if (f.path.includes("node_modules") || f.path.includes(".git")) continue;

      let content = "";
      try {
        const fileData = await forgeFilesystemService.readFile(projectId, f.path);
        content = fileData.content || "";
        fileContentMap.set(f.path, content);
      } catch {
        continue;
      }

      const size = Buffer.byteLength(content, "utf8");
      if (f.path.endsWith(".ts") || f.path.endsWith(".tsx") || f.path.endsWith(".js") || f.path.endsWith(".jsx")) {
        jsBytes += size;
      } else if (f.path.endsWith(".css") || f.path.endsWith(".scss")) {
        cssBytes += size;
      } else if (f.path.match(/\.(png|jpg|jpeg|gif|svg|webp|woff2|woff|ttf)$/i)) {
        assetBytes += size;
      }
    }

    const totalBytes = jsBytes + cssBytes + assetBytes;
    const estimatedGzipBytes = Math.round(jsBytes * 0.3 + cssBytes * 0.25 + assetBytes * 0.85);

    // 1. Heavy Package Detection from package.json
    const heavyDeps: Array<{ name: string; sizeKb: number; alternative: string; impact: string }> = [];
    try {
      const pkgContent = fileContentMap.get("package.json");
      if (pkgContent) {
        const pkg = JSON.parse(pkgContent);
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

        for (const [depName] of Object.entries(allDeps)) {
          const match = this.HEAVY_PACKAGES[depName];
          if (match) {
            heavyDeps.push({
              name: depName,
              sizeKb: match.sizeKb,
              alternative: match.alternative,
              impact: match.impact,
            });

            recommendations.push({
              id: `rec-heavy-${depName}`,
              ruleId: "OPT-HEAVY-PKG",
              category: "BUNDLE",
              severity: match.sizeKb > 150 ? "HIGH" : "MEDIUM",
              title: `Replace heavy dependency '${depName}' (${match.sizeKb} KB)`,
              description: `Package '${depName}' adds ${match.sizeKb} KB to the production bundle. ${match.impact}`,
              estimatedSavingBytes: match.sizeKb * 1024,
              actionableDiff: `npm uninstall ${depName} && npm install ${match.alternative.split(" ")[0]}`,
              targetFile: "package.json",
            });
          }
        }
      }
    } catch {}

    // 2. Dead Code / Unused Export Detection
    const unusedExports: Array<{ file: string; exportedName: string }> = [];
    const allCodeContent = Array.from(fileContentMap.entries())
      .filter(([p]) => p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".js"))
      .map(([_, c]) => c)
      .join("\n");

    for (const [filePath, content] of fileContentMap.entries()) {
      if (!filePath.startsWith("src/")) continue;

      const exportMatches = content.matchAll(/export\s+(?:const|function|class)\s+([a-zA-Z0-9_]+)/g);
      for (const m of exportMatches) {
        const expName = m[1];
        if (expName === "default" || expName.startsWith("use")) continue;

        // Check occurrence count across all other files
        const occurrences = (allCodeContent.match(new RegExp(`\\b${expName}\\b`, "g")) || []).length;
        if (occurrences <= 1) {
          unusedExports.push({ file: filePath, exportedName: expName });
          recommendations.push({
            id: `rec-dead-${filePath}-${expName}`,
            ruleId: "OPT-DEAD-CODE",
            category: "DEAD_CODE",
            severity: "LOW",
            title: `Unused export '${expName}' in ${filePath}`,
            description: `Exported symbol '${expName}' has no internal consumers in the workspace and can be tree-shaken or pruned.`,
            estimatedSavingBytes: 512,
            targetFile: filePath,
          });
        }
      }
    }

    // 3. Code Splitting Candidates
    const codeSplittingCandidates: Array<{ file: string; componentName: string; suggestedImport: string }> = [];
    for (const [filePath, content] of fileContentMap.entries()) {
      const modalOrChartImports = content.matchAll(
        /import\s+\{?\s*([a-zA-Z0-9_]+Modal|[a-zA-Z0-9_]+Chart|[a-zA-Z0-9_]+Editor)\s*\}?\s+from\s+['"]([^'"]+)['"]/g
      );

      for (const match of modalOrChartImports) {
        const compName = match[1];
        const importSrc = match[2];
        codeSplittingCandidates.push({
          file: filePath,
          componentName: compName,
          suggestedImport: `const ${compName} = React.lazy(() => import("${importSrc}"));`,
        });

        recommendations.push({
          id: `rec-split-${compName}`,
          ruleId: "OPT-CODE-SPLIT",
          category: "CODE_SPLITTING",
          severity: "MEDIUM",
          title: `Lazy-load heavy interactive component '${compName}'`,
          description: `Direct import of '${compName}' inflates the initial bundle. Split via React.lazy() to load on demand.`,
          estimatedSavingBytes: 45 * 1024,
          actionableDiff: `const ${compName} = React.lazy(() => import("${importSrc}"));`,
          targetFile: filePath,
        });
      }
    }

    // 4. Core Web Vitals Simulation
    const totalBundleKb = Math.round(jsBytes / 1024);
    const lcpMs = Math.min(4500, Math.round(800 + totalBundleKb * 1.5));
    const fidMs = Math.min(300, Math.round(15 + totalBundleKb * 0.1));
    const cls = totalBundleKb > 800 ? 0.08 : 0.01;
    let vitalsScore = 100;
    if (lcpMs > 2500) vitalsScore -= 25;
    else if (lcpMs > 1800) vitalsScore -= 10;
    if (fidMs > 100) vitalsScore -= 15;

    // 5. Total Optimization Score
    let score = 100;
    score -= heavyDeps.length * 15;
    score -= Math.min(30, unusedExports.length * 3);
    score -= Math.min(20, codeSplittingCandidates.length * 5);
    if (totalBundleKb > 1000) score -= 20;
    else if (totalBundleKb > 500) score -= 10;
    score = Math.max(20, Math.min(100, score));

    const metrics: OptimizationMetrics = {
      jsBytes,
      cssBytes,
      assetBytes,
      heavyDependencies: heavyDeps,
      webVitalsPrediction: {
        lcpMs,
        fidMs,
        cls,
        score: vitalsScore,
      },
      unusedExports,
      codeSplittingCandidates,
    };

    const record = await db.forgeOptimizationAudit.create({
      data: {
        projectId,
        score,
        totalBytes,
        estimatedGzipBytes,
        deadCodeCount: unusedExports.length,
        heavyDepCount: heavyDeps.length,
        recommendationsCount: recommendations.length,
        metrics,
        recommendations,
        createdAt: new Date(),
      },
    });

    return record;
  }

  async getLatestAudit(projectId: string): Promise<OptimizationAuditRecord | null> {
    await forgeProjectService.getProjectById(projectId);

    return await db.forgeOptimizationAudit.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listAudits(projectId: string): Promise<OptimizationAuditRecord[]> {
    await forgeProjectService.getProjectById(projectId);

    return await db.forgeOptimizationAudit.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async generateAiOptimizationPatch(
    projectId: string,
    recommendationId: string
  ): Promise<{ recommendationId: string; summary: string; patchCode: string }> {
    await forgeProjectService.getProjectById(projectId);

    const latest = await this.getLatestAudit(projectId);
    if (!latest) throw new AppError("No optimization audit found", 404, "NOT_FOUND");

    const rec = latest.recommendations.find((r) => r.id === recommendationId);
    if (!rec) throw new AppError("Recommendation not found", 404, "NOT_FOUND");

    try {
      const prompt = `Synthesize an optimized code patch for this performance recommendation in project ${projectId}:\nRule: ${rec.ruleId} - ${rec.title}\nCategory: ${rec.category}\nTarget File: ${rec.targetFile || "N/A"}\nDetails: ${rec.description}\n\nProvide the code replacement to optimize this.`;
      const aiResponse = await aiGatewayService.executePrompt(prompt, {
        maxTokens: 500,
        temperature: 0.1,
      });

      return {
        recommendationId,
        summary: `AI Patch for ${rec.title}`,
        patchCode: aiResponse.text || rec.actionableDiff || "// Apply code optimization",
      };
    } catch {
      return {
        recommendationId,
        summary: `AI Patch for ${rec.title}`,
        patchCode: rec.actionableDiff || "// Optimization guideline:\n" + rec.description,
      };
    }
  }
}

export const optimizationEngineService = new OptimizationEngineService();
