import { AppError } from "../../utils/app-error.js";
import { reportedUsage, type AiGenerationRequest, type AiGenerationResult, type AiProvider } from "./ai-provider.js";
import { SITE_BLUEPRINT_INSTRUCTIONS, SITE_BLUEPRINT_JSON_SCHEMA } from "./site-blueprint.js";
import { resolveAnthropicWorkspaceId } from "./anthropic-workspace.js";

/** Server-only Claude Messages adapter; preserves the selected provider on failure. */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  constructor(private readonly apiKey = process.env.ANTHROPIC_API_KEY,
    readonly model: string = process.env.AI_MODEL_PLANNER || process.env.AI_CLAUDE_DESIGN_MODEL || "claude-3-5-sonnet-20241022",
    private readonly fetcher: typeof fetch = fetch) { }

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    if (!this.apiKey) {
      throw new AppError("AI generation is not configured", 503, "AI_NOT_CONFIGURED");
    }
    if (!this.model) {
      // The configured model is used as-is; it is never silently replaced.
      throw new AppError("AI generation is not configured: set AI_MODEL_PLANNER", 503, "AI_NOT_CONFIGURED");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const signal = request.signal ? AbortSignal.any([request.signal, controller.signal]) : controller.signal;
    try {
      const activeModel = this.model;
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
          messages: [{ role: "user", content: userContent }],
        }),
      });
      if (!response.ok) {
        // Provider bodies may contain credentials, prompts, and private content:
        // never log the raw body; only surface the provider's structured error message.
        const errorText = await response.text().catch(() => "");
        console.error(`[ANTHROPIC ERROR ${response.status}]`);
        let reason = "";
        try {
          const parsed = JSON.parse(errorText) as { error?: { message?: unknown } };
          if (typeof parsed?.error?.message === "string") reason = `: ${parsed.error.message.slice(0, 300)}`;
        } catch {
          // Non-JSON error bodies are not surfaced.
        }
        throw new AppError(`AI provider error: ${response.status}${reason}`, 503, "AI_PROVIDER_UNAVAILABLE");
      }
      const body = await response.json().catch(() => null) as { stop_reason?: unknown; content?: Array<{ type?: unknown; text?: unknown }>; id?: unknown; model?: unknown; usage?: { input_tokens?: unknown; output_tokens?: unknown } } | null;
      let text = (body?.content?.filter(item => item.type === "text" && typeof item.text === "string").map(item => item.text as string) ?? [])[0] ?? "";
      text = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
      if (!text) throw new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT");
      return {
        text, model: typeof body?.model === "string" ? body.model : activeModel,
        provider: this.name, requestId: typeof body?.id === "string" ? body.id : undefined,
        usage: reportedUsage(body?.usage?.input_tokens, body?.usage?.output_tokens),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("[ANTHROPIC EXCEPTION]: Request failed");
      throw new AppError("AI provider request timed out or failed", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally { clearTimeout(timeout); }
  }
}
