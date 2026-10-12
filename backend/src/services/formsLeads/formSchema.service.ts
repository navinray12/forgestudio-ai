import { AppError } from "../../utils/app-error.js";

export type FieldSensitivity = "PUBLIC" | "INTERNAL" | "PII" | "RESTRICTED";
export type RetentionClass = "STANDARD" | "GDPR_30_DAY" | "GDPR_90_DAY" | "LEGAL_HOLD";
export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "number"
  | "file"
  | "hidden";

export interface FormFieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  label: string;
  helpText?: string;
  placeholder?: string;
  collectionRationale: string;
  required: boolean;
  sensitivity: FieldSensitivity;
  retentionClass: RetentionClass;
  allowedValues?: string[];
  validationRules?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
  };
  filePolicy?: {
    maxSizeBytes: number;
    allowedMimeTypes: string[];
  };
  stepIndex?: number;
}

export interface ConditionalRule {
  fieldId: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";
  value?: string | number | boolean;
}

export interface ConditionalBlock {
  id: string;
  targetFieldId: string;
  action: "show" | "hide" | "require";
  matchType: "all" | "any";
  rules: ConditionalRule[];
}

export interface FormSchemaDefinition {
  id: string;
  websiteId: string;
  version: number;
  name: string;
  purpose: string;
  fields: FormFieldDefinition[];
  conditionalBlocks: ConditionalBlock[];
  multiStepConfig?: {
    enabled: boolean;
    stepCount: number;
    stepTitles: string[];
  };
  createdAt: string;
  updatedAt: string;
}

// In-memory schema catalog for versioned form configurations
const formSchemaStore = new Map<string, FormSchemaDefinition>();

export function registerFormSchema(schema: FormSchemaDefinition): FormSchemaDefinition {
  if (!schema.id || !schema.fields || schema.fields.length === 0) {
    throw new AppError("Form schema must define an ID and at least one field", 400, "INVALID_FORM_SCHEMA");
  }

  // Verify unique field names and valid rationales
  const fieldNames = new Set<string>();
  for (const f of schema.fields) {
    if (fieldNames.has(f.name)) {
      throw new AppError(`Duplicate field name in schema: ${f.name}`, 400, "DUPLICATE_FIELD_NAME");
    }
    fieldNames.add(f.name);

    if (f.sensitivity === "PII" && (!f.collectionRationale || !f.collectionRationale.trim())) {
      throw new AppError(`PII field '${f.name}' requires explicit collection rationale`, 400, "MISSING_COLLECTION_RATIONALE");
    }
  }

  // Validate conditional rules reference known fields and do not form circular contradictions
  for (const block of schema.conditionalBlocks || []) {
    if (!fieldNames.has(block.targetFieldId)) {
      throw new AppError(`Conditional block targets unknown field: ${block.targetFieldId}`, 400, "INVALID_CONDITIONAL_TARGET");
    }
    for (const rule of block.rules) {
      if (!fieldNames.has(rule.fieldId)) {
        throw new AppError(`Conditional rule references unknown trigger field: ${rule.fieldId}`, 400, "INVALID_TRIGGER_FIELD");
      }
      if (rule.fieldId === block.targetFieldId) {
        throw new AppError(`Circular self-referencing conditional rule on field: ${rule.fieldId}`, 400, "CIRCULAR_CONDITIONAL_RULE");
      }
    }
  }

  const key = `${schema.websiteId}:${schema.id}:v${schema.version}`;
  formSchemaStore.set(key, schema);
  return schema;
}

export function getFormSchema(websiteId: string, formId: string, version?: number): FormSchemaDefinition | null {
  if (version) {
    return formSchemaStore.get(`${websiteId}:${formId}:v${version}`) || null;
  }
  // If version omitted, get newest version
  let latest: FormSchemaDefinition | null = null;
  for (const [key, schema] of formSchemaStore.entries()) {
    if (key.startsWith(`${websiteId}:${formId}:`)) {
      if (!latest || schema.version > latest.version) {
        latest = schema;
      }
    }
  }
  return latest;
}

