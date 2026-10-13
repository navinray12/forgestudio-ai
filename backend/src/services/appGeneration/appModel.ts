/**
 * Application model contract for full-stack generation (blueprint §33, §38, §39).
 *
 * The AI provider must return an AppModel; nothing it returns is trusted until validateAppModel
 * accepts it. Approved templates produce the same contract deterministically and are labelled as
 * templates, never as AI output.
 */
import crypto from "node:crypto";
import type {
  ApplicationSpec,
  ApplicationEntity,
  ApplicationOperation,
} from "../authoritative/applicationSpec.service.js";

export const APP_FIELD_TYPES = ["string", "text", "integer", "number", "boolean", "datetime"] as const;
export type AppFieldType = (typeof APP_FIELD_TYPES)[number];

export interface AppModelField {
  name: string;
  type: AppFieldType;
  required: boolean;
  description: string;
}

export interface AppModelEntity {
  name: string;
  description: string;
  fields: AppModelField[];
}

export interface AppModel {
  applicationName: string;
  entities: AppModelEntity[];
}

export const MAX_ENTITIES = 8;
export const MAX_FIELDS_PER_ENTITY = 25;

/** Columns the platform owns; a model may not declare them. */
const SERVER_OWNED_FIELDS = new Set(["id", "tenantid", "createdat", "updatedat", "deletedat"]);
const RESERVED_ENTITY_NAMES = new Set([
  "Object", "Array", "String", "Number", "Boolean", "Date", "Error", "Function", "Promise", "Map", "Set",
  "Record", "Request", "Response", "Router", "Prisma", "PrismaClient", "Tenant", "User",
]);
const ENTITY_NAME = /^[A-Z][A-Za-z0-9]{1,39}$/;
const FIELD_NAME = /^[a-z][A-Za-z0-9]{0,39}$/;

