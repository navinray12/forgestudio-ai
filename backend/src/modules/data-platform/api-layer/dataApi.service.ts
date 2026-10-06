/**
 * ForgeStudio Module 27: Data / API Layer Service
 * Exposes configurable REST APIs for customer tables, OpenAPI 3.0 specifications, and typed clients.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { forgeDatabaseService } from "../database/forgeDatabase.service.js";
import { databaseStudioService } from "../studio/databaseStudio.service.js";
import {
  ApiConfigEntity,
  GeneratedApiEndpoint,
  OpenApiDocument,
  TypedClientOutput,
} from "./apiLayer.types.js";

const db = prisma as any;

export class DataApiService {
  /**
   * Get or initialize API exposure configuration for all tables
   */
  public async getApiConfigs(databaseId: string, projectId: string): Promise<ApiConfigEntity[]> {
    const tables = await forgeDatabaseService.listTables(databaseId);
    const existing = await db.forgeApiConfig.findMany({ where: { databaseId } });
    const existingMap = new Map(existing.map((e: any) => [e.tableName, e]));

    const configs: ApiConfigEntity[] = [];
    for (const t of tables) {
      if (existingMap.has(t.name)) {
        configs.push(existingMap.get(t.name)!);
      } else {
        // Auto-create default config
        const created = await db.forgeApiConfig.create({
          data: {
            databaseId,
            projectId,
            tableName: t.name,
            isExposed: true,
            allowedOperations: ["GET", "POST", "PATCH", "DELETE"],
            requireAuth: true,
            rateLimitPerMin: 120,
          },
        });
        configs.push(created);
      }
    }

    return configs;
  }

  /**
   * Update table API exposure settings
   */
  public async updateApiConfig(
    databaseId: string,
    tableName: string,
    updates: Partial<ApiConfigEntity>
  ): Promise<ApiConfigEntity> {
    const existing = await db.forgeApiConfig.findFirst({
      where: { databaseId, tableName },
    });
    if (!existing) throw new AppError("API config not found for table", 404, "CONFIG_NOT_FOUND");

    const updated = await db.forgeApiConfig.update({
      where: { id: existing.id },
      data: {
        isExposed: updates.isExposed !== undefined ? updates.isExposed : existing.isExposed,
        allowedOperations: updates.allowedOperations || existing.allowedOperations,
        requireAuth: updates.requireAuth !== undefined ? updates.requireAuth : existing.requireAuth,
        rateLimitPerMin: updates.rateLimitPerMin || existing.rateLimitPerMin,
      },
    });

    return updated;
  }

  /**
   * Validate table access permissions for incoming API request
   */
  public async validateAccess(
    databaseId: string,
    tableName: string,
    operation: "GET" | "POST" | "PATCH" | "DELETE"
  ): Promise<void> {
    const config = await db.forgeApiConfig.findFirst({
      where: { databaseId, tableName },
    });

    if (config && (!config.isExposed || !config.allowedOperations.includes(operation))) {
      throw new AppError(
        `Operation '${operation}' on table '${tableName}' is not permitted by API configuration`,
        403,
        "API_OPERATION_FORBIDDEN"
      );
    }
  }

  /**
   * Handle REST GET /data/:tableName (List Rows)
   */
  public async handleListRows(databaseId: string, tableName: string, queryParams: any) {
    await this.validateAccess(databaseId, tableName, "GET");

    const page = parseInt(queryParams.page) || 1;
    const pageSize = parseInt(queryParams.limit) || parseInt(queryParams.pageSize) || 25;
    const sortField = queryParams.sort;
    const sortOrder = queryParams.order === "desc" ? "desc" : "asc";

    // Extract filters
    const filters: any[] = [];
    if (queryParams.filter && typeof queryParams.filter === "object") {
      for (const [key, val] of Object.entries(queryParams.filter)) {
        filters.push({ field: key, operator: "eq", value: val });
      }
    }

    return await databaseStudioService.getTableData(databaseId, tableName, {
      page,
      pageSize,
      sortField,
      sortOrder,
      filters,
    });
  }

  /**
   * Handle REST GET /data/:tableName/:id (Get Single Row)
   */
  public async handleGetRow(databaseId: string, tableName: string, id: string) {
    await this.validateAccess(databaseId, tableName, "GET");

    const data = await databaseStudioService.getTableData(databaseId, tableName, {
      page: 1,
      pageSize: 1,
      filters: [{ field: "id", operator: "eq", value: id }],
    });

    if (data.rows.length === 0) {
      throw new AppError(`Record with id '${id}' not found`, 404, "RECORD_NOT_FOUND");
    }

    return data.rows[0];
  }

  /**
   * Handle REST POST /data/:tableName (Create Row)
   */
  public async handleCreateRow(databaseId: string, tableName: string, body: Record<string, any>) {
    await this.validateAccess(databaseId, tableName, "POST");
    return await databaseStudioService.insertRow(databaseId, tableName, body);
  }

  /**
   * Handle REST PATCH /data/:tableName/:id (Update Row)
   */
  public async handleUpdateRow(
    databaseId: string,
    tableName: string,
    id: string,
    body: Record<string, any>
  ) {
    await this.validateAccess(databaseId, tableName, "PATCH");
    return await databaseStudioService.updateRow(databaseId, tableName, "id", id, body);
  }

  /**
   * Handle REST DELETE /data/:tableName/:id (Delete Row)
   */
  public async handleDeleteRow(databaseId: string, tableName: string, id: string) {
    await this.validateAccess(databaseId, tableName, "DELETE");
    return await databaseStudioService.deleteRow(databaseId, tableName, "id", id);
  }

  /**
   * Generate complete OpenAPI 3.0 Schema Specification for the project
   */
  public async generateOpenApiSpec(projectId: string, databaseId: string): Promise<OpenApiDocument> {
    const project = await db.forgeProject.findUnique({ where: { id: projectId } });
    const fullSchema = await forgeDatabaseService.introspectSchema(databaseId);
    const configs = await this.getApiConfigs(databaseId, projectId);
    const configMap = new Map(configs.map((c) => [c.tableName, c]));

    const paths: Record<string, any> = {};
    const schemas: Record<string, any> = {};

    for (const table of fullSchema.tables) {
      const cfg = configMap.get(table.name);
      if (cfg && !cfg.isExposed) continue;

      // Model Schema
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const col of table.columns) {
        let typeStr = "string";
        if (col.type.includes("int") || col.type.includes("numeric")) typeStr = "number";
        if (col.type.includes("bool")) typeStr = "boolean";
        if (col.type.includes("json")) typeStr = "object";

        properties[col.name] = { type: typeStr };
        if (!col.nullable && !col.defaultValue) required.push(col.name);
      }

      schemas[table.name] = {
        type: "object",
        properties,
        required: required.length > 0 ? required : undefined,
      };

      const tablePath = `/api/v1/projects/${projectId}/data/${table.name}`;
      const itemPath = `/api/v1/projects/${projectId}/data/${table.name}/{id}`;

      paths[tablePath] = {
        get: {
          summary: `List ${table.name} records`,
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 25 } },
            { name: "sort", in: "query", schema: { type: "string" } },
          ],
          responses: {
            200: {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      rows: { type: "array", items: { $ref: `#/components/schemas/${table.name}` } },
                      totalRows: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: `Create a new ${table.name} record`,
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: `#/components/schemas/${table.name}` } },
            },
          },
          responses: {
            201: { description: "Created" },
          },
        },
      };

      paths[itemPath] = {
        get: {
          summary: `Get single ${table.name} record by ID`,
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Found" }, 404: { description: "Not found" } },
        },
        patch: {
          summary: `Update ${table.name} record`,
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: { 200: { description: "Updated" } },
        },
        delete: {
          summary: `Delete ${table.name} record`,
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Deleted" } },
        },
      };
    }

    return {
      openapi: "3.0.3",
      info: {
        title: `${project?.name || "Forge Project"} Data API`,
        version: "1.0.0",
        description: "Autogenerated typed REST API layer powered by Forge Data Platform",
      },
      servers: [{ url: "http://localhost:5000", description: "Current Forge API Server" }],
      paths,
      components: {
        schemas,
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    };
  }

  /**
   * Generate strongly typed TypeScript client SDK
   */
  public async generateTypedClient(projectId: string, databaseId: string): Promise<TypedClientOutput> {
    const fullSchema = await forgeDatabaseService.introspectSchema(databaseId);
    const tableNames = fullSchema.tables.map((t) => t.name);

    let typesDefinition = `/**
 * Autogenerated ForgeStudio Typed Data Schema
 * Project ID: ${projectId}
 */\n\n`;

    for (const table of fullSchema.tables) {
      const typeName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
      typesDefinition += `export interface ${typeName} {\n`;
      for (const col of table.columns) {
        let tsType = "string";
        if (col.type.includes("int") || col.type.includes("numeric")) tsType = "number";
        if (col.type.includes("bool")) tsType = "boolean";
        if (col.type.includes("json")) tsType = "Record<string, any>";
        const opt = col.nullable ? "?" : "";
        typesDefinition += `  ${col.name}${opt}: ${tsType};\n`;
      }
      typesDefinition += `}\n\n`;
    }

    let typescriptCode = `${typesDefinition}
export class ForgeDataClient {
  private baseUrl: string;
  private token?: string;

  constructor(options: { baseUrl?: string; token?: string } = {}) {
    this.baseUrl = options.baseUrl || "/api/v1/projects/${projectId}/data";
    this.token = options.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = \`Bearer \${this.token}\`;

    const res = await fetch(\`\${this.baseUrl}\${path}\`, { ...options, headers });
    if (!res.ok) throw new Error(\`Data API Error: \${res.statusText}\`);
    return await res.json();
  }

${tableNames
  .map((name) => {
    const model = name.charAt(0).toUpperCase() + name.slice(1);
    return `  public ${name} = {
    list: (params?: { page?: number; limit?: number }) => 
      this.request<{ rows: ${model}[]; totalRows: number }>("/${name}"),
    get: (id: string) => 
      this.request<${model}>(\`/${name}/\${id}\`),
    create: (data: Partial<${model}>) => 
      this.request<${model}>("/${name}", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<${model}>) => 
      this.request<${model}>(\`/${name}/\${id}\`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => 
      this.request<{ success: boolean }>(\`/${name}/\${id}\`, { method: "DELETE" }),
  };`;
  })
  .join("\n\n")}
}
`;

    return {
      typescriptCode,
      typesDefinition,
      tableNames,
    };
  }
}

export const dataApiService = new DataApiService();
