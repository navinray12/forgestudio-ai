import { StitchToolClient } from "@google/stitch-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { AppError } from "../../../utils/app-error.js";

interface RequestAudit {
  dispatched: boolean;
  headersReceived: boolean;
  status?: number;
  error?: unknown;
}

/** Keep the pinned high-level Stitch SDK, but replace its transport: version
 * 0.3.5 logs raw transport exceptions. Never globally patch console or fetch. */
export class PrivateStitchClient extends StitchToolClient {
  private readonly connection = new Client({ name: "forgestudio-design", version: "1.0.0" }, { capabilities: {} });
  private connecting?: Promise<void>;
  private activeAudit?: RequestAudit;

  constructor(private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch) {
    super({ apiKey, baseUrl: "https://stitch.googleapis.com/mcp", timeout: 180000 });
    this.connection.onerror = () => { /* Provider errors are mapped at the boundary, never logged raw. */ };
  }

  override async connect(): Promise<void> {
    this.connecting ??= this.open();
    return this.connecting;
  }

  private async open() {
    const audit: RequestAudit = { dispatched: false, headersReceived: false };
    this.activeAudit = audit;
    const transport = new StreamableHTTPClientTransport(new URL("https://stitch.googleapis.com/mcp"), {
      requestInit: { headers: { "X-Goog-Api-Key": this.apiKey } },
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        if (this.activeAudit) this.activeAudit.dispatched = true;
        try {
          const res = await this.fetcher(input, {
            ...init,
            redirect: "error",
            signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(180000)]) : AbortSignal.timeout(180000),
          });
          if (this.activeAudit) {
            this.activeAudit.headersReceived = true;
            this.activeAudit.status = res.status;
          }
          return res;
        } catch (err) {
          if (this.activeAudit) this.activeAudit.error = err;
          throw err;
        }
      },
    });

    try {
      await this.connection.connect(transport, { timeout: 30000 });
    } catch (connectErr: any) {
      console.error("[STITCH CONNECT ERROR]:", audit.status, connectErr?.message || connectErr);
      this.connecting = undefined;
      if (audit.status === 401 || audit.status === 403) {
        throw new AppError("Stitch authentication failed", 401, "AI_AUTH_ERROR");
      }
      if (audit.status === 429) {
        throw new AppError("Stitch rate limit reached", 429, "AI_RATE_LIMIT");
      }
      throw new AppError("Stitch connection could not complete", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally {
      this.activeAudit = undefined;
    }
  }

  override async callTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
    await this.connect();
    const audit: RequestAudit = { dispatched: false, headersReceived: false };
    this.activeAudit = audit;
    try {
      const result = await this.connection.callTool({ name, arguments: args }, undefined, { timeout: 180000 });
      if (result.isError) {
        const rawContent = result.content as Array<{ type: string; text?: string }> | undefined;
        const textPayload = rawContent?.map(c => c.text).filter(Boolean).join("\n") || "";
        let parsedPayload: any = null;
        try {
          parsedPayload = textPayload ? JSON.parse(textPayload) : null;
        } catch {
          parsedPayload = null;
        }

        const modelId = typeof args.modelId === "string" ? args.modelId : undefined;
        const providerMsg = parsedPayload?.error?.message || parsedPayload?.message || textPayload || "Stitch operation rejected by provider";
        const providerCode = parsedPayload?.error?.code || parsedPayload?.error?.status || parsedPayload?.code || audit.status;

        console.error(`[STITCH] tool=${name}`);
        if (modelId) console.error(`[STITCH] modelId=${modelId}`);
        console.error(`[STITCH] provider rejected request`);
        console.error(`[STITCH] errorCode=${providerCode || "unknown"}`);
        console.error(`[STITCH] errorMessage=${providerMsg.slice(0, 300)}`);

        const lowerMsg = providerMsg.toLowerCase();
        if (audit.status === 401 || audit.status === 403 || lowerMsg.includes("unauthorized") || lowerMsg.includes("api key") || lowerMsg.includes("permission") || lowerMsg.includes("auth")) {
          throw new AppError(`Stitch authentication failed: ${providerMsg.slice(0, 150)}`, 401, "AI_AUTH_ERROR");
        }
        if (audit.status === 429 || lowerMsg.includes("quota") || lowerMsg.includes("rate limit") || lowerMsg.includes("resource exhausted")) {
          throw new AppError(`Stitch rate limit reached: ${providerMsg.slice(0, 150)}`, 429, "AI_RATE_LIMIT");
        }
        if (audit.status === 400 || lowerMsg.includes("invalid") || lowerMsg.includes("not found") || lowerMsg.includes("unsupported") || lowerMsg.includes("bad request") || lowerMsg.includes("model")) {
          throw new AppError(`Stitch request was invalid: ${providerMsg.slice(0, 200)}`, 400, "AI_BAD_REQUEST");
        }
        if (audit.status && audit.status >= 500) {
          throw new AppError(`Stitch provider is temporarily unavailable: ${providerMsg.slice(0, 150)}`, 503, "AI_PROVIDER_UNAVAILABLE");
        }
        throw new AppError(`Stitch operation rejected: ${providerMsg.slice(0, 200)}`, 503, "AI_PROVIDER_UNAVAILABLE");
      }
      if (result.structuredContent) return result.structuredContent as T;
      const content = result.content as Array<{ type: string; text?: string }>;
      const text = content.find(item => item.type === "text")?.text;
      if (!text) {
        throw new AppError("Stitch returned empty content", 502, "AI_INVALID_OUTPUT");
      }
      return JSON.parse(text) as T;
    } catch (error: any) {
      if (error instanceof AppError) {
        console.error(`[STITCH TOOL ERROR]:`, error.code, error.message);
        throw error;
      }
      console.error(`[STITCH TOOL EXCEPTION]: status=${audit.status}`, error?.message || error);
      if (audit.status === 401 || audit.status === 403) {
        throw new AppError("Stitch authentication failed", 401, "AI_AUTH_ERROR");
      }
      if (audit.status === 429) {
        throw new AppError("Stitch rate limit reached", 429, "AI_RATE_LIMIT");
      }
      if (audit.status && audit.status >= 500) {
        throw new AppError("Stitch provider is temporarily unavailable", 503, "AI_PROVIDER_UNAVAILABLE");
      }
      const err = (audit.error || error) as { name?: string; code?: string; message?: string } | undefined;
      const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError" || err?.code === "ETIMEDOUT" || err?.message?.includes("timeout");
      if (isTimeout && audit.dispatched) {
        throw new AppError("Stitch request timed out with unknown outcome", 503, "AI_EXTERNAL_OUTCOME_UNKNOWN");
      }
      throw new AppError("Stitch request could not complete", 503, "AI_PROVIDER_UNAVAILABLE");
    } finally {
      this.activeAudit = undefined;
    }
  }

  override async httpPost<T>(_path: string, _body: unknown): Promise<T> { throw new AppError("This Stitch operation is not enabled", 422, "AI_UNSUPPORTED_OPERATION"); }
  override async listTools() {
    await this.connect();
    try { return await this.connection.listTools(); }
    catch { throw new AppError("Stitch capabilities could not be retrieved", 503, "AI_PROVIDER_UNAVAILABLE"); }
  }
  override async close() { await this.connection.close().catch(() => undefined); }
}
