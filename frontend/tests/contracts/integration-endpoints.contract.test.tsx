// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Phase 7B contract tests: the frontend integration and image-upload calls against the backend's real
 * route definitions.
 *
 * The backend side is read from source (app.ts mounts, integration.routes.ts, upload.routes.ts,
 * upload.middleware.ts), not restated here: every request a caller makes must match a mounted backend
 * route by method and path, and a route behind requireAuth must be called with credentials: "include"
 * (requireAuth reads the session cookie). backend/src/tests/regression/frontend-integration-contract.test.ts
 * then sends these same requests to the running backend app.
 *
 * Responses are modelled on the controllers' JSON (integration.controller.ts, upload.middleware.ts):
 * success bodies, `{ success: false, message }` errors, 401s and network failures, with the state each
 * caller shows for them.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntegrationElementRenderer } from "../../src/pages/editor/integrations/IntegrationRenderers";
import { PayPalButtonWidgetRenderer } from "../../src/pages/editor/widgets/renderers/network/PayPalButtonWidgetRenderer";
import { ManagedSiteModal } from "../../src/pages/dashboard/components/ManagedSiteModal";
import { ImagePickerControl, triggerImagePicker } from "../../src/pages/editor/inspector/DynamicWidgetInspectors";

const here = dirname(fileURLToPath(import.meta.url));
const backend = (p: string) => readFileSync(join(here, "../../../backend/src", p), "utf8");
const API = "http://localhost:5000"; // VITE_API_URL is not set in tests
const realCreateElement = Document.prototype.createElement;

// ---------- backend route table, from source
type BackendRoute = { method: string; path: string; auth: boolean };
function mountsOf(routerName: string): string[] {
  return [...backend("app.ts").matchAll(new RegExp(`app\\.use\\("([^"]+)",\\s*${routerName}\\)`, "g"))].map((m) => m[1]);
}
function routesOf(file: string, prefixes: string[]): BackendRoute[] {
  const src = backend(file);
  const routerWideAuth = /router\.use\(requireAuth\)/.test(src);
  return [...src.matchAll(/router\.(get|post|put|patch|delete)\("([^"]+)",([^;]*)\);/g)].flatMap((m) =>
    prefixes.map((p) => ({ method: m[1].toUpperCase(), path: p + m[2], auth: routerWideAuth || /requireAuth/.test(m[3]) })),
  );
}
const integrationMounts = mountsOf("integrationRoutes");
const uploadMounts = mountsOf("uploadRoutes");
const BACKEND: BackendRoute[] = [...routesOf("routes/integration.routes.ts", integrationMounts), ...routesOf("routes/upload.routes.ts", uploadMounts)];

function backendRouteFor(method: string, url: string): BackendRoute | undefined {
  const u = new URL(url, "http://frontend.invalid");
  return BACKEND.find((r) => r.method === method && r.path === u.pathname);
}

// ---------- fetch recording
type Call = { url: string; method: string; credentials?: RequestCredentials; body?: unknown };
type Reply = { status?: number; json?: unknown; error?: Error };
function stubFetch(reply: (url: string) => Reply) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: (init?.method || "GET").toUpperCase(), credentials: init?.credentials, body: init?.body });
    const r = reply(url);
    if (r.error) throw r.error;
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }));
  return calls;
}
/** Every recorded call must hit a mounted backend route; authenticated routes must send the session cookie. */
function expectBackendContract(calls: Call[]) {
  expect(calls.length).toBeGreaterThan(0);
  for (const c of calls) {
    const route = backendRouteFor(c.method, c.url);
    expect(route, `${c.method} ${c.url} has no backend route`).toBeDefined();
    if (route!.auth) expect(c.credentials, `${c.method} ${c.url} needs credentials: "include"`).toBe("include");
  }
}
const jsonBody = (c: Call) => JSON.parse(String(c.body));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("backend route table read from source", () => {
  it("integration routes are mounted only at /api/v1/integrations; uploads at /api/v1/uploads and /api/uploads", () => {
    expect(integrationMounts).toEqual(["/api/v1/integrations"]);
    expect(uploadMounts).toEqual(["/api/v1/uploads", "/api/uploads"]);
    expect(BACKEND.map((r) => `${r.method} ${r.path}${r.auth ? " (auth)" : ""}`)).toEqual([
      "GET /api/v1/integrations/sites/:websiteId/settings (auth)",
      "PUT /api/v1/integrations/sites/:websiteId/settings (auth)",
      "POST /api/v1/integrations/paypal/create-order",
      "POST /api/v1/integrations/paypal/capture-order",
      "POST /api/v1/integrations/stripe/create-checkout-session",
      "GET /api/v1/integrations/dynamic-data/fetch",
      "POST /api/v1/integrations/crm/submit-lead",
      "POST /api/v1/integrations/webhook/dispatch (auth)",
      "POST /api/v1/integrations/google-sheets/test (auth)",
      "POST /api/v1/integrations/mailchimp/test (auth)",
      "POST /api/v1/integrations/zapier/test (auth)",
      "POST /api/v1/uploads/image (auth)",
      "POST /api/uploads/image (auth)",
    ]);
  });

  it("the upload middleware reads the multipart field the picker sends and returns { success, url }", () => {
    const mw = backend("middlewares/upload.middleware.ts");
    expect(mw).toContain(`headerText.includes('name="image"')`);
    expect(mw).toContain(`const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg"]);`);
    expect(mw).toContain("const MAX_FILE_SIZE = 5 * 1024 * 1024;");
    expect(mw).toMatch(/success: true,\s*url: publicUrl,/);
  });
});

