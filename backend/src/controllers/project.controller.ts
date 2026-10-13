import { Request, Response, NextFunction } from "express";
import {
  createForgeProject,
  getForgeProjectById,
  getOrCreateProjectForWebsite,
  updateForgeProject,
  transitionProjectLifecycle,
  listForgeProjects,
  cloneForgeProject,
} from "../services/project/forgeProject.service.js";
import {
  writeFile,
  readFile,
  deleteFile,
  moveOrRenameFile,
  getProjectFileTree,
  getFileRevisions,
  createProjectSnapshot,
  listProjectSnapshots,
  listFiles,
} from "../services/project/forgeFilesystem.service.js";
import { buildZipFromFiles } from "../services/codeGenerator.service.js";
import {
  getProjectManifest,
  updateProjectManifest,
} from "../services/project/forgeManifest.service.js";
import {
  compileAndSyncProject,
} from "../services/compiler/unifiedCompiler.service.js";
import {
  syncVisualElementToSource,
  syncSourceToVisualWebsite,
} from "../services/compiler/visualCodeSync.service.js";
import {
  createGenerationPlan,
  executeGeneration,
  regenerateScope,
} from "../services/generator/index.js";
import {
  recordCheckpoint,
  findCommittedChangeSet,
  getCheckpointState,
  listCheckpointsAfter,
  kindForSyncStatus,
} from "../services/workspace/workspaceCheckpoints.service.js";
import { prisma } from "../config/prisma.js";
import { buildSyncBaseline, buildPageRegistry, parseEditorDocument, toProjectFramework } from "../services/compiler/pageRegistry.js";
import {
  listProjectPages,
  createProjectPage,
  updateProjectPage,
  deleteProjectPage,
  PageImportError,
} from "../services/project/projectPages.service.js";
import { buildSourcePreview } from "../services/preview/sourcePreview.service.js";
import { RoundTripContractService } from "../services/compiler/roundTripContract.service.js";
import {
  createPageLifecycle,
  renameOrMovePage,
  retirePageReversible,
  restorePageDraft,
} from "../services/compiler/pageRegistry.js";
import { ReferenceProjectBenchmarkService } from "../services/benchmark/referenceProjectBenchmark.service.js";
import { DynamicSourcePlannerService } from "../services/generator/dynamicSourcePlanner.service.js";
import { SafeCleanupEngineService } from "../services/generator/safeCleanupEngine.service.js";
import { DataModelGeneratorService } from "../services/generator/dataModelGenerator.service.js";
import { ExternalDatabaseIntrospectionService } from "../services/generator/externalDatabaseIntrospection.service.js";
import { contractFirstApiGenerator } from "../services/api/contractFirstApiGenerator.service.js";
import { applicationAuth } from "../services/auth/applicationAuth.service.js";
import { unifiedExecutionAuthorization } from "../services/auth/unifiedExecutionAuthorization.service.js";
import { databaseStudioViews } from "../services/database/databaseStudioViews.service.js";
import { environmentBindingService } from "../services/environment/environmentBinding.service.js";
import { targetResolutionService } from "../services/environment/targetResolution.service.js";
import { unifiedMigrationAuthority } from "../services/migration/unifiedMigrationAuthority.service.js";
import { applicationReleaseQualificationService } from "../services/qualification/applicationReleaseQualification.service.js";
import { controlPlaneReconciliationService } from "../services/architecture/controlPlaneReconciliation.service.js";



const db = prisma as any;

function getAuthUser(res: Response, req: Request) {
  const user = res.locals.user || (req as any).user;
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Project Identity & Lifecycle
// ---------------------------------------------------------------------------

export async function createProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const project = await createForgeProject({
      ...req.body,
      ownerId: user.id,
    });
    res.status(201).json({ success: true, project });
  } catch (err) {
    next(err);
  }
}

export async function getProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);

    if (project.websiteId) {
      const site = await db.website.findUnique({ where: { id: project.websiteId } });
      if (site) {
        const { syncProjectFromWebsite } = await import("../services/project/forgeProject.service.js");
        const visualSync = await syncProjectFromWebsite(project, site, user);
        const fresh = (await db.forgeProject.findUnique({ where: { id: project.id } })) || project;
        return res.status(200).json({ success: true, project: { ...fresh, visualSync } });
      }
    }

    res.status(200).json({ success: true, project });
  } catch (err) {
    next(err);
  }
}

export async function getProjectByWebsiteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const websiteId = String(req.params.websiteId);
    const project = await getOrCreateProjectForWebsite(websiteId, user);
    res.status(200).json({ success: true, project });
  } catch (err) {
    next(err);
  }
}

export async function listProjectsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const filters = {
      workspaceId: req.query.workspaceId ? String(req.query.workspaceId) : undefined,
      organizationId: req.query.organizationId ? String(req.query.organizationId) : undefined,
      status: req.query.status as any,
      projectType: req.query.projectType as any,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      skip: req.query.skip ? Number(req.query.skip) : undefined,
    };
    const result = await listForgeProjects(user, filters);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const updated = await updateForgeProject(projectId, user, req.body);
    res.status(200).json({ success: true, project: updated });
  } catch (err) {
    next(err);
  }
}

export async function transitionLifecycleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const { status } = req.body;
    const updated = await transitionProjectLifecycle(projectId, status, user);
    res.status(200).json({ success: true, project: updated });
  } catch (err) {
    next(err);
  }
}

export async function cloneProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const cloned = await cloneForgeProject(projectId, user, req.body);
    res.status(201).json({ success: true, project: cloned });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Persistent Filesystem
// ---------------------------------------------------------------------------

export async function getFileTreeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const includeIgnored = req.query.includeIgnored === "true";
    const tree = await getProjectFileTree(projectId, includeIgnored);
    res.status(200).json({ success: true, tree });
  } catch (err) {
    next(err);
  }
}

export async function readFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const filePath = String(req.query.path || "");
    const file = await readFile(projectId, filePath);
    res.status(200).json({ success: true, file });
  } catch (err) {
    next(err);
  }
}

