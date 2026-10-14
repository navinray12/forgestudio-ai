/**
 * Application model contract for full-stack generation (blueprint §33, §38, §39, §45).
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
  ApplicationRelationship,
} from "../authoritative/applicationSpec.service.js";

export const APP_FIELD_TYPES = ["string", "text", "integer", "number", "boolean", "datetime", "reference"] as const;
export type AppFieldType = (typeof APP_FIELD_TYPES)[number];

export interface AppModelField {
  name: string;
  type: AppFieldType;
  required: boolean;
  description: string;
  /** For type "reference": the referenced entity (same tenant). Empty otherwise. */
  references: string;
}

export interface AppModelCommand {
  name: string;
  from: string[];
  to: string;
  /** Optional fields of the entity that must be supplied with (and only by) this command. */
  requiredEvidence: string[];
}

/** A server-owned state field changed only through declared commands (blueprint §45 completeTask). */
export interface AppModelLifecycle {
  field: string;
  initial: string;
  states: string[];
  commands: AppModelCommand[];
}

export interface AppModelEntity {
  name: string;
  description: string;
  fields: AppModelField[];
  lifecycle: AppModelLifecycle | null;
}

export interface AppModel {
  applicationName: string;
  entities: AppModelEntity[];
}

export const MAX_ENTITIES = 8;
export const MAX_FIELDS_PER_ENTITY = 25;
export const MAX_STATES = 12;
export const MAX_COMMANDS = 10;

/** Columns the platform owns; a model may not declare them. */
const SERVER_OWNED_FIELDS = new Set(["id", "tenantid", "createdat", "updatedat", "deletedat", "revision"]);
const RESERVED_ENTITY_NAMES = new Set([
  "Object", "Array", "String", "Number", "Boolean", "Date", "Error", "Function", "Promise", "Map", "Set",
  "Record", "Request", "Response", "Router", "Prisma", "PrismaClient", "Tenant", "User",
]);
const RESERVED_COMMAND_NAMES = new Set(["constructor", "prototype", "list", "get", "create", "update", "archive"]);
const ENTITY_NAME = /^[A-Z][A-Za-z0-9]{1,39}$/;
const FIELD_NAME = /^[a-z][A-Za-z0-9]{0,39}$/;
const STATE_NAME = /^[A-Z][A-Z0-9_]{0,39}$/;

const LIFECYCLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["field", "initial", "states", "commands"],
  properties: {
    field: { type: "string", description: "camelCase name of the server-owned state field, e.g. status" },
    initial: { type: "string", description: "State assigned on creation" },
    states: { type: "array", minItems: 2, maxItems: MAX_STATES, items: { type: "string", description: "UPPER_SNAKE_CASE state" } },
    commands: {
      type: "array",
      minItems: 1,
      maxItems: MAX_COMMANDS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "from", "to", "requiredEvidence"],
        properties: {
          name: { type: "string", description: "camelCase command name, e.g. complete" },
          from: { type: "array", minItems: 1, items: { type: "string" } },
          to: { type: "string" },
          requiredEvidence: { type: "array", items: { type: "string", description: "Optional field of this entity the command must supply" } },
        },
      },
    },
  },
};

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
        required: ["name", "description", "fields", "lifecycle"],
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
              required: ["name", "type", "required", "description", "references"],
              properties: {
                name: { type: "string", description: "camelCase field name" },
                type: { type: "string", enum: [...APP_FIELD_TYPES] },
                required: { type: "boolean" },
                description: { type: "string" },
                references: { type: "string", description: "Entity name when type is reference, otherwise an empty string" },
              },
            },
          },
          lifecycle: { anyOf: [{ type: "null" }, LIFECYCLE_SCHEMA] },
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
  "- A field of type reference points to another entity named in `references` (e.g. Task.projectId references Project).",
  "- Do not declare id, tenantId, createdAt, updatedAt, deletedAt or revision; the platform adds them.",
  "- Use `lifecycle` (or null) when a record moves through states that need rules, e.g. a task that may only be",
  "  completed with a completion note. Generic edits can never change the state field; only commands can.",
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

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const stringArray = (v: unknown): string[] | null => (Array.isArray(v) && v.every((s) => typeof s === "string") ? (v as string[]) : null);

