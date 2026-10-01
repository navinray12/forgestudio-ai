import { StitchToolClient } from "@google/stitch-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { AppError } from "../../../utils/app-error.js";

/** Keep the pinned high-level Stitch SDK, but replace its transport: version
 * 0.3.5 logs raw transport exceptions. Never globally patch console or fetch. */
export class PrivateStitchClient extends StitchToolClient {
  private readonly connection = new Client({ name: "forgestudio-design", version: "1.0.0" }, { capabilities: {} });
  private connecting?: Promise<void>;
  constructor(private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch) {
    super({ apiKey, baseUrl: "https://stitch.googleapis.com/mcp", timeout: 180000 });
    this.connection.onerror = () => { /* Provider errors are mapped at the boundary, never logged raw. */ };
  }
  override async connect(): Promise<void> {
    this.connecting ??= this.open();
    return this.connecting;
  }
  private async open() {
    const transport = new StreamableHTTPClientTransport(new URL("https://stitch.googleapis.com/mcp"), {
      requestInit: { headers: { "X-Goog-Api-Key": this.apiKey } },
      fetch: (input, init) => this.fetcher(input, { ...init, redirect: "error", signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(180000)]) : AbortSignal.timeout(180000) }),
    });
    try { await this.connection.connect(transport, { timeout: 30000 }); }
    catch { throw new AppError("Stitch connection could not complete", 503, "AI_PROVIDER_UNAVAILABLE"); }
  }
  override async callTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
    await this.connect();
    try {
      const result = await this.connection.callTool({ name, arguments: args }, undefined, { timeout: 180000 });
      if (result.isError) throw new Error();
      if (result.structuredContent) return result.structuredContent as T;
      const content = result.content as Array<{ type: string; text?: string }>;
      const text = content.find(item => item.type === "text")?.text;
      if (!text) throw new Error();
      return JSON.parse(text) as T;
    } catch { throw new AppError("Stitch request could not complete", 503, "AI_PROVIDER_UNAVAILABLE"); }
  }
  override async httpPost<T>(_path: string, _body: unknown): Promise<T> { throw new AppError("This Stitch operation is not enabled", 422, "AI_UNSUPPORTED_OPERATION"); }
  override async listTools() {
    await this.connect();
    try { return await this.connection.listTools(); }
    catch { throw new AppError("Stitch capabilities could not be retrieved", 503, "AI_PROVIDER_UNAVAILABLE"); }
  }
  override async close() { await this.connection.close().catch(() => undefined); }
}
