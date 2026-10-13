/**
 * ForgeStudio Execution Blueprint v2.1 — Point 16: Hosting, Export and WordPress Compatibility
 * Controller Integration
 */

import { Request, Response } from "express";
import { DestinationCapabilityMatrixService, HostingDestinationType } from "../services/hostingExport/destinationCapabilityMatrix.service.js";
import { HostingProfilesEngine } from "../services/hostingExport/hostingProfilesEngine.service.js";
import { PortableExportPackageService } from "../services/hostingExport/portableExportPackage.service.js";
import { WordPressCompatibilityAdapterService } from "../services/hostingExport/wordPressCompatibilityAdapter.service.js";

export class HostingExportController {
  public static async getDestinationCapabilities(req: Request, res: Response) {
    try {
      const type = (req.params.destinationType as HostingDestinationType) || "MANAGED_DECLARATIVE";
      const report = DestinationCapabilityMatrixService.generateHostingWizardReport(type);
      return res.status(200).json({ success: true, report });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async qualifyHostingProfile(req: Request, res: Response) {
    try {
      const { profile, tenantId, websiteId, environmentCapabilities } = req.body;
      let result;
      switch (profile) {
        case "MANAGED_DECLARATIVE":
          result = HostingProfilesEngine.qualifyManagedDeclarative(tenantId, websiteId);
          break;
        case "MANAGED_CUSTOM_RUNTIME":
          result = HostingProfilesEngine.qualifyManagedCustomRuntime(tenantId, websiteId, environmentCapabilities || { hasKernelContainerIsolation: false, hasRestrictedEgress: false });
          break;
        case "PORTABLE_FULL_STACK":
          result = HostingProfilesEngine.qualifyPortableFullStack(websiteId);
          break;
        case "STATIC_SNAPSHOT":
          result = HostingProfilesEngine.qualifyStaticSnapshot(websiteId);
          break;
        case "WORDPRESS_LOCAL":
          result = HostingProfilesEngine.qualifyWordPressLocal(websiteId, "6.5");
          break;
        default:
          return res.status(400).json({ success: false, error: "Invalid profile" });
      }
      return res.status(200).json({ success: true, qualification: result });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async generatePortableExport(req: Request, res: Response) {
    try {
      const { tenantId, websiteId, targetProfile } = req.body;
      const manifest = PortableExportPackageService.generateExportManifest(tenantId, websiteId, targetProfile || "PORTABLE_FULL_STACK");
      return res.status(201).json({ success: true, manifest });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async mapToWordPress(req: Request, res: Response) {
    try {
      const { articles } = req.body;
      const result = WordPressCompatibilityAdapterService.mapToWordPressFormat(articles || []);
      return res.status(200).json({ success: true, result });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async assessSftp(req: Request, res: Response) {
    try {
      const assessment = WordPressCompatibilityAdapterService.assessSftpDestination(req.body);
      return res.status(200).json({ success: true, assessment });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
