import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import {
  provisionDatabaseHandler,
  getDatabaseStatusHandler,
  triggerBackupHandler,
  listBackupsHandler,
  restoreBackupHandler,
  deprovisionDatabaseHandler,
} from "./database.controller.js";

export const databaseRoutes = Router({ mergeParams: true });

// 1. Provision isolated PostgreSQL tenant database
databaseRoutes.post("/provision", requireAuth, provisionDatabaseHandler);

// 2. Telemetry and connection status
databaseRoutes.get("/", requireAuth, getDatabaseStatusHandler);

// 3. Automated & manual snapshot backups
databaseRoutes.post("/backups", requireAuth, triggerBackupHandler);
databaseRoutes.get("/backups", requireAuth, listBackupsHandler);
databaseRoutes.post("/backups/:backupId/restore", requireAuth, restoreBackupHandler);

// 4. Deprovision / suspend tenant database
databaseRoutes.delete("/", requireAuth, deprovisionDatabaseHandler);

export default databaseRoutes;
