// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SubscriptionPage from "../../src/pages/subscriptions/SubscriptionPage";
import { UnifiedAiAssistant } from "../../src/features/ai/UnifiedAiAssistant";
import { FormWidgetRenderer } from "../../src/pages/editor/widgets/renderers";
import { useEditorShortcuts } from "../../src/pages/editor/core/useEditorShortcuts";

vi.mock("../../src/components/HeaderUserDropdown", () => ({ HeaderUserDropdown: () => null }));
vi.mock("../../src/features/ai/DesignAssistant", () => ({ DesignAssistant: () => null }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

const plan = (slug: string, price: number, billingInterval = "month") => ({
  id: slug, name: slug, slug, price, billingInterval, currency: "USD", websiteLimit: 3,
  aiCreditLimit: 50, storageLimitMb: 500, isActive: true,
});
const free = plan("free", 0);
const paid = plan("professional", 29);
const reply = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

async function mountPlans(selectResponse: () => Promise<Response>, plans = [free, paid]) {
  let current = { id: "sub", status: "ACTIVE", plan: free };
  const select = vi.fn(selectResponse);
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.endsWith("/select")) return select().then(async response => {
      const body = await response.json();
      if (response.ok && body?.success !== false && body?.data?.subscription) current = body.data.subscription;
      return reply(body, response.ok);
    });
    const data = url.endsWith("/plans") ? { plans }
      : url.endsWith("/current") ? { subscription: current }
      : { invoices: [] };
    return Promise.resolve(reply({ success: true, data }));
  }));
  render(<MemoryRouter><SubscriptionPage /></MemoryRouter>);
  await screen.findByRole("button", { name: "Upgrade" });
  return select;
}