function validateLifecycle(raw: unknown, fields: AppModelField[], where: string, errors: string[]): AppModelLifecycle | null {
  if (raw === null || raw === undefined) return null;
  if (!isObject(raw)) {
    errors.push(`${where} must be an object or null`);
    return null;
  }
  checkKeys(raw, ["field", "initial", "states", "commands"], where, errors);
  const field = typeof raw.field === "string" ? raw.field : "";
  if (!FIELD_NAME.test(field)) errors.push(`${where}.field "${field}" must be camelCase`);
  if (SERVER_OWNED_FIELDS.has(field.toLowerCase())) errors.push(`${where}.field "${field}" is platform-owned`);
  if (fields.some((f) => f.name.toLowerCase() === field.toLowerCase())) errors.push(`${where}.field "${field}" duplicates a declared field`);

  const states = stringArray(raw.states) ?? [];
  if (states.length < 2 || states.length > MAX_STATES) errors.push(`${where}.states must list 2-${MAX_STATES} states`);
  for (const s of states) if (!STATE_NAME.test(s)) errors.push(`${where}.states "${s}" must be UPPER_SNAKE_CASE`);
  if (new Set(states).size !== states.length) errors.push(`${where}.states contains duplicates`);
  const initial = typeof raw.initial === "string" ? raw.initial : "";
  if (!states.includes(initial)) errors.push(`${where}.initial "${initial}" is not a declared state`);

  const commands: AppModelCommand[] = [];
  if (!Array.isArray(raw.commands) || raw.commands.length === 0 || raw.commands.length > MAX_COMMANDS) {
    errors.push(`${where}.commands must list 1-${MAX_COMMANDS} commands`);
  } else {
    const names = new Set<string>();
    raw.commands.forEach((rawCommand, ci) => {
      const cwhere = `${where}.commands[${ci}]`;
      if (!isObject(rawCommand)) {
        errors.push(`${cwhere} must be an object`);
        return;
      }
      checkKeys(rawCommand, ["name", "from", "to", "requiredEvidence"], cwhere, errors);
      const name = typeof rawCommand.name === "string" ? rawCommand.name : "";
      if (!FIELD_NAME.test(name)) errors.push(`${cwhere}.name "${name}" must be camelCase`);
      if (RESERVED_COMMAND_NAMES.has(name)) errors.push(`${cwhere}.name "${name}" is reserved`);
      if (names.has(name)) errors.push(`${cwhere}.name "${name}" is duplicated`);
      names.add(name);
      const from = stringArray(rawCommand.from) ?? [];
      if (from.length === 0) errors.push(`${cwhere}.from must list at least one state`);
      for (const s of from) if (!states.includes(s)) errors.push(`${cwhere}.from "${s}" is not a declared state`);
      const to = typeof rawCommand.to === "string" ? rawCommand.to : "";
      if (!states.includes(to)) errors.push(`${cwhere}.to "${to}" is not a declared state`);
      if (from.includes(to)) errors.push(`${cwhere} transitions "${to}" to itself`);
      const requiredEvidence = stringArray(rawCommand.requiredEvidence ?? []) ?? [];
      if (!Array.isArray(rawCommand.requiredEvidence ?? [])) errors.push(`${cwhere}.requiredEvidence must be an array`);
      for (const ev of requiredEvidence) {
        const target = fields.find((f) => f.name === ev);
        if (!target) errors.push(`${cwhere}.requiredEvidence "${ev}" is not a field of this entity`);
        else if (target.required) errors.push(`${cwhere}.requiredEvidence "${ev}" must be an optional field (it is set by the command)`);
        else if (target.type === "reference") errors.push(`${cwhere}.requiredEvidence "${ev}" cannot be a reference`);
      }
      commands.push({ name, from, to, requiredEvidence });
    });
  }
  return { field, initial, states, commands };
}

