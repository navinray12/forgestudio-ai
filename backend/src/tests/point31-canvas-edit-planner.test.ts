/**
 * Canvas edit planner (blueprint §31, WP-04/WP-18): the element edits derived from two renderings
 * of a page must, when applied through the AST mutation engine to a hand-edited copy of the page,
 * produce the new element tree and leave the hand-written code alone.
 */
import { describe, it, expect } from "vitest";
import { diffElementTrees } from "../services/compiler/canvasEditPlanner.js";
import { parseJsxSource, type JsxNode } from "../services/compiler/pageSourceSync.js";
import { applyJsxMutation } from "../services/compiler/jsxAstMutation.js";

const page = (body: string) => `export default function Page() {
  return (
    <div className="min-h-screen" data-forge-id="page_root">
${body}
    </div>
  );
}
`;

const BEFORE = page(`      <section className="hero dark" style={{ paddingTop: "48px", color: "#111111" }} data-forge-id="hero">
        <h1 className="title" data-forge-id="title">Build faster</h1>
        <p data-forge-id="copy">Old copy</p>
        <a href="/start" data-forge-id="cta">Start</a>
        <img src="https://cdn.example.test/a.png" alt="A" data-forge-id="art" />
      </section>
      <ul data-forge-id="list">
        <li data-forge-id="one">One</li>
        <li data-forge-id="two">Two</li>
        <li data-forge-id="three">Three</li>
      </ul>`);

const AFTER = page(`      <section className="hero light wide" style={{ paddingTop: "64px", gap: "8px" }} data-forge-id="hero">
        <img src="https://cdn.example.test/b.png" data-forge-id="art" />
        <h1 className="title" data-forge-id="title">Ship faster</h1>
        <a href="/pricing" data-forge-id="cta">Start</a>
        <div className="note" data-forge-id="note">
          <span data-forge-id="note_text">New note</span>
        </div>
      </section>
      <ul data-forge-id="list">
        <li data-forge-id="three">Three</li>
        <li data-forge-id="one">One</li>
        <li data-forge-id="copy_item">Moved in</li>
      </ul>`);

function root(source: string): JsxNode {
  const parsed = parseJsxSource(source, "src/pages/Page.tsx");
  expect(parsed.valid).toBe(true);
  return parsed.root!;
}

/** What the visual model sees of a tree: everything except source positions. */
function shape(node: JsxNode): unknown {
  return { tag: node.rawTag, id: node.forgeId, classes: [...node.classes].sort(), style: node.style, attrs: node.attrs, text: node.children.length ? "" : node.text, children: node.children.map(shape) };
}

function applyAll(source: string, edits: ReturnType<typeof diffElementTrees>["edits"]) {
  return edits.reduce((current, edit) => {
    const result = applyJsxMutation(current, edit.elementId, edit.mutation, "src/pages/Page.tsx");
    expect(result.code === undefined || result.code === "NO_CHANGE", `${edit.elementId} ${edit.mutation.type}: ${result.diagnostic}`).toBe(true);
    return result.content;
  }, source);
}

