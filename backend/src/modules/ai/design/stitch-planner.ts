import { AppError } from "../../../utils/app-error.js";
import type { DesignPlanner, SitePlan } from "./contracts.js";

/** Single-page admission plan; Stitch performs all generative design work. */
export class StitchOnlyPlanner implements DesignPlanner {
  async plan(brief: string): Promise<SitePlan> {
    return {
      design: "A polished responsive single-page design guided by the complete user brief.",
      pages: [{ name: "Home", slug: "/", brief: brief.length >= 20 ? brief : `User requirements: ${brief}` }],
      setupRequired: ["This proposal provides an editable page layout. Application data, authentication, CRM actions and integrations require separate implementation."],
    };
  }
  async repair(): Promise<string> { throw new AppError("Use Stitch screen repair", 422, "AI_UNSUPPORTED_OPERATION"); }
  async edit(): Promise<never> { throw new AppError("Stitch-only mode supports new page generation; existing text/style edits require the combined workflow", 422, "AI_UNSUPPORTED_OPERATION"); }
}
