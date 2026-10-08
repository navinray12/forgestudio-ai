/**
 * ForgeStudio Module 27: Data / API Layer Types
 */

export interface ApiConfigEntity {
  id: string;
  databaseId: string;
  projectId: string;
  tableName: string;
  isExposed: boolean;
  allowedOperations: Array<"GET" | "POST" | "PATCH" | "DELETE">;
  requireAuth: boolean;
  rateLimitPerMin: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface GeneratedApiEndpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  tableName: string;
  summary: string;
  requireAuth: boolean;
}

export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
}

export interface TypedClientOutput {
  typescriptCode: string;
  typesDefinition: string;
  tableNames: string[];
}
