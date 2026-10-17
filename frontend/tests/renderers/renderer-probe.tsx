/* global vi -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Deterministic behaviour probe for canvas/published widget renderers.
 *
 * Stub values avoid tokens that look like Tailwind utilities (a word, a dash and a number), because
 * Tailwind scans test files too and would add such classes to the production stylesheet.
 *
 * Everything runs under a fixed fake clock (Date, timeouts, intervals), a fixed Math.random and
 * crypto.randomUUID, and stubs for fetch, window.open, the clipboard, IntersectionObserver,
 * scrollIntoView and HTMLMediaElement play/pause/load. probeRenderer(Component, props, callbacks) returns:
 *  - markup:    initial HTML;
 *  - tick:      hash of the HTML after advancing the clock by 6s (autoplay, rotations, countdowns);
 *  - cleanup:   timers still pending and window listeners not removed after unmount;
 *  - trace:     for every interactive control (fresh render each), the callback calls, fetch and
 *               window.open calls, and a hash of the resulting HTML.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createHash } from "node:crypto";
import type { ComponentType } from "react";

export const RENDER_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
export const RENDER_RANDOM = 0.123456789;
const FIXED_UUID = "00000000-0000-4000-8000-000000000000";

type Entry = unknown[];
export interface RendererProbe {
  markup: string;
  tick: string;
  cleanup: { pendingTimers: number; leakedWindowListeners: string[] };
  trace: Array<[string, Entry[], string]>;
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

/** Events/DOM nodes become stable markers (parenthesised, so Tailwind never reads them as utilities). */
function recordable(value: unknown): unknown {
  if (value instanceof Event) return `(event ${value.type})`;
  if (value && typeof value === "object" && "nativeEvent" in value && "type" in value) return `(event ${String((value as { type: unknown }).type)})`;
  if (typeof Node !== "undefined" && value instanceof Node) return `(node ${value.nodeName.toLowerCase()})`;
  if (typeof FormData !== "undefined" && value instanceof FormData) return `(formdata ${JSON.stringify([...value.entries()].map(([k, v]) => [k, String(v)]))})`;
  return value;
}

interface Env { log: Entry[]; listeners: Map<string, number>; restore: () => void }

function installEnvironment(): Env {
  const log: Entry[] = [];
  const listeners = new Map<string, number>();
  vi.useFakeTimers({ now: RENDER_NOW, toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.spyOn(Math, "random").mockReturnValue(RENDER_RANDOM);
  if (globalThis.crypto?.randomUUID) vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(FIXED_UUID as `${string}-${string}-${string}-${string}-${string}`);
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    log.push(["fetch", String(url), init?.method ?? "GET", recordable(init?.body)]);
    return { ok: true, status: 200, json: async () => ({ success: true, id: "orderprobe1", orderId: "orderprobe1" }), text: async () => "" };
  }));
  vi.spyOn(window, "open").mockImplementation(((...args: unknown[]) => { log.push(["window.open", ...args]); return null; }) as typeof window.open);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async (t: string) => { log.push(["clipboard.writeText", t]); }), readText: vi.fn(async () => "") },
  });
  class IO { constructor(_cb: unknown) {} observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
  vi.stubGlobal("IntersectionObserver", IO);
  Element.prototype.scrollIntoView = function scrollIntoView() {};
  // jsdom does not implement media playback; record play/pause and resolve like a browser would.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) { log.push(["media.play", this.tagName.toLowerCase()]); return Promise.resolve(); });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { log.push(["media.pause", this.tagName.toLowerCase()]); });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const realAdd = window.addEventListener.bind(window);
  const realRemove = window.removeEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation(((type: string, l: any, o?: any) => { listeners.set(type, (listeners.get(type) ?? 0) + 1); realAdd(type, l, o); }) as typeof window.addEventListener);
  vi.spyOn(window, "removeEventListener").mockImplementation(((type: string, l: any, o?: any) => { listeners.set(type, (listeners.get(type) ?? 0) - 1); realRemove(type, l, o); }) as typeof window.removeEventListener);
  return {
    log,
    listeners,
    restore: () => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); },
  };
}

const controlsOf = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [role=button], [role=tab]"))
    .filter((el) => !(el instanceof HTMLInputElement && el.type === "file"));

function describeControl(el: HTMLElement, idx: number) {
  const type = el instanceof HTMLInputElement ? `[${el.type}]` : "";
  return `${idx}:${el.tagName.toLowerCase()}${type}`;
}

function actOn(el: HTMLElement) {
  if (el instanceof HTMLSelectElement) {
    const next = Array.from(el.options).map((o) => o.value).find((v) => v !== el.value) ?? el.value;
    fireEvent.change(el, { target: { value: next } });
  } else if (el instanceof HTMLTextAreaElement) {
    fireEvent.change(el, { target: { value: "probe text" } });
  } else if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox" || el.type === "radio") fireEvent.click(el);
    else if (el.type === "number" || el.type === "range") fireEvent.change(el, { target: { value: "7" } });
    else if (el.type === "email") fireEvent.change(el, { target: { value: "probe@example.com" } });
    else fireEvent.change(el, { target: { value: "probe" } });
  } else {
    fireEvent.click(el);
  }
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) { await Promise.resolve(); vi.advanceTimersByTime(0); }
  });
}

function mount(Component: ComponentType<any>, props: Record<string, unknown>, callbacks: readonly string[], log: Entry[]) {
  const recorded = Object.fromEntries(callbacks.map((name) => [name, (...args: unknown[]) => { log.push([name, ...args.map(recordable)]); }]));
  return render(<Component {...props} {...recorded} />);
}

export async function probeRenderer(Component: ComponentType<any>, props: Record<string, unknown>, callbacks: readonly string[] = []): Promise<RendererProbe> {
  const env = installEnvironment();
  try {
    const first = mount(Component, props, callbacks, env.log);
    await settle();
    const markup = first.container.innerHTML;
    await act(async () => { vi.advanceTimersByTime(6000); await Promise.resolve(); });
    const tick = hash(first.container.innerHTML);
    const count = controlsOf(first.container).length;
    first.unmount();
    const pendingTimers = vi.getTimerCount();
    const leakedWindowListeners = [...env.listeners].filter(([, n]) => n > 0).map(([t, n]) => `${t}x${n}`).sort();
    cleanup();
    vi.clearAllTimers();

    const trace: Array<[string, Entry[], string]> = [];
    for (let i = 0; i < count; i++) {
      env.log.length = 0;
      const view = mount(Component, props, callbacks, env.log);
      await settle();
      env.log.length = 0;
      const control = controlsOf(view.container)[i];
      if (!control) { trace.push([`${i}:missing`, [], ""]); cleanup(); continue; }
      actOn(control);
      await settle();
      trace.push([describeControl(control, i), env.log.map((e) => [...e]), hash(view.container.innerHTML)]);
      cleanup();
      vi.clearAllTimers();
    }
    return { markup, tick, cleanup: { pendingTimers, leakedWindowListeners }, trace };
  } finally {
    cleanup();
    env.restore();
  }
}
