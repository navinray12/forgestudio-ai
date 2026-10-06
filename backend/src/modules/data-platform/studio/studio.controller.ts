import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  getDatabaseTables,
  getTableDetails,
  getSchemaDiagram,
  createTable,
  dropTable,
  getTableRows,
  mutateTableRow,
} from "./studio-schema.service.js";
import { executeUserQuery } from "./studio-sql.service.js";
import type { DatabaseEnvironment } from "../../../generated/prisma/client.js";

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || "";
  return param || "";
}

async function verifyProjectAccess(websiteId: string, userId: string) {
  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      OR: [
        { userId },
        { collaborators: { some: { userId } } },
        { team: { members: { some: { userId } } } },
        { workspace: { members: { some: { userId } } } },
        { organization: { members: { some: { userId } } } },
      ],
    },
  });

  if (!website) {
    throw new AppError("Project not found or access denied", 404, "NOT_FOUND");
  }

  return website;
}

function resolveEnvironment(req: Request): DatabaseEnvironment {
  const raw = (req.query.environment as string) || (req.body?.environment as string) || "PRODUCTION";
  const upper = raw.toUpperCase();
  if (upper === "DEVELOPMENT" || upper === "PREVIEW" || upper === "PRODUCTION") {
    return upper as DatabaseEnvironment;
  }
  return "PRODUCTION";
}

/**
 * GET /api/v1/projects/:projectId/studio/tables
 */
export async function getTablesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);
    const env = resolveEnvironment(req);

    const tables = await getDatabaseTables(projectId, env);

    return res.status(200).json({
      success: true,
      data: tables,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/projects/:projectId/studio/tables/:tableName
 */
export async function getTableDetailsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = getParam(req.params.projectId);
    const tableName = getParam(req.params.tableName);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);
    const env = resolveEnvironment(req);

    const details = await getTableDetails(projectId, tableName, env);

    return res.status(200).json({
      success: true,
      data: details,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/projects/:projectId/studio/tables
 */
export async function createTableHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);
    const env = resolveEnvironment(req);

    const { name, columns } = req.body;
    if (!name || !columns || !Array.isArray(columns)) {
      throw new AppError("Table name and columns array are required", 400, "INVALID_INPUT");
    }

    await createTable(projectId, { name, columns }, env);

    return res.status(201).json({
      success: true,
      message: `Table "${name}" created successfully`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/projects/:projectId/studio/tables/:tableName
 */
export async function dropTableHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = getParam(req.params.projectId);
    const tableName = getParam(req.params.tableName);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);
    const env = resolveEnvironment(req);

    await dropTable(projectId, tableName, env);

    return res.status(200).json({
      success: true,
      message: `Table "${tableName}" dropped successfully`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/projects/:projectId/studio/tables/:tableName/rows
 */
export async function getTableRowsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = getParam(req.params.projectId);
    const tableName = getParam(req.params.tableName);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);
    const env = resolveEnvironment(req);

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = (req.query.sortOrder as "ASC" | "DESC") || "ASC";

    const result = await getTableRows(projectId, tableName, { page, limit, sortBy, sortOrder }, env);

    return res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/projects/:projectId/studio/tables/:tableName/rows
 */
export async function mutateTableRowHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = getParam(req.params.projectId);
    const tableName = getParam(req.params.tableName);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);
    const env = resolveEnvironment(req);

    const { action, primaryKeyColumn, primaryKeyValue, data } = req.body;
    if (!action || !primaryKeyColumn) {
      throw new AppError("action and primaryKeyColumn are required", 400, "INVALID_INPUT");
    }

    const mutated = await mutateTableRow(
      projectId,
      tableName,
      { action, primaryKeyColumn, primaryKeyValue, data },
      env
    );

    return res.status(200).json({
      success: true,
      data: mutated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/projects/:projectId/studio/diagram
 */
export async function getSchemaDiagramHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);
    const env = resolveEnvironment(req);

    const diagram = await getSchemaDiagram(projectId, env);

    return res.status(200).json({
      success: true,
      data: diagram,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/projects/:projectId/studio/query
 */
export async function executeQueryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);
    const env = resolveEnvironment(req);

    const { sql } = req.body;
    if (!sql || typeof sql !== "string") {
      throw new AppError("sql query string is required", 400, "INVALID_INPUT");
    }

    const result = await executeUserQuery(projectId, sql, env);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/projects/:projectId/studio/migrations
 */
export async function listMigrationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);

    const migrations = await prisma.databaseMigrationRecord.findMany({
      where: {
        database: {
          websiteId: projectId,
        },
      },
      orderBy: {
        appliedAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: migrations,
    });
  } catch (error) {
    next(error);
  }
}
