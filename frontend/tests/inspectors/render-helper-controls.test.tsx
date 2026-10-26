// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * The inspector render helpers moved out of WebsiteEditor (buildTypographySection,
 * buildPositioningControls, buildBackgroundAndBorderControls), rendered directly: in the current editor
 * UI their call sites are unreachable (an inspector branch that never renders, and a no-selection branch
 * where the helper returns null), so this is where their behaviour is pinned. The harness keeps the
 * element's styles in React state and calls the builder during its own render, as the editor does, so
 * re-renders keep the same DOM nodes (input focus survives).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { buildTypographySection } from "../../src/pages/editor/inspector/typographySection";
import { buildPositioningControls } from "../../src/pages/editor/inspector/positioningControls";
import { buildBackgroundAndBorderControls } from "../../src/pages/editor/inspector/backgroundBorderControls";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

type Calls = Array<[string, string, unknown?]>;
function Harness({ build, initial, calls, extra = {} }: { build: (deps: any) => React.ReactNode; initial: any; calls: Calls; extra?: Record<string, unknown> }) {
  const [el, setEl] = useState(initial);
  const [linked, setLinked] = useState(true);
  const deps = {
    activeDevice: "desktop",
    activeElementState: "normal",
    selectedElement: el,
    selectedElementAny: el,
    updateSelectedStyle: (key: string, value: unknown) => { calls.push(["update", key, value]); setEl((p: any) => ({ ...p, styles: { ...p.styles, [key]: value } })); },
    resetSelectedStyle: (key: string) => { calls.push(["reset", key]); setEl((p: any) => { const styles = { ...p.styles }; delete styles[key]; return { ...p, styles }; }); },
    handleOpenFontPicker: () => calls.push(["fontPicker", ""]),
    bgFileInputRef: { current: null },
    handleBgImageFileSelect: async () => { calls.push(["bgFile", ""]); },
    handleSampleColor: async () => { calls.push(["sample", ""]); },
    isBorderRadiusLinked: linked,
    setIsBorderRadiusLinked: (v: boolean) => { calls.push(["linked", String(v)]); setLinked(v); },
    isUploading: false,
    ...extra,
  };
  return <div data-testid="host">{build(deps)}</div>;
}
const heading = (styles: Record<string, unknown> = {}) => ({ id: "h1", type: "heading", content: "Hi", styles });
const host = () => screen.getByTestId("host");

describe("buildPositioningControls / buildBackgroundAndBorderControls with no selection", () => {
  it("render nothing", () => {
    const calls: Calls = [];
    render(<Harness build={buildPositioningControls} initial={null} calls={calls} />);
    expect(host().innerHTML).toBe("");
    cleanup();
    render(<Harness build={buildBackgroundAndBorderControls} initial={null} calls={calls} />);
    expect(host().innerHTML).toBe("");
  });
});

describe("buildTypographySection", () => {
  it("font size and line height inputs write their style keys and keep focus; resets clear them", () => {
    const calls: Calls = [];
    render(<Harness build={buildTypographySection} initial={heading({ fontSize: "20px" })} calls={calls} />);
    const size = screen.getByPlaceholderText("e.g. 16px") as HTMLInputElement;
    expect(size.value).toBe("20px");
    size.focus();
    fireEvent.change(size, { target: { value: "22px" } });
    expect(calls.at(-1)).toEqual(["update", "fontSize", "22px"]);
    expect(document.activeElement).toBe(size);
    expect((screen.getByPlaceholderText("e.g. 16px") as HTMLInputElement).value).toBe("22px");
    fireEvent.change(screen.getByPlaceholderText("e.g. 1.5 or 24px"), { target: { value: "1.6" } });
    expect(calls.at(-1)).toEqual(["update", "lineHeight", "1.6"]);
    fireEvent.click(screen.getByTitle("Reset font size"));
    expect(calls.at(-1)).toEqual(["reset", "fontSize"]);
    fireEvent.click(screen.getByTitle("Reset line height"));
    expect(calls.at(-1)).toEqual(["reset", "lineHeight"]);
  });

  it("reset all typography resets every typography key", () => {
    const calls: Calls = [];
    render(<Harness build={buildTypographySection} initial={heading({ fontSize: "20px", fontWeight: "700", textAlign: "center" })} calls={calls} />);
    fireEvent.click(screen.getByTitle("Reset typography to defaults"));
    const resets = calls.filter((c) => c[0] === "reset").map((c) => c[1]);
    expect(resets).toEqual(expect.arrayContaining(["fontFamily", "fontSize", "fontWeight", "lineHeight", "textAlign"]));
  });
});