export async function writeFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);
    const { path: filePath, content, encoding, expectedVersion, isProtected, reason } = req.body;
    // A retried save (e.g. after a lost acknowledgement) with the same change-set id returns the
    // committed result instead of writing again (blueprint §34.3, FS21-AT-SYN-07).
    const changeSetId = (req.get("Idempotency-Key") || req.body?.changeSetId || "").toString().trim().slice(0, 128) || null;
    if (changeSetId) {
      const committed = await findCommittedChangeSet(projectId, changeSetId);
      if (committed) {
        const { id, sequence, kind } = committed.checkpoint;
        return res.status(200).json({ ...(committed.response as object), checkpoint: { id, sequence, kind }, replayed: true });
      }
    }
    const previous = await db.forgeProjectFile.findFirst({ where: { projectId, path: String(filePath || ""), deletedAt: null } });
    let file = await writeFile(projectId, filePath, {
      content,
      encoding,
      expectedVersion,
      isProtected,
      authorId: user.id,
      reason,
    });

    // A saved source file is reconciled with the visual document as part of the
    // same request, so a page edit can never sit unsynchronised behind a later
    // regeneration. Failures are reported in `sync`; the saved file is kept.
    let sync: any = null;
    const changed = !previous || previous.contentHash !== file.contentHash;
    if (project.websiteId && changed && /\.(tsx|jsx)$/.test(file.path)) {
      try {
        sync = await syncSourceToVisualWebsite(projectId, project.websiteId, file.path, user.id);
      } catch (syncErr: any) {
        sync = {
          success: false,
          mode: "CODE_TO_VISUAL",
          status: "error",
          message: syncErr?.message || "Synchronisation with the visual document failed",
          appliedChangesCount: 0,
          conflicts: [],
          diagnostics: [],
          updatedFiles: [],
        };
      }
    }

    // Editing a generated file that is not a visual page makes it the user's own:
    // regeneration must not silently replace it
    if (changed && previous?.isGenerated && (!sync || sync.status === "not-a-page")) {
      await db.forgeProjectFile.update({ where: { id: file.id }, data: { isGenerated: false } });
    }

    file = (await db.forgeProjectFile.findFirst({ where: { id: file.id } })) || file;
    const body: Record<string, unknown> = { success: true, file, sync };
    if (changed || changeSetId) {
      const checkpoint = await recordCheckpoint({
        projectId,
        websiteId: project.websiteId,
        origin: "CODE",
        kind: kindForSyncStatus(sync?.status),
        filePath: file.path,
        message: sync?.message ?? null,
        changeSetId,
        response: body,
        actorId: user.id,
      });
      body.checkpoint = { id: checkpoint.id, sequence: checkpoint.sequence, kind: checkpoint.kind };
    }
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}

export async function deleteFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const filePath = String(req.query.path || req.body.path || "");
    const result = await deleteFile(projectId, filePath, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function moveFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { sourcePath, destPath } = req.body;
    const file = await moveOrRenameFile(projectId, sourcePath, destPath, user.id);
    res.status(200).json({ success: true, file });
  } catch (err) {
    next(err);
  }
}

export async function getFileRevisionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const fileId = String(req.params.fileId);
    const revisions = await getFileRevisions(projectId, fileId);
    res.status(200).json({ success: true, revisions });
  } catch (err) {
    next(err);
  }
}

export async function createSnapshotHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, description } = req.body;
    const snapshot = await createProjectSnapshot(projectId, name || "Manual Snapshot", description, user.id);
    res.status(201).json({ success: true, snapshot });
  } catch (err) {
    next(err);
  }
}

export async function listSnapshotsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const snapshots = await listProjectSnapshots(projectId);
    res.status(200).json({ success: true, snapshots });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Project Manifest
// ---------------------------------------------------------------------------

export async function getManifestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const result = await getProjectManifest(projectId, user);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateManifestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const result = await updateProjectManifest(projectId, req.body, user);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Unified Compiler & Visual ↔ Code Sync
// ---------------------------------------------------------------------------

export async function compileProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);

    let editorData = req.body.editorData;
    if (!editorData && project.websiteId) {
      const site = await db.website.findUnique({ where: { id: project.websiteId } });
      try {
        editorData = typeof site?.editorData === "string" ? JSON.parse(site.editorData) : site?.editorData;
      } catch {
        return res.status(422).json({ success: false, message: "The website's saved editor data is not valid JSON" });
      }
    }

    const result = await compileAndSyncProject(
      projectId,
      editorData || { elements: [] },
      { id: project.id, name: project.name, slug: project.slug, framework: project.framework },
      user.id
    );

    if (!result.success) {
      const firstError = result.diagnostics.find((d) => d.severity === "error");
      return res.status(422).json({
        success: false,
        message: firstError?.message || "Compilation failed",
        result,
      });
    }

    // Only source generated from the saved document counts as the sync baseline:
    // an ad-hoc document sent with the request is not what the website holds
    if (editorData && !req.body.editorData) {
      const fresh = await db.forgeProject.findUnique({ where: { id: projectId } });
      const metadata = (fresh?.metadata && typeof fresh.metadata === "object" ? fresh.metadata : {}) as Record<
        string,
        any
      >;
      await db.forgeProject.update({
        where: { id: projectId },
        data: {
          metadata: { ...metadata, visualSync: buildSyncBaseline(editorData, toProjectFramework(project.framework)) },
        },
      });
    }

    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

export async function syncVisualToCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { filePath, element, expectedRevision } = req.body;
    const result = await syncVisualElementToSource(projectId, filePath, element, {
      authorId: user.id,
      expectedRevision: expectedRevision !== undefined ? Number(expectedRevision) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/** GET /:id/workspace/checkpoint — durable latest and last synchronized checkpoints. */
export async function getWorkspaceCheckpointHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);
    const state = await getCheckpointState(projectId);
    res.status(200).json({ success: true, ...state });
  } catch (err) {
    next(err);
  }
}

/** GET /:id/workspace/checkpoints?after=N — checkpoints after a sequence, for reconnecting clients. */
export async function listWorkspaceCheckpointsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);
    const checkpoints = await listCheckpointsAfter(projectId, Number(req.query.after) || 0, Number(req.query.limit) || 100);
    res.status(200).json({ success: true, checkpoints });
  } catch (err) {
    next(err);
  }
}

export async function getRoundTripCompatibilityHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);

    const framework = (req.query.framework as any) || (project.framework === "nextjs" ? "nextjs" : "react");
    const matrix = RoundTripContractService.publishCompatibilityMatrix(framework);

    res.status(200).json({ success: true, matrix });
  } catch (err) {
    next(err);
  }
}

export async function classifyConstructHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { codeFragment, filePath } = req.body;
    const classification = RoundTripContractService.classifyConstruct(
      codeFragment || "",
      filePath || ""
    );

    res.status(200).json({ success: true, classification });
  } catch (err) {
    next(err);
  }
}

export async function createPageLifecycleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);

    const { pageName, routePath, framework, existingPages } = req.body;
    const fw = framework || (project.framework === "nextjs" ? "nextjs" : "react");

    const result = createPageLifecycle({
      projectId,
      pageName: pageName || "New Page",
      routePath: routePath || "/new-page",
      framework: fw,
      existingPages: Array.isArray(existingPages) ? existingPages : [],
    });

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function movePageLifecycleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { pages, pageKey, newRoutePath, newFilePath, newName } = req.body;
    const result = renameOrMovePage({
      pages: Array.isArray(pages) ? pages : [],
      pageKey,
      newRoutePath,
      newFilePath,
      newName,
    });

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function retirePageLifecycleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { pages, pageKey, reason } = req.body;
    const result = retirePageReversible(
      Array.isArray(pages) ? pages : [],
      pageKey,
      reason
    );

    res.status(200).json({ success: true, pages: result });
  } catch (err) {
    next(err);
  }
}

export async function restorePageLifecycleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { pages, pageKey } = req.body;
    const result = restorePageDraft(
      Array.isArray(pages) ? pages : [],
      pageKey
    );

    res.status(200).json({ success: true, pages: result });
  } catch (err) {
    next(err);
  }
}

export async function runReferenceBenchmarkHandler(req: Request, res: Response, next: NextFunction) {
  try {
    getAuthUser(res, req);
    const iterations = Number(req.body.iterations || 10);
    const report = await ReferenceProjectBenchmarkService.runBenchmark(iterations);

    res.status(200).json({ success: true, report });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Blueprint Point 37: Dynamic Source Generation & Safe Cleanup
// ---------------------------------------------------------------------------

export async function planSymbolsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { items } = req.body;
    const plansMap = DynamicSourcePlannerService.planSymbols(Array.isArray(items) ? items : []);
    const plans = Object.fromEntries(plansMap.entries());

    res.status(200).json({ success: true, plans });
  } catch (err) {
    next(err);
  }
}

