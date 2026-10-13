/**
 * ForgeStudio Modules 25–28: Forge Data Platform Controller
 * Endpoints for Forge Database, Database Studio, Data/API Layer, and Object Storage.
 */

import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../services/project/forgeProject.service.js";
import { forgeDatabaseService } from "../modules/data-platform/database/forgeDatabase.service.js";
import { migrationEngine } from "../modules/data-platform/database/migrationEngine.js";
import { databaseStudioService } from "../modules/data-platform/studio/databaseStudio.service.js";
import { dataApiService } from "../modules/data-platform/api-layer/dataApi.service.js";
import { objectStorageService } from "../modules/data-platform/storage/objectStorage.service.js";

function getAuthUser(res: Response, req: Request) {
  const user = res.locals.user || (req as any).user;
  if (!user) throw new Error("Unauthorized");
  return user;
}

// ==========================================
// Module 25: Forge Database Endpoints
// ==========================================

export async function getDatabaseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const env = (req.query.environment as any) || "development";
    const database = await forgeDatabaseService.getDatabase(projectId, env);

    res.status(200).json({ success: true, database });
  } catch (err) {
    next(err);
  }
}

export async function listDatabasesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const databases = await forgeDatabaseService.listDatabases(projectId);
    res.status(200).json({ success: true, databases });
  } catch (err) {
    next(err);
  }
}

export async function branchDatabaseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { parentEnv = "development", branchName } = req.body;
    const database = await forgeDatabaseService.branchDatabase(projectId, parentEnv, branchName);
    res.status(201).json({ success: true, database });
  } catch (err) {
    next(err);
  }
}

export async function listTablesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const tables = await forgeDatabaseService.listTables(dbId);
    res.status(200).json({ success: true, tables });
  } catch (err) {
    next(err);
  }
}

export async function getTableSchemaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const tableName = String(req.params.tableName);
    const schema = await forgeDatabaseService.getTableSchema(dbId, tableName);
    res.status(200).json({ success: true, schema });
  } catch (err) {
    next(err);
  }
}

export async function createTableHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const schema = await forgeDatabaseService.createTable(dbId, req.body);
    res.status(201).json({ success: true, schema });
  } catch (err) {
    next(err);
  }
}

export async function alterTableHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const tableName = String(req.params.tableName);
    const schema = await forgeDatabaseService.alterTable(dbId, tableName, req.body);
    res.status(200).json({ success: true, schema });
  } catch (err) {
    next(err);
  }
}

export async function dropTableHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const tableName = String(req.params.tableName);
    const confirm = Boolean(req.body.confirmed);
    const result = await forgeDatabaseService.dropTable(dbId, tableName, confirm);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function introspectSchemaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const schema = await forgeDatabaseService.introspectSchema(dbId);
    res.status(200).json({ success: true, schema });
  } catch (err) {
    next(err);
  }
}

export async function createBackupHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const backup = await forgeDatabaseService.createBackup(dbId, req.body.name);
    res.status(201).json({ success: true, backup });
  } catch (err) {
    next(err);
  }
}

export async function listBackupsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const backups = await forgeDatabaseService.listBackups(dbId);
    res.status(200).json({ success: true, backups });
  } catch (err) {
    next(err);
  }
}

export async function restoreBackupHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const backupId = String(req.params.backupId);
    const result = await forgeDatabaseService.restoreBackup(dbId, backupId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getDatabaseMetricsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const metrics = await forgeDatabaseService.getDatabaseMetrics(dbId);
    res.status(200).json({ success: true, metrics });
  } catch (err) {
    next(err);
  }
}

export async function listMigrationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const migrations = await migrationEngine.listMigrations(dbId);
    res.status(200).json({ success: true, migrations });
  } catch (err) {
    next(err);
  }
}

export async function applyMigrationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const migrationId = String(req.params.migrationId);
    const project = await getForgeProjectById(projectId, user);
    const admin = ["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(String(user.role || "").toUpperCase());
    // Runs through the migration authority; the project in the URL must own the database.
    const result = await migrationEngine.applyMigration(dbId, migrationId, {
      projectId,
      actor: { id: user.id, canAdminister: admin || project.ownerId === user.id },
    });
    res.status(200).json({ success: true, migration: result });
  } catch (err) {
    next(err);
  }
}

