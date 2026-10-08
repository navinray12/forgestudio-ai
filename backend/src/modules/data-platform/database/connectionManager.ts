/**
 * ForgeStudio Module 25: Customer Database Connection Manager
 * Manages connection pools, schema-isolated search paths, and transaction lifecycles.
 */

import pg from "pg";
import { pgPool } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";

export class CustomerConnectionManager {
  private activePools: Map<string, pg.Pool> = new Map();

  /**
   * Quote and sanitize a SQL identifier (table, column, schema name)
   */
  public quoteIdent(ident: string): string {
    if (!ident || typeof ident !== "string") {
      throw new AppError("Invalid SQL identifier", 400, "INVALID_SQL_IDENTIFIER");
    }
    // Reject identifiers containing null bytes or unsafe control chars
    if (/[\0\r\n]/.test(ident)) {
      throw new AppError("Identifier contains illegal characters", 400, "INVALID_SQL_IDENTIFIER");
    }
    return `"${ident.replace(/"/g, '""')}"`;
  }

  /**
   * Acquire a connection and execute within the customer's isolated schema
   */
  public async executeInSchema<T>(
    schemaName: string,
    callback: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    if (!schemaName) {
      throw new AppError("Schema name is required", 400, "INVALID_SCHEMA_NAME");
    }

    const client = await pgPool.connect();
    try {
      // Set the isolated search_path for this connection
      const quotedSchema = this.quoteIdent(schemaName);
      await client.query(`SET search_path = ${quotedSchema}, public;`);
      await client.query(`SET statement_timeout = 30000;`); // 30s max query execution

      return await callback(client);
    } finally {
      // Reset search_path before returning connection to pool
      try {
        await client.query(`RESET search_path;`);
        await client.query(`RESET statement_timeout;`);
      } catch {}
      client.release();
    }
  }

  /**
   * Execute a single parameterized query directly in the customer's schema
   */
  public async querySchema<T extends pg.QueryResultRow = any>(
    schemaName: string,
    queryText: string,
    params: any[] = []
  ): Promise<pg.QueryResult<T>> {
    return this.executeInSchema(schemaName, async (client) => {
      return await client.query<T>(queryText, params);
    });
  }

  /**
   * Execute multiple statements within an atomic transaction with automatic rollback
   */
  public async executeTransactionInSchema<T>(
    schemaName: string,
    callback: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    return this.executeInSchema(schemaName, async (client) => {
      await client.query("BEGIN;");
      try {
        const result = await callback(client);
        await client.query("COMMIT;");
        return result;
      } catch (err) {
        await client.query("ROLLBACK;");
        throw err;
      }
    });
  }

  /**
   * Initialize a new isolated schema for a project environment
   */
  public async initializeCustomerSchema(schemaName: string): Promise<void> {
    const quoted = this.quoteIdent(schemaName);
    const client = await pgPool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoted};`);

      // Initialize internal migration metadata table inside the customer's schema
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${quoted}._forge_migrations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL UNIQUE,
          checksum VARCHAR(64) NOT NULL,
          execution_time_ms INTEGER NOT NULL DEFAULT 0,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Drop an entire isolated schema (used on database teardown)
   */
  public async dropCustomerSchema(schemaName: string): Promise<void> {
    const quoted = this.quoteIdent(schemaName);
    const client = await pgPool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE;`);
    } finally {
      client.release();
    }
  }
}

export const customerConnectionManager = new CustomerConnectionManager();
