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

export type PlatformAiCapability =
  | "TEXT"
  | "CONTENT_REFINEMENT"
  | "SECTION"
  | "CONTAINER"
  | "LAYOUT"
  | "BLUEPRINT"
  | "IMAGE_GENERATION"
  | "IMAGE_EDIT"
  | "INPAINTING"
  | "BACKGROUND_REMOVAL"
  | "IMAGE_VARIATIONS"
  | "CODE"
  | "ANIMATION"
  | "SEO"
  | "ACCESSIBILITY"
  | "PERFORMANCE"
  | "DESIGN";

export interface CapabilityRoutingRule {
  capability: PlatformAiCapability;
  primaryProvider: string;
  model: string;
  configured: boolean;
  fallbackProvider: string | null;
  errorBehavior: "THROW_NOT_CONFIGURED" | "FAIL_CLOSED" | "DETERMINISTIC_FALLBACK";
}

/**
 * Explicit provider and capability routing matrix across all 17 AI platform capabilities.
 * Guarantees zero silent downgrades to fake output and explicit error reporting.
 */
export function getPlatformCapabilityMatrix(): CapabilityRoutingRule[] {
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  const textProvider = hasOpenAi ? "openai" : hasGemini ? "gemini" : hasAnthropic ? "anthropic" : "none";
  const textModel = hasOpenAi
    ? (process.env.AI_MODEL_TEXT || "gpt-4o")
    : hasGemini
    ? "gemini-1.5-pro"
    : "claude-3-5-sonnet-20241022";

  return [
    { capability: "TEXT", primaryProvider: textProvider, model: textModel, configured: textProvider !== "none", fallbackProvider: hasGemini && textProvider !== "gemini" ? "gemini" : null, errorBehavior: "THROW_NOT_CONFIGURED" },
    { capability: "CONTENT_REFINEMENT", primaryProvider: textProvider, model: textModel, configured: textProvider !== "none", fallbackProvider: hasGemini && textProvider !== "gemini" ? "gemini" : null, errorBehavior: "THROW_NOT_CONFIGURED" },
    { capability: "SECTION", primaryProvider: textProvider, model: textModel, configured: textProvider !== "none", fallbackProvider: hasGemini && textProvider !== "gemini" ? "gemini" : null, errorBehavior: "THROW_NOT_CONFIGURED" },
    { capability: "CONTAINER", primaryProvider: textProvider, model: textModel, configured: textProvider !== "none", fallbackProvider: hasGemini && textProvider !== "gemini" ? "gemini" : null, errorBehavior: "THROW_NOT_CONFIGURED" },
    { capability: "LAYOUT", primaryProvider: textProvider, model: textModel, configured: textProvider !== "none", fallbackProvider: hasGemini && textProvider !== "gemini" ? "gemini" : null, errorBehavior: "THROW_NOT_CONFIGURED" },
    { capability: "BLUEPRINT", primaryProvider: "stitch-claude", model: "claude-3-5-sonnet", configured: true, fallbackProvider: textProvider !== "none" ? textProvider : null, errorBehavior: "FAIL_CLOSED" },
    { capability: "IMAGE_GENERATION", primaryProvider: "openai-dalle", model: process.env.AI_MODEL_IMAGE || "dall-e-3", configured: hasOpenAi, fallbackProvider: null, errorBehavior: "THROW_NOT_CONFIGURED" },
    { capability: "IMAGE_EDIT", primaryProvider: "openai-dalle", model: "dall-e-2", configured: hasOpenAi, fallbackProvider: null, errorBehavior: "THROW_NOT_CONFIGURED" },
    { capability: "INPAINTING", primaryProvider: "openai-dalle", model: "dall-e-2", configured: hasOpenAi, fallbackProvider: null, errorBehavior: "THROW_NOT_CONFIGURED" },
    { capability: "BACKGROUND_REMOVAL", primaryProvider: "segmentation-provider", model: "rembg", configured: Boolean(process.env.REMOVE_BG_API_KEY), fallbackProvider: null, errorBehavior: "THROW_NOT_CONFIGURED" },
    { capability: "IMAGE_VARIATIONS", primaryProvider: "openai-dalle", model: "dall-e-2", configured: hasOpenAi, fallbackProvider: null, errorBehavior: "THROW_NOT_CONFIGURED" },
    { capability: "CODE", primaryProvider: textProvider, model: textModel, configured: textProvider !== "none", fallbackProvider: null, errorBehavior: "THROW_NOT_CONFIGURED" },
    { capability: "ANIMATION", primaryProvider: textProvider, model: "canonical", configured: textProvider !== "none", fallbackProvider: "deterministic-motion-ast", errorBehavior: "DETERMINISTIC_FALLBACK" },
    { capability: "SEO", primaryProvider: textProvider, model: textModel, configured: textProvider !== "none", fallbackProvider: null, errorBehavior: "THROW_NOT_CONFIGURED" },
    { capability: "ACCESSIBILITY", primaryProvider: "wcag-ast-engine", model: "wcag-2.1-aa", configured: true, fallbackProvider: null, errorBehavior: "DETERMINISTIC_FALLBACK" },
    { capability: "PERFORMANCE", primaryProvider: "dom-ast-engine", model: "static-ast", configured: true, fallbackProvider: "telemetry", errorBehavior: "DETERMINISTIC_FALLBACK" },
    { capability: "DESIGN", primaryProvider: "design-ast-engine", model: "heuristic-ast", configured: true, fallbackProvider: null, errorBehavior: "DETERMINISTIC_FALLBACK" },
  ];
}
