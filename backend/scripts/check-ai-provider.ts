import "dotenv/config";
import { AppError } from "../src/utils/app-error.js";
import type { AiProvider } from "../src/modules/ai/ai-provider.js";
import { AnthropicProvider } from "../src/modules/ai/anthropic.provider.js";
import { GeminiProvider } from "../src/modules/ai/gemini.provider.js";
import { OpenAiProvider } from "../src/modules/ai/openai.provider.js";
import { canonicalSiteFromBlueprint, siteBlueprintIssuePaths } from "../src/modules/ai/site-blueprint.js";

// Opt-in live smoke test. Never print credentials, prompt, provider bodies, or generated content.
const requested = process.argv[2];
const diagnosticFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const response = await fetch(input, init);
  console.log(JSON.stringify({ providerHttpStatus: response.status }));
  if (response.ok && requested === "gemini") {
    const body = await response.clone().json().catch(() => null) as {
      candidates?: Array<{ finishReason?: unknown; content?: { parts?: Array<{ text?: unknown; thought?: unknown }> } }>;
    } | null;
    const candidate = body?.candidates?.[0];
    console.log(JSON.stringify({ candidateCount: body?.candidates?.length ?? 0,
      finishReason: candidate?.finishReason ?? null,
      textPartCount: candidate?.content?.parts?.filter(part => typeof part.text === "string" && !part.thought).length ?? 0 }));
  }
  if (!response.ok) {
    const body = await response.clone().json().catch(() => null) as { error?: { message?: unknown; type?: unknown }; status?: unknown } | null;
    const message = typeof body?.error?.message === "string" ? body.error.message : "";
    console.log(JSON.stringify({ providerErrorType: typeof body?.error?.type === "string" ? body.error.type : undefined,
      providerStatus: typeof body?.status === "string" ? body.status : undefined,
      mentionsModel: /model/i.test(message), mentionsSchema: /schema/i.test(message),
      mentionsFormat: /format/i.test(message), mentionsOutputConfig: /output_config/i.test(message),
      mentionsTokens: /token/i.test(message), mentionsOverload: /overload|capacity/i.test(message),
      mentionsBilling: /credit|balance|billing/i.test(message), mentionsWorkspace: /workspace/i.test(message),
      mentionsVersion: /version/i.test(message), mentionsMessages: /messages/i.test(message) }));
  }
  return response;
}) as typeof fetch;
const providers: Record<string, () => AiProvider> = {
  openai: () => new OpenAiProvider(undefined, undefined, diagnosticFetch),
  anthropic: () => new AnthropicProvider(undefined, undefined, diagnosticFetch),
  gemini: () => new GeminiProvider(undefined, undefined, diagnosticFetch),
};
if (!requested || !(requested in providers)) {
  console.error("Usage: npm --prefix backend run ai:check -- gemini|anthropic|openai");
  process.exit(2);
}
const provider = providers[requested]!();
try {
  const brief = process.argv[3] === "--long"
    ? "Create a premium accounting education website with Home, Programs, About, Admissions, Insights, and Contact pages. "
      + "Use credible concise copy, useful course comparisons, responsive editorial composition, and internal calls to action. ".repeat(260)
    : process.argv[3] || "Create a concise two-page website for a local training centre. Include Home and About pages.";
  const result = await provider.generate({ operation: "SITE_GENERATION",
    prompt: brief,
    context: { websiteName: "Training Centre" } });
  const parsed = JSON.parse(result.text);
  const issuePaths = siteBlueprintIssuePaths(parsed);
  if (issuePaths.length) {
    const pages = Array.isArray(parsed?.pages) ? parsed.pages : [];
    console.log(JSON.stringify({ blueprintIssuePaths: issuePaths.slice(0, 20),
      invalidPageShapes: pages.map((page: Record<string, unknown>, index: number) => ({ index,
        slugString: typeof page?.slug === "string", slugLeadingSlash: typeof page?.slug === "string" && page.slug.startsWith("/"),
        slugHasUppercase: typeof page?.slug === "string" && /[A-Z]/.test(page.slug),
        slugHasWhitespace: typeof page?.slug === "string" && /\s/.test(page.slug),
        sectionLinks: Array.isArray(page?.sections) ? page.sections.map((section: Record<string, unknown>) => ({
          labelPresent: typeof section?.ctaLabel === "string" && section.ctaLabel.length > 0,
          hrefString: typeof section?.ctaHref === "string", hrefLeadingSlash: typeof section?.ctaHref === "string" && section.ctaHref.startsWith("/"),
          hrefLeadingHash: typeof section?.ctaHref === "string" && section.ctaHref.startsWith("#"),
          hrefHttp: typeof section?.ctaHref === "string" && /^https?:/i.test(section.ctaHref),
          hrefEmpty: section?.ctaHref === "",
        })) : [] })).filter((page: { index: number }) => issuePaths.some(path => path.startsWith(`pages.${page.index}.`))) }));
  }
  const draft = canonicalSiteFromBlueprint(parsed);
  console.log(JSON.stringify({ ok: true, provider: result.provider, model: result.model,
    pageCount: draft.pageNames.length, sectionCount: draft.sectionCount }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, provider: provider.name,
    code: error instanceof AppError ? error.code : "AI_INVALID_OUTPUT" }));
  process.exitCode = 1;
}
