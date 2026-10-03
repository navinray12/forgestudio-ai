import { AppError } from "../../../utils/app-error.js";

export type ImageCapability =
  | "generate"
  | "edit"
  | "inpaint"
  | "removeBackground"
  | "variations";

export type ImageCapabilityStatus =
  | "SUPPORTED"
  | "NOT_CONFIGURED"
  | "UNSUPPORTED"
  | "TEMPORARILY_UNAVAILABLE";

export interface ImageCapabilityDetail {
  capability: ImageCapability;
  status: ImageCapabilityStatus;
  provider: string;
  model?: string;
  description: string;
}

export interface ImageProvider {
  name: string;
  getCapabilityStatus(capability: ImageCapability): ImageCapabilityStatus;
  generate(
    prompt: string,
    options: { width: number; height: number; sizeStr: string }
  ): Promise<{ url: string; revisedPrompt?: string }>;
  edit(
    sourceUrl: string,
    instruction: string,
    options?: { sizeStr?: string }
  ): Promise<{ url: string }>;
  inpaint(
    sourceUrl: string,
    maskUrl: string,
    prompt: string,
    options?: { sizeStr?: string }
  ): Promise<{ url: string }>;
  removeBackground(
    sourceUrl: string,
    mimeType: string
  ): Promise<{ url: string }>;
  variations(
    sourceUrl: string,
    count: number,
    options?: { sizeStr?: string }
  ): Promise<Array<{ url: string }>>;
}

/**
 * Real OpenAI Image Provider implementation supporting generation,
 * edits, and variations via official OpenAI image endpoints.
 * Never produces synthetic or fake SVG mockups.
 */
export class OpenAiImageProvider implements ImageProvider {
  name = "openai-dalle";

  getCapabilityStatus(capability: ImageCapability): ImageCapabilityStatus {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return "NOT_CONFIGURED";
    }

