/**
 * ForgeStudio Modules 53–56: DevOps, Observability, Security & Feature Flags Controller
 */

import { Request, Response, NextFunction } from "express";
import { previewEnvironmentService } from "../modules/devops-platform/preview/previewEnvironment.service.js";
import { developerObservabilityService } from "../modules/devops-platform/observability/developerObservability.service.js";
import { applicationSecurityService } from "../modules/devops-platform/security/applicationSecurity.service.js";
import { featureFlagsService } from "../modules/devops-platform/feature-flags/featureFlags.service.js";

function paramStr(param: string | string[] | undefined, fallback: string = ""): string {
  if (Array.isArray(param)) {
    return param[0] ?? fallback;
  }
  return param ?? fallback;
}

export class DevOpsPlatformController {
  // ------------------------------------------------------------
  // Module 53: Preview Environments
  // ------------------------------------------------------------

  static async listPreviewEnvironments(req: Request, res: Response, next: NextFunction) {
    try {
      const environments = await previewEnvironmentService.listPreviewEnvironments(paramStr(req.params.id));
      res.json({ success: true, environments });
    } catch (err) {
      next(err);
    }
  }

  static async getPreviewEnvironment(req: Request, res: Response, next: NextFunction) {
    try {
      const environment = await previewEnvironmentService.getPreviewEnvironment(
        paramStr(req.params.id),
        paramStr(req.params.envId)
      );
      res.json({ success: true, environment });
    } catch (err) {
      next(err);
    }
  }

  static async createPreviewEnvironment(req: Request, res: Response, next: NextFunction) {
    try {
      const environment = await previewEnvironmentService.createPreviewEnvironment(
        paramStr(req.params.id),
        req.body
      );
      res.status(201).json({ success: true, environment });
    } catch (err) {
      next(err);
    }
  }

  static async deployPreviewEnvironment(req: Request, res: Response, next: NextFunction) {
    try {
      const environment = await previewEnvironmentService.deployPreviewEnvironment(
        paramStr(req.params.id),
        paramStr(req.params.envId)
      );
      res.json({ success: true, environment });
    } catch (err) {
      next(err);
    }
  }

  static async extendPreviewTtl(req: Request, res: Response, next: NextFunction) {
    try {
      const additionalHours = req.body.additionalHours || 24;
      const environment = await previewEnvironmentService.extendTtl(
        paramStr(req.params.id),
        paramStr(req.params.envId),
        additionalHours
      );
      res.json({ success: true, environment });
    } catch (err) {
      next(err);
    }
  }

