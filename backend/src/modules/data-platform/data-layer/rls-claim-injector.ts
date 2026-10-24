import crypto from "node:crypto";
import type { Request } from "express";
import type pg from "pg";
import { prisma } from "../../../config/prisma.js";
import { authenticateSession } from "../../../services/session-authentication.js";
import { AppError } from "../../../utils/app-error.js";
import type { DatabaseEnvironment } from "../../../generated/prisma/client.js";
import { verifyProjectAccess } from "../common/project-access.js";

export interface RlsClaims {
  sub?: string;
  role?: string;
  email?: string;
  isServiceRole?: boolean;
  [key: string]: any;
}

/**
 * Injects Row-Level Security JWT claims into the active transaction session of a tenant client.
 * Uses PostgreSQL's set_config with is_local=true, guaranteeing isolation to the scoped transaction.
 */
export async function injectRlsClaims(
  client: pg.PoolClient,
  claims: RlsClaims
): Promise<void> {
  // Caller-provided roles are never trusted to bypass tenant RLS.
  const role = claims.isServiceRole ? "service_role" : claims.role === "authenticated" ? "authenticated" : "anon";
  const sub = claims.sub || (claims.isServiceRole ? "service_role" : "anon");
  const email = claims.email || "";
  const jsonClaims = JSON.stringify({
    ...claims,
    role,
    sub,
    email,
  });

  // Execute parameter injection using Postgres set_config (is_local = true)
  await client.query(
    "SELECT set_config('request.jwt.claim.sub', $1, true), " +
    "set_config('request.jwt.claim.role', $2, true), " +
    "set_config('request.jwt.claim.email', $3, true), " +
    "set_config('request.jwt.claims', $4, true);",
    [sub, role, email, jsonClaims]
  );

  // If service role, enable RLS bypass flag
  if (claims.isServiceRole === true) {
    await client.query("SELECT set_config('rls.bypass', 'on', true);");
  }
}

/**
 * Resolve data-plane claims from verifiable credentials only.
 *
 * A project API key must match its SHA-256 hash and project database record.
 * Browser session tokens must pass the existing session authentication service.
 * Unverified JWT payloads and syntactically plausible API keys confer NO access.
 */
export async function resolveAuthClaims(req: Request, projectId: string, environment: DatabaseEnvironment): Promise<RlsClaims> {
  const rawKey = req.headers["apikey"] ?? req.headers["x-api-key"];
  const authorization = req.headers.authorization;

  if (rawKey !== undefined) {
    if (typeof rawKey !== "string" || !/^fg_(?:anon|sec)_[A-Za-z0-9_-]{8,}$/.test(rawKey.trim())) {
      throw new AppError("Invalid project API key", 401, "INVALID_API_KEY");
    }
    const key = rawKey.trim();
    const tokenHash = crypto.createHash("sha256").update(key).digest("hex");
    let dbKey;
    try {
      dbKey = await prisma.projectApiKey.findFirst({
        where: {
          tokenHash,
          database: { websiteId: projectId, environment },
        },
      });
    } catch {
      throw new AppError("Project API key validation is temporarily unavailable", 503, "API_KEY_VALIDATION_UNAVAILABLE");
    }
    if (!dbKey) {
      throw new AppError("Invalid project API key", 401, "INVALID_API_KEY");
    }
    if (dbKey.revokedAt) {
      throw new AppError("Project API key has been revoked", 401, "REVOKED_API_KEY");
    }
    if (dbKey.expiresAt && dbKey.expiresAt <= new Date()) {
      throw new AppError("Project API key has expired", 401, "EXPIRED_API_KEY");
    }

    // Credential privilege comes from the stored record, not the prefix alone.
    const isServiceRole = dbKey.keyType === "SERVICE_ROLE";
    if ((isServiceRole && !key.startsWith("fg_sec_")) ||
        (!isServiceRole && (dbKey.keyType !== "ANON" || !key.startsWith("fg_anon_")))) {
      throw new AppError("Project API key type does not match credential", 401, "INVALID_API_KEY");
    }

    void prisma.projectApiKey.update({
      where: { id: dbKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => undefined);

    return {
      sub: isServiceRole ? "service_role" : "anon",
      role: isServiceRole ? "service_role" : "anon",
      isServiceRole,
      apiKeyId: dbKey.id,
      scopes: dbKey.scopes,
    };
  }

  if (authorization !== undefined) {
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
      throw new AppError("Invalid authorization header", 401, "INVALID_AUTHORIZATION");
    }
    const token = authorization.slice(7).trim();
    if (!token) throw new AppError("Bearer token is required", 401, "INVALID_AUTHORIZATION");
    const session = await authenticateSession(token).catch(() => null);
    if (!session?.user?.id) {
      throw new AppError("Invalid or expired session", 401, "INVALID_SESSION");
    }
    // A valid platform session is NOT permission to access every tenant database.
    await verifyProjectAccess(projectId, session.user.id);
    return {
      sub: session.user.id,
      role: "authenticated",
      email: session.user.email || "",
      isServiceRole: false,
    };
  }

  // Browser callers must use a registered project API key or an authenticated
  // and authorized session. A missing credential must never reach owner-scoped SQL.
  throw new AppError("A verified project API key or session is required", 401, "PROJECT_AUTH_REQUIRED");
}

/** Enforce stored key scopes independently of the SQL execution path. */
export function assertDataScope(claims: RlsClaims, operation: "data:read" | "data:write"): void {
  if (claims.apiKeyId && (!Array.isArray(claims.scopes) || !claims.scopes.includes(operation))) {
    throw new AppError("API key does not permit this data operation", 403, "API_KEY_SCOPE_FORBIDDEN");
  }
}

/**
 * Tenant table owner roles can bypass ordinary RLS unless FORCE is enabled.
 * Public API keys never get table access until PostgreSQL itself guarantees
 * that a configured row-level policy applies to the owner connection.
 */
export async function assertPublicTableRls(client: pg.PoolClient, table: string, claims: RlsClaims): Promise<void> {
  if (claims.role !== "anon" || claims.isServiceRole) return;
  const result = await client.query<{
    enabled: boolean;
    forced: boolean;
  }>(
    `SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind IN ('r', 'p')`,
    [table]
  );
  const policy = result.rows[0];
  if (!policy?.enabled || !policy?.forced) {
    throw new AppError("Public data access requires enforced row-level security on the table", 403, "PUBLIC_RLS_REQUIRED");
  }
}