export async function evaluateRegenerationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { plannedModule, existingRecord } = req.body;
    const decision = DynamicSourcePlannerService.evaluateRegenerationSafety(
      plannedModule,
      existingRecord
    );

    res.status(200).json({ success: true, decision });
  } catch (err) {
    next(err);
  }
}

export async function createCleanupPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { previousManifestFiles, newPlannedPaths, checkpointId } = req.body;
    const plan = SafeCleanupEngineService.createRemovalPlan(
      projectId,
      checkpointId || "cp_current",
      Array.isArray(previousManifestFiles) ? previousManifestFiles : [],
      new Set(Array.isArray(newPlannedPaths) ? newPlannedPaths : [])
    );

    res.status(200).json({ success: true, removalManifest: plan });
  } catch (err) {
    next(err);
  }
}

export async function applyCleanupPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { manifestId, currentFiles } = req.body;
    const currentFilesMap = new Map<string, { contentHash: string; isModifiedSince: boolean }>(
      Object.entries(currentFiles || {})
    );

    const result = SafeCleanupEngineService.applyRemovalPlan(manifestId, currentFilesMap);
    res.status(result.success ? 200 : 409).json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Blueprint Point 39: General-Purpose Application Data-Model & Introspection
// ---------------------------------------------------------------------------

export async function buildDomainModelSpecHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { entityName, description, moneyFields, relationships } = req.body;
    const spec = DataModelGeneratorService.buildDomainModelSpec({
      entityName: entityName || "Item",
      description: description || "Application domain item",
      moneyFields,
      relationships,
    });

    res.status(200).json({ success: true, spec });
  } catch (err) {
    next(err);
  }
}

export async function validateDataMutationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { payload, dtoContract, operationType } = req.body;
    const result = DataModelGeneratorService.validateIncomingMutation(
      payload || {},
      dtoContract,
      operationType || "CREATE"
    );

    res.status(result.isValid ? 200 : 400).json(result);
  } catch (err) {
    next(err);
  }
}

export async function introspectExternalDatabaseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { connectionString, existingManagedTableNames } = req.body;
    const report = await ExternalDatabaseIntrospectionService.introspectSchema(
      connectionString,
      Array.isArray(existingManagedTableNames) ? existingManagedTableNames : []
    );

    res.status(200).json({ success: true, report });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Blueprint Point 40: Contract-First APIs, Auth & Unified Authorization
// ---------------------------------------------------------------------------

export async function generateContractFirstApiHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { applicationSpec } = req.body;
    const artifacts = contractFirstApiGenerator.generateContractFirstArtifacts(applicationSpec);
    res.status(200).json({ success: true, artifacts });
  } catch (err) {
    next(err);
  }
}

export async function bootstrapApplicationAuthHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { email, password, role, apiBaseUrl } = req.body;
    const registered = applicationAuth.registerUser(
      `app_${projectId}`,
      user.tenantId || `tenant_${projectId}`,
      email || "testuser@example.com",
      password || "SuperSecretPassword123!",
      role || "USER"
    );

    const loginResult = applicationAuth.loginUser(
      `app_${projectId}`,
      email || "testuser@example.com",
      password || "SuperSecretPassword123!"
    );

    const sessionCheck = applicationAuth.verifySession(loginResult.token);
    const publicConfig = applicationAuth.buildSanitizedPublicConfig(
      `app_${projectId}`,
      apiBaseUrl || "https://api.app.example.com",
      ["auth", "orders"]
    );

    res.status(200).json({
      success: true,
      user: registered.user,
      token: loginResult.token,
      sessionValid: sessionCheck.valid,
      publicConfig,
    });
  } catch (err) {
    next(err);
  }
}

export async function evaluateUnifiedAuthorizationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { transport, subject, targetTenantId, requestedFields, resourceOwnerTenantId } = req.body;
    const decision = unifiedExecutionAuthorization.evaluateAuthorization({
      transport: transport || "HTTP_ENDPOINT",
      subject: subject || {
        userId: user.id,
        tenantId: user.tenantId || `tenant_${projectId}`,
        applicationId: `app_${projectId}`,
        roles: ["USER"],
        scopes: ["read:data"],
      },
      targetTenantId: targetTenantId || user.tenantId || `tenant_${projectId}`,
      requestedFields: Array.isArray(requestedFields) ? requestedFields : ["id", "name", "passwordHash"],
      resourceOwnerTenantId,
    });

    res.status(decision.allowed ? 200 : 403).json({ success: decision.allowed, decision });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Blueprint Point 41: One Consistent Database Schema Studio Views
// ---------------------------------------------------------------------------

export async function getDatabaseStudioViewHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const viewName = String(req.params.viewName || req.query.view || "overview").toLowerCase();
    const environment = String(req.query.environment || req.body.environment || "");

    let viewData: any;
    switch (viewName) {
      case "overview":
        viewData = databaseStudioViews.getOverviewView(projectId, environment);
        break;
      case "model-designer":
        viewData = databaseStudioViews.getModelDesignerView(projectId, environment);
        break;
      case "relationships":
        viewData = databaseStudioViews.getRelationshipView(projectId, environment);
        break;
      case "schema-inspector":
        viewData = databaseStudioViews.getSchemaInspectorView(projectId, environment);
        break;
      case "change-planner":
        viewData = databaseStudioViews.getChangePlannerView(projectId, environment, req.body.proposedChanges || []);
        break;
      case "migration-history":
        viewData = databaseStudioViews.getMigrationHistoryView(projectId, environment);
        break;
      case "data-browser":
        viewData = databaseStudioViews.getDataBrowserView(
          projectId,
          environment,
          String(req.query.table || "app_users"),
          Number(req.query.page || 1),
          Number(req.query.limit || 20)
        );
        break;
      case "api-binding":
        viewData = databaseStudioViews.getApiBindingExplorerView(projectId, environment);
        break;
      case "environments":
        viewData = databaseStudioViews.getEnvironmentsView(projectId);
        break;
      case "recovery":
        viewData = databaseStudioViews.getRecoveryView(projectId, environment);
        break;
      default:
        return res.status(400).json({ success: false, error: `Unknown Database Studio view: ${viewName}` });
    }

    res.status(200).json({ success: true, view: viewData });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Blueprint Point 42: Environment Bindings, Secrets and Isolation
// ---------------------------------------------------------------------------

export async function resolveEnvironmentBindingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const environment = req.query.environment || req.body.environment;
    const binding = environmentBindingService.getBinding(projectId, environment);

    res.status(200).json({ success: true, binding });
  } catch (err) {
    next(err);
  }
}

export async function resolveTargetPoolHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { environment, roleType } = req.body;
    const pool = targetResolutionService.resolveTargetPool(
      projectId,
      environment || "DEVELOPMENT",
      roleType || "runtime"
    );

    res.status(200).json({ success: true, pool });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Blueprint Point 43: One Migration Authority & Safe Upgrade Lifecycle
// ---------------------------------------------------------------------------

