import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import {
  getTablesHandler,
  getTableDetailsHandler,
  createTableHandler,
  dropTableHandler,
  getTableRowsHandler,
  mutateTableRowHandler,
  getSchemaDiagramHandler,
  executeQueryHandler,
  listMigrationsHandler,
} from "./studio.controller.js";

export const studioRoutes = Router({ mergeParams: true });

// 1. Table schema discovery & DDL mutations
studioRoutes.get("/tables", requireAuth, getTablesHandler);
studioRoutes.get("/tables/:tableName", requireAuth, getTableDetailsHandler);
studioRoutes.post("/tables", requireAuth, createTableHandler);
studioRoutes.delete("/tables/:tableName", requireAuth, dropTableHandler);

// 2. Data Grid row inspection & inline mutations
studioRoutes.get("/tables/:tableName/rows", requireAuth, getTableRowsHandler);
studioRoutes.post("/tables/:tableName/rows", requireAuth, mutateTableRowHandler);

// 3. Visual ER Relationship Diagram
studioRoutes.get("/diagram", requireAuth, getSchemaDiagramHandler);

// 4. Sandboxed Monaco SQL Runner
studioRoutes.post("/query", requireAuth, executeQueryHandler);

// 5. Schema Migration History
studioRoutes.get("/migrations", requireAuth, listMigrationsHandler);

export default studioRoutes;