describe("merged subscription flow", () => {
  it("shows verified-checkout errors on the confirmation screen and allows retry", async () => {
    const select = await mountPlans(async () => reply({ success: false, detail: "Verified checkout required" }, false));
    fireEvent.click(screen.getByRole("button", { name: "Upgrade" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm plan" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Verified checkout required");
    expect(screen.queryByText("Payment Successful!")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm plan" }));
    await waitFor(() => expect(select).toHaveBeenCalledTimes(2));
  });

  it("guards repeated confirmations while a request is pending", async () => {
    let finish!: (r: Response) => void;
    const select = await mountPlans(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Upgrade" }));
    const confirm = screen.getByRole("button", { name: "Confirm plan" });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(select).toHaveBeenCalledTimes(1);
    await act(async () => { finish(reply({ success: false, message: "Try later" })); });
    expect((await screen.findByRole("alert")).textContent).toBe("Try later");
  });

  it("does not treat a failed HTTP-200 payload as a successful update", async () => {
    await mountPlans(async () => reply({ success: false, message: "Plan unavailable" }));
    fireEvent.click(screen.getByRole("button", { name: "Upgrade" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm plan" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Plan unavailable");
    expect(screen.queryByRole("heading", { name: "Subscription updated" })).toBeNull();
  });

  it("reports the returned status without claiming a payment was made", async () => {
    await mountPlans(async () => reply({ success: true, data: { subscription: { id: "sub", status: "PENDING", plan: paid } } }));
    fireEvent.click(screen.getByRole("button", { name: "Upgrade" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm plan" }));
    await screen.findByRole("heading", { name: "Subscription updated" });
    expect(screen.getByText(/Your billing status is PENDING/)).toBeTruthy();
    expect(screen.queryByText(/Payment Successful/)).toBeNull();
  });

  it("offers only catalog annual prices and sends the corresponding plan slug", async () => {
    await mountPlans(async () => reply({ success: false, message: "checkout" }), [free, paid, plan("annual-pro", 290, "year")]);
    expect(screen.getByText(/\$29(?:\.00)?$/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Annual" }));
    expect(screen.getByText(/\$290(?:\.00)?$/)).toBeTruthy();
    expect(screen.queryByText(/\$29(?:\.00)?$/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Upgrade" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm plan" }));
    await screen.findByRole("alert");
    const request = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/select"));
    expect(JSON.parse(request![1]!.body as string)).toEqual({ planSlug: "annual-pro" });
  });

  it("never substitutes hardcoded plans when the catalog fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ success: false, message: "Catalog offline" }, false)));
    render(<MemoryRouter><SubscriptionPage /></MemoryRouter>);
    await screen.findByText("Catalog offline");
    expect(screen.queryByRole("button", { name: "Upgrade" })).toBeNull();
    expect(screen.queryByText(/\$29(?:\.00)?$/)).toBeNull();
  });
});

describe("merged AI response handling", () => {
  it.each([
    [null, true, "AI action failed"],
    [{ success: false, detail: "Provider rejected request" }, true, "Provider rejected request"],
    [{ code: "DOCUMENT_VERSION_CONFLICT" }, false, "The website was updated concurrently. Please reload and try again."],
    [{ code: "DOCUMENT_PRECONDITION_REQUIRED" }, false, "Authoritative document version required. Please reload the website."],
  ])("validates response %j and preserves document errors", async (body, ok, message) => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(body, ok)));
    render(<UnifiedAiAssistant apiUrl="http://localhost" websiteId="site" prepare={async () => 3} onApplied={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/Ask ForgeStudio AI/), { target: { value: "build a hero" } });
    fireEvent.click(screen.getByRole("button", { name: /Run AI Command/i }));
    expect(await screen.findByText(message)).toBeTruthy();
  });
});

it("the extracted form renderer retains integration verification tokens", async () => {
  const fetchMock = vi.fn(async () => reply({ success: true }));
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<FormWidgetRenderer el={{ id: "form", type: "form", content: "", styles: {}, formFields: [{ id: "name", type: "text", label: "Name", required: false }] }} isPreview websiteId="site" mergedStyles={{}} />);
  const form = view.container.querySelector("form")!;
  for (const [name, value] of [["cf-turnstile-response", "turnstile-proof"], ["g-recaptcha-response", "recaptcha-proof"]]) {
    const input = document.createElement("input"); input.name = name; input.value = value; form.append(input);
  }
  await act(async () => { fireEvent.submit(form); });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).integrationTokens).toEqual({ turnstile: "turnstile-proof", recaptcha: "recaptcha-proof" });
});

it("the single shortcut hook closes overlays while typing and saves the latest callback", () => {
  const originalSave = vi.fn(), latestSave = vi.fn(), closeFinder = vi.fn();
  const props = { selectedId: null, selectedIds: [], copiedElement: null, elements: [], historyIndex: 0,
    history: [], isFullScreenCanvas: false, isPreview: false, saving: false, isShortcutsHelpOpen: false,
    isFinderOpen: true, setIsFinderOpen: closeFinder, setIsShortcutsHelpOpen: vi.fn(), setIsFullScreenCanvas: vi.fn(),
    setIsPreview: vi.fn(), handleSave: originalSave, handleDeleteElement: vi.fn(), handleUndo: vi.fn(),
    handleRedo: vi.fn(), handleCopyElement: vi.fn(), handlePasteElement: vi.fn(), handleDuplicateElement: vi.fn(), handleReorderElement: vi.fn() };
  function Harness({ save }: { save: () => void }) { useEditorShortcuts({ ...props, handleSave: save }); return <input />; }
  const view = render(<Harness save={originalSave} />);
  view.rerender(<Harness save={latestSave} />);
  screen.getByRole("textbox").focus();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(closeFinder).toHaveBeenCalledTimes(1);
  screen.getByRole("textbox").blur();
  fireEvent.keyDown(window, { key: "s", ctrlKey: true });
  expect(originalSave).not.toHaveBeenCalled();
  expect(latestSave).toHaveBeenCalledTimes(1);
  view.unmount();
  fireEvent.keyDown(window, { key: "s", ctrlKey: true });
  expect(latestSave).toHaveBeenCalledTimes(1);
});
