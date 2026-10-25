// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import PublishedSite from "../../src/pages/published/PublishedSite";
import { loadSiteSnapshot } from "../../src/features/developer-workspace/services/loadSiteSnapshot";

vi.mock("../../src/features/developer-workspace/services/loadSiteSnapshot", () => ({ loadSiteSnapshot: vi.fn() }));
vi.mock("../../src/features/integrations/PublishedIntegrations", () => ({
  integrationFormTokens: () => ({}),
  PublishedIntegrations: ({ settings }: { settings: unknown }) => <output data-testid="integration-settings">{JSON.stringify(settings)}</output>,
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("loads integrations and clears the preceding site's header and integrations on navigation", async () => {
  vi.stubGlobal("matchMedia", (media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} }));
  const heading = (id: string, content: string) => ({ id, type: "heading", content, styles: {} });
  vi.mocked(loadSiteSnapshot).mockImplementation(async (_api, id) => ({
    id, name: id, editorData: {
      pages: [{ id: "home", name: "Home", slug: "/", elements: [heading("body", `Body ${id}`)] }],
      ...(id === "first" ? {
        integrations: { turnstileSiteKey: "public-site-key" },
        siteParts: { header: { elements: [heading("header", "First site header")] } },
      } : {}),
    },
  }) as any);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })));
  function NextSite() { const navigate = useNavigate(); return <button onClick={() => navigate("/site/second")}>Next site</button>; }
  render(<MemoryRouter initialEntries={["/site/first"]}><NextSite /><Routes><Route path="/site/:websiteId" element={<PublishedSite />} /></Routes></MemoryRouter>);
  await screen.findByText("First site header");
  expect(screen.getByTestId("integration-settings").textContent).toContain("public-site-key");
  fireEvent.click(screen.getByRole("button", { name: "Next site" }));
  await screen.findByText("Body second");
  await waitFor(() => expect(screen.queryByText("First site header")).toBeNull());
  expect(screen.getByTestId("integration-settings").textContent).toBe("null");
});
