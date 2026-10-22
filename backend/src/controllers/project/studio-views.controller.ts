/**
 * Project controller: Blueprint Point 41: One Consistent Database Schema Studio Views.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { databaseStudioViews } from "../../services/database/databaseStudioViews.service.js";
import { getAuthUser } from "./shared.js";

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