/** Validates untrusted provider output against the AppModel contract. */
export function validateAppModel(raw: unknown): AppModelValidation {
  const errors: string[] = [];
  if (!isObject(raw)) {
    return { valid: false, errors: ["Output must be a JSON object"] };
  }
  checkKeys(raw, ["applicationName", "entities"], "root", errors);

  const applicationName = typeof raw.applicationName === "string" ? raw.applicationName.trim() : "";
  if (!applicationName || applicationName.length > 80) errors.push("applicationName must be 1-80 characters");

  if (!Array.isArray(raw.entities) || raw.entities.length === 0) {
    errors.push("entities must be a non-empty array");
    return { valid: false, errors };
  }
  if (raw.entities.length > MAX_ENTITIES) errors.push(`At most ${MAX_ENTITIES} entities are supported`);

  const entityNames = new Set<string>();
  const entities: AppModelEntity[] = [];
  raw.entities.forEach((rawEntity, ei) => {
    const where = `entities[${ei}]`;
    if (!isObject(rawEntity)) {
      errors.push(`${where} must be an object`);
      return;
    }
    const e = rawEntity;
    checkKeys(e, ["name", "description", "fields", "lifecycle"], where, errors);
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
        if (!isObject(rawField)) {
          errors.push(`${fwhere} must be an object`);
          return;
        }
        const f = rawField;
        checkKeys(f, ["name", "type", "required", "description", "references"], fwhere, errors);
        const fname = typeof f.name === "string" ? f.name : "";
        if (!FIELD_NAME.test(fname)) errors.push(`${fwhere}.name "${fname}" must be camelCase letters/digits`);
        if (SERVER_OWNED_FIELDS.has(fname.toLowerCase())) errors.push(`${fwhere}.name "${fname}" is platform-owned`);
        if (fieldNames.has(fname.toLowerCase())) errors.push(`${fwhere}.name "${fname}" is duplicated`);
        fieldNames.add(fname.toLowerCase());
        if (!APP_FIELD_TYPES.includes(f.type as AppFieldType)) {
          errors.push(`${fwhere}.type "${String(f.type)}" is not one of ${APP_FIELD_TYPES.join(", ")}`);
        }
        if (typeof f.required !== "boolean") errors.push(`${fwhere}.required must be a boolean`);
        const references = typeof f.references === "string" ? f.references : "";
        if (f.references !== undefined && typeof f.references !== "string") errors.push(`${fwhere}.references must be a string`);
        if (f.type !== "reference" && references !== "") errors.push(`${fwhere}.references is only allowed on reference fields`);
        fields.push({
          name: fname,
          type: f.type as AppFieldType,
          required: f.required === true,
          description: typeof f.description === "string" ? f.description.slice(0, 300) : "",
          references,
        });
      });
    }
    const lifecycle = validateLifecycle(e.lifecycle, fields, `${where}.lifecycle`, errors);
    entities.push({ name, description: typeof e.description === "string" ? e.description.slice(0, 300) : "", fields, lifecycle });
  });

  // References must name a declared entity; they are resolved within the caller's tenant.
  const declared = new Set(entities.map((e) => e.name));
  entities.forEach((e, ei) => e.fields.forEach((f, fi) => {
    if (f.type === "reference" && !declared.has(f.references)) {
      errors.push(`entities[${ei}].fields[${fi}].references "${f.references}" is not a declared entity`);
    }
  }));

  return errors.length > 0
    ? { valid: false, errors }
    : { valid: true, errors: [], model: { applicationName, entities } };
}

const field = (name: string, type: AppFieldType, required: boolean, description: string, references = ""): AppModelField =>
  ({ name, type, required, description, references });

