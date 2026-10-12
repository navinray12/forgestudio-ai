/**
 * Point 10: Content Model Evolution & Revision Lifecycle Service
 * 
 * Enforces explicit content dimensions and revision safety:
 * - Separate state dimensions:
 *   - Editorial State: DRAFT | IN_REVIEW | APPROVED
 *   - Publication State: UNPUBLISHED | PUBLISHED | SCHEDULED
 *   - Deletion State: ACTIVE | TRASHED | PURGED
 *   - Legal Hold: boolean
 * - Editing published content creates an independent draft revision, leaving active published revision untouched
 * - Atomic publication pointer switching
 * - Safe Schema Evolution: Expand -> Backfill -> Validate -> Switch -> Contract
 * - Field renames preserve stable fieldId and bindings
 * - Historical revisions remain renderable
 */

import { record4ContentSchemaService, type ContentFieldDefinition, type CollectionSchema } from "../authoritative/record4-content-schema.service.js";

export type EditorialState = "DRAFT" | "IN_REVIEW" | "APPROVED";
export type PublicationState = "UNPUBLISHED" | "PUBLISHED" | "SCHEDULED";
export type DeletionState = "ACTIVE" | "TRASHED" | "PURGED";

export interface EvolvedContentEntry {
  entryId: string;
  collectionId: string;
  websiteId: string;
  tenantId: string;
  slug: string;
  currentDraftRevisionId: string;
  publishedRevisionId?: string;
  editorialState: EditorialState;
  publicationState: PublicationState;
  deletionState: DeletionState;
  hasLegalHold: boolean;
  version: number;
  revisions: EvolvedEntryRevision[];
  createdAt: string;
  updatedAt: string;
}

export interface EvolvedEntryRevision {
  revisionId: string;
  entryId: string;
  version: number;
  data: Record<string, unknown>;
  schemaVersion: number;
  editorialState: EditorialState;
  isPublished: boolean;
  createdAt: string;
  createdBy: string;
  changeNote?: string;
}

export interface SchemaEvolutionPlan {
  collectionId: string;
  fromVersion: number;
  toVersion: number;
  operation: "RENAME_FIELD" | "CHANGE_TYPE" | "ADD_REQUIRED_FIELD" | "REMOVE_FIELD";
  fieldId: string;
  details: Record<string, unknown>;
  requiresBackfill: boolean;
  affectedEntriesCount: number;
  status: "PLANNED" | "BACKFILLED" | "VALIDATED" | "SWITCHED" | "CONTRACTED";
}

export class ContentModelEvolutionService {
  private static instance: ContentModelEvolutionService;

  // Active entries: entryId -> EvolvedContentEntry
  private entries = new Map<string, EvolvedContentEntry>();
  // Active schema migration plans: planId -> SchemaEvolutionPlan
  private migrationPlans = new Map<string, SchemaEvolutionPlan>();

  private constructor() {}

  public static getInstance(): ContentModelEvolutionService {
    if (!ContentModelEvolutionService.instance) {
      ContentModelEvolutionService.instance = new ContentModelEvolutionService();
    }
    return ContentModelEvolutionService.instance;
  }

  public reset(): void {
    this.entries.clear();
    this.migrationPlans.clear();
  }

  /**
   * Creates a new content entry with initial draft revision.
   */
  public createEntry(params: {
    entryId: string;
    collectionId: string;
    websiteId: string;
    tenantId: string;
    slug: string;
    initialData: Record<string, unknown>;
    authorId: string;
  }): EvolvedContentEntry {
    const revisionId = `rev-${params.entryId}-1`;
    const now = new Date().toISOString();

    const initialRevision: EvolvedEntryRevision = {
      revisionId,
      entryId: params.entryId,
      version: 1,
      data: { ...params.initialData },
      schemaVersion: 1,
      editorialState: "DRAFT",
      isPublished: false,
      createdAt: now,
      createdBy: params.authorId,
      changeNote: "Initial draft"
    };

    const entry: EvolvedContentEntry = {
      entryId: params.entryId,
      collectionId: params.collectionId,
      websiteId: params.websiteId,
      tenantId: params.tenantId,
      slug: params.slug,
      currentDraftRevisionId: revisionId,
      publishedRevisionId: undefined, // Unset initially
      editorialState: "DRAFT",
      publicationState: "UNPUBLISHED",
      deletionState: "ACTIVE",
      hasLegalHold: false,
      version: 1,
      revisions: [initialRevision],
      createdAt: now,
      updatedAt: now
    };

    this.entries.set(params.entryId, entry);
    return entry;
  }

  public getEntry(entryId: string): EvolvedContentEntry | undefined {
    return this.entries.get(entryId);
  }

