/**
 * ForgeStudio Blueprint Point 43 — One Migration Authority and Safe Upgrade Lifecycle (WP-21)
 *
 * The single path by which DDL reaches a customer database schema (forge_databases).
 *
 * - State is durable: a migration is one row of forge_database_migrations holding its immutable
 *   plan (ordered statements with checksums, target identity, budgets) and its lifecycle record
 *   (preflight, rehearsals, approval, per-phase progress, database evidence). Nothing is kept in
 *   process memory, and nothing is reported that was not read back from PostgreSQL.
 * - Lifecycle: PENDING (planned) → PREFLIGHT_PASSED → REHEARSED → APPROVED → APPLYING →
 *   VALIDATING → APPLIED, or CANCELLED / FAILED / PARTIALLY_APPLIED / UNCERTAIN /
 *   RECOVERY_REQUIRED. Every transition is a compare-and-set on the row.
 * - Fencing: a partial unique index allows one APPLYING/VALIDATING migration per database across
 *   all instances, and the executing session holds a PostgreSQL advisory lock on the database.
 * - Namespace ownership: plans may only target a forge_cust_* schema and run with that schema as
 *   the whole search_path, so an unqualified name can never resolve to a control-plane table.
 * - A migration is APPLIED only when the target's own _forge_migrations table holds its name and
 *   checksum. Production is never executed automatically, and a destructive production plan
 *   needs an explicit acknowledgement from a project administrator.
 */

import crypto from "node:crypto";
import type pg from "pg";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit.service.js";
import { environmentBindingService, type EnvironmentClass } from "../environment/environmentBinding.service.js";

export type MigrationState =
  | "PENDING"
  | "PREFLIGHT_PASSED"
  | "REHEARSED"
  | "APPROVED"
  | "APPLYING"
  | "VALIDATING"
  | "APPLIED"
  | "CANCELLED"
  | "FAILED"
  | "PARTIALLY_APPLIED"
  | "UNCERTAIN"
  | "RECOVERY_REQUIRED"
  | "ROLLED_BACK";

export interface StatementHazard {
  type: "DUPLICATE_CHECK" | "NOT_NULL_BACKFILL" | "RENAME_PRESERVATION" | "OPAQUE_BLOCK";
  table?: string;
  columns?: string[];
  mode?: "SET" | "ADD_NO_DEFAULT";
}

export interface PlannedStatement {
  seq: number;
  sql: string;
  checksum: string;
  /** False for statements PostgreSQL refuses inside a transaction (CREATE INDEX CONCURRENTLY …). */
  transactional: boolean;
  destructive: boolean;
  hazards: StatementHazard[];
}

export interface MigrationPlan {
  authority: "FORGE_MANAGED";
  statements: PlannedStatement[];
  migrationSetHash: string;
  destructive: boolean;
  dependsOn: string[];
  budget: { lockTimeoutMs: number; statementTimeoutMs: number; totalMs: number; maxRowsForBlockingDdl: number };
  /** Set on a plan that undoes or repairs another migration. */
  reverts?: string;
  fixes?: string;
  /** A record of the schema as found, adopted as the starting point; it carries no SQL. */
  baseline?: boolean;
}

export interface MigrationView {
  id: string;
  databaseId: string;
  projectId: string;
  name: string;
  upSql: string;
  downSql: string | null;
  checksum: string;
  status: MigrationState;
  executionTimeMs: number;
  errorMessage: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan: MigrationPlan | null;
  lifecycle: Record<string, any>;
}

export interface Actor {
  id: string;
  /** Project owner or platform administrator. */
  canAdminister?: boolean;
}

