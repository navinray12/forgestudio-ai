/**
 * ForgeStudio Module 59: Repository Acquisition & Import Pipeline Service
 * Implements the 11-stage import pipeline:
 * DISCOVER → ACQUIRE → VERIFY → INDEX → DETECT → ANALYZE → PLAN → PREVIEW → IMPORT → VALIDATE → REPORT
 */

import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { forgeProjectService } from "../../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../../services/project/forgeFilesystem.service.js";
import { frameworkRuntimeDetector } from "./frameworkRuntimeDetector.js";
import { collaborationEngineService } from "../collaboration/collaborationEngine.service.js";
import type { ImportSourceType } from "./import.types.js";

const db = prisma as any;

export class RepositoryAcquisitionService {
  /**
   * Start a new project import pipeline
   */
  async startImport(
    arg1: any,
    arg2?: any,
    arg3?: string
  ) {
    let params: {
      sourceType: ImportSourceType;
      sourceUrl?: string;
      projectName?: string;
      ownerId: string;
      files?: Array<{ path: string; content: string }>;
    };

    if (typeof arg1 === "object" && arg1 !== null && !arg2) {
      params = arg1;
    } else {
      const body = arg2 || {};
      params = {
        sourceType: body.sourceType || "GIT",
        sourceUrl: body.sourceUrl || body.repoUrl,
        projectName: body.projectName || arg1,
        ownerId: arg3 || "anonymous",
        files: body.files || [],
      };
    }

    const { sourceType, sourceUrl, projectName = "imported-app", ownerId, files = [] } = params;

    // Stage 1: DISCOVER
    const job = await db.forgeImportJob.create({
      data: {
        ownerId,
        sourceType,
        sourceUrl: sourceUrl || null,
        status: "ACQUIRING",
        stage: "DISCOVER",
        progressPercent: 10,
      },
    });

    // Stage 2: ACQUIRE & VERIFY
    // This pipeline analyses files supplied by the caller. It does not clone repositories, so an
    // import without files fails instead of analysing invented placeholder content.
    const acquiredFiles = files;
    if (acquiredFiles.length === 0) {
      await db.forgeImportJob.update({
        where: { id: job.id },
        data: { status: "FAILED", stage: "ACQUIRE" },
      });
      throw new AppError(
        "No files were supplied. Cloning from a repository URL is not supported by this importer; use GitHub import or upload the project files.",
        422,
        "IMPORT_FILES_REQUIRED"
      );
    }

    // Verify files safety (no path traversal, reasonable size)
    for (const f of acquiredFiles) {
      if (f.path.includes("..") || f.path.startsWith("/")) {
        throw new AppError(`Unsafe file path detected in import archive: '${f.path}'`, 400, "UNSAFE_PATH");
      }
    }

    await db.forgeImportJob.update({
      where: { id: job.id },
      data: { stage: "VERIFY", progressPercent: 30 },
    });

    // Stage 3 & 4: DETECT & ANALYZE
    const { analysis, report } = frameworkRuntimeDetector.detect(acquiredFiles);

    await db.forgeImportAnalysis.create({
      data: {
        jobId: job.id,
        framework: analysis.framework,
        frameworkVersion: analysis.frameworkVersion || null,
        runtime: analysis.runtime,
        runtimeVersion: analysis.runtimeVersion || null,
        packageManager: analysis.packageManager,
        buildTools: analysis.buildTools,
        scripts: analysis.scripts,
        envReferences: analysis.envReferences,
        discoveredSecretKeys: analysis.discoveredSecretKeys.map((s) => s.keyName),
        isMonorepo: analysis.isMonorepo,
      },
    });

    await db.forgeImportReport.create({
      data: {
        jobId: job.id,
        overallScore: report.overallScore,
        compatibilityLevel: report.compatibilityLevel,
        unsupportedPatterns: report.unsupportedPatterns,
        recommendations: report.recommendations,
        filesIndexedCount: report.filesIndexedCount,
        symbolsIndexedCount: report.symbolsIndexedCount,
        routesDiscovered: report.routesDiscovered,
      },
    });

    // Stage 5 & 6: PLAN & PREVIEW
    const migrationPlan = await db.forgeMigrationPlan.create({
      data: {
        jobId: job.id,
        title: `Migration Plan for ${projectName}`,
        recommendedSteps: report.recommendations,
        configPatches: [],
        dependencyChanges: [],
        status: "PROPOSED",
      },
    });

    await db.forgeImportJob.update({
      where: { id: job.id },
      data: { stage: "PREVIEW", progressPercent: 60 },
    });

    return {
      jobId: job.id,
      analysis,
      report,
      migrationPlan,
      filesSummary: {
        count: acquiredFiles.length,
        totalBytes: analysis.totalBytes,
      },
    };
  }

