import { request } from "./request";

/**
 * Database studio: databases and branches, tables and schema, backups, metrics, migrations, table data and
 * SQL queries.
 * Methods moved verbatim from forgeProjectService.ts (forgeProjectService); the facade there exposes them
 * under the same names and in the original order.
 */
export const databaseRequests = {

  // ==========================================
  // Forge Data Platform (Modules 25–28)
  // ==========================================

  // Module 25: Forge Database
  async getDatabase(projectId: string, environment = "development"): Promise<{ success: boolean; database: any }> {
    return request<{ success: boolean; database: any }>(`/${projectId}/database?environment=${environment}`);
  },

  async listDatabases(projectId: string): Promise<{ success: boolean; databases: any[] }> {
    return request<{ success: boolean; databases: any[] }>(`/${projectId}/database/list`);
  },

  async branchDatabase(
    projectId: string,
    parentEnv: string,
    branchName: string
  ): Promise<{ success: boolean; database: any }> {
    return request<{ success: boolean; database: any }>(`/${projectId}/database/branch`, {
      method: "POST",
      body: JSON.stringify({ parentEnv, branchName }),
    });
  },

  async listDatabaseTables(projectId: string, databaseId: string): Promise<{ success: boolean; tables: any[] }> {
    return request<{ success: boolean; tables: any[] }>(`/${projectId}/database/${databaseId}/tables`);
  },

  async getTableSchema(
    projectId: string,
    databaseId: string,
    tableName: string
  ): Promise<{ success: boolean; schema: any }> {
    return request<{ success: boolean; schema: any }>(`/${projectId}/database/${databaseId}/tables/${tableName}/schema`);
  },

  async createTable(
    projectId: string,
    databaseId: string,
    payload: any
  ): Promise<{ success: boolean; schema: any }> {
    return request<{ success: boolean; schema: any }>(`/${projectId}/database/${databaseId}/tables`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async alterTable(
    projectId: string,
    databaseId: string,
    tableName: string,
    payload: any
  ): Promise<{ success: boolean; schema: any }> {
    return request<{ success: boolean; schema: any }>(`/${projectId}/database/${databaseId}/tables/${tableName}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async dropTable(
    projectId: string,
    databaseId: string,
    tableName: string,
    confirmed = true
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/database/${databaseId}/tables/${tableName}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmed }),
    });
  },

  async introspectDatabaseSchema(
    projectId: string,
    databaseId: string
  ): Promise<{ success: boolean; schema: { tables: any[] } }> {
    return request<{ success: boolean; schema: { tables: any[] } }>(`/${projectId}/database/${databaseId}/introspect`);
  },

  async createDatabaseBackup(
    projectId: string,
    databaseId: string,
    name?: string
  ): Promise<{ success: boolean; backup: any }> {
    return request<{ success: boolean; backup: any }>(`/${projectId}/database/${databaseId}/backups`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async listDatabaseBackups(projectId: string, databaseId: string): Promise<{ success: boolean; backups: any[] }> {
    return request<{ success: boolean; backups: any[] }>(`/${projectId}/database/${databaseId}/backups`);
  },

  async restoreDatabaseBackup(
    projectId: string,
    databaseId: string,
    backupId: string
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/database/${databaseId}/backups/${backupId}/restore`, {
      method: "POST",
    });
  },

  async getDatabaseMetrics(projectId: string, databaseId: string): Promise<{ success: boolean; metrics: any }> {
    return request<{ success: boolean; metrics: any }>(`/${projectId}/database/${databaseId}/metrics`);
  },

  async listDatabaseMigrations(projectId: string, databaseId: string): Promise<{ success: boolean; migrations: any[] }> {
    return request<{ success: boolean; migrations: any[] }>(`/${projectId}/database/${databaseId}/migrations`);
  },

  async applyDatabaseMigration(
    projectId: string,
    databaseId: string,
    migrationId: string
  ): Promise<{ success: boolean; migration: any }> {
    return request<{ success: boolean; migration: any }>(
      `/${projectId}/database/${databaseId}/migrations/${migrationId}/apply`,
      { method: "POST" }
    );
  },

  async rollbackDatabaseMigration(
    projectId: string,
    databaseId: string,
    migrationId: string
  ): Promise<{ success: boolean; migration: any }> {
    return request<{ success: boolean; migration: any }>(
      `/${projectId}/database/${databaseId}/migrations/${migrationId}/rollback`,
      { method: "POST" }
    );
  },

  // Module 26: Database Studio
  async getTableData(
    projectId: string,
    databaseId: string,
    tableName: string,
    params: any = {}
  ): Promise<{ success: boolean; data: any }> {
    const qs = new URLSearchParams(params).toString();
    return request<{ success: boolean; data: any }>(
      `/${projectId}/database/${databaseId}/tables/${tableName}/data?${qs}`
    );
  },

  async insertTableRow(
    projectId: string,
    databaseId: string,
    tableName: string,
    row: any
  ): Promise<{ success: boolean; row: any }> {
    return request<{ success: boolean; row: any }>(
      `/${projectId}/database/${databaseId}/tables/${tableName}/data`,
      { method: "POST", body: JSON.stringify(row) }
    );
  },

  async updateTableRow(
    projectId: string,
    databaseId: string,
    tableName: string,
    pkField: string,
    pkValue: any,
    changes: any
  ): Promise<{ success: boolean; row: any }> {
    return request<{ success: boolean; row: any }>(
      `/${projectId}/database/${databaseId}/tables/${tableName}/data`,
      { method: "PATCH", body: JSON.stringify({ pkField, pkValue, changes }) }
    );
  },

  async deleteTableRow(
    projectId: string,
    databaseId: string,
    tableName: string,
    pkField: string,
    pkValue: any
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/${projectId}/database/${databaseId}/tables/${tableName}/data`,
      { method: "DELETE", body: JSON.stringify({ pkField, pkValue }) }
    );
  },

  async executeSqlQuery(
    projectId: string,
    databaseId: string,
    sql: string,
    confirmDestructive = false
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/database/${databaseId}/sql`, {
      method: "POST",
      body: JSON.stringify({ sql, confirmDestructive }),
    });
  },

  async explainSqlQuery(
    projectId: string,
    databaseId: string,
    sql: string,
    analyze = false
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/database/${databaseId}/explain`, {
      method: "POST",
      body: JSON.stringify({ sql, analyze }),
    });
  },

  async getQueryHistory(projectId: string, databaseId: string): Promise<{ success: boolean; history: any[] }> {
    return request<{ success: boolean; history: any[] }>(`/${projectId}/database/${databaseId}/history`);
  },

  async seedTableData(
    projectId: string,
    databaseId: string,
    tableName: string,
    count = 5
  ): Promise<{ success: boolean; result: { inserted: number } }> {
    return request<{ success: boolean; result: { inserted: number } }>(
      `/${projectId}/database/${databaseId}/tables/${tableName}/seed`,
      { method: "POST", body: JSON.stringify({ count }) }
    );
  },
};
