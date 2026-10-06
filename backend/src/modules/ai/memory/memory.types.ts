/**
 * ForgeStudio Module 38: AI Project Memory Types
 */

export type MemoryType =
  | "ARCHITECTURE_DECISION"
  | "CODING_CONVENTION"
  | "PROTECTED_BEHAVIOR"
  | "DO_NOT_BREAK_RULE"
  | "FRAMEWORK_CHOICE"
  | "LIBRARY_CHOICE"
  | "INTEGRATION_CONSTRAINT"
  | "IMPLEMENTATION_PREFERENCE"
  | "DEPLOYMENT_CONSTRAINT"
  | "DATABASE_CONSTRAINT"
  | "SECURITY_RULE"
  | "PERFORMANCE_REQUIREMENT"
  | "BUSINESS_RULE"
  | "VISUAL_BUILDER_RULE"
  | "AI_INSTRUCTION"
  | "KNOWN_ISSUE"
  | "KNOWN_WORKAROUND"
  | "TECHNICAL_DEBT"
  | "MIGRATION_CONSTRAINT";

export type MemorySeverity = "INFO" | "WARNING" | "BLOCKING" | "APPROVAL_REQUIRED";
export type MemoryStatus = "ACTIVE" | "SUPERSEDED" | "REVOKED" | "ARCHIVED";
export type MemorySource = "USER" | "AGENT" | "ARCHITECTURE_REVIEW" | "CODE_ANALYSIS" | "GIT_COMMIT";

export interface ProjectMemoryEntity {
  id: string;
  projectId: string;
  workspaceId?: string;
  type: MemoryType;
  title: string;
  content: string;
  metadata: Record<string, any>;
  source: MemorySource;
  provenance: Record<string, any>;
  confidence: number;
  status: MemoryStatus;
  severity: MemorySeverity;
  version: number;
  tags: string[];
  relatedFiles: string[];
  relatedSymbols: string[];
  relatedModules: string[];
  supersedes?: string | null;
  supersededBy?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryDto {
  projectId: string;
  workspaceId?: string;
  type: MemoryType;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  source?: MemorySource;
  provenance?: Record<string, any>;
  confidence?: number;
  severity?: MemorySeverity;
  tags?: string[];
  relatedFiles?: string[];
  relatedSymbols?: string[];
  relatedModules?: string[];
  createdBy?: string;
}

export interface UpdateMemoryDto {
  title?: string;
  content?: string;
  metadata?: Record<string, any>;
  severity?: MemorySeverity;
  tags?: string[];
  relatedFiles?: string[];
  relatedSymbols?: string[];
  relatedModules?: string[];
}

export interface MemoryConflictEntity {
  id: string;
  projectId: string;
  memoryId: string;
  taskId?: string;
  runId?: string;
  ruleTitle: string;
  severity: MemorySeverity;
  targetFile?: string;
  conflictDescription: string;
  suggestedRemedy?: string;
  resolutionStatus: "PENDING" | "APPROVED_OVERRIDE" | "REJECTED" | "RESOLVED";
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface ConflictReport {
  hasConflict: boolean;
  blocked: boolean;
  requiresApproval: boolean;
  conflicts: MemoryConflictEntity[];
}
