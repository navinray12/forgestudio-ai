/**
 * Regression guard: F-41 MCP server-side request forgery and related MCP hardening.
 *
 *  - invokeTool / discoverTools / checkHealth reach external MCP servers only through the shared
 *    safe-egress helper: public HTTPS on port 443, DNS answers validated and pinned (no rebinding),
 *    redirects rejected, timeouts and response-size limits enforced.
 *  - invokeTool only runs servers that belong to the requesting project and are enabled; anything
 *    else fails before any DNS lookup or connection.
 *  - registerServer always stores UNTRUSTED and ignores client-supplied trust/status fields, and
 *    rejects endpoints the egress policy would never allow.
 *
 * Offline: node:dns/promises, node:https and node:http are mocked, global fetch is replaced with a
 * function that fails the test if called, and Prisma is an in-memory mock. Before anything is
 * imported, the source of every module loaded for real is parsed and each import must be mocked or
 * explicitly side-effect free; otherwise every test FAILS.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAst } from "rolldown/parseAst";

const TEST_FILE = fileURLToPath(import.meta.url);
const SRC = resolve(dirname(TEST_FILE), "../..");
const CLIENT_FILE = resolve(SRC, "modules/ai/mcp/mcpClient.service.ts");
const REGISTRY_FILE = resolve(SRC, "modules/ai/mcp/mcpRegistry.service.ts");
const EGRESS_FILE = resolve(SRC, "platform/integrations/safe-egress.ts");
const CONTROLLER_FILE = resolve(SRC, "controllers/project.controller.ts");

const h = vi.hoisted(() => ({
  prisma: {
    forgeMcpServer: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    forgeMcpExecution: { create: vi.fn() },
  },
  lookup: vi.fn(),
  httpsRequest: vi.fn(),
  httpRequest: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({ prisma: h.prisma, pgPool: {} }));
vi.mock("node:dns/promises", () => ({ default: { lookup: h.lookup }, lookup: h.lookup }));
vi.mock("node:https", () => ({ default: { request: h.httpsRequest }, request: h.httpsRequest }));
vi.mock("node:http", () => ({ default: { request: h.httpRequest }, request: h.httpRequest }));

// ---------------------------------------------------------------------------------------------
// Isolation guard
// ---------------------------------------------------------------------------------------------
/** Modules allowed to load for real: no module-level side effects. */
const SIDE_EFFECT_FREE = new Set([
  resolve(SRC, "utils/app-error.js"),
  resolve(SRC, "modules/ai/mcp/mcpTypes.js"),
  resolve(SRC, "platform/integrations/safe-egress.js"),
  resolve(SRC, "platform/tenancy/tenant-unit-of-work.js"),
  "node:net",
  "node:crypto",
]);
const REAL_MODULES = [CLIENT_FILE, REGISTRY_FILE, EGRESS_FILE, resolve(SRC, "platform/tenancy/tenant-unit-of-work.ts")];
const toKey = (from: string, s: string) => (s.startsWith(".") ? resolve(dirname(from), s) : s);

function importsOf(file: string): { specifiers: string[]; nonLiteralDynamic: number } {
  const ast = parseAst(readFileSync(file, "utf8"), { lang: "ts", sourceType: "module" }, file) as any;
  const specifiers: string[] = [];
  let nonLiteralDynamic = 0;
  const walk = (node: any): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if ((node.type === "ImportDeclaration" && node.importKind !== "type") || node.type === "ExportAllDeclaration" ||
      (node.type === "ExportNamedDeclaration" && node.source)) specifiers.push(node.source.value);
    if (node.type === "ImportExpression") {
      if (node.source.type === "Literal" && typeof node.source.value === "string") specifiers.push(node.source.value);
      else nonLiteralDynamic++;
    }
    for (const key of Object.keys(node)) walk(node[key]);
  };
  walk(ast);
  return { specifiers, nonLiteralDynamic };
}

