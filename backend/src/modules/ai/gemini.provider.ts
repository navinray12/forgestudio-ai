import { AppError } from "../../utils/app-error.js";
import { reportedUsage, type AiGenerationRequest, type AiGenerationResult, type AiProvider } from "./ai-provider.js";
import { SITE_BLUEPRINT_INSTRUCTIONS, SITE_BLUEPRINT_JSON_SCHEMA } from "./site-blueprint.js";

/** Server-only Gemini generateContent adapter; model output is validated by the changeset service. */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  constructor(private readonly apiKey = process.env.GEMINI_API_KEY,
    readonly model = process.env.AI_MODEL_GEMINI || "gemini-3.5-flash-lite",
    private readonly fetcher: typeof fetch = fetch) { }

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    if (!this.apiKey) throw new AppError("AI generation is not configured", 503, "AI_NOT_CONFIGURED");
    const activeModel = this.model || "gemini-3.5-flash-lite";
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(activeModel)) {
      throw new AppError("AI model configuration is invalid", 503, "AI_NOT_CONFIGURED");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const signal = request.signal ? AbortSignal.any([request.signal, controller.signal]) : controller.signal;
    try {
      const systemText = request.systemPrompt || (request.operation === "SITE_GENERATION" ? SITE_BLUEPRINT_INSTRUCTIONS : "You are a professional website and design AI assistant. Return your response in clean JSON or text as requested.");
      const userContent = request.operation === "SITE_GENERATION"
        ? JSON.stringify({ brief: request.prompt, websiteName: request.context.websiteName })
        : JSON.stringify({ prompt: request.prompt, ...request.context });
      const schema = request.schema || (request.operation === "SITE_GENERATION" ? SITE_BLUEPRINT_JSON_SCHEMA : undefined);

      let response = await this.fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent`,
        {
          method: "POST", signal,
          headers: { "x-goog-api-key": this.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemText }] },
            contents: [{ role: "user", parts: [{ text: userContent }] }],
            generationConfig: {
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
              ...(schema ? { responseJsonSchema: schema } : {}),
            },
          }),
        },
      );
      if (!response.ok && response.status === 404 && activeModel !== "gemini-1.5-flash") {
        response = await this.fetcher(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
          {
            method: "POST", signal,
            headers: { "x-goog-api-key": this.apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemText }] },
              contents: [{ role: "user", parts: [{ text: userContent }] }],
              generationConfig: {
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
                ...(schema ? { responseJsonSchema: schema } : {}),
              },
            }),
          },
        );
      }
      if (!response.ok) {
        // Provider bodies may contain credentials, prompts, and private content.
        console.error(`[GEMINI ERROR ${response.status}]`);
        if (response.status === 401 || response.status === 403) {
          throw new AppError("AI provider authentication failed", 401, "AI_AUTH_ERROR");
        }
        if (response.status === 429) {
          throw new AppError("AI provider is rate limited", 429, "AI_RATE_LIMIT");
        }
        if (response.status === 404 || response.status === 400) {
          throw new AppError(`AI provider rejected request: ${response.status}`, 400, "AI_BAD_REQUEST");
        }
        throw new AppError("AI provider is temporarily unavailable", 503, "AI_PROVIDER_UNAVAILABLE");
      }
      const body = await response.json().catch(() => null) as {
        responseId?: unknown;
        usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown };
        candidates?: Array<{ finishReason?: unknown; content?: { parts?: Array<{ text?: unknown; thought?: unknown }> } }>;
      } | null;
      const candidate = body?.candidates?.length === 1 ? body.candidates[0] : undefined;
      const texts = candidate?.content?.parts?.filter(part => !part.thought && typeof part.text === "string")
        .map(part => part.text as string) ?? [];
      if (candidate?.finishReason !== "STOP" || texts.length !== 1 || !texts[0]?.trim()) {
        throw new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT");
      }
      return {
        text: texts[0], model: activeModel, provider: this.name,
        requestId: typeof body?.responseId === "string" ? body.responseId : undefined,
        usage: reportedUsage(body?.usageMetadata?.promptTokenCount, body?.usageMetadata?.candidatesTokenCount),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        console.error("[GEMINI TIMEOUT]: Request timed out or aborted");
        throw new AppError("AI provider request timed out", 504, "AI_TIMEOUT");
      }
      console.error("[GEMINI EXCEPTION]: Request failed");
      throw new AppError("AI provider request could not complete", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally { clearTimeout(timeout); }
  }
}
