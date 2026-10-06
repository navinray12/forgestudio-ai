/**
 * ForgeStudio Module 39: Impact Analysis & Risk Detection Service
 */

import { forgeFilesystemService } from "../../../services/project/forgeFilesystem.service.js";
import { memoryConflictService } from "../memory/memoryConflict.service.js";
import { PlanRiskLevel } from "./planning.types.js";

export interface ImpactAnalysisResult {
  predictedFiles: Array<{ path: string; changeType: "create" | "modify" | "delete" | "inspect" }>;
  riskLevel: PlanRiskLevel;
  riskFactors: string[];
  requiresApproval: boolean;
  backwardCompatibilityImpact: string;
}

export class ImpactAnalysisService {
  /**
   * Analyze impact of proposed changes on the project
   */
  public async analyzeImpact(params: {
    projectId: string;
    objective: string;
    suggestedFiles?: string[];
  }): Promise<ImpactAnalysisResult> {
    const { projectId, objective, suggestedFiles = [] } = params;
    const lowerObj = objective.toLowerCase();
    const riskFactors: string[] = [];

    // 1. Scan filesystem for relevant candidate files
    const allFiles = await forgeFilesystemService.listFiles(projectId);
    const allPaths = allFiles.map((f: any) => f.path);

    const predictedFiles: Array<{ path: string; changeType: "create" | "modify" | "delete" | "inspect" }> = [];
    const addedPaths = new Set<string>();

    // Include explicitly suggested files
    for (const f of suggestedFiles) {
      if (!addedPaths.has(f)) {
        addedPaths.add(f);
        const exists = allPaths.includes(f);
        predictedFiles.push({ path: f, changeType: exists ? "modify" : "create" });
      }
    }

    // Keyword heuristics against repository files
    const words = lowerObj.split(/\s+/).filter((w) => w.length > 3);
    for (const p of allPaths) {
      const pLower = p.toLowerCase();
      if (words.some((w) => pLower.includes(w)) && !addedPaths.has(p)) {
        addedPaths.add(p);
        predictedFiles.push({ path: p, changeType: "modify" });
        if (predictedFiles.length >= 8) break;
      }
    }

    // 2. Risk factor detection
    let riskLevel: PlanRiskLevel = "LOW";

    if (lowerObj.includes("auth") || lowerObj.includes("security") || lowerObj.includes("permission") || lowerObj.includes("secret")) {
      riskFactors.push("Modifies security, authentication, or access controls.");
      riskLevel = "HIGH";
    }

    if (lowerObj.includes("migration") || lowerObj.includes("database") || lowerObj.includes("schema") || lowerObj.includes("table")) {
      riskFactors.push("Modifies database schema or persistent storage models.");
      riskLevel = "HIGH";
    }

    if (lowerObj.includes("delete") || lowerObj.includes("remove") || lowerObj.includes("drop") || lowerObj.includes("purge")) {
      riskFactors.push("Destructive deletion or purge operation detected.");
      riskLevel = "CRITICAL";
    }

    if (predictedFiles.length > 5) {
      riskFactors.push(`Broad surface area: touches ${predictedFiles.length} files.`);
      if (riskLevel === "LOW") riskLevel = "MEDIUM";
    }

    // 3. Project memory conflict check (Module 38 integration)
    const conflictReport = await memoryConflictService.detectConflicts({
      projectId,
      targetFiles: predictedFiles.map((pf) => pf.path),
      objective,
    });

    if (conflictReport.hasConflict) {
      riskFactors.push(`Conflicts with ${conflictReport.conflicts.length} active project memories.`);
      if (conflictReport.blocked) {
        riskLevel = "CRITICAL";
      } else if (conflictReport.requiresApproval) {
        riskLevel = "HIGH";
      }
    }

    const requiresApproval = riskLevel === "HIGH" || riskLevel === "CRITICAL";
    const backwardCompatibilityImpact =
      riskLevel === "CRITICAL"
        ? "Potential breaking changes to schemas or core APIs. Explicit verification required."
        : riskLevel === "HIGH"
        ? "Sensitive components modified; regression tests recommended."
        : "Standard non-breaking modifications.";

    return {
      predictedFiles,
      riskLevel,
      riskFactors,
      requiresApproval,
      backwardCompatibilityImpact,
    };
  }
}

export const impactAnalysisService = new ImpactAnalysisService();