describe("buildPositioningControls", () => {
  it("position select and offset inputs write their keys; the resets clear them", () => {
    const calls: Calls = [];
    render(<Harness build={buildPositioningControls} initial={heading({ position: "relative" })} calls={calls} />);
    const positionSelect = [...host().querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "absolute")) as HTMLSelectElement;
    fireEvent.change(positionSelect, { target: { value: "absolute" } });
    expect(calls.at(-1)).toEqual(["update", "position", "absolute"]);
    const offsets = screen.getAllByPlaceholderText("auto") as HTMLInputElement[];
    expect(offsets).toHaveLength(4);
    const before = calls.length;
    fireEvent.change(offsets[0], { target: { value: "10" } });
    expect(calls.slice(before).some((c) => c[0] === "update" && c[1] === "top")).toBe(true);
    fireEvent.click(screen.getByTitle("Reset Offsets to Default"));
    expect(calls.filter((c) => c[0] === "reset").map((c) => c[1])).toEqual(expect.arrayContaining(["top", "right", "bottom", "left"]));
    fireEvent.click(screen.getByTitle("Reset Position Type to Default"));
    expect(calls.at(-1)).toEqual(["reset", "position"]);
  });

  it("the z-index reset appears only while a z-index is set", () => {
    const calls: Calls = [];
    render(<Harness build={buildPositioningControls} initial={heading({ position: "relative" })} calls={calls} />);
    expect(screen.queryByTitle("Reset Z-Index to Default")).toBeNull();
    cleanup();
    render(<Harness build={buildPositioningControls} initial={heading({ position: "relative", zIndex: 5 })} calls={calls} />);
    fireEvent.click(screen.getByTitle("Reset Z-Index to Default"));
    expect(calls.at(-1)).toEqual(["reset", "zIndex"]);
    expect(screen.queryByTitle("Reset Z-Index to Default")).toBeNull();
  });
});

describe("buildBackgroundAndBorderControls", () => {
  it("background colour and image URL write their keys and keep focus; sample and reset work", () => {
    const calls: Calls = [];
    render(<Harness build={buildBackgroundAndBorderControls} initial={heading()} calls={calls} />);
    const color = screen.getByPlaceholderText("transparent / #ffffff / rgba(...)") as HTMLInputElement;
    color.focus();
    fireEvent.change(color, { target: { value: "#123456" } });
    expect(calls.at(-1)).toEqual(["update", "backgroundColor", "#123456"]);
    expect(document.activeElement).toBe(color);
    fireEvent.change(screen.getByPlaceholderText("Or enter Image URL"), { target: { value: "https://img.example.test/bg.png" } });
    expect(calls.at(-1)).toEqual(["update", "backgroundImage", "https://img.example.test/bg.png"]);
    fireEvent.click(screen.getAllByTitle("Sample Color from Screen / Image")[0]);
    expect(calls.at(-1)).toEqual(["sample", ""]);
    fireEvent.click(screen.getByTitle("Reset Background Color to Default"));
    expect(calls.at(-1)).toEqual(["reset", "backgroundColor"]);
  });

  it("linked corners set all four radii and borderRadius; unlinked sets one", () => {
    const calls: Calls = [];
    render(<Harness build={buildBackgroundAndBorderControls} initial={heading()} calls={calls} />);
    expect(screen.getByTitle("Unlink Corners")).toBeTruthy();
    const corners = () => screen.getAllByPlaceholderText("0") as HTMLInputElement[];
    expect(corners()).toHaveLength(4);
    let before = calls.length;
    fireEvent.change(corners()[0], { target: { value: "8" } });
    expect(calls.slice(before).filter((c) => c[0] === "update").map((c) => c[1])).toEqual(["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius", "borderRadius"]);
    fireEvent.click(screen.getByTitle("Unlink Corners"));
    expect(calls.at(-1)).toEqual(["linked", "false"]);
    expect(screen.getByTitle("Link Corners")).toBeTruthy();
    before = calls.length;
    fireEvent.change(corners()[1], { target: { value: "3" } });
    expect(calls.slice(before).filter((c) => c[0] === "update").map((c) => c[1])).toEqual(["borderTopRightRadius"]);
  });

  it("border style select and the border reset", () => {
    const calls: Calls = [];
    render(<Harness build={buildBackgroundAndBorderControls} initial={heading({ borderStyle: "solid", borderWidth: "1px", borderColor: "#000" })} calls={calls} />);
    const styleSelect = [...host().querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "dashed")) as HTMLSelectElement;
    fireEvent.change(styleSelect, { target: { value: "dashed" } });
    expect(calls.at(-1)).toEqual(["update", "borderStyle", "dashed"]);
    fireEvent.click(screen.getByTitle("Reset Border to Default"));
    expect(calls.filter((c) => c[0] === "reset").map((c) => c[1])).toEqual(expect.arrayContaining(["borderStyle", "borderWidth", "borderColor"]));
  });
});
