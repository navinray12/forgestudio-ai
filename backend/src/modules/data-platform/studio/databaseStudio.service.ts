/**
 * ForgeStudio Module 26: Database Studio Service
 * Real table data browser, CRUD, SQL editor, EXPLAIN query planner, query history, seed tools,
 * and CSV/JSON data import/export.
 */

import crypto from "node:crypto";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { customerConnectionManager } from "../database/connectionManager.js";
import {
  SqlQueryResult,
  TableDataQuery,
  TableDataResult,
  ExplainPlanResult,
  QueryLogEntity,
} from "./studio.types.js";

const db = prisma as any;

export type StudioEnvironment = "DEVELOPMENT" | "STAGING" | "PRODUCTION";

export class DatabaseStudioService {
  /**
   * Validate mandatory, explicit environment selection.
   * Rejects missing or invalid environment; ZERO fallback to production.
   */
  public static validateEnvironment(env?: unknown): StudioEnvironment {
    if (!env || typeof env !== "string") {
      throw new AppError(
        "Explicit environment selection is mandatory for Database Studio operations (DEVELOPMENT, STAGING, or PRODUCTION)",
        400,
        "MISSING_ENVIRONMENT"
      );
    }
    const upper = env.toUpperCase();
    if (upper !== "DEVELOPMENT" && upper !== "STAGING" && upper !== "PRODUCTION") {
      throw new AppError(
        `Invalid environment '${env}'. Allowed environments: DEVELOPMENT, STAGING, PRODUCTION. Zero fallback allowed.`,
        400,
        "INVALID_ENVIRONMENT"
      );
    }
    return upper as StudioEnvironment;
  }

  /**
   * Capture a versioned desired-versus-observed schema snapshot
   */
  public async captureSchemaSnapshot(
    databaseId: string,
    environment: string
  ): Promise<{
    databaseId: string;
    environment: StudioEnvironment;
    snapshotDigest: string;
    capturedAt: string;
    tables: Array<{ name: string; columnsCount: number }>;
  }> {
    const resolvedEnv = DatabaseStudioService.validateEnvironment(environment);
    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    if (database.environment && database.environment.toUpperCase() !== resolvedEnv) {
      throw new AppError(
        `Target environment mismatch: database is '${database.environment}', but request specified '${resolvedEnv}'`,
        403,
        "ENVIRONMENT_MISMATCH"
      );
    }

    const schemaName = database.schemaName;
    const query = `
      SELECT table_name, count(column_name)::int as cols
      FROM information_schema.columns
      WHERE table_schema = $1
      GROUP BY table_name
      ORDER BY table_name;
    `;
    const res = await customerConnectionManager.querySchema(schemaName, query, [schemaName]);
    const tables = (res.rows || []).map((r: any) => ({ name: r.table_name, columnsCount: r.cols || 0 }));

    const raw = JSON.stringify({ databaseId, environment: resolvedEnv, schemaName, tables });
    const snapshotDigest = crypto.createHash("sha256").update(raw).digest("hex");

    return {
      databaseId,
      environment: resolvedEnv,
      snapshotDigest,
      capturedAt: new Date().toISOString(),
      tables,
    };
  }

