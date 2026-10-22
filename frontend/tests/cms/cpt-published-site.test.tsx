// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import CustomPostTypesPanel from "../../src/pages/dashboard/components/CustomPostTypesPanel";
import PublishedSite from "../../src/pages/published/PublishedSite";

vi.mock("../../src/features/developer-workspace/services/loadSiteSnapshot", () => ({
  loadSiteSnapshot: vi.fn().mockResolvedValue({
    id: "site-cpt-123",
    name: "CPT Showcase Site",
    status: "PUBLISHED",
    editorData: {
      pages: [
        { id: "home", name: "Home", slug: "/", elements: [] },
      ],
      elements: [],
    },
  }),
}));

describe("CMS & Custom Post Types and PublishedSite Dynamic Views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders CustomPostTypesPanel and displays header", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/websites")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ websites: [{ id: "site-1", name: "My Website" }] }),
        } as Response);
      }
      if (url.includes("/api/cpt/websites/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "cpt-1",
                  name: "Articles",
                  singular: "Article",
                  plural: "Articles",
                  slug: "articles",
                  description: "All articles",
                  hasArchive: true,
                  createdAt: new Date().toISOString(),
                },
              ],
            }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard?tab=cpts&site=site-1"]}>
        <CustomPostTypesPanel />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Custom Post Types").length).toBeGreaterThan(0);
      expect(screen.getByText("Articles")).toBeTruthy();
    });
  });

  it("renders PublishedSite dynamic blog archive view when navigating to blog slug", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/entries")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              postType: { name: "Blog Posts", description: "All company updates" },
              data: [
                {
                  id: "entry-1",
                  title: "First Post",
                  slug: "first-post",
                  createdAt: "2026-10-22T00:00:00.000Z",
                  values: { content: "Sample blog body content" },
                },
              ],
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);
    });

    render(
      <MemoryRouter initialEntries={["/site/site-cpt-123/blog"]}>
        <Routes>
          <Route path="/site/:websiteId/:pageSlug" element={<PublishedSite />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Editorial & Insights")).toBeTruthy();
      expect(screen.getByText("First Post")).toBeTruthy();
    });
  });

  it("renders PublishedSite single entry view when navigating to blog post slug", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/entries/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              postType: { name: "Blog Posts", slug: "blog" },
              entry: {
                id: "entry-1",
                title: "In-Depth Architectural Analysis",
                slug: "in-depth-analysis",
                createdAt: "2026-10-22T00:00:00.000Z",
                values: { content: "<p>Deep article content goes here.</p>" },
              },
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);
    });

    render(
      <MemoryRouter initialEntries={["/site/site-cpt-123/blog/in-depth-analysis"]}>
        <Routes>
          <Route path="/site/:websiteId/:cptSlug/:entrySlug" element={<PublishedSite />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("In-Depth Architectural Analysis").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Home/i).length).toBeGreaterThan(0);
    });
  });
});
