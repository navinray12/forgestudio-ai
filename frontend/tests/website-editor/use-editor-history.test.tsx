// @vitest-environment jsdom
/* global describe, it, expect, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Fast behavioural tests for core/useEditorHistory (moved verbatim from WebsiteEditor.tsx), driven
 * with renderHook and a real elements state, so the 50-entry limit is checked in milliseconds
 * instead of ~100 full-editor renders. The mounted-editor suites (editor-history, behaviour,
 * regression, workspace-reload) keep covering the component wiring.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { useState } from "react";
import { useEditorHistory } from "../../src/pages/editor/core/useEditorHistory";
import type { EditorElement } from "../../src/pages/editor/types";

afterEach(() => cleanup());

const el = (id: string) => ({ id, type: "heading", content: id, styles: {} }) as unknown as EditorElement;
const ids = (list: EditorElement[]) => list.map((e) => e.id);

function setup(initial: EditorElement[] = []) {
  return renderHook(() => {
    const [elements, setElements] = useState<EditorElement[]>(initial);
    return { elements, setElements, ...useEditorHistory(elements, setElements) };
  });
}

describe("useEditorHistory", () => {
  it("records the elements present on mount as a deep copy at index 0", () => {
    const initial = [el("a")];
    const { result } = setup(initial);
    expect(result.current.historyIndex).toBe(0);
    expect(result.current.history).toEqual([initial]);
    expect(result.current.history[0]).not.toBe(initial);
    expect(result.current.history[0][0]).not.toBe(initial[0]);
  });

  it("records each change; undo and redo restore equal deep copies without recording", () => {
    const { result } = setup([el("a")]);
    act(() => result.current.setElements([el("a"), el("b")]));
    act(() => result.current.setElements([el("b")]));
    expect([result.current.history.length, result.current.historyIndex]).toEqual([3, 2]);
    act(() => result.current.handleUndo());
    expect(ids(result.current.elements)).toEqual(["a", "b"]);
    expect(result.current.elements).not.toBe(result.current.history[1]);
    expect([result.current.history.length, result.current.historyIndex]).toEqual([3, 1]);
    act(() => result.current.handleRedo());
    expect(ids(result.current.elements)).toEqual(["b"]);
    expect([result.current.history.length, result.current.historyIndex]).toEqual([3, 2]);
  });

  it("a stored entry is unaffected by later mutation of the live elements", () => {
    const { result } = setup([el("a")]);
    (result.current.elements[0] as unknown as { content: string }).content = "mutated";
    expect((result.current.history[0][0] as unknown as { content: string }).content).toBe("a");
  });

  it("undo at the start and redo at the end are no-ops", () => {
    const { result } = setup([el("a")]);
    const before = result.current.elements;
    act(() => result.current.handleUndo());
    act(() => result.current.handleRedo());
    expect(result.current.elements).toBe(before);
    expect([result.current.history.length, result.current.historyIndex]).toEqual([1, 0]);
  });

  it("a new edit after undo discards the redo branch", () => {
    const { result } = setup([el("a")]);
    act(() => result.current.setElements([el("b")]));
    act(() => result.current.setElements([el("c")]));
    act(() => result.current.handleUndo()); // back to [b]
    act(() => result.current.setElements([el("d")]));
    expect(result.current.history.map(ids)).toEqual([["a"], ["b"], ["d"]]);
    act(() => result.current.handleRedo());
    expect(ids(result.current.elements)).toEqual(["d"]);
  });

  it("keeps at most 50 entries: after 52 edits exactly 49 undos are possible, ending at state 3", () => {
    const { result } = setup([el("s0")]);
    for (let i = 1; i <= 52; i++) act(() => result.current.setElements([el(`s${i}`)]));
    expect([result.current.history.length, result.current.historyIndex]).toEqual([50, 49]);
    expect(ids(result.current.history[0])).toEqual(["s3"]);
    let undos = 0;
    while (result.current.historyIndex > 0) { act(() => result.current.handleUndo()); undos++; }
    expect(undos).toBe(49);
    expect(ids(result.current.elements)).toEqual(["s3"]);
  });

  it("resetHistoryTo with the new elements (page / scope switch) leaves a duplicate entry: the first undo changes nothing", () => {
    const { result } = setup([el("a")]);
    act(() => result.current.setElements([el("edited")]));
    const target = [el("page2")];
    act(() => { result.current.resetHistoryTo(target); result.current.setElements(target); });
    expect(result.current.history.map(ids)).toEqual([["page2"], ["page2"]]);
    expect(result.current.historyIndex).toBe(1);
    act(() => result.current.handleUndo());
    expect(ids(result.current.elements)).toEqual(["page2"]);
    expect(result.current.historyIndex).toBe(0);
    act(() => result.current.handleUndo());
    expect(ids(result.current.elements)).toEqual(["page2"]); // nothing from before the switch
  });

  it("clearHistoryForLoad with the loaded elements makes them the only entry (load / workspace reload)", () => {
    const { result } = setup([]);
    act(() => result.current.setElements([el("stale")]));
    const loaded = [el("loaded")];
    act(() => { result.current.clearHistoryForLoad(); result.current.setElements(loaded); });
    expect(result.current.history.map(ids)).toEqual([["loaded"]]);
    expect(result.current.historyIndex).toBe(0);
    act(() => result.current.handleUndo());
    expect(ids(result.current.elements)).toEqual(["loaded"]);
  });

  it("the history limit still applies after a reset", () => {
    const { result } = setup([el("a")]);
    act(() => { result.current.resetHistoryTo([el("r")]); result.current.setElements([el("r")]); });
    for (let i = 1; i <= 60; i++) act(() => result.current.setElements([el(`t${i}`)]));
    expect([result.current.history.length, result.current.historyIndex]).toEqual([50, 49]);
  });
});
