/**
 * Module 47: Background Jobs & Task Queue Types
 */

export interface TaskQueueConfig {
  id: string;
  projectId: string;
  name: string;
  concurrency: number;
  maxRetries: number;
  backoffMs: number;
  dlqEnabled: boolean;
  isPaused: boolean;
  createdAt: string;
  updatedAt: string;
}

export type QueueJobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "DEAD_LETTER";
export type QueueJobPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export interface QueueJobRecord {
  id: string;
  queueId: string;
  projectId: string;
  name: string;
  payload: any;
  status: QueueJobStatus;
  priority: QueueJobPriority;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  lastError?: string;
  result?: any;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueJobDto {
  name: string;
  payload: any;
  priority?: QueueJobPriority;
  delayMs?: number;
  maxAttempts?: number;
}
