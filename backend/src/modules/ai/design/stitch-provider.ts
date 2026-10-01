import { Stitch, StitchToolClient } from "@google/stitch-sdk";
import { AppError } from "../../../utils/app-error.js";
import type { DesignProvider } from "./contracts.js";
import { PrivateStitchClient } from "./stitch-client.js";

/** SDK version is pinned; do not route a failed Stitch design to a text provider. */
export class StitchDesignProvider implements DesignProvider {
  private readonly client: StitchToolClient;
  private readonly sdk: Stitch;
  constructor(private readonly model: "GEMINI_3_PRO" | "GEMINI_3_FLASH" | "GEMINI_3_1_PRO") {
    if (!process.env.STITCH_API_KEY) throw new AppError("Stitch is not configured", 503, "AI_NOT_CONFIGURED");
    this.client = new PrivateStitchClient(process.env.STITCH_API_KEY);
    this.sdk = new Stitch(this.client);
  }
  async createProject(title: string) {
    try { return (await this.sdk.createProject(title)).id; }
    catch { throw new AppError("Stitch project creation outcome needs reconciliation", 503, "AI_EXTERNAL_OUTCOME_UNKNOWN"); }
  }
  async generate(projectId: string, prompt: string) {
    try { const screen = await this.sdk.project(projectId).generate(prompt, "DESKTOP", this.model); return { screenId: screen.id }; }
    catch { throw new AppError("Stitch generation outcome needs reconciliation", 503, "AI_EXTERNAL_OUTCOME_UNKNOWN"); }
  }
  async html(projectId: string, screenId: string) {
    try {
      const url = new URL(await (await this.sdk.project(projectId).getScreen(screenId)).getHtml());
      // Fixed Google export origins, no redirects, no credentials or arbitrary ports.
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
          !["storage.googleapis.com", "lh3.googleusercontent.com"].includes(url.hostname)) throw new Error();
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
      if (!response.ok || !response.body) throw new Error();
      const reader = response.body.getReader(); const parts: Uint8Array[] = []; let bytes = 0;
      while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 1024 * 1024) { await reader.cancel(); throw new Error(); } parts.push(value); }
      return Buffer.concat(parts).toString("utf8");
    } catch { throw new AppError("Stitch export could not be retrieved safely", 502, "AI_EXPORT_UNAVAILABLE"); }
  }
  async close() { await this.client.close().catch(() => undefined); }
}