/** Strict JSON schema sent to the provider (compatible with strict structured-output modes). */
export const APP_MODEL_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["applicationName", "entities"],
  properties: {
    applicationName: { type: "string", description: "Short human-readable application name" },
    entities: {
      type: "array",
      minItems: 1,
      maxItems: MAX_ENTITIES,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "fields"],
        properties: {
          name: { type: "string", description: "PascalCase singular entity name, e.g. Task" },
          description: { type: "string" },
          fields: {
            type: "array",
            minItems: 1,
            maxItems: MAX_FIELDS_PER_ENTITY,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "type", "required", "description"],
              properties: {
                name: { type: "string", description: "camelCase field name" },
                type: { type: "string", enum: [...APP_FIELD_TYPES] },
                required: { type: "boolean" },
                description: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

export const APP_MODEL_SYSTEM_PROMPT = [
  "You design the data model for a multi-tenant business web application from the user's requirements.",
  "Return ONLY a JSON object matching the provided schema. Do not wrap it in markdown.",
  "Rules:",
  "- Entities are PascalCase singular nouns (e.g. Task, Project). At most " + MAX_ENTITIES + " entities.",
  "- Fields are camelCase. Allowed types: " + APP_FIELD_TYPES.join(", ") + ".",
  "- Do not declare id, tenantId, createdAt, updatedAt or deletedAt; the platform adds them.",
  "- Model only what the requirements ask for. Do not invent sample records, prices or business facts.",
].join("\n");

export interface AppModelValidation {
  valid: boolean;
  errors: string[];
  model?: AppModel;
}

function checkKeys(value: Record<string, unknown>, allowed: string[], where: string, errors: string[]) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${where}: unknown property "${key}"`);
  }
}

/** Validates untrusted provider output against the AppModel contract. */
export function validateAppModel(raw: unknown): AppModelValidation {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["Output must be a JSON object"] };
  }
  const obj = raw as Record<string, unknown>;
  checkKeys(obj, ["applicationName", "entities"], "root", errors);

  const applicationName = typeof obj.applicationName === "string" ? obj.applicationName.trim() : "";
  if (!applicationName || applicationName.length > 80) errors.push("applicationName must be 1-80 characters");

  if (!Array.isArray(obj.entities) || obj.entities.length === 0) {
    errors.push("entities must be a non-empty array");
    return { valid: false, errors };
  }
  if (obj.entities.length > MAX_ENTITIES) errors.push(`At most ${MAX_ENTITIES} entities are supported`);

  const entityNames = new Set<string>();
  const entities: AppModelEntity[] = [];
  obj.entities.forEach((rawEntity, ei) => {
    const where = `entities[${ei}]`;
    if (!rawEntity || typeof rawEntity !== "object" || Array.isArray(rawEntity)) {
      errors.push(`${where} must be an object`);
      return;
    }
    const e = rawEntity as Record<string, unknown>;
    checkKeys(e, ["name", "description", "fields"], where, errors);
    const name = typeof e.name === "string" ? e.name : "";
    if (!ENTITY_NAME.test(name)) errors.push(`${where}.name "${name}" must be PascalCase letters/digits (2-40 chars)`);
    if (RESERVED_ENTITY_NAMES.has(name)) errors.push(`${where}.name "${name}" is reserved`);
    if (entityNames.has(name.toLowerCase())) errors.push(`${where}.name "${name}" is duplicated`);
    entityNames.add(name.toLowerCase());

    const fields: AppModelField[] = [];
    if (!Array.isArray(e.fields) || e.fields.length === 0) {
      errors.push(`${where}.fields must be a non-empty array`);
    } else {
      if (e.fields.length > MAX_FIELDS_PER_ENTITY) errors.push(`${where} has more than ${MAX_FIELDS_PER_ENTITY} fields`);
      const fieldNames = new Set<string>();
      e.fields.forEach((rawField, fi) => {
        const fwhere = `${where}.fields[${fi}]`;
        if (!rawField || typeof rawField !== "object" || Array.isArray(rawField)) {
          errors.push(`${fwhere} must be an object`);
          return;
        }
        const f = rawField as Record<string, unknown>;
        checkKeys(f, ["name", "type", "required", "description"], fwhere, errors);
        const fname = typeof f.name === "string" ? f.name : "";
        if (!FIELD_NAME.test(fname)) errors.push(`${fwhere}.name "${fname}" must be camelCase letters/digits`);
        if (SERVER_OWNED_FIELDS.has(fname.toLowerCase())) errors.push(`${fwhere}.name "${fname}" is platform-owned`);
        if (fieldNames.has(fname.toLowerCase())) errors.push(`${fwhere}.name "${fname}" is duplicated`);
        fieldNames.add(fname.toLowerCase());
        if (!APP_FIELD_TYPES.includes(f.type as AppFieldType)) {
          errors.push(`${fwhere}.type "${String(f.type)}" is not one of ${APP_FIELD_TYPES.join(", ")}`);
        }
        if (typeof f.required !== "boolean") errors.push(`${fwhere}.required must be a boolean`);
        fields.push({
          name: fname,
          type: f.type as AppFieldType,
          required: f.required === true,
          description: typeof f.description === "string" ? f.description.slice(0, 300) : "",
        });
      });
    }
    entities.push({ name, description: typeof e.description === "string" ? e.description.slice(0, 300) : "", fields });
  });

  return errors.length > 0
    ? { valid: false, errors }
    : { valid: true, errors: [], model: { applicationName, entities } };
}

/** Explicitly selected, reviewed templates. A brief is never silently mapped onto one. */
export const APPROVED_TEMPLATES: Record<string, AppModel> = {
  "task-tracker": {
    applicationName: "Task Tracker",
    entities: [
      {
        name: "Project",
        description: "A body of work owned by the organization",
        fields: [
          { name: "name", type: "string", required: true, description: "Project name" },
          { name: "description", type: "text", required: false, description: "Project summary" },
        ],
      },
      {
        name: "Task",
        description: "A unit of work within a project",
        fields: [
          { name: "title", type: "string", required: true, description: "Task title" },
          { name: "projectId", type: "string", required: true, description: "Owning project id" },
          { name: "dueAt", type: "datetime", required: false, description: "Due date" },
          { name: "completed", type: "boolean", required: true, description: "Completion flag" },
        ],
      },
    ],
  },
  "lead-inbox": {
    applicationName: "Lead Inbox",
    entities: [
      {
        name: "Lead",
        description: "An enquiry received from a prospective customer",
        fields: [
          { name: "fullName", type: "string", required: true, description: "Contact name" },
          { name: "email", type: "string", required: true, description: "Contact email" },
          { name: "message", type: "text", required: false, description: "Enquiry text" },
          { name: "stage", type: "string", required: true, description: "Pipeline stage" },
        ],
      },
    ],
  },
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
export const pluralize = (s: string) =>
  /[^aeiou]y$/i.test(s) ? s.slice(0, -1) + "ies" : /(s|x|z|ch|sh)$/i.test(s) ? s + "es" : s + "s";
export const resourcePath = (entity: string) => pluralize(lowerFirst(entity)).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
export const tableName = (entity: string) => pluralize(entity).replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

const SPEC_TYPE: Record<AppFieldType, ApplicationEntity["fields"][number]["type"]> = {
  string: "string", text: "text", integer: "number", number: "number", boolean: "boolean", datetime: "datetime",
};

/** Converts a validated AppModel into the authoritative ApplicationSpec contract. */
export function toApplicationSpec(model: AppModel, projectId: string, tenantId: string): ApplicationSpec {
  const now = new Date().toISOString();
  const stableId = (prefix: string, ...parts: string[]) =>
    `${prefix}_${crypto.createHash("sha256").update(parts.join("/")).digest("hex").slice(0, 12)}`;

  const entities: ApplicationEntity[] = model.entities.map((e) => ({
    id: stableId("ent", projectId, e.name),
    name: e.name,
    physicalTableName: tableName(e.name),
    description: e.description || undefined,
    isSoftDeletable: true,
    isAudited: false,
    fields: [
      { name: "tenantId", type: "string" as AppFieldType, required: true, description: "Owning tenant" },
      ...e.fields,
    ].map((f) => ({
      id: stableId("fld", projectId, e.name, f.name),
      name: f.name,
      physicalColumnName: f.name,
      type: SPEC_TYPE[f.type],
      isNullable: !f.required,
      sensitivity: "INTERNAL" as const,
      visibility: f.name === "tenantId" ? ("HIDDEN" as const) : ("READ_WRITE" as const),
      lifecycleOwnership: f.name === "tenantId" ? ("SYSTEM" as const) : ("GENERATED" as const),
      description: f.description || undefined,
    })),
    indexes: [{ name: `idx_${tableName(e.name)}_tenant`, fields: ["tenantId"], isUnique: false }],
  }));

  const operations: ApplicationOperation[] = entities.flatMap((entity) => {
    const base = `/api/${resourcePath(entity.name)}`;
    const op = (verb: string, method: ApplicationOperation["method"], path: string, type: ApplicationOperation["type"]) => ({
      id: stableId("op", projectId, entity.name, verb),
      name: `${verb}${entity.name}`,
      type,
      method,
      routePath: path,
      summary: `${verb} ${entity.name} within the caller's tenant`,
      targetEntityId: entity.id,
      requiredScopes: [`${resourcePath(entity.name)}:${verb}`],
      transactionBoundary: type === "MUTATION" ? ("SINGLE_STATEMENT" as const) : ("NONE" as const),
      requiresIdempotencyKey: false,
      declaredSideEffects: [],
    });
    return [
      op("list", "GET", base, "QUERY"),
      op("get", "GET", `${base}/:id`, "QUERY"),
      op("create", "POST", base, "MUTATION"),
      op("update", "PATCH", `${base}/:id`, "MUTATION"),
      op("archive", "DELETE", `${base}/:id`, "MUTATION"),
    ];
  });

  return {
    schemaVersion: "1.0.0",
    applicationId: stableId("app", projectId),
    projectId,
    tenantId,
    revision: 1,
    parentRevision: 0,
    frameworkProfile: "node-express",
    identityStrategy: "MULTI_TENANT_ROW",
    requirementIds: [],
    entities,
    relationships: [],
    operations,
    actors: [{ id: "act_member", name: "Member", description: "Authenticated tenant member", assignedRoles: ["MEMBER"], isDefault: true }],
    policies: entities.map((entity) => ({
      id: stableId("pol", projectId, entity.name),
      name: `${entity.name} tenant scope`,
      actorId: "act_member",
      resourceEntityId: entity.id,
      effect: "ALLOW" as const,
      actions: ["CREATE", "READ", "UPDATE", "DELETE"] as Array<"CREATE" | "READ" | "UPDATE" | "DELETE">,
      constraintExpression: "record.tenantId == actor.tenantId",
    })),
    frontendBindings: [],
    jobs: [],
    retentionPolicies: [],
    acceptanceContracts: [],
    createdAt: now,
    updatedAt: now,
  };
}
