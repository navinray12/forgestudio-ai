import type { Request, Response, NextFunction } from "express";
import { TenantPoolManager } from "../common/pool-manager.js";
import {
  compileSelect,
  compileInsert,
  compileUpdate,
  compileDelete,
  validateIdentifier,
} from "./query-compiler.js";
import { assertDataScope, assertPublicTableRls, injectRlsClaims, resolveAuthClaims } from "./rls-claim-injector.js";
import { enableTableRealtime } from "./realtime.service.js";
import { generateProjectTypeScriptSdk } from "./sdk-generator.service.js";
import type { DatabaseEnvironment } from "../../../generated/prisma/client.js";
import { AppError } from "../../../utils/app-error.js";
import { resolveExplicitEnvironment, verifyProjectAccess, assertCanModify } from "../common/project-access.js";

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || "";
  return param || "";
}

/**
 * Fails closed (blueprint §42.4): a missing or unknown environment is rejected. It previously fell
 * back to PRODUCTION, so a request for an unrecognised environment ran against production data.
 */
function resolveEnvironment(req: Request): DatabaseEnvironment {
  return resolveExplicitEnvironment(req);
}

/**
 * GET /api/v1/data/:projectId/:table
 * Auto-generated PostgREST-style SELECT endpoint with RLS injection.
 */
export async function getTableDataHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = getParam(req.params.projectId);
  const table = getParam(req.params.table);
  const environment = resolveEnvironment(req);

  try {
    if (!projectId || !table) {
      throw new AppError("projectId and table parameters are required", 400, "BAD_REQUEST");
    }

    validateIdentifier(table);
    const claims = await resolveAuthClaims(req, projectId, environment);
    assertDataScope(claims, "data:read");
    const compiled = compileSelect(table, req.query);

    const pool = await TenantPoolManager.getTenantPool(projectId, environment);
    const client = await pool.connect();

    try {
      await client.query("BEGIN;");
      await injectRlsClaims(client, claims);
      await assertPublicTableRls(client, table, claims);

      const dataResult = await client.query(compiled.sql, compiled.values);
      const countResult = compiled.countSql
        ? await client.query(compiled.countSql, compiled.values.slice(0, -2))
        : null;

      await client.query("COMMIT;");

      const totalCount = countResult ? parseInt(countResult.rows[0]?.count || "0", 10) : dataResult.rowCount ?? 0;
      const offset = parseInt(String(req.query.offset || "0"), 10) || 0;
      const count = dataResult.rows.length;
      const rangeEnd = count > 0 ? offset + count - 1 : offset;

      res.setHeader("Content-Range", `${offset}-${rangeEnd}/${totalCount}`);
      res.setHeader("X-Total-Count", String(totalCount));

      res.status(200).json({
        success: true,
        data: dataResult.rows,
        count: totalCount,
      });
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/data/:projectId/:table
 * Auto-generated PostgREST-style INSERT endpoint with RLS injection.
 */
export async function insertTableDataHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = getParam(req.params.projectId);
  const table = getParam(req.params.table);
  const environment = resolveEnvironment(req);

  try {
    if (!projectId || !table) {
      throw new AppError("projectId and table parameters are required", 400, "BAD_REQUEST");
    }

    validateIdentifier(table);
    const claims = await resolveAuthClaims(req, projectId, environment);
    assertDataScope(claims, "data:write", environment);
    const compiled = compileInsert(table, req.body);

    const pool = await TenantPoolManager.getTenantPool(projectId, environment);
    const client = await pool.connect();

    try {
      await client.query("BEGIN;");
      await injectRlsClaims(client, claims);
      await assertPublicTableRls(client, table, claims);

      const result = await client.query(compiled.sql, compiled.values);
      await client.query("COMMIT;");

      res.status(201).json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/data/:projectId/:table
 * Auto-generated PostgREST-style UPDATE endpoint with RLS injection.
 */
export async function updateTableDataHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = getParam(req.params.projectId);
  const table = getParam(req.params.table);
  const environment = resolveEnvironment(req);

  try {
    if (!projectId || !table) {
      throw new AppError("projectId and table parameters are required", 400, "BAD_REQUEST");
    }

    validateIdentifier(table);
    const claims = await resolveAuthClaims(req, projectId, environment);
    assertDataScope(claims, "data:write", environment);
    const compiled = compileUpdate(table, req.query, req.body);

    const pool = await TenantPoolManager.getTenantPool(projectId, environment);
    const client = await pool.connect();

    try {
      await client.query("BEGIN;");
      await injectRlsClaims(client, claims);
      await assertPublicTableRls(client, table, claims);

      const result = await client.query(compiled.sql, compiled.values);
      await client.query("COMMIT;");

      res.status(200).json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/data/:projectId/:table
 * Auto-generated PostgREST-style DELETE endpoint with RLS injection.
 */
export async function deleteTableDataHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = getParam(req.params.projectId);
  const table = getParam(req.params.table);
  const environment = resolveEnvironment(req);

  try {
    if (!projectId || !table) {
      throw new AppError("projectId and table parameters are required", 400, "BAD_REQUEST");
    }

    validateIdentifier(table);
    const claims = await resolveAuthClaims(req, projectId, environment);
    assertDataScope(claims, "data:write", environment);
    const compiled = compileDelete(table, req.query);

    const pool = await TenantPoolManager.getTenantPool(projectId, environment);
    const client = await pool.connect();

    try {
      await client.query("BEGIN;");
      await injectRlsClaims(client, claims);
      await assertPublicTableRls(client, table, claims);

      const result = await client.query(compiled.sql, compiled.values);
      await client.query("COMMIT;");

      res.status(200).json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/data/:projectId/:table/realtime/enable
 * Enables PostgreSQL CDC LISTEN/NOTIFY triggers for the table.
 */
export async function enableRealtimeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = getParam(req.params.projectId);
  const table = getParam(req.params.table);
  const environment = resolveEnvironment(req);

  try {
    if (!projectId || !table) {
      throw new AppError("projectId and table parameters are required", 400, "BAD_REQUEST");
    }
    const user = res.locals.user || (req as any).user;
    if (!user?.id) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    const access = await verifyProjectAccess(projectId, user.id);
    assertCanModify(environment, access, "enable realtime triggers");
    await enableTableRealtime(projectId, table, environment);

    res.status(200).json({
      success: true,
      message: `Realtime triggers enabled for table "${table}".`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/projects/:projectId/sdk/typescript
 * Generates and downloads a custom TypeScript client SDK for the project.
 */
export async function getSdkTypeScriptHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = getParam(req.params.projectId);
  const environment = resolveEnvironment(req);

  try {
    if (!projectId) {
      throw new AppError("projectId parameter is required", 400, "BAD_REQUEST");
    }
    const user = res.locals.user || (req as any).user;
    if (!user?.id) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    await verifyProjectAccess(projectId, user.id);
    const code = await generateProjectTypeScriptSdk(projectId, environment);

    res.setHeader("Content-Type", "application/typescript; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="forge-${projectId}-sdk.ts"`
    );
    res.status(200).send(code);
  } catch (error) {
    next(error);
  }
}
