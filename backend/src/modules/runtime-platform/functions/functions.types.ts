/**
 * Module 46: Serverless & Edge Functions Types
 */

export interface ServerlessFunctionConfig {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  description?: string;
  runtime: "nodejs20" | "edge";
  handler: string;
  code: string;
  environment: "development" | "preview" | "staging" | "production";
  envVars: Record<string, string>;
  timeoutMs: number;
  memoryMb: number;
  status: "ACTIVE" | "INACTIVE" | "DEPLOYING" | "FAILED";
  createdAt: string;
  updatedAt: string;
}

export interface CreateFunctionDto {
  name: string;
  description?: string;
  runtime?: "nodejs20" | "edge";
  handler?: string;
  code: string;
  environment?: "development" | "preview" | "staging" | "production";
  envVars?: Record<string, string>;
  timeoutMs?: number;
  memoryMb?: number;
}

export interface UpdateFunctionDto {
  description?: string;
  code?: string;
  envVars?: Record<string, string>;
  timeoutMs?: number;
  memoryMb?: number;
  status?: "ACTIVE" | "INACTIVE";
}

export interface FunctionInvocationContext {
  projectId: string;
  functionName: string;
  environment: string;
  trigger: "HTTP" | "EVENT" | "QUEUE" | "CRON" | "MANUAL";
  requestId: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  query?: Record<string, string>;
  env: Record<string, string>;
}

export interface FunctionInvocationResult {
  invocationId: string;
  functionId: string;
  status: "SUCCESS" | "ERROR" | "TIMEOUT";
  durationMs: number;
  statusCode?: number;
  responsePayload: any;
  logs: string[];
  error?: string;
  createdAt: string;
}