interface Target {
  migration: any;
  database: { id: string; projectId: string; environment: EnvironmentClass; schemaName: string };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENT = `"?([A-Za-z_][\\w$]*)"?`;
const DEFAULT_BUDGET = { lockTimeoutMs: 5000, statementTimeoutMs: 30_000, totalMs: 300_000, maxRowsForBlockingDdl: 1_000_000 };
const APPROVAL_TTL_MS = 60 * 60 * 1000;
const FULL_COPY_ROWS = 10_000;
const IN_DOUBT: MigrationState[] = ["APPLYING", "VALIDATING", "UNCERTAIN"];

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const quote = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

export function normalizeEnvironment(value: unknown): EnvironmentClass {
  const upper = String(value ?? "").trim().toUpperCase();
  if (upper === "PREVIEW") return "STAGING"; // legacy label of the same class
  if (upper === "DEVELOPMENT" || upper === "STAGING" || upper === "PRODUCTION") return upper;
  throw new AppError("An explicit environment is required (DEVELOPMENT, STAGING or PRODUCTION)", 400, "ENVIRONMENT_REQUIRED");
}

/** A legacy status value read as the lifecycle state it means. */
function stateOf(status: string): MigrationState {
  return status === "RECONCILIATION_REQUIRED" ? "UNCERTAIN" : (status as MigrationState);
}

// ---------------------------------------------------------------------------
// Statement analysis
// ---------------------------------------------------------------------------

/**
 * SQL with comments removed and the contents of string literals and dollar-quoted bodies blanked
 * out, for keyword analysis. A single left-to-right scan, so a "--" or ";" inside a literal is
 * never mistaken for syntax.
 */
function skeleton(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "'") {
      i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue; }
        if (sql[i] === "'") break;
        i++;
      }
      i++;
      out += "''";
    } else if (ch === '"') {
      const end = sql.indexOf('"', i + 1);
      const stop = end === -1 ? sql.length : end + 1;
      out += sql.slice(i, stop);
      i = stop;
    } else if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      out += " ";
    } else if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      out += " ";
    } else if (ch === "$") {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (!tag) { out += ch; i++; continue; }
      const end = sql.indexOf(tag[0], i + tag[0].length);
      i = end === -1 ? sql.length : end + tag[0].length;
      out += " $$ ";
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

const FORBIDDEN_LEADING = /^(SET|RESET|GRANT|REVOKE|COPY|LISTEN|NOTIFY|UNLISTEN|LOAD|DISCARD|BEGIN|COMMIT|ROLLBACK|START|SAVEPOINT|RELEASE|PREPARE|EXECUTE|DEALLOCATE|CALL|VACUUM|ANALYZE|CLUSTER|LOCK|SELECT|WITH|SHOW|EXPLAIN|REASSIGN|SECURITY|IMPORT)\b/i;
const ALLOWED_LEADING = /^(CREATE|ALTER|DROP|COMMENT|INSERT|UPDATE|DELETE|TRUNCATE|DO|REINDEX)\b/i;
const FORBIDDEN_OBJECTS = /^(CREATE|ALTER|DROP)\s+(OR\s+REPLACE\s+)?(ROLE|USER|GROUP|DATABASE|TABLESPACE|EXTENSION|SCHEMA|SERVER|FOREIGN|PUBLICATION|SUBSCRIPTION|EVENT\s+TRIGGER|LANGUAGE|POLICY|SYSTEM)\b/i;

/** Classifies one statement, or throws when it may not be part of a plan for `schemaName`. */
export function analyzeStatement(sql: string, seq: number, schemaName: string): PlannedStatement {
  const trimmed = String(sql ?? "").trim().replace(/;\s*$/, "");
  const invalid = (reason: string) => new AppError(`Statement ${seq}: ${reason}`, 422, "UNSUPPORTED_MIGRATION_STATEMENT");
  if (!trimmed) throw invalid("is empty.");
  if (trimmed.length > 100_000) throw invalid("is too long.");
  const bare = skeleton(trimmed).trim();
  if (bare.includes(";")) throw invalid("contains more than one SQL statement; list each statement separately.");
  if (FORBIDDEN_LEADING.test(bare) || !ALLOWED_LEADING.test(bare)) {
    throw invalid("is not a schema or data change that a migration plan may run (session, transaction, privilege and query statements are not allowed).");
  }
  if (FORBIDDEN_OBJECTS.test(bare)) throw invalid("changes roles, databases, schemas, extensions or policies, which this authority does not own.");
  if (/\bsearch_path\b/i.test(bare)) throw invalid("changes the search path.");
  // Another schema may only be named if it is this plan's own schema.
  for (const match of bare.matchAll(/(?:^|[^\w."])"?([A-Za-z_][\w$]*)"?\s*\.\s*"?[A-Za-z_][\w$]*"?\s*(?=[\s(,;)]|$)/g)) {
    const qualifier = match[1].toLowerCase();
    if (qualifier === schemaName.toLowerCase()) continue;
    if (/^(public|pg_catalog|information_schema|pg_toast)$/.test(qualifier) || qualifier.startsWith("forge_") || qualifier.startsWith("pg_")) {
      throw invalid(`refers to schema '${match[1]}', which is outside this database's namespace.`);
    }
  }

  const hazards: StatementHazard[] = [];
  const columnsOf = (list: string) => list.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const simple = (list: string) => list.split(",").every((c) => /^\s*"?[A-Za-z_][\w$]*"?\s*$/.test(c));

  const uniqueIndex = new RegExp(`^CREATE\\s+UNIQUE\\s+INDEX\\s+(?:CONCURRENTLY\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?${IDENT}\\s+ON\\s+(?:ONLY\\s+)?(?:${IDENT}\\s*\\.\\s*)?${IDENT}\\s*(?:USING\\s+\\w+\\s*)?\\(([^)]*)\\)`, "i").exec(bare);
  const uniqueConstraint = new RegExp(`^ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?(?:${IDENT}\\s*\\.\\s*)?${IDENT}\\s+ADD\\s+(?:CONSTRAINT\\s+${IDENT}\\s+)?(?:UNIQUE|PRIMARY\\s+KEY)\\s*\\(([^)]*)\\)`, "i").exec(bare);
  if (uniqueIndex) hazards.push({ type: "DUPLICATE_CHECK", table: uniqueIndex[3], columns: simple(uniqueIndex[4]) ? columnsOf(uniqueIndex[4]) : undefined });
  else if (uniqueConstraint) hazards.push({ type: "DUPLICATE_CHECK", table: uniqueConstraint[2], columns: simple(uniqueConstraint[4]) ? columnsOf(uniqueConstraint[4]) : undefined });

  const setNotNull = new RegExp(`^ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?(?:${IDENT}\\s*\\.\\s*)?${IDENT}\\s+ALTER\\s+(?:COLUMN\\s+)?${IDENT}\\s+SET\\s+NOT\\s+NULL`, "i").exec(bare);
  const addNotNull = new RegExp(`^ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?(?:${IDENT}\\s*\\.\\s*)?${IDENT}\\s+ADD\\s+(?:COLUMN\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?${IDENT}\\b([^,]*)`, "i").exec(bare);
  if (setNotNull) hazards.push({ type: "NOT_NULL_BACKFILL", table: setNotNull[2], columns: [setNotNull[3]], mode: "SET" });
  else if (addNotNull && /\bNOT\s+NULL\b/i.test(addNotNull[4]) && !/\b(DEFAULT|GENERATED)\b/i.test(addNotNull[4])) {
    hazards.push({ type: "NOT_NULL_BACKFILL", table: addNotNull[2], columns: [addNotNull[3]], mode: "ADD_NO_DEFAULT" });
  }
  if (/\bRENAME\b/i.test(bare)) hazards.push({ type: "RENAME_PRESERVATION" });
  if (/^DO\b/i.test(bare)) hazards.push({ type: "OPAQUE_BLOCK" });

  const destructive =
    /\bDROP\s+(TABLE|COLUMN|VIEW|MATERIALIZED|TYPE|SEQUENCE|FUNCTION|PROCEDURE|TRIGGER|CONSTRAINT|INDEX|DOMAIN|NOT\s+NULL|DEFAULT)\b/i.test(bare) ||
    /^(TRUNCATE|DELETE|DO)\b/i.test(bare) ||
    /\bALTER\s+(COLUMN\s+)?"?[\w$]+"?\s+(SET\s+DATA\s+)?TYPE\b/i.test(bare) ||
    /\bCASCADE\b/i.test(bare);

  return {
    seq,
    sql: trimmed,
    checksum: sha256(trimmed),
    transactional: !(/\bINDEX\s+CONCURRENTLY\b/i.test(bare) || /^REINDEX\b[\s\S]*\bCONCURRENTLY\b/i.test(bare)),
    destructive,
    hazards,
  };
}

const setHash = (statements: PlannedStatement[]) => sha256(statements.map((s) => s.checksum).join(":"));
const sqlOf = (statements: PlannedStatement[]) => statements.map((s) => `${s.sql};`).join("\n");

// ---------------------------------------------------------------------------
// Target database access
// ---------------------------------------------------------------------------

/**
 * A dedicated session on the target schema. The search path is the schema alone, and the session
 * is discarded afterwards rather than returned to the pool with altered settings.
 */
async function withSchema<T>(schemaName: string, budget: MigrationPlan["budget"], fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool.connect();
  let broken = false;
  const onError = () => { broken = true; };
  client.on("error", onError);
  try {
    await client.query(`SET search_path = ${quote(schemaName)}`);
    await client.query(`SET lock_timeout = ${Math.floor(budget.lockTimeoutMs)}`);
    await client.query(`SET statement_timeout = ${Math.floor(budget.statementTimeoutMs)}`);
    return await fn(client);
  } catch (err) {
    broken = true;
    throw err;
  } finally {
    client.removeListener("error", onError);
    client.release(broken ? true : new Error("migration session is not reused"));
  }
}

/** A stable fingerprint of a schema's structure (tables, columns, constraints, indexes). */
async function catalogFingerprint(client: pg.PoolClient | pg.Pool, schemaName: string): Promise<string> {
  const columns = await client.query(
    `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length, numeric_precision
       FROM information_schema.columns WHERE table_schema = $1 AND table_name <> '_forge_migrations'
      ORDER BY table_name, ordinal_position`,
    [schemaName]
  );
  const constraints = await client.query(
    `SELECT c.relname AS table_name, k.conname, k.contype,
            replace(replace(pg_get_constraintdef(k.oid), $2, ''), $3, '') AS definition
       FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname <> '_forge_migrations' ORDER BY 1, 2`,
    [schemaName, `${schemaName}.`, `${quote(schemaName)}.`]
  );
  const indexes = await client.query(
    `SELECT tablename, indexname, replace(replace(indexdef, $2, ''), $3, '') AS definition, i.indisvalid
       FROM pg_indexes x JOIN pg_class c ON c.relname = x.indexname JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = x.schemaname
       JOIN pg_index i ON i.indexrelid = c.oid
      WHERE x.schemaname = $1 AND x.tablename <> '_forge_migrations' ORDER BY 1, 2`,
    [schemaName, `${schemaName}.`, `${quote(schemaName)}.`]
  );
  return sha256(JSON.stringify([columns.rows, constraints.rows, indexes.rows]));
}

async function evidenceRow(client: pg.PoolClient | pg.Pool, schemaName: string, name: string) {
  const { rows } = await client.query(
    `SELECT name, checksum, applied_at FROM ${quote(schemaName)}._forge_migrations WHERE name = $1`,
    [name]
  );
  return rows[0] as { name: string; checksum: string; applied_at: Date } | undefined;
}

const lockKey = (databaseId: string) => crypto.createHash("sha256").update(`forge-migration:${databaseId}`).digest().readInt32BE(0);

// ---------------------------------------------------------------------------
// Control-plane record access
// ---------------------------------------------------------------------------

function toView(row: any): MigrationView {
  return {
    id: row.id,
    databaseId: row.databaseId,
    projectId: row.projectId,
    name: row.name,
    upSql: row.upSql,
    downSql: row.downSql ?? null,
    checksum: row.checksum,
    status: stateOf(row.status),
    executionTimeMs: row.executionTimeMs ?? 0,
    errorMessage: row.errorMessage ?? null,
    appliedAt: row.appliedAt ? new Date(row.appliedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt ?? row.createdAt).toISOString(),
    plan: row.plan ?? null,
    lifecycle: row.lifecycle ?? {},
  };
}

/** The plan of a row; a row created before plans existed is read as a single-statement plan. */
function planOf(row: any, schemaName: string): MigrationPlan {
  if (row.plan) return row.plan as MigrationPlan;
  const legacy: PlannedStatement = {
    seq: 1,
    sql: String(row.upSql).trim(),
    checksum: sha256(String(row.upSql).trim()),
    transactional: !/\bINDEX\s+CONCURRENTLY\b/i.test(row.upSql),
    destructive: true, // unanalysed multi-statement SQL is treated as the riskiest kind
    hazards: [{ type: "OPAQUE_BLOCK" }],
  };
  void schemaName;
  return { authority: "FORGE_MANAGED", statements: [legacy], migrationSetHash: setHash([legacy]), destructive: true, dependsOn: [], budget: DEFAULT_BUDGET };
}

/** Moves a row from one of `from` to `to`, merging `lifecycle`. Returns null when it was not in `from`. */
async function transition(
  id: string,
  from: MigrationState[],
  to: MigrationState,
  patch: { lifecycle?: Record<string, unknown>; errorMessage?: string | null; applied?: { at: Date; ms: number }; lease?: { token: string; ms: number } | null; extraWhere?: string } = {}
): Promise<any | null> {
  const legacy = from.includes("UNCERTAIN") ? [...from, "RECONCILIATION_REQUIRED"] : from;
  const { rows } = await pgPool.query(
    `UPDATE forge_database_migrations
        SET status = $2,
            lifecycle = COALESCE(lifecycle, '{}'::jsonb) || $4::jsonb,
            "errorMessage" = CASE WHEN $5::boolean THEN $6 ELSE "errorMessage" END,
            "appliedAt" = COALESCE($7::timestamptz, "appliedAt"),
            "executionTimeMs" = COALESCE($8::int, "executionTimeMs"),
            "leaseToken" = CASE WHEN $9::boolean THEN $10 ELSE "leaseToken" END,
            "leaseExpiresAt" = CASE WHEN $9::boolean THEN now() + ($11 || ' milliseconds')::interval ELSE "leaseExpiresAt" END,
            "updatedAt" = now()
      WHERE id = $1::uuid AND status = ANY($3::text[]) ${patch.extraWhere ?? ""}
      RETURNING *`,
    [
      id, to, legacy, JSON.stringify(patch.lifecycle ?? {}),
      patch.errorMessage !== undefined, patch.errorMessage ?? null,
      patch.applied?.at ?? null, patch.applied?.ms ?? null,
      patch.lease !== undefined, patch.lease?.token ?? null, String(patch.lease?.ms ?? 0),
    ]
  );
  return rows[0] ?? null;
}

async function mergeLifecycle(id: string, patch: Record<string, unknown>): Promise<void> {
  await pgPool.query(
    `UPDATE forge_database_migrations SET lifecycle = COALESCE(lifecycle, '{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE id = $1::uuid`,
    [id, JSON.stringify(patch)]
  );
}

export class UnifiedMigrationAuthorityService {
  /** Loads a migration and its database, refusing anything that does not belong together. */
  private async target(migrationId: string, expected: { databaseId?: string; projectId?: string; environment?: unknown } = {}, verify = true): Promise<Target> {
    if (!UUID.test(String(migrationId))) throw new AppError("Migration not found", 404, "MIGRATION_NOT_FOUND");
    const { rows: [migration] } = await pgPool.query(`SELECT * FROM forge_database_migrations WHERE id = $1::uuid`, [migrationId]);
    if (!migration) throw new AppError("Migration not found", 404, "MIGRATION_NOT_FOUND");
    if (expected.databaseId !== undefined && migration.databaseId !== expected.databaseId) {
      // A migration ID from another database or project is never run against this target.
      throw new AppError("Migration does not belong to the target database", 403, "MIGRATION_TARGET_MISMATCH");
    }
    const database = await this.databaseRow(migration.databaseId);
    if (expected.projectId !== undefined && database.projectId !== expected.projectId) {
      throw new AppError("Migration database target does not match requested project", 403, "PROJECT_MISMATCH");
    }
    if (migration.projectId !== database.projectId) {
      throw new AppError("Migration and database belong to different projects", 403, "PROJECT_MISMATCH");
    }
    if (expected.environment !== undefined && normalizeEnvironment(expected.environment) !== database.environment) {
      throw new AppError(
        `Migration database target environment mismatch: target is '${database.environment}', requested '${normalizeEnvironment(expected.environment)}'`,
        403,
        "ENVIRONMENT_MISMATCH"
      );
    }
    // Identity first, then integrity, then the namespace rule: a request aimed at the wrong
    // target, or carrying altered SQL, is refused for that reason before anything else is read.
    if (verify && sha256(String(migration.upSql).trim()) !== migration.checksum) {
      throw new AppError(
        `Migration checksum mismatch: the SQL of '${migration.name}' was modified after its checksum was recorded.`,
        422,
        "MIGRATION_CHECKSUM_MISMATCH"
      );
    }
    await this.assertManaged(database.schemaName);
    return { migration, database };
  }

  private async databaseRow(databaseId: string): Promise<Target["database"]> {
    if (!UUID.test(String(databaseId))) throw new AppError("Invalid database identifier", 400, "INVALID_DATABASE_ID");
    const { rows: [row] } = await pgPool.query(`SELECT id, "projectId", environment, "schemaName" FROM forge_databases WHERE id = $1::uuid`, [databaseId]);
    if (!row) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");
    return { id: row.id, projectId: row.projectId, environment: normalizeEnvironment(row.environment), schemaName: String(row.schemaName ?? "") };
  }

  /** The only namespace this authority owns: one customer schema per database. Never the control plane. */
  private async assertManaged(schemaName: string): Promise<void> {
    if (!/^forge_cust_[A-Za-z0-9_]+$/.test(schemaName)) {
      throw new AppError(`Schema '${schemaName}' is not a managed customer namespace`, 409, "NAMESPACE_NOT_MANAGED");
    }
    const { rows: shared } = await pgPool.query(`SELECT count(*)::int AS n FROM forge_databases WHERE "schemaName" = $1`, [schemaName]);
    if (shared[0].n !== 1) throw new AppError(`Schema '${schemaName}' is registered for more than one database`, 409, "NAMESPACE_SHARED");
  }

  private async database(databaseId: string): Promise<Target["database"]> {
    const database = await this.databaseRow(databaseId);
    await this.assertManaged(database.schemaName);
    return database;
  }

  // -------------------------------------------------------------------------
  // 1. Plan
  // -------------------------------------------------------------------------

  /** Records an immutable plan. A repeated `requestKey` returns the plan it already created. */
  public async createPlan(input: {
    databaseId: string;
    projectId: string;
    name: string;
    statements: string[];
    downSql?: string | null;
    dependsOn?: string[];
    requestKey?: string | null;
    createdById?: string | null;
    reverts?: string;
    fixes?: string;
  }): Promise<MigrationView> {
    const database = await this.database(input.databaseId);
    if (database.projectId !== input.projectId) throw new AppError("Database does not belong to the project", 403, "PROJECT_MISMATCH");
    const name = String(input.name ?? "").trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$/.test(name)) {
      throw new AppError("Migration name must be 1-200 letters, digits, '_', '.' or '-'", 400, "INVALID_MIGRATION");
    }
    if (!Array.isArray(input.statements) || input.statements.length === 0 || input.statements.length > 200) {
      throw new AppError("A plan needs between 1 and 200 statements", 400, "INVALID_MIGRATION");
    }
    const requestKey = input.requestKey ? String(input.requestKey).slice(0, 128) : null;
    const dependsOn = [...new Set(input.dependsOn ?? [])];
    if (dependsOn.some((id) => !UUID.test(id))) throw new AppError("dependsOn must list migration IDs", 400, "INVALID_MIGRATION");

    const statements = input.statements.map((sql, i) => analyzeStatement(sql, i + 1, database.schemaName));
    const plan: MigrationPlan = {
      authority: "FORGE_MANAGED",
      statements,
      migrationSetHash: setHash(statements),
      destructive: statements.some((s) => s.destructive),
      dependsOn,
      budget: DEFAULT_BUDGET,
      ...(input.reverts ? { reverts: input.reverts } : {}),
      ...(input.fixes ? { fixes: input.fixes } : {}),
    };
    const upSql = sqlOf(statements);

    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      // Serialises plan creation per database so name and request-key checks cannot race.
      await client.query(`SELECT pg_advisory_xact_lock($1)`, [lockKey(`plan:${database.id}`)]);
      if (requestKey) {
        const { rows } = await client.query(`SELECT * FROM forge_database_migrations WHERE "databaseId" = $1::uuid AND "requestKey" = $2`, [database.id, requestKey]);
        if (rows[0]) {
          await client.query("COMMIT");
          if (rows[0].checksum !== sha256(upSql.trim()) || rows[0].name !== name) {
            throw new AppError("This request key was already used for a different plan", 409, "REQUEST_KEY_REUSED");
          }
          return toView(rows[0]);
        }
      }
      const { rows: named } = await client.query(
        `SELECT 1 FROM forge_database_migrations WHERE "databaseId" = $1::uuid AND name = $2 AND status NOT IN ('CANCELLED')`,
        [database.id, name]
      );
      if (named[0]) throw new AppError(`A migration named '${name}' already exists for this database`, 409, "MIGRATION_NAME_TAKEN");
      if (dependsOn.length) {
        const { rows } = await client.query(`SELECT id FROM forge_database_migrations WHERE "databaseId" = $1::uuid AND id = ANY($2::uuid[])`, [database.id, dependsOn]);
        if (rows.length !== dependsOn.length) throw new AppError("A dependency does not belong to this database", 422, "UNKNOWN_DEPENDENCY");
      }
      const { rows: [row] } = await client.query(
        `INSERT INTO forge_database_migrations ("databaseId", "projectId", name, "upSql", "downSql", checksum, status, plan, lifecycle, "requestKey", "createdById")
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, 'PENDING', $7::jsonb, $8::jsonb, $9, $10)
         RETURNING *`,
        [database.id, database.projectId, name, upSql, input.downSql ?? null, sha256(upSql.trim()), JSON.stringify(plan),
          JSON.stringify({ target: { environment: database.environment, schemaName: database.schemaName }, attempt: 1 }), requestKey, input.createdById ?? null]
      );
      await client.query("COMMIT");
      return toView(row);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  // -------------------------------------------------------------------------
  // 2. Preflight
  // -------------------------------------------------------------------------

  /**
   * Everything that must hold before DDL may be considered: target identity, environment binding,
   * privileges, plan integrity, history drift, dependencies, data hazards and budgets. Read-only
   * on the target. Returns the failures; an empty list means it passed.
   */
  private async inspect(target: Target, plan: MigrationPlan): Promise<{ failures: Array<{ code: string; message: string }>; evidence: Record<string, unknown> }> {
    const { migration, database } = target;
    const failures: Array<{ code: string; message: string }> = [];
    const fail = (code: string, message: string) => failures.push({ code, message });
    const evidence: Record<string, unknown> = { checkedAt: new Date().toISOString(), environment: database.environment, schemaName: database.schemaName };

    // Plan integrity: the SQL that will run is the SQL that was planned.
    if (sha256(String(migration.upSql).trim()) !== migration.checksum) {
      fail("MIGRATION_CHECKSUM_MISMATCH", "The migration SQL was changed after its checksum was recorded.");
    }
    if (migration.plan && (setHash(plan.statements) !== plan.migrationSetHash || plan.statements.some((s) => sha256(s.sql) !== s.checksum) || sqlOf(plan.statements) !== migration.upSql)) {
      fail("MIGRATION_CHECKSUM_MISMATCH", "The plan's statements no longer match their recorded checksums.");
    }

    // Environment binding (Phase 1 persistence): the plan is pinned to the binding version it saw.
    let binding: { bindingId: string; version: number; targetFingerprint: string; protectionLevel: string } | null = null;
    try {
      const found = await environmentBindingService.getBinding(database.projectId, database.environment);
      binding = { bindingId: found.bindingId, version: found.version, targetFingerprint: found.targetFingerprint, protectionLevel: found.protectionLevel };
    } catch (err: any) {
      if (err?.code !== "BINDING_NOT_FOUND") throw err;
    }
    evidence.binding = binding;
    if (database.environment === "PRODUCTION") {
      if (!binding) fail("BINDING_REQUIRED", "A production migration needs an active environment binding for the project.");
      else if (binding.protectionLevel !== "RESTRICTED_PRODUCTION") fail("BINDING_NOT_PRODUCTION", "The production binding is not at the RESTRICTED_PRODUCTION protection level.");
    }
    const pinned = migration.lifecycle?.preflight?.binding ?? null;
    const sameBinding = (a: typeof binding, b: typeof binding) =>
      a === b || (!!a && !!b && a.bindingId === b.bindingId && a.version === b.version && a.targetFingerprint === b.targetFingerprint && a.protectionLevel === b.protectionLevel);
    if (pinned && migration.status !== "PENDING" && !sameBinding(pinned, binding)) {
      fail("TARGET_BINDING_CHANGED", "The environment binding changed after this plan was checked.");
    }

    // Other migrations of this database.
    const { rows: siblings } = await pgPool.query(
      `SELECT id, name, status, checksum, plan, lifecycle, "appliedAt" FROM forge_database_migrations WHERE "databaseId" = $1::uuid AND id <> $2::uuid ORDER BY "createdAt"`,
      [database.id, migration.id]
    );
    const blocked = siblings.filter((s: any) => ["APPLYING", "VALIDATING", "UNCERTAIN", "RECONCILIATION_REQUIRED", "PARTIALLY_APPLIED", "RECOVERY_REQUIRED"].includes(s.status));
    if (blocked.length) {
      fail("UNRESOLVED_MIGRATION", `Another migration of this database must be resolved first: ${blocked.map((s: any) => `${s.name} (${s.status})`).join(", ")}.`);
    }
    for (const id of plan.dependsOn) {
      const dependency = siblings.find((s: any) => s.id === id);
      if (!dependency || dependency.status !== "APPLIED") fail("DEPENDENCY_NOT_APPLIED", `Dependency ${dependency?.name ?? id} is not applied.`);
    }

    await withSchema(database.schemaName, plan.budget, async (client) => {
      // Physical identity and privileges.
      const { rows: [where] } = await client.query(
        `SELECT current_database() AS database, current_user AS role,
                (SELECT oid FROM pg_namespace WHERE nspname = $1) AS schema_oid,
                has_schema_privilege(current_user, $1, 'CREATE') AS can_create,
                has_schema_privilege(current_user, $1, 'USAGE') AS can_use,
                to_regclass($2) IS NOT NULL AS has_ledger`,
        [database.schemaName, `${quote(database.schemaName)}._forge_migrations`]
      ).catch(() => ({ rows: [{ schema_oid: null }] as any[] }));
      evidence.server = { database: where.database, role: where.role, schemaOid: where.schema_oid ? String(where.schema_oid) : null };
      if (!where.schema_oid) return fail("TARGET_SCHEMA_MISSING", `Schema '${database.schemaName}' does not exist in the connected database.`);
      if (!where.has_ledger) return fail("TARGET_NOT_INITIALISED", "The target schema has no _forge_migrations ledger.");
      if (!where.can_create || !where.can_use) fail("INSUFFICIENT_PRIVILEGE", "The migration role cannot create objects in the target schema.");

      // History drift, both ways: what the control plane says is applied, and what the target says.
      const { rows: ledger } = await client.query(`SELECT name, checksum FROM _forge_migrations`);
      const recorded = new Map<string, string>(ledger.map((r: any) => [r.name, r.checksum]));
      const applied = siblings.filter((s: any) => s.status === "APPLIED");
      for (const s of applied) {
        if (recorded.get(s.name) !== s.checksum) fail("MIGRATION_HISTORY_DRIFT", `Applied migration '${s.name}' is ${recorded.has(s.name) ? "recorded with a different checksum" : "missing"} in the target.`);
      }
      const known = new Set(siblings.map((s: any) => s.name));
      for (const name of recorded.keys()) {
        if (name === migration.name) fail("ALREADY_IN_TARGET", `The target already records a migration named '${name}'; reconcile it instead of running it again.`);
        else if (!known.has(name)) fail("MIGRATION_HISTORY_DRIFT", `The target records migration '${name}', which the control plane does not know.`);
      }

      // Schema drift: the structure must be what the last recorded evidence left behind.
      const fingerprint = await catalogFingerprint(client, database.schemaName);
      evidence.catalogHash = fingerprint;
      const last = [...applied].sort((a: any, b: any) => +new Date(b.appliedAt ?? 0) - +new Date(a.appliedAt ?? 0))[0];
      const expected = last?.lifecycle?.evidence?.catalogHash;
      if (expected && expected !== fingerprint) {
        fail("SCHEMA_DRIFT", `The schema was changed outside the migration authority since '${last.name}' was applied. Adopt the current schema as a baseline or revert the change.`);
      }
      const { rows: tables } = await client.query(
        `SELECT c.relname AS name, GREATEST(c.reltuples, 0)::bigint AS estimate FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relkind = 'r' AND c.relname <> '_forge_migrations'`,
        [database.schemaName]
      );
      const existing = new Map<string, number>(tables.map((t: any) => [t.name, Number(t.estimate)]));
      if (!expected && existing.size > 0 && applied.length === 0) evidence.unmanagedTables = [...existing.keys()].sort();

      // Data hazards and budgets, statement by statement.
      const hazardEvidence: unknown[] = [];
      for (const statement of plan.statements) {
        const bare = skeleton(statement.sql).trim();
        const altered = new RegExp(`^ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?(?:${IDENT}\\s*\\.\\s*)?${IDENT}`, "i").exec(bare);
        if (altered && statement.transactional && (existing.get(altered[2]) ?? 0) > plan.budget.maxRowsForBlockingDdl) {
          fail("BUDGET_EXCEEDED", `Statement ${statement.seq} alters '${altered[2]}' (~${existing.get(altered[2])} rows) under a blocking lock; it needs a phased migration.`);
        }
        for (const hazard of statement.hazards) {
          if (hazard.type === "DUPLICATE_CHECK") {
            if (!hazard.table || !existing.has(hazard.table)) continue; // created by this plan
            if (!hazard.columns) { fail("UNVERIFIABLE_HAZARD", `Statement ${statement.seq} adds a uniqueness rule over an expression; duplicates cannot be checked beforehand.`); continue; }
            const cols = hazard.columns.map(quote).join(", ");
            const { rows } = await client.query(
              `SELECT count(*)::int AS n FROM (SELECT 1 FROM ${quote(hazard.table)} WHERE ${hazard.columns.map((c) => `${quote(c)} IS NOT NULL`).join(" AND ")} GROUP BY ${cols} HAVING count(*) > 1 LIMIT 1) d`
            ).catch((err) => { fail("UNVERIFIABLE_HAZARD", `Statement ${statement.seq}: duplicate check failed (${err.message}).`); return { rows: [{ n: 0 }] }; });
            hazardEvidence.push({ seq: statement.seq, type: hazard.type, table: hazard.table, columns: hazard.columns, duplicates: rows[0].n > 0 });
            if (rows[0].n > 0) fail("DUPLICATE_VALUES", `Statement ${statement.seq}: '${hazard.table}' holds duplicate values in (${hazard.columns.join(", ")}); the unique rule would fail.`);
          } else if (hazard.type === "NOT_NULL_BACKFILL" && hazard.table && existing.has(hazard.table)) {
            const backfilled = plan.statements.some((s) => s.seq < statement.seq && new RegExp(`^UPDATE\\s+(?:ONLY\\s+)?(?:${IDENT}\\s*\\.\\s*)?"?${hazard.table}"?\\b`, "i").test(skeleton(s.sql).trim()) && s.sql.includes(hazard.columns![0]));
            const condition = hazard.mode === "SET" ? `WHERE ${quote(hazard.columns![0])} IS NULL` : "";
            const { rows } = await client.query(`SELECT EXISTS (SELECT 1 FROM ${quote(hazard.table)} ${condition}) AS present`)
              .catch((err) => { fail("UNVERIFIABLE_HAZARD", `Statement ${statement.seq}: NULL check failed (${err.message}).`); return { rows: [{ present: false }] }; });
            hazardEvidence.push({ seq: statement.seq, type: hazard.type, table: hazard.table, column: hazard.columns![0], rowsNeedingBackfill: rows[0].present, backfillInPlan: backfilled });
            if (rows[0].present && !backfilled) {
              fail("BACKFILL_REQUIRED", hazard.mode === "SET"
                ? `Statement ${statement.seq}: '${hazard.table}.${hazard.columns![0]}' has NULL values; backfill them in an earlier statement of the plan.`
                : `Statement ${statement.seq}: '${hazard.table}' has rows; add the column with a default or as nullable and backfill it first.`);
            }
          }
        }
      }
      evidence.hazards = hazardEvidence;
    });

    return { failures, evidence };
  }

  public async preflight(migrationId: string, expected: { databaseId?: string; projectId?: string; environment?: unknown } = {}): Promise<MigrationView> {
    const target = await this.target(migrationId, expected);
    const state = stateOf(target.migration.status);
    if (!["PENDING", "PREFLIGHT_PASSED", "REHEARSED"].includes(state)) {
      throw new AppError(`A migration in state ${state} cannot be preflighted`, 409, "INVALID_MIGRATION_STATE");
    }
    const plan = planOf(target.migration, target.database.schemaName);
    const { failures, evidence } = await this.inspect(target, plan);
    if (failures.length > 0) {
      await transition(migrationId, ["PENDING", "PREFLIGHT_PASSED", "REHEARSED"], "PENDING", { lifecycle: { preflight: { ...evidence, passed: false, failures }, rehearsals: null } });
      throw new AppError(`Preflight failed: ${failures.map((f) => f.message).join(" ")}`, failures[0].code === "MIGRATION_CHECKSUM_MISMATCH" ? 422 : 409, failures[0].code);
    }
    const row = await transition(migrationId, ["PENDING", "PREFLIGHT_PASSED", "REHEARSED"], "PREFLIGHT_PASSED", { lifecycle: { preflight: { ...evidence, passed: true, failures: [] }, rehearsals: null }, errorMessage: null });
    if (!row) throw new AppError("The migration changed state during preflight", 409, "INVALID_MIGRATION_STATE");
    return toView(row);
  }

  // -------------------------------------------------------------------------
  // 3. Dual rehearsal
  // -------------------------------------------------------------------------

  /**
   * Runs the plan for real in two scratch schemas of the same server, then drops them:
   *  - "empty": the release as a fresh installation. When every table came from recorded
   *    migrations, the history is replayed from nothing; otherwise the current structure is
   *    cloned without rows (basis STRUCTURE_CLONE).
   *  - "priorRelease": the current structure with data (all rows of small tables, a bounded sample
   *    of large ones, and generated rows for empty tables).
   */
  public async rehearse(migrationId: string, expected: { databaseId?: string; projectId?: string; environment?: unknown } = {}): Promise<MigrationView> {
    const target = await this.target(migrationId, expected);
    if (stateOf(target.migration.status) !== "PREFLIGHT_PASSED") {
      throw new AppError("Preflight must pass before rehearsal", 409, "PREFLIGHT_REQUIRED");
    }
    const { database, migration } = target;
    const plan = planOf(migration, database.schemaName);
    const source = database.schemaName;
    const { rows: history } = await pgPool.query(
      `SELECT name, "upSql", plan FROM forge_database_migrations WHERE "databaseId" = $1::uuid AND status = 'APPLIED' ORDER BY "appliedAt", "createdAt"`,
      [database.id]
    );

    const tablesOf = async (client: pg.PoolClient, schema: string) =>
      (await client.query(`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind = 'r' AND c.relname <> '_forge_migrations' ORDER BY 1`, [schema])).rows.map((r: any) => r.name as string);

    const runPlan = async (client: pg.PoolClient) => {
      for (const statement of plan.statements) {
        try {
          await client.query(statement.sql);
        } catch (err: any) {
          throw new Error(`statement ${statement.seq} failed: ${err.message}`);
        }
      }
    };

    const rehearseIn = async (kind: "empty" | "priorRelease") => {
      const scratch = `_forge_rehearsal_${crypto.randomBytes(6).toString("hex")}`;
      const started = Date.now();
      const record: Record<string, unknown> = { passed: false, statements: plan.statements.length };
      const admin = await pgPool.connect();
      try {
        await admin.query(`CREATE SCHEMA ${quote(scratch)}`);
        await withSchema(scratch, plan.budget, async (client) => {
          const sourceTables = await tablesOf(client, source);
          let cloned = true;
          if (kind === "empty" && history.length > 0 && history.every((h: any) => !h.plan?.baseline)) {
            // Replay the recorded history from nothing, if it accounts for every table.
            try {
              for (const h of history) await client.query(h.upSql);
              const replayed = await tablesOf(client, scratch);
              if (JSON.stringify(replayed) === JSON.stringify(sourceTables)) { cloned = false; record.basis = "HISTORY_REPLAY"; record.replayed = history.length; }
            } catch { /* fall through to a structure clone */ }
            if (cloned) { await client.query(`DROP SCHEMA ${quote(scratch)} CASCADE`); await client.query(`CREATE SCHEMA ${quote(scratch)}`); }
          }
          if (cloned) {
            record.basis = "STRUCTURE_CLONE";
            const data: Record<string, { rows: number; sampled: boolean; generated: boolean }> = {};
            for (const table of sourceTables) {
              await client.query(`CREATE TABLE ${quote(table)} (LIKE ${quote(source)}.${quote(table)} INCLUDING ALL)`);
              if (kind !== "priorRelease") continue;
              const { rows: [{ n }] } = await client.query(`SELECT count(*)::bigint AS n FROM (SELECT 1 FROM ${quote(source)}.${quote(table)} LIMIT ${FULL_COPY_ROWS + 1}) s`);
              const sampled = Number(n) > FULL_COPY_ROWS;
              const copied = await client.query(`INSERT INTO ${quote(table)} SELECT * FROM ${quote(source)}.${quote(table)} LIMIT ${FULL_COPY_ROWS}`);
              let generated = false;
              if ((copied.rowCount ?? 0) === 0) generated = await this.generateRows(client, scratch, table);
              data[table] = { rows: copied.rowCount ?? 0, sampled, generated };
            }
            // Foreign keys are not copied by LIKE; re-create them so the plan meets the real rules.
            const { rows: keys } = await admin.query(
              `SELECT c.relname AS table_name, k.conname, pg_get_constraintdef(k.oid) AS definition
                 FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = $1 AND k.contype = 'f'`,
              [source]
            );
            for (const key of keys) {
              const definition = String(key.definition).split(`${quote(source)}.`).join("").split(`${source}.`).join("");
              const anySampled = Object.values(data).some((d) => d.sampled || d.generated);
              await client.query(`ALTER TABLE ${quote(key.table_name)} ADD CONSTRAINT ${quote(key.conname)} ${definition}${anySampled ? " NOT VALID" : ""}`);
            }
            if (kind === "priorRelease") record.data = data;
          }
          await runPlan(client);
          record.catalogHash = await catalogFingerprint(client, scratch);
        });
        record.passed = true;
      } catch (err: any) {
        record.error = String(err?.message ?? err).slice(0, 1000);
      } finally {
        await admin.query(`DROP SCHEMA IF EXISTS ${quote(scratch)} CASCADE`).catch(() => undefined);
        admin.release();
      }
      record.durationMs = Date.now() - started;
      return record;
    };

    const empty = await rehearseIn("empty");
    const priorRelease = await rehearseIn("priorRelease");
    const passed = empty.passed === true && priorRelease.passed === true;
    const rehearsals = { rehearsedAt: new Date().toISOString(), passed, empty, priorRelease, targetCatalogHash: migration.lifecycle?.preflight?.catalogHash ?? null };
    const row = await transition(migrationId, ["PREFLIGHT_PASSED"], passed ? "REHEARSED" : "PREFLIGHT_PASSED", { lifecycle: { rehearsals } });
    if (!row) throw new AppError("The migration changed state during rehearsal", 409, "INVALID_MIGRATION_STATE");
    if (!passed) {
      throw new AppError(`Rehearsal failed: ${[empty, priorRelease].filter((r) => !r.passed).map((r) => r.error).join("; ")}`, 422, "REHEARSAL_FAILED");
    }
    return toView(row);
  }

  /** Inserts a few generated rows into an empty rehearsal table. Best effort: false when it could not. */
  private async generateRows(client: pg.PoolClient, schema: string, table: string): Promise<boolean> {
    const { rows: columns } = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default, is_generated, is_identity FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      [schema, table]
    );
    const value = (type: string, i: number): string | null => {
      if (/int|numeric|decimal|real|double/.test(type)) return String(i + 1);
      if (/char|text/.test(type)) return `'sample_${i + 1}'`;
      if (type === "boolean") return i % 2 ? "true" : "false";
      if (type === "uuid") return "gen_random_uuid()";
      if (/timestamp|date/.test(type)) return `now() - interval '${i} days'`;
      if (/json/.test(type)) return `'{}'`;
      return null;
    };
    const usable = columns.filter((c: any) => c.is_generated !== "ALWAYS" && c.is_identity !== "YES" && !c.column_default);
    await client.query("SAVEPOINT forge_generated").catch(() => undefined);
    try {
      for (let i = 0; i < 3; i++) {
        const cols: string[] = [];
        const vals: string[] = [];
        for (const c of usable) {
          const v = value(c.data_type, i);
          if (v === null) { if (c.is_nullable === "NO") return false; continue; }
          cols.push(quote(c.column_name));
          vals.push(v);
        }
        await client.query(cols.length ? `INSERT INTO ${quote(table)} (${cols.join(", ")}) VALUES (${vals.join(", ")})` : `INSERT INTO ${quote(table)} DEFAULT VALUES`);
      }
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // 4. Approval
  // -------------------------------------------------------------------------

  public async approve(
    migrationId: string,
    approver: Actor,
    options: { acknowledgeDestructive?: boolean; databaseId?: string; projectId?: string; environment?: unknown } = {}
  ): Promise<MigrationView> {
    const target = await this.target(migrationId, options);
    const { migration, database } = target;
    if (stateOf(migration.status) !== "REHEARSED" || migration.lifecycle?.rehearsals?.passed !== true ||
        migration.lifecycle.rehearsals.empty?.passed !== true || migration.lifecycle.rehearsals.priorRelease?.passed !== true) {
      throw new AppError("Both rehearsals (empty and prior-release) must pass before approval", 409, "REHEARSAL_REQUIRED");
    }
    const plan = planOf(migration, database.schemaName);
    if (database.environment === "PRODUCTION") {
      if (!approver.canAdminister) throw new AppError("Only a project administrator can approve a production migration", 403, "FORBIDDEN");
      if (plan.destructive && options.acknowledgeDestructive !== true) {
        throw new AppError("This plan removes or rewrites production data or structure. It must be approved with an explicit acknowledgement.", 409, "DESTRUCTIVE_ACKNOWLEDGEMENT_REQUIRED");
      }
    }
    const approval = {
      approvedById: approver.id,
      approvedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + APPROVAL_TTL_MS).toISOString(),
      environment: database.environment,
      destructive: plan.destructive,
      destructiveAcknowledged: plan.destructive ? options.acknowledgeDestructive === true : false,
      migrationSetHash: plan.migrationSetHash,
    };
    const row = await transition(migrationId, ["REHEARSED"], "APPROVED", { lifecycle: { approval } });
    if (!row) throw new AppError("The migration changed state during approval", 409, "INVALID_MIGRATION_STATE");
    await recordAuditLog({ userId: approver.id, action: "database.migration_approved", targetResource: `migration:${migrationId}`, details: { name: migration.name, environment: database.environment, destructive: plan.destructive } });
    return toView(row);
  }

  public async cancel(migrationId: string, actor: Actor, expected: { databaseId?: string; projectId?: string } = {}): Promise<MigrationView> {
    await this.target(migrationId, expected, false);
    const row = await transition(migrationId, ["PENDING", "PREFLIGHT_PASSED", "REHEARSED", "APPROVED", "FAILED"], "CANCELLED", { lifecycle: { cancelledById: actor.id, cancelledAt: new Date().toISOString() } });
    if (!row) throw new AppError("Only a migration that has not started can be cancelled", 409, "INVALID_MIGRATION_STATE");
    return toView(row);
  }

  // -------------------------------------------------------------------------
  // 5. Execution — the only place DDL is sent to a customer schema
  // -------------------------------------------------------------------------

  public async execute(
    migrationId: string,
    actor: Actor,
    expected: { databaseId?: string; projectId?: string; environment?: unknown } = {}
  ): Promise<MigrationView & { replayed?: boolean }> {
    let target = await this.target(migrationId, expected);
    const { database } = target;
    const state = stateOf(target.migration.status);
    // A repeated request for a finished migration reports what the database holds; it runs nothing.
    if (state === "APPLIED") return { ...toView(target.migration), replayed: true };
    if (IN_DOUBT.includes(state)) {
      throw new AppError(`This migration is ${state}; it must be reconciled, not run again`, state === "UNCERTAIN" ? 409 : 423, state === "UNCERTAIN" ? "RECONCILIATION_REQUIRED" : "MIGRATION_IN_PROGRESS");
    }
    if (state !== "APPROVED" && state !== "PARTIALLY_APPLIED") {
      throw new AppError(`Cannot execute a migration in state ${state}; it must be approved`, 409, "NOT_APPROVED");
    }
    const plan = planOf(target.migration, database.schemaName);
    const resuming = state === "PARTIALLY_APPLIED";
    const approval = target.migration.lifecycle?.approval;
    if (!approval || approval.migrationSetHash !== plan.migrationSetHash) throw new AppError("The approval does not cover this plan", 409, "NOT_APPROVED");
    if (new Date(approval.expiresAt) < new Date()) {
      await transition(migrationId, ["APPROVED"], "CANCELLED", { lifecycle: { cancelledAt: new Date().toISOString(), cancelReason: "APPROVAL_EXPIRED" } });
      throw new AppError("Migration approval has expired", 409, "APPROVAL_EXPIRED");
    }

    const { rows: running } = await pgPool.query(
      `SELECT name FROM forge_database_migrations WHERE "databaseId" = $1::uuid AND id <> $2::uuid AND status IN ('APPLYING', 'VALIDATING')`,
      [database.id, migrationId]
    );
    if (running[0]) throw new AppError(`Migration '${running[0].name}' is being applied to this database`, 423, "MIGRATION_IN_PROGRESS");

    // Gate checks again, immediately before anything runs. A resumed plan has already changed the
    // schema, so only the checks that do not depend on the pre-run structure are repeated.
    if (!resuming) {
      const { failures, evidence } = await this.inspect(target, plan);
      const rehearsed = target.migration.lifecycle?.rehearsals?.targetCatalogHash;
      if (failures.length === 0 && rehearsed && rehearsed !== evidence.catalogHash) {
        failures.push({ code: "TARGET_CHANGED_SINCE_REHEARSAL", message: "The target schema changed after the plan was rehearsed; preflight and rehearse it again." });
      }
      if (failures.length > 0) {
        await transition(migrationId, ["APPROVED"], "PENDING", { lifecycle: { approval: null, rehearsals: null, preflight: { ...evidence, passed: false, failures } } });
        throw new AppError(`Execution refused: ${failures.map((f) => f.message).join(" ")}`, failures[0].code === "MIGRATION_CHECKSUM_MISMATCH" ? 422 : 409, failures[0].code);
      }
    }

    // Take the fenced lease: the partial unique index admits one in-flight migration per database.
    const leaseToken = `lease_${crypto.randomUUID()}`;
    let leased: any;
    try {
      leased = await transition(migrationId, [state], "APPLYING", {
        lease: { token: leaseToken, ms: plan.budget.totalMs + 60_000 },
        lifecycle: { execution: { startedAt: new Date().toISOString(), startedById: actor.id, attempt: (target.migration.lifecycle?.attempt ?? 1), resumed: resuming } },
        errorMessage: null,
      });
    } catch (err: any) {
      if (err?.code === "23505") throw new AppError("Another migration is being applied to this database", 423, "MIGRATION_IN_PROGRESS");
      throw err;
    }
    if (!leased) {
      // Lost a race for this very migration: report the winner's state.
      target = await this.target(migrationId, expected);
      if (stateOf(target.migration.status) === "APPLIED") return { ...toView(target.migration), replayed: true };
      throw new AppError("This migration is already being applied", 423, "MIGRATION_IN_PROGRESS");
    }

    const started = Date.now();
    const progress: Record<string, { status: "done"; at: string }> = resuming ? { ...(target.migration.lifecycle?.progress ?? {}) } : {};
    const name = target.migration.name;
    const checksum = target.migration.checksum;
    const reverts = plan.reverts ? (await pgPool.query(`SELECT name FROM forge_database_migrations WHERE id = $1::uuid`, [plan.reverts])).rows[0]?.name : null;
    let commitSent = false;
    let failure: any = null;

    try {
      await withSchema(database.schemaName, plan.budget, async (client) => {
        const key = lockKey(database.id);
        const { rows: [{ locked }] } = await client.query(`SELECT pg_try_advisory_lock($1) AS locked`, [key]);
        if (!locked) throw new AppError("Another session holds the migration lock of this database", 423, "MIGRATION_IN_PROGRESS");
        const record = async () => {
          await client.query(
            `INSERT INTO _forge_migrations (name, checksum, execution_time_ms, applied_at) VALUES ($1, $2, $3, now())`,
            [name, checksum, Date.now() - started]
          );
          if (reverts) await client.query(`DELETE FROM _forge_migrations WHERE name = $1`, [reverts]);
        };
        const overBudget = () => {
          if (Date.now() - started > plan.budget.totalMs) throw new AppError("The migration exceeded its execution budget", 408, "BUDGET_EXCEEDED");
        };

        // Phases: consecutive transactional statements share one transaction; a statement that
        // cannot run in a transaction is a phase of its own. Progress is recorded after each phase.
        const pending = plan.statements.filter((s) => !progress[String(s.seq)]);
        const phases: PlannedStatement[][] = [];
        for (const statement of pending) {
          const last = phases[phases.length - 1];
          if (statement.transactional && last && last[0].transactional) last.push(statement);
          else phases.push([statement]);
        }
        if (phases.length === 0) phases.push([]);

        for (let p = 0; p < phases.length; p++) {
          const phase = phases[p];
          const final = p === phases.length - 1;
          overBudget();
          if (phase.length === 0 || phase[0].transactional) {
            await client.query("BEGIN");
            try {
              for (const statement of phase) { overBudget(); await client.query(statement.sql); }
              if (final) await record();
              if (final) commitSent = true;
              await client.query("COMMIT");
            } catch (err) {
              await client.query("ROLLBACK").catch(() => undefined);
              throw err;
            }
          } else {
            const statement = phase[0];
            // A CONCURRENTLY build that failed earlier leaves an invalid index behind: remove it first.
            const index = new RegExp(`^CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+CONCURRENTLY\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${IDENT}`, "i").exec(skeleton(statement.sql).trim());
            if (index) {
              const { rows } = await client.query(
                `SELECT i.indisvalid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_index i ON i.indexrelid = c.oid WHERE n.nspname = $1 AND c.relname = $2`,
                [database.schemaName, index[1]]
              );
              if (rows[0] && rows[0].indisvalid === false) await client.query(`DROP INDEX CONCURRENTLY IF EXISTS ${quote(index[1])}`);
            }
            await client.query(statement.sql);
            if (final) { commitSent = true; await record(); }
          }
          for (const statement of phase) progress[String(statement.seq)] = { status: "done", at: new Date().toISOString() };
          if (!final) await mergeLifecycle(migrationId, { progress });
        }
        await client.query(`SELECT pg_advisory_unlock($1)`, [key]).catch(() => undefined);
      });
    } catch (err) {
      failure = err;
    }

    void commitSent;
    if (failure instanceof AppError && failure.code === "MIGRATION_IN_PROGRESS") {
      // Another session holds the database's migration lock: this run did nothing. Hand the lease back.
      await transition(migrationId, ["APPLYING"], state, { extraWhere: `AND "leaseToken" = '${leaseToken}'`, lease: null });
      throw failure;
    }
    return this.settle({ migrationId, database, name, checksum, leaseToken, started, progress, plan, failure, actor });
  }

  /**
   * Decides the outcome of an execution attempt from what the target database holds, and records
   * it. Used after every attempt and by reconciliation.
   */
  private async settle(input: {
    migrationId: string;
    database: Target["database"];
    name: string;
    checksum: string;
    leaseToken: string | null;
    started: number;
    progress: Record<string, unknown>;
    plan: MigrationPlan;
    failure: any;
    actor: Actor | null;
  }): Promise<MigrationView> {
    const { migrationId, database, name, checksum, plan, failure } = input;
    const lease = input.leaseToken ? `AND "leaseToken" = '${input.leaseToken.replace(/[^A-Za-z0-9_-]/g, "")}'` : "";
    const error = failure ? String(failure?.message ?? failure).slice(0, 2000) : null;
    const done = Object.keys(input.progress).length;

    let evidence: { name: string; checksum: string; applied_at: Date } | undefined;
    let catalogHash: string | null = null;
    try {
      if (!failure) await transition(migrationId, ["APPLYING"], "VALIDATING", { extraWhere: lease });
      evidence = await evidenceRow(pgPool, database.schemaName, name);
      catalogHash = await catalogFingerprint(pgPool, database.schemaName);
    } catch (inspectError: any) {
      // The target cannot be read: nothing may be concluded.
      // If even this update fails the row stays APPLYING and is reconciled later; it is never
      // reported as applied or failed on a guess.
      await transition(migrationId, ["APPLYING", "VALIDATING"], "UNCERTAIN", {
        extraWhere: lease, lease: null,
        errorMessage: `Outcome unknown: ${error ?? "the run finished"}, and the target could not be inspected (${inspectError?.message}).`,
        lifecycle: { progress: input.progress },
      }).catch(() => null);
      throw new AppError("The migration outcome is unknown and must be reconciled", 500, "MIGRATION_RECONCILIATION_REQUIRED");
    }

    let row: any;
    if (evidence && evidence.checksum === checksum) {
      // The database says it is applied. That, and nothing else, makes it APPLIED.
      row = await transition(migrationId, ["APPLYING", "VALIDATING", "UNCERTAIN"], "APPLIED", {
        extraWhere: lease, lease: null, errorMessage: null,
        applied: { at: evidence.applied_at, ms: Date.now() - input.started },
        lifecycle: { progress: input.progress, evidence: { ledger: { name: evidence.name, checksum: evidence.checksum, appliedAt: new Date(evidence.applied_at).toISOString() }, catalogHash, verifiedAt: new Date().toISOString() } },
      });
      if (row && plan.reverts) await pgPool.query(`UPDATE forge_database_migrations SET status = 'ROLLED_BACK', "updatedAt" = now() WHERE id = $1::uuid AND status = 'APPLIED'`, [plan.reverts]);
      if (row) await recordAuditLog({ userId: input.actor?.id, action: "database.migration_applied", targetResource: `migration:${migrationId}`, details: { name, checksum, catalogHash } });
    } else if (evidence) {
      row = await transition(migrationId, ["APPLYING", "VALIDATING", "UNCERTAIN"], "RECOVERY_REQUIRED", {
        extraWhere: lease, lease: null,
        errorMessage: `The target records '${name}' with a different checksum (${evidence.checksum}).`,
        lifecycle: { progress: input.progress },
      });
    } else if (done > 0 && plan.statements.some((s) => !s.transactional)) {
      // Some phases are committed and the plan is not complete.
      row = await transition(migrationId, ["APPLYING", "VALIDATING", "UNCERTAIN"], "PARTIALLY_APPLIED", {
        extraWhere: lease, lease: null,
        errorMessage: error ?? "The run stopped before the plan was complete.",
        lifecycle: { progress: input.progress, partial: { completedStatements: done, of: plan.statements.length, catalogHash, at: new Date().toISOString() } },
      });
    } else {
      // Nothing of this plan is in the target: it failed cleanly and may be retried.
      row = await transition(migrationId, ["APPLYING", "VALIDATING", "UNCERTAIN"], "FAILED", {
        extraWhere: lease, lease: null,
        errorMessage: error ?? "The run ended without recording the migration in the target.",
        lifecycle: { progress: {}, failure: { at: new Date().toISOString(), ledgerChecked: true, catalogHash } },
      });
    }
    if (!row) throw new AppError("The migration record changed while its outcome was being recorded; reconcile it", 409, "RECONCILIATION_REQUIRED");
    const view = toView(row);
    if (view.status === "APPLIED") return view;
    if (failure instanceof AppError && failure.code === "MIGRATION_IN_PROGRESS") throw failure;
    throw new AppError(
      `Migration ${view.status === "FAILED" ? "failed" : `ended as ${view.status}`}: ${view.errorMessage}`,
      view.status === "FAILED" ? 500 : 409,
      view.status === "FAILED" ? "MIGRATION_FAILED" : view.status === "PARTIALLY_APPLIED" ? "MIGRATION_PARTIALLY_APPLIED" : "MIGRATION_RECOVERY_REQUIRED"
    );
  }

  // -------------------------------------------------------------------------
  // 6. Reconciliation, retry, recovery
  // -------------------------------------------------------------------------

  /**
   * Resolves a migration whose outcome is not known (the process died, or the control plane could
   * not be updated) by inspecting the target. It never runs DDL, and it does nothing while the
   * original session may still be working.
   */
  public async reconcile(migrationId: string, expected: { databaseId?: string; projectId?: string } = {}): Promise<MigrationView> {
    const { migration, database } = await this.target(migrationId, expected, false);
    const state = stateOf(migration.status);
    if (!IN_DOUBT.includes(state)) return toView(migration);
    const plan = planOf(migration, database.schemaName);

    // If the session that was applying it is still alive, it still holds the advisory lock.
    const probe = await pgPool.connect();
    try {
      const key = lockKey(database.id);
      const { rows: [{ locked }] } = await probe.query(`SELECT pg_try_advisory_lock($1) AS locked`, [key]);
      if (!locked) throw new AppError("The migration is still running in another session", 423, "MIGRATION_IN_PROGRESS");
      await probe.query(`SELECT pg_advisory_unlock($1)`, [key]);
    } finally {
      probe.release();
    }

    try {
      return await this.settle({
        migrationId, database, name: migration.name, checksum: migration.checksum, leaseToken: null,
        started: Date.now() - (migration.executionTimeMs ?? 0), progress: migration.lifecycle?.progress ?? {}, plan,
        failure: new Error(migration.errorMessage || "The run was interrupted before its outcome was recorded."), actor: null,
      });
    } catch (err: any) {
      if (["MIGRATION_FAILED", "MIGRATION_PARTIALLY_APPLIED", "MIGRATION_RECOVERY_REQUIRED"].includes(err?.code)) {
        return toView((await this.target(migrationId, {}, false)).migration);
      }
      throw err;
    }
  }

  /** Reconciles every migration left in flight by a process that is gone. Safe to run at any time. */
  public async reconcileInterrupted(): Promise<Array<{ id: string; status: MigrationState }>> {
    const { rows } = await pgPool.query(
      `SELECT id FROM forge_database_migrations WHERE status IN ('APPLYING', 'VALIDATING') AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < now())`
    );
    const results: Array<{ id: string; status: MigrationState }> = [];
    for (const { id } of rows) {
      try {
        results.push({ id, status: (await this.reconcile(id)).status });
      } catch { /* still running, or the target is unreachable: left for the next pass */ }
    }
    return results;
  }

  /** Returns a cleanly failed migration to PENDING so it can be checked, rehearsed and approved again. */
  public async retry(migrationId: string, expected: { databaseId?: string; projectId?: string } = {}): Promise<MigrationView> {
    const { migration } = await this.target(migrationId, expected);
    const row = await transition(migrationId, ["FAILED"], "PENDING", {
      errorMessage: null,
      lifecycle: { attempt: (migration.lifecycle?.attempt ?? 1) + 1, preflight: null, rehearsals: null, approval: null, execution: null, previousFailure: migration.errorMessage },
    });
    if (!row) throw new AppError("Only a failed migration can be retried", 409, "INVALID_MIGRATION_STATE");
    return toView(row);
  }

  /** A new plan that repairs a migration which could not be completed (forward fix, not a down migration). */
  public async createForwardFixPlan(failedMigrationId: string, input: { name: string; statements: string[]; createdById?: string | null; requestKey?: string | null }): Promise<MigrationView> {
    const { migration } = await this.target(failedMigrationId);
    if (!["FAILED", "PARTIALLY_APPLIED", "RECOVERY_REQUIRED"].includes(stateOf(migration.status))) {
      throw new AppError("A forward fix applies to a failed, partially applied or recovery-required migration", 409, "INVALID_MIGRATION_STATE");
    }
    return this.createPlan({ databaseId: migration.databaseId, projectId: migration.projectId, fixes: failedMigrationId, ...input });
  }

  /**
   * Accepts the schema as it stands as the starting point for migrations: used once for a
   * database whose tables were created outside the authority, and to acknowledge a change made
   * outside it. Records evidence only; it runs no DDL.
   */
  public async adoptBaseline(databaseId: string, actor: Actor, expected: { projectId?: string } = {}): Promise<MigrationView> {
    const database = await this.database(databaseId);
    if (expected.projectId !== undefined && database.projectId !== expected.projectId) throw new AppError("Database does not belong to the project", 403, "PROJECT_MISMATCH");
    if (database.environment === "PRODUCTION" && !actor.canAdminister) throw new AppError("Only a project administrator can adopt a production baseline", 403, "FORBIDDEN");
    const { rows: busy } = await pgPool.query(
      `SELECT 1 FROM forge_database_migrations WHERE "databaseId" = $1::uuid AND status IN ('APPLYING','VALIDATING','UNCERTAIN','RECONCILIATION_REQUIRED','PARTIALLY_APPLIED','RECOVERY_REQUIRED')`,
      [databaseId]
    );
    if (busy[0]) throw new AppError("Resolve the unfinished migration before adopting a baseline", 409, "UNRESOLVED_MIGRATION");
    const name = `baseline_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${crypto.randomBytes(3).toString("hex")}`;
    const catalogHash = await catalogFingerprint(pgPool, database.schemaName);
    const upSql = `-- baseline: schema adopted as found (catalog ${catalogHash})`;
    const plan: MigrationPlan = { authority: "FORGE_MANAGED", statements: [], migrationSetHash: setHash([]), destructive: false, dependsOn: [], budget: DEFAULT_BUDGET, baseline: true };
    const ledger = await pgPool.query(
      `INSERT INTO ${quote(database.schemaName)}._forge_migrations (name, checksum, execution_time_ms, applied_at) VALUES ($1, $2, 0, now()) RETURNING applied_at`,
      [name, sha256(upSql)]
    );
    const { rows: [row] } = await pgPool.query(
      `INSERT INTO forge_database_migrations ("databaseId", "projectId", name, "upSql", checksum, status, plan, lifecycle, "appliedAt", "createdById")
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'APPLIED', $6::jsonb, $7::jsonb, $8, $9) RETURNING *`,
      [databaseId, database.projectId, name, upSql, sha256(upSql), JSON.stringify(plan),
        JSON.stringify({ target: { environment: database.environment, schemaName: database.schemaName }, evidence: { ledger: { name, checksum: sha256(upSql) }, catalogHash, verifiedAt: new Date().toISOString() }, adoptedById: actor.id }),
        ledger.rows[0].applied_at, actor.id]
    );
    await recordAuditLog({ userId: actor.id, action: "database.migration_baseline_adopted", targetResource: `database:${databaseId}`, details: { name, catalogHash } });
    return toView(row);
  }

  // -------------------------------------------------------------------------
  // 7. Governed one-call run (legacy apply endpoint, CLI, unified-execute)
  // -------------------------------------------------------------------------

  /**
   * Preflight → dual rehearsal → approval → execution for a non-production database, where the
   * requester's own request is the approval. For PRODUCTION it stops after the rehearsal: the
   * approval and the execution are separate, explicit steps.
   */
  public async runGoverned(
    migrationId: string,
    actor: Actor,
    expected: { databaseId?: string; projectId?: string; environment?: unknown } = {}
  ): Promise<{ migration: MigrationView; approvalRequired: boolean; replayed?: boolean }> {
    let { migration, database } = await this.target(migrationId, expected);
    let state = stateOf(migration.status);
    if (state === "APPLIED") return { migration: toView(migration), approvalRequired: false, replayed: true };
    if (state === "FAILED") { await this.retry(migrationId); state = "PENDING"; }
    if (state === "PENDING") { await this.preflight(migrationId, expected); state = "PREFLIGHT_PASSED"; }
    if (state === "PREFLIGHT_PASSED") { await this.rehearse(migrationId, expected); state = "REHEARSED"; }
    if (state === "REHEARSED") {
      if (database.environment === "PRODUCTION") {
        ({ migration } = await this.target(migrationId, expected));
        return { migration: toView(migration), approvalRequired: true };
      }
      await this.approve(migrationId, actor, expected);
    }
    const executed = await this.execute(migrationId, actor, expected);
    return { migration: executed, approvalRequired: false, replayed: executed.replayed };
  }

  public async get(migrationId: string, expected: { databaseId?: string; projectId?: string } = {}): Promise<MigrationView> {
    return toView((await this.target(migrationId, expected, false)).migration);
  }
}

export const unifiedMigrationAuthority = new UnifiedMigrationAuthorityService();
