/**
 * Points 09 & 10: CMS Provisioning and Content Management Controller
 * Exposes REST API endpoints for recipes, provisioning state machine, click-to-edit, imports, and publication lifecycle.
 */

import { Request, Response } from "express";
import { recipeEngineService } from "../services/cms/recipeEngine.service.js";
import { provisioningStateMachineService } from "../services/cms/provisioningStateMachine.service.js";
import { clickToEditBindingService } from "../services/cms/clickToEditBinding.service.js";
import { migrationPreviewService } from "../services/cms/migrationPreview.service.js";
import { contentModelEvolutionService } from "../services/cms/contentModelEvolution.service.js";
import { scheduledPublicationService } from "../services/cms/scheduledPublication.service.js";
import { contentImportReconciliationService } from "../services/cms/contentImportReconciliation.service.js";
import { protectedSourceLifecycleService } from "../services/cms/protectedSourceLifecycle.service.js";

export class CmsProvisioningController {
  // ================= Point 09 Endpoints =================

  /**
   * POST /api/cms/recipes/plan
   * Plans CMS/Blog provisioning operation and generates manifest.
   */
  public planProvisioning(req: Request, res: Response): void {
    try {
      const { websiteId, siteProfile, recipeVersion } = req.body;
      const tenantId = (req as any).user?.tenantId || "tenant-default";

      const operation = provisioningStateMachineService.planOperation({
        websiteId,
        tenantId,
        siteProfile: siteProfile || "EDITORIAL_PUBLISHER",
        recipeVersion
      });

      res.status(201).json({ success: true, data: operation });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/cms/recipes/:operationId/execute
   * Executes the full automated provisioning sequence.
   */
  public async executeProvisioning(req: Request, res: Response): Promise<void> {
    try {
      const { operationId } = req.params;
      const operation = await provisioningStateMachineService.runFullProvisioning(operationId);
      res.json({ success: operation.state === "READY", data: operation });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/cms/migration-preview
   * Generates existing-site collision and schema diff preview.
   */
  public getMigrationPreview(req: Request, res: Response): void {
    try {
      const { websiteId, siteProfile } = req.body;
      const tenantId = (req as any).user?.tenantId || "tenant-default";

      const report = migrationPreviewService.generatePreview({
        websiteId,
        tenantId,
        siteProfile: siteProfile || "PROFESSIONAL_SERVICES"
      });

      res.json({ success: true, data: report });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/cms/click-to-edit
   * Direct in-place field edit without layout regeneration.
   */
  public updateClickToEdit(req: Request, res: Response): void {
    try {
      const { bindingString, newValue } = req.body;
      const websiteId = (req.body.websiteId as string) || "site-default";
      const tenantId = (req as any).user?.tenantId || "tenant-default";
      const editorUserId = (req as any).user?.id || "user-editor";

      const binding = clickToEditBindingService.parseBindingString(bindingString, { websiteId, tenantId });
      const result = clickToEditBindingService.updateContentField({
        binding,
        newValue,
        editorUserId
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // ================= Point 10 Endpoints =================

  /**
   * POST /api/cms/entries/:entryId/draft
   * Saves draft revision, preserving published revision untouched.
   */
  public saveDraft(req: Request, res: Response): void {
    try {
      const { entryId } = req.params;
      const { updatedData, changeNote } = req.body;
      const authorId = (req as any).user?.id || "user-author";

      const result = contentModelEvolutionService.saveDraftEdit({
        entryId,
        updatedData,
        authorId,
        changeNote
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/cms/entries/:entryId/publish
   * Atomically switches publication pointer to current draft revision.
   */
  public publishEntry(req: Request, res: Response): void {
    try {
      const { entryId } = req.params;
      const publishedBy = (req as any).user?.id || "user-publisher";

      const result = contentModelEvolutionService.publishDraft({
        entryId,
        publishedBy
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/cms/entries/:entryId/schedule
   * Schedules future publication with explicit UTC instant.
   */
  public scheduleEntry(req: Request, res: Response): void {
    try {
      const { entryId } = req.params;
      const { revisionId, websiteId, scheduledInstantUtc, editorialTimezone, editorialLocalTime } = req.body;
      const scheduledBy = (req as any).user?.id || "user-scheduler";

      const job = scheduledPublicationService.schedulePublication({
        jobId: `job-sched-${Date.now()}`,
        entryId,
        revisionId,
        websiteId,
        scheduledInstantUtc,
        editorialTimezone,
        editorialLocalTime,
        scheduledBy
      });

      res.status(201).json({ success: true, data: job });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/cms/entries/:entryId/unpublish
   * Immediately denies authoritative access and triggers cache invalidation.
   */
  public unpublishEntry(req: Request, res: Response): void {
    try {
      const { entryId } = req.params;
      const result = scheduledPublicationService.unpublishEntry(entryId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/cms/entries/:entryId/trash
   * Soft-deletes entry to trash with reason and protected audit record.
   */
  public trashEntry(req: Request, res: Response): void {
    try {
      const { entryId } = req.params;
      const { expectedVersion, reason } = req.body;
      const actorId = (req as any).user?.id || "user-editor";

      const result = protectedSourceLifecycleService.trashEntry({
        entryId,
        expectedVersion: Number(expectedVersion),
        actorId,
        reason: reason || "User trashed entry"
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/cms/entries/:entryId/restore
   * Restores trashed entry, defaulting to unpublished.
   */
  public restoreEntry(req: Request, res: Response): void {
    try {
      const { entryId } = req.params;
      const actorId = (req as any).user?.id || "user-editor";

      const result = protectedSourceLifecycleService.restoreEntry({
        entryId,
        actorId
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/cms/import/preview
   * Previews bulk import asserting omitted rows are not deleted.
   */
  public previewImport(req: Request, res: Response): void {
    try {
      const { importBatchId, websiteId, collectionId, rows, existingSlugs } = req.body;
      const report = contentImportReconciliationService.previewImport({
        importBatchId: importBatchId || `batch-${Date.now()}`,
        websiteId,
        collectionId,
        rows: rows || [],
        existingSlugs: existingSlugs || []
      });

      res.json({ success: true, data: report });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

export const cmsProvisioningController = new CmsProvisioningController();
