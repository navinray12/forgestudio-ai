import crypto from "node:crypto";
import { prisma } from "../../../config/prisma.js";
import { TenantPoolManager } from "../common/pool-manager.js";
import { AppError } from "../../../utils/app-error.js";
import type { DatabaseEnvironment } from "../../../generated/prisma/client.js";

export function validateIdentifier(identifier: string): string {
  // PostgreSQL truncates identifiers after 63 bytes. Refuse collisions rather
  // than silently applying a migration to a different table or column.
  if (typeof identifier !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier) || Buffer.byteLength(identifier, "utf8") > 63) {
    throw new AppError(
      `Invalid SQL identifier "${identifier}". Use 1–63 bytes, starting with a letter or underscore, followed by letters, numbers or underscores.`,
      400,
      "INVALID_IDENTIFIER"
    );
  }
  return identifier;
}

/** Only documented PostgreSQL scalar types and bounded type parameters. */
export function validateColumnType(type: string): string {
  if (typeof type !== "string") {
    throw new AppError("Invalid column type", 400, "INVALID_TYPE");
  }
  const value = type.trim().toUpperCase();
  if (/^(TEXT|INTEGER|INT|BIGINT|SMALLINT|BOOLEAN|BOOL|TIMESTAMP|TIMESTAMPTZ|DATE|JSONB|JSON|UUID|REAL|FLOAT8)$/.test(value)) {
    return value;
  }
  const varchar = /^(VARCHAR)\(([1-9][0-9]{0,4})\)$/.exec(value);
  if (varchar && Number(varchar[2]) <= 10485760) return value;
  const numeric = /^(NUMERIC|DECIMAL)\(([1-9][0-9]?),([0-9]{1,2})\)$/.exec(value);
  if (numeric && Number(numeric[2]) <= 1000 && Number(numeric[3]) <= Number(numeric[2])) return value;
  if (value === "VARCHAR" || value === "NUMERIC" || value === "DECIMAL") return value;
  throw new AppError(`Unsupported column type "${type}"`, 400, "INVALID_TYPE");
}

/**
 * DDL expressions cannot be parameterized; reject arbitrary SQL in UI defaults.
 * Keep common scalar literals and well-known database-generated values.
 */
export function validateColumnDefault(value: string): string {
  if (typeof value !== "string") {
    throw new AppError("Invalid column default", 400, "INVALID_DEFAULT");
  }
  const candidate = value.trim();
  if (
    /^(NULL|TRUE|FALSE|CURRENT_DATE|CURRENT_TIMESTAMP|NOW\(\)|GEN_RANDOM_UUID\(\))$/i.test(candidate) ||
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(candidate) ||
    /^'(?:[^']|'')*'$/.test(candidate)
  ) return candidate;
  throw new AppError("Unsupported column default expression; use a scalar literal or an approved database function.", 400, "INVALID_DEFAULT");
}

export interface ColumnDefinition {
  name: string;
  type: string;
  isNullable?: boolean;
  defaultValue?: string | null;
  isPrimaryKey?: boolean;
}

/** Validate all column identities before any connection or DDL is attempted. */
export function assertUniqueColumnNames(columns: ColumnDefinition[]): void {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new AppError("Table must contain at least one column", 400, "INVALID_COLUMNS");
  }
  const seen = new Set<string>();
  for (const column of columns) {
    const name = validateIdentifier(column.name);
    if (seen.has(name)) {
      throw new AppError(`Duplicate table column "${name}"`, 400, "DUPLICATE_COLUMN");
    }
    seen.add(name);
  }
}

export interface TableSummary {
  name: string;
  columnCount: number;
  estimatedRowCount: number;
  primaryKeys: string[];
}

export interface TableDetails {
  name: string;
  columns: {
    name: string;
    dataType: string;
    isNullable: boolean;
    defaultValue: string | null;
    isPrimaryKey: boolean;
  }[];
  indexes: {
    name: string;
    definition: string;
  }[];
  foreignKeys: {
    columnName: string;
    foreignTable: string;
    foreignColumn: string;
    constraintName: string;
  }[];
}

export interface TableNode {
  id: string;
  name: string;
  columns: {
    name: string;
    type: string;
    isPrimaryKey: boolean;
  }[];
}

