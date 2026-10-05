import { AppError } from "../../../utils/app-error.js";
import type { DesignProvider } from "./contracts.js";
import { PrivateStitchClient } from "./stitch-client.js";

/** SDK version is pinned; do not route a failed Stitch design to a text provider. */
export class StitchDesignProvider implements DesignProvider {
  private readonly client: PrivateStitchClient;
  constructor(private readonly model: string) {
    if (!process.env.STITCH_API_KEY) throw new AppError("Stitch is not configured", 503, "AI_NOT_CONFIGURED");
    this.client = new PrivateStitchClient(process.env.STITCH_API_KEY);
  }
  async createProject(title: string) {
    try {
      const result = await this.client.callTool<{ name?: string; id?: string }>("create_project", { title });
      const id = result.name?.replace(/^projects\//, "") || result.id;
      if (!id) throw new AppError("Stitch project response was incomplete", 503, "AI_EXTERNAL_OUTCOME_UNKNOWN");
      return id;
    }
    catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Stitch project creation outcome needs reconciliation", 503, "AI_EXTERNAL_OUTCOME_UNKNOWN");
    }
  }
  async generate(projectId: string, prompt: string) {
    try {
      // Discover provider model support before dispatching a paid generation.
      const tools = await this.client.listTools();
      const tool = tools.tools.find(item => item.name === "generate_screen_from_text");
      const schema = tool?.inputSchema as { properties?: { modelId?: { enum?: string[] } } } | undefined;
      if (schema?.properties?.modelId?.enum && !schema.properties.modelId.enum.includes(this.model)) throw new AppError("Configured Stitch model is no longer supported", 400, "AI_BAD_REQUEST");
      const raw = await this.client.callTool<{ outputComponents?: Array<{ design?: { screens?: Array<{ id?: string; name?: string }> } }>; screens?: Array<{ id?: string; name?: string }> }>("generate_screen_from_text", { projectId, prompt, deviceType: "DESKTOP", modelId: this.model });
      const screen = raw.outputComponents?.find(item => item.design?.screens?.length)?.design?.screens?.[0] || raw.screens?.[0];
      const screenId = screen?.id || screen?.name?.split("/screens/")[1];
      if (!screenId) throw new AppError("Stitch generation response was incomplete", 503, "AI_EXTERNAL_OUTCOME_UNKNOWN");
      return { screenId };
    }
    catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Stitch generation outcome needs reconciliation", 503, "AI_EXTERNAL_OUTCOME_UNKNOWN");
    }
  }
  async html(projectId: string, screenId: string) {
    try {
      const screen = await this.client.callTool<{ htmlCode?: { downloadUrl?: string } }>("get_screen", { name: `projects/${projectId}/screens/${screenId}` });
      const url = new URL(screen.htmlCode?.downloadUrl || "");
      // Fixed Google export origins, no redirects, no credentials or arbitrary ports.
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
          !["storage.googleapis.com", "lh3.googleusercontent.com", "contribution.usercontent.google.com"].includes(url.hostname)) throw new Error();
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
      if (!response.ok || !response.body) throw new Error();
      const reader = response.body.getReader(); const parts: Uint8Array[] = []; let bytes = 0;
      while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 1024 * 1024) { await reader.cancel(); throw new Error(); } parts.push(value); }
      const html = Buffer.concat(parts).toString("utf8");
      if (!/<(?:html|body|main|section|div|h[1-6])(?:\s|>)/i.test(html)) throw new AppError("Stitch export did not contain a page", 502, "AI_INVALID_OUTPUT");
      return html;
    } catch (error) { if (error instanceof AppError) throw error; throw new AppError("Stitch export could not be retrieved safely", 502, "AI_EXPORT_UNAVAILABLE"); }
  }
  async close() { await this.client.close().catch(() => undefined); }
}
