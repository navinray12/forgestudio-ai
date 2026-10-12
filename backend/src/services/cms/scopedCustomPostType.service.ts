/**
 * ForgeStudio Execution Blueprint v2.1 — Point 21: Repository-Specific Remediation Order
 * Section 3.1 & 3.2: P0 Scoped Custom Post Type & Non-Destructive Field Definition Save Service
 *
 * Remediates:
 * - Unscoped database queries in customPostType.controller.ts
 * - Destructive delete-all/recreate behavior in saveCustomFieldsHandler
 * - Missing tenant isolation and object-level authorization
 * - Hard deletion of CPTs and entries bypassing the soft-delete lifecycle
 */

import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";

export interface ScopedFieldDefinition {
  fieldId: string; // Stable immutable identity!
  key: string;
  name: string;
  type: string;
  required: boolean;
  order: number;
  options?: Record<string, any>;
  version: number;
}

export interface ScopedCustomPostType {
  id: string;
  tenantId: string;
  websiteId: string;
  name: string;
  singular: string;
  plural: string;
  slug: string;
  description?: string;
  hasArchive: boolean;
  status: "ACTIVE" | "ARCHIVED" | "TRASHED";
  fields: ScopedFieldDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface ScopedCustomEntry {
  id: string;
  tenantId: string;
  websiteId: string;
  postTypeId: string;
  title: string;
  slug: string;
  status: "PUBLISHED" | "DRAFT" | "TRASHED";
  values: Record<string, any>; // keyed by stable fieldId or key
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export class ScopedCustomPostTypeService {
  private static cpts = new Map<string, ScopedCustomPostType>();
  private static entries = new Map<string, ScopedCustomEntry>();

  /**
   * Retrieves CPT with strict tenant and website scoping.
   */
  public static getCustomPostTypes(tenantId: string, websiteId: string): ScopedCustomPostType[] {
    return Array.from(this.cpts.values()).filter(
      (cpt) => cpt.tenantId === tenantId && cpt.websiteId === websiteId && cpt.status !== "TRASHED"
    );
  }

  /**
   * Creates a CPT with server-side validation and uniqueness within tenant/website scope.
   */
  public static createCustomPostType(
    tenantId: string,
    websiteId: string,
    data: { name: string; singular: string; plural: string; slug: string; description?: string; hasArchive?: boolean }
  ): ScopedCustomPostType {
    const slug = data.slug.toLowerCase().trim();

    // Check duplicate slug within website
    const existing = Array.from(this.cpts.values()).find(
      (c) => c.websiteId === websiteId && c.slug === slug && c.status !== "TRASHED"
    );
    if (existing) {
      throw new AppError(`Custom post type with slug '${slug}' already exists on website`, 409, "SLUG_CONFLICT");
    }

    const cpt: ScopedCustomPostType = {
      id: `cpt_${crypto.randomUUID()}`,
      tenantId,
      websiteId,
      name: data.name,
      singular: data.singular,
      plural: data.plural,
      slug,
      description: data.description,
      hasArchive: data.hasArchive ?? true,
      status: "ACTIVE",
      fields: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.cpts.set(cpt.id, cpt);
    return cpt;
  }

  /**
   * P0 Remediation: Non-destructive field definition save.
   * Eliminates the destructive `deleteMany` / recreate loop. Preserves stable field IDs and existing entry bindings!
   */
  public static saveFieldDefinitionsNonDestructive(
    tenantId: string,
    cptId: string,
    incomingFields: Array<{ fieldId?: string; key: string; name: string; type: string; required?: boolean; options?: any }>
  ): { cpt: ScopedCustomPostType; migrationPlan: { added: string[]; modified: string[]; removed: string[] } } {
    const cpt = this.cpts.get(cptId);
    if (!cpt) throw new AppError(`Custom post type ${cptId} not found`, 404, "NOT_FOUND");
    if (cpt.tenantId !== tenantId) throw new AppError("Cross-tenant access forbidden", 403, "TENANT_FORBIDDEN");

    const existingFieldMap = new Map(cpt.fields.map((f) => [f.key, f]));
    const updatedFields: ScopedFieldDefinition[] = [];

    const added: string[] = [];
    const modified: string[] = [];
    const incomingKeys = new Set(incomingFields.map((f) => f.key));

    incomingFields.forEach((inf, idx) => {
      const existing = existingFieldMap.get(inf.key);
      if (existing) {
        // Stable identity preserved!
        const mod: ScopedFieldDefinition = {
          ...existing,
          name: inf.name,
          type: inf.type,
          required: inf.required ?? existing.required,
          order: idx,
          options: inf.options ?? existing.options,
          version: existing.version + 1,
        };
        updatedFields.push(mod);
        modified.push(inf.key);
      } else {
        // New field added with permanent stable ID
        const newField: ScopedFieldDefinition = {
          fieldId: inf.fieldId || `fld_${crypto.randomUUID()}`,
          key: inf.key,
          name: inf.name,
          type: inf.type,
          required: inf.required || false,
          order: idx,
          options: inf.options || {},
          version: 1,
        };
        updatedFields.push(newField);
        added.push(inf.key);
      }
    });

    const removed = Array.from(existingFieldMap.keys()).filter((k) => !incomingKeys.has(k));

    cpt.fields = updatedFields;
    cpt.updatedAt = new Date().toISOString();

    return {
      cpt,
      migrationPlan: { added, modified, removed },
    };
  }

  /**
   * Retrieves custom entries protecting draft, private, and trashed entries from public queries.
   */
  public static getScopedEntries(
    tenantId: string,
    cptId: string,
    accessRole: "OWNER" | "MEMBER" | "PUBLIC_VISITOR"
  ): ScopedCustomEntry[] {
    const cpt = this.cpts.get(cptId);
    if (!cpt || cpt.tenantId !== tenantId) return [];

    return Array.from(this.entries.values()).filter((e) => {
      if (e.postTypeId !== cptId) return false;
      if (e.tenantId !== tenantId) return false;
      if (e.status === "TRASHED") return false;
      if (e.status === "DRAFT" && accessRole === "PUBLIC_VISITOR") return false;
      return true;
    });
  }

  /**
   * Safe soft-delete of CPT preserving historical entry audit records.
   */
  public static softDeleteCustomPostType(tenantId: string, cptId: string): void {
    const cpt = this.cpts.get(cptId);
    if (!cpt) throw new AppError(`CPT ${cptId} not found`, 404, "NOT_FOUND");
    if (cpt.tenantId !== tenantId) throw new AppError("Cross-tenant access forbidden", 403, "TENANT_FORBIDDEN");

    cpt.status = "TRASHED";
    cpt.updatedAt = new Date().toISOString();
  }

  /**
   * Seeds an entry (for test/runtime isolation).
   */
  public static seedEntry(entry: ScopedCustomEntry): void {
    this.entries.set(entry.id, entry);
  }
}
