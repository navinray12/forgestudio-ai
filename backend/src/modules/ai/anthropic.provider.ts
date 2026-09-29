import { AppError } from "../../utils/app-error.js";
import type { AiGenerationRequest, AiGenerationResult, AiProvider } from "./ai-provider.js";
import { SITE_BLUEPRINT_INSTRUCTIONS, SITE_BLUEPRINT_JSON_SCHEMA } from "./site-blueprint.js";

/** Server-only Claude Messages adapter. Never forwards provider error bodies. */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  constructor(private readonly apiKey = process.env.ANTHROPIC_API_KEY,
    readonly model = process.env.AI_MODEL_PLANNER || "claude-opus-5-5",
    private readonly fetcher: typeof fetch = fetch) {}

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    if (!this.apiKey) throw new AppError("AI generation is not configured", 503, "AI_NOT_CONFIGURED");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const signal = request.signal ? AbortSignal.any([request.signal, controller.signal]) : controller.signal;
    try {
      const response = await this.fetcher("https://api.anthropic.com/v1/messages", {
        method: "POST", signal,
        headers: { "Authorization": `Bearer ${this.apiKey}`, "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
          ...(process.env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } : {}) },
        body: JSON.stringify({ model: this.model, max_tokens: 8192, system: SITE_BLUEPRINT_INSTRUCTIONS,
          messages: [{ role: "user", content: JSON.stringify({ brief: request.prompt, websiteName: request.context.websiteName }) }],
          output_config: { format: { type: "json_schema", schema: SITE_BLUEPRINT_JSON_SCHEMA } },
        }),
      });
      if (!response.ok) throw new AppError("AI provider is temporarily unavailable", 503, "AI_PROVIDER_UNAVAILABLE");
      const body = await response.json().catch(() => null) as { stop_reason?: unknown; content?: Array<{ type?: unknown; text?: unknown }>; id?: unknown; model?: unknown } | null;
      const texts = body?.content?.filter(item => item.type === "text" && typeof item.text === "string").map(item => item.text as string) ?? [];
      if (body?.stop_reason !== "end_turn" || texts.length !== 1 || !texts[0]?.trim()) throw new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT");
      return { text: texts[0], model: typeof body.model === "string" ? body.model : this.model,
        provider: this.name, requestId: typeof body.id === "string" ? body.id : undefined };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("AI provider request timed out or failed", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally { clearTimeout(timeout); }
  }
}
