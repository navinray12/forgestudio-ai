import { AppError } from "../../utils/app-error.js";
import type { AiProvider } from "./ai-provider.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { OpenAiProvider } from "./openai.provider.js";

export function siteGenerationProvider(): AiProvider {
  switch (process.env.AI_SITE_PROVIDER || "openai") {
    case "openai": return new OpenAiProvider();
    case "anthropic": return new AnthropicProvider();
    default: throw new AppError("AI provider configuration is invalid", 503, "AI_NOT_CONFIGURED");
  }
}
