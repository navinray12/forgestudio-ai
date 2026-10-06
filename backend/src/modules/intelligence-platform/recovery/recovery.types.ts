/**
 * ForgeStudio Module 63: Project Snapshot / Checkpoint / Recovery Types
 */

export type CheckpointTag =
  | "MANUAL"
  | "PRE_DEPLOY"
  | "PRE_AI_TASK"
  | "PRE_MIGRATION"
  | "DISASTER_RECOVERY";

export interface FileSnapshotItem {
  path: string;
  content: string;
  contentHash: string;
  sizeBytes: number;
  version: number;
}

export interface CheckpointRecord {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  tag: CheckpointTag;
  filesCount: number;
  totalBytes: number;
  filesSnapshot: FileSnapshotItem[];
  manifestSnapshot: Record<string, any>;
  databaseSnapshot: Record<string, any>;
  configSnapshot: Record<string, any>;
  createdById?: string | null;
  createdAt: string;
}

export interface CheckpointDiffItem {
  path: string;
  status: "ADDED" | "MODIFIED" | "DELETED" | "UNCHANGED";
  oldVersion?: number;
  newVersion?: number;
  oldHash?: string;
  newHash?: string;
}

export interface CheckpointDiffResult {
  checkpointId: string;
  comparisonTarget: string;
  totalChanges: number;
  addedCount: number;
  modifiedCount: number;
  deletedCount: number;
  diffs: CheckpointDiffItem[];
}

export interface RollbackResult {
  checkpointId: string;
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  filesRestoredCount: number;
  filesDeletedCount: number;
  durationMs: number;
  restoreLog: Array<{ path: string; action: string; version: number }>;
  restoredAt: string;
}

export interface DisasterRecoveryBundle {
  formatVersion: "1.0";
  exportedAt: string;
  projectId: string;
  checkpoint: CheckpointRecord;
}
