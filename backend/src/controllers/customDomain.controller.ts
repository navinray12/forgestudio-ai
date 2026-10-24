/**
 * Phase 19: Custom Domain Controller
 * Manages custom domains per website: add, list, verify, set primary, remove.
 */
import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { verifyProjectAccess } from "../modules/data-platform/common/project-access.js";
import {
  validateDomain,
  createDomainRecord,
  simulateVerificationCheck,
  verifyDomainDns,
  getDnsInstructions,
  isValidDomainStatusTransition,
  setOnePrimary,
  getPrimaryDomain,
  initiateSslProvisioning,
  getDomainDiagnosticStatus,
  type DomainVerificationMethod,
} from "../services/domains/customDomain.service.js";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function getAuthorizedWebsite(websiteId: string, userId?: string, requireAdmin = false) {
  // Neither missing identity nor a collaborator with read-only access may
  // claim, verify, delete, or change a website's public DNS/TLS ownership.
  if (!userId) return null;
  let access;
  try { access = await verifyProjectAccess(websiteId, userId); }
  catch { return null; }
  if (requireAdmin && !access.canAdminister) return null;
  return prisma.website.findUnique({ where: { id: websiteId } });
}

function readDomains(website: any): any[] {
  const ed: any = website.editorData || {};
  return Array.isArray(ed.customDomains) ? ed.customDomains : [];
}

