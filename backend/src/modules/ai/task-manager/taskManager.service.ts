/**
 * ForgeStudio Module 42: Task Manager Service
 * Manages user engineering objectives, task statuses, and lifecycle.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { TaskEntity, TaskStatus } from "./taskManager.types.js";
import { eventBusService } from "./eventBus.service.js";

const db = prisma as any;

export class TaskManagerService {
  /**
   * Create a new engineering task
   */
  public async createTask(params: {
    projectId: string;
    title: string;
    objective: string;
    priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    userId?: string;
    metadata?: Record<string, any>;
  }): Promise<TaskEntity> {
    const { projectId, title, objective, priority = "NORMAL", userId, metadata = {} } = params;

    if (!projectId || !title || !objective) {
      throw new AppError("projectId, title, and objective are required", 400, "INVALID_TASK_REQUEST");
    }

    const task = await db.forgeAiTask.create({
      data: {
        projectId,
        userId: userId || null,
        title: title.trim(),
        objective: objective.trim(),
        status: "QUEUED",
        priority,
        metadata,
      },
    });

    await eventBusService.emitEvent({
      projectId,
      taskId: task.id,
      eventType: "AGENT_STARTED",
      payload: { title: task.title, objective: task.objective, priority: task.priority },
    });

    return task;
  }

  /**
   * Get task by ID
   */
  public async getTask(taskId: string): Promise<TaskEntity | null> {
    return await db.forgeAiTask.findUnique({
      where: { id: taskId },
    });
  }

  /**
   * List tasks for project
   */
  public async listTasks(projectId: string, filters: { status?: TaskStatus } = {}): Promise<TaskEntity[]> {
    const where: any = { projectId };
    if (filters.status) where.status = filters.status;

    return await db.forgeAiTask.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Update task status with valid state transitions
   */
  public async updateTaskStatus(taskId: string, status: TaskStatus): Promise<TaskEntity> {
    const task = await this.getTask(taskId);
    if (!task) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");

    const updated = await db.forgeAiTask.update({
      where: { id: taskId },
      data: { status, updatedAt: new Date() },
    });

    return updated;
  }

  /**
   * Attach a generated plan to task
   */
  public async setTaskPlan(taskId: string, planId: string): Promise<TaskEntity> {
    return await db.forgeAiTask.update({
      where: { id: taskId },
      data: { planId, status: "READY", updatedAt: new Date() },
    });
  }
}

export const taskManagerService = new TaskManagerService();
