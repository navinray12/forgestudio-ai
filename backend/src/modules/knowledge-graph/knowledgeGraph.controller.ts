/**
 * ForgeStudio Module 36: Repository Knowledge Graph Controller
 */

import { Request, Response, NextFunction } from "express";
import { knowledgeGraphService } from "./knowledgeGraph.service.js";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { AppError } from "../../utils/app-error.js";
import type { GraphQueryType } from "./knowledgeGraph.types.js";

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

export class KnowledgeGraphController {
  /**
   * Execute query on knowledge graph
   * GET /api/knowledge-graph/query or POST /api/knowledge-graph/query
   */
  static async queryGraph(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const queryType = (req.query.queryType || req.body?.queryType || "SUBGRAPH") as GraphQueryType;
      const target = (req.query.target || req.body?.target) as string | undefined;
      const sourceNodeKey = (req.query.sourceNodeKey || req.body?.sourceNodeKey) as string | undefined;
      const targetNodeKey = (req.query.targetNodeKey || req.body?.targetNodeKey) as string | undefined;
      const depth = Number(req.query.depth || req.body?.depth || 2);

      const result = await knowledgeGraphService.queryGraph(projectId, {
        queryType,
        target,
        sourceNodeKey,
        targetNodeKey,
        depth,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Build / rebuild repository knowledge graph
   * POST /api/knowledge-graph/build
   */
  static async buildGraph(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const result = await knowledgeGraphService.buildKnowledgeGraph(projectId);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get graph overview / subgraph
   * GET /api/knowledge-graph
   */
  static async getGraph(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const target = (req.query.target as string) || "project:root";
      const depth = req.query.depth ? Number(req.query.depth) : 2;

      const result = await knowledgeGraphService.queryGraph(projectId, {
        queryType: "SUBGRAPH",
        target,
        depth,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}
