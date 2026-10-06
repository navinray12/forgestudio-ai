/**
 * Module 52: API Gateway & Schema Registry Types
 */

export interface SchemaRegistryRecord {
  id: string;
  projectId: string;
  name: string;
  version: string;
  schemaType: "JSON_SCHEMA" | "OPENAPI" | "TYPESCRIPT";
  schemaDefinition: any;
  createdAt: string;
  updatedAt: string;
}

export interface ApiGatewayRouteConfig {
  id: string;
  projectId: string;
  path: string;
  method: string;
  targetType: "FUNCTION" | "DATA_API" | "STATIC" | "PROXY";
  targetDestination: string;
  requireAuth: boolean;
  rateLimitPerMin: number;
  corsOrigins: string[];
  requestSchemaId?: string;
  responseSchemaId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRouteDto {
  path: string;
  method?: string;
  targetType: "FUNCTION" | "DATA_API" | "STATIC" | "PROXY";
  targetDestination: string;
  requireAuth?: boolean;
  rateLimitPerMin?: number;
  corsOrigins?: string[];
  requestSchemaId?: string;
  responseSchemaId?: string;
}

export interface GatewayInvocationResult {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  durationMs: number;
  routedTo: string;
}
