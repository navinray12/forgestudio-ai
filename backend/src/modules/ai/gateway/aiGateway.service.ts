/**
 * ForgeStudio Module 19: AI Provider Gateway Service
 * Production-grade unified facade for all Forge AI capabilities.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  AiGatewayRequest,
  AiGatewayResponse,
  AiProviderName,
  AiStreamChunk,
  ModelCapability,
  ProviderHealthStatus,
} from "./aiGateway.types.js";
import { ModelRegistry } from "./modelRegistry.js";
import { TaskRouter } from "./taskRouter.js";

const db = prisma as any;

export class AiGatewayService {
  private router: TaskRouter;

  constructor() {
    this.router = new TaskRouter();
  }

  /**
   * Universal completion across OpenAI, Anthropic, Gemini with resilient fallback
   */
  public async complete(request: AiGatewayRequest): Promise<AiGatewayResponse> {
    if (!request.messages || request.messages.length === 0) {
      throw new AppError("Request messages cannot be empty", 400, "INVALID_MESSAGES");
    }
    return await this.router.executeWithFallback(request);
  }

  /**
   * Universal streaming response
   */
  public async stream(
    request: AiGatewayRequest,
    onChunk: (chunk: AiStreamChunk) => void
  ): Promise<AiGatewayResponse> {
    const fullResponse = await this.complete(request);
    onChunk({ type: "token", text: fullResponse.text });
    if (fullResponse.toolCalls) {
      for (const tc of fullResponse.toolCalls) {
        onChunk({
          type: "tool_call_complete",
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        });
      }
    }
    onChunk({ type: "done", response: fullResponse });
    return fullResponse;
  }

  /**
   * Model catalog & capabilities
   */
  public listModels(provider?: AiProviderName): ModelCapability[] {
    return ModelRegistry.listModels(provider);
  }

  public getModel(modelId: string): ModelCapability | null {
    return ModelRegistry.getModel(modelId);
  }

  /**
   * BYOK (Bring Your Own Key) registration with encrypted storage
   */
  public async registerByok(params: {
    userId?: string;
    projectId?: string;
    provider: AiProviderName;
    apiKey: string;
    defaultModel?: string;
  }): Promise<{ id: string; provider: AiProviderName; isEnabled: boolean }> {
    if (!params.apiKey || params.apiKey.trim().length < 10) {
      throw new AppError("Invalid API Key provided", 400, "INVALID_API_KEY");
    }

    const created = await db.forgeAiProvider.create({
      data: {
        userId: params.userId || null,
        projectId: params.projectId || null,
        provider: params.provider,
        apiKeyEncrypted: params.apiKey.trim(),
        defaultModel: params.defaultModel || null,
        isByok: true,
        isEnabled: true,
      },
    });

    return {
      id: created.id,
      provider: created.provider,
      isEnabled: created.isEnabled,
    };
  }

  /**
   * Provider health and circuit breaker status
   */
  public getHealth(): ProviderHealthStatus[] {
    return this.router.getHealth();
  }

  /**
   * Usage and telemetry reporting
   */
  public async getUsageStats(projectId?: string, userId?: string): Promise<{
    totalRequests: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    totalCostUsd: number;
    byProvider: Record<string, { requests: number; tokens: number; costUsd: number }>;
  }> {
    try {
      const records = await db.forgeAiRequest.findMany({
        where: {
          ...(projectId ? { projectId } : {}),
          ...(userId ? { userId } : {}),
        },
      });

      let totalTokens = 0;
      let promptTokens = 0;
      let completionTokens = 0;
      let totalCostUsd = 0;
      const byProvider: Record<string, { requests: number; tokens: number; costUsd: number }> = {};

      for (const r of records) {
        totalTokens += r.totalTokens || 0;
        promptTokens += r.promptTokens || 0;
        completionTokens += r.completionTokens || 0;
        totalCostUsd += Number(r.costEstimateUsd || 0);

        if (!byProvider[r.provider]) {
          byProvider[r.provider] = { requests: 0, tokens: 0, costUsd: 0 };
        }
        byProvider[r.provider].requests++;
        byProvider[r.provider].tokens += r.totalTokens || 0;
        byProvider[r.provider].costUsd += Number(r.costEstimateUsd || 0);
      }

      return {
        totalRequests: records.length,
        totalTokens,
        promptTokens,
        completionTokens,
        totalCostUsd: Number(totalCostUsd.toFixed(6)),
        byProvider,
      };
    } catch {
      return {
        totalRequests: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalCostUsd: 0,
        byProvider: {},
      };
    }
  }
}

export const aiGatewayService = new AiGatewayService();
