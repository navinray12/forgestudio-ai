/**
 * Module 46: Serverless & Edge Functions Service
 */

import crypto from "node:crypto";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  ServerlessFunctionConfig,
  CreateFunctionDto,
  UpdateFunctionDto,
  FunctionInvocationContext,
  FunctionInvocationResult,
} from "./functions.types.js";
import { FunctionRuntimeSandbox } from "./functionRuntime.js";

export class ServerlessFunctionService {
  /**
   * Create and register a new Serverless Function
   */
  public async createFunction(
    projectId: string,
    dto: CreateFunctionDto
  ): Promise<ServerlessFunctionConfig> {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    const environment = dto.environment || "development";

    const record = await (prisma as any).forgeServerlessFunction.create({
      data: {
        projectId,
        name: dto.name,
        slug,
        description: dto.description || null,
        runtime: dto.runtime || "nodejs20",
        handler: dto.handler || "index.handler",
        code: dto.code,
        environment,
        envVars: dto.envVars || {},
        timeoutMs: dto.timeoutMs || 5000,
        memoryMb: dto.memoryMb || 128,
        status: "ACTIVE",
      },
    });

    return record;
  }

  /**
   * Update an existing function
   */
  public async updateFunction(
    projectId: string,
    functionId: string,
    dto: UpdateFunctionDto
  ): Promise<ServerlessFunctionConfig> {
    const existing = await (prisma as any).forgeServerlessFunction.findFirst({
      where: { id: functionId, projectId },
    });

    if (!existing) {
      throw new AppError("Serverless function not found", 404);
    }

    const data: any = { updatedAt: new Date() };
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.envVars !== undefined) data.envVars = dto.envVars;
    if (dto.timeoutMs !== undefined) data.timeoutMs = dto.timeoutMs;
    if (dto.memoryMb !== undefined) data.memoryMb = dto.memoryMb;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await (prisma as any).forgeServerlessFunction.update({
      where: { id: functionId },
      data,
    });

    return updated;
  }

  /**
   * Retrieve function by ID or name
   */
  public async getFunction(projectId: string, functionIdOrName: string): Promise<ServerlessFunctionConfig> {
    const fn = await (prisma as any).forgeServerlessFunction.findFirst({
      where: {
        projectId,
        OR: [{ id: functionIdOrName }, { name: functionIdOrName }, { slug: functionIdOrName }],
      },
    });

    if (!fn) {
      throw new AppError("Serverless function not found", 404);
    }

    return fn;
  }

  /**
   * List all functions for a project
   */
  public async listFunctions(projectId: string, environment?: string): Promise<ServerlessFunctionConfig[]> {
    const where: any = { projectId };
    if (environment) where.environment = environment;

    return (prisma as any).forgeServerlessFunction.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Delete a function
   */
  public async deleteFunction(projectId: string, functionId: string): Promise<void> {
    await (prisma as any).forgeServerlessFunction.deleteMany({
      where: { id: functionId, projectId },
    });
  }

  /**
   * Invoke a function with payload and execution context
   */
  public async invokeFunction(
    projectId: string,
    functionIdOrName: string,
    payload: any = {},
    trigger: "HTTP" | "EVENT" | "QUEUE" | "CRON" | "MANUAL" = "HTTP",
    additionalContext: Partial<FunctionInvocationContext> = {}
  ): Promise<FunctionInvocationResult> {
    const fn = await this.getFunction(projectId, functionIdOrName);

    if (fn.status !== "ACTIVE") {
      throw new AppError(`Function is ${fn.status} and cannot be invoked`, 400);
    }

    const context: FunctionInvocationContext = {
      projectId,
      functionName: fn.name,
      environment: fn.environment,
      trigger,
      requestId: crypto.randomUUID(),
      env: fn.envVars || {},
      ...additionalContext,
    };

    const handlerParts = (fn.handler || "index.handler").split(".");
    const handlerMethod = handlerParts.length > 1 ? handlerParts[1] : handlerParts[0];

    const execution = await FunctionRuntimeSandbox.execute({
      code: fn.code,
      handlerName: handlerMethod,
      context,
      payload,
      timeoutMs: fn.timeoutMs || 5000,
    });

    // Record invocation audit log
    const invocation = await (prisma as any).forgeFunctionInvocation.create({
      data: {
        functionId: fn.id,
        projectId,
        trigger,
        status: execution.status,
        durationMs: execution.durationMs,
        requestPayload: payload,
        responsePayload: execution.responsePayload,
        logs: execution.logs.join("\n"),
        error: execution.error || null,
      },
    });

    return {
      invocationId: invocation.id,
      functionId: fn.id,
      status: execution.status,
      durationMs: execution.durationMs,
      statusCode: execution.statusCode,
      responsePayload: execution.responsePayload,
      logs: execution.logs,
      error: execution.error,
      createdAt: invocation.createdAt,
    };
  }

  /**
   * Retrieve invocation history & logs
   */
  public async getInvocationLogs(
    projectId: string,
    functionId: string,
    limit = 20
  ): Promise<any[]> {
    return (prisma as any).forgeFunctionInvocation.findMany({
      where: { projectId, functionId },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    });
  }
}

export const serverlessFunctionService = new ServerlessFunctionService();