export async function executeUnifiedMigrationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { targetBindingId, namespace, authority, statements } = req.body;
    const plan = unifiedMigrationAuthority.createMigrationPlan(
      projectId,
      targetBindingId || `bind_${projectId}_dev`,
      namespace || `schema_${projectId}`,
      authority || "FORGE_MANAGED",
      Array.isArray(statements) ? statements : ["CREATE TABLE app_items (id uuid primary key);"]
    );

    // Rehearse & Approve
    const rehearsal = unifiedMigrationAuthority.rehearseMigrationPlan(plan.planId);
    unifiedMigrationAuthority.approveMigrationPlan(plan.planId, user.id);
    const result = unifiedMigrationAuthority.executeMigrationPlan(plan.planId);

    res.status(200).json({ success: true, plan, rehearsal, result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Blueprint Point 44: End-to-End Application/Database Release Qualification
// ---------------------------------------------------------------------------

export async function runReleaseQualificationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const {
      applicationSpecRevision = 1,
      applicationSpecDigest = "spec_digest_default",
      sourceCheckpointId = "chk_default",
      sourceTreeHash = "src_hash_default",
      apiContractDigest = "contract_digest_default",
      schemaVersionDigest = "schema_digest_default",
      migrationSetHash = "mig_hash_default",
      environmentBindingId = `bind_${projectId}_dev`,
      credentialReferenceVersion = 1,
      environmentClass = "DEVELOPMENT",
      syntheticMarker = "SYNTH_QUAL_TEST",
    } = req.body;

    const qualification = applicationReleaseQualificationService.runQualification({
      applicationId: `app_${projectId}`,
      projectId,
      applicationSpecRevision: Number(applicationSpecRevision),
      applicationSpecDigest,
      sourceCheckpointId,
      sourceTreeHash,
      apiContractDigest,
      schemaVersionDigest,
      migrationSetHash,
      environmentBindingId,
      credentialReferenceVersion: Number(credentialReferenceVersion),
      verifierIdentity: user.id,
      environmentClass,
      syntheticMarker,
    });

    res.status(200).json({ success: true, qualification });
  } catch (err) {
    next(err);
  }
}

export async function getReleaseQualificationRecordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const runId = String(req.params.runId);
    const record = applicationReleaseQualificationService.getQualificationRecord(runId);
    if (!record) {
      return res.status(404).json({ success: false, error: "Qualification run record not found" });
    }

    res.status(200).json({ success: true, qualification: record });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Blueprint Point 46: Reconcile Architecture and API Contracts
// ---------------------------------------------------------------------------

export async function validateGeneratedPackageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { files = [] } = req.body;
    const manifest = controlPlaneReconciliationService.validateGeneratedPackage(files);
    res.status(200).json({ success: true, manifest });
  } catch (err) {
    next(err);
  }
}

export async function verifyControlPlaneDiagnosticsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const environment = String(req.query.environment || "DEVELOPMENT");
    const diagnostics = controlPlaneReconciliationService.verifyControlPlaneConnection(projectId, environment);
    res.status(200).json({ success: true, diagnostics });
  } catch (err) {
    next(err);
  }
}



export async function syncCodeToVisualHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);

    if (!project.websiteId) {
      return res.status(400).json({
        success: false,
        message: "Project is not linked to a Visual Website",
      });
    }

    const { filePath, resolve } = req.body;
    if (typeof filePath !== "string" || !filePath.trim()) {
      return res.status(400).json({ success: false, message: "filePath is required" });
    }
    if (resolve !== undefined && resolve !== "code" && resolve !== "visual") {
      return res.status(400).json({ success: false, message: "resolve must be 'code' or 'visual'" });
    }
    const result = await syncSourceToVisualWebsite(projectId, project.websiteId, filePath, user.id, { resolve });
    const checkpoint = await recordCheckpoint({
      projectId,
      websiteId: project.websiteId,
      origin: "CODE",
      kind: kindForSyncStatus(result.status),
      filePath,
      message: result.message ?? null,
      actorId: user.id,
    });
    res.status(200).json({ ...result, checkpointId: checkpoint.id, checkpoint: { id: checkpoint.id, sequence: checkpoint.sequence, kind: checkpoint.kind } });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Project Generators (Modules 08 & 09)
// ---------------------------------------------------------------------------

function sendGenerationResult(
  res: Response,
  result: { success: boolean; diagnostics?: Array<{ severity: string; message: string }> }
) {
  if (result.success) {
    return res.status(200).json({ success: true, result });
  }
  const firstError = (result.diagnostics || []).find((d) => d.severity === "error");
  return res.status(422).json({
    success: false,
    message: firstError?.message || "Project generation failed",
    result,
  });
}

/**
 * GET /api/v1/projects/:id/export/zip
 * Download the project's persisted source files (including manual edits) as a standalone ZIP.
 */
export async function exportProjectZipHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);

    // The archive must hold source generated from the latest saved design
    if (project.websiteId) {
      const { syncBridgedProjectForWebsite } = await import("../services/project/forgeProject.service.js");
      const sync = await syncBridgedProjectForWebsite(project.websiteId, user);
      if (sync?.stale) {
        const existing = await db.forgeProjectFile.count({ where: { projectId, deletedAt: null } });
        if (existing > 0) {
          return res.status(409).json({
            success: false,
            message: `The project source could not be brought up to date with the visual design, so it was not exported: ${
              sync.error || "generation failed"
            }`,
          });
        }
      }
    }

    const files = (await listFiles(projectId)).filter((f: any) => !f.isDirectory);
    if (files.length === 0) {
      return res.status(409).json({
        success: false,
        message: "This project has no source files yet. Generate the project before exporting.",
      });
    }

    const zipBuffer = await buildZipFromFiles(files);
    const safeSlug = String(project.slug || "project").replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeFramework = String(project.framework || "source").replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeSlug}-${safeFramework}.zip"`);
    res.setHeader("Content-Length", String(zipBuffer.length));
    return res.status(200).send(zipBuffer);
  } catch (err) {
    next(err);
  }
}

export async function generateReactProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const plan = await createGenerationPlan(projectId, "react", {
      editorData: req.body?.editorData,
      reactOptions: req.body?.options,
      scope: req.body?.scope || { type: "full" },
      authorId: user.id,
    });

    const result = await executeGeneration(projectId, plan, user.id);
    sendGenerationResult(res, result);
  } catch (err) {
    next(err);
  }
}

export async function generateNextJsProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const plan = await createGenerationPlan(projectId, "nextjs", {
      editorData: req.body?.editorData,
      nextOptions: req.body?.options,
      scope: req.body?.scope || { type: "full" },
      authorId: user.id,
    });

    const result = await executeGeneration(projectId, plan, user.id);
    sendGenerationResult(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getGenerationPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const framework = (req.query.framework as "react" | "nextjs") || "react";
    const plan = await createGenerationPlan(projectId, framework, {
      editorData: req.body?.editorData,
      authorId: user.id,
    });

    res.status(200).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
}

