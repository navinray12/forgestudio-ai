/**
 * ForgeStudio Module 54: Developer Observability Types
 */

export type LogSource = "RUNTIME" | "BUILD" | "FUNCTION" | "DEPLOYMENT" | "GATEWAY" | "CLIENT";
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
export type IssueStatus = "UNRESOLVED" | "RESOLVED" | "IGNORED";

export interface ObservabilityLog {
  id: string;
  projectId: string;
  environment: string;
  source: LogSource;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  traceId?: string | null;
  spanId?: string | null;
  timestamp: string;
}

export interface ObservabilitySpan {
  id: string;
  projectId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  name: string;
  service: string;
  durationMs: number;
  status: "OK" | "ERROR" | "TIMEOUT";
  attributes: Record<string, any>;
  events: Array<{ name: string; timestamp: string; attributes?: Record<string, any> }>;
  timestamp: string;
}

export interface ObservabilityIssue {
  id: string;
  projectId: string;
  fingerprint: string;
  title: string;
  type: string;
  status: IssueStatus;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  sampleStack?: string | null;
  sampleMetadata?: Record<string, any>;
}

export interface ApmMetrics {
  timestamp: string;
  uptimeSeconds: number;
  memoryUsageMb: number;
  cpuPercent: number;
  requestsPerSecond: number;
  errorRatePercent: number;
  latencyMs: {
    avg: number;
    p50: number;
    p90: number;
    p99: number;
  };
  totalLogsCount: number;
  openIssuesCount: number;
}

export interface QueryLogsFilter {
  environment?: string;
  source?: LogSource;
  level?: LogLevel;
  traceId?: string;
  search?: string;
  limit?: number;
}
