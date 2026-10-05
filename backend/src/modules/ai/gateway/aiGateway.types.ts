/**
 * ForgeStudio Module 19: AI Provider Gateway Types
 * Provider-neutral interface definitions for LLM generation, streaming, tool-calling,
 * structured outputs, BYOK, rate limiting, and telemetry.
 */

export type AiProviderName = "openai" | "anthropic" | "gemini" | "custom";

export type AiTaskClass =
  | "creator"
  | "coding"
  | "website_inspection"
  | "debugging"
  | "planning"
  | "general"
  | "tool_execution";

export interface AiChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface AiToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
    strict?: boolean;
  };
}

export interface AiGatewayRequest {
  task: AiTaskClass;
  messages: AiChatMessage[];
  model?: string;
  provider?: AiProviderName;
  temperature?: number;
  maxTokens?: number;
  tools?: AiToolDefinition[];
  toolChoice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  responseFormat?: { type: "text" | "json_object" | "json_schema"; json_schema?: Record<string, unknown> };
  systemInstruction?: string;
  projectId?: string;
  userId?: string;
  traceId?: string;
  signal?: AbortSignal;
}

export interface AiGatewayResponse {
  id: string;
  provider: AiProviderName;
  model: string;
  text: string;
  toolCalls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  structuredOutput?: any;
  finishReason: "stop" | "tool_calls" | "length" | "content_filter" | "error";
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  latencyMs: number;
  traceId: string;
}

export type AiStreamChunk =
  | { type: "token"; text: string }
  | { type: "tool_call_start"; id: string; name: string }
  | { type: "tool_call_delta"; id: string; argumentsDelta: string }
  | { type: "tool_call_complete"; id: string; name: string; arguments: string }
  | { type: "done"; response: AiGatewayResponse }
  | { type: "error"; error: string; code: string };

export interface ModelCapability {
  id: string;
  name: string;
  provider: AiProviderName;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  pricingPer1kPromptTokensUsd: number;
  pricingPer1kCompletionTokensUsd: number;
  recommendedFor: AiTaskClass[];
}

export interface ProviderHealthStatus {
  provider: AiProviderName;
  available: boolean;
  circuitStatus: "CLOSED" | "HALF_OPEN" | "OPEN";
  errorCount: number;
  lastSuccessAt: Date | null;
  averageLatencyMs: number;
}