export async function regenerateScopeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { framework = "react", scope } = req.body;
    if (!scope || !scope.type) {
      return res.status(400).json({ success: false, message: "Valid scope object is required" });
    }

    const result = await regenerateScope(projectId, framework, scope, user.id);
    sendGenerationResult(res, result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Pages (visual page registry) & source preview
// ---------------------------------------------------------------------------

function sendPageMutation(res: Response, status: number, result: any) {
  // The page change is saved either way; a failed source generation is not a success
  if (result.visualSync?.stale) {
    return res.status(422).json({
      success: false,
      message: `The page was saved, but its source could not be generated: ${result.visualSync.error || "generation failed"}`,
      ...result,
    });
  }
  return res.status(status).json({ success: true, ...result });
}

export async function listPagesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const project = await getForgeProjectById(String(req.params.id), user);
    const pages = await listProjectPages(project);
    res.status(200).json({ success: true, pages });
  } catch (err) {
    next(err);
  }
}

export async function createPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const project = await getForgeProjectById(String(req.params.id), user);
    const result = await createProjectPage(project, user, req.body || {});
    sendPageMutation(res, 201, result);
  } catch (err) {
    if (err instanceof PageImportError) {
      return res.status(422).json({ success: false, message: err.message, code: err.code, diagnostics: err.diagnostics });
    }
    next(err);
  }
}

export async function updatePageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const project = await getForgeProjectById(String(req.params.id), user);
    const result = await updateProjectPage(project, user, String(req.params.pageId), req.body || {});
    sendPageMutation(res, 200, result);
  } catch (err) {
    next(err);
  }
}

export async function deletePageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const project = await getForgeProjectById(String(req.params.id), user);
    const result = await deleteProjectPage(project, user, String(req.params.pageId));
    sendPageMutation(res, 200, result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/projects/:id/preview/source?route=/about
 * A runnable document built from the project's persisted source files.
 */
export async function getSourcePreviewHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);
    const preview = await buildSourcePreview(projectId, project.framework, req.query.route);

    let routes = preview.routes;
    if (project.websiteId) {
      const site = await db.website.findUnique({ where: { id: project.websiteId } });
      try {
        routes = buildPageRegistry(parseEditorDocument(site?.editorData), toProjectFramework(project.framework)).map(
          (page) => page.routePath
        );
      } catch {
        // An unreadable document does not prevent previewing the source that exists
      }
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ success: true, preview: { ...preview, routes } });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Developer Workspace State
// ---------------------------------------------------------------------------

export async function getWorkspaceStateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const state = await db.forgeWorkspaceState.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: user.id,
        },
      },
    });

    res.status(200).json({
      success: true,
      state: state || {
        layout: {
          openFiles: ["src/App.tsx", "forge.manifest.json"],
          activeFile: "src/App.tsx",
          mode: "code",
          panelSizes: { explorer: 260, editor: 700, preview: 400 },
        },
        preferences: { theme: "vs-dark", fontSize: 13 },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function saveWorkspaceStateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { layout, preferences } = req.body;

    const existing = await db.forgeWorkspaceState.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: user.id,
        },
      },
    });

    let state;
    if (existing) {
      state = await db.forgeWorkspaceState.update({
        where: { id: existing.id },
        data: {
          layout: layout || existing.layout,
          preferences: preferences || existing.preferences,
        },
      });
    } else {
      state = await db.forgeWorkspaceState.create({
        data: {
          projectId,
          userId: user.id,
          layout: layout || {},
          preferences: preferences || {},
        },
      });
    }

    res.status(200).json({ success: true, state });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Module 10: Dependency Manager
// ---------------------------------------------------------------------------

export async function getDependenciesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeDependencyService } = await import("../services/dependency/forgeDependency.service.js");
    const analysis = await forgeDependencyService.analyzeDependencies(projectId);
    res.status(200).json({ success: true, analysis });
  } catch (err) {
    next(err);
  }
}

export async function installDependencyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, version, isDev, isExact } = req.body;
    const { forgeDependencyService } = await import("../services/dependency/forgeDependency.service.js");
    const result = await forgeDependencyService.installDependency(projectId, name, {
      version,
      isDev,
      isExact,
      authorId: user.id,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeDependencyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name } = req.body;
    const { forgeDependencyService } = await import("../services/dependency/forgeDependency.service.js");
    const result = await forgeDependencyService.removeDependency(projectId, name, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function explainDependencyAiHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { errorMessage } = req.body;
    const { forgeDependencyService } = await import("../services/dependency/forgeDependency.service.js");
    const analysis = await forgeDependencyService.analyzeDependencies(projectId);
    const explanation = forgeDependencyService.explainDependencyFailureWithAI({
      errorMessage: errorMessage || "Unknown error",
      analysis,
    });
    res.status(200).json({ success: true, ...explanation });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Module 11: Sandbox / Runtime
// ---------------------------------------------------------------------------

export async function getRuntimeStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeSandboxService } = await import("../services/runtime/forgeSandbox.service.js");
    const runtime = await forgeSandboxService.getOrCreateRuntimeSession(projectId, "development");
    res.status(200).json({ success: true, runtime });
  } catch (err) {
    next(err);
  }
}

export async function executeSandboxHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { command, args, cwd, env, secrets } = req.body;
    const { forgeSandboxService } = await import("../services/runtime/forgeSandbox.service.js");
    const result = await forgeSandboxService.executeInSandbox({
      projectId,
      command,
      args,
      cwd,
      env,
      secrets,
      userId: user.id,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function stopSandboxProcessHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { processId } = req.body;
    const { forgeSandboxService } = await import("../services/runtime/forgeSandbox.service.js");
    const result = await forgeSandboxService.terminateSandboxProcess(processId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Module 12: Build System
// ---------------------------------------------------------------------------

export async function triggerBuildHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { buildMode, trigger } = req.body;
    const { forgeBuildService } = await import("../services/build/forgeBuild.service.js");
    const result = await forgeBuildService.runProjectBuild({
      projectId,
      buildMode,
      trigger,
      userId: user.id,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function listBuildsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeBuildService } = await import("../services/build/forgeBuild.service.js");
    const builds = await forgeBuildService.getProjectBuilds(projectId);
    res.status(200).json({ success: true, builds });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Module 13: Live Preview
// ---------------------------------------------------------------------------

export async function createPreviewSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { viewport, route } = req.body;
    const { forgePreviewService } = await import("../services/preview/forgePreview.service.js");
    const session = await forgePreviewService.createPreviewSession(projectId, { viewport, route });
    res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function updatePreviewViewportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionToken = String(req.params.token);
    const { viewport } = req.body;
    const { forgePreviewService } = await import("../services/preview/forgePreview.service.js");
    const session = await forgePreviewService.updatePreviewViewport(sessionToken, viewport);
    res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function logPreviewConsoleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionToken = String(req.params.token);
    const { forgePreviewService } = await import("../services/preview/forgePreview.service.js");
    forgePreviewService.appendPreviewConsoleMessage(sessionToken, req.body);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Module 14: Terminal
// ---------------------------------------------------------------------------

export async function createTerminalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name } = req.body;
    const { forgeTerminalService } = await import("../services/terminal/forgeTerminal.service.js");
    const session = await forgeTerminalService.createTerminalSession(projectId, name);
    res.status(201).json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function executeTerminalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const sessionId = String(req.params.sessionId);
    const { command, confirmedByUser } = req.body;

    const { forgeTerminalService } = await import("../services/terminal/forgeTerminal.service.js");
    const result = await forgeTerminalService.executeTerminalCommand(sessionId, command, {
      userId: user.id,
      confirmedByUser,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getTerminalTasksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeTerminalService } = await import("../services/terminal/forgeTerminal.service.js");
    const tasks = await forgeTerminalService.getManifestTasks(projectId);
    res.status(200).json({ success: true, tasks });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Module 15: Debugging
// ---------------------------------------------------------------------------

export async function startDebugSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { target } = req.body;
    const { forgeDebugService } = await import("../services/debug/forgeDebug.service.js");
    const session = await forgeDebugService.startDebugSession(projectId, target);
    res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function setBreakpointHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = String(req.params.sessionId);
    const { forgeDebugService } = await import("../services/debug/forgeDebug.service.js");
    const bp = await forgeDebugService.setBreakpoint(sessionId, req.body);
    res.status(200).json({ success: true, breakpoint: bp });
  } catch (err) {
    next(err);
  }
}

export async function removeBreakpointHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = String(req.params.sessionId);
    const bpId = String(req.params.bpId);
    const { forgeDebugService } = await import("../services/debug/forgeDebug.service.js");
    const removed = await forgeDebugService.removeBreakpoint(sessionId, bpId);
    res.status(200).json({ success: true, removed });
  } catch (err) {
    next(err);
  }
}

