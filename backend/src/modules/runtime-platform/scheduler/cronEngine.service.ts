/**
 * Module 48: Scheduler / Cron Engine Service
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  CronScheduleConfig,
  CreateCronScheduleDto,
  CronExecutionRecord,
} from "./scheduler.types.js";
import { CronParser } from "./cronParser.js";
import { serverlessFunctionService } from "../functions/serverlessFunction.service.js";
import { taskQueueService } from "../queues/taskQueue.service.js";

export class CronEngineService {
  /**
   * Register a new cron schedule
   */
  public async createSchedule(
    projectId: string,
    dto: CreateCronScheduleDto
  ): Promise<CronScheduleConfig> {
    if (!CronParser.isValid(dto.cronExpression)) {
      throw new AppError(`Invalid cron expression '${dto.cronExpression}'`, 400);
    }

    const nextRunAt = CronParser.getNextRunDate(dto.cronExpression);

    const schedule = await (prisma as any).forgeCronSchedule.create({
      data: {
        projectId,
        name: dto.name,
        cronExpression: dto.cronExpression,
        timezone: dto.timezone || "UTC",
        targetType: dto.targetType,
        targetPayload: dto.targetPayload || {},
        targetDestination: dto.targetDestination,
        isActive: true,
        nextRunAt,
      },
    });

    return schedule;
  }

  /**
   * List schedules for a project
   */
  public async listSchedules(projectId: string): Promise<CronScheduleConfig[]> {
    return (prisma as any).forgeCronSchedule.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get schedule by ID or name
   */
  public async getSchedule(projectId: string, scheduleIdOrName: string): Promise<CronScheduleConfig> {
    const schedule = await (prisma as any).forgeCronSchedule.findFirst({
      where: {
        projectId,
        OR: [{ id: scheduleIdOrName }, { name: scheduleIdOrName }],
      },
    });

    if (!schedule) {
      throw new AppError("Cron schedule not found", 404);
    }

    return schedule;
  }

  /**
   * Update a schedule
   */
  public async updateSchedule(
    projectId: string,
    scheduleId: string,
    data: Partial<CreateCronScheduleDto & { isActive: boolean }>
  ): Promise<CronScheduleConfig> {
    const existing = await this.getSchedule(projectId, scheduleId);

    const updateData: any = { updatedAt: new Date() };
    if (data.name) updateData.name = data.name;
    if (data.cronExpression) {
      if (!CronParser.isValid(data.cronExpression)) {
        throw new AppError(`Invalid cron expression '${data.cronExpression}'`, 400);
      }
      updateData.cronExpression = data.cronExpression;
      updateData.nextRunAt = CronParser.getNextRunDate(data.cronExpression);
    }
    if (data.targetType) updateData.targetType = data.targetType;
    if (data.targetDestination) updateData.targetDestination = data.targetDestination;
    if (data.targetPayload !== undefined) updateData.targetPayload = data.targetPayload;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return (prisma as any).forgeCronSchedule.update({
      where: { id: existing.id },
      data: updateData,
    });
  }

  /**
   * Delete schedule
   */
  public async deleteSchedule(projectId: string, scheduleId: string): Promise<void> {
    await (prisma as any).forgeCronSchedule.deleteMany({
      where: { id: scheduleId, projectId },
    });
  }

  /**
   * Execute a schedule immediately (either triggered by cron cycle or manually)
   */
  public async executeSchedule(
    projectId: string,
    scheduleIdOrName: string,
    isManual = false
  ): Promise<CronExecutionRecord> {
    const schedule = await this.getSchedule(projectId, scheduleIdOrName);
    const startTime = Date.now();
    let status: "SUCCESS" | "FAILED" = "SUCCESS";
    let output: any = null;
    let errorMessage: string | undefined = undefined;

    try {
      if (schedule.targetType === "FUNCTION") {
        const fnResult = await serverlessFunctionService.invokeFunction(
          projectId,
          schedule.targetDestination,
          schedule.targetPayload,
          "CRON",
          { trigger: "CRON" }
        );
        output = fnResult;
        if (fnResult.status === "ERROR") {
          status = "FAILED";
          errorMessage = fnResult.error || "Function execution failed";
        }
      } else if (schedule.targetType === "QUEUE_JOB") {
        const job = await taskQueueService.enqueueJob(
          projectId,
          schedule.targetDestination,
          {
            name: `cron-${schedule.name}-${Date.now()}`,
            payload: schedule.targetPayload,
            priority: "NORMAL",
          }
        );
        output = { jobId: job.id, queue: schedule.targetDestination };
      } else if (schedule.targetType === "WEBHOOK") {
        const resp = await fetch(schedule.targetDestination, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forge-Cron": schedule.name },
          body: JSON.stringify(schedule.targetPayload),
        });
        output = { statusCode: resp.status, ok: resp.ok };
        if (!resp.ok) {
          status = "FAILED";
          errorMessage = `HTTP ${resp.status} ${resp.statusText}`;
        }
      } else {
        output = { message: "Event target triggered" };
      }
    } catch (err: any) {
      status = "FAILED";
      errorMessage = err.message || String(err);
    }

    const durationMs = Date.now() - startTime;

    // Record execution record
    const execution = await (prisma as any).forgeCronExecution.create({
      data: {
        scheduleId: schedule.id,
        projectId,
        status,
        durationMs,
        output,
        errorMessage: errorMessage || null,
        executedAt: new Date(),
      },
    });

    // Advance schedule nextRunAt if this was an automatic or manual run
    const nextRunAt = CronParser.getNextRunDate(schedule.cronExpression);
    await (prisma as any).forgeCronSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
        updatedAt: new Date(),
      },
    });

    return execution;
  }

  /**
   * Evaluates all due schedules and triggers them
   */
  public async evaluateDueSchedules(): Promise<number> {
    const now = new Date();
    const dueSchedules = await (prisma as any).forgeCronSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      take: 50,
    });

    let executedCount = 0;
    for (const schedule of dueSchedules) {
      try {
        await this.executeSchedule(schedule.projectId, schedule.id, false);
        executedCount++;
      } catch (err) {
        console.error(`[CronEngine] Failed executing schedule ${schedule.id}:`, err);
      }
    }

    return executedCount;
  }

  /**
   * Retrieve execution history
   */
  public async getExecutionHistory(
    projectId: string,
    scheduleId: string,
    limit = 20
  ): Promise<CronExecutionRecord[]> {
    return (prisma as any).forgeCronExecution.findMany({
      where: { projectId, scheduleId },
      orderBy: { executedAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    });
  }
}

export const cronEngineService = new CronEngineService();
