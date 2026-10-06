/**
 * ForgeStudio Module 55: Application Security Scanning Types
 */

export type SecuritySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ScanType = "FULL" | "SAST" | "DEPENDENCY" | "SECRETS";

export interface SecurityFinding {
  id: string;
  type: "SAST" | "DEPENDENCY" | "SECRET";
  ruleId: string;
  severity: SecuritySeverity;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  snippet?: string;
  remediation: string;
  cve?: string;
}

export interface SecurityScanRecord {
  id: string;
  projectId: string;
  scanType: ScanType;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  score: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: SecurityFinding[];
  passedGates: boolean;
  durationMs: number;
  createdAt: string;
}

export interface SecurityGatePolicy {
  failOnCritical: boolean;
  failOnHigh: boolean;
  minScore: number;
}
