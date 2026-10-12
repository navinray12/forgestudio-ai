/**
 * ForgeStudio Execution Blueprint v2.1 — Point 18: Security, Privacy, Audit and Abuse Resistance
 * Controller Integration
 */

import { Request, Response } from "express";
import { ThreatModelMatrixService } from "../services/securityAudit/threatModelMatrix.service.ts";
import { SecurityPlanesAuthorizationService } from "../services/securityAudit/securityPlanesAuthorization.service.ts";
import { SsrfNetworkQuarantineService } from "../services/securityAudit/ssrfNetworkQuarantine.service.ts";
import { DataPolicyRetentionRedactionService } from "../services/securityAudit/dataPolicyRetentionRedaction.service.ts";
import { DurableAuditDenialLedgerService } from "../services/securityAudit/durableAuditDenialLedger.service.ts";

export class SecurityAuditController {
  public static async getThreatModel(req: Request, res: Response) {
    try {
      const model = ThreatModelMatrixService.getThreatModel();
      return res.status(200).json({ success: true, threatModel: model });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async resolveContext(req: Request, res: Response) {
    try {
      const user = (req as any).user || {};
      const untrustedHeader = req.headers["x-tenant-id"] as string | undefined;
      const context = SecurityPlanesAuthorizationService.resolveSecurityContext(user, untrustedHeader);
      return res.status(200).json({ success: true, context });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async validateOutboundUrl(req: Request, res: Response) {
    try {
      const { url } = req.body;
      const result = SsrfNetworkQuarantineService.validateOutboundUrl(url);
      return res.status(200).json({ success: true, result });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async redactPayload(req: Request, res: Response) {
    try {
      const { payload } = req.body;
      const redacted = DataPolicyRetentionRedactionService.redactObjectDeep(payload);
      return res.status(200).json({ success: true, redacted });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async verifyAuditIntegrity(req: Request, res: Response) {
    try {
      const integrity = DurableAuditDenialLedgerService.verifyAuditChainIntegrity();
      return res.status(200).json({ success: true, integrity });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async checkQuota(req: Request, res: Response) {
    try {
      const { tenantId, category, currentCount, limit } = req.body;
      const result = DurableAuditDenialLedgerService.checkQuotaAndAbuse(tenantId, category, currentCount, limit);
      return res.status(200).json({ success: true, result });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
