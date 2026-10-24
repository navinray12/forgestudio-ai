// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormDeliveryPolicyPanel } from "../src/pages/editor/components/forms/FormDeliveryPolicyPanel";

const response = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WP04 server-only form delivery settings", () => {
  it("loads only redacted status and saves secrets through the owner API, not the editor document", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ success: true, data: { configured: false, formId: "form_1", activeActions: [] } }))
      .mockResolvedValueOnce(response({ success: true, data: { configured: true, formId: "form_1", activeActions: ["webhook"] } }));
    vi.stubGlobal("fetch", fetcher);
    render(<FormDeliveryPolicyPanel websiteId="site_1" formId="form_1" apiUrl="https://api.example.com" />);
    await screen.findByText("No server-side delivery policy configured.");
    fireEvent.click(screen.getByLabelText("Webhook", { selector: "input" }));
    fireEvent.change(screen.getByLabelText("Webhook HTTPS URL"), { target: { value: "https://hooks.example.com/new" } });
    fireEvent.change(screen.getByLabelText("Webhook secret (optional)"), { target: { value: "do-not-publish" } });
    fireEvent.click(screen.getByRole("button", { name: "Save secure delivery" }));
    await screen.findByText(/Delivery settings saved securely/);
    const [url, init] = fetcher.mock.calls[1];
    expect(url).toBe("https://api.example.com/api/forms/site_1/forms/form_1/delivery");
    expect(init.credentials).toBe("include");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body);
    expect(body.actions.webhookConfig.secretKey).toBe("do-not-publish");
    expect(body.actions.webhookConfig.endpointUrl).toBe("https://hooks.example.com/new");
    expect((screen.getByLabelText("Webhook secret (optional)") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("do-not-publish")).toBeNull();
  });

  it("does not offer saving when owner access is denied", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ success: false }, 403));
    vi.stubGlobal("fetch", fetcher);
    render(<FormDeliveryPolicyPanel websiteId="site_1" formId="form_2" />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Save secure delivery" })).toBeNull();
  });

  it("revokes the encrypted policy and clears configured action status on confirmed deletion", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ success: true, data: { configured: true, formId: "form_3", activeActions: ["email"] } }))
      .mockResolvedValueOnce(response({ success: true, data: { configured: false, formId: "form_3" } }));
    vi.stubGlobal("fetch", fetcher);
    render(<FormDeliveryPolicyPanel websiteId="site_1" formId="form_3" />);
    await screen.findByText("Configured actions: email");
    fireEvent.click(screen.getByRole("button", { name: "Disable delivery" }));
    await waitFor(() => expect(screen.getByText("External delivery policy removed.")).toBeTruthy());
    expect(fetcher.mock.calls[1][1].method).toBe("DELETE");
    expect(fetcher.mock.calls[1][1].credentials).toBe("include");
    expect(screen.getByText("No server-side delivery policy configured.")).toBeTruthy();
  });
});
