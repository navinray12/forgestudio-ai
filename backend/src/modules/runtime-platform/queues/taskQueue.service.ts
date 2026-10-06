/**
 * Module 47: Background Jobs & Queue Service
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  TaskQueueConfig,
  QueueJobRecord,
  EnqueueJobDto,
  QueueJobPriority,
} from "./queues.types.js";

export class TaskQueueService {
  /**
   * Create or configure a named Task Queue
   */
  public async createQueue(
    projectId: string,
    name: string,
    options: {
      concurrency?: number;
      maxRetries?: number;
      backoffMs?: number;
      dlqEnabled?: boolean;
    } = {}
  ): Promise<TaskQueueConfig> {
    const queue = await (prisma as any).forgeTaskQueue.create({
      data: {
        projectId,
        name,
        concurrency: options.concurrency || 5,
        maxRetries: options.maxRetries || 3,
        backoffMs: options.backoffMs || 1000,
        dlqEnabled: options.dlqEnabled ?? true,
        isPaused: false,
      },
    });

    return queue;
  }

  /**
   * Get queue by name or ID
   */
  public async getQueue(projectId: string, queueNameOrId: string): Promise<TaskQueueConfig> {
    const queue = await (prisma as any).forgeTaskQueue.findFirst({
      where: {
        projectId,
        OR: [{ id: queueNameOrId }, { name: queueNameOrId }],
      },
    });

    if (!queue) {
      throw new AppError(`Queue '${queueNameOrId}' not found`, 404);
    }

    return queue;
  }

  /**
   * List all queues for a project
   */
  public async listQueues(projectId: string): Promise<TaskQueueConfig[]> {
    return (prisma as any).forgeTaskQueue.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Pause or resume a queue
   */
  public async setQueuePaused(projectId: string, queueNameOrId: string, isPaused: boolean): Promise<TaskQueueConfig> {
    const queue = await this.getQueue(projectId, queueNameOrId);
    return (prisma as any).forgeTaskQueue.update({
      where: { id: queue.id },
      data: { isPaused, updatedAt: new Date() },
    });
  }

  /**
   * Enqueue a new job
   */
  public async enqueueJob(
    projectId: string,
    queueNameOrId: string,
    dto: EnqueueJobDto
  ): Promise<QueueJobRecord> {
    const queue = await this.getQueue(projectId, queueNameOrId);

    const runAt = dto.delayMs ? new Date(Date.now() + dto.delayMs) : new Date();
    const maxAttempts = dto.maxAttempts || queue.maxRetries || 3;
    const priority = dto.priority || "NORMAL";

    const job = await (prisma as any).forgeQueueJob.create({
      data: {
        queueId: queue.id,
        projectId,
        name: dto.name,
        payload: dto.payload || {},
        status: "QUEUED",
        priority,
        attempts: 0,
        maxAttempts,
        runAt,
      },
    });

    return job;
  }

  /**
   * Poll next available job respecting queue pause status and priorities
   */
  public async pollNextJob(
    projectId: string,
    queueNameOrId: string
  ): Promise<QueueJobRecord | null> {
    const queue = await this.getQueue(projectId, queueNameOrId);
    if (queue.isPaused) return null;

    const priorityWeight: Record<QueueJobPriority, number> = {
      CRITICAL: 4,
      HIGH: 3,
      NORMAL: 2,
      LOW: 1,
    };

    // Find candidate jobs
    const now = new Date();
    const candidates = await (prisma as any).forgeQueueJob.findMany({
      where: {
        queueId: queue.id,
        projectId,
        status: "QUEUED",
        runAt: { lte: now },
      },
      take: 10,
    });

    if (!candidates || candidates.length === 0) return null;

    // Pick candidate with highest priority
    candidates.sort((a: any, b: any) => {
      const pDiff = (priorityWeight[b.priority as QueueJobPriority] || 0) - (priorityWeight[a.priority as QueueJobPriority] || 0);
      if (pDiff !== 0) return pDiff;
      return new Date(a.runAt).getTime() - new Date(b.runAt).getTime();
    });

    const chosen = candidates[0];

    // Atomically transition to PROCESSING
    const lockedJob = await (prisma as any).forgeQueueJob.update({
      where: { id: chosen.id },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        attempts: (chosen.attempts || 0) + 1,
        updatedAt: new Date(),
      },
    });

    return lockedJob;
  }

  /**
   * Mark job as COMPLETED
   */
  public async completeJob(jobId: string, result: any = null): Promise<QueueJobRecord> {
    return (prisma as any).forgeQueueJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        result: result || {},
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Fail job with exponential backoff or Dead Letter Queue routing
   */
  public async failJob(jobId: string, error: string): Promise<QueueJobRecord> {
    const job = await (prisma as any).forgeQueueJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new AppError("Job not found", 404);
    }

    const queue = await (prisma as any).forgeTaskQueue.findUnique({
      where: { id: job.queueId },
    });

    const maxAttempts = job.maxAttempts || 3;
    const currentAttempts = job.attempts || 1;

    if (currentAttempts < maxAttempts) {
      // Calculate exponential backoff
      const baseBackoff = queue?.backoffMs || 1000;
      const backoffDelay = baseBackoff * Math.pow(2, currentAttempts - 1);
      const nextRunAt = new Date(Date.now() + backoffDelay);

      return (prisma as any).forgeQueueJob.update({
        where: { id: jobId },
        data: {
          status: "QUEUED",
          runAt: nextRunAt,
          lastError: error,
          updatedAt: new Date(),
        },
      });
    }

    // Retries exhausted
    const finalStatus = queue?.dlqEnabled ? "DEAD_LETTER" : "FAILED";
    return (prisma as any).forgeQueueJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        failedAt: new Date(),
        lastError: error,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Replay a Dead Letter Queue job
   */
  public async replayDlqJob(jobId: string): Promise<QueueJobRecord> {
    return (prisma as any).forgeQueueJob.update({
      where: { id: jobId },
      data: {
        status: "QUEUED",
        attempts: 0,
        runAt: new Date(),
        lastError: null,
        failedAt: null,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Retrieve queue metrics
   */
  public async getQueueMetrics(projectId: string, queueNameOrId: string): Promise<{
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
  }> {
    const queue = await this.getQueue(projectId, queueNameOrId);

    const [queued, processing, completed, failed, deadLetter] = await Promise.all([
      (prisma as any).forgeQueueJob.count({ where: { queueId: queue.id, status: "QUEUED" } }),
      (prisma as any).forgeQueueJob.count({ where: { queueId: queue.id, status: "PROCESSING" } }),
      (prisma as any).forgeQueueJob.count({ where: { queueId: queue.id, status: "COMPLETED" } }),
      (prisma as any).forgeQueueJob.count({ where: { queueId: queue.id, status: "FAILED" } }),
      (prisma as any).forgeQueueJob.count({ where: { queueId: queue.id, status: "DEAD_LETTER" } }),
    ]);

    return { queued, processing, completed, failed, deadLetter };
  }

  /**
   * List jobs in a queue with optional status filter
   */
  public async listJobs(
    projectId: string,
    queueNameOrId: string,
    status?: string,
    limit = 50
  ): Promise<QueueJobRecord[]> {
    const queue = await this.getQueue(projectId, queueNameOrId);
    const where: any = { queueId: queue.id, projectId };
    if (status) where.status = status;

    return (prisma as any).forgeQueueJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    });
  }
}

export const taskQueueService = new TaskQueueService();
