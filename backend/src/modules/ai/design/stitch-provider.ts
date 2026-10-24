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
      const rawId = result.name || result.id;
      const id = rawId?.replace(/^projects\//, "");
      if (!id) throw new AppError("Stitch project response was incomplete", 503, "AI_EXTERNAL_OUTCOME_UNKNOWN");
      console.log(`[STITCH] created project id=${id}`);
      return id;
    }
    catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Stitch project creation outcome needs reconciliation", 503, "AI_EXTERNAL_OUTCOME_UNKNOWN");
    }
  }
  async generate(projectId: string, prompt: string) {
    try {
      const tools = typeof this.client.listTools === "function" ? await this.client.listTools() : { tools: [] };
      const tool = tools?.tools?.find((item: { name: string }) => item.name === "generate_screen_from_text");
      const schema = tool?.inputSchema as {
        properties?: {
          modelId?: { enum?: string[] };
          deviceType?: { enum?: string[] };
          [key: string]: unknown;
        };
        required?: string[];
      } | undefined;

      const properties = schema?.properties || {};
      const required = Array.isArray(schema?.required) ? schema.required : [];
      const modelIdEnum = properties.modelId?.enum;
      const deviceTypeEnum = properties.deviceType?.enum;
      const optionalFields = Object.keys(properties).filter(k => !required.includes(k));

      console.log("[STITCH CAPABILITIES]");
      console.log("tool: generate_screen_from_text");
      console.log("modelId enum =", JSON.stringify(modelIdEnum || []));
      console.log("deviceType enum =", JSON.stringify(deviceTypeEnum || []));
      console.log("required fields =", JSON.stringify(required));
      console.log("optional fields =", JSON.stringify(optionalFields));

      // Model Resolution (Rules 4 & 5)
      const isExplicit = Boolean(this.model && this.model !== "MODEL_ID_UNSPECIFIED" && this.model.trim() !== "");
      let effectiveModel: string | undefined = undefined;

      if (isExplicit) {
        if (modelIdEnum && modelIdEnum.includes(this.model)) {
          effectiveModel = this.model;
          console.log(`[STITCH] Using configured model: ${effectiveModel}`);
        } else if (modelIdEnum && modelIdEnum.length > 0) {
          throw new AppError(`Configured Stitch model '${this.model}' is invalid. Currently supported models: ${modelIdEnum.join(", ")}`, 400, "AI_BAD_REQUEST");
        } else {
          effectiveModel = this.model;
        }
      } else {
        if (required.includes("modelId")) {
          if (modelIdEnum?.includes("MODEL_ID_UNSPECIFIED")) {
            effectiveModel = "MODEL_ID_UNSPECIFIED";
          } else if (modelIdEnum && modelIdEnum.length > 0) {
            effectiveModel = modelIdEnum.find(m => m !== "MODEL_ID_UNSPECIFIED") || modelIdEnum[0];
          }
          console.log(`[STITCH] modelId is required by tool schema, sending: ${effectiveModel}`);
        } else {
          effectiveModel = undefined;
          console.log(`[STITCH] modelId is optional, omitting to let Stitch use backend default.`);
        }
      }

      // Device Type Validation (Rule 6)
      let effectiveDeviceType = "DESKTOP";
      if (deviceTypeEnum && deviceTypeEnum.length > 0) {
        if (deviceTypeEnum.includes("DESKTOP")) {
          effectiveDeviceType = "DESKTOP";
        } else {
          const fallback = deviceTypeEnum.find(d => /desktop|web/i.test(d)) || deviceTypeEnum[0];
          console.log(`[STITCH] DESKTOP not in enum, using supported deviceType: ${fallback}`);
          effectiveDeviceType = fallback;
        }
      }

      const payload: Record<string, unknown> = {
        projectId,
        prompt,
        deviceType: effectiveDeviceType,
      };
      if (effectiveModel) {
        payload.modelId = effectiveModel;
      }

      console.log(`[STITCH] Dispatching generate_screen_from_text for project=${projectId} deviceType=${effectiveDeviceType}${effectiveModel ? ` modelId=${effectiveModel}` : " (default model)"}`);
      const raw = await this.client.callTool<{
        outputComponents?: Array<{ design?: { screens?: Array<{ id?: string; name?: string }> } }>;
        screens?: Array<{ id?: string; name?: string }>;
      }>("generate_screen_from_text", payload);

      const screen = raw.outputComponents?.find(item => item.design?.screens?.length)?.design?.screens?.[0] || raw.screens?.[0];
      const screenId = screen?.id || screen?.name?.split("/screens/")[1];
      if (!screenId) throw new AppError("Stitch generation response was incomplete", 503, "AI_EXTERNAL_OUTCOME_UNKNOWN");
      console.log(`[STITCH] Generated screen id=${screenId}`);
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
