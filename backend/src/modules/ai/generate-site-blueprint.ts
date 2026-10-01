import { AppError } from "../../utils/app-error.js";
import type { AiProvider, AiGenerationResult } from "./ai-provider.js";
import { canonicalSiteFromBlueprint } from "./site-blueprint.js";

type CanonicalDraft = ReturnType<typeof canonicalSiteFromBlueprint>;

function parseDraft(result: AiGenerationResult, websiteName: string): CanonicalDraft {
  let parsed: unknown;
  try { parsed = JSON.parse(result.text); }
  catch { throw new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT"); }
  return canonicalSiteFromBlueprint(parsed, websiteName);
}

/** One bounded repair attempt; provider text never enters logs or the repair prompt. */
export async function generateValidatedSiteBlueprint(provider: AiProvider, prompt: string, websiteName: string):
  Promise<{ result: AiGenerationResult; draft: CanonicalDraft }> {
  let invalidOutput: AppError | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const repairInstruction = attempt === 0 ? "" :
      "\n\nFORMAT REPAIR: The previous draft was invalid. Preserve the important factual and visual requirements above, " +
      "but produce a complete, concise JSON website draft. Use exactly 4 to 6 pages and no more than 5 sections per page. " +
      "The first page slug must be '/'. Keep headings under 100 characters, bodies under 600 characters, " +
      "and use only internal page paths for CTA links. Omit unsupported features instead of adding fields. " +
      "Do not repeat the previous response or include explanations.";
    try {
      const result = await provider.generate({ operation: "SITE_GENERATION", prompt: prompt + repairInstruction,
        context: { websiteName } });
      return { result, draft: parseDraft(result, websiteName) };
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "AI_INVALID_OUTPUT") throw error;
      invalidOutput = error;
    }
  }
  throw invalidOutput ?? new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT");
}
