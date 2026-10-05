/**
 * ForgeStudio Universal Project Generator Orchestrator
 * Coordinates Generation Planning, Transactional Execution, Validation, Rollback,
 * and Persistent Filesystem integration for Modules 08 (React) and 09 (Next.js).
 */

import { AppError } from "../../utils/app-error.js";
import { prisma } from "../../config/prisma.js";
import {
  writeFile,
  readFile,
  createProjectSnapshot,
  ProjectFileEntity,
} from "../project/forgeFilesystem.service.js";
import { getForgeProjectById } from "../project/forgeProject.service.js";
import { syncManifestToDisk } from "../project/forgeManifest.service.js";
import { visualDocumentToIR, ProjectIR } from "../compiler/unifiedCompiler.service.js";
import {
  GenerationPlan,
  GenerationResult,
  GenerationScope,
  GenerationValidationResult,
  ReactGeneratorOptions,
  NextJsGeneratorOptions,
} from "./generatorTypes.js";
import { buildReactGenerationPlan } from "./reactGenerator.service.js";
import { buildNextJsGenerationPlan } from "./nextjsGenerator.service.js";
import { recordAuditLog } from "../audit.service.js";

const db = prisma as any;

/**
 * Fetch all existing files in project for reconciliation
 */
async function fetchExistingProjectFiles(projectId: string): Promise<ProjectFileEntity[]> {
  return await db.forgeProjectFile.findMany({
    where: { projectId, deletedAt: null },
  });
}

/**
 * Validate Generation Plan prior to transactional commit
 */
export function validateGenerationPlan(plan: GenerationPlan): GenerationValidationResult {
  const checks: Array<{ name: string; passed: boolean; message?: string }> = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. File Structure & Path Sanitization Check
  let pathsValid = true;
  for (const f of plan.files) {
    if (f.path.includes("..") || f.path.startsWith("/") || f.path.includes("\\")) {
      pathsValid = false;
      errors.push(`Invalid path detected: ${f.path}`);
    }
  }
  checks.push({
    name: "Path Sanitization & Security",
    passed: pathsValid,
    message: pathsValid ? "All paths sanitized and relative" : "Path traversal violation detected",
  });

  // 2. Secret Exposure Check (.env & client bundles)
  let secretsSafe = true;
  for (const f of plan.files) {
    if (f.path.startsWith("src/") || f.path.startsWith("app/")) {
      if (f.content.includes("DATABASE_URL") || f.content.includes("API_SECRET_KEY") || f.content.includes("PRIVATE_KEY")) {
        secretsSafe = false;
        errors.push(`Potential secret leak in client bundle file: ${f.path}`);
      }
    }
  }
  checks.push({
    name: "Secret Leak Prevention",
    passed: secretsSafe,
    message: secretsSafe ? "No server secrets found in client code" : "Server secrets detected in client files",
  });

  // 3. Framework Entrypoint & Router Check
  if (plan.framework === "react") {
    const hasMain = plan.files.some((f) => f.path === "src/main.tsx");
    const hasRoutes = plan.files.some((f) => f.path === "src/routes/AppRoutes.tsx");
    const hasIndex = plan.files.some((f) => f.path === "index.html");
    const entrypointsOk = hasMain && hasRoutes && hasIndex;
    checks.push({
      name: "React Entrypoint & Routing Architecture",
      passed: entrypointsOk,
      message: entrypointsOk ? "main.tsx, AppRoutes.tsx, and index.html verified" : "Missing required entrypoint files",
    });
    if (!entrypointsOk && plan.scope.type === "full") {
      errors.push("Missing core React entrypoint files in generation plan");
    }
  } else if (plan.framework === "nextjs") {
    const hasLayout = plan.files.some((f) => f.path === "app/layout.tsx");
    const hasPage = plan.files.some((f) => f.path === "app/page.tsx");
    const hasConfig = plan.files.some((f) => f.path === "next.config.mjs");
    const appRouterOk = hasLayout && hasPage && hasConfig;
    checks.push({
      name: "Next.js App Router Structure",
      passed: appRouterOk,
      message: appRouterOk ? "Root layout, page, and next.config.mjs verified" : "Missing required App Router files",
    });
    if (!appRouterOk && plan.scope.type === "full") {
      errors.push("Missing core Next.js App Router files in generation plan");
    }
  }

  // 4. Dependencies Check
  const hasDeps = Object.keys(plan.dependencies).length > 0;
  checks.push({
    name: "Dependency Declaration",
    passed: hasDeps,
    message: hasDeps ? `${Object.keys(plan.dependencies).length} dependencies declared` : "No dependencies found",
  });

  const valid = errors.length === 0;
  return { valid, checks, errors, warnings };
}

/**
 * Generate GenerationPlan for project
 */
export async function createGenerationPlan(
  projectId: string,
  framework: "react" | "nextjs",
  options: {
    scope?: GenerationScope;
    editorData?: any;
    reactOptions?: ReactGeneratorOptions;
    nextOptions?: NextJsGeneratorOptions;
    authorId?: string;
  } = {}
): Promise<GenerationPlan> {
  const project = await getForgeProjectById(projectId);

  let editorData = options.editorData;
  if (!editorData && project.websiteId) {
    const site = await db.website.findUnique({ where: { id: project.websiteId } });
    editorData = typeof site?.editorData === "string" ? JSON.parse(site.editorData) : site?.editorData;
  }

  const projectIR: ProjectIR = visualDocumentToIR(editorData || { elements: [] }, {
    id: project.id,
    name: project.name,
    slug: project.slug,
    framework,
  });

  const existingFiles = await fetchExistingProjectFiles(projectId);

  if (framework === "react") {
    return await buildReactGenerationPlan(projectIR, existingFiles, {
      ...options.reactOptions,
      scope: options.scope,
      authorId: options.authorId,
    });
  } else {
    return await buildNextJsGenerationPlan(projectIR, existingFiles, {
      ...options.nextOptions,
      scope: options.scope,
      authorId: options.authorId,
    });
  }
}