  /**
   * Fetch paginated, filtered, and sorted table data
   */
  public async getTableData(
    databaseId: string,
    tableName: string,
    query: TableDataQuery = {},
    environment?: string
  ): Promise<TableDataResult> {
    const targetEnv = environment || (query as any).environment;
    if (targetEnv) {
      DatabaseStudioService.validateEnvironment(targetEnv);
    }

    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    const schemaName = database.schemaName;
    const qTable = customerConnectionManager.quoteIdent(tableName);

    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 25));
    const offset = (page - 1) * pageSize;

    const whereClauses: string[] = [];
    const params: any[] = [];

    // Structured Filters
    if (query.filters && query.filters.length > 0) {
      for (const f of query.filters) {
        const qField = customerConnectionManager.quoteIdent(f.field);
        if (f.operator === "is_null") {
          whereClauses.push(`${qField} IS NULL`);
        } else if (f.operator === "is_not_null") {
          whereClauses.push(`${qField} IS NOT NULL`);
        } else {
          params.push(f.value);
          const pIdx = params.length;
          const opMap: Record<string, string> = {
            eq: "=",
            neq: "!=",
            gt: ">",
            gte: ">=",
            lt: "<",
            lte: "<=",
            like: "LIKE",
            ilike: "ILIKE",
          };
          const op = opMap[f.operator] || "=";
          whereClauses.push(`${qField} ${op} $${pIdx}`);
        }
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Order By
    let orderSql = "";
    if (query.sortField) {
      const qSort = customerConnectionManager.quoteIdent(query.sortField);
      const dir = query.sortOrder === "desc" ? "DESC" : "ASC";
      orderSql = `ORDER BY ${qSort} ${dir}`;
    }

    // 1. Count Total
    const countQuery = `SELECT count(*)::int as total FROM ${qTable} ${whereSql};`;
    const countRes = await customerConnectionManager.querySchema(schemaName, countQuery, params);
    const totalRows = countRes.rows[0]?.total || 0;

    // 2. Fetch Page Rows
    params.push(pageSize);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataQuery = `SELECT * FROM ${qTable} ${whereSql} ${orderSql} LIMIT $${limitIdx} OFFSET $${offsetIdx};`;
    const dataRes = await customerConnectionManager.querySchema(schemaName, dataQuery, params);

    const columns = dataRes.fields.map((f) => f.name);
    const totalPages = Math.ceil(totalRows / pageSize);

    return {
      tableName,
      columns,
      rows: dataRes.rows,
      totalRows,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Insert a new row into a table
   */
  public async insertRow(
    databaseId: string,
    tableName: string,
    rowData: Record<string, any>
  ): Promise<any> {
    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    const schemaName = database.schemaName;
    const qTable = customerConnectionManager.quoteIdent(tableName);

    const cols = Object.keys(rowData);
    if (cols.length === 0) throw new AppError("No column data provided", 400, "EMPTY_ROW");

    const qCols = cols.map((c) => customerConnectionManager.quoteIdent(c)).join(", ");
    const vals = cols.map((c) => rowData[c]);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");

    const query = `INSERT INTO ${qTable} (${qCols}) VALUES (${placeholders}) RETURNING *;`;
    const res = await customerConnectionManager.querySchema(schemaName, query, vals);
    return res.rows[0];
  }

  /**
   * Update an existing row by primary key
   */
  public async updateRow(
    databaseId: string,
    tableName: string,
    pkField: string,
    pkValue: any,
    changes: Record<string, any>
  ): Promise<any> {
    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    const schemaName = database.schemaName;
    const qTable = customerConnectionManager.quoteIdent(tableName);
    const qPk = customerConnectionManager.quoteIdent(pkField);

    const cols = Object.keys(changes);
    if (cols.length === 0) throw new AppError("No fields to update", 400, "EMPTY_UPDATE");

    const setClauses: string[] = [];
    const vals: any[] = [];

    cols.forEach((c, i) => {
      setClauses.push(`${customerConnectionManager.quoteIdent(c)} = $${i + 1}`);
      vals.push(changes[c]);
    });

    vals.push(pkValue);
    const pkIdx = vals.length;

    const query = `UPDATE ${qTable} SET ${setClauses.join(", ")} WHERE ${qPk} = $${pkIdx} RETURNING *;`;
    const res = await customerConnectionManager.querySchema(schemaName, query, vals);
    if (res.rows.length === 0) {
      throw new AppError("Row not found or no changes applied", 404, "ROW_NOT_FOUND");
    }
    return res.rows[0];
  }

  /**
   * Delete a row by primary key
   */
  public async deleteRow(
    databaseId: string,
    tableName: string,
    pkField: string,
    pkValue: any
  ): Promise<{ success: boolean }> {
    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    const schemaName = database.schemaName;
    const qTable = customerConnectionManager.quoteIdent(tableName);
    const qPk = customerConnectionManager.quoteIdent(pkField);

    const query = `DELETE FROM ${qTable} WHERE ${qPk} = $1;`;
    await customerConnectionManager.querySchema(schemaName, query, [pkValue]);
    return { success: true };
  }

  /**
   * Execute an arbitrary SQL query safely with duration tracking and destructive guards
   */
  public async executeSqlQuery(
    databaseId: string,
    userId: string | null,
    sql: string,
    confirmDestructive = false,
    environment?: string
  ): Promise<SqlQueryResult> {
    const resolvedEnv = environment ? DatabaseStudioService.validateEnvironment(environment) : null;
    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    if (resolvedEnv && database.environment && database.environment.toUpperCase() !== resolvedEnv) {
      throw new AppError(
        `Target environment mismatch: database is '${database.environment}', but query specified '${resolvedEnv}'`,
        403,
        "ENVIRONMENT_MISMATCH"
      );
    }

    const trimmed = sql.trim();
    if (!trimmed) throw new AppError("SQL query is empty", 400, "EMPTY_SQL");

    // Detect destructive operations
    const isDestructive = /\b(DROP|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE)\b/i.test(trimmed);

    if (isDestructive && !confirmDestructive && database.environment === "production") {
      throw new AppError(
        "Destructive query in production requires explicit confirmation",
        400,
        "DESTRUCTIVE_CONFIRMATION_REQUIRED"
      );
    }

    const schemaName = database.schemaName;
    const startTime = Date.now();
    let durationMs = 0;

    try {
      const res = await customerConnectionManager.querySchema(schemaName, trimmed);
      durationMs = Date.now() - startTime;

      const columns = res.fields ? res.fields.map((f) => f.name) : [];
      const rows = res.rows || [];
      const rowCount = res.rowCount || rows.length;

      // Log safely
      await db.forgeQueryLog.create({
        data: {
          databaseId,
          projectId: database.projectId,
          userId,
          query: trimmed.slice(0, 2000),
          durationMs,
          rowCount,
          status: "SUCCESS",
          isDestructive,
        },
      });

      return {
        columns,
        rows,
        rowCount,
        durationMs,
        isDestructive,
      };
    } catch (err: any) {
      durationMs = Date.now() - startTime;
      await db.forgeQueryLog.create({
        data: {
          databaseId,
          projectId: database.projectId,
          userId,
          query: trimmed.slice(0, 2000),
          durationMs,
          rowCount: 0,
          status: "ERROR",
          errorMessage: err.message || "Query execution failed",
          isDestructive,
        },
      });

      throw new AppError(`SQL Error: ${err.message}`, 400, "SQL_EXECUTION_ERROR");
    }
  }

  /**
   * Run EXPLAIN or EXPLAIN ANALYZE on a query
   */
  public async explainQuery(
    databaseId: string,
    sql: string,
    analyze = false
  ): Promise<ExplainPlanResult> {
    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    const schemaName = database.schemaName;
    const explainSql = analyze
      ? `EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`
      : `EXPLAIN (FORMAT JSON) ${sql}`;

    const res = await customerConnectionManager.querySchema(schemaName, explainSql);
    const planNode = res.rows[0]?.[0] || res.rows[0]?.["QUERY PLAN"]?.[0] || {};
    const root = planNode.Plan || planNode;

    const estimatedCost = root["Total Cost"] || 0;
    const actualDurationMs = root["Actual Total Time"] || undefined;
    const planStr = JSON.stringify(root);
    const usesIndexScan = planStr.includes("Index Scan");
    const warnings: string[] = [];

    if (planStr.includes("Seq Scan")) {
      warnings.push("Sequential scan detected. Consider adding an index to optimize filtering.");
    }

    return {
      plan: root,
      estimatedCost,
      actualDurationMs,
      usesIndexScan,
      warnings,
    };
  }

  /**
   * Get query history for a database
   */
  public async getQueryHistory(databaseId: string, limit = 50): Promise<QueryLogEntity[]> {
    return await db.forgeQueryLog.findMany({
      where: { databaseId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Seed a table with realistic mock rows
   */
  public async seedTableData(
    databaseId: string,
    tableName: string,
    count = 5
  ): Promise<{ inserted: number }> {
    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    let inserted = 0;
    for (let i = 1; i <= count; i++) {
      const sampleRow: Record<string, any> = {
        name: `Sample Item ${i}`,
        title: `Mock Title ${i}`,
        email: `user${i}_${Date.now()}@example.com`,
        status: i % 2 === 0 ? "active" : "pending",
        description: `Autogenerated mock record #${i} for ForgeStudio testing`,
        created_at: new Date(),
      };

      try {
        await this.insertRow(databaseId, tableName, sampleRow);
        inserted++;
      } catch (err) {
        // Fallback for custom columns
        break;
      }
    }

    return { inserted };
  }

  /**
   * Export table data as CSV or JSON
   */
  public async exportTableData(
    databaseId: string,
    tableName: string,
    format: "json" | "csv" = "json"
  ): Promise<{ data: string; contentType: string; fileName: string }> {
    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    const qTable = customerConnectionManager.quoteIdent(tableName);
    const res = await customerConnectionManager.querySchema(
      database.schemaName,
      `SELECT * FROM ${qTable} LIMIT 1000;`
    );

    if (format === "csv") {
      const rows = res.rows;
      if (rows.length === 0) {
        return { data: "", contentType: "text/csv", fileName: `${tableName}.csv` };
      }
      const headers = Object.keys(rows[0]);
      const csvLines = [headers.join(",")];
      for (const row of rows) {
        const line = headers.map((h) => JSON.stringify(row[h] ?? "")).join(",");
        csvLines.push(line);
      }
      return {
        data: csvLines.join("\n"),
        contentType: "text/csv",
        fileName: `${tableName}.csv`,
      };
    }

    return {
      data: JSON.stringify(res.rows, null, 2),
      contentType: "application/json",
      fileName: `${tableName}.json`,
    };
  }
}

export const databaseStudioService = new DatabaseStudioService();