export async function stepDebugHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = String(req.params.sessionId);
    const { forgeDebugService } = await import("../services/debug/forgeDebug.service.js");
    const session = forgeDebugService.stepOver(sessionId);
    res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function askAiDebugHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = String(req.params.sessionId);
    const { errorMessage, sourceFile, line } = req.body;
    const { forgeDebugService } = await import("../services/debug/forgeDebug.service.js");
    const result = forgeDebugService.askAiToDebug({
      sessionId,
      errorMessage: errorMessage || "Unknown runtime exception",
      sourceFile: sourceFile || "src/App.tsx",
      line: line || 1,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Module 29: Source-Based Hosting Handlers
// ---------------------------------------------------------------------------

export async function detectRuntimeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeHostingService } = await import("../services/hosting/forgeHosting.service.js");
    const runtime = await forgeHostingService.detectRuntimeAndFramework(projectId);
    res.status(200).json({ success: true, runtime });
  } catch (err) {
    next(err);
  }
}

export async function createDeploymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeHostingService } = await import("../services/hosting/forgeHosting.service.js");
    const deployment = await forgeHostingService.deployFromSource(projectId, req.body || {}, user.id);
    res.status(201).json({ success: true, deployment });
  } catch (err) {
    next(err);
  }
}

export async function promoteDeploymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeHostingService } = await import("../services/hosting/forgeHosting.service.js");
    const deployment = await forgeHostingService.promoteArtifact(projectId, req.body, user.id);
    res.status(200).json({ success: true, deployment });
  } catch (err) {
    next(err);
  }
}

export async function rollbackDeploymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeHostingService } = await import("../services/hosting/forgeHosting.service.js");
    const deployment = await forgeHostingService.rollbackDeployment(projectId, req.body, user.id);
    res.status(200).json({ success: true, deployment });
  } catch (err) {
    next(err);
  }
}

export async function listDeploymentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const environment = req.query.environment as any;
    const { forgeHostingService } = await import("../services/hosting/forgeHosting.service.js");
    const deployments = await forgeHostingService.listDeployments(projectId, { environment });
    res.status(200).json({ success: true, deployments });
  } catch (err) {
    next(err);
  }
}

export async function getDeploymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const deploymentId = String(req.params.deploymentId);
    const { forgeHostingService } = await import("../services/hosting/forgeHosting.service.js");
    const deployment = await forgeHostingService.getDeploymentById(projectId, deploymentId);
    res.status(200).json({ success: true, deployment });
  } catch (err) {
    next(err);
  }
}

export async function executeDeploymentHealthCheckHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const deploymentId = String(req.params.deploymentId);
    const { forgeHostingService } = await import("../services/hosting/forgeHosting.service.js");
    const healthCheck = await forgeHostingService.executeHealthCheck(projectId, deploymentId);
    res.status(200).json({ success: true, healthCheck });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Module 30: CI/CD Pipeline Handlers
// ---------------------------------------------------------------------------

export async function createPipelineRunHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeCicdService } = await import("../services/hosting/forgeCicd.service.js");
    const pipeline = await forgeCicdService.createPipelineRun({
      projectId,
      ...req.body,
      userId: user.id,
    });
    res.status(201).json({ success: true, pipeline });
  } catch (err) {
    next(err);
  }
}

export async function listPipelinesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeCicdService } = await import("../services/hosting/forgeCicd.service.js");
    const pipelines = await forgeCicdService.listProjectPipelines(projectId);
    res.status(200).json({ success: true, pipelines });
  } catch (err) {
    next(err);
  }
}

export async function getPipelineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const pipelineId = String(req.params.pipelineId);
    const { forgeCicdService } = await import("../services/hosting/forgeCicd.service.js");
    const pipeline = await forgeCicdService.getPipelineById(projectId, pipelineId);
    res.status(200).json({ success: true, pipeline });
  } catch (err) {
    next(err);
  }
}

export async function approvePipelineGateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const pipelineId = String(req.params.pipelineId);
    const { forgeCicdService } = await import("../services/hosting/forgeCicd.service.js");
    const pipeline = await forgeCicdService.approvePipelineGate(projectId, pipelineId, user.id, req.body?.notes);
    res.status(200).json({ success: true, pipeline });
  } catch (err) {
    next(err);
  }
}

export async function rerunPipelineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const pipelineId = String(req.params.pipelineId);
    const { forgeCicdService } = await import("../services/hosting/forgeCicd.service.js");
    const pipeline = await forgeCicdService.rerunPipeline(projectId, pipelineId, user.id);
    res.status(200).json({ success: true, pipeline });
  } catch (err) {
    next(err);
  }
}

export async function cancelPipelineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const pipelineId = String(req.params.pipelineId);
    const { forgeCicdService } = await import("../services/hosting/forgeCicd.service.js");
    const pipeline = await forgeCicdService.cancelPipeline(pipelineId, user.id);
    res.status(200).json({ success: true, pipeline });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Module 31: GoDaddy & Custom Domain Automation Handlers
// ---------------------------------------------------------------------------

export async function checkDomainAvailabilityHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const domain = String(req.query.domain || "");
    if (!domain) {
      res.status(400).json({ success: false, error: "domain query parameter is required" });
      return;
    }
    const { forgeDomainService } = await import("../services/hosting/forgeDomain.service.js");
    const availability = await forgeDomainService.checkDomainAvailability(domain);
    res.status(200).json({ success: true, availability });
  } catch (err) {
    next(err);
  }
}

export async function connectDomainHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeDomainService } = await import("../services/hosting/forgeDomain.service.js");
    const customDomain = await forgeDomainService.connectExistingDomain(projectId, req.body, user.id);
    res.status(201).json({ success: true, customDomain });
  } catch (err) {
    next(err);
  }
}

export async function listDomainsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeDomainService } = await import("../services/hosting/forgeDomain.service.js");
    const domains = await forgeDomainService.listProjectDomains(projectId);
    res.status(200).json({ success: true, domains });
  } catch (err) {
    next(err);
  }
}

