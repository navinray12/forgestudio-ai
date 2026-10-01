import { AppError } from "../../utils/app-error.js";

export const MAX_SITE_BRIEF_LENGTH = 64_000;

export function validateSiteBrief(prompt: unknown): asserts prompt is string {
  if (typeof prompt !== "string" || prompt.trim().length < 12 || prompt.length > MAX_SITE_BRIEF_LENGTH) {
    throw new AppError("Provide a website brief between 12 and 64,000 characters", 422, "AI_PROMPT_INVALID");
  }
}