  /** Returns an import job owned by the caller. */
  async getImportJob(jobId: string, ownerId: string) {
    const job = await db.forgeImportJob.findUnique({ where: { id: jobId } });
    if (!job || job.ownerId !== ownerId) throw new AppError("Import job not found", 404, "NOT_FOUND");
    return job;
  }

  /**
   * Finalize and commit the import into a real, isolated Forge Project
   */
  async commitImport(params: {
    jobId: string;
    projectName: string;
    ownerId: string;
    files?: Array<{ path: string; content: string }>;
  }) {
    const { jobId, projectName, ownerId, files } = params;

    const job = await db.forgeImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new AppError("Import job not found", 404, "NOT_FOUND");

    await db.forgeImportJob.update({
      where: { id: jobId },
      data: { stage: "IMPORT", progressPercent: 80 },
    });

    const analysisRecord = await db.forgeImportAnalysis.findFirst({ where: { jobId } });

    // Create the canonical Forge Project
    const project = await forgeProjectService.createProject(
      {
        name: projectName,
        projectType: analysisRecord?.framework === "nextjs" ? "NEXTJS" : "REACT",
        framework: analysisRecord?.framework || "react",
        runtime: analysisRecord?.runtime || "node",
        runtimeVersion: analysisRecord?.runtimeVersion || "20.x",
        packageManager: analysisRecord?.packageManager || "npm",
      },
      ownerId
    );

    // Write all acquired files into the project filesystem
    if (job.ownerId !== ownerId) throw new AppError("Import job not found", 404, "NOT_FOUND");
    if (!files || files.length === 0) {
      throw new AppError("The files to import must be supplied when committing an import.", 422, "IMPORT_FILES_REQUIRED");
    }
    for (const f of files) {
      if (f.path.includes("..") || f.path.startsWith("/")) {
        throw new AppError(`Unsafe file path detected in import: '${f.path}'`, 400, "UNSAFE_PATH");
      }
    }
    const filesToWrite = files;
    for (const f of filesToWrite) {
      await forgeFilesystemService.writeFile(project.id, f.path, f.content, ownerId);
    }

    // Write forge.manifest.json
    await forgeFilesystemService.writeFile(
      project.id,
      "forge.manifest.json",
      JSON.stringify(
        {
          manifestVersion: "1.0.0",
          name: projectName,
          framework: {
            name: analysisRecord?.framework || "react",
            runtime: "node",
            packageManager: analysisRecord?.packageManager || "npm",
          },
          importedFrom: job.sourceType,
          importedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      ownerId
    );

    // Finalize Job
    await db.forgeImportJob.update({
      where: { id: jobId },
      data: {
        projectId: project.id,
        status: "COMPLETED",
        stage: "REPORT",
        progressPercent: 100,
        updatedAt: new Date(),
      },
    });

    await collaborationEngineService.recordActivity({
      projectId: project.id,
      actorId: ownerId,
      category: "IMPORT",
      action: "project.imported",
      targetResource: `import:${jobId}`,
      details: {
        sourceType: job.sourceType,
        filesCount: filesToWrite.length,
        framework: analysisRecord?.framework,
      },
    });

    return {
      success: true,
      project,
      jobId,
    };
  }

}

export const repositoryAcquisitionService = new RepositoryAcquisitionService();