describe("canvas edit planner", () => {
  it("plans nothing for identical trees", () => {
    expect(diffElementTrees(root(BEFORE), root(BEFORE), "react")).toEqual({ edits: [], unsupported: [] });
  });

  it("expresses text, class, style, attribute, insert, remove, reorder and move changes as mutations", () => {
    const { edits, unsupported } = diffElementTrees(root(BEFORE), root(AFTER), "react");
    expect(unsupported).toEqual([]);
    const of = (id: string) => edits.filter((e) => e.elementId === id).map((e) => e.mutation);
    expect(of("title")).toEqual([{ type: "SET_TEXT", text: "Ship faster" }]);
    expect(of("hero")).toEqual([
      { type: "SET_CLASSES", add: ["light", "wide"], remove: ["dark"] },
      { type: "SET_STYLE", style: { paddingTop: "64px", gap: "8px", color: null } },
    ]);
    expect(of("cta")).toContainEqual({ type: "SET_PROP", name: "href", value: "/pricing" });
    expect(of("art")).toContainEqual({ type: "SET_PROP", name: "src", value: "https://cdn.example.test/b.png" });
    expect(of("art")).toContainEqual({ type: "SET_PROP", name: "alt", value: null });
    expect(of("copy")).toEqual([{ type: "REMOVE" }]);
    expect(of("two")).toEqual([{ type: "REMOVE" }]);
    expect(of("note")).toEqual([{ type: "INSERT", parentId: "hero", index: 3, element: { tag: "div", classes: ["note"] } }]);
    expect(of("note_text")).toEqual([{ type: "INSERT", parentId: "note", index: 0, element: { tag: "span", text: "New note" } }]);
    expect(of("three")).toEqual([{ type: "REORDER", index: 0 }]);
    expect(edits.map((e) => e.mutation.type)).toContain("REORDER");
  });

  it("produces the new element tree when the plan is applied to the source", () => {
    const { edits } = diffElementTrees(root(BEFORE), root(AFTER), "react");
    expect(shape(root(applyAll(BEFORE, edits)))).toEqual(shape(root(AFTER)));
  });

  it("applies to a hand-edited page without touching the hand-written code", () => {
    const handEdited = BEFORE
      .replace("export default function Page() {", 'import { track } from "../lib/analytics";\n\nexport default function Page() {\n  const clicked = () => track("cta"); // hand-written')
      .replace('<a href="/start" data-forge-id="cta">', '<a href="/start" onClick={clicked} data-forge-id="cta">')
      .replace('className="title"', 'className="title custom-kerning"');
    const { edits } = diffElementTrees(root(BEFORE), root(AFTER), "react");
    const result = applyAll(handEdited, edits);

    expect(result).toContain('import { track } from "../lib/analytics";');
    expect(result).toContain('  const clicked = () => track("cta"); // hand-written');
    expect(result).toContain('<a href="/pricing" onClick={clicked} data-forge-id="cta">Start</a>');
    // A class the developer added in code survives, because classes are adjusted, not replaced.
    expect(result).toContain('<h1 className="title custom-kerning" data-forge-id="title">Ship faster</h1>');
    expect(result.slice(0, result.indexOf("return ("))).toBe(handEdited.slice(0, handEdited.indexOf("return (")));
  });

  it("moves an element between parents", () => {
    const moved = BEFORE.replace('        <a href="/start" data-forge-id="cta">Start</a>\n', "").replace(
      '        <li data-forge-id="one">One</li>',
      '        <a href="/start" data-forge-id="cta">Start</a>\n        <li data-forge-id="one">One</li>'
    );
    const { edits, unsupported } = diffElementTrees(root(BEFORE), root(moved), "react");
    expect(unsupported).toEqual([]);
    expect(edits).toEqual([{ elementId: "cta", mutation: { type: "MOVE", parentId: "list", index: 0 } }]);
    expect(shape(root(applyAll(BEFORE, edits)))).toEqual(shape(root(moved)));
  });

  it("reports changes it cannot express instead of planning a wrong edit", () => {
    const retagged = BEFORE.replace('<h1 className="title" data-forge-id="title">Build faster</h1>', '<h2 className="title" data-forge-id="title">Build faster</h2>');
    expect(diffElementTrees(root(BEFORE), root(retagged), "react")).toMatchObject({ edits: [], unsupported: [{ elementId: "title" }] });

    const component = BEFORE.replace('<li data-forge-id="three">Three</li>', '<li data-forge-id="three">Three</li>\n        <Link to="/x" data-forge-id="link">Go</Link>');
    const planned = diffElementTrees(root(BEFORE), root(component), "react");
    expect(planned.edits).toEqual([]);
    expect(planned.unsupported).toEqual([expect.objectContaining({ elementId: "link" })]);

    const anonymous = BEFORE.replace('<li data-forge-id="one">One</li>', '<li data-forge-id="one">One</li>\n        <li>No id</li>');
    expect(diffElementTrees(root(BEFORE), root(anonymous), "react").unsupported).toEqual([expect.objectContaining({ elementId: "list" })]);
  });
});