  static async teardownPreviewEnvironment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await previewEnvironmentService.teardownPreviewEnvironment(
        paramStr(req.params.id),
        paramStr(req.params.envId)
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async promotePreviewEnvironment(req: Request, res: Response, next: NextFunction) {
    try {
      const targetEnvironment = req.body.targetEnvironment || "staging";
      const result = await previewEnvironmentService.promotePreviewEnvironment(
        paramStr(req.params.id),
        paramStr(req.params.envId),
        targetEnvironment
      );
      res.json({ success: true, promotion: result });
    } catch (err) {
      next(err);
    }
  }

  // ------------------------------------------------------------
  // Module 54: Developer Observability
  // ------------------------------------------------------------

  static async ingestLog(req: Request, res: Response, next: NextFunction) {
    try {
      const log = await developerObservabilityService.ingestLog(paramStr(req.params.id), req.body);
      res.status(201).json({ success: true, log });
    } catch (err) {
      next(err);
    }
  }

  static async queryLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const filter: any = {
        environment: typeof req.query.environment === "string" ? req.query.environment : undefined,
        source: req.query.source as any,
        level: req.query.level as any,
        traceId: typeof req.query.traceId === "string" ? req.query.traceId : undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      };
      const logs = await developerObservabilityService.queryLogs(paramStr(req.params.id), filter);
      res.json({ success: true, logs });
    } catch (err) {
      next(err);
    }
  }

  static async recordSpan(req: Request, res: Response, next: NextFunction) {
    try {
      const span = await developerObservabilityService.recordSpan(paramStr(req.params.id), req.body);
      res.status(201).json({ success: true, span });
    } catch (err) {
      next(err);
    }
  }

  static async getTrace(req: Request, res: Response, next: NextFunction) {
    try {
      const trace = await developerObservabilityService.getTrace(
        paramStr(req.params.id),
        paramStr(req.params.traceId)
      );
      res.json({ success: true, trace });
    } catch (err) {
      next(err);
    }
  }

  static async getApmMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = await developerObservabilityService.getApmMetrics(paramStr(req.params.id));
      res.json({ success: true, metrics });
    } catch (err) {
      next(err);
    }
  }

  static async listIssues(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as any;
      const issues = await developerObservabilityService.listIssues(paramStr(req.params.id), status);
      res.json({ success: true, issues });
    } catch (err) {
      next(err);
    }
  }

  static async updateIssueStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await developerObservabilityService.updateIssueStatus(
        paramStr(req.params.id),
        paramStr(req.params.issueId),
        req.body.status
      );
      res.json({ success: true, issue: updated });
    } catch (err) {
      next(err);
    }
  }

  static async diagnoseIssue(req: Request, res: Response, next: NextFunction) {
    try {
      const diagnostic = await developerObservabilityService.diagnoseIssueWithAi(
        paramStr(req.params.id),
        paramStr(req.params.issueId)
      );
      res.json({ success: true, diagnostic });
    } catch (err) {
      next(err);
    }
  }

  // ------------------------------------------------------------
  // Module 55: Application Security Scanning
  // ------------------------------------------------------------

  static async runSecurityScan(req: Request, res: Response, next: NextFunction) {
    try {
      const scanType = req.body.scanType || "FULL";
      const policy = req.body.policy;
      const scan = await applicationSecurityService.runSecurityScan(
        paramStr(req.params.id),
        scanType,
        policy
      );
      res.status(201).json({ success: true, scan });
    } catch (err) {
      next(err);
    }
  }

  static async getLatestScan(req: Request, res: Response, next: NextFunction) {
    try {
      const scan = await applicationSecurityService.getLatestScan(paramStr(req.params.id));
      res.json({ success: true, scan });
    } catch (err) {
      next(err);
    }
  }

  static async listScans(req: Request, res: Response, next: NextFunction) {
    try {
      const scans = await applicationSecurityService.listScans(paramStr(req.params.id));
      res.json({ success: true, scans });
    } catch (err) {
      next(err);
    }
  }

  static async generateAiRemediation(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await applicationSecurityService.generateAiRemediation(
        paramStr(req.params.id),
        paramStr(req.params.findingId)
      );
      res.json({ success: true, remediation: result });
    } catch (err) {
      next(err);
    }
  }

  // ------------------------------------------------------------
  // Module 56: Feature Flags & Remote Configuration
  // ------------------------------------------------------------

  static async listFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const flags = await featureFlagsService.listFlags(paramStr(req.params.id));
      res.json({ success: true, flags });
    } catch (err) {
      next(err);
    }
  }

  static async getFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const flag = await featureFlagsService.getFlag(paramStr(req.params.id), paramStr(req.params.key));
      res.json({ success: true, flag });
    } catch (err) {
      next(err);
    }
  }

  static async createFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const flag = await featureFlagsService.createFlag(paramStr(req.params.id), req.body);
      res.status(201).json({ success: true, flag });
    } catch (err) {
      next(err);
    }
  }

  static async updateFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const flag = await featureFlagsService.updateFlag(
        paramStr(req.params.id),
        paramStr(req.params.key),
        req.body
      );
      res.json({ success: true, flag });
    } catch (err) {
      next(err);
    }
  }

  static async toggleFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const flag = await featureFlagsService.toggleFlag(
        paramStr(req.params.id),
        paramStr(req.params.key),
        Boolean(req.body.isEnabled)
      );
      res.json({ success: true, flag });
    } catch (err) {
      next(err);
    }
  }

  static async deleteFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await featureFlagsService.deleteFlag(paramStr(req.params.id), paramStr(req.params.key));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async evaluateFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const context = {
        userId: req.body.userId,
        environment: req.body.environment,
        attributes: req.body.attributes,
      };
      const results = await featureFlagsService.evaluateAllFlags(paramStr(req.params.id), context);
      res.json({ success: true, flags: results });
    } catch (err) {
      next(err);
    }
  }

  static async listConfigs(req: Request, res: Response, next: NextFunction) {
    try {
      const env = typeof req.query.environment === "string" ? req.query.environment : undefined;
      const configs = await featureFlagsService.listConfigs(paramStr(req.params.id), env);
      res.json({ success: true, configs });
    } catch (err) {
      next(err);
    }
  }

  static async setConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await featureFlagsService.setConfig(paramStr(req.params.id), req.body);
      res.json({ success: true, config });
    } catch (err) {
      next(err);
    }
  }

  static async deleteConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const env = typeof req.query.environment === "string" ? req.query.environment : "all";
      const result = await featureFlagsService.deleteConfig(
        paramStr(req.params.id),
        paramStr(req.params.key),
        env
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
