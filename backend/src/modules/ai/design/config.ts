import { z } from "zod";
import { AppError } from "../../../utils/app-error.js";
import { encryptPrompt } from "../prompt-vault.js";

export const designConfigSchema = z.object({
  claudeModel: z.string().min(1).max(100),
  stitchModel: z.enum(["GEMINI_3_PRO", "GEMINI_3_FLASH", "GEMINI_3_1_PRO"]),
  maxPages: z.number().int().min(1).max(8),
  dailyUnits: z.number().int().min(1).max(10000),
});
export type DesignConfig = z.infer<typeof designConfigSchema>;
export function designConfig(): DesignConfig {
  const result = designConfigSchema.safeParse({ claudeModel: process.env.AI_CLAUDE_DESIGN_MODEL || process.env.AI_MODEL_PLANNER,
    stitchModel: process.env.AI_STITCH_MODEL || "GEMINI_3_1_PRO", maxPages: Number(process.env.AI_DESIGN_MAX_PAGES || 8), dailyUnits: Number(process.env.AI_DESIGN_DAILY_UNITS || 100) });
  if (!result.success || !process.env.STITCH_API_KEY || !process.env.ANTHROPIC_API_KEY) throw new AppError("Configure Stitch, Claude and an explicit Claude model on the server", 503, "AI_DESIGN_NOT_CONFIGURED");
  encryptPrompt("configuration-check");
  return result.data;
}
export function designAvailability() {
  try { const config = designConfig(); return { available: true, workflow: "stitch-claude", maxBriefCharacters: 64000, maxPages: config.maxPages, scopes: ["site", "page", "selection"], models: { claude: config.claudeModel, stitch: config.stitchModel } }; }
  catch { return { available: false, workflow: "stitch-claude", reason: "AI_DESIGN_NOT_CONFIGURED", maxBriefCharacters: 64000 }; }
}
