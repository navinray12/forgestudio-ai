/**
 * ForgeStudio Module 19: Model Capability Registry
 * Extensible registry of AI models across OpenAI, Anthropic, Gemini, and custom providers.
 */

import { ModelCapability, AiProviderName, AiTaskClass } from "./aiGateway.types.js";

export const MODEL_REGISTRY: Record<string, ModelCapability> = {
  // OpenAI
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o (Omni)",
    provider: "openai",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    pricingPer1kPromptTokensUsd: 0.005,
    pricingPer1kCompletionTokensUsd: 0.015,
    recommendedFor: ["coding", "creator", "planning", "tool_execution"],
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    pricingPer1kPromptTokensUsd: 0.00015,
    pricingPer1kCompletionTokensUsd: 0.0006,
    recommendedFor: ["website_inspection", "general", "debugging"],
  },

  // Anthropic
  "claude-3-5-sonnet-20241022": {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    pricingPer1kPromptTokensUsd: 0.003,
    pricingPer1kCompletionTokensUsd: 0.015,
    recommendedFor: ["coding", "creator", "planning", "tool_execution"],
  },
  "claude-3-5-haiku-20241022": {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    pricingPer1kPromptTokensUsd: 0.0008,
    pricingPer1kCompletionTokensUsd: 0.004,
    recommendedFor: ["debugging", "general", "website_inspection"],
  },

  // Google Gemini
  "gemini-1.5-pro": {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "gemini",
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    pricingPer1kPromptTokensUsd: 0.00125,
    pricingPer1kCompletionTokensUsd: 0.005,
    recommendedFor: ["creator", "coding", "planning", "website_inspection"],
  },
  "gemini-1.5-flash": {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "gemini",
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    pricingPer1kPromptTokensUsd: 0.000075,
    pricingPer1kCompletionTokensUsd: 0.0003,
    recommendedFor: ["debugging", "general", "website_inspection"],
  },
};

export class ModelRegistry {
  public static getModel(modelId: string): ModelCapability | null {
    return MODEL_REGISTRY[modelId] || null;
  }

  public static listModels(provider?: AiProviderName): ModelCapability[] {
    const list = Object.values(MODEL_REGISTRY);
    if (!provider) return list;
    return list.filter((m) => m.provider === provider);
  }

  public static getBestModelForTask(
    task: AiTaskClass,
    preferredProvider?: AiProviderName
  ): ModelCapability {
    const models = Object.values(MODEL_REGISTRY).filter((m) => {
      if (preferredProvider && m.provider !== preferredProvider) return false;
      return m.recommendedFor.includes(task);
    });

    if (models.length > 0) return models[0];

    // Fallback to highest capability general model
    return (
      (preferredProvider && this.listModels(preferredProvider)[0]) ||
      MODEL_REGISTRY["gpt-4o"] ||
      MODEL_REGISTRY["gemini-1.5-pro"]
    );
  }

  public static registerCustomModel(capability: ModelCapability): void {
    MODEL_REGISTRY[capability.id] = capability;
  }
}
