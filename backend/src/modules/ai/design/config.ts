import { z } from "zod";
import { AppError } from "../../../utils/app-error.js";
import { encryptPrompt } from "../prompt-vault.js";

export const designConfigSchema = z.object({
  provider: z.enum(["stitch", "stitch-claude"]).default("stitch-claude"),
  claudeModel: z.string().min(1).max(100),
  stitchModel: z.string().min(1).max(100).default("MODEL_ID_UNSPECIFIED"),
  maxPages: z.number().int().min(1).max(8),
  dailyUnits: z.number().int().min(1).max(10000),
});
export type DesignConfig = z.infer<typeof designConfigSchema>;
export function designConfig(): DesignConfig {
  let claudeModel = process.env.AI_CLAUDE_DESIGN_MODEL || process.env.AI_MODEL_PLANNER;
  if (!claudeModel || claudeModel.startsWith("sk-ant-")) {
    claudeModel = "claude-3-5-sonnet-20241022";
  }
  const result = designConfigSchema.safeParse({
    provider: process.env.AI_DESIGN_PROVIDER || "stitch-claude",
    claudeModel,
    stitchModel: process.env.AI_STITCH_MODEL || "MODEL_ID_UNSPECIFIED",
    maxPages: Number(process.env.AI_DESIGN_MAX_PAGES || 8),
    dailyUnits: Number(process.env.AI_DESIGN_DAILY_UNITS || 100),
  });
  if (!result.success || !process.env.STITCH_API_KEY || (result.data.provider === "stitch-claude" && !process.env.ANTHROPIC_API_KEY)) {
    throw new AppError("Configure the selected design provider on the server", 503, "AI_DESIGN_NOT_CONFIGURED");
  }
  encryptPrompt("configuration-check");
  return result.data;
}
export function designAvailability() {
  try {
    const config = designConfig();
    return { available: true, workflow: config.provider, operations: config.provider === "stitch" ? ["GENERATE_SITE"] : ["GENERATE_SITE", "EDIT_DOCUMENT"], maxBriefCharacters: 64000, maxPages: config.provider === "stitch" ? 1 : config.maxPages, scopes: ["site", "page", "selection"], models: { ...(config.provider === "stitch-claude" ? { claude: config.claudeModel } : {}), stitch: config.stitchModel } };
  }
  catch (err: any) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[AI Design] Capability check failed:", err?.message || err);
    }
    return { available: false, workflow: "stitch-claude", reason: "AI_DESIGN_NOT_CONFIGURED", maxBriefCharacters: 64000 };
  }
}
