/**
 * ForgeStudio Module 25: Forge Database Types
 */

export type DatabaseEnvironment = "development" | "preview" | "staging" | "production";

export type DatabaseStatus =
  | "PROVISIONING"
  | "READY"
  | "DEGRADED"
  | "SUSPENDED"
  | "FAILED"
  | "DELETING";

export interface CustomerDatabaseEntity {
  id: string;
  projectId: string;
  environment: DatabaseEnvironment;
  status: DatabaseStatus;
  engine: string;
  engineVersion: string;
  databaseName: string;
  schemaName: string;
  connectionUrlEncrypted?: string;
  maxConnections: number;
  storageLimitBytes: number;
  storageUsedBytes: number;
  isBranch: boolean;
  parentDatabaseId?: string | null;
  branchName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ColumnDefinition {
  name: string;
  type: string; // e.g. text, integer, varchar(255), boolean, timestamptz, jsonb, uuid
  nullable: boolean;
  defaultValue?: string | null;
  isPrimaryKey?: boolean;
  isUnique?: boolean;
  isGenerated?: boolean;
  generationExpression?: string | null;
  comment?: string;
}

export interface ConstraintDefinition {
  name: string;
  type: "PRIMARY_KEY" | "FOREIGN_KEY" | "UNIQUE" | "CHECK";
  columns: string[];
  foreignTable?: string;
  foreignColumns?: string[];
  onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  checkClause?: string;
}

export interface IndexDefinition {
  name: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  method: "btree" | "hash" | "gin" | "gist";
  sizeBytes?: number;
}

export interface RelationshipDefinition {
  id: string;
  sourceTable: string;
  sourceColumns: string[];
  targetTable: string;
  targetColumns: string[];
  cardinality: "ONE_TO_ONE" | "ONE_TO_MANY" | "MANY_TO_MANY";
  constraintName: string;
  onDelete: string;
}

export interface TableSchema {
  name: string;
  schemaName: string;
  rowCount: number;
  sizeBytes: number;
  columns: ColumnDefinition[];
  constraints: ConstraintDefinition[];
  indexes: IndexDefinition[];
  relationships: RelationshipDefinition[];
  comment?: string;
}

export interface CreateTableRequest {
  tableName: string;
  columns: ColumnDefinition[];
  constraints?: ConstraintDefinition[];
  indexes?: IndexDefinition[];
  comment?: string;
}

export interface AlterTableRequest {
  renameTable?: string;
  addColumns?: ColumnDefinition[];
  dropColumns?: string[];
  renameColumns?: Array<{ oldName: string; newName: string }>;
  alterColumnTypes?: Array<{ column: string; newType: string }>;
  addConstraints?: ConstraintDefinition[];
  dropConstraints?: string[];
  addIndexes?: IndexDefinition[];
  dropIndexes?: string[];
}

export interface MigrationRecord {
  id: string;
  databaseId: string;
  projectId: string;
  name: string;
  upSql: string;
  downSql?: string | null;
  checksum: string;
  status: "PENDING" | "APPLIED" | "FAILED" | "ROLLED_BACK";
  executionTimeMs: number;
  errorMessage?: string | null;
  appliedAt?: string | null;
  createdAt: string;
}

export interface BackupRecord {
  id: string;
  databaseId: string;
  projectId: string;
  name: string;
  backupType: "MANUAL" | "AUTOMATED";
  status: "CREATING" | "COMPLETED" | "FAILED" | "RESTORED";
  sizeBytes: number;
  schemaDdl: string;
  dataJson: Record<string, any[]>;
  checksum: string;
  createdAt: string;
}

export interface DatabaseUsageStats {
  databaseId: string;
  environment: string;
  status: string;
  tableCount: number;
  totalRowCount: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  storageUsedPercentage: number;
  activeConnections: number;
  maxConnections: number;
  queryCountLast24h: number;
  avgLatencyMs: number;
  slowQueryCount: number;
  migrationsCount: number;
  backupsCount: number;
}
