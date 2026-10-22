/**
 * Project controller: Module 31: GoDaddy & Custom Domain Automation.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Module 31: GoDaddy & Custom Domain Automation Handlers
// ---------------------------------------------------------------------------

export async function checkDomainAvailabilityHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const domain = String(req.query.domain || "");
    if (!domain) {
      res.status(400).json({ success: false, error: "domain query parameter is required" });
      return;
    }
    const { forgeDomainService } = await import("../../services/hosting/forgeDomain.service.js");
    const availability = await forgeDomainService.checkDomainAvailability(domain);
    res.status(200).json({ success: true, availability });
  } catch (err) {
    next(err);
  }
}

export async function connectDomainHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeDomainService } = await import("../../services/hosting/forgeDomain.service.js");
    const customDomain = await forgeDomainService.connectExistingDomain(projectId, req.body, user.id);
    res.status(201).json({ success: true, customDomain });
  } catch (err) {
    next(err);
  }
}

export async function listDomainsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeDomainService } = await import("../../services/hosting/forgeDomain.service.js");
    const domains = await forgeDomainService.listProjectDomains(projectId);
    res.status(200).json({ success: true, domains });
  } catch (err) {
    next(err);
  }
}

export async function configureDnsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const domainId = String(req.params.domainId);
    const { forgeDomainService } = await import("../../services/hosting/forgeDomain.service.js");
    const result = await forgeDomainService.configureGoDaddyDns(projectId, domainId, req.body, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function verifyDomainOwnershipHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const domainId = String(req.params.domainId);
    const { forgeDomainService } = await import("../../services/hosting/forgeDomain.service.js");
    const result = await forgeDomainService.verifyDomainOwnership(projectId, domainId, user.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function bindDomainDeploymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const domainId = String(req.params.domainId);
    const { deploymentId } = req.body;
    const { forgeDomainService } = await import("../../services/hosting/forgeDomain.service.js");
    const customDomain = await forgeDomainService.bindDomainToDeployment(projectId, { domainId, deploymentId }, user.id);
    res.status(200).json({ success: true, customDomain });
  } catch (err) {
    next(err);
  }
}

export async function detachDomainHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const domainId = String(req.params.domainId);
    const { forgeDomainService } = await import("../../services/hosting/forgeDomain.service.js");
    const result = await forgeDomainService.detachDomain(domainId, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
