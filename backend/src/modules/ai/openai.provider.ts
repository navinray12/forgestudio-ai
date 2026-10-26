import { AppError } from "../../utils/app-error.js";
import { reportedUsage, type AiGenerationRequest, type AiGenerationResult, type AiProvider } from "./ai-provider.js";
import { SITE_BLUEPRINT_INSTRUCTIONS, SITE_BLUEPRINT_JSON_SCHEMA } from "./site-blueprint.js";

/** Minimal Responses API adapter. Credentials remain server-only in OPENAI_API_KEY. */
export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  constructor(private readonly apiKey = process.env.OPENAI_API_KEY, readonly model = process.env.AI_MODEL_PLANNER || "gpt-5", private readonly fetcher: typeof fetch = fetch) { }

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    if (!this.apiKey) throw new AppError("AI generation is not configured", 503, "AI_NOT_CONFIGURED");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const signal = request.signal ? AbortSignal.any([request.signal, controller.signal]) : controller.signal;
    try {
      const schema = request.schema || (request.operation === "SITE_GENERATION" ? SITE_BLUEPRINT_JSON_SCHEMA : undefined);
      const instructions = request.systemPrompt || (request.operation === "SITE_GENERATION"
        ? SITE_BLUEPRINT_INSTRUCTIONS
        : "You are a professional website and design AI assistant. Return your response in clean JSON or text as requested.");
      const inputContent = request.operation === "SITE_GENERATION"
        ? JSON.stringify({ brief: request.prompt, websiteName: request.context.websiteName })
        : JSON.stringify({ prompt: request.prompt, ...request.context });

      let response = await this.fetcher("https://api.openai.com/v1/responses", {
        method: "POST", signal,
        headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model, store: false, max_output_tokens: 8192,
          instructions,
          input: [{ role: "user", content: inputContent }],
          text: {
            format: {
              type: "json_schema",
              name: request.operation === "SITE_GENERATION" ? "site_blueprint" : request.operation.toLowerCase(),
              strict: true,
              schema: schema || SITE_BLUEPRINT_JSON_SCHEMA,
            },
          },
        }),
      });

      if (!response.ok) {
        // Fall back to standard /v1/chat/completions for standard OpenAI keys and models
        const activeModel = this.model === "gpt-5" ? (process.env.AI_MODEL_TEXT || "gpt-4o") : this.model;
        const chatResponse = await this.fetcher("https://api.openai.com/v1/chat/completions", {
          method: "POST", signal,
          headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: activeModel,
            messages: [
              { role: "system", content: `${instructions}\n\nIMPORTANT: Return ONLY raw valid JSON conforming to the requested schema. No code fences.` },
              { role: "user", content: inputContent }
            ],
            response_format: { type: "json_object" }
          })
        });
        if (chatResponse.ok) {
          response = chatResponse;
        }
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new AppError("AI provider authentication failed", 401, "AI_AUTH_ERROR");
        if (response.status === 429) throw new AppError("AI provider is rate limited", 429, "AI_RATE_LIMIT");
        throw new AppError("AI provider is temporarily unavailable", 503, "AI_PROVIDER_UNAVAILABLE");
      }

      const body = await response.json().catch(() => null) as any;

      // Handle standard /v1/chat/completions response
      if (body?.choices && Array.isArray(body.choices) && body.choices.length > 0) {
        const text = body.choices[0]?.message?.content?.trim() || "";
        if (!text) throw new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT");
        return {
          text, model: this.model, provider: this.name, requestId: typeof body.id === "string" ? body.id : undefined,
          usage: reportedUsage(body.usage?.prompt_tokens, body.usage?.completion_tokens),
        };
      }

      // Handle /v1/responses format
      const texts = body?.output?.filter((item: any) => item.type === "message").flatMap((item: any) => item.content ?? []).filter((item: any) => item.type === "output_text" && typeof item.text === "string").map((item: any) => item.text as string) ?? [];
      if (body?.status !== "completed" || texts.length !== 1 || !texts[0]?.trim()) throw new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT");
      return {
        text: texts[0], model: this.model, provider: this.name, requestId: typeof body.id === "string" ? body.id : undefined,
        usage: reportedUsage(body.usage?.input_tokens, body.usage?.output_tokens),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("AI provider request timed out or failed", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally { clearTimeout(timeout); }
  }
}