/** Explicitly selected, reviewed templates. A brief is never silently mapped onto one. */
export const APPROVED_TEMPLATES: Record<string, AppModel> = {
  "task-tracker": {
    applicationName: "Task Tracker",
    entities: [
      {
        name: "Project",
        description: "A body of work owned by the organization",
        fields: [
          field("name", "string", true, "Project name"),
          field("description", "text", false, "Project summary"),
        ],
        lifecycle: null,
      },
      {
        name: "Task",
        description: "A unit of work within a project",
        fields: [
          field("title", "string", true, "Task title"),
          field("projectId", "reference", true, "Owning project", "Project"),
          field("dueAt", "datetime", false, "Due date"),
          field("completionNote", "text", false, "Evidence recorded when the task is completed"),
        ],
        lifecycle: {
          field: "status",
          initial: "OPEN",
          states: ["OPEN", "IN_PROGRESS", "DONE"],
          commands: [
            { name: "start", from: ["OPEN"], to: "IN_PROGRESS", requiredEvidence: [] },
            { name: "complete", from: ["OPEN", "IN_PROGRESS"], to: "DONE", requiredEvidence: ["completionNote"] },
            { name: "reopen", from: ["DONE"], to: "OPEN", requiredEvidence: [] },
          ],
        },
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
          field("fullName", "string", true, "Contact name"),
          field("email", "string", true, "Contact email"),
          field("message", "text", false, "Enquiry text"),
        ],
        lifecycle: {
          field: "stage",
          initial: "NEW",
          states: ["NEW", "CONTACTED", "WON", "LOST"],
          commands: [
            { name: "contact", from: ["NEW"], to: "CONTACTED", requiredEvidence: [] },
            { name: "win", from: ["CONTACTED"], to: "WON", requiredEvidence: [] },
            { name: "lose", from: ["NEW", "CONTACTED"], to: "LOST", requiredEvidence: [] },
          ],
        },
      },
    ],
  },
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
export const pluralize = (s: string) =>
  /[^aeiou]y$/i.test(s) ? s.slice(0, -1) + "ies" : /(s|x|z|ch|sh)$/i.test(s) ? s + "es" : s + "s";
export const resourcePath = (entity: string) => pluralize(lowerFirst(entity)).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
export const tableName = (entity: string) => pluralize(entity).replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
/** Fields a generic create/update may set: everything except command-owned evidence. */
export const writableFields = (e: AppModelEntity) => {
  const evidence = new Set(e.lifecycle?.commands.flatMap((c) => c.requiredEvidence) ?? []);
  return e.fields.filter((f) => !evidence.has(f.name));
};

const SPEC_TYPE: Record<AppFieldType, ApplicationEntity["fields"][number]["type"]> = {
  string: "string", text: "text", integer: "number", number: "number", boolean: "boolean", datetime: "datetime", reference: "uuid",
};

