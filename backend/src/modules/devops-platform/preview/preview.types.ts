/**
 * ForgeStudio Module 53: Preview Environment Manager Types
 */

export type PreviewEnvironmentStatus =
  | "PENDING"
  | "BUILDING"
  | "ACTIVE"
  | "STOPPED"
  | "EXPIRED"
  | "DESTROYED";

export interface PreviewEnvironmentRecord {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  branch: string;
  pullRequestId?: string | null;
  url: string;
  status: PreviewEnvironmentStatus;
  envVars: Record<string, string>;
  databaseBranchId?: string | null;
  ttlHours: number;
  expiresAt: string;
  lastDeployedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePreviewInput {
  name: string;
  branch: string;
  pullRequestId?: string;
  envVars?: Record<string, string>;
  ttlHours?: number;
  cloneDatabase?: boolean;
}

export interface UpdatePreviewInput {
  name?: string;
  envVars?: Record<string, string>;
  ttlHours?: number;
}

export interface PromotionResult {
  sourceEnvironmentId: string;
  targetEnvironment: "staging" | "production";
  deploymentId: string;
  url: string;
  status: string;
  promotedAt: string;
}