export async function configureDnsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const domainId = String(req.params.domainId);
    const { forgeDomainService } = await import("../services/hosting/forgeDomain.service.js");
    const result = await forgeDomainService.configureGoDaddyDns(projectId, domainId, req.body, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function verifyDomainOwnershipHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const domainId = String(req.params.domainId);
    const { forgeDomainService } = await import("../services/hosting/forgeDomain.service.js");
    const result = await forgeDomainService.verifyDomainOwnership(projectId, domainId, user.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function bindDomainDeploymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const domainId = String(req.params.domainId);
    const { deploymentId } = req.body;
    const { forgeDomainService } = await import("../services/hosting/forgeDomain.service.js");
    const customDomain = await forgeDomainService.bindDomainToDeployment(projectId, { domainId, deploymentId }, user.id);
    res.status(200).json({ success: true, customDomain });
  } catch (err) {
    next(err);
  }
}

export async function detachDomainHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const domainId = String(req.params.domainId);
    const { forgeDomainService } = await import("../services/hosting/forgeDomain.service.js");
    const result = await forgeDomainService.detachDomain(domainId, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Module 16: Local Version-Control & Git Handlers
// ---------------------------------------------------------------------------

export async function initGitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const result = await forgeGitService.initRepository(projectId, req.body?.initialBranch || "main", user.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getGitStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const status = await forgeGitService.getStatus(projectId);
    res.status(200).json({ success: true, status });
  } catch (err) {
    next(err);
  }
}

export async function stageGitFilesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { paths } = req.body;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const status = await forgeGitService.stageFiles(projectId, paths || "all", user.id);
    res.status(200).json({ success: true, status });
  } catch (err) {
    next(err);
  }
}

export async function unstageGitFilesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { paths } = req.body;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const status = await forgeGitService.unstageFiles(projectId, paths || "all", user.id);
    res.status(200).json({ success: true, status });
  } catch (err) {
    next(err);
  }
}

export async function commitGitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { message, author } = req.body;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const commit = await forgeGitService.commit(projectId, message, author, user.id);
    res.status(201).json({ success: true, commit });
  } catch (err) {
    next(err);
  }
}

export async function listGitBranchesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const branches = await forgeGitService.listBranches(projectId);
    res.status(200).json({ success: true, branches });
  } catch (err) {
    next(err);
  }
}

export async function createGitBranchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, startPoint } = req.body;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const branch = await forgeGitService.createBranch(projectId, name, startPoint, user.id);
    res.status(201).json({ success: true, branch });
  } catch (err) {
    next(err);
  }
}

export async function switchGitBranchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, createIfMissing } = req.body;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const result = await forgeGitService.switchBranch(projectId, name, !!createIfMissing, user.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function deleteGitBranchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const branchName = String(req.params.branchName);
    const force = req.query.force === "true" || req.body?.force === true;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const result = await forgeGitService.deleteBranch(projectId, branchName, force, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getGitDiffHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const staged = req.query.staged === "true";
    const filePath = req.query.filePath ? String(req.query.filePath) : undefined;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const diff = await forgeGitService.getDiff(projectId, { staged, filePath });
    res.status(200).json({ success: true, diff });
  } catch (err) {
    next(err);
  }
}

export async function getGitHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const filePath = req.query.filePath ? String(req.query.filePath) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const history = filePath
      ? await forgeGitService.getFileHistory(projectId, filePath, limit)
      : await forgeGitService.getCommitGraph(projectId, limit);
    res.status(200).json({ success: true, history });
  } catch (err) {
    next(err);
  }
}

export async function mergeGitBranchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { sourceBranch, noFastForward } = req.body;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const result = await forgeGitService.mergeBranch(projectId, sourceBranch, { noFastForward }, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function resolveGitConflictHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { filePath, resolution, manualContent } = req.body;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const result = await forgeGitService.resolveConflict(projectId, filePath, resolution, manualContent, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function abortGitMergeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const result = await forgeGitService.abortMerge(projectId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function rebaseGitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { upstreamBranch, force } = req.body;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const result = await forgeGitService.rebaseOnto(projectId, upstreamBranch, !!force, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listGitStashesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const stashes = await forgeGitService.listStashes(projectId);
    res.status(200).json({ success: true, stashes });
  } catch (err) {
    next(err);
  }
}

export async function createGitStashHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { message } = req.body;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const stash = await forgeGitService.createStash(projectId, message, user.id);
    res.status(201).json({ success: true, stash });
  } catch (err) {
    next(err);
  }
}

export async function applyGitStashHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const index = req.params.index ? Number(req.params.index) : 0;
    const drop = req.body?.drop === true;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const result = await forgeGitService.applyStash(projectId, index, drop, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function dropGitStashHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const index = req.params.index ? Number(req.params.index) : 0;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const result = await forgeGitService.dropStash(projectId, index);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function cherryPickGitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { commitHash } = req.body;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const commit = await forgeGitService.cherryPick(projectId, commitHash, user.id);
    res.status(200).json({ success: true, commit });
  } catch (err) {
    next(err);
  }
}

export async function listGitTagsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const tags = await forgeGitService.listTags(projectId);
    res.status(200).json({ success: true, tags });
  } catch (err) {
    next(err);
  }
}

export async function createGitTagHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, commitHash, message } = req.body;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const tag = await forgeGitService.createTag(projectId, name, commitHash, message, user.id);
    res.status(201).json({ success: true, tag });
  } catch (err) {
    next(err);
  }
}

export async function deleteGitTagHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const name = String(req.params.name);
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const result = await forgeGitService.deleteTag(projectId, name);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getGitGraphHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const { forgeGitService } = await import("../services/git/forgeGit.service.js");
    const graph = await forgeGitService.getCommitGraph(projectId, limit);
    res.status(200).json({ success: true, graph });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Module 17: Native GitHub Integration Handlers
// ---------------------------------------------------------------------------

export async function connectGithubHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const connection = await forgeGithubService.connectRepository(projectId, req.body, user.id);
    res.status(200).json({ success: true, connection });
  } catch (err) {
    next(err);
  }
}

export async function importGithubHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const result = await forgeGithubService.importRepository(req.body, user.id);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function createGithubRepoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const connection = await forgeGithubService.createRepository(projectId, req.body, user.id);
    res.status(201).json({ success: true, connection });
  } catch (err) {
    next(err);
  }
}

export async function fetchGithubRemoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const result = await forgeGithubService.fetchRemote(projectId, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function pullGithubRemoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { branch } = req.body;
    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const result = await forgeGithubService.pullRemote(projectId, branch, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function pushGithubRemoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { branch, force } = req.body;
    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const result = await forgeGithubService.pushRemote(projectId, { branch, force }, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function syncGithubBranchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const branch = req.query.branch ? String(req.query.branch) : undefined;
    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const sync = await forgeGithubService.synchronizeBranch(projectId, branch, user.id);
    res.status(200).json({ success: true, sync });
  } catch (err) {
    next(err);
  }
}

export async function createGithubPrHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const pullRequest = await forgeGithubService.createPullRequest(projectId, req.body, user.id);
    res.status(201).json({ success: true, pullRequest });
  } catch (err) {
    next(err);
  }
}

export async function listGithubPrsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const status = req.query.status as any;
    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const pullRequests = await forgeGithubService.listPullRequests(projectId, status);
    res.status(200).json({ success: true, pullRequests });
  } catch (err) {
    next(err);
  }
}