/** Converts a validated AppModel into the authoritative ApplicationSpec contract. */
export function toApplicationSpec(model: AppModel, projectId: string, tenantId: string): ApplicationSpec {
  const now = new Date().toISOString();
  const stableId = (prefix: string, ...parts: string[]) =>
    `${prefix}_${crypto.createHash("sha256").update(parts.join("/")).digest("hex").slice(0, 12)}`;
  const entityId = (name: string) => stableId("ent", projectId, name);

  const entities: ApplicationEntity[] = model.entities.map((e) => {
    const evidence = new Set(e.lifecycle?.commands.flatMap((c) => c.requiredEvidence) ?? []);
    const fields = [
      { id: stableId("fld", projectId, e.name, "tenantId"), name: "tenantId", physicalColumnName: "tenantId", type: "string" as const,
        isNullable: false, sensitivity: "INTERNAL" as const, visibility: "HIDDEN" as const, lifecycleOwnership: "SYSTEM" as const,
        description: "Owning tenant, taken only from the authenticated principal" },
      ...e.fields.map((f) => ({
        id: stableId("fld", projectId, e.name, f.name),
        name: f.name,
        physicalColumnName: f.name,
        type: SPEC_TYPE[f.type],
        isNullable: !f.required,
        sensitivity: "INTERNAL" as const,
        visibility: "READ_WRITE" as const,
        lifecycleOwnership: evidence.has(f.name) ? ("SYSTEM" as const) : ("GENERATED" as const),
        description: f.description || undefined,
      })),
      ...(e.lifecycle ? [{
        id: stableId("fld", projectId, e.name, e.lifecycle.field),
        name: e.lifecycle.field,
        physicalColumnName: e.lifecycle.field,
        type: "enum" as const,
        enumOptions: e.lifecycle.states,
        isNullable: false,
        sensitivity: "INTERNAL" as const,
        visibility: "READ_ONLY" as const,
        lifecycleOwnership: "SYSTEM" as const,
        description: "Changed only through declared commands",
      }] : []),
    ];
    return {
      id: entityId(e.name),
      name: e.name,
      physicalTableName: tableName(e.name),
      description: e.description || undefined,
      isSoftDeletable: true,
      isAudited: e.lifecycle !== null,
      fields,
      indexes: [{ name: `idx_${tableName(e.name)}_tenant`, fields: ["tenantId"], isUnique: false }],
    };
  });

  const relationships: ApplicationRelationship[] = model.entities.flatMap((e) =>
    e.fields.filter((f) => f.type === "reference").map((f) => ({
      id: stableId("rel", projectId, e.name, f.name),
      name: `${e.name}.${f.name}`,
      sourceEntityId: entityId(e.name),
      targetEntityId: entityId(f.references),
      type: "ONE_TO_MANY" as const,
      foreignKeyField: f.name,
      cascadeRule: "RESTRICT_NO_ACTION" as const,
    }))
  );

  const operations: ApplicationOperation[] = model.entities.flatMap((e) => {
    const id = entityId(e.name);
    const base = `/api/${resourcePath(e.name)}`;
    const op = (verb: string, method: ApplicationOperation["method"], path: string, type: ApplicationOperation["type"],
      extra: Partial<ApplicationOperation> = {}): ApplicationOperation => ({
      id: stableId("op", projectId, e.name, verb),
      name: `${verb}${e.name}`,
      type,
      method,
      routePath: path,
      summary: `${verb} ${e.name} within the caller's tenant`,
      targetEntityId: id,
      requiredScopes: [`${resourcePath(e.name)}:${verb}`],
      transactionBoundary: type === "MUTATION" ? "ATOMIC_TRANSACTION" : "NONE",
      requiresIdempotencyKey: false,
      declaredSideEffects: type === "MUTATION" ? [`outbox:${e.name}.${verb}`] : [],
      ...extra,
    });
    return [
      op("list", "GET", base, "QUERY"),
      op("get", "GET", `${base}/:id`, "QUERY"),
      op("create", "POST", base, "MUTATION"),
      op("update", "PATCH", `${base}/:id`, "MUTATION"),
      op("archive", "DELETE", `${base}/:id`, "MUTATION"),
      ...(e.lifecycle?.commands.map((c) => op(c.name, "POST", `${base}/:id/commands/${c.name}`, "MUTATION", {
        summary: `${c.name}: ${c.from.join("|")} -> ${c.to}${c.requiredEvidence.length ? ` (requires ${c.requiredEvidence.join(", ")})` : ""}`,
        declaredSideEffects: [`audit:${e.name}.${c.name}`, `outbox:${e.name}.${c.name}`],
      })) ?? []),
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
    relationships,
    operations,
    actors: [{ id: "act_member", name: "Member", description: "Authenticated tenant member", assignedRoles: ["MEMBER"], isDefault: true }],
    policies: entities.map((entity) => ({
      id: stableId("pol", projectId, entity.name),
      name: `${entity.name} tenant scope`,
      actorId: "act_member",
      resourceEntityId: entity.id,
      effect: "ALLOW" as const,
      actions: ["CREATE", "READ", "UPDATE", "DELETE", "EXECUTE"] as Array<"CREATE" | "READ" | "UPDATE" | "DELETE" | "EXECUTE">,
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
