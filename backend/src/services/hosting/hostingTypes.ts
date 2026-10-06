/**
 * ForgeStudio Hosting, CI/CD, and Domain Automation Types
 * Modules 29, 30, and 31 Architecture Contracts
 */

export type DeploymentEnvironment = "preview" | "staging" | "production" | "development";

export type DeploymentMode = "STATIC" | "SERVER_RENDERED" | "SERVER_RUNTIME";

export type DeploymentStatus =
  | "QUEUED"
  | "VALIDATING"
  | "BUILDING"
  | "ARTIFACT_READY"
  | "DEPLOYING"
  | "HEALTH_CHECKING"
  | "ACTIVE"
  | "FAILED"
  | "CANCELLED"
  | "ROLLING_BACK"
  | "ROLLED_BACK";

export interface HealthCheckConfig {
  protocol: "http" | "https";
  path: string;
  expectedStatus: number;
  timeoutMs: number;
  retries: number;
  intervalMs: number;
}

export interface DeploymentLogEntry {
  timestamp: string;
  stage: string;
  level: "info" | "warn" | "error";
  message: string;
  durationMs?: number;
}

export interface DeploymentEntity {
  id: string;
  projectId: string;
  environment: DeploymentEnvironment;
  mode: DeploymentMode;
  status: DeploymentStatus;
  artifactId?: string | null;
  commitHash?: string | null;
  branch: string;
  url?: string | null;
  config: {
    port?: number;
    nodeVersion?: string;
    envVars?: Record<string, string>;
    memoryMb?: number;
    cpuShares?: number;
    customDomain?: string;
  };
  logs: DeploymentLogEntry[];
  healthCheck?: {
    lastCheckedAt?: string;
    passed?: boolean;
    statusCode?: number;
    latencyMs?: number;
    error?: string;
  };
  rollbackFromId?: string | null;
  durationMs?: number | null;
  createdById?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ---------------------------------------------------------------------------
// Module 30: CI/CD Pipeline Types
// ---------------------------------------------------------------------------

export type PipelineTrigger = "push" | "pull_request" | "manual" | "schedule";

export type PipelineStatus =
  | "QUEUED"
  | "RUNNING"
  | "WAITING_APPROVAL"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

export type PipelineStageStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "SKIPPED"
  | "WAITING_APPROVAL";

export interface PipelineStage {
  id: string;
  name: string;
  status: PipelineStageStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  logs: string[];
  error?: string;
  details?: Record<string, any>;
}

export interface PipelineApprovalGate {
  required: boolean;
  environment: DeploymentEnvironment;
  requestedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  reason?: string;
  rejected?: boolean;
}

export interface PipelineEntity {
  id: string;
  projectId: string;
  name: string;
  trigger: PipelineTrigger;
  environment: DeploymentEnvironment;
  status: PipelineStatus;
  commitHash?: string | null;
  branch: string;
  stages: PipelineStage[];
  artifacts: Array<{
    id: string;
    name: string;
    sizeBytes: number;
    contentHash: string;
  }>;
  approvalGate?: PipelineApprovalGate;
  deploymentId?: string | null;
  logs: DeploymentLogEntry[];
  startedAt: Date | string;
  completedAt?: Date | string | null;
  createdById?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ---------------------------------------------------------------------------
// Module 31: GoDaddy & Custom Domain Automation Types
// ---------------------------------------------------------------------------

export type DomainStatus = "PENDING" | "VERIFYING" | "ACTIVE" | "FAILED" | "DETACHED";

export type SslStatus = "PENDING_DNS" | "PROVISIONING" | "ACTIVE" | "FAILED" | "EXPIRED";

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "NS" | "SRV";

export interface DnsRecord {
  type: DnsRecordType;
  name: string;
  data: string;
  ttl?: number;
  priority?: number;
}

export interface DomainAvailabilityResult {
  domain: string;
  available: boolean;
  status: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN" | "ERROR";
  price?: number;
  currency?: string;
  period?: number;
  tld: string;
  definitive: boolean;
}

export interface CustomDomainEntity {
  id: string;
  projectId: string;
  domain: string;
  provider: "godaddy" | "manual" | "cloudflare";
  environment: DeploymentEnvironment;
  deploymentId?: string | null;
  status: DomainStatus;
  verificationMethod: "TXT" | "CNAME";
  verificationToken: string;
  dnsRecords: DnsRecord[];
  sslStatus: SslStatus;
  sslIssuer?: string | null;
  sslExpiresAt?: Date | string | null;
  expiresAt?: Date | string | null;
  autoRenew: boolean;
  lastCheckedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface DomainProvider {
  readonly providerName: string;
  checkAvailability(domain: string): Promise<DomainAvailabilityResult>;
  getDnsRecords(domain: string): Promise<DnsRecord[]>;
  updateDnsRecords(domain: string, records: DnsRecord[]): Promise<boolean>;
  addDnsRecord(domain: string, record: DnsRecord): Promise<boolean>;
  removeDnsRecord(domain: string, type: string, name: string): Promise<boolean>;
  verifyDnsPropagation(domain: string, expectedType: DnsRecordType, expectedValue: string): Promise<boolean>;
  purchaseDomain?(domain: string, contactInfo: any): Promise<{ success: boolean; orderId?: string; error?: string }>;
}