// ---------- IntegrationElementRenderer (editor canvas / published site)
function renderIntegration(type: string, props: Record<string, string> = {}, isPreview = true) {
  return render(
    <IntegrationElementRenderer
      el={{ id: "el-1", type, styles: {} } as any}
      isPreview={isPreview}
      getStyleVal={(p) => props[p]}
      getInnerStyles={() => ({})}
      resolvedStyles={{}}
    />,
  );
}

describe("dynamic-data widget", () => {
  it("GET /api/v1/integrations/dynamic-data/fetch with url and jsonPath; shows the returned value", async () => {
    const calls = stubFetch(() => ({ json: { success: true, value: 4242, url: "https://api.example.test/x", jsonPath: "stars" } }));
    renderIntegration("dynamic-data", { dynamicApiUrl: "https://api.example.test/x", dynamicJsonPath: "stars", dynamicFallbackText: "fallback" });
    await screen.findByText("4242");
    expect(calls.map((c) => c.url)).toEqual([`${API}/api/v1/integrations/dynamic-data/fetch?url=${encodeURIComponent("https://api.example.test/x")}&jsonPath=stars`]);
    expectBackendContract(calls);
  });

  it("shows the fallback text for an error response or a network failure", async () => {
    stubFetch(() => ({ status: 400, json: { success: false, message: "Query parameter 'url' is required" } }));
    renderIntegration("dynamic-data", { dynamicFallbackText: "fallback text" });
    await waitFor(() => expect(screen.queryByText("Syncing live...")).toBeNull());
    expect(screen.getByText("fallback text")).toBeTruthy();
    cleanup();
    stubFetch(() => ({ error: new TypeError("Failed to fetch") }));
    renderIntegration("dynamic-data", { dynamicFallbackText: "offline text" });
    await waitFor(() => expect(screen.queryByText("Syncing live...")).toBeNull());
    expect(screen.getByText("offline text")).toBeTruthy();
  });
});

