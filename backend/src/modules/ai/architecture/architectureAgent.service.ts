/**
 * ForgeStudio Module 40: AI Architecture Agent Service
 * Discovers project architecture, validates boundaries, and flags technical drift.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { analyzeProjectDependencies } from "./dependencyAnalyzer.js";
import { validateBoundariesAndDuplicates } from "./boundaryValidator.js";
import {
  ArchitectureSnapshotEntity,
  ArchitectureFindingEntity,
} from "./architecture.types.js";

const db = prisma as any;

export class ArchitectureAgentService {
  /**
   * Run full architecture audit and create snapshot & findings
   */
  public async analyzeProjectArchitecture(projectId: string): Promise<ArchitectureSnapshotEntity> {
    if (!projectId) {
      throw new AppError("projectId is required for architecture analysis", 400, "MISSING_PROJECT_ID");
    }

    // 1. Dependency graph & circular dependency analysis
    const depGraph = await analyzeProjectDependencies(projectId);

    // 2. Boundary validation & duplication check
    const boundaryCheck = await validateBoundariesAndDuplicates(projectId);

    // 3. Calculate health score (0 - 100)
    let score = 100;
    score -= depGraph.cycles.length * 15;
    score -= boundaryCheck.layerViolations.length * 10;
    score -= boundaryCheck.duplicatedModules.length * 5;
    score -= boundaryCheck.architectureDrift.length * 5;
    score = Math.max(0, Math.min(100, score));

    // 4. Recommendations synthesis
    const recommendations: string[] = [];
    if (depGraph.cycles.length > 0) {
      recommendations.push(
        `Resolve ${depGraph.cycles.length} circular dependency cycle(s) by introducing intermediate interfaces or shared types.`
      );
    }
    if (boundaryCheck.layerViolations.length > 0) {
      recommendations.push(
        `Eliminate ${boundaryCheck.layerViolations.length} layer violation(s) to isolate client components from database & private keys.`
      );
    }
    if (boundaryCheck.duplicatedModules.length > 0) {
      recommendations.push(
        `Consolidate ${boundaryCheck.duplicatedModules.length} duplicated module(s) into shared domain services.`
      );
    }
    if (depGraph.highRiskModules.length > 0) {
      recommendations.push(
        `Refactor high-fanout modules (${depGraph.highRiskModules.slice(0, 3).join(", ")}) into modular sub-services.`
      );
    }
    if (recommendations.length === 0) {
      recommendations.push("Architecture conforms with high cohesion and clean layer boundaries.");
    }

    // 5. Persist architecture snapshot
    const snapshotRecord = await db.forgeAiArchitectureSnapshot.create({
      data: {
        projectId,
        score,
        moduleCount: depGraph.nodes.length,
        serviceCount: depGraph.nodes.filter((n) => n.type === "service").length,
        circularDependencies: depGraph.cycles,
        layerViolations: boundaryCheck.layerViolations,
        duplicatedModules: boundaryCheck.duplicatedModules,
        architectureDrift: boundaryCheck.architectureDrift,
        couplingMetrics: {
          averageFanIn:
            Object.values(depGraph.fanIn).reduce((a, b) => a + b, 0) / (depGraph.nodes.length || 1),
          averageFanOut:
            Object.values(depGraph.fanOut).reduce((a, b) => a + b, 0) / (depGraph.nodes.length || 1),
          highRiskModules: depGraph.highRiskModules,
        },
        diagramData: {
          nodes: depGraph.nodes,
          edges: depGraph.edges,
          mermaid: depGraph.mermaid,
        },
        recommendations,
      },
    });

    // 6. Generate and persist findings
    const findings: ArchitectureFindingEntity[] = [];

    // Cycle findings
    for (const c of depGraph.cycles) {
      const f = await db.forgeAiArchitectureFinding.create({
        data: {
          projectId,
          snapshotId: snapshotRecord.id,
          category: "CIRCULAR_DEPENDENCY",
          severity: "HIGH",
          title: `Circular Dependency: ${c.cycle.map((p) => p.split("/").pop()).join(" -> ")}`,
          description: `Detected import cycle between: ${c.cycle.join(" -> ")}`,
          affectedFiles: c.cycle,
          remediation: "Extract shared types or abstractions into a common module.",
          status: "OPEN",
        },
      });
      findings.push(f);
    }

    // Layer violation findings
    for (const lv of boundaryCheck.layerViolations) {
      const f = await db.forgeAiArchitectureFinding.create({
        data: {
          projectId,
          snapshotId: snapshotRecord.id,
          category: "LAYER_VIOLATION",
          severity: "CRITICAL",
          title: `Layer Violation: ${lv.file}`,
          description: lv.rule,
          affectedFiles: [lv.file],
          remediation: "Route data access through backend API routes rather than direct queries.",
          status: "OPEN",
        },
      });
      findings.push(f);
    }

    // Duplication findings
    for (const dup of boundaryCheck.duplicatedModules) {
      const f = await db.forgeAiArchitectureFinding.create({
        data: {
          projectId,
          snapshotId: snapshotRecord.id,
          category: "DUPLICATION",
          severity: "WARNING",
          title: `Duplicate Service/Module: ${dup.fileA} and ${dup.fileB}`,
          description: "Both files share identical base names and overlapping roles.",
          affectedFiles: [dup.fileA, dup.fileB],
          remediation: "Consolidate into a single canonical service.",
          status: "OPEN",
        },
      });
      findings.push(f);
    }

    return {
      ...snapshotRecord,
      findings,
    };
  }

  /**
   * Retrieve latest architecture snapshot
   */
  public async getLatestSnapshot(projectId: string): Promise<ArchitectureSnapshotEntity | null> {
    const snap = await db.forgeAiArchitectureSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    if (!snap) return null;

    const findings = await db.forgeAiArchitectureFinding.findMany({
      where: { snapshotId: snap.id },
      orderBy: { createdAt: "desc" },
    });

    return { ...snap, findings };
  }

  /**
   * List open architecture findings
   */
  public async listFindings(projectId: string): Promise<ArchitectureFindingEntity[]> {
    return await db.forgeAiArchitectureFinding.findMany({
      where: { projectId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const architectureAgentService = new ArchitectureAgentService();