function isolationProblems(): string[] {
  const self = readFileSync(TEST_FILE, "utf8");
  const mocked = new Set([...self.matchAll(/^vi\.mock\("([^"]+)"/gm)].map((m) => toKey(TEST_FILE, m[1])));
  const problems: string[] = [];
  for (const file of REAL_MODULES) {
    const { specifiers, nonLiteralDynamic } = importsOf(file);
    const unmocked = [...new Set(specifiers.map((s) => toKey(file, s)))].filter((k) => !mocked.has(k) && !SIDE_EFFECT_FREE.has(k));
    const name = file.slice(SRC.length + 1);
    if (unmocked.length) problems.push(`${name}: unmocked imports ${unmocked.map((k) => k.replace(SRC, "src")).join(", ")}`);
    if (nonLiteralDynamic) problems.push(`${name}: ${nonLiteralDynamic} non-literal dynamic import(s)`);
  }
  return problems;
}

type ClientModule = typeof import("../../modules/ai/mcp/mcpClient.service.js");
type RegistryModule = typeof import("../../modules/ai/mcp/mcpRegistry.service.js");
let mcpClientService: ClientModule["mcpClientService"];
let mcpRegistryService: RegistryModule["mcpRegistryService"];
let isolationError: Error | undefined;

beforeAll(async () => {
  const problems = isolationProblems();
  if (problems.length) {
    isolationError = new Error(`Refusing to load MCP modules: ${problems.join("; ")}`);
    return;
  }
  ({ mcpClientService } = await import("../../modules/ai/mcp/mcpClient.service.js"));
  ({ mcpRegistryService } = await import("../../modules/ai/mcp/mcpRegistry.service.js"));
});

// ---------------------------------------------------------------------------------------------
// Fake network: dns.lookup answers and https.request responses are scripted per test.
// ---------------------------------------------------------------------------------------------
type Outcome = { status: number; headers?: Record<string, string>; body?: string | Buffer } | "timeout";
interface Captured { options: any; body: string }

let requests: Captured[] = [];
let respond: (req: Captured) => Outcome = () => ({ status: 200, body: "{}" });
const fetchSpy = vi.fn(async () => { throw new Error("global fetch must not be used for MCP egress"); });

function installFakeTransport(mock: typeof h.httpsRequest) {
  mock.mockImplementation((options: any, onResponse: (res: any) => void) => {
    const captured: Captured = { options, body: "" };
    requests.push(captured);
    const req: any = new EventEmitter();
    req.destroyed = false;
    req.write = (chunk: unknown) => { captured.body += String(chunk); };
    req.destroy = (err?: Error) => {
      if (req.destroyed) return;
      req.destroyed = true;
      queueMicrotask(() => req.emit("error", err ?? new Error("destroyed")));
    };
    req.end = () => {
      queueMicrotask(() => {
        const outcome = respond(captured);
        if (outcome === "timeout") { req.emit("timeout"); return; }
        const res: any = new EventEmitter();
        res.statusCode = outcome.status;
        res.headers = outcome.headers ?? {};
        res.resume = () => undefined;
        onResponse(res);
        if (outcome.body !== undefined && !req.destroyed) res.emit("data", Buffer.from(outcome.body));
        if (!req.destroyed) res.emit("end");
      });
    };
    return req;
  });
}

const PUBLIC_IP = "93.184.216.34";
/** DNS answers per hostname; a function value lets a test change answers between lookups. */
let dnsAnswers: Record<string, string[] | (() => string[])> = {};

const SERVERS: Record<string, any> = {
  "srv-public": { id: "srv-public", name: "Public", projectId: "proj-a", endpoint: "https://mcp.example.com/rpc", trustLevel: "VERIFIED", isEnabled: true, tools: [{ name: "stored_tool", inputSchema: {} }] },
  "srv-other-project": { id: "srv-other-project", name: "Other", projectId: "proj-b", endpoint: "https://mcp.example.com/rpc", trustLevel: "VERIFIED", isEnabled: true, tools: [] },
  "srv-no-project": { id: "srv-no-project", name: "Global", projectId: null, endpoint: "https://mcp.example.com/rpc", trustLevel: "VERIFIED", isEnabled: true, tools: [] },
  "srv-disabled": { id: "srv-disabled", name: "Disabled", projectId: "proj-a", endpoint: "https://mcp.example.com/rpc", trustLevel: "VERIFIED", isEnabled: false, tools: [] },
  "srv-untrusted": { id: "srv-untrusted", name: "Untrusted", projectId: "proj-a", endpoint: "https://mcp.example.com/rpc", trustLevel: "UNTRUSTED", isEnabled: true, tools: [] },
  "srv-stdio": { id: "srv-stdio", name: "Stdio", projectId: "proj-a", endpoint: "node server.js", trustLevel: "VERIFIED", isEnabled: true, tools: [] },
};
const withEndpoint = (endpoint: string) => ({ ...SERVERS["srv-public"], id: "srv-dynamic", endpoint });

beforeEach(() => {
  if (isolationError) throw isolationError;
  vi.clearAllMocks();
  requests = [];
  respond = () => ({ status: 200, body: "{}" });
  dnsAnswers = { "mcp.example.com": [PUBLIC_IP] };
  vi.stubGlobal("fetch", fetchSpy);
  installFakeTransport(h.httpsRequest);
  installFakeTransport(h.httpRequest);
  h.lookup.mockImplementation(async (host: string) => {
    const entry = dnsAnswers[host];
    const list = typeof entry === "function" ? entry() : entry;
    if (!list) throw Object.assign(new Error(`ENOTFOUND ${host}`), { code: "ENOTFOUND" });
    return list.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  });
  h.prisma.forgeMcpServer.findUnique.mockImplementation(async ({ where }: any) => SERVERS[where.id] ?? null);
  h.prisma.forgeMcpServer.update.mockResolvedValue({});
  h.prisma.forgeMcpServer.create.mockImplementation(async ({ data }: any) => ({ id: "srv-new", ...data }));
  h.prisma.forgeMcpExecution.create.mockResolvedValue({});
});

const CTX = { projectId: "proj-a", userId: "user-1" };
const DEFAULT_RESULT = (tool: string) => ({ isError: false, content: [{ type: "text", text: `MCP tool ${tool} executed successfully.` }] });
const jsonRpc = (payload: unknown) => ({ status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });

/** Asserts that nothing reached the network layer at all. */
function expectNoEgress() {
  expect(requests).toHaveLength(0);
  expect(fetchSpy).not.toHaveBeenCalled();
}

/** The address the pinned connection would actually dial. */
function pinnedAddress(req: Captured): Promise<string> {
  return new Promise((done, fail) => req.options.lookup(req.options.hostname, {}, (err: Error | null, address: string) => (err ? fail(err) : done(address))));
}

const SSRF_ENDPOINTS: Array<[string, string, Record<string, string[]>?]> = [
  ["loopback literal", "https://127.0.0.1/rpc"],
  ["private 10/8 literal", "https://10.0.0.5/rpc"],
  ["private 192.168/16 literal", "https://192.168.1.10/rpc"],
  ["cloud metadata literal", "https://169.254.169.254/latest/meta-data"],
  ["IPv4-mapped metadata literal", "https://[::ffff:169.254.169.254]/", { "[::ffff:a9fe:a9fe]": ["::ffff:169.254.169.254"] }],
  ["decimal loopback", "https://2130706433/rpc"],
  ["localhost", "https://localhost/rpc"],
  ["metadata hostname", "https://metadata.google.internal/computeMetadata/v1/"],
  ["plain HTTP", "http://mcp.example.com/rpc"],
  ["non-443 port", "https://mcp.example.com:8443/rpc"],
  ["scaffold-style local server", "http://localhost:8080/mcp"],
  ["embedded credentials", "https://user:pass@mcp.example.com/rpc"],
  ["hostname resolving to a private address", "https://internal.example.com/rpc", { "internal.example.com": ["10.1.2.3"] }],
  ["hostname resolving to IPv4-mapped metadata", "https://mapped.example.com/rpc", { "mapped.example.com": ["::ffff:a9fe:a9fe"] }],
  ["hostname with one private answer among public ones", "https://mixed.example.com/rpc", { "mixed.example.com": [PUBLIC_IP, "127.0.0.1"] }],
];

// ---------------------------------------------------------------------------------------------
describe("MCP egress isolation", () => {
  it("every import of the MCP client, registry and safe-egress modules is mocked or side-effect free", () => {
    expect(isolationProblems()).toEqual([]);
  });
});

describe("invokeTool: authorized public HTTPS server", () => {
  it("returns the server's JSON-RPC result unchanged over a pinned HTTPS:443 connection", async () => {
    const remote = { isError: false, content: [{ type: "text", text: "remote says hi" }] };
    respond = () => jsonRpc({ jsonrpc: "2.0", id: 1, result: remote });
    const result = await mcpClientService.invokeTool("srv-public", "search", { q: "x" }, CTX);

    expect(result).toEqual(remote);
    expect(requests).toHaveLength(1);
    const [req] = requests;
    expect(req.options).toMatchObject({ protocol: "https:", hostname: "mcp.example.com", path: "/rpc", method: "POST" });
    expect(req.options.headers).toMatchObject({ "Content-Type": "application/json", Host: "mcp.example.com" });
    expect(JSON.parse(req.body)).toMatchObject({ jsonrpc: "2.0", method: "tools/call", params: { name: "search", arguments: { q: "x" } } });
    await expect(pinnedAddress(req)).resolves.toBe(PUBLIC_IP);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(h.prisma.forgeMcpExecution.create).toHaveBeenCalledExactlyOnceWith({
      data: expect.objectContaining({ serverId: "srv-public", projectId: "proj-a", toolName: "search", isError: false }),
    });
  });

  it("non-2xx response keeps the existing default result shape", async () => {
    respond = () => ({ status: 500, body: "oops" });
    await expect(mcpClientService.invokeTool("srv-public", "search", {}, CTX)).resolves.toEqual(DEFAULT_RESULT("search"));
  });

  it("2xx response without a result keeps the existing default result shape", async () => {
    respond = () => jsonRpc({ jsonrpc: "2.0", id: 1 });
    await expect(mcpClientService.invokeTool("srv-public", "search", {}, CTX)).resolves.toEqual(DEFAULT_RESULT("search"));
  });

  it("non-HTTP endpoint makes no request and keeps the existing default result", async () => {
    await expect(mcpClientService.invokeTool("srv-stdio", "search", {}, CTX)).resolves.toEqual(DEFAULT_RESULT("search"));
    expectNoEgress();
  });
});

describe("invokeTool: server must belong to the project and be enabled (zero egress otherwise)", () => {
  it.each([
    ["a server registered on another project", "srv-other-project"],
    ["a server with no project", "srv-no-project"],
    ["a disabled server", "srv-disabled"],
    ["an unknown server", "srv-missing"],
  ])("%s: 404 MCP_SERVER_NOT_FOUND, no DNS lookup, no request, no audit", async (_label, serverId) => {
    await expect(mcpClientService.invokeTool(serverId, "search", {}, CTX)).rejects.toMatchObject({
      statusCode: 404, code: "MCP_SERVER_NOT_FOUND",
    });
    expectNoEgress();
    expect(h.lookup).not.toHaveBeenCalled();
    expect(h.prisma.forgeMcpExecution.create).not.toHaveBeenCalled();
  });

  it("an UNTRUSTED server in the project is still refused before any egress", async () => {
    await expect(mcpClientService.invokeTool("srv-untrusted", "search", {}, CTX)).rejects.toMatchObject({
      statusCode: 403, code: "UNTRUSTED_MCP_SERVER",
    });
    expectNoEgress();
    expect(h.lookup).not.toHaveBeenCalled();
  });
});

describe("invokeTool: SSRF destinations are refused without a connection", () => {
  it.each(SSRF_ENDPOINTS)("%s (%s): isError result, no request", async (_label, endpoint, dns) => {
    Object.assign(dnsAnswers, dns ?? {});
    h.prisma.forgeMcpServer.findUnique.mockResolvedValue(withEndpoint(endpoint));
    const result = await mcpClientService.invokeTool("srv-dynamic", "search", {}, CTX);
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect((result.content[0] as any).text).toMatch(/^Error calling MCP endpoint: /);
    expectNoEgress();
  });
});

describe("invokeTool: DNS rebinding, redirects, timeouts and size limits", () => {
  it("DNS rebinding: resolves once and dials the validated address even if DNS later changes", async () => {
    let calls = 0;
    dnsAnswers["mcp.example.com"] = () => (++calls === 1 ? [PUBLIC_IP] : ["127.0.0.1"]);
    respond = () => jsonRpc({ result: { isError: false, content: [] } });
    await mcpClientService.invokeTool("srv-public", "search", {}, CTX);
    expect(h.lookup).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(1);
    await expect(pinnedAddress(requests[0])).resolves.toBe(PUBLIC_IP);
  });

  it.each([301, 302, 307, 308])("redirect %i is not followed and returns an isError result", async (status) => {
    respond = () => ({ status, headers: { location: "https://169.254.169.254/latest/meta-data" } });
    const result = await mcpClientService.invokeTool("srv-public", "search", {}, CTX);
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).toMatch(/redirects are not allowed/i);
    expect(requests).toHaveLength(1);
    expect(h.lookup).toHaveBeenCalledOnce();
  });

  it("timeout returns an isError result", async () => {
    respond = () => "timeout";
    const result = await mcpClientService.invokeTool("srv-public", "search", {}, CTX);
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).toMatch(/timed out/i);
    expect(requests[0].options.timeout).toBeGreaterThan(0);
  });

  it("response over the size limit returns an isError result", async () => {
    respond = () => ({ status: 200, body: Buffer.alloc(2 * 1024 * 1024, 0x61) });
    const result = await mcpClientService.invokeTool("srv-public", "search", {}, CTX);
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).toMatch(/too large/i);
  });

  it("invalid JSON on a 2xx response returns an isError result", async () => {
    respond = () => ({ status: 200, body: "<html>" });
    const result = await mcpClientService.invokeTool("srv-public", "search", {}, CTX);
    expect(result.isError).toBe(true);
  });

  it("non-AppError transport failures are reported without leaking internal details", async () => {
    h.httpsRequest.mockImplementation(() => { throw new Error("connect ECONNREFUSED 10.9.9.9:443 secret-host"); });
    const result = await mcpClientService.invokeTool("srv-public", "search", {}, CTX);
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).not.toMatch(/10\.9\.9\.9|secret-host/);
  });
});