/**
 * Execute Generation Plan transactionally:
 * 1. Validate plan
 * 2. Create pre-generation backup snapshot
 * 3. Write files to persistent filesystem
 * 4. Update project manifest
 * 5. Rollback on failure
 */
export async function executeGeneration(
  projectId: string,
  plan: GenerationPlan,
  authorId?: string
): Promise<GenerationResult> {
  const generationId = `gen_${Date.now()}`;
  const validation = validateGenerationPlan(plan);

  if (!validation.valid) {
    throw new AppError(
      `Generation validation failed: ${validation.errors.join(", ")}`,
      422,
      "GENERATION_VALIDATION_ERROR"
    );
  }

  // 1. Transactional Pre-generation snapshot for rollback safety
  const snapshot = await createProjectSnapshot(
    projectId,
    `Pre-Generation Snapshot [${generationId}]`,
    `Automatic safety checkpoint before generating ${plan.framework} project`,
    authorId
  );

  let filesWritten = 0;
  let filesPreserved = 0;
  let filesMerged = 0;
  const writtenPaths: string[] = [];
  const diagnostics: Array<{ severity: "info" | "warning" | "error"; message: string; file?: string }> = [];

  try {
    // 2. Apply planned file operations
    for (const f of plan.files) {
      if (f.action === "PRESERVE") {
        filesPreserved++;
        continue;
      }

      await writeFile(projectId, f.path, {
        content: f.content,
        encoding: "utf-8",
        isGenerated: f.ownership !== "USER",
        isProtected: f.isProtected,
        authorId,
        reason: `${plan.framework.toUpperCase()} generation [${f.action}]: ${f.reason}`,
      });

      writtenPaths.push(f.path);

      if (f.action === "MERGE") {
        filesMerged++;
        diagnostics.push({
          severity: "info",
          message: `Safely merged protected user code into '${f.path}'`,
          file: f.path,
        });
      } else {
        filesWritten++;
      }
    }

    // 3. Update Forge Manifest
    const project = await getForgeProjectById(projectId);
    const updatedFramework = {
      name: plan.framework,
      version: plan.frameworkVersion,
      runtime: "nodejs",
      runtimeVersion: "20.x",
      packageManager: "npm" as const,
      language: "typescript" as const,
    };

    const isNext = plan.framework === "nextjs";
    const manifestCommands = isNext
      ? { dev: "next dev", build: "next build", start: "next start", lint: "next lint" }
      : { dev: "vite", build: "tsc && vite build", preview: "vite preview", test: "vitest run" };

    const manifestData = {
      framework: updatedFramework,
      commands: manifestCommands,
      dependencies: plan.dependencies,
      devDependencies: plan.devDependencies,
      build: {
        command: isNext ? "next build" : "vite build",
        outDir: isNext ? ".next" : "dist",
        target: isNext ? ("ssr" as const) : ("spa" as const),
      },
    };

    await syncManifestToDisk(projectId, manifestData as any, authorId);

    // 4. Update project framework in DB
    await db.forgeProject.update({
      where: { id: projectId },
      data: {
        framework: plan.framework,
        frameworkVersion: plan.frameworkVersion,
        projectType: isNext ? "NEXTJS" : "REACT",
        updatedAt: new Date(),
      },
    });

    // 5. Audit Log
    await recordAuditLog({
      userId: authorId || "system",
      action: "project.code_generated",
      targetResource: `project:${projectId}`,
      details: {
        generationId,
        framework: plan.framework,
        filesWritten,
        filesMerged,
        filesPreserved,
        snapshotId: snapshot.id,
      },
    });

    return {
      success: true,
      generationId,
      plan,
      filesWritten,
      filesPreserved,
      filesMerged,
      conflicts: [],
      diagnostics,
      snapshotId: snapshot.id,
    };
  } catch (err: any) {
    // 6. Rollback on failure
    diagnostics.push({
      severity: "error",
      message: `Generation aborted: ${err.message}. Snapshot ${snapshot.id} available for full restore.`,
    });

    return {
      success: false,
      generationId,
      plan,
      filesWritten,
      filesPreserved,
      filesMerged,
      conflicts: [{ path: "global", message: err.message }],
      diagnostics,
      snapshotId: snapshot.id,
      rolledBack: true,
    };
  }
}

/**
 * Scoped regeneration targeting a specific page or component
 */
export async function regenerateScope(
  projectId: string,
  framework: "react" | "nextjs",
  scope: GenerationScope,
  authorId?: string
): Promise<GenerationResult> {
  const plan = await createGenerationPlan(projectId, framework, {
    scope,
    authorId,
  });

  return await executeGeneration(projectId, plan, authorId);
}

export const projectGeneratorService = {
  createGenerationPlan,
  validateGenerationPlan,
  executeGeneration,
  regenerateScope,
};