    switch (capability) {
      case "generate":
        return "SUPPORTED";
      case "edit":
      case "inpaint":
        // DALL-E 2 supports edits/inpainting with mask; requires square PNG
        return "SUPPORTED";
      case "variations":
        return "SUPPORTED";
      case "removeBackground":
        // Check if specialized remove.bg / replicate API key is configured
        if (process.env.REMOVE_BG_API_KEY || process.env.REPLICATE_API_KEY) {
          return "SUPPORTED";
        }
        return "NOT_CONFIGURED";
      default:
        return "UNSUPPORTED";
    }
  }

  async generate(
    prompt: string,
    options: { width: number; height: number; sizeStr: string }
  ): Promise<{ url: string; revisedPrompt?: string }> {
    const status = this.getCapabilityStatus("generate");
    if (status === "NOT_CONFIGURED") {
      throw new AppError(
        "AI image generation is not configured. Configure OPENAI_API_KEY on the server.",
        503,
        "AI_CAPABILITY_NOT_CONFIGURED"
      );
    }

    const apiKey = process.env.OPENAI_API_KEY!;
    const model = process.env.AI_MODEL_IMAGE || "dall-e-3";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: options.sizeStr,
          response_format: "url",
        }),
      });

      if (response.status === 429) {
        throw new AppError("Image generation rate limit exceeded", 429, "AI_RATE_LIMIT");
      }
      if (response.status === 401 || response.status === 403) {
        throw new AppError("Image provider authentication failed", 503, "AI_AUTH_ERROR");
      }
      if (!response.ok) {
        const err = await response.json().catch(() => null) as any;
        throw new AppError(err?.error?.message || "AI image generation failed", 503, "AI_PROVIDER_UNAVAILABLE");
      }

      const data = await response.json() as any;
      const item = data.data?.[0];
      if (!item?.url) {
        throw new AppError("Image provider returned empty response", 502, "AI_INVALID_OUTPUT");
      }

      return { url: item.url, revisedPrompt: item.revised_prompt };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("Image generation timed out or failed to connect to provider", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
  }

  async edit(
    sourceUrl: string,
    instruction: string,
    options?: { sizeStr?: string }
  ): Promise<{ url: string }> {
    const status = this.getCapabilityStatus("edit");
    if (status === "NOT_CONFIGURED") {
      throw new AppError(
        "AI image editing is not configured. Configure OPENAI_API_KEY on the server.",
        503,
        "AI_CAPABILITY_NOT_CONFIGURED"
      );
    }

    const apiKey = process.env.OPENAI_API_KEY!;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      // Download the source image to submit as multipart form data
      const imgRes = await fetch(sourceUrl);
      if (!imgRes.ok) {
        throw new AppError("Failed to fetch source image for editing", 400, "INVALID_SOURCE_IMAGE");
      }
      const imageBlob = await imgRes.blob();

      const formData = new FormData();
      formData.append("image", imageBlob, "image.png");
      formData.append("prompt", instruction);
      formData.append("n", "1");
      formData.append("size", options?.sizeStr || "1024x1024");
      formData.append("response_format", "url");

      const response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (response.status === 429) {
        throw new AppError("Image edit rate limit exceeded", 429, "AI_RATE_LIMIT");
      }
      if (!response.ok) {
        const err = await response.json().catch(() => null) as any;
        throw new AppError(err?.error?.message || "AI image edit failed", 503, "AI_PROVIDER_UNAVAILABLE");
      }

      const data = await response.json() as any;
      const item = data.data?.[0];
      if (!item?.url) {
        throw new AppError("Image provider returned empty edit response", 502, "AI_INVALID_OUTPUT");
      }

      return { url: item.url };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("Image editing connection failed", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
  }

  async inpaint(
    sourceUrl: string,
    maskUrl: string,
    prompt: string,
    options?: { sizeStr?: string }
  ): Promise<{ url: string }> {
    const status = this.getCapabilityStatus("inpaint");
    if (status === "NOT_CONFIGURED") {
      throw new AppError(
        "AI inpainting is not configured. Configure OPENAI_API_KEY on the server.",
        503,
        "AI_CAPABILITY_NOT_CONFIGURED"
      );
    }

    const apiKey = process.env.OPENAI_API_KEY!;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const [imgRes, maskRes] = await Promise.all([fetch(sourceUrl), fetch(maskUrl)]);
      if (!imgRes.ok || !maskRes.ok) {
        throw new AppError("Failed to fetch source image or mask for inpainting", 400, "INVALID_SOURCE_IMAGE");
      }

      const imageBlob = await imgRes.blob();
      const maskBlob = await maskRes.blob();

      const formData = new FormData();
      formData.append("image", imageBlob, "image.png");
      formData.append("mask", maskBlob, "mask.png");
      formData.append("prompt", prompt);
      formData.append("n", "1");
      formData.append("size", options?.sizeStr || "1024x1024");
      formData.append("response_format", "url");

      const response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        signal: controller.signal,
        headers: { "Authorization": `Bearer ${apiKey}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null) as any;
        throw new AppError(err?.error?.message || "AI inpainting failed", 503, "AI_PROVIDER_UNAVAILABLE");
      }

      const data = await response.json() as any;
      const item = data.data?.[0];
      if (!item?.url) {
        throw new AppError("Image provider returned empty inpaint response", 502, "AI_INVALID_OUTPUT");
      }

      return { url: item.url };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("Inpainting connection failed", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
  }

  async removeBackground(
    sourceUrl: string,
    mimeType: string
  ): Promise<{ url: string }> {
    const status = this.getCapabilityStatus("removeBackground");
    if (status === "NOT_CONFIGURED") {
      throw new AppError(
        "AI background removal is not configured on the server. Configure REMOVE_BG_API_KEY or dedicated segmentation provider.",
        503,
        "AI_CAPABILITY_NOT_CONFIGURED"
      );
    }

    const removeBgKey = process.env.REMOVE_BG_API_KEY;
    if (removeBgKey) {
      const response = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: {
          "X-Api-Key": removeBgKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: sourceUrl,
          size: "auto",
        }),
      });

      if (!response.ok) {
        throw new AppError("Background removal provider error", 503, "AI_PROVIDER_UNAVAILABLE");
      }

      // Return data URL or uploaded URL
      const buf = await response.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      return { url: `data:image/png;base64,${base64}` };
    }

    throw new AppError(
      "AI background removal provider configuration incomplete",
      503,
      "AI_CAPABILITY_NOT_CONFIGURED"
    );
  }

  async variations(
    sourceUrl: string,
    count: number,
    options?: { sizeStr?: string }
  ): Promise<Array<{ url: string }>> {
    const status = this.getCapabilityStatus("variations");
    if (status === "NOT_CONFIGURED") {
      throw new AppError(
        "AI image variations is not configured. Configure OPENAI_API_KEY on the server.",
        503,
        "AI_CAPABILITY_NOT_CONFIGURED"
      );
    }

    const apiKey = process.env.OPENAI_API_KEY!;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const imgRes = await fetch(sourceUrl);
      if (!imgRes.ok) {
        throw new AppError("Failed to fetch source image for variations", 400, "INVALID_SOURCE_IMAGE");
      }
      const imageBlob = await imgRes.blob();

      const formData = new FormData();
      formData.append("image", imageBlob, "image.png");
      formData.append("n", String(Math.min(Math.max(count, 1), 4)));
      formData.append("size", options?.sizeStr || "1024x1024");
      formData.append("response_format", "url");

      const response = await fetch("https://api.openai.com/v1/images/variations", {
        method: "POST",
        signal: controller.signal,
        headers: { "Authorization": `Bearer ${apiKey}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null) as any;
        throw new AppError(err?.error?.message || "AI image variations failed", 503, "AI_PROVIDER_UNAVAILABLE");
      }

      const data = await response.json() as any;
      const items = data.data as Array<{ url: string }>;
      if (!Array.isArray(items) || items.length === 0) {
        throw new AppError("Image provider returned empty variations response", 502, "AI_INVALID_OUTPUT");
      }

      return items.map((item) => ({ url: item.url }));
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("Image variations connection failed", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Global singleton image provider instance
 */
let imageProviderInstance: ImageProvider = new OpenAiImageProvider();

export function getImageProvider(): ImageProvider {
  return imageProviderInstance;
}

export function setImageProviderForTesting(provider: ImageProvider): void {
  imageProviderInstance = provider;
}

/**
 * Returns explicit status matrix of all image AI capabilities.
 */
export function getImageCapabilityMatrix(): ImageCapabilityDetail[] {
  const provider = getImageProvider();
  const caps: ImageCapability[] = ["generate", "edit", "inpaint", "removeBackground", "variations"];
  return caps.map((cap) => ({
    capability: cap,
    status: provider.getCapabilityStatus(cap),
    provider: provider.name,
    model: process.env.AI_MODEL_IMAGE || "dall-e-3",
    description: `Image ${cap} via ${provider.name}`,
  }));
}