async function writeDomains(websiteId: string, website: any, domains: any[]) {
  const ed: any = website.editorData || {};
  return prisma.website.update({
    where: { id: websiteId },
    data: { editorData: { ...ed, customDomains: domains } },
  });
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** GET /api/websites/:websiteId/domains */
export async function listDomains(req: Request, res: Response) {
  try {
    const websiteId = String(req.params.websiteId || "");
    const userId = res.locals.user?.id || (req as any).user?.id;
    const website = await getAuthorizedWebsite(websiteId, userId);
    if (!website) return res.status(404).json({ success: false, message: "Website not found or unauthorized" });

    const domains = readDomains(website).map((d: any) => ({
      ...d,
      dnsRecords: getDnsInstructions(d.domain, d.verificationToken),
    }));
    return res.status(200).json({ success: true, domains, primary: getPrimaryDomain(domains) || null });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/** POST /api/websites/:websiteId/domains */
export async function addDomain(req: Request, res: Response) {
  try {
    const websiteId = String(req.params.websiteId || "");
    const userId = res.locals.user?.id || (req as any).user?.id;
    const website = await getAuthorizedWebsite(websiteId, userId, true);
    if (!website) return res.status(404).json({ success: false, message: "Website not found or unauthorized" });

    const domain = validateDomain(String(req.body.domain || ""));
    // Ownership verification requires a domain-specific TXT challenge.
    // A/CNAME routing and file methods cannot satisfy the production verifier.
    if (req.body.method !== undefined && req.body.method !== "TXT") {
      return res.status(400).json({
        success: false,
        message: "TXT is the only supported domain ownership verification method",
      });
    }
    const method: DomainVerificationMethod = "TXT";

    const domains = readDomains(website);
    if (domains.some((d: any) => d.domain === domain)) {
      return res.status(409).json({ success: false, message: "Domain already added to this website" });
    }

    const record = createDomainRecord(domain, websiteId, method, domains.length === 0);
    await writeDomains(websiteId, website, [...domains, record]);

    const dnsRecords = getDnsInstructions(record.domain, record.verificationToken);

    return res.status(201).json({
      success: true,
      domain: { ...record, dnsRecords },
      instructions: buildVerificationInstructions(record),
      dnsRecords,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

/** POST /api/websites/:websiteId/domains/:domain/verify */
export async function verifyDomain(req: Request, res: Response) {
  try {
    const websiteId = String(req.params.websiteId || "");
    const domainName = decodeURIComponent(String(req.params.domain || "")).toLowerCase();
    const userId = res.locals.user?.id || (req as any).user?.id;

    const website = await getAuthorizedWebsite(websiteId, userId, true);
    if (!website) return res.status(404).json({ success: false, message: "Website not found or unauthorized" });

    const domains = readDomains(website);
    const idx = domains.findIndex((d: any) => d.domain === domainName);
    if (idx === -1) return res.status(404).json({ success: false, message: "Domain not found" });

    const record = domains[idx];
    const check = await verifyDomainDns(record);

    const now = new Date().toISOString();
    if (check.success) {
      // DNS ownership is verified, not a certificate. Never infer HTTPS.
      domains[idx] = {
        ...record, status: "active", verifiedAt: now, lastCheckedAt: now,
        sslEnabled: false, sslStatus: "PENDING_DNS",
        sslIssuer: undefined, sslExpiresAt: undefined,
      };
    } else {
      domains[idx] = { ...record, status: "failed", lastCheckedAt: now };
    }

    await writeDomains(websiteId, website, domains);

    const dnsRecords = getDnsInstructions(record.domain, record.verificationToken);

    return res.status(200).json({
      success: check.success,
      domain: { ...domains[idx], dnsRecords },
      dnsRecords,
      message: check.success ? "Domain DNS verified; HTTPS certificate issuance is not yet confirmed" : check.reason,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/** PATCH /api/websites/:websiteId/domains/:domain/primary */
export async function setDomainPrimary(req: Request, res: Response) {
  try {
    const websiteId = String(req.params.websiteId || "");
    const domainName = decodeURIComponent(String(req.params.domain || "")).toLowerCase();
    const userId = res.locals.user?.id || (req as any).user?.id;

    const website = await getAuthorizedWebsite(websiteId, userId, true);
    if (!website) return res.status(404).json({ success: false, message: "Website not found or unauthorized" });

    const domains = readDomains(website);
    const target = domains.find((d: any) => d.domain === domainName);
    if (!target) return res.status(404).json({ success: false, message: "Domain not found" });
    if (target.status !== "active") {
      return res.status(400).json({ success: false, message: "Only active domains can be set as primary" });
    }

    const updated = setOnePrimary(domains, domainName);
    await writeDomains(websiteId, website, updated);

    return res.status(200).json({ success: true, domains: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/** DELETE /api/websites/:websiteId/domains/:domain */
export async function removeDomain(req: Request, res: Response) {
  try {
    const websiteId = String(req.params.websiteId || "");
    const domainName = decodeURIComponent(String(req.params.domain || "")).toLowerCase();
    const userId = res.locals.user?.id || (req as any).user?.id;

    const website = await getAuthorizedWebsite(websiteId, userId, true);
    if (!website) return res.status(404).json({ success: false, message: "Website not found or unauthorized" });

    const domains = readDomains(website);
    const filtered = domains.filter((d: any) => d.domain !== domainName);
    if (filtered.length === domains.length) return res.status(404).json({ success: false, message: "Domain not found" });

    await writeDomains(websiteId, website, filtered);
    return res.status(200).json({ success: true, message: "Domain removed" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/** GET /api/websites/:websiteId/domains/:domain/status */
export async function getDomainStatus(req: Request, res: Response) {
  try {
    const websiteId = String(req.params.websiteId || "");
    const domainName = decodeURIComponent(String(req.params.domain || "")).toLowerCase();
    const userId = res.locals.user?.id || (req as any).user?.id;

    const website = await getAuthorizedWebsite(websiteId, userId);
    if (!website) return res.status(404).json({ success: false, message: "Website not found or unauthorized" });

    const domains = readDomains(website);
    const record = domains.find((d: any) => d.domain === domainName);
    if (!record) return res.status(404).json({ success: false, message: "Domain not found" });

    const diagnostics = getDomainDiagnosticStatus(record);
    const dnsRecords = getDnsInstructions(record.domain, record.verificationToken);

    return res.status(200).json({
      success: true,
      diagnostics,
      domain: { ...record, dnsRecords },
      dnsRecords,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/** POST /api/websites/:websiteId/domains/:domain/ssl/provision */
export async function provisionDomainSsl(req: Request, res: Response) {
  try {
    const websiteId = String(req.params.websiteId || "");
    const domainName = decodeURIComponent(String(req.params.domain || "")).toLowerCase();
    const userId = res.locals.user?.id || (req as any).user?.id;

    const website = await getAuthorizedWebsite(websiteId, userId, true);
    if (!website) return res.status(404).json({ success: false, message: "Website not found or unauthorized" });

    const domains = readDomains(website);
    const idx = domains.findIndex((d: any) => d.domain === domainName);
    if (idx === -1) return res.status(404).json({ success: false, message: "Domain not found" });

    const updatedRecord = await initiateSslProvisioning(domains[idx], websiteId);
    domains[idx] = updatedRecord;

    await writeDomains(websiteId, website, domains);

    const diagnostics = getDomainDiagnosticStatus(updatedRecord);
    const dnsRecords = getDnsInstructions(updatedRecord.domain, updatedRecord.verificationToken);

    return res.status(200).json({
      success: updatedRecord.sslStatus === "ACTIVE",
      domain: { ...updatedRecord, dnsRecords },
      diagnostics,
      dnsRecords,
      message:
        updatedRecord.sslStatus === "ACTIVE"
          ? "Zero-touch SSL provisioned and active on edge router"
          : "Pre-flight DNS check failed: " + (updatedRecord.dnsPreflight?.errors?.join("; ") || "Check DNS records"),
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      code: err.code || "SSL_PROVISIONING_FAILED",
      message: err.message,
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildVerificationInstructions(record: any): Record<string, string> {
  // Existing CNAME/FILE records also receive the real TXT instruction.
  // Routing records are optional hints and never prove domain ownership.
  return {
    type: "DNS TXT Record",
    host: `_forgestudio-challenge.${record.domain}`,
    value: record.verificationToken,
    ttl: "300",
  };
}