export interface TableEdge {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

/**
 * Returns all user tables in the public schema of the tenant database.
 */
export async function getDatabaseTables(
  projectId: string,
  environment: DatabaseEnvironment
): Promise<TableSummary[]> {
  const pool = await TenantPoolManager.getTenantPool(projectId, environment);
  const client = await pool.connect();

  try {
    const tablesQuery = `
      SELECT 
        t.table_name,
        COALESCE(c.column_count, 0)::int AS column_count,
        COALESCE(s.n_live_tup, 0)::bigint AS estimated_row_count
      FROM information_schema.tables t
      LEFT JOIN (
        SELECT table_name, count(*) AS column_count
        FROM information_schema.columns
        WHERE table_schema = 'public'
        GROUP BY table_name
      ) c ON c.table_name = t.table_name
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name;
    `;

    const pkQuery = `
      SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public';
    `;

    const tablesRes = await client.query<{ table_name: string; column_count: number; estimated_row_count: string }>(tablesQuery);
    const pkRes = await client.query<{ table_name: string; column_name: string }>(pkQuery);

    const pkMap = new Map<string, string[]>();
    for (const row of pkRes.rows) {
      const existing = pkMap.get(row.table_name) || [];
      existing.push(row.column_name);
      pkMap.set(row.table_name, existing);
    }

    return tablesRes.rows.map((row) => ({
      name: row.table_name,
      columnCount: row.column_count,
      estimatedRowCount: Number(row.estimated_row_count || 0),
      primaryKeys: pkMap.get(row.table_name) || [],
    }));
  } finally {
    client.release();
  }
}

/**
 * Returns column definitions, foreign keys, and indexes for a specific table.
 */
export async function getTableDetails(
  projectId: string,
  tableName: string,
  environment: DatabaseEnvironment
): Promise<TableDetails> {
  const safeTable = validateIdentifier(tableName);
  const pool = await TenantPoolManager.getTenantPool(projectId, environment);
  const client = await pool.connect();

  try {
    const colQuery = `
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `;

    const pkQuery = `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1;
    `;

    const fkQuery = `
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1;
    `;

    const idxQuery = `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = $1;
    `;

    const colsRes = await client.query<any>(colQuery, [safeTable]);
    const pksRes = await client.query<{ column_name: string }>(pkQuery, [safeTable]);
    const fksRes = await client.query<any>(fkQuery, [safeTable]);
    const idxRes = await client.query<{ indexname: string; indexdef: string }>(idxQuery, [safeTable]);

    const pkSet = new Set(pksRes.rows.map((r) => r.column_name));

    return {
      name: safeTable,
      columns: colsRes.rows.map((c: any) => ({
        name: c.column_name,
        dataType: c.data_type === "USER-DEFINED" ? c.udt_name : c.data_type,
        isNullable: c.is_nullable === "YES",
        defaultValue: c.column_default,
        isPrimaryKey: pkSet.has(c.column_name),
      })),
      indexes: idxRes.rows.map((i) => ({
        name: i.indexname,
        definition: i.indexdef,
      })),
      foreignKeys: fksRes.rows.map((f: any) => ({
        columnName: f.column_name,
        foreignTable: f.foreign_table_name,
        foreignColumn: f.foreign_column_name,
        constraintName: f.constraint_name,
      })),
    };
  } finally {
    client.release();
  }
}

/**
 * Returns structured nodes and edges for visualizing an Entity-Relationship (ER) diagram.
 */
export async function getSchemaDiagram(
  projectId: string,
  environment: DatabaseEnvironment
): Promise<{ tables: TableNode[]; relationships: TableEdge[] }> {
  const tables = await getDatabaseTables(projectId, environment);
  const nodes: TableNode[] = [];
  const edges: TableEdge[] = [];

  for (const t of tables) {
    const details = await getTableDetails(projectId, t.name, environment);
    nodes.push({
      id: t.name,
      name: t.name,
      columns: details.columns.map((c) => ({
        name: c.name,
        type: c.dataType,
        isPrimaryKey: c.isPrimaryKey,
      })),
    });

    for (const fk of details.foreignKeys) {
      edges.push({
        id: `${t.name}.${fk.columnName}->${fk.foreignTable}.${fk.foreignColumn}`,
        sourceTable: t.name,
        sourceColumn: fk.columnName,
        targetTable: fk.foreignTable,
        targetColumn: fk.foreignColumn,
      });
    }
  }

  return { tables: nodes, relationships: edges };
}

/**
 * Creates a new table via visual DDL and records the migration in Prisma.
 */
export async function createTable(
  projectId: string,
  payload: { name: string; columns: ColumnDefinition[] },
  environment: DatabaseEnvironment
): Promise<void> {
  const safeName = validateIdentifier(payload.name);
  assertUniqueColumnNames(payload.columns);

  const primaryKeys: string[] = [];
  const columnClauses: string[] = [];

  for (const col of payload.columns) {
    const safeColName = validateIdentifier(col.name);
    const upperType = validateColumnType(col.type);

    let clause = `"${safeColName}" ${upperType}`;

    if (col.defaultValue !== undefined && col.defaultValue !== null && col.defaultValue.trim() !== "") {
      clause += ` DEFAULT ${validateColumnDefault(col.defaultValue)}`;
    }

    if (col.isNullable === false || col.isPrimaryKey) {
      clause += " NOT NULL";
    }

    columnClauses.push(clause);

    if (col.isPrimaryKey) {
      primaryKeys.push(`"${safeColName}"`);
    }
  }

  if (primaryKeys.length > 0) {
    columnClauses.push(`PRIMARY KEY (${primaryKeys.join(", ")})`);
  }

  const ddl = `CREATE TABLE "public"."${safeName}" (\n  ${columnClauses.join(",\n  ")}\n);`;

  const pool = await TenantPoolManager.getTenantPool(projectId, environment);
  const startTime = Date.now();
  await pool.query(ddl);
  const durationMs = Date.now() - startTime;

  // Record migration in Prisma
  const dbRecord = await prisma.projectDatabase.findUnique({
    where: {
      websiteId_environment: {
        websiteId: projectId,
        environment,
      },
    },
  });

  if (dbRecord) {
    const checksum = crypto.createHash("sha256").update(ddl).digest("hex");
    await prisma.databaseMigrationRecord.create({
      data: {
        databaseId: dbRecord.id,
        migrationName: `create_table_${safeName}_${Date.now()}`,
        checksum,
        sqlScript: ddl,
        executionTimeMs: durationMs,
      },
    });
  }
}

/**
 * Drops a table and records the migration in Prisma.
 */
export async function dropTable(
  projectId: string,
  tableName: string,
  environment: DatabaseEnvironment
): Promise<void> {
  const safeName = validateIdentifier(tableName);
  // RESTRICT is PostgreSQL's default: dependent objects must be reviewed and handled explicitly.
  const ddl = `DROP TABLE IF EXISTS "public"."${safeName}" RESTRICT;`;

  const pool = await TenantPoolManager.getTenantPool(projectId, environment);
  const startTime = Date.now();
  await pool.query(ddl);
  const durationMs = Date.now() - startTime;

  const dbRecord = await prisma.projectDatabase.findUnique({
    where: {
      websiteId_environment: {
        websiteId: projectId,
        environment,
      },
    },
  });

  if (dbRecord) {
    const checksum = crypto.createHash("sha256").update(ddl).digest("hex");
    await prisma.databaseMigrationRecord.create({
      data: {
        databaseId: dbRecord.id,
        migrationName: `drop_table_${safeName}_${Date.now()}`,
        checksum,
        sqlScript: ddl,
        executionTimeMs: durationMs,
      },
    });
  }
}

/**
 * Returns paginated table rows with sorting.
 */
export async function getTableRows(
  projectId: string,
  tableName: string,
  params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "ASC" | "DESC";
  },
  environment: DatabaseEnvironment
): Promise<{ rows: any[]; total: number }> {
  const safeTable = validateIdentifier(tableName);
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(500, Math.max(1, params.limit || 50));
  const offset = (page - 1) * limit;

  const details = await getTableDetails(projectId, safeTable, environment);
  const validColumns = new Set(details.columns.map((c) => c.name));

  let orderClause = "";
  if (params.sortBy && validColumns.has(params.sortBy)) {
    const safeSortBy = validateIdentifier(params.sortBy);
    const order = params.sortOrder === "DESC" ? "DESC" : "ASC";
    orderClause = `ORDER BY "${safeSortBy}" ${order}`;
  } else if (details.columns.some((c) => c.isPrimaryKey)) {
    const pk = details.columns.find((c) => c.isPrimaryKey)!.name;
    orderClause = `ORDER BY "${pk}" ASC`;
  }

  const pool = await TenantPoolManager.getTenantPool(projectId, environment);
  const client = await pool.connect();

  try {
    const countRes = await client.query<{ total: string }>(
      `SELECT count(*)::bigint AS total FROM "public"."${safeTable}";`
    );
    const total = Number(countRes.rows[0]?.total || 0);

    const rowsRes = await client.query(
      `SELECT * FROM "public"."${safeTable}" ${orderClause} LIMIT $1 OFFSET $2;`,
      [limit, offset]
    );

    return {
      rows: rowsRes.rows,
      total,
    };
  } finally {
    client.release();
  }
}