export async function rollbackMigrationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const migrationId = String(req.params.migrationId);
    const result = await migrationEngine.rollbackMigration(dbId, migrationId, { actor: { id: user.id } });
    res.status(200).json({ success: true, migration: result });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// Module 26: Database Studio Endpoints
// ==========================================

export async function getTableDataHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const tableName = String(req.params.tableName);
    const data = await databaseStudioService.getTableData(dbId, tableName, req.query);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function insertRowHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const tableName = String(req.params.tableName);
    const row = await databaseStudioService.insertRow(dbId, tableName, req.body);
    res.status(201).json({ success: true, row });
  } catch (err) {
    next(err);
  }
}

export async function updateRowHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const tableName = String(req.params.tableName);
    const { pkField = "id", pkValue, changes } = req.body;
    const row = await databaseStudioService.updateRow(dbId, tableName, pkField, pkValue, changes);
    res.status(200).json({ success: true, row });
  } catch (err) {
    next(err);
  }
}

export async function deleteRowHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const tableName = String(req.params.tableName);
    const { pkField = "id", pkValue } = req.body;
    const result = await databaseStudioService.deleteRow(dbId, tableName, pkField, pkValue);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function executeSqlQueryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const { sql, confirmDestructive } = req.body;
    const result = await databaseStudioService.executeSqlQuery(dbId, user.id, sql, confirmDestructive);
    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

export async function explainQueryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const { sql, analyze } = req.body;
    const result = await databaseStudioService.explainQuery(dbId, sql, analyze);
    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

export async function getQueryHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const history = await databaseStudioService.getQueryHistory(dbId);
    res.status(200).json({ success: true, history });
  } catch (err) {
    next(err);
  }
}

export async function seedTableDataHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const tableName = String(req.params.tableName);
    const count = parseInt(req.body.count) || 5;
    const result = await databaseStudioService.seedTableData(dbId, tableName, count);
    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

export async function exportTableDataHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const tableName = String(req.params.tableName);
    const format = req.query.format === "csv" ? "csv" : "json";
    const result = await databaseStudioService.exportTableData(dbId, tableName, format);

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    res.status(200).send(result.data);
  } catch (err) {
    next(err);
  }
}

// ==========================================
// Module 27: Data / API Layer Endpoints
// ==========================================

export async function getApiConfigsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const configs = await dataApiService.getApiConfigs(dbId, projectId);
    res.status(200).json({ success: true, configs });
  } catch (err) {
    next(err);
  }
}

export async function updateApiConfigHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const tableName = String(req.params.tableName);
    const config = await dataApiService.updateApiConfig(dbId, tableName, req.body);
    res.status(200).json({ success: true, config });
  } catch (err) {
    next(err);
  }
}

export async function generateOpenApiSpecHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const spec = await dataApiService.generateOpenApiSpec(projectId, dbId);
    res.status(200).json(spec);
  } catch (err) {
    next(err);
  }
}

export async function generateTypedClientHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const dbId = String(req.params.databaseId);
    const client = await dataApiService.generateTypedClient(projectId, dbId);
    res.status(200).json({ success: true, client });
  } catch (err) {
    next(err);
  }
}

// Application-Facing REST Endpoints (/data/:tableName)
export async function handleListRowsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = String(req.params.id);
    const tableName = String(req.params.tableName);
    const dbEntity = await forgeDatabaseService.getDatabase(projectId, "development");
    const data = await dataApiService.handleListRows(dbEntity.id, tableName, req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function handleGetRowHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = String(req.params.id);
    const tableName = String(req.params.tableName);
    const rowId = String(req.params.rowId);
    const dbEntity = await forgeDatabaseService.getDatabase(projectId, "development");
    const row = await dataApiService.handleGetRow(dbEntity.id, tableName, rowId);
    res.status(200).json(row);
  } catch (err) {
    next(err);
  }
}

