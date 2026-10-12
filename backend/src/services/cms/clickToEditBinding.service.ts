/**
 * Point 09: Click-to-Edit Content Binding Service
 * 
 * Maps preview DOM nodes to stable CMS collection entries and field identities:
 * - Direct field binding attributes: data-forge-content="colId:entryId:fieldKey"
 * - Distinguishes change classification:
 *   - CONTENT_CHANGE (in-place text/media update, no compiler or layout regen required)
 *   - LAYOUT_DESIGN_CHANGE (design token, CSS rule, or component layout)
 *   - SCHEMA_CHANGE (field definition modification)
 *   - BUSINESS_LOGIC_CHANGE (actions, checkout, auth rules)
 * - Safe updates: changing a title updates the content field without triggering
 *   layout regeneration, component replacement, or authentication rewrites.
 */

import { record4ContentSchemaService } from "../authoritative/record4-content-schema.service.js";

export type ContentChangeClassification =
  | "CONTENT_CHANGE"
  | "LAYOUT_DESIGN_CHANGE"
  | "SCHEMA_CHANGE"
  | "POLICY_CHANGE"
  | "INFRASTRUCTURE_CHANGE"
  | "BUSINESS_LOGIC_CHANGE";

export interface ClickToEditBindingReference {
  collectionId: string;
  entryId: string;
  fieldKey: string;
  websiteId: string;
  tenantId: string;
}

export interface ContentFieldUpdateResult {
  success: boolean;
  classification: ContentChangeClassification;
  binding: ClickToEditBindingReference;
  previousValue?: unknown;
  newValue: unknown;
  requiresLayoutRegeneration: boolean;
  timestamp: string;
}

export class ClickToEditBindingService {
  private static instance: ClickToEditBindingService;

  private constructor() {}

  public static getInstance(): ClickToEditBindingService {
    if (!ClickToEditBindingService.instance) {
      ClickToEditBindingService.instance = new ClickToEditBindingService();
    }
    return ClickToEditBindingService.instance;
  }

  /**
   * Parses click-to-edit binding identifier into structured reference.
   * Format: "collectionId:entryId:fieldKey"
   */
  public parseBindingString(
    bindingStr: string,
    context: { websiteId: string; tenantId: string }
  ): ClickToEditBindingReference {
    const parts = bindingStr.split(":");
    if (parts.length !== 3) {
      throw new Error(`Invalid click-to-edit binding format '${bindingStr}'. Expected 'collectionId:entryId:fieldKey'`);
    }

    const [collectionId, entryId, fieldKey] = parts;
    return {
      collectionId,
      entryId,
      fieldKey,
      websiteId: context.websiteId,
      tenantId: context.tenantId
    };
  }

  /**
   * Classifies a requested user modification.
   */
  public classifyChange(target: {
    isContentField?: boolean;
    isStyleToken?: boolean;
    isSchemaDefinition?: boolean;
    isBusinessAction?: boolean;
  }): ContentChangeClassification {
    if (target.isBusinessAction) return "BUSINESS_LOGIC_CHANGE";
    if (target.isSchemaDefinition) return "SCHEMA_CHANGE";
    if (target.isStyleToken) return "LAYOUT_DESIGN_CHANGE";
    if (target.isContentField) return "CONTENT_CHANGE";
    return "CONTENT_CHANGE";
  }

  /**
   * Applies an in-place content field update without triggering layout regeneration.
   */
  public updateContentField(params: {
    binding: ClickToEditBindingReference;
    newValue: unknown;
    editorUserId: string;
  }): ContentFieldUpdateResult {
    const classification = this.classifyChange({ isContentField: true });

    // Fetch existing entry from Record 4
    const entries = record4ContentSchemaService.getContentEntries(params.binding.websiteId);
    const targetEntry = entries.find(e => e.entryId === params.binding.entryId);

    if (!targetEntry) {
      throw new Error(`Entry '${params.binding.entryId}' not found in collection '${params.binding.collectionId}'`);
    }

    const previousValue = targetEntry.data[params.binding.fieldKey];

    // Create updated draft revision in Record 4
    const updatedData = {
      ...targetEntry.data,
      [params.binding.fieldKey]: params.newValue
    };

    record4ContentSchemaService.saveEntryDraft({
      entryId: params.binding.entryId,
      collectionId: params.binding.collectionId,
      websiteId: params.binding.websiteId,
      tenantId: params.binding.tenantId,
      data: updatedData,
      slug: targetEntry.slug,
      authorId: params.editorUserId,
      changeNote: `Click-to-edit update of field '${params.binding.fieldKey}'`
    });

    return {
      success: true,
      classification,
      binding: params.binding,
      previousValue,
      newValue: params.newValue,
      requiresLayoutRegeneration: false, // Pure content change preserves layout intact
      timestamp: new Date().toISOString()
    };
  }
}

export const clickToEditBindingService = ClickToEditBindingService.getInstance();
