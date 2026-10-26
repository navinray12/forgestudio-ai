// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterisation of the editor's initial website load (captured before the useWebsiteLoader
 * extraction and kept as its contract): the loading indicator, error handling, the loaded document
 * version as the save precondition, and a website change while a load is in flight (the old request
 * is aborted and its late response never applied). Success, 403, a mismatched website id, abort on
 * unmount, component-access failure and legacy documents are covered in website-editor-behaviour and
 * loading-sync.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import WebsiteEditor from "../../src/pages/editor/WebsiteEditor";
import { API, flush, heading, installBackend, mountEditor, siteFixture, SITE_ID } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const LOADING = "Loading Website Editor...";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const held = () => { let release!: () => void; const gate = new Promise<void>((r) => { release = r; }); return { gate, release: () => release() }; };

describe("initial website load", () => {
  it("shows the loading indicator while the website request is pending and the canvas once it resolves", async () => {
    const h = held();
    const { canvasIds } = await mountEditor(siteFixture(), [
      (r) => (r.method === "GET" && r.url === `${API}/api/websites/${SITE_ID}` ? h.gate.then(() => ({ status: 200, body: { website: siteFixture() } })) : undefined),
    ], { waitForLoad: false });
    await flush(3);
    expect(screen.getByText(LOADING)).toBeTruthy();
    expect(canvasIds()).toEqual([]);
    await act(async () => { h.release(); });
    await waitFor(() => expect(canvasIds()).toEqual(["elA", "elB"]));
    expect(screen.queryByText(LOADING)).toBeNull();
  });

  it("clears the loading indicator after a failed load and shows the error", async () => {
    await mountEditor(siteFixture(), [
      (r) => (r.method === "GET" && r.url === `${API}/api/websites/${SITE_ID}` ? { status: 500, body: {} } : undefined),
    ], { waitForLoad: false });
    await waitFor(() => expect(screen.getAllByText(/could not be loaded/).length).toBeGreaterThan(0));
    expect(screen.queryByText(LOADING)).toBeNull();
  });

  it("the loaded document version is the precondition of the first save", async () => {
    const { backend, key } = await mountEditor(siteFixture({ documentVersion: 9 }));
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(backend.saves()).toHaveLength(1));
    expect(backend.saves()[0].headers["If-Match"]).toBe(`"${SITE_ID}:document:9"`);
  });
});

describe("website change while a load is in flight", () => {
  it("aborts the previous request and never applies its late response", async () => {
    const OTHER = "site2";
    const first = held();
    let navigate!: (to: string) => void;
    function Navigator() { const nav = useNavigate(); useEffect(() => { navigate = nav; }, [nav]); return null; }
    const site1 = siteFixture();
    const site2 = { ...siteFixture(), id: OTHER, name: "Second", editorData: { pages: [{ id: "home", name: "Home", slug: "/", elements: [heading("other1", "Other site heading")] }] } };
    const backend = installBackend(site1, [
      (r) => (r.method === "GET" && r.url === `${API}/api/websites/${SITE_ID}` ? first.gate.then(() => ({ status: 200, body: { website: site1 } })) : undefined),
      (r) => (r.method === "GET" && r.url === `${API}/api/websites/${OTHER}` ? { status: 200, body: { website: site2 } } : undefined),
    ]);
    const D = HTMLDialogElement.prototype as any;
    D.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    D.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
    window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as any;
    (globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
    (globalThis as any).IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
    Element.prototype.scrollIntoView ??= function () {};
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(
      <MemoryRouter initialEntries={[`/editor/${SITE_ID}`]}>
        <Navigator />
        <Routes><Route path="/editor/:websiteId" element={<WebsiteEditor />} /></Routes>
      </MemoryRouter>,
    );
    const ids = () => [...view.container.querySelectorAll("[data-el-id]")].map((n) => n.getAttribute("data-el-id"));
    await waitFor(() => expect(backend.requests.some((r) => r.url === `${API}/api/websites/${SITE_ID}`)).toBe(true));
    const firstLoad = backend.requests.find((r) => r.url === `${API}/api/websites/${SITE_ID}`)!;
    await act(async () => { navigate(`/editor/${OTHER}`); });
    expect(firstLoad.signal?.aborted).toBe(true);
    await waitFor(() => expect(ids()).toEqual(["other1"]));
    await act(async () => { first.release(); });
    await flush(6);
    expect(ids()).toEqual(["other1"]); // the late site1 response is never applied
  });
});
