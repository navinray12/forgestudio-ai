import { AppError } from "../../utils/app-error.js";
import type { AiGenerationRequest, AiGenerationResult, AiProvider } from "./ai-provider.js";
import { SITE_BLUEPRINT_INSTRUCTIONS, SITE_BLUEPRINT_JSON_SCHEMA } from "./site-blueprint.js";

/** Server-only Gemini generateContent adapter; model output is validated by the changeset service. */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  constructor(private readonly apiKey = process.env.GEMINI_API_KEY,
    readonly model = process.env.AI_MODEL_GEMINI || "gemini-3.5-flash-lite",
    private readonly fetcher: typeof fetch = fetch) {}

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    if (!this.apiKey) throw new AppError("AI generation is not configured", 503, "AI_NOT_CONFIGURED");
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(this.model)) {
      throw new AppError("AI model configuration is invalid", 503, "AI_NOT_CONFIGURED");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const signal = request.signal ? AbortSignal.any([request.signal, controller.signal]) : controller.signal;
    try {
      const response = await this.fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
        { method: "POST", signal,
          headers: { "x-goog-api-key": this.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SITE_BLUEPRINT_INSTRUCTIONS }] },
            contents: [{ role: "user", parts: [{ text: JSON.stringify({ brief: request.prompt, websiteName: request.context.websiteName }) }] }],
            // The v1beta generateContent endpoint currently rejects responseFormat
            // for this model. Keep the documented compatibility fields here until
            // the endpoint accepts responseFormat for live requests.
            generationConfig: { maxOutputTokens: 8192, responseMimeType: "application/json",
              responseJsonSchema: SITE_BLUEPRINT_JSON_SCHEMA },
          }),
        },
      );
      if (!response.ok) throw new AppError("AI provider is temporarily unavailable", 503, "AI_PROVIDER_UNAVAILABLE");
      const body = await response.json().catch(() => null) as {
        responseId?: unknown;
        candidates?: Array<{ finishReason?: unknown; content?: { parts?: Array<{ text?: unknown; thought?: unknown }> } }>;
      } | null;
      const candidate = body?.candidates?.length === 1 ? body.candidates[0] : undefined;
      const texts = candidate?.content?.parts?.filter(part => !part.thought && typeof part.text === "string")
        .map(part => part.text as string) ?? [];
      if (candidate?.finishReason !== "STOP" || texts.length !== 1 || !texts[0]?.trim()) {
        throw new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT");
      }
      return { text: texts[0], model: this.model, provider: this.name,
        requestId: typeof body?.responseId === "string" ? body.responseId : undefined };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("AI provider request timed out or failed", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally { clearTimeout(timeout); }
  }
}