describe("paypal integration widget", () => {
  it("POST /api/v1/integrations/paypal/create-order with { amount, currency, itemName, env }; the demo response is reported", async () => {
    const calls = stubFetch(() => ({ json: { success: true, simulated: true, approveUrl: null, mode: "demo" } }));
    renderIntegration("paypal", { paypalAmount: "12.50", paypalItemName: "Book" });
    fireEvent.click(screen.getByRole("button", { name: /Pay with PayPal/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Development demo only: no PayPal order or payment was created.");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${API}/api/v1/integrations/paypal/create-order`);
    expect(jsonBody(calls[0])).toEqual({ amount: "12.50", currency: "USD", itemName: "Book", env: "sandbox" });
    expectBackendContract(calls);
  });

  it("shows the controller's error message, and a network failure", async () => {
    stubFetch(() => ({ status: 400, json: { success: false, message: "Invalid amount. Amount must be a positive number greater than 0." } }));
    renderIntegration("paypal");
    fireEvent.click(screen.getByRole("button", { name: /Pay with PayPal/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Invalid amount. Amount must be a positive number greater than 0.");
    cleanup();
    stubFetch(() => ({ error: new TypeError("Failed to fetch") }));
    renderIntegration("paypal");
    fireEvent.click(screen.getByRole("button", { name: /Pay with PayPal/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Failed to fetch");
  });

  it("makes no request outside preview", () => {
    const calls = stubFetch(() => ({ json: {} }));
    renderIntegration("paypal", {}, false);
    fireEvent.click(screen.getByRole("button", { name: /Pay with PayPal/ }));
    expect(calls).toEqual([]);
  });
});

describe("stripe integration widget", () => {
  it("POST /api/v1/integrations/stripe/create-checkout-session with { amount, currency, itemName }; error message shown", async () => {
    const calls = stubFetch(() => ({ status: 500, json: { success: false, message: "Stripe is not configured" } }));
    renderIntegration("stripe", { stripeAmount: "49.00", stripeItemName: "Pro" });
    fireEvent.click(screen.getByRole("button", { name: /Pay with Credit Card/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Stripe is not configured");
    expect(calls[0].url).toBe(`${API}/api/v1/integrations/stripe/create-checkout-session`);
    expect(jsonBody(calls[0])).toEqual({ amount: "49.00", currency: "USD", itemName: "Pro" });
    expectBackendContract(calls);
  });

  it("a response without sessionUrl is an error, not a redirect", async () => {
    stubFetch(() => ({ json: { success: true } }));
    renderIntegration("stripe");
    fireEvent.click(screen.getByRole("button", { name: /Pay with Credit Card/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Stripe checkout could not be created.");
  });
});

describe("crm-integration widget", () => {
  const fill = () => {
    fireEvent.change(screen.getByPlaceholderText("Full Name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByPlaceholderText("Work Email"), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Lead Data" }));
  };

  it("POST /api/v1/integrations/crm/submit-lead with { provider, name, email }; success status shown", async () => {
    const calls = stubFetch(() => ({ json: { success: true, syncId: "s1", provider: "hubspot" } }));
    renderIntegration("crm-integration");
    fill();
    expect((await screen.findByRole("status")).textContent).toBe("Lead successfully synced with CRM.");
    expect(calls[0].url).toBe(`${API}/api/v1/integrations/crm/submit-lead`);
    expect(jsonBody(calls[0])).toEqual({ provider: "hubspot", name: "Ada", email: "ada@example.test" });
    expectBackendContract(calls);
  });

  it("shows the controller's error message, and a network failure", async () => {
    stubFetch(() => ({ status: 400, json: { success: false, message: "Name and email are required for CRM sync" } }));
    renderIntegration("crm-integration");
    fill();
    expect((await screen.findByRole("alert")).textContent).toBe("Name and email are required for CRM sync");
    cleanup();
    stubFetch(() => ({ error: new TypeError("Failed to fetch") }));
    renderIntegration("crm-integration");
    fill();
    expect((await screen.findByRole("alert")).textContent).toBe("Failed to fetch");
  });
});

describe("webhook-integration widget (authenticated route)", () => {
  it("POST /api/v1/integrations/webhook/dispatch with the session cookie; dispatched state shown", async () => {
    const calls = stubFetch(() => ({ json: { success: true, status: 200, eventId: "e1", message: "Webhook dispatched successfully" } }));
    renderIntegration("webhook-integration", { webhookUrl: "https://hooks.example.test/1", webhookTriggerEvent: "onButtonClick" });
    fireEvent.click(screen.getByRole("button", { name: "Fire Webhook Event" }));
    await screen.findByRole("button", { name: "Webhook Dispatched ✓" });
    expect(calls[0].url).toBe(`${API}/api/v1/integrations/webhook/dispatch`);
    expect(calls[0].credentials).toBe("include");
    const body = jsonBody(calls[0]);
    expect(body).toMatchObject({ webhookUrl: "https://hooks.example.test/1", eventType: "onButtonClick" });
    expect(typeof body.timestamp).toBe("string");
    expectBackendContract(calls);
  });

  it("a 401 from requireAuth is shown as an error", async () => {
    stubFetch(() => ({ status: 401, json: { success: false, message: "Authentication required" } }));
    renderIntegration("webhook-integration");
    fireEvent.click(screen.getByRole("button", { name: "Fire Webhook Event" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Authentication required");
  });
});

// ---------- PayPalButtonWidgetRenderer (widget library button)
describe("paypal-button widget", () => {
  const el = { id: "pp", type: "paypal-button", paypalAmount: "19.99", paypalItemName: "Digital Product" } as any;

  it("create-order then capture-order at the API origin; receipt shown", async () => {
    const calls = stubFetch((url) => (url.endsWith("/create-order") ? { json: { success: true, simulated: false, orderId: "o-1", approveUrl: null } } : { json: { success: true, orderId: "o-1", status: "COMPLETED", transactionId: "t-1" } }));
    render(<PayPalButtonWidgetRenderer el={el} isPreview={true} mergedStyles={{}} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay Now with PayPal/ }));
    await screen.findByText(/Payment Successful!/);
    expect(screen.getByText("t-1")).toBeTruthy();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST ${API}/api/v1/integrations/paypal/create-order`,
      `POST ${API}/api/v1/integrations/paypal/capture-order`,
    ]);
    expect(jsonBody(calls[0])).toEqual({ amount: "19.99", currency: "USD", itemName: "Digital Product", itemDescription: "", quantity: 1, env: "sandbox" });
    expect(jsonBody(calls[1])).toEqual({ orderId: "o-1" });
    expectBackendContract(calls);
  });

  it("an error response stops before capture and shows the message", async () => {
    const calls = stubFetch(() => ({ status: 400, json: { success: false, message: "Invalid amount. Amount must be a positive number greater than 0." } }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PayPalButtonWidgetRenderer el={el} isPreview={true} mergedStyles={{}} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay Now with PayPal/ }));
    await screen.findByText(/Payment Failed/);
    expect(screen.getByText("Invalid amount. Amount must be a positive number greater than 0.")).toBeTruthy();
    expect(calls).toHaveLength(1);
  });

  it("a network failure shows the error state", async () => {
    stubFetch(() => ({ error: new TypeError("Failed to fetch") }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PayPalButtonWidgetRenderer el={el} isPreview={true} mergedStyles={{}} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay Now with PayPal/ }));
    await screen.findByText(/Payment Failed/);
    expect(screen.getByText("Failed to fetch")).toBeTruthy();
  });
});

// ---------- ManagedSiteModal integration "test" buttons (authenticated routes)
describe("ManagedSiteModal integration test buttons", () => {
  const site = { id: "site-1", name: "Site", slug: "site", status: "PUBLISHED" } as any;
  const openIntegrations = async () => {
    render(<ManagedSiteModal website={site} isOpen={true} onClose={() => {}} onWebsiteUpdated={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /^Integrations$/ }));
  };
  const testCalls = (calls: Call[]) => calls.filter((c) => c.url.includes("/integrations/"));

  it("Google Sheets: POST /api/v1/integrations/google-sheets/test with the session cookie; success feedback", async () => {
    const calls = stubFetch((url) => (url.includes("/integrations/") ? { json: { success: true, provider: "google_sheets", rowsAppended: 1 } } : { json: { success: true } }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await openIntegrations();
    fireEvent.change(screen.getByPlaceholderText("https://script.google.com/macros/s/.../exec"), { target: { value: "https://script.example.test/exec" } });
    fireEvent.click(screen.getByRole("button", { name: /Test Row Append/ }));
    await screen.findByText("Google Sheets connection test succeeded!");
    const [call] = testCalls(calls);
    expect(call.url).toBe(`${API}/api/v1/integrations/google-sheets/test`);
    expect(call.method).toBe("POST");
    expect(call.credentials).toBe("include");
    expect(jsonBody(call)).toEqual({ webhookUrl: "https://script.example.test/exec" });
    expectBackendContract(testCalls(calls));
  });

  it("a 401 (or any error body) shows its message; an empty form makes no request", async () => {
    const calls = stubFetch((url) => (url.includes("/integrations/") ? { status: 401, json: { success: false, message: "Authentication required" } } : { json: { success: true } }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await openIntegrations();
    fireEvent.click(screen.getByRole("button", { name: /Test Row Append/ }));
    await screen.findByText("Please enter a Google Sheets Webhook URL first.");
    expect(testCalls(calls)).toEqual([]);
    fireEvent.change(screen.getByPlaceholderText("https://script.google.com/macros/s/.../exec"), { target: { value: "https://script.example.test/exec" } });
    fireEvent.click(screen.getByRole("button", { name: /Test Row Append/ }));
    await screen.findByText("Authentication required");
    expectBackendContract(testCalls(calls));
  });
});

// ---------- shared image picker (inspector controls, canvas media placeholders)
describe("shared image picker upload", () => {
  function pick(file: File | undefined, onChange: (url: string) => void) {
    let input!: HTMLInputElement;
    vi.spyOn(document, "createElement").mockImplementation(((tag: string, opts?: ElementCreationOptions) => {
      const node = realCreateElement.call(document, tag, opts);
      if (tag === "input") { input = node as HTMLInputElement; vi.spyOn(input, "click").mockImplementation(() => {}); }
      return node;
    }) as typeof document.createElement);
    triggerImagePicker(onChange);
    Object.defineProperty(input, "files", { value: file ? [file] : [] });
    return act(async () => { await (input.onchange as any)({ target: input }); });
  }
  const png = () => new File(["png-bytes"], "pic.png", { type: "image/png" });

  it("success: multipart field \"image\" to POST /api/v1/uploads/image with the session cookie; the returned url is used", async () => {
    const calls = stubFetch(() => ({ json: { success: true, url: "/uploads/images/img_1_abc.png", width: 10, height: 10 } }));
    const onChange = vi.fn();
    const file = png();
    await pick(file, onChange);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${API}/api/v1/uploads/image`);
    expect(calls[0].credentials).toBe("include");
    expect((calls[0].body as FormData).get("image")).toBe(file);
    expect(onChange.mock.calls).toEqual([["/uploads/images/img_1_abc.png"]]);
    expectBackendContract(calls);
  });

  it("rejected upload (400 from the middleware) or 401: falls back to a local data URL", async () => {
    for (const reply of [{ status: 400, json: { success: false, error: { message: "Invalid file type. Allowed: JPG, PNG, WEBP, GIF, SVG" } } }, { status: 401, json: { success: false, message: "Authentication required" } }]) {
      stubFetch(() => reply);
      const onChange = vi.fn();
      await pick(png(), onChange);
      await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
      expect(onChange.mock.calls[0][0]).toBe("data:image/png;base64,cG5nLWJ5dGVz");
      vi.unstubAllGlobals();
    }
  });

  it("network failure: falls back to a local data URL", async () => {
    stubFetch(() => ({ error: new TypeError("Failed to fetch") }));
    const onChange = vi.fn();
    await pick(png(), onChange);
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange.mock.calls[0][0]).toBe("data:image/png;base64,cG5nLWJ5dGVz");
  });

  it("an ok response without url falls back to a data URL", async () => {
    stubFetch(() => ({ json: { success: true } }));
    const onChange = vi.fn();
    await pick(png(), onChange);
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange.mock.calls[0][0]).toMatch(/^data:image\/png;base64,/);
  });

  it("files the backend does not accept (video, over 5 MB) are not uploaded and use a data URL", async () => {
    const calls = stubFetch(() => ({ json: { success: true, url: "/never" } }));
    const onChange = vi.fn();
    await pick(new File(["vid"], "clip.mp4", { type: "video/mp4" }), onChange);
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange.mock.calls[0][0]).toBe("data:video/mp4;base64,dmlk");
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    const onBig = vi.fn();
    await pick(big, onBig);
    await waitFor(() => expect(onBig).toHaveBeenCalledOnce());
    expect(onBig.mock.calls[0][0]).toMatch(/^data:image\/png;base64,/);
    expect(calls).toEqual([]);
  });

  it("selection through ImagePickerControl stores the uploaded URL via onChange (the element's src)", async () => {
    stubFetch(() => ({ json: { success: true, url: "/uploads/images/img_2_def.png" } }));
    let input!: HTMLInputElement;
    vi.spyOn(document, "createElement").mockImplementation(((tag: string, opts?: ElementCreationOptions) => {
      const node = realCreateElement.call(document, tag, opts);
      if (tag === "input") { input = node as HTMLInputElement; vi.spyOn(input, "click").mockImplementation(() => {}); }
      return node;
    }) as typeof document.createElement);
    let value = "";
    const view = render(<ImagePickerControl value={value} onChange={(u) => { value = u; }} />);
    fireEvent.click(screen.getByRole("button", { name: /Select Image/ }));
    Object.defineProperty(input, "files", { value: [png()] });
    await act(async () => { await (input.onchange as any)({ target: input }); });
    expect(value).toBe("/uploads/images/img_2_def.png");
    view.rerender(<ImagePickerControl value={value} onChange={() => {}} />);
    expect((screen.getByPlaceholderText(/or click select image/) as HTMLInputElement).value).toBe("/uploads/images/img_2_def.png");
  });
});
