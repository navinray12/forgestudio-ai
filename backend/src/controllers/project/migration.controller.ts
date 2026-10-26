/**
 * Project controller: Blueprint Point 43: One Migration Authority & Safe Upgrade Lifecycle.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { AppError } from "../../utils/app-error.js";
import { unifiedMigrationAuthority } from "../../services/migration/unifiedMigrationAuthority.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Blueprint Point 43: One Migration Authority & Safe Upgrade Lifecycle
// ---------------------------------------------------------------------------

export async function executeUnifiedMigrationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    // Plans a migration for one of the project's databases and runs it through the authority:
    // preflight, dual rehearsal, approval and execution. Nothing is defaulted: the database, the
    // statements and the environment must be stated. A production plan stops after the rehearsal
    // (202) and waits for an explicit approval.
    const { databaseId, name, statements, dependsOn, environment } = req.body ?? {};
    if (!databaseId || !name || !Array.isArray(statements)) {
      throw new AppError("databaseId, name and statements are required", 400, "INVALID_MIGRATION");
    }
    const actor = await migrationActor(req, res);
    const plan = await unifiedMigrationAuthority.createPlan({
      databaseId: String(databaseId),
      projectId,
      name: String(name),
      statements,
      dependsOn,
      requestKey: (req.get("Idempotency-Key") || "").trim() || null,
      createdById: user.id,
    });
    const result = await unifiedMigrationAuthority.runGoverned(plan.id, actor, { databaseId: String(databaseId), projectId, environment });
    res.status(result.approvalRequired ? 202 : 200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** The acting user for a migration request; an administrator is the project owner or a platform admin. */
async function migrationActor(req: Request, res: Response): Promise<{ id: string; canAdminister: boolean }> {
  const user = getAuthUser(res, req);
  const project = await getForgeProjectById(String(req.params.id), user);
  const admin = ["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(String(user.role || "").toUpperCase());
  return { id: user.id, canAdminister: admin || project.ownerId === user.id };
}

/** POST /:id/database/:databaseId/migrations/plan — records an immutable migration plan. */
export async function planMigrationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await migrationActor(req, res);
    const { name, statements, downSql, dependsOn } = req.body ?? {};
    const migration = await unifiedMigrationAuthority.createPlan({
      databaseId: String(req.params.databaseId),
      projectId: String(req.params.id),
      name,
      statements,
      downSql,
      dependsOn,
      requestKey: (req.get("Idempotency-Key") || "").trim() || null,
      createdById: actor.id,
    });
    res.status(201).json({ success: true, migration });
  } catch (err) {
    next(err);
  }
}

/** POST /:id/database/:databaseId/migrations/baseline — adopts the schema as found. */
export async function adoptMigrationBaselineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await migrationActor(req, res);
    const migration = await unifiedMigrationAuthority.adoptBaseline(String(req.params.databaseId), actor, { projectId: String(req.params.id) });
    res.status(201).json({ success: true, migration });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /:id/database/:databaseId/migrations/:migrationId/{preflight|rehearse|approve|execute|reconcile|retry|cancel}
 * One step of the migration lifecycle. Every step re-checks that the migration belongs to this
 * project and database.
 */
export function migrationStepHandler(step: "preflight" | "rehearse" | "approve" | "execute" | "reconcile" | "retry" | "cancel") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = await migrationActor(req, res);
      const id = String(req.params.migrationId);
      const scope = { databaseId: String(req.params.databaseId), projectId: String(req.params.id) };
      const authority = unifiedMigrationAuthority;
      const migration =
        step === "preflight" ? await authority.preflight(id, scope)
        : step === "rehearse" ? await authority.rehearse(id, scope)
        : step === "approve" ? await authority.approve(id, actor, { ...scope, acknowledgeDestructive: req.body?.acknowledgeDestructive === true })
        : step === "execute" ? await authority.execute(id, actor, scope)
        : step === "reconcile" ? await authority.reconcile(id, scope)
        : step === "retry" ? await authority.retry(id, scope)
        : await authority.cancel(id, actor, scope);
      res.status(200).json({ success: true, migration });
    } catch (err) {
      next(err);
    }
  };
}
