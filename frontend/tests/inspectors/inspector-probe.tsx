/* global vi -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Deterministic behaviour probe for controlled inspector components.
 *
 * probeInspector(Component, props) returns:
 *  - markup: the initial render's HTML (structure, classes, attributes, default values);
 *  - trace:  for every interactive control (input, select, textarea, button), in document order, the
 *            exact callback calls ([callback, key, value]) produced by one deterministic event on that
 *            control, each in a fresh render so controls are probed independently.
 *
 * The clock and Math.random are pinned for the duration of each render.
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ComponentType } from "react";

export const PROBE_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
export const PROBE_RANDOM = 0.123456789;

type Call = [string, ...unknown[]];
export interface ProbeResult {
  markup: string;
  trace: Array<[string, Call[]]>;
}

const CALLBACKS = ["updateProp", "updateStyle", "updateLayout"] as const;

/**
 * Events and DOM nodes passed to callbacks are recorded as stable markers; plain values are kept as-is.
 * The markers use parentheses, not square-bracketed colon pairs: Tailwind scans the golden files and
 * would turn a bracketed colon pair into an arbitrary-property CSS rule in the production stylesheet.
 */
function recordable(value: unknown): unknown {
  if (value instanceof Event) return `(event ${value.type})`;
  if (value && typeof value === "object" && "nativeEvent" in value && "type" in value) return `(event ${String((value as { type: unknown }).type)})`;
  if (typeof Node !== "undefined" && value instanceof Node) return `(node ${value.nodeName.toLowerCase()})`;
  return value;
}

function withPinnedEnvironment<T>(fn: () => T): T {
  vi.useFakeTimers({ now: PROBE_NOW, toFake: ["Date"] });
  const random = vi.spyOn(Math, "random").mockReturnValue(PROBE_RANDOM);
  try {
    return fn();
  } finally {
    random.mockRestore();
    vi.useRealTimers();
  }
}

function renderRecorded(Component: ComponentType<any>, props: Record<string, unknown>, extraCallbacks: readonly string[] = []) {
  const calls: Call[] = [];
  const callbacks = Object.fromEntries([...CALLBACKS, ...extraCallbacks].map((name) => [name, (...args: unknown[]) => { calls.push([name, ...args.map(recordable)]); }]));
  const view = render(<Component {...structuredClone(props)} {...callbacks} />);
  return { view, calls };
}

const controlsOf = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>("input, select, textarea, button"))
    .filter((el) => !(el instanceof HTMLInputElement && el.type === "file"));

function describeControl(el: HTMLElement, idx: number): string {
  const type = el instanceof HTMLInputElement ? `[${el.type}]` : "";
  return `${idx}:${el.tagName.toLowerCase()}${type}`;
}

/** One deterministic event per control kind. */
function actOn(el: HTMLElement) {
  if (el instanceof HTMLSelectElement) {
    const options = Array.from(el.options).map((o) => o.value);
    const next = options.find((v) => v !== el.value) ?? options[0] ?? "";
    fireEvent.change(el, { target: { value: next } });
  } else if (el instanceof HTMLTextAreaElement) {
    fireEvent.change(el, { target: { value: "probe text" } });
  } else if (el instanceof HTMLInputElement) {
    switch (el.type) {
      case "checkbox":
      case "radio":
        fireEvent.click(el);
        break;
      case "number":
      case "range":
        fireEvent.change(el, { target: { value: "7" } });
        break;
      case "color":
        fireEvent.change(el, { target: { value: "#123456" } });
        break;
      case "datetime-local":
        fireEvent.change(el, { target: { value: "2027-01-01T00:00" } });
        break;
      case "date":
        fireEvent.change(el, { target: { value: "2027-01-01" } });
        break;
      default:
        fireEvent.change(el, { target: { value: "probe" } });
    }
  } else {
    fireEvent.click(el);
  }
}

/**
 * extraCallbacks: additional callback props (e.g. onOpenIconPicker) to record alongside updateProp /
 * updateStyle / updateLayout. Defaults to none, so existing goldens are unaffected.
 */
export function probeInspector(Component: ComponentType<any>, props: Record<string, unknown>, extraCallbacks: readonly string[] = []): ProbeResult {
  return withPinnedEnvironment(() => {
    const first = renderRecorded(Component, props, extraCallbacks);
    const markup = first.view.container.innerHTML;
    const count = controlsOf(first.view.container).length;
    cleanup();

    const trace: Array<[string, Call[]]> = [];
    for (let i = 0; i < count; i++) {
      const { view, calls } = renderRecorded(Component, props, extraCallbacks);
      const control = controlsOf(view.container)[i];
      actOn(control);
      trace.push([describeControl(control, i), calls]);
      cleanup();
    }
    return { markup, trace };
  });
}