export async function getGithubPrDetailsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const prNumber = Number(req.params.prNumber);
    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const pullRequest = await forgeGithubService.getPullRequestDetails(projectId, prNumber);
    res.status(200).json({ success: true, pullRequest });
  } catch (err) {
    next(err);
  }
}

export async function updateGithubPrHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const prNumber = Number(req.params.prNumber);
    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const pullRequest = await forgeGithubService.updatePullRequest(projectId, prNumber, req.body, user.id);
    res.status(200).json({ success: true, pullRequest });
  } catch (err) {
    next(err);
  }
}

export async function getGithubChecksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const commitHash = String(req.params.commitHash);
    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const checks = await forgeGithubService.getCommitChecksAndActions(projectId, commitHash);
    res.status(200).json({ success: true, ...checks });
  } catch (err) {
    next(err);
  }
}

export async function githubWebhookHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { forgeGithubService } = await import("../services/git/forgeGithub.service.js");
    const result = await forgeGithubService.processWebhook(req.headers as any, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Module 18: Forge CLI Automation Handlers
// ---------------------------------------------------------------------------

export async function executeCliHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const { args = [], cwd, json = true, nonInteractive = true, projectId } = req.body;

    const { forgeCliService } = await import("../services/cli/forgeCli.service.js");
    const result = await forgeCliService.runCliCommand(args, {
      cwd,
      json,
      nonInteractive,
      userId: user.id,
      projectId,
    });
    res.status(result.exitCode === 0 ? 200 : 400).json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Modules 19–24: Forge AI Platform & MCP Handlers
// ---------------------------------------------------------------------------

export async function aiGatewayCompleteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { aiGatewayService } = await import("../modules/ai/gateway/aiGateway.service.js");
    const result = await aiGatewayService.complete({
      ...req.body,
      projectId,
      userId: user.id,
    });
    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

export async function aiGatewayModelsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { aiGatewayService } = await import("../modules/ai/gateway/aiGateway.service.js");
    const provider = req.query.provider as any;
    const models = aiGatewayService.listModels(provider);
    res.status(200).json({ success: true, models });
  } catch (err) {
    next(err);
  }
}

export async function aiGatewayHealthHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { aiGatewayService } = await import("../modules/ai/gateway/aiGateway.service.js");
    const health = aiGatewayService.getHealth();
    res.status(200).json({ success: true, health });
  } catch (err) {
    next(err);
  }
}

export async function aiGatewayByokHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { aiGatewayService } = await import("../modules/ai/gateway/aiGateway.service.js");
    const result = await aiGatewayService.registerByok({
      ...req.body,
      projectId,
      userId: user.id,
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function aiGatewayUsageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { aiGatewayService } = await import("../modules/ai/gateway/aiGateway.service.js");
    const stats = await aiGatewayService.getUsageStats(projectId, user.id);
    res.status(200).json({ success: true, stats });
  } catch (err) {
    next(err);
  }
}

export async function listToolsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { toolExecutionService } = await import("../modules/ai/tools/toolExecution.service.js");
    const category = req.query.category as string;
    const tools = toolExecutionService.listTools(category);
    res.status(200).json({ success: true, tools });
  } catch (err) {
    next(err);
  }
}

export async function executeToolHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, parameters, sessionId } = req.body;
    const { toolExecutionService } = await import("../modules/ai/tools/toolExecution.service.js");
    const result = await toolExecutionService.executeTool(name, parameters, {
      projectId,
      userId: user.id,
      sessionId,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function resolveToolApprovalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const { executionId, decision } = req.body;

    const { toolExecutionService } = await import("../modules/ai/tools/toolExecution.service.js");
    const result = await toolExecutionService.resolveApproval(executionId, decision, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createCodingSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { goal, targetFiles } = req.body;
    const { codingAgentService } = await import("../modules/ai/coding/codingAgent.service.js");
    const session = await codingAgentService.createSession({
      projectId,
      userId: user.id,
      goal,
      targetFiles,
    });
    res.status(201).json({ success: true, ...session });
  } catch (err) {
    next(err);
  }
}

export async function generateCodingPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const { sessionId } = req.body;

    const { codingAgentService } = await import("../modules/ai/coding/codingAgent.service.js");
    const plan = await codingAgentService.generatePlan(sessionId);
    res.status(200).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
}

export async function executeCodingPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const { sessionId, planId } = req.body;

    const { codingAgentService } = await import("../modules/ai/coding/codingAgent.service.js");
    const result = await codingAgentService.executePlan(sessionId, planId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function aiCreatorPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { prompt, framework } = req.body;
    const { aiCreatorService } = await import("../modules/ai/creator/aiCreator.service.js");
    const plan = await aiCreatorService.generatePlan(prompt, framework);
    res.status(200).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
}

export async function aiCreatorGenerateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const { prompt, framework } = req.body;

    const { aiCreatorService } = await import("../modules/ai/creator/aiCreator.service.js");
    const result = await aiCreatorService.createFromPrompt(prompt, user.id, framework);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function aiCreatorRegenerateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { targetFilePath, instruction } = req.body;
    const { aiCreatorService } = await import("../modules/ai/creator/aiCreator.service.js");
    const result = await aiCreatorService.regenerateSection(projectId, targetFilePath, instruction, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function aiWebsiteAuditHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { websiteAgentService } = await import("../modules/ai/website/websiteAgent.service.js");
    const report = await websiteAgentService.auditProject(projectId);
    res.status(200).json({ success: true, report });
  } catch (err) {
    next(err);
  }
}

export async function aiWebsiteFixHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { findingId } = req.body;
    const { websiteAgentService } = await import("../modules/ai/website/websiteAgent.service.js");
    const result = await websiteAgentService.fixFinding(projectId, findingId, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listMcpServersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = String(req.params.id);
    const { mcpRegistryService } = await import("../modules/ai/mcp/mcpRegistry.service.js");
    const servers = await mcpRegistryService.listServers(projectId);
    res.status(200).json({ success: true, servers });
  } catch (err) {
    next(err);
  }
}

export async function registerMcpServerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { mcpRegistryService } = await import("../modules/ai/mcp/mcpRegistry.service.js");
    const server = await mcpRegistryService.registerServer({
      ...req.body,
      projectId,
      userId: user.id,
    });
    res.status(201).json({ success: true, server });
  } catch (err) {
    next(err);
  }
}

export async function mcpJsonRpcHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = String(req.params.id);
    const { forgeMcpServerService } = await import("../modules/ai/mcp/mcpServer.service.js");
    const result = await forgeMcpServerService.handleJsonRpc(req.body, projectId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function mcpInvokeToolHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { serverId, toolName, arguments: args } = req.body;
    const { mcpClientService } = await import("../modules/ai/mcp/mcpClient.service.js");
    const result = await mcpClientService.invokeTool(serverId, toolName, args, {
      projectId,
      userId: user.id,
    });
    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

export async function mcpScaffoldHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const name = String(req.query.name || "CustomServer");
    const { mcpRegistryService } = await import("../modules/ai/mcp/mcpRegistry.service.js");
    const files = mcpRegistryService.generateServerScaffolding(name);
    res.status(200).json({ success: true, files });
  } catch (err) {
    next(err);
  }
}