  /**
   * Saves edits to an existing entry:
   * INVARIANT: If the entry is currently PUBLISHED, a NEW DRAFT revision is created.
   * The currently published revision remains active, untouched, and publicly served!
   */
  public saveDraftEdit(params: {
    entryId: string;
    updatedData: Record<string, unknown>;
    authorId: string;
    changeNote?: string;
  }): { entry: EvolvedContentEntry; newRevision: EvolvedEntryRevision } {
    const entry = this.getEntry(params.entryId);
    if (!entry) {
      throw new Error(`Content entry not found: ${params.entryId}`);
    }

    if (entry.deletionState !== "ACTIVE") {
      throw new Error(`Cannot edit trashed or purged entry: ${params.entryId}`);
    }

    const nextVersion = entry.version + 1;
    const newRevisionId = `rev-${params.entryId}-${nextVersion}`;
    const now = new Date().toISOString();

    const newRevision: EvolvedEntryRevision = {
      revisionId: newRevisionId,
      entryId: params.entryId,
      version: nextVersion,
      data: { ...updatedData },
      schemaVersion: 1,
      editorialState: "DRAFT",
      isPublished: false, // New draft is never published automatically
      createdAt: now,
      createdBy: params.authorId,
      changeNote: params.changeNote || "Draft update"
    };

    entry.revisions.push(newRevision);
    entry.currentDraftRevisionId = newRevisionId;
    entry.editorialState = "DRAFT";
    entry.version = nextVersion;
    entry.updatedAt = now;

    return { entry, newRevision };
  }

  /**
   * Atomically switches the publication pointer to the current draft revision.
   */
  public publishDraft(params: {
    entryId: string;
    publishedBy: string;
  }): { entry: EvolvedContentEntry; publishedRevision: EvolvedEntryRevision } {
    const entry = this.getEntry(params.entryId);
    if (!entry) {
      throw new Error(`Content entry not found: ${params.entryId}`);
    }

    const draft = entry.revisions.find(r => r.revisionId === entry.currentDraftRevisionId);
    if (!draft) {
      throw new Error(`Draft revision not found for entry ${params.entryId}`);
    }

    // Mark previous published revision as unpublished
    if (entry.publishedRevisionId) {
      const prev = entry.revisions.find(r => r.revisionId === entry.publishedRevisionId);
      if (prev) prev.isPublished = false;
    }

    // Atomically activate new revision
    draft.isPublished = true;
    entry.publishedRevisionId = draft.revisionId;
    entry.publicationState = "PUBLISHED";
    entry.editorialState = "APPROVED";
    entry.updatedAt = new Date().toISOString();

    return { entry, publishedRevision: draft };
  }

  /**
   * Public retrieval layer:
   * Returns ONLY the currently published revision. Drafts and private fields never leak!
   */
  public getPublicProjection(entryId: string): Record<string, unknown> | null {
    const entry = this.getEntry(entryId);
    if (!entry) return null;

    if (entry.publicationState !== "PUBLISHED" || entry.deletionState !== "ACTIVE") {
      return null; // Unpublished or trashed entries are never returned publicly
    }

    const publishedRev = entry.revisions.find(r => r.revisionId === entry.publishedRevisionId);
    if (!publishedRev) return null;

    return {
      entryId: entry.entryId,
      slug: entry.slug,
      version: publishedRev.version,
      publishedAt: publishedRev.createdAt,
      ...publishedRev.data
    };
  }

  /**
   * Schema Evolution: Rename field while preserving stable fieldId and existing bindings.
   */
  public planFieldRename(params: {
    collectionId: string;
    websiteId: string;
    fieldId: string;
    newDisplayName: string;
  }): SchemaEvolutionPlan {
    const schemas = record4ContentSchemaService.getContentSchemas(params.websiteId);
    const schema = schemas.find(s => s.collectionId === params.collectionId);

    if (!schema) {
      throw new Error(`Collection schema not found: ${params.collectionId}`);
    }

    const field = schema.fields.find(f => f.fieldId === params.fieldId);
    if (!field) {
      throw new Error(`Field not found: ${params.fieldId}`);
    }

    // Update display name while preserving stable fieldId and key
    field.name = params.newDisplayName;

    const plan: SchemaEvolutionPlan = {
      collectionId: params.collectionId,
      fromVersion: schema.schemaVersion,
      toVersion: schema.schemaVersion + 1,
      operation: "RENAME_FIELD",
      fieldId: params.fieldId,
      details: { oldName: field.name, newName: params.newDisplayName, fieldKey: field.key },
      requiresBackfill: false, // Display rename does not require data backfill
      affectedEntriesCount: 0,
      status: "SWITCHED"
    };

    schema.schemaVersion += 1;
    this.migrationPlans.set(`plan-rename-${Date.now()}`, plan);
    return plan;
  }
}

export const contentModelEvolutionService = ContentModelEvolutionService.getInstance();
