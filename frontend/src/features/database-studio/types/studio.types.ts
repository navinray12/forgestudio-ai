export interface TableSummary {
  name: string;
  columnCount: number;
  estimatedRowCount: number;
  primaryKeys: string[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  isNullable?: boolean;
  defaultValue?: string | null;
  isPrimaryKey?: boolean;
}

export interface ColumnDetail {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export interface TableForeignKey {
  columnName: string;
  foreignTable: string;
  foreignColumn: string;
  constraintName: string;
}

export interface TableIndex {
  name: string;
  definition: string;
}

export interface TableDetails {
  name: string;
  columns: ColumnDetail[];
  indexes: TableIndex[];
  foreignKeys: TableForeignKey[];
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

export interface QueryResult {
  rows: Record<string, any>[];
  fields: { name: string; dataTypeId: number }[];
  rowCount: number;
  durationMs: number;
}

export interface MigrationRecord {
  id: string;
  migrationName: string;
  batchNumber: number;
  sqlScript: string;
  executionTimeMs: number;
  appliedAt: string;
}

export interface DatabaseStatus {
  provisioned: boolean;
  data: {
    id?: string;
    status?: string;
    environment?: string;
    host?: string;
    port?: number;
    dbName?: string;
    dbUser?: string;
    connectionStringTemplate?: string;
    storageSizeBytes?: string;
    activeConnectionsInPool?: number;
    lastBackupAt?: string | null;
  } | null;
}

export type StudioEnvironment = "DEVELOPMENT" | "PREVIEW" | "PRODUCTION";