/**
 * Performs inline row mutations (INSERT, UPDATE, DELETE).
 */
/**
 * A single-column WHERE clause is only safe when it uniquely selects one row.
 * Compound/no-primary-key tables must use a separate, reviewed row-edit workflow.
 */
export function assertSafeRowMutation(
  details: Pick<TableDetails, "columns">,
  action: "INSERT" | "UPDATE" | "DELETE",
  primaryKeyColumn: string,
  data?: Record<string, unknown>
): void {
  const knownColumns = new Set(details.columns.map((column) => column.name));
  if (action === "UPDATE" || action === "DELETE") {
    const keys = details.columns.filter((column) => column.isPrimaryKey);
    if (keys.length !== 1 || keys[0].name !== primaryKeyColumn) {
      throw new AppError("Row changes require the table's single-column primary key", 400, "UNSAFE_ROW_SELECTOR");
    }
  }
  if (data && (action === "INSERT" || action === "UPDATE")) {
    for (const key of Object.keys(data)) {
      if (!knownColumns.has(key)) {
        throw new AppError(`Unknown table column "${key}"`, 400, "INVALID_COLUMN");
      }
    }
  }
}

export async function mutateTableRow(
  projectId: string,
  tableName: string,
  payload: {
    action: "INSERT" | "UPDATE" | "DELETE";
    primaryKeyColumn: string;
    primaryKeyValue?: any;
    data?: Record<string, any>;
  },
  environment: DatabaseEnvironment
): Promise<any> {
  const safeTable = validateIdentifier(tableName);
  const safePk = validateIdentifier(payload.primaryKeyColumn);
  if (!["INSERT", "UPDATE", "DELETE"].includes(payload.action)) {
    throw new AppError("Unknown mutation action", 400, "INVALID_ACTION");
  }
  const details = await getTableDetails(projectId, safeTable, environment);
  assertSafeRowMutation(details, payload.action, safePk, payload.data);
  const pool = await TenantPoolManager.getTenantPool(projectId, environment);
  const client = await pool.connect();

  try {
    if (payload.action === "DELETE") {
      if (payload.primaryKeyValue === undefined) {
        throw new AppError("Primary key value is required for DELETE", 400, "MISSING_PK");
      }
      const res = await client.query(
        `DELETE FROM "public"."${safeTable}" WHERE "${safePk}" = $1 RETURNING *;`,
        [payload.primaryKeyValue]
      );
      return res.rows[0] || null;
    }

    if (payload.action === "UPDATE") {
      if (payload.primaryKeyValue === undefined) {
        throw new AppError("Primary key value is required for UPDATE", 400, "MISSING_PK");
      }
      if (!payload.data || Object.keys(payload.data).length === 0) {
        throw new AppError("Data is required for UPDATE", 400, "MISSING_DATA");
      }

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const [key, val] of Object.entries(payload.data)) {
        const safeCol = validateIdentifier(key);
        if (safeCol === safePk) continue; // Skip primary key update
        updates.push(`"${safeCol}" = $${idx++}`);
        values.push(val);
      }

      if (updates.length === 0) {
        throw new AppError("UPDATE requires at least one non-primary-key column", 400, "MISSING_UPDATABLE_COLUMNS");
      }
      values.push(payload.primaryKeyValue);
      const query = `UPDATE "public"."${safeTable}" SET ${updates.join(", ")} WHERE "${safePk}"  = $${idx} RETURNING *;`;
      const res = await client.query(query, values);
      return res.rows[0] || null;
    }

    if (payload.action === "INSERT") {
      if (!payload.data || Object.keys(payload.data).length === 0) {
        throw new AppError("Data is required for INSERT", 400, "MISSING_DATA");
      }

      const cols: string[] = [];
      const placeholders: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const [key, val] of Object.entries(payload.data)) {
        const safeCol = validateIdentifier(key);
        cols.push(`"${safeCol}"`);
        placeholders.push(`$${idx++}`);
        values.push(val);
      }

      const query = `INSERT INTO "public"."${safeTable}" (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *;`;
      const res = await client.query(query, values);
      return res.rows[0] || null;
    }

    throw new AppError(`Unknown mutation action: ${payload.action}`, 400, "INVALID_ACTION");
  } finally {
    client.release();
  }
}
