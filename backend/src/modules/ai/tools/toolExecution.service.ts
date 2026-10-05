/**
 * ForgeStudio Module 23: Tool Execution Service
 * Manages tool invocation lifecycle, permission validation, approval gates,
 * sandbox timeouts, output truncation, checkpoints, and audit logging.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { recordAuditLog } from "../../../services/audit.service.js";
import { forgeFilesystemService } from "../../../services/project/forgeFilesystem.service.js";
import {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionRecord,
} from "./toolContract.js";
import { TOOL_REGISTRY } from "./toolRegistry.js";

const db = prisma as any;
const MAX_OUTPUT_SIZE_BYTES = 100 * 1024; // 100 KB max return to prevent context explosion

export class ToolExecutionService {
  /**
   * List all available tools formatted for OpenAI/Anthropic/Gemini function calling schema
   */
  public listTools(category?: string): ToolDefinition[] {
    const tools = Array.from(TOOL_REGISTRY.values());
    if (!category) return tools;
    return tools.filter((t) => t.category === category);
  }

  public getTool(name: string): ToolDefinition | null {
    return TOOL_REGISTRY.get(name) || null;
  }

  /**
   * Main tool execution entrypoint
   */
  public async executeTool(
    name: string,
    parameters: any,
    ctx: ToolExecutionContext
  ): Promise<{ status: string; result?: any; approvalId?: string; recordId: string }> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new AppError(`Tool '${name}' not found in registry`, 404, "TOOL_NOT_FOUND");
    }

    // Check if tool requires approval
    if (tool.requiresApproval && !ctx.approved) {
      const record = await this.recordExecution({
        projectId: ctx.projectId,
        userId: ctx.userId,
        sessionId: ctx.sessionId,
        toolName: name,
        category: tool.category,
        riskLevel: tool.riskLevel,
        status: "APPROVAL_REQUIRED",
        parameters,
        traceId: ctx.traceId,
      });

      await recordAuditLog({
        userId: ctx.userId || "ai-agent",
        action: "ai.tool.approval_requested",
        targetResource: `tool:${name}`,
        details: { toolName: name, riskLevel: tool.riskLevel, recordId: record.id },
      });

      return {
        status: "APPROVAL_REQUIRED",
        approvalId: record.id,
        recordId: record.id,
      };
    }

    // Auto-create checkpoint before HIGH or CRITICAL operations if not already done
    if (tool.riskLevel === "HIGH" || tool.riskLevel === "CRITICAL") {
      await this.createPreExecutionCheckpoint(ctx.projectId, name, ctx.sessionId);
    }

    const record = await this.recordExecution({
      projectId: ctx.projectId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      toolName: name,
      category: tool.category,
      riskLevel: tool.riskLevel,
      status: "EXECUTING",
      parameters,
      traceId: ctx.traceId,
    });

    const startTime = Date.now();
    try {
      // Execute with timeout enforcement
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new AppError(`Tool '${name}' timed out after ${tool.timeoutMs}ms`, 408, "TOOL_TIMEOUT")),
          tool.timeoutMs
        )
      );

      const rawResult = await Promise.race([tool.execute(parameters, ctx), timeoutPromise]);
      const sanitizedResult = this.applyOutputControls(rawResult);
      const durationMs = Date.now() - startTime;

      await this.updateExecution(record.id, {
        status: "COMPLETED",
        result: sanitizedResult,
        executionDurationMs: durationMs,
        completedAt: new Date(),
      });

      await recordAuditLog({
        userId: ctx.userId || "ai-agent",
        action: "ai.tool.executed",
        targetResource: `tool:${name}`,
        details: { toolName: name, durationMs },
      });

      return {
        status: "COMPLETED",
        result: sanitizedResult,
        recordId: record.id,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      await this.updateExecution(record.id, {
        status: "FAILED",
        errorMessage: err.message,
        executionDurationMs: durationMs,
        completedAt: new Date(),
      });

      throw err;
    }
  }

  /**
   * Resolve an approval decision made by a human user
   */
  public async resolveApproval(
    executionId: string,
    decision: "APPROVED" | "DENIED",
    userId: string
  ): Promise<{ success: boolean; result?: any; status: string }> {
    const record = await db.forgeAiToolExecution.findUnique({
      where: { id: executionId },
    });

    if (!record) {
      throw new AppError("Tool execution record not found", 404, "RECORD_NOT_FOUND");
    }

    if (record.status !== "APPROVAL_REQUIRED") {
      throw new AppError("Execution is not awaiting approval", 400, "INVALID_STATE");
    }

    if (decision === "DENIED") {
      await db.forgeAiToolExecution.update({
        where: { id: executionId },
        data: {
          status: "DENIED",
          approvedBy: userId,
          approvedAt: new Date(),
          completedAt: new Date(),
        },
      });
      return { success: true, status: "DENIED" };
    }

    // If APPROVED, execute with approved: true
    await db.forgeAiToolExecution.update({
      where: { id: executionId },
      data: {
        status: "APPROVED",
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    const execRes = await this.executeTool(record.toolName, record.parameters, {
      projectId: record.projectId,
      userId,
      sessionId: record.sessionId,
      approved: true,
    });

    return { success: true, result: execRes.result, status: "COMPLETED" };
  }

  /**
   * Output truncation to preserve model context limits
   */
  private applyOutputControls(result: any): any {
    if (!result) return result;
    const str = JSON.stringify(result);
    if (str.length > MAX_OUTPUT_SIZE_BYTES) {
      return {
        _truncated: true,
        summary: `Output exceeded ${MAX_OUTPUT_SIZE_BYTES} bytes and was summarized`,
        preview: str.slice(0, 4000),
      };
    }
    return result;
  }

  /**
   * Checkpoint creation before high-risk changes
   */
  private async createPreExecutionCheckpoint(
    projectId: string,
    toolName: string,
    sessionId?: string
  ): Promise<void> {
    try {
      const files = await forgeFilesystemService.listFiles(projectId);
      const snapshot = (files as any[]).map((f: any) => ({ path: f.path, hash: f.contentHash }));
      await db.forgeAiCheckpoint.create({
        data: {
          projectId,
          sessionId: sessionId || null,
          name: `Pre-${toolName}-${Date.now()}`,
          description: `Automatic safety checkpoint before executing ${toolName}`,
          filesSnapshot: snapshot,
        },
      });
    } catch {
      // Non-blocking checkpoint creation
    }
  }

  private async recordExecution(data: any): Promise<any> {
    try {
      return await db.forgeAiToolExecution.create({ data });
    } catch {
      return { id: `exec_${Date.now()}`, ...data };
    }
  }

  private async updateExecution(id: string, data: any): Promise<void> {
    try {
      await db.forgeAiToolExecution.update({
        where: { id },
        data,
      });
    } catch {
      // Silent fallback
    }
  }
}

export const toolExecutionService = new ToolExecutionService();
