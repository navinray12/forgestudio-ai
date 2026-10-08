import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  provisionDatabase,
  deprovisionDatabase,
} from "./database-provisioner.service.js";
import {
  createBackup,
  listBackups,
  restoreBackup,
} from "./database-backup.service.js";
import { TenantPoolManager } from "../common/pool-manager.js";
import type { DatabaseEnvironment } from "../../../generated/prisma/client.js";

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || "";
  return param || "";
}

function serializeDatabaseRecord(db: any) {
  return {
    id: db.id,
    websiteId: db.websiteId,
    environment: db.environment,
    status: db.status,
    host: db.host,
    port: db.port,
    dbName: db.dbName,
    dbUser: db.dbUser,
    connectionStringTemplate: `postgresql://${db.dbUser}:[PASSWORD]@${db.host}:${db.port}/${db.dbName}`,
    storageSizeBytes: db.storageSizeBytes ? db.storageSizeBytes.toString() : "0",
    connectionPoolMax: db.connectionPoolMax,
    lastBackupAt: db.lastBackupAt,
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  };
}

function serializeBackupRecord(backup: any) {
  return {
    ...backup,
    sizeBytes: backup.sizeBytes ? backup.sizeBytes.toString() : "0",
  };
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

/**
 * POST /api/v1/projects/:projectId/database/provision
 */
export async function provisionDatabaseHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);

    const envRaw = (req.body?.environment as string) || "PRODUCTION";
    const allowedEnvs = new Set(["DEVELOPMENT", "PREVIEW", "PRODUCTION"]);
    const environment: DatabaseEnvironment = allowedEnvs.has(envRaw.toUpperCase())
      ? (envRaw.toUpperCase() as DatabaseEnvironment)
      : "PRODUCTION";

    const database = await provisionDatabase(projectId, environment);

    return res.status(200).json({
      success: true,
      message: `Tenant database provisioned successfully in ${environment} environment`,
      data: serializeDatabaseRecord(database),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/projects/:projectId/database
 */
export async function getDatabaseStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);

    const envRaw = (req.query.environment as string) || "PRODUCTION";
    const environment = envRaw.toUpperCase() as DatabaseEnvironment;

    const database = await prisma.projectDatabase.findUnique({
      where: {
        websiteId_environment: {
          websiteId: projectId,
          environment,
        },
      },
    });

    if (!database) {
      return res.status(200).json({
        success: true,
        data: null,
        provisioned: false,
      });
    }

    const telemetry = TenantPoolManager.getGlobalTelemetry();

    return res.status(200).json({
      success: true,
      provisioned: database.status === "READY",
      data: {
        ...serializeDatabaseRecord(database),
        activeConnectionsInPool: telemetry.keys.includes(`${projectId}:${environment}`) ? 1 : 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/projects/:projectId/database/backups
 */
export async function triggerBackupHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);

    const envRaw = (req.body?.environment as string) || "PRODUCTION";
    const environment = envRaw.toUpperCase() as DatabaseEnvironment;

    const backup = await createBackup(projectId, environment);

    return res.status(201).json({
      success: true,
      message: "Database snapshot backup completed successfully",
      data: serializeBackupRecord(backup),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/projects/:projectId/database/backups
 */
export async function listBackupsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);

    const backups = await listBackups(projectId);

    return res.status(200).json({
      success: true,
      data: backups.map(serializeBackupRecord),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/projects/:projectId/database/backups/:backupId/restore
 */
export async function restoreBackupHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = getParam(req.params.projectId);
    const backupId = getParam(req.params.backupId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);

    // Verify backup belongs to project
    const backup = await prisma.projectDatabaseBackup.findUnique({
      where: { id: backupId },
      include: { database: true },
    });

    if (!backup || backup.database.websiteId !== projectId) {
      throw new AppError("Backup not found for this project", 404, "BACKUP_NOT_FOUND");
    }

    await restoreBackup(backupId);

    return res.status(200).json({
      success: true,
      message: "Database restored successfully from snapshot",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/projects/:projectId/database
 */
export async function deprovisionDatabaseHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);

    const confirm = req.body?.confirm === true || req.query.confirm === "true";
    if (!confirm) {
      throw new AppError(
        "Deprovisioning requires explicit confirmation ({ confirm: true })",
        400,
        "CONFIRMATION_REQUIRED"
      );
    }

    const envRaw = (req.body?.environment as string) || (req.query.environment as string) || "PRODUCTION";
    const environment = envRaw.toUpperCase() as DatabaseEnvironment;

    await deprovisionDatabase(projectId, environment);

    return res.status(200).json({
      success: true,
      message: `Tenant database in ${environment} environment has been suspended and deprovisioned`,
    });
  } catch (error) {
    next(error);
  }
}
