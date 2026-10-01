import { AppError } from "../../utils/app-error.js";
import type { AiProvider } from "./ai-provider.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { GeminiProvider } from "./gemini.provider.js";
import { OpenAiProvider } from "./openai.provider.js";

/** Retries retain the recorded provider/model; changed defaults are not a fallback. */
export function siteGenerationProviderFromSnapshot(snapshot: { provider: string; model: string }): AiProvider {
  if (!snapshot.model) throw new AppError("AI model configuration is invalid", 503, "AI_NOT_CONFIGURED");
  switch (snapshot.provider) {
    case "anthropic": return new AnthropicProvider(undefined, snapshot.model);
    case "gemini": return new GeminiProvider(undefined, snapshot.model);
    case "openai": return new OpenAiProvider(undefined, snapshot.model);
    default: throw new AppError("The original AI provider is unavailable", 503, "AI_NOT_CONFIGURED");
  }
}

export function siteGenerationProvider(): AiProvider {
  switch (process.env.AI_SITE_PROVIDER || "openai") {
    // A missing OpenAI key can use a configured Gemini key without sending any
    // request (or billing) to OpenAI. Runtime provider failures do not silently
    // cross providers; the actor can retry after resolving the failure.
    case "openai": return !process.env.OPENAI_API_KEY && process.env.GEMINI_API_KEY
      ? new GeminiProvider() : new OpenAiProvider();
    case "anthropic": return new AnthropicProvider();
    case "gemini": return new GeminiProvider();
    default: throw new AppError("AI provider configuration is invalid", 503, "AI_NOT_CONFIGURED");
  }
}
