import { AppError } from "../../utils/app-error.js";
import type { AiGenerationRequest, AiGenerationResult, AiProvider } from "./ai-provider.js";
import { SITE_BLUEPRINT_INSTRUCTIONS, SITE_BLUEPRINT_JSON_SCHEMA } from "./site-blueprint.js";
import { resolveAnthropicWorkspaceId } from "./anthropic-workspace.js";
import { GeminiProvider } from "./gemini.provider.js";

/** Server-only Claude Messages adapter with workspace resolution and resilience fallback. */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  constructor(private readonly apiKey = process.env.ANTHROPIC_API_KEY,
    readonly model = process.env.AI_MODEL_PLANNER || "claude-opus-5-5",
    private readonly fetcher: typeof fetch = fetch) { }

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    if (!this.apiKey) {
      if (process.env.GEMINI_API_KEY) {
        return new GeminiProvider().generate(request);
      }
      throw new AppError("AI generation is not configured", 503, "AI_NOT_CONFIGURED");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const signal = request.signal ? AbortSignal.any([request.signal, controller.signal]) : controller.signal;
    try {
      const activeModel = this.model?.startsWith("claude-") ? this.model : "claude-3-7-sonnet-20250219";
      const workspaceId = await resolveAnthropicWorkspaceId(this.apiKey);
      const schema = request.schema || (request.operation === "SITE_GENERATION" ? SITE_BLUEPRINT_JSON_SCHEMA : undefined);
      const defaultInstruction = request.operation === "SITE_GENERATION"
        ? SITE_BLUEPRINT_INSTRUCTIONS
        : "You are a professional website and design AI assistant. Return your response in clean JSON or text as requested.";
      const systemPrompt = request.systemPrompt || (schema
        ? `${defaultInstruction}\n\nIMPORTANT: Return ONLY a raw, valid JSON object strictly matching this schema. Do not wrap in markdown or backticks. Schema:\n${JSON.stringify(schema)}`
        : defaultInstruction);
      const userContent = request.operation === "SITE_GENERATION"
        ? JSON.stringify({ brief: request.prompt, websiteName: request.context.websiteName })
        : JSON.stringify({ prompt: request.prompt, ...request.context });

      const response = await this.fetcher("https://api.anthropic.com/v1/messages", {
        method: "POST", signal,
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
          ...(workspaceId ? { "anthropic-workspace-id": workspaceId } : {})
        },
        body: JSON.stringify({
          model: activeModel,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: "user", content: JSON.stringify({ brief: request.prompt, websiteName: request.context.websiteName }) }],
        }),
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.error(`[ANTHROPIC ERROR ${response.status}]:`, errorBody);
        if ((response.status === 400 || response.status === 401) && process.env.GEMINI_API_KEY) {
          console.warn("[AI] Anthropic API rejected with workspace requirement; falling back to Gemini provider...");
          return await new GeminiProvider().generate(request);
        }
        throw new AppError(`AI provider error: ${response.status}`, 503, "AI_PROVIDER_UNAVAILABLE");
      }
      const body = await response.json().catch(() => null) as { stop_reason?: unknown; content?: Array<{ type?: unknown; text?: unknown }>; id?: unknown; model?: unknown } | null;
      let text = (body?.content?.filter(item => item.type === "text" && typeof item.text === "string").map(item => item.text as string) ?? [])[0] ?? "";
      text = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
      if (!text) throw new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT");
      return {
        text, model: typeof body?.model === "string" ? body.model : activeModel,
        provider: this.name, requestId: typeof body?.id === "string" ? body.id : undefined
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("[ANTHROPIC EXCEPTION]:", error);
      throw new AppError("AI provider request timed out or failed", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally { clearTimeout(timeout); }
  }
}
