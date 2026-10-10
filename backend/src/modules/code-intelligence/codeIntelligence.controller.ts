/**
 * ForgeStudio Module 35: Code Intelligence Controller
 */

import { Request, Response, NextFunction } from "express";
import { codeIntelligenceService } from "./codeIntelligence.service.js";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { AppError } from "../../utils/app-error.js";
import type { CodeSymbolKind } from "./codeIntelligence.types.js";

function getAuthUser(res: Response, req: Request) {
  const user = res.locals.user || (req as any).user;
  if (!user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  return user;
}

function resolveProjectId(req: Request): string {
  const projectId =
    (req.params.id as string) ||
    (req.params.projectId as string) ||
    (req.query.projectId as string) ||
    (req.headers["x-project-id"] as string) ||
    (req.body?.projectId as string);

  if (!projectId || typeof projectId !== "string") {
    throw new AppError("Project ID is required", 400, "MISSING_PROJECT_ID");
  }

  return projectId;
}

export class CodeIntelligenceController {
  /**
   * Search / list symbols for a project
   * GET /api/intelligence/symbols
   */
  static async getSymbols(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const query = (req.query.query as string) || (req.query.q as string) || "";
      const kind = req.query.kind as CodeSymbolKind | undefined;
      const fileId = req.query.fileId as string | undefined;
      const filePath = req.query.filePath as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;

      const symbols = await codeIntelligenceService.searchSymbols(projectId, query, {
        kind,
        fileId,
        filePath,
        limit,
      });

      res.json({ success: true, symbols, count: symbols.length });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Look up definition of a symbol
   * GET /api/intelligence/definition
   */
  static async getDefinition(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const filePath = req.query.filePath as string | undefined;
      const line = req.query.line ? Number(req.query.line) : undefined;
      const character = req.query.character ? Number(req.query.character) : undefined;
      const symbolName = req.query.symbolName as string | undefined;

      const definition = await codeIntelligenceService.lookupDefinition(projectId, {
        filePath,
        line,
        character,
        symbolName,
      });

      if (!definition) {
        return res.status(404).json({ success: false, message: "Definition not found" });
      }

      res.json({ success: true, definition });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Find references to a symbol
   * GET /api/intelligence/references
   */
  static async getReferences(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const symbolId = req.query.symbolId as string | undefined;
      const symbolName = req.query.symbolName as string | undefined;
      const filePath = req.query.filePath as string | undefined;
      const line = req.query.line ? Number(req.query.line) : undefined;

      const result = await codeIntelligenceService.findReferences(projectId, {
        symbolId,
        symbolName,
        filePath,
        line,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get file dependencies and dependents
   * GET /api/intelligence/files/:fileId
   */
  static async getFileDependencies(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const fileId = req.params.fileId as string;
      const result = await codeIntelligenceService.getFileDependencies(projectId, fileId);

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Trigger full or incremental index
   * POST /api/intelligence/index
   */
  static async indexProject(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const forceReindex = Boolean(req.body?.forceReindex);
      const filePaths = Array.isArray(req.body?.filePaths) ? req.body.filePaths : undefined;

      const status = await codeIntelligenceService.indexProject(projectId, {
        forceReindex,
        filePaths,
      });

      res.status(200).json({ success: true, status });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get indexing status
   * GET /api/intelligence/status
   */
  static async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const status = await codeIntelligenceService.getIndexStatus(projectId);
      res.json({ success: true, status });
    } catch (err) {
      next(err);
    }
  }
}