export async function handleCreateRowHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = String(req.params.id);
    const tableName = String(req.params.tableName);
    const dbEntity = await forgeDatabaseService.getDatabase(projectId, "development");
    const row = await dataApiService.handleCreateRow(dbEntity.id, tableName, req.body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateRowHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = String(req.params.id);
    const tableName = String(req.params.tableName);
    const rowId = String(req.params.rowId);
    const dbEntity = await forgeDatabaseService.getDatabase(projectId, "development");
    const row = await dataApiService.handleUpdateRow(dbEntity.id, tableName, rowId, req.body);
    res.status(200).json(row);
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteRowHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = String(req.params.id);
    const tableName = String(req.params.tableName);
    const rowId = String(req.params.rowId);
    const dbEntity = await forgeDatabaseService.getDatabase(projectId, "development");
    const result = await dataApiService.handleDeleteRow(dbEntity.id, tableName, rowId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ==========================================
// Module 28: Object Storage Endpoints
// ==========================================

export async function createBucketHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, accessPolicy, maxSizeBytes, allowedMimeTypes } = req.body;
    const bucket = await objectStorageService.createBucket(
      projectId,
      name,
      accessPolicy,
      maxSizeBytes,
      allowedMimeTypes
    );
    res.status(201).json({ success: true, bucket });
  } catch (err) {
    next(err);
  }
}

export async function listBucketsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const buckets = await objectStorageService.listBuckets(projectId);
    res.status(200).json({ success: true, buckets });
  } catch (err) {
    next(err);
  }
}

export async function getBucketHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const bucketName = String(req.params.bucketName);
    const bucket = await objectStorageService.getBucket(projectId, bucketName);
    res.status(200).json({ success: true, bucket });
  } catch (err) {
    next(err);
  }
}

export async function deleteBucketHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const bucketName = String(req.params.bucketName);
    const result = await objectStorageService.deleteBucket(projectId, bucketName);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function uploadObjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const bucketName = String(req.params.bucketName);
    const key = req.body.key || req.query.key || (req as any).file?.originalname || "unnamed";
    const fileName = req.body.fileName || (req as any).file?.originalname || key;
    let buffer: Buffer;

    if ((req as any).file && (req as any).file.buffer) {
      buffer = (req as any).file.buffer;
    } else if (req.body.content) {
      buffer = Buffer.from(req.body.content, req.body.encoding || "utf8");
    } else {
      buffer = Buffer.alloc(0);
    }

    const obj = await objectStorageService.uploadObject(
      projectId,
      bucketName,
      key,
      fileName,
      buffer,
      req.body.mimeType || (req as any).file?.mimetype,
      req.body.metadata
    );

    res.status(201).json({ success: true, object: obj });
  } catch (err) {
    next(err);
  }
}

export async function downloadObjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = String(req.params.id);
    const bucketName = String(req.params.bucketName);
    const key = String(req.params.key);

    const { entity, buffer } = await objectStorageService.getObject(projectId, bucketName, key);

    res.setHeader("Content-Type", entity.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${entity.fileName}"`);
    res.status(200).send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function listObjectsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const bucketName = String(req.params.bucketName);
    const prefix = req.query.prefix as string | undefined;
    const objects = await objectStorageService.listObjects(projectId, bucketName, prefix);
    res.status(200).json({ success: true, objects });
  } catch (err) {
    next(err);
  }
}

export async function deleteObjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const bucketName = String(req.params.bucketName);
    const key = String(req.params.key);
    const result = await objectStorageService.deleteObject(projectId, bucketName, key);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function generateSignedUrlHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const bucketName = String(req.params.bucketName);
    const { key, method = "GET", expiresInSeconds = 300 } = req.body;
    const signed = await objectStorageService.generateSignedUrl(
      projectId,
      bucketName,
      key,
      method,
      expiresInSeconds
    );
    res.status(200).json({ success: true, signedUrl: signed });
  } catch (err) {
    next(err);
  }
}
