/**
 * Point 08: Component Controller
 * Component contracts and quarantine inspection of imported source.
 *
 * Not exposed:
 * - /source/reconcile, /source/conflicts/*: three-way reconciliation keeps its base/current source
 *   and its conflicts in process memory, and no route registers a base, so it never sees the
 *   project's real files (forge_project_files / forge_project_revisions).
 * - /behavior/review: approves a release from client-submitted evidence statuses.
 */

import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "../utils/app-error.js";
import { tenantScopeOf } from "../middlewares/tenantScope.middleware.js";
import { getWebsiteRecord, putWebsiteRecord } from "../services/websiteRecords.service.js";
import { componentContractRegistry } from "../services/components/componentContractRegistry.service.js";
import {
  CustomSourceImportService,
  customSourceImportService,
  type ImportInspectionResult,
} from "../services/components/customSourceImport.service.js";

const target = z.enum(["SSR", "SSG", "CSR", "WORDPRESS", "NEXTJS", "STATIC_HTML"]);
const componentId = z.string().trim().min(1).max(200);
const version = z.string().trim().min(1).max(40);

const validateInput = z.object({
  componentId,
  props: z.record(z.string(), z.unknown()).default({}),
  version: version.optional(),
  target: target.optional(),
  slots: z.record(z.string(), z.array(z.string().max(200)).max(200)).optional(),
});

const importInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  sourceContent: z.string().min(1).max(CustomSourceImportService.MAX_FILE_SIZE_BYTES),
  declaredLicense: z.string().trim().min(1).max(100).optional(),
});

export class ComponentController {
  /** GET /contracts — lists all versioned component contracts. */
  public listContracts(req: Request, res: Response, next: NextFunction): void {
    try {
      const contracts = componentContractRegistry.listContracts(target.optional().parse(req.query.target));
      res.json({ success: true, count: contracts.length, data: contracts });
    } catch (err) {
      next(err);
    }
  }

  /** GET /contracts/:componentId — retrieves a specific component contract and version. */
  public getContract(req: Request, res: Response, next: NextFunction): void {
    try {
      const id = componentId.parse(req.params.componentId);
      const contract = componentContractRegistry.getContract(id, version.optional().parse(req.query.version));
      if (!contract) throw new AppError(`Contract '${id}' not found`, 404, "CONTRACT_NOT_FOUND");
      res.json({ success: true, data: contract });
    } catch (err) {
      next(err);
    }
  }

  /** POST /validate — validates a component instance against its contract. */
  public validateInstance(req: Request, res: Response, next: NextFunction): void {
    try {
      const input = validateInput.parse(req.body);
      const result = componentContractRegistry.validateInstance(input.componentId, input.props, {
        version: input.version,
        target: input.target,
        slots: input.slots,
      });
      res.json({ success: result.isValid, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /source/import — quarantine-inspects custom JSX/TSX source for a website the caller
   * belongs to and stores the inspection result. The same file for the same website is inspected
   * once: a repeat returns the stored result.
   */
  public async importSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scope = tenantScopeOf(res);
      const input = importInput.parse(req.body);
      const digest = createHash("sha256")
        .update(JSON.stringify([input.fileName, input.declaredLicense ?? null, input.sourceContent]))
        .digest("hex");

      let record = await getWebsiteRecord<ImportInspectionResult>(scope, "SOURCE_IMPORT", digest);
      const replay = record !== null;
      if (!record) {
        const result = customSourceImportService.inspectUploadedSource(
          {
            importId: `imp-${digest.slice(0, 32)}`,
            tenantId: scope.tenantId,
            projectId: scope.websiteId,
            uploaderId: res.locals.user.id,
            ...input,
          },
          { retainInMemory: false }
        );
        ({ record } = await putWebsiteRecord({
          scope,
          kind: "SOURCE_IMPORT",
          key: digest,
          data: result,
          request: digest,
          userId: res.locals.user.id,
        }));
      }

      const approved = record.data.isApproved;
      res.status(!approved ? 422 : replay ? 200 : 201).json({ success: approved, data: record.data, idempotentReplay: replay });
    } catch (err) {
      next(err);
    }
  }
}

export const componentController = new ComponentController();
