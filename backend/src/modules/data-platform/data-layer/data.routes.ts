import { Router } from "express";
import {
  getTableDataHandler,
  insertTableDataHandler,
  updateTableDataHandler,
  deleteTableDataHandler,
  enableRealtimeHandler,
  getSdkTypeScriptHandler,
} from "./data.controller.js";

export const dataRoutes = Router();
export const sdkRoutes = Router({ mergeParams: true });

// Realtime trigger enablement
dataRoutes.post("/:projectId/:table/realtime/enable", enableRealtimeHandler);

// PostgREST-style CRUD operations on tenant tables
dataRoutes.get("/:projectId/:table", getTableDataHandler);
dataRoutes.post("/:projectId/:table", insertTableDataHandler);
dataRoutes.patch("/:projectId/:table", updateTableDataHandler);
dataRoutes.delete("/:projectId/:table", deleteTableDataHandler);

// SDK generation directly under /api/v1/data/:projectId/sdk/typescript
dataRoutes.get("/:projectId/sdk/typescript", getSdkTypeScriptHandler);

// Dedicated SDK router for /api/v1/projects/:projectId/sdk/typescript
sdkRoutes.get("/typescript", getSdkTypeScriptHandler);
sdkRoutes.get("/", getSdkTypeScriptHandler);
