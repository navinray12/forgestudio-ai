/**
 * Project controller: Blueprint Point 39: General-Purpose Application Data-Model & Introspection.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { DataModelGeneratorService } from "../../services/generator/dataModelGenerator.service.js";
import { ExternalDatabaseIntrospectionService } from "../../services/generator/externalDatabaseIntrospection.service.js";
import { getAuthUser } from "./shared.js";

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