/**
 * Server-side evaluation of form submission values against schema, conditional blocks, and types.
 */
export function validateFormSubmissionAgainstSchema(
  schema: FormSchemaDefinition,
  submittedValues: Record<string, any>
): {
  isValid: boolean;
  sanitizedValues: Record<string, any>;
  activeFieldIds: string[];
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const sanitizedValues: Record<string, any> = {};
  const activeFieldIds: string[] = [];

  // 1. Determine active visibility of fields
  const fieldVisibility = new Map<string, boolean>();
  const fieldRequirement = new Map<string, boolean>();

  for (const field of schema.fields) {
    fieldVisibility.set(field.name, true);
    fieldRequirement.set(field.name, field.required);
  }

  for (const block of schema.conditionalBlocks || []) {
    const targetName = block.targetFieldId;
    if (!fieldVisibility.has(targetName)) continue;

    const matches = block.rules.map((rule) => {
      const rawVal = submittedValues[rule.fieldId];
      const valStr = rawVal !== undefined && rawVal !== null ? String(rawVal).trim().toLowerCase() : "";
      const targetStr = rule.value !== undefined && rule.value !== null ? String(rule.value).trim().toLowerCase() : "";

      switch (rule.operator) {
        case "equals":
          return valStr === targetStr;
        case "not_equals":
          return valStr !== targetStr;
        case "contains":
          return valStr.includes(targetStr);
        case "greater_than":
          return Number(rawVal) > Number(rule.value);
        case "less_than":
          return Number(rawVal) < Number(rule.value);
        case "is_empty":
          return rawVal === undefined || rawVal === null || valStr === "";
        case "is_not_empty":
          return rawVal !== undefined && rawVal !== null && valStr !== "";
        default:
          return false;
      }
    });

    const isMatch = block.matchType === "any" ? matches.some(Boolean) : matches.every(Boolean);

    if (block.action === "show") {
      fieldVisibility.set(targetName, isMatch);
    } else if (block.action === "hide") {
      if (isMatch) fieldVisibility.set(targetName, false);
    } else if (block.action === "require") {
      if (isMatch) fieldRequirement.set(targetName, true);
    }
  }

  // 2. Validate active fields
  for (const field of schema.fields) {
    const isVisible = fieldVisibility.get(field.name) ?? true;
    if (!isVisible) {
      // Excluded hidden fields from submission payload to prevent hidden field spoofing
      continue;
    }

    activeFieldIds.push(field.id);
    const isRequired = fieldRequirement.get(field.name) ?? field.required;
    const value = submittedValues[field.name];

    // Check required
    if (isRequired && (value === undefined || value === null || String(value).trim() === "")) {
      errors[field.name] = `${field.label} is required`;
      continue;
    }

    if (value === undefined || value === null || String(value).trim() === "") {
      sanitizedValues[field.name] = null;
      continue;
    }

    // Type validation
    if (field.type === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value).trim())) {
        errors[field.name] = `Invalid email address format`;
        continue;
      }
      sanitizedValues[field.name] = String(value).trim().toLowerCase();
    } else if (field.type === "number") {
      const num = Number(value);
      if (isNaN(num)) {
        errors[field.name] = `${field.label} must be a valid number`;
        continue;
      }
      if (field.validationRules?.minValue !== undefined && num < field.validationRules.minValue) {
        errors[field.name] = `${field.label} must be at least ${field.validationRules.minValue}`;
        continue;
      }
      if (field.validationRules?.maxValue !== undefined && num > field.validationRules.maxValue) {
        errors[field.name] = `${field.label} cannot exceed ${field.validationRules.maxValue}`;
        continue;
      }
      sanitizedValues[field.name] = num;
    } else if (field.type === "select" || field.type === "radio") {
      if (field.allowedValues && !field.allowedValues.includes(String(value))) {
        errors[field.name] = `Selected option is not allowed`;
        continue;
      }
      sanitizedValues[field.name] = String(value);
    } else {
      sanitizedValues[field.name] = typeof value === "string" ? value.trim() : value;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    sanitizedValues,
    activeFieldIds,
    errors,
  };
}