describe("discoverTools", () => {
  it("public server: returns discovered tools and records CONNECTED", async () => {
    const tools = [{ name: "remote_tool", inputSchema: {} }];
    respond = () => jsonRpc({ result: { tools } });
    await expect(mcpClientService.discoverTools("srv-public")).resolves.toEqual(tools);
    expect(JSON.parse(requests[0].body)).toMatchObject({ method: "tools/list" });
    expect(h.prisma.forgeMcpServer.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: "srv-public" }, data: expect.objectContaining({ tools, status: "CONNECTED" }),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(SSRF_ENDPOINTS)("%s (%s): falls back to stored tools with no request", async (_label, endpoint, dns) => {
    Object.assign(dnsAnswers, dns ?? {});
    const server = { ...withEndpoint(endpoint), tools: [{ name: "stored_tool", inputSchema: {} }] };
    h.prisma.forgeMcpServer.findUnique.mockResolvedValue(server);
    await expect(mcpClientService.discoverTools("srv-dynamic")).resolves.toEqual(server.tools);
    expectNoEgress();
    expect(h.prisma.forgeMcpServer.update).not.toHaveBeenCalled();
  });

  it("redirect is not followed: falls back to stored tools", async () => {
    respond = () => ({ status: 302, headers: { location: "https://10.0.0.1/" } });
    await expect(mcpClientService.discoverTools("srv-public")).resolves.toEqual(SERVERS["srv-public"].tools);
    expect(requests).toHaveLength(1);
  });
});

describe("checkHealth", () => {
  it.each([200, 404, 405])("public server answering %i: available and CONNECTED, via HEAD", async (status) => {
    respond = () => ({ status });
    await expect(mcpRegistryService.checkHealth("srv-public")).resolves.toMatchObject({ available: true });
    expect(requests[0].options).toMatchObject({ method: "HEAD", hostname: "mcp.example.com" });
    expect(h.prisma.forgeMcpServer.update).toHaveBeenCalledWith({ where: { id: "srv-public" }, data: expect.objectContaining({ status: "CONNECTED" }) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("public server answering 500: unavailable and ERROR", async () => {
    respond = () => ({ status: 500 });
    await expect(mcpRegistryService.checkHealth("srv-public")).resolves.toMatchObject({ available: false });
  });

  it.each(SSRF_ENDPOINTS)("%s (%s): unavailable and ERROR with no request", async (_label, endpoint, dns) => {
    Object.assign(dnsAnswers, dns ?? {});
    h.prisma.forgeMcpServer.findUnique.mockResolvedValue(withEndpoint(endpoint));
    await expect(mcpRegistryService.checkHealth("srv-dynamic")).resolves.toMatchObject({ available: false });
    expectNoEgress();
    expect(h.prisma.forgeMcpServer.update).toHaveBeenCalledWith({ where: { id: "srv-dynamic" }, data: expect.objectContaining({ status: "ERROR" }) });
  });

  it("timeout and redirect: unavailable", async () => {
    respond = () => "timeout";
    await expect(mcpRegistryService.checkHealth("srv-public")).resolves.toMatchObject({ available: false });
    respond = () => ({ status: 302, headers: { location: "https://10.0.0.1/" } });
    await expect(mcpRegistryService.checkHealth("srv-public")).resolves.toMatchObject({ available: false });
  });
});

describe("registerServer: trust-level spoofing and endpoint policy", () => {
  const base = { name: "Analytics", endpoint: "https://mcp.example.com/rpc", projectId: "proj-a", userId: "user-1" };

  it.each(["VERIFIED", "TRUSTED", "UNTRUSTED", undefined])("client trustLevel %s is ignored: stored UNTRUSTED", async (trustLevel) => {
    const server = await mcpRegistryService.registerServer({ ...base, trustLevel: trustLevel as any });
    expect(server.trustLevel).toBe("UNTRUSTED");
    expect(h.prisma.forgeMcpServer.create.mock.calls[0][0].data.trustLevel).toBe("UNTRUSTED");
  });

  it("client-supplied status, isEnabled, tools and other fields never reach the database", async () => {
    await mcpRegistryService.registerServer({
      ...base, status: "CONNECTED", isEnabled: true, tools: [{ name: "evil" }], capabilities: ["all"], id: "chosen-id",
    } as any);
    const { data } = h.prisma.forgeMcpServer.create.mock.calls[0][0];
    expect(Object.keys(data).sort()).toEqual(["capabilities", "endpoint", "name", "projectId", "status", "tools", "transport", "trustLevel", "userId"]);
    expect(data.capabilities).toEqual(["tools", "resources"]);
    expect(data.tools).toEqual([expect.objectContaining({ name: "Analytics_query" })]);
    expect(data).not.toHaveProperty("id");
    expect(data).not.toHaveProperty("isEnabled");
  });

  it.each(SSRF_ENDPOINTS)("%s (%s): registration rejected with 400 and nothing stored", async (_label, endpoint, dns) => {
    Object.assign(dnsAnswers, dns ?? {});
    await expect(mcpRegistryService.registerServer({ ...base, endpoint })).rejects.toMatchObject({ statusCode: 400 });
    expect(h.prisma.forgeMcpServer.create).not.toHaveBeenCalled();
    expectNoEgress();
  });

  it("public HTTPS endpoint is accepted and validated without connecting", async () => {
    const server = await mcpRegistryService.registerServer(base);
    expect(server).toMatchObject({ name: "Analytics", endpoint: base.endpoint, projectId: "proj-a", userId: "user-1" });
    expect(h.lookup).toHaveBeenCalledOnce();
    expectNoEgress();
  });

  it("non-HTTP endpoints (never dialled) are still accepted as before", async () => {
    await expect(mcpRegistryService.registerServer({ ...base, endpoint: "node server.js", transport: "STDIO" })).resolves.toMatchObject({ trustLevel: "UNTRUSTED" });
    expectNoEgress();
  });

  it("controller passes the authenticated user and URL project after the request body, so they cannot be spoofed", () => {
    const ast = parseAst(readFileSync(CONTROLLER_FILE, "utf8"), { lang: "ts", sourceType: "module" }, CONTROLLER_FILE) as any;
    const fn = ast.body.find((s: any) => s.type === "ExportNamedDeclaration" && s.declaration?.id?.name === "registerMcpServerHandler").declaration;
    let arg: any;
    const walk = (n: any): void => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n.type === "CallExpression" && n.callee?.property?.name === "registerServer") arg = n.arguments[0];
      for (const k of Object.keys(n)) walk(n[k]);
    };
    walk(fn.body);
    const order = arg.properties.map((p: any) => (p.type === "SpreadElement" ? `...${p.argument.object?.name}.${p.argument.property?.name}` : p.key.name));
    expect(order).toEqual(["...req.body", "projectId", "userId"]);
  });
});
