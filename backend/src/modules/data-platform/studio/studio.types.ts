/**
 * ForgeStudio Module 26: Database Studio Types
 */

export interface SqlQueryRequest {
  sql: string;
  confirmDestructive?: boolean;
}

export interface SqlQueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  durationMs: number;
  isDestructive: boolean;
  error?: string | null;
}

export interface TableDataFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is_null" | "is_not_null";
  value?: any;
}

export interface TableDataQuery {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  filters?: TableDataFilter[];
  search?: string;
}

export interface TableDataResult {
  tableName: string;
  columns: string[];
  rows: any[];
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ExplainPlanResult {
  plan: any;
  estimatedCost: number;
  actualDurationMs?: number;
  usesIndexScan: boolean;
  warnings: string[];
}

export interface QueryLogEntity {
  id: string;
  databaseId: string;
  projectId: string;
  userId?: string | null;
  query: string;
  durationMs: number;
  rowCount: number;
  status: "SUCCESS" | "ERROR";
  errorMessage?: string | null;
  isDestructive: boolean;
  createdAt: string;
}
