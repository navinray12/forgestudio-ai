/* global vi -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterization harness for the request-wrapper services (publishingService, forgeProjectService).
 *
 * Every method of a service is called with arguments derived from its declared parameters (the
 * *.members.json fixtures, generated from the unmodified source), under a fixed set of scripted fetch
 * responses. For each call it records exactly what the method sent (URL, method, headers, body and the
 * other RequestInit keys), what it returned or threw, and its browser side effects (object URLs, anchor
 * clicks, leftover DOM). The records are compared with a golden file captured once from the unmodified
 * services, so a split that changes any request or response handling fails here.
 */
export type ParamSpec = { name: string; type: string | null; optional: boolean };
export type MemberSpec = { name: string; params: ParamSpec[] };

type Scenario = { name: string; respond: () => Response | Promise<Response> };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

export const SCENARIOS: Scenario[] = [
  {
    name: "ok",
    respond: () =>
      json(200, {
        success: true,
        data: { id: "res-1", items: [{ id: "item-1", name: "Item" }], status: "OK", url: "https://live.test/x" },
        message: "ok-message",
        id: "top-1",
        deployments: [{ id: "dep-1", version: 1 }],
      }),
  },
  { name: "softFail", respond: () => json(200, { success: false, message: "soft failure", error: { message: "soft nested" } }) },
  {
    name: "httpError",
    respond: () => json(422, { success: false, message: "bad request", error: { message: "nested error", code: "E_BAD" }, detail: "detail text" }),
  },
  { name: "nonJson", respond: () => new Response("<html>oops</html>", { status: 500, statusText: "Server Error", headers: { "content-type": "text/html" } }) },
  {
    name: "zip",
    respond: () =>
      new Response(new Uint8Array([80, 75, 3, 4, 1, 2]), {
        status: 200,
        headers: { "content-type": "application/zip", "content-disposition": 'attachment; filename="bundle.zip"' },
      }),
  },
  { name: "network", respond: () => Promise.reject(new TypeError("Failed to fetch")) },
];

const STRINGY = /(id|ids|url|path|name|slug|query|branch|message|sql|key|token|domain|email|route|code|prompt|title|ref|sha|tag|status|mode|format|environment|version|search|provider|type|command|language|target|filename|content|text|reason|source|channel|topic|namespace|scope|role|framework|bucket|value|cursor|period|range|from|to|since)$/i;

/** Deterministic argument for one declared parameter. */
export function argumentFor(p: ParamSpec): unknown {
  const t = (p.type || "").replace(/\s+/g, " ").trim();
  const n = p.name.replace(/[{}[\]\s]/g, "");
  if (/(^|[^\w])File\b/.test(t) && !/Profile/.test(t)) return new File(["hello-bytes"], `${n}.png`, { type: "image/png" });
  if (/^Blob\b/.test(t)) return new Blob(["blob-bytes"], { type: "application/octet-stream" });
  const literal = t.match(/^["']([^"']*)["']/);
  if (literal) return literal[1];
  if (/^number\b/.test(t)) return 3;
  if (/^boolean\b/.test(t)) return true;
  if (/^string\b/.test(t) && !/\[\]/.test(t)) return `${n}-v`;
  if (/\[\]$|^Array</.test(t)) return [`${n}-a`, `${n}-b`];
  if (!t || t === "any" || t === "unknown") {
    if (n === "apiUrl") return "http://api.test";
    return STRINGY.test(n) ? `${n}-v` : { id: `${n}-id`, name: `${n}-name`, value: 1, enabled: true };
  }
  return { id: `${n}-id`, name: `${n}-name`, value: 1, enabled: true, items: [{ id: `${n}-item` }] };
}

function headersOf(h: HeadersInit | undefined): unknown {
  if (h === undefined) return undefined;
  if (h instanceof Headers) return { kind: "Headers", entries: [...h.entries()] };
  if (Array.isArray(h)) return { kind: "array", entries: h };
  return { kind: "object", entries: Object.entries(h) };
}

async function bodyOf(b: unknown): Promise<unknown> {
  if (b === undefined || b === null) return b;
  if (typeof b === "string") return { kind: "string", value: b };
  if (b instanceof FormData) {
    const entries: unknown[] = [];
    for (const [k, v] of b.entries()) entries.push([k, typeof v === "string" ? v : { file: (v as File).name, size: v.size, type: v.type }]);
    return { kind: "FormData", entries };
  }
  if (b instanceof URLSearchParams) return { kind: "URLSearchParams", value: b.toString() };
  if (b instanceof Blob) return { kind: "Blob", size: b.size, type: b.type, text: await b.text() };
  return { kind: typeof b, value: String(b) };
}

/** JSON-safe, deterministic copy of a returned value or thrown error. */
export function safe(v: unknown, depth = 0): unknown {
  if (depth > 8) return "[depth]";
  if (v === undefined) return "[undefined]";
  if (v === null || typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "function") return "[function]";
  if (v instanceof Error) {
    const own: Record<string, unknown> = {};
    for (const k of Object.keys(v)) own[k] = safe((v as any)[k], depth + 1);
    return { error: v.name, message: v.message, own };
  }
  if (typeof Response !== "undefined" && v instanceof Response) return { response: v.status };
  if (v instanceof Blob) return { blob: v.size, type: v.type };
  if (v instanceof Date) return { date: v.toISOString() };
  if (Array.isArray(v)) return v.map((x) => safe(x, depth + 1));
  if (typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as object)) o[k] = safe(x, depth + 1);
    return o;
  }
  return String(v);
}

/** Runs one call of `fn` under `scenario`, returning its requests, outcome and side effects. */
async function recordCall(fn: (...a: unknown[]) => unknown, args: unknown[], scenario: Scenario) {
  const requests: unknown[] = [];
  const effects: unknown[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const i = init || {};
    requests.push({
      url: String(input instanceof Request ? input.url : input),
      keys: Object.keys(i).sort(),
      method: i.method,
      credentials: i.credentials,
      headers: headersOf(i.headers),
      body: await bodyOf(i.body),
      signal: i.signal ? "[signal]" : undefined,
    });
    return scenario.respond();
  }) as typeof fetch;
  URL.createObjectURL = vi.fn((b: Blob) => { effects.push(["createObjectURL", safe(b)]); return "blob:mock/1"; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn((u: string) => { effects.push(["revokeObjectURL", u]); });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    effects.push(["anchorClick", this.getAttribute("href"), this.getAttribute("download")]);
  });
  let outcome: unknown;
  try {
    outcome = { returned: safe(await fn(...args)) };
  } catch (e) {
    outcome = { threw: safe(e) };
  }
  click.mockRestore();
  if (document.body.innerHTML) { effects.push(["leftoverDom", document.body.innerHTML]); document.body.innerHTML = ""; }
  return { requests, outcome, effects };
}

/** Records every member under every scenario, with all arguments and (when some are optional) required ones only. */
export async function recordService(service: Record<string, unknown>, members: MemberSpec[]) {
  const out: Record<string, unknown> = {};
  for (const m of members) {
    const fn = service[m.name] as (...a: unknown[]) => unknown;
    const variants: Array<[string, unknown[]]> = [["all", m.params.map(argumentFor)]];
    const required = m.params.findIndex((p) => p.optional);
    if (required >= 0) variants.push(["required", m.params.slice(0, required).map(argumentFor)]);
    const rec: Record<string, unknown> = {};
    for (const [label, args] of variants) for (const s of SCENARIOS) rec[`${label}:${s.name}`] = await recordCall(fn, args, s);
    out[m.name] = rec;
  }
  return out;
}
