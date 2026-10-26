// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Correct behaviour for autosave visibility (supersedes KNOWN GAP 2): the editor shows the existing
 * AutosaveStatusIndicator, driven by useAutosave's status / lastSavedAt / errorMessage. A failure
 * is visible and never presented as saved; a later edit or a manual save recovers; the indicator's
 * refresh interval does not outlive the editor; read-only viewers see no save status.
 */
import { cleanup, screen, waitFor } from "@testing-library/react";
import { flush, mountEditor, SAVED_BADGE, siteFixture, SITE_ID } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const AUTOSAVE_WAIT = { timeout: 8000 };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

/** The indicator's text (it is the only role=status element whose text starts with these). */
const indicator = () => screen.queryAllByRole("status").map((n) => n.textContent?.trim() ?? "").filter((t) => /^(Saved|Saving|Unsaved changes|Save failed)/.test(t));
const failingPuts = (failures: { remaining: number }) => (r: { method: string; url: string }) =>
  r.method === "PUT" && failures.remaining-- > 0 ? { status: 500, body: { error: { message: "Database unavailable" } } } : undefined;

describe("autosave status indicator (FIXED, was KNOWN GAP 2)", () => {
  it("goes Saved -> Unsaved changes -> Saved just now around a successful autosave", async () => {
    const { backend, select, key } = await mountEditor();
    expect(indicator()).toEqual(["Saved"]);
    // Record every badge state the DOM passes through: under full-suite load the 1.5s debounce can
    // elapse before a point-in-time check, but each state is still rendered in its own commit.
    const seen: string[] = [];
    const record = () => { const t = indicator().join("|"); if (t && seen[seen.length - 1] !== t) seen.push(t); };
    const observer = new MutationObserver(record);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    record();
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    await waitFor(() => expect(indicator()[0]).toMatch(SAVED_BADGE));
    observer.disconnect();
    const order = ["Saved", "Unsaved changes", "Saved just now"].map((s) => seen.indexOf(s));
    expect(order.every((i) => i >= 0), seen.join(" -> ")).toBe(true);
    expect([...order].sort((a, b) => a - b), seen.join(" -> ")).toEqual(order);
  });

  it("a failed autosave shows 'Save failed' with the server reason and never claims Saved", async () => {
    const { backend, select, key } = await mountEditor(siteFixture(), [failingPuts({ remaining: 99 })]);
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves().length).toBeGreaterThan(0), AUTOSAVE_WAIT);
    await waitFor(() => expect(indicator()).toEqual(["Save failed"]));
    const badge = screen.getAllByRole("status").find((n) => n.textContent?.trim() === "Save failed")!;
    expect(badge.getAttribute("title")).toContain("Database unavailable");
    expect(badge.getAttribute("aria-live")).toBe("assertive");
    await new Promise((r) => setTimeout(r, 2000)); // the failed snapshot is not silently retried
    await flush();
    expect(backend.saves()).toHaveLength(1);
    expect(indicator()).toEqual(["Save failed"]);
  });

  it("recovers on the next edit: the pending save is re-sent with its key, then the new edit, and the badge returns to Saved", async () => {
    const { backend, select, key } = await mountEditor(siteFixture(), [failingPuts({ remaining: 1 })]);
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(indicator()).toEqual(["Save failed"]), AUTOSAVE_WAIT);
    await select("elB");
    await key("Delete");
    await waitFor(() => expect(indicator()[0]).toMatch(SAVED_BADGE), AUTOSAVE_WAIT);
    const keys = backend.saves().map((s) => s.headers["Idempotency-Key"]);
    expect(keys.length).toBe(3);
    expect(keys[1]).toBe(keys[0]); // the unknown-outcome command is retried unchanged first
    expect(keys[2]).not.toBe(keys[0]);
    expect(backend.saves()[2].headers["If-Match"]).toBe(`"${SITE_ID}:document:4"`);
  });

  it("recovers on a manual save: Ctrl+S after a failed autosave clears the failure", async () => {
    const { backend, select, key } = await mountEditor(siteFixture(), [failingPuts({ remaining: 1 })]);
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(indicator()).toEqual(["Save failed"]), AUTOSAVE_WAIT);
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(indicator()[0]).toMatch(SAVED_BADGE));
    expect(backend.saves().length).toBeGreaterThanOrEqual(2);
    expect(screen.queryAllByText("Save failed")).toHaveLength(0);
  });

  it("read-only viewers see no save status", async () => {
    await mountEditor(siteFixture({ userPermission: "VIEWER" }));
    expect(indicator()).toEqual([]);
  });

  it("the indicator's refresh interval is cleared when the editor unmounts", async () => {
    const live = new Set<unknown>();
    const realSet = window.setInterval.bind(window);
    const realClear = window.clearInterval.bind(window);
    vi.spyOn(window, "setInterval").mockImplementation(((fn: TimerHandler, ms?: number, ...rest: unknown[]) => {
      const id = realSet(fn, ms, ...rest);
      if (ms === 10000) live.add(id);
      return id;
    }) as typeof window.setInterval);
    vi.spyOn(window, "clearInterval").mockImplementation(((id?: number) => { live.delete(id); realClear(id); }) as typeof window.clearInterval);
    const { view, backend, select, key } = await mountEditor();
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    await waitFor(() => expect(indicator()[0]).toMatch(SAVED_BADGE));
    expect(live.size).toBe(1);
    view.unmount();
    expect(live.size).toBe(0);
  });
});
