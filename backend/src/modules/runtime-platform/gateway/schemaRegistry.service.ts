/**
 * Module 52: Schema Registry Service
 * Validates request/response contracts and event payloads against registered schemas.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { SchemaRegistryRecord } from "./gateway.types.js";

export class SchemaRegistryService {
  /**
   * Register a new schema or new version
   */
  public async registerSchema(
    projectId: string,
    name: string,
    version: string,
    schemaDefinition: any,
    schemaType: "JSON_SCHEMA" | "OPENAPI" | "TYPESCRIPT" = "JSON_SCHEMA"
  ): Promise<SchemaRegistryRecord> {
    const existing = await (prisma as any).forgeSchemaRegistry.findFirst({
      where: { projectId, name, version },
    });

    if (existing) {
      return (prisma as any).forgeSchemaRegistry.update({
        where: { id: existing.id },
        data: { schemaDefinition, schemaType, updatedAt: new Date() },
      });
    }

    return (prisma as any).forgeSchemaRegistry.create({
      data: {
        projectId,
        name,
        version,
        schemaType,
        schemaDefinition,
      },
    });
  }

  /**
   * List schemas for a project
   */
  public async listSchemas(projectId: string): Promise<SchemaRegistryRecord[]> {
    return (prisma as any).forgeSchemaRegistry.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get schema by ID or name & version
   */
  public async getSchema(
    projectId: string,
    schemaIdOrName: string,
    version = "v1"
  ): Promise<SchemaRegistryRecord> {
    const schema = await (prisma as any).forgeSchemaRegistry.findFirst({
      where: {
        projectId,
        OR: [
          { id: schemaIdOrName },
          { name: schemaIdOrName, version },
        ],
      },
    });

    if (!schema) {
      throw new AppError(`Schema '${schemaIdOrName}' not found`, 404);
    }

    return schema;
  }

  /**
   * Validate a payload against a registered JSON schema
   */
  public validatePayload(
    schemaDefinition: any,
    payload: any
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!schemaDefinition || typeof schemaDefinition !== "object") {
      return { valid: true, errors: [] };
    }

    // Check required properties
    if (Array.isArray(schemaDefinition.required)) {
      for (const reqProp of schemaDefinition.required) {
        if (payload === undefined || payload === null || payload[reqProp] === undefined) {
          errors.push(`Missing required field: '${reqProp}'`);
        }
      }
    }

    // Check property types
    if (schemaDefinition.properties && typeof payload === "object" && payload !== null) {
      for (const [prop, spec] of Object.entries<any>(schemaDefinition.properties)) {
        const val = payload[prop];
        if (val === undefined) continue;

        if (spec.type === "string" && typeof val !== "string") {
          errors.push(`Field '${prop}' must be a string, got ${typeof val}`);
        } else if (spec.type === "number" && typeof val !== "number") {
          errors.push(`Field '${prop}' must be a number, got ${typeof val}`);
        } else if (spec.type === "boolean" && typeof val !== "boolean") {
          errors.push(`Field '${prop}' must be a boolean, got ${typeof val}`);
        } else if (spec.type === "array" && !Array.isArray(val)) {
          errors.push(`Field '${prop}' must be an array`);
        } else if (spec.type === "object" && (typeof val !== "object" || Array.isArray(val) || val === null)) {
          errors.push(`Field '${prop}' must be an object`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const schemaRegistryService = new SchemaRegistryService();
