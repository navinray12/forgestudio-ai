/**
 * ForgeStudio Module 55: Application Security Scanning Service
 * Static Application Security Testing (SAST), Secret Leak Detection,
 * Dependency Vulnerability Audit, Security Gates, and AI Auto-Remediation.
 */

import crypto from "crypto";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { forgeProjectService } from "../../../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../../../services/project/forgeFilesystem.service.js";
import { aiGatewayService } from "../../ai/gateway/aiGateway.service.js";
import {
  SecurityFinding,
  SecurityScanRecord,
  ScanType,
  SecuritySeverity,
  SecurityGatePolicy,
} from "./security.types.js";

const db = prisma as any;

export class ApplicationSecurityService {
  /**
   * SAST rule patterns
   */
  private readonly SAST_RULES = [
    {
      ruleId: "SAST-001",
      severity: "CRITICAL" as SecuritySeverity,
      title: "Dangerous Dynamic Code Execution (eval)",
      pattern: /\beval\s*\(/g,
      description: "Direct invocation of eval() executes arbitrary strings as code, enabling remote code execution.",
      remediation: "Replace eval() with structured JSON.parse() or dedicated parser logic.",
    },
    {
      ruleId: "SAST-002",
      severity: "CRITICAL" as SecuritySeverity,
      title: "Unsafe Command Execution (child_process.exec)",
      pattern: /(?:exec|execSync)\s*\(\s*`[^`]*\${/g,
      description: "Passing string-interpolated shell commands to exec allows shell injection.",
      remediation: "Use execFile or spawn with explicit argument arrays instead of shell command strings.",
    },
    {
      ruleId: "SAST-003",
      severity: "HIGH" as SecuritySeverity,
      title: "Potential SQL Injection Concatenation",
      pattern: /(?:SELECT|INSERT|UPDATE|DELETE)\s+.*FROM\s+.*(?:\+|concat)/gi,
      description: "String concatenation in SQL queries allows untrusted input to alter database query logic.",
      remediation: "Use parameterized queries ($1, $2) or an ORM/Query Builder with bound variables.",
    },
    {
      ruleId: "SAST-004",
      severity: "HIGH" as SecuritySeverity,
      title: "Direct HTML Injection (XSS Vector)",
      pattern: /dangerouslySetInnerHTML|innerHTML\s*=/g,
      description: "Writing unescaped raw HTML to the DOM enables Cross-Site Scripting (XSS).",
      remediation: "Use standard React JSX text nodes or sanitize HTML with DOMPurify before rendering.",
    },
    {
      ruleId: "SAST-005",
      severity: "MEDIUM" as SecuritySeverity,
      title: "Potential Path Traversal in File Operations",
      pattern: /(?:readFile|writeFile|readdir)\s*\([^)]*\+/g,
      description: "Concatenating user-supplied filenames without path normalization allows directory traversal.",
      remediation: "Normalize and validate paths using path.resolve() and ensure the target resides within an allowed directory.",
    },
  ];

  /**
   * Secret leak detection patterns
   */
  private readonly SECRET_RULES = [
    {
      ruleId: "SEC-AWS-01",
      severity: "CRITICAL" as SecuritySeverity,
      title: "Hardcoded AWS Access Key ID",
      pattern: /AKIA[0-9A-Z]{16}/g,
      description: "AWS credentials leaked in source code grant unauthorized cloud infrastructure access.",
      remediation: "Store AWS credentials in environment variables or an enterprise secret store.",
    },
    {
      ruleId: "SEC-STRIPE-01",
      severity: "CRITICAL" as SecuritySeverity,
      title: "Hardcoded Stripe Secret API Key",
      pattern: /sk_live_[0-9a-zA-Z]{24,}/g,
      description: "Stripe live secret keys allow full access to payment processing and financial data.",
      remediation: "Rotate the compromised key in Stripe Dashboard and access it strictly via process.env.",
    },
    {
      ruleId: "SEC-GH-01",
      severity: "CRITICAL" as SecuritySeverity,
      title: "Hardcoded GitHub Personal Access Token",
      pattern: /ghp_[0-9a-zA-Z]{36}/g,
      description: "Exposed GitHub tokens allow repository hijacking and malicious workflow execution.",
      remediation: "Revoke the token immediately on GitHub and inject tokens through CI/CD environment secrets.",
    },
    {
      ruleId: "SEC-DB-01",
      severity: "HIGH" as SecuritySeverity,
      title: "Database Connection URI with Password",
      pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@[a-zA-Z0-9.-]+/g,
      description: "Hardcoded database connection strings expose credentials to all code readers.",
      remediation: "Provide database connection strings via DATABASE_URL environment variables.",
    },
    {
      ruleId: "SEC-PK-01",
      severity: "CRITICAL" as SecuritySeverity,
      title: "Hardcoded Private Key Block",
      pattern: /-----BEGIN (?:RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/g,
      description: "Cryptographic private keys embedded in source files compromise encryption and signing.",
      remediation: "Remove private key files from Git history and load keys dynamically from a key management service.",
    },
  ];

  /**
   * Known package vulnerabilities database
   */
  private readonly KNOWN_CVE_PACKAGES: Record<
    string,
    { affected: string; patched: string; cve: string; severity: SecuritySeverity; desc: string }
  > = {
    lodash: {
      affected: "< 4.17.21",
      patched: "4.17.21",
      cve: "CVE-2021-23337",
      severity: "HIGH",
      desc: "Prototype pollution in template function allows code injection.",
    },
    axios: {
      affected: "< 1.6.0",
      patched: "1.6.0",
      cve: "CVE-2023-45857",
      severity: "MEDIUM",
      desc: "Cross-domain redirect leak of Authorization header.",
    },
    express: {
      affected: "< 4.19.2",
      patched: "4.19.2",
      cve: "CVE-2024-29041",
      severity: "MEDIUM",
      desc: "Open redirect in res.location() and res.redirect().",
    },
    jsonwebtoken: {
      affected: "< 9.0.0",
      patched: "9.0.0",
      cve: "CVE-2022-23529",
      severity: "HIGH",
      desc: "Insecure key object validation allows arbitrary file write / execution.",
    },
  };

  /**
   * Run a comprehensive security scan across project files
   */
  async runSecurityScan(
    projectId: string,
    scanType: ScanType = "FULL",
    customPolicy?: Partial<SecurityGatePolicy>
  ): Promise<SecurityScanRecord> {
    const startTime = Date.now();
    await forgeProjectService.getProjectById(projectId);

    const findings: SecurityFinding[] = [];
    const policy: SecurityGatePolicy = {
      failOnCritical: customPolicy?.failOnCritical ?? true,
      failOnHigh: customPolicy?.failOnHigh ?? true,
      minScore: customPolicy?.minScore ?? 75,
    };

    // Get all files from project filesystem
    let files: any[] = [];
    try {
      files = await forgeFilesystemService.listFiles(projectId);
    } catch {
      files = [];
    }

    // 1. SAST & Secret Leak scanning
    for (const file of files) {
      if (!file.path || file.path.includes("node_modules") || file.path.includes(".git")) {
        continue;
      }

      let content = "";
      try {
        const fileData = await forgeFilesystemService.readFile(projectId, file.path);
        content = fileData.content || "";
      } catch {
        continue;
      }

      const lines = content.split("\n");

      // SAST checks
      if (scanType === "FULL" || scanType === "SAST") {
        for (const rule of this.SAST_RULES) {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (rule.pattern.test(line)) {
              rule.pattern.lastIndex = 0;
              findings.push({
                id: `finding-${crypto.randomBytes(6).toString("hex")}`,
                type: "SAST",
                ruleId: rule.ruleId,
                severity: rule.severity,
                title: rule.title,
                description: rule.description,
                filePath: file.path,
                lineNumber: i + 1,
                snippet: line.trim().slice(0, 160),
                remediation: rule.remediation,
              });
            }
          }
        }
      }

      // Secret Leak checks
      if (scanType === "FULL" || scanType === "SECRETS") {
        for (const rule of this.SECRET_RULES) {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (rule.pattern.test(line)) {
              rule.pattern.lastIndex = 0;
              findings.push({
                id: `finding-${crypto.randomBytes(6).toString("hex")}`,
                type: "SECRET",
                ruleId: rule.ruleId,
                severity: rule.severity,
                title: rule.title,
                description: rule.description,
                filePath: file.path,
                lineNumber: i + 1,
                snippet: "[REDACTED SENSITIVE PATTERN MATCH]",
                remediation: rule.remediation,
              });
            }
          }
        }
      }
    }

    // 2. Dependency Vulnerability Audit
    if (scanType === "FULL" || scanType === "DEPENDENCY") {
      try {
        const pkgFile = await forgeFilesystemService.readFile(projectId, "package.json");
        const pkg = JSON.parse(pkgFile.content || "{}");
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

        for (const [pkgName, version] of Object.entries(deps)) {
          const knownVuln = this.KNOWN_CVE_PACKAGES[pkgName];
          if (knownVuln) {
            findings.push({
              id: `finding-${crypto.randomBytes(6).toString("hex")}`,
              type: "DEPENDENCY",
              ruleId: `DEP-${pkgName.toUpperCase()}`,
              severity: knownVuln.severity,
              title: `Vulnerable Dependency: ${pkgName} (${String(version)})`,
              description: knownVuln.desc,
              filePath: "package.json",
              remediation: `Upgrade ${pkgName} to version ${knownVuln.patched} or later.`,
              cve: knownVuln.cve,
            });
          }
        }
      } catch {
        // package.json might not exist or be invalid, safe skip
      }
    }

    // Calculate metrics
    const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
    const highCount = findings.filter((f) => f.severity === "HIGH").length;
    const mediumCount = findings.filter((f) => f.severity === "MEDIUM").length;
    const lowCount = findings.filter((f) => f.severity === "LOW").length;

    const penalty = criticalCount * 25 + highCount * 15 + mediumCount * 5 + lowCount * 2;
    const score = Math.max(0, Math.min(100, 100 - penalty));

    // Evaluate CI Security Gate
    let passedGates = true;
    if (policy.failOnCritical && criticalCount > 0) passedGates = false;
    if (policy.failOnHigh && highCount > 0) passedGates = false;
    if (score < policy.minScore) passedGates = false;

    const durationMs = Date.now() - startTime;

    const record = await db.forgeSecurityScan.create({
      data: {
        projectId,
        scanType,
        status: "COMPLETED",
        score,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        findings,
        passedGates,
        durationMs,
        createdAt: new Date(),
      },
    });

    return record;
  }

  /**
   * Get latest security scan for project
   */
  async getLatestScan(projectId: string): Promise<SecurityScanRecord | null> {
    await forgeProjectService.getProjectById(projectId);

    return await db.forgeSecurityScan.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * List scan history for project
   */
  async listScans(projectId: string): Promise<SecurityScanRecord[]> {
    await forgeProjectService.getProjectById(projectId);

    return await db.forgeSecurityScan.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  /**
   * AI-powered auto-remediation patch generation for a finding
   */
  async generateAiRemediation(
    projectId: string,
    findingId: string
  ): Promise<{ findingId: string; summary: string; patchCode: string }> {
    await forgeProjectService.getProjectById(projectId);

    const latestScan = await this.getLatestScan(projectId);
    if (!latestScan) {
      throw new AppError("No security scan found", 404, "NOT_FOUND");
    }

    const finding = (latestScan.findings || []).find((f) => f.id === findingId);
    if (!finding) {
      throw new AppError("Security finding not found", 404, "NOT_FOUND");
    }

    try {
      const prompt = `Generate a security fix patch for this finding in file ${finding.filePath}:\nSeverity: ${finding.severity}\nRule: ${finding.ruleId} (${finding.title})\nSnippet: ${finding.snippet || "N/A"}\nRemediation guideline: ${finding.remediation}\n\nProvide the secure code replacement.`;
      const aiResponse = await aiGatewayService.executePrompt(prompt, {
        maxTokens: 500,
        temperature: 0.1,
      });

      return {
        findingId,
        summary: `Automated patch for ${finding.ruleId}: ${finding.title}`,
        patchCode: aiResponse.text || finding.remediation,
      };
    } catch {
      return {
        findingId,
        summary: `Automated patch for ${finding.ruleId}: ${finding.title}`,
        patchCode: `// Remediation for ${finding.ruleId}\n${finding.remediation}`,
      };
    }
  }
}

export const applicationSecurityService = new ApplicationSecurityService();
