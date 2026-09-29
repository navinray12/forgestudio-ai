import { AppError } from "../../utils/app-error.js";
import type { AiGenerationRequest, AiGenerationResult, AiProvider } from "./ai-provider.js";
import { SITE_BLUEPRINT_INSTRUCTIONS, SITE_BLUEPRINT_JSON_SCHEMA } from "./site-blueprint.js";

/** Minimal Responses API adapter. Credentials remain server-only in OPENAI_API_KEY. */
export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  constructor(private readonly apiKey = process.env.OPENAI_API_KEY, readonly model = process.env.AI_MODEL_PLANNER || "gpt-5", private readonly fetcher: typeof fetch = fetch) {}

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    if (!this.apiKey) throw new AppError("AI generation is not configured", 503, "AI_NOT_CONFIGURED");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const signal = request.signal ? AbortSignal.any([request.signal, controller.signal]) : controller.signal;
    try {
      const response = await this.fetcher("https://api.openai.com/v1/responses", {
        method: "POST", signal,
        headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, store: false, max_output_tokens: 8192,
          instructions: SITE_BLUEPRINT_INSTRUCTIONS,
          input: [{ role: "user", content: JSON.stringify({ brief: request.prompt, websiteName: request.context.websiteName }) }],
          text: { format: { type: "json_schema", name: "site_blueprint", strict: true, schema: SITE_BLUEPRINT_JSON_SCHEMA } },
        }),
      });
      if (!response.ok) throw new AppError("AI provider is temporarily unavailable", 503, "AI_PROVIDER_UNAVAILABLE");
      const body = await response.json().catch(() => null) as { status?: unknown; output?: Array<{ type?: unknown; content?: Array<{ type?: unknown; text?: unknown }> }>; id?: unknown } | null;
      const texts = body?.output?.filter(item => item.type === "message").flatMap(item => item.content ?? []).filter(item => item.type === "output_text" && typeof item.text === "string").map(item => item.text as string) ?? [];
      if (body?.status !== "completed" || texts.length !== 1 || !texts[0]?.trim()) throw new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT");
      return { text: texts[0], model: this.model, provider: this.name, requestId: typeof body.id === "string" ? body.id : undefined };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("AI provider request timed out or failed", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally { clearTimeout(timeout); }
  }
}
