/**
 * AST visual-to-code mutations (blueprint §31, WP-04/WP-18): every supported mutation, no-op
 * edits, malformed source, ambiguous targets, source-owned code and preservation of everything the
 * edit does not address.
 */
import { describe, it, expect } from "vitest";
import { updateJsxElementViaAst, validateSourceSyntax, parseSourceCodeToElements } from "../services/compiler/visualCodeSync.service.js";
import { applyJsxMutation, type JsxMutation } from "../services/compiler/jsxAstMutation.js";
import { RealtimeSyncService, type VisualOperationPayload } from "../services/compiler/realtimeSync.service.js";
import { WorkspaceCoordinatorService } from "../services/workspace/workspaceCoordinator.service.js";

const SOURCE = `import { useState } from "react";
import { css } from "../forge/css";
import { track } from "../lib/analytics"; // user import

// A user-owned helper the editor must never touch.
function formatPrice(value: number): string {
  return \`$\${value.toFixed(2)}\`;
}

export default function PricingPage({ plans }: { plans: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false);

  return (
    <main className="page" data-forge-id="root">
      <section className="hero dark" style={css({ paddingTop: 48, color: "#111111" })} data-forge-id="hero">
        <h1 className="title" data-forge-id="title">Simple pricing</h1>
        <p data-forge-id="lead">
          Pay for what you use.
        </p>
        <a href="/signup" className="btn" data-forge-id="cta">Start now</a>
        <img src="https://cdn.example.test/hero.png" alt="Hero" data-forge-id="art" />
      </section>
      <section data-forge-id="plans">
        <h2 data-forge-id="plans_title">{plans.length} plans</h2>
        {plans.map((plan) => (
          <article key={plan.id} data-forge-id="plan_card">{plan.name}</article>
        ))}
      </section>
      <footer className={open ? "footer open" : "footer"} style={{ ...base, margin: 0 }} data-forge-id="footer">
        <button onClick={() => { setOpen(!open); track("toggle"); }} data-forge-id="toggle">Toggle</button>
        <span title={formatPrice(9)} data-forge-id="price">From $9</span>
      </footer>
      <ul data-forge-id="list">
        <li data-forge-id="li_a">Alpha</li>
        <li data-forge-id="li_b">Beta</li>
        <li data-forge-id="li_c">Gamma</li>
      </ul>
      <div data-forge-id="empty"></div>
    </main>
  );
}
`;

const mutate = (id: string, mutation: JsxMutation, source = SOURCE) => applyJsxMutation(source, id, mutation, "src/pages/PricingPage.tsx");

/** The lines that differ between two sources, as [before, after] pairs of removed and added lines. */
function lineDiff(before: string, after: string) {
  const a = before.split("\n");
  const b = after.split("\n");
  return { removed: a.filter((line) => !b.includes(line)), added: b.filter((line) => !a.includes(line)) };
}

function expectApplied(result: ReturnType<typeof mutate>) {
  expect(result.diagnostic).toBeUndefined();
  expect(result.updated).toBe(true);
  expect(result.content).not.toBe(SOURCE);
  expect(validateSourceSyntax(result.content, "x.tsx").isValid).toBe(true);
  return result.content;
}

function expectRejected(result: ReturnType<typeof mutate>, code: string, source = SOURCE) {
  expect(result.updated).toBe(false);
  expect(result.code).toBe(code);
  expect(result.diagnostic).toBeTruthy();
  expect(result.content).toBe(source);
}

describe("AST visual-to-code mutations", () => {
  describe("text", () => {
    it("replaces static text and changes only that line", () => {
      const content = expectApplied(mutate("title", { type: "SET_TEXT", text: "Fair pricing" }));
      expect(lineDiff(SOURCE, content)).toEqual({
        removed: ['        <h1 className="title" data-forge-id="title">Simple pricing</h1>'],
        added: ['        <h1 className="title" data-forge-id="title">Fair pricing</h1>'],
      });
    });

    it("keeps the layout of multi-line text and escapes JSX syntax", () => {
      const content = expectApplied(mutate("lead", { type: "SET_TEXT", text: "1 < 2 & {braces}" }));
      expect(content).toContain('<p data-forge-id="lead">\n          1 &lt; 2 &amp; &#123;braces&#125;\n        </p>');
    });

    it("fills an empty element and clears text", () => {
      expect(expectApplied(mutate("empty", { type: "SET_TEXT", text: "Now filled" }))).toContain('<div data-forge-id="empty">Now filled</div>');
      expect(expectApplied(mutate("title", { type: "SET_TEXT", text: "" }))).toContain('<h1 className="title" data-forge-id="title"></h1>');
    });

    it("refuses source-owned expressions, elements with children and self-closing elements", () => {
      expectRejected(mutate("plans_title", { type: "SET_TEXT", text: "x" }), "SOURCE_OWNED");
      expect(mutate("plans_title", { type: "SET_TEXT", text: "x" }).diagnostic).toContain("source-owned dynamic expressions");
      expectRejected(mutate("hero", { type: "SET_TEXT", text: "x" }), "UNSUPPORTED");
      expectRejected(mutate("art", { type: "SET_TEXT", text: "x" }), "UNSUPPORTED");
    });
  });

  describe("props", () => {
    it("changes, adds and removes a literal attribute", () => {
      expect(expectApplied(mutate("cta", { type: "SET_PROP", name: "href", value: "/pricing#plans" }))).toContain('<a href="/pricing#plans" className="btn" data-forge-id="cta">Start now</a>');
      expect(expectApplied(mutate("cta", { type: "SET_PROP", name: "aria-label", value: 'Say "hi"' }))).toContain('data-forge-id="cta" aria-label="Say &quot;hi&quot;">Start now</a>');
      expect(expectApplied(mutate("art", { type: "SET_PROP", name: "width", value: 640 }))).toContain('data-forge-id="art" width={640} />');
      expect(expectApplied(mutate("art", { type: "SET_PROP", name: "hidden", value: true }))).toContain('data-forge-id="art" hidden />');
      expect(expectApplied(mutate("art", { type: "SET_PROP", name: "alt", value: null }))).toContain('<img src="https://cdn.example.test/hero.png" data-forge-id="art" />');
    });

    it("refuses identity, handlers, computed values and unsafe URLs", () => {
      expectRejected(mutate("cta", { type: "SET_PROP", name: "data-forge-id", value: "other" }), "UNSUPPORTED");
      expectRejected(mutate("cta", { type: "SET_PROP", name: "className", value: "x" }), "UNSUPPORTED");
      expectRejected(mutate("toggle", { type: "SET_PROP", name: "onClick", value: "alert(1)" }), "SOURCE_OWNED");
      expectRejected(mutate("price", { type: "SET_PROP", name: "title", value: "Static" }), "SOURCE_OWNED");
      expectRejected(mutate("cta", { type: "SET_PROP", name: "href", value: "javascript:alert(1)" }), "INVALID_MUTATION");
      expectRejected(mutate("cta", { type: "SET_PROP", name: 'x" onMouseOver="y', value: "z" }), "INVALID_MUTATION");
    });
  });

  describe("classes", () => {
    it("replaces, adds and removes classes", () => {
      expect(expectApplied(mutate("hero", { type: "SET_CLASSES", classes: ["hero", "light", "md:py-8"] }))).toContain('<section className="hero light md:py-8" style=');
      expect(expectApplied(mutate("hero", { type: "SET_CLASSES", add: ["wide"], remove: ["dark"] }))).toContain('<section className="hero wide" style=');
      expect(expectApplied(mutate("lead", { type: "SET_CLASSES", add: ["muted"] }))).toContain('<p className="muted" data-forge-id="lead">');
      expect(expectApplied(mutate("title", { type: "SET_CLASSES", classes: [] }))).toContain('<h1 data-forge-id="title">Simple pricing</h1>');
    });

    it("refuses a computed className and invalid class names", () => {
      expectRejected(mutate("footer", { type: "SET_CLASSES", add: ["x"] }), "SOURCE_OWNED");
      expectRejected(mutate("hero", { type: "SET_CLASSES", add: ['a" onClick="b'] }), "INVALID_MUTATION");
      expectRejected(mutate("hero", { type: "SET_CLASSES" }), "INVALID_MUTATION");
    });
  });

  describe("style", () => {
    it("changes one value in place and leaves the other properties alone", () => {
      const content = expectApplied(mutate("hero", { type: "SET_STYLE", style: { paddingTop: 64 } }));
      expect(content).toContain('style={css({ paddingTop: 64, color: "#111111" })}');
    });

    it("adds and removes properties, and drops an emptied style attribute", () => {
      expect(expectApplied(mutate("hero", { type: "SET_STYLE", style: { color: null, gap: "1rem" } }))).toContain('style={css({ paddingTop: 48, gap: "1rem" })}');
      expect(expectApplied(mutate("hero", { type: "SET_STYLE", style: { paddingTop: null, color: null } }))).toContain('<section className="hero dark" data-forge-id="hero">');
      expect(expectApplied(mutate("title", { type: "SET_STYLE", style: { fontSize: "2rem", opacity: 0.9 } }))).toContain('data-forge-id="title" style={{ fontSize: "2rem", opacity: 0.9 }}>');
    });

    it("keeps the layout of a multi-line style object", () => {
      const source = `export default function A() {\n  return (\n    <div\n      style={{\n        color: "red",\n        margin: 0,\n      }}\n      data-forge-id="box"\n    />\n  );\n}\n`;
      const result = mutate("box", { type: "SET_STYLE", style: { margin: null, padding: 8 } }, source);
      expect(result.updated).toBe(true);
      expect(result.content).toContain('      style={{\n        color: "red",\n        padding: 8,\n      }}\n');
    });

    it("refuses computed styles and invalid properties", () => {
      expectRejected(mutate("footer", { type: "SET_STYLE", style: { margin: 4 } }), "SOURCE_OWNED");
      expectRejected(mutate("hero", { type: "SET_STYLE", style: { "padding-top": 4 } }), "INVALID_MUTATION");
      expectRejected(mutate("hero", { type: "SET_STYLE", style: { color: "red\n}}) || evil(" } }), "INVALID_MUTATION");
      expectRejected(mutate("hero", { type: "SET_STYLE", style: {} }), "INVALID_MUTATION");
    });
  });

  describe("insertion", () => {
    it("inserts a new element at an index, at the end and into an empty parent", () => {
      const first = expectApplied(mutate("li_new", { type: "INSERT", parentId: "list", index: 1, element: { tag: "li", text: "Inserted" } }));
      expect(first).toContain('        <li data-forge-id="li_a">Alpha</li>\n        <li data-forge-id="li_new">Inserted</li>\n        <li data-forge-id="li_b">Beta</li>');

      const last = expectApplied(mutate("li_new", { type: "INSERT", parentId: "list", element: { tag: "li", text: "Last", classes: ["x"], props: { title: "T" }, style: { color: "red" } } }));
      expect(last).toContain('        <li data-forge-id="li_c">Gamma</li>\n        <li className="x" style={{ color: "red" }} data-forge-id="li_new" title="T">Last</li>\n      </ul>');

      const nested = expectApplied(mutate("pic", { type: "INSERT", parentId: "empty", element: { tag: "img", props: { src: "https://cdn.example.test/a.png", alt: "" } } }));
      expect(nested).toContain('      <div data-forge-id="empty">\n        <img data-forge-id="pic" src="https://cdn.example.test/a.png" alt="" />\n      </div>');
    });

    it("refuses duplicate identities, unsafe tags and parents whose children are decided in code", () => {
      expectRejected(mutate("li_a", { type: "INSERT", parentId: "list", element: { tag: "li" } }), "INVALID_MUTATION");
      expectRejected(mutate("x1", { type: "INSERT", parentId: "list", element: { tag: "script", text: "alert(1)" } }), "INVALID_MUTATION");
      expectRejected(mutate("x1", { type: "INSERT", parentId: "list", element: { tag: "Widget" } }), "INVALID_MUTATION");
      expectRejected(mutate("x1", { type: "INSERT", parentId: "plans", element: { tag: "div" } }), "SOURCE_OWNED");
      expectRejected(mutate("x1", { type: "INSERT", parentId: "title", element: { tag: "span" } }), "UNSUPPORTED");
      expectRejected(mutate("x1", { type: "INSERT", parentId: "art", element: { tag: "span" } }), "UNSUPPORTED");
      expectRejected(mutate("x1", { type: "INSERT", parentId: "missing", element: { tag: "span" } }), "TARGET_NOT_FOUND");
      expectRejected(mutate("x1", { type: "INSERT", parentId: "list", index: 9, element: { tag: "li" } }), "INVALID_MUTATION");
    });
  });

  describe("removal", () => {
    it("removes an element with its line and nothing else", () => {
      const content = expectApplied(mutate("li_b", { type: "REMOVE" }));
      expect(lineDiff(SOURCE, content)).toEqual({ removed: ['        <li data-forge-id="li_b">Beta</li>'], added: [] });
      expect(content.split("\n").length).toBe(SOURCE.split("\n").length - 1);
    });

    it("removes a static subtree", () => {
      const content = expectApplied(mutate("list", { type: "REMOVE" }));
      expect(content).not.toContain("li_a");
      expect(content).toContain('      </footer>\n      <div data-forge-id="empty"></div>');
    });

    it("refuses the component root and elements that carry user code", () => {
      expectRejected(mutate("root", { type: "REMOVE" }), "UNSUPPORTED");
      expectRejected(mutate("plans", { type: "REMOVE" }), "SOURCE_OWNED");
      expectRejected(mutate("toggle", { type: "REMOVE" }), "SOURCE_OWNED");
      expectRejected(mutate("plan_card", { type: "REMOVE" }), "SOURCE_OWNED");
    });
  });

  describe("reordering and hierarchy", () => {
    it("reorders siblings without touching their text", () => {
      const content = expectApplied(mutate("li_c", { type: "REORDER", index: 0 }));
      expect(content).toContain('      <ul data-forge-id="list">\n        <li data-forge-id="li_c">Gamma</li>\n        <li data-forge-id="li_a">Alpha</li>\n        <li data-forge-id="li_b">Beta</li>\n      </ul>');
      const down = expectApplied(mutate("li_a", { type: "REORDER", index: 2 }));
      expect(down).toContain('        <li data-forge-id="li_b">Beta</li>\n        <li data-forge-id="li_c">Gamma</li>\n        <li data-forge-id="li_a">Alpha</li>\n      </ul>');
      expect([...content].sort().join("")).toBe([...SOURCE].sort().join(""));
    });

    it("moves an element under another parent and re-indents it", () => {
      const content = expectApplied(mutate("list", { type: "MOVE", parentId: "hero", index: 0 }));
      expect(content).toContain('data-forge-id="hero">\n        <ul data-forge-id="list">\n          <li data-forge-id="li_a">Alpha</li>');
      expect(content).toContain('          <li data-forge-id="li_c">Gamma</li>\n        </ul>\n        <h1 className="title" data-forge-id="title">');
      expect(content).toContain('      </footer>\n      <div data-forge-id="empty"></div>');
      const intoEmpty = expectApplied(mutate("cta", { type: "MOVE", parentId: "empty" }));
      expect(intoEmpty).toContain('      <div data-forge-id="empty">\n        <a href="/signup" className="btn" data-forge-id="cta">Start now</a>\n      </div>');
    });

    it("refuses cycles, the root, code-driven parents and out-of-range positions", () => {
      expectRejected(mutate("hero", { type: "MOVE", parentId: "title" }), "UNSUPPORTED");
      expectRejected(mutate("list", { type: "MOVE", parentId: "li_a" }), "UNSUPPORTED");
      expectRejected(mutate("list", { type: "MOVE", parentId: "list" }), "INVALID_MUTATION");
      expectRejected(mutate("root", { type: "REORDER", index: 0 }), "UNSUPPORTED");
      expectRejected(mutate("plans_title", { type: "REORDER", index: 0 }), "SOURCE_OWNED");
      expectRejected(mutate("plan_card", { type: "REORDER", index: 0 }), "SOURCE_OWNED");
      expectRejected(mutate("list", { type: "MOVE", parentId: "plans" }), "SOURCE_OWNED");
      expectRejected(mutate("li_a", { type: "REORDER", index: 3 }), "INVALID_MUTATION");
    });
  });

  describe("honest outcomes", () => {
    it("reports NO_CHANGE instead of updated for edits that match the source", () => {
      for (const [id, mutation] of [
        ["title", { type: "SET_TEXT", text: "Simple pricing" }],
        ["lead", { type: "SET_TEXT", text: "Pay for what you use." }],
        ["cta", { type: "SET_PROP", name: "href", value: "/signup" }],
        ["cta", { type: "SET_PROP", name: "target", value: null }],
        ["hero", { type: "SET_CLASSES", classes: ["hero", "dark"] }],
        ["hero", { type: "SET_CLASSES", add: ["hero"], remove: ["absent"] }],
        ["hero", { type: "SET_STYLE", style: { paddingTop: 48, color: "#111111" } }],
        ["title", { type: "SET_STYLE", style: { color: null } }],
        ["li_b", { type: "REORDER", index: 1 }],
        ["li_c", { type: "MOVE", parentId: "list" }],
      ] as Array<[string, JsxMutation]>) {
        expectRejected(mutate(id, mutation), "NO_CHANGE");
      }
    });

    it("leaves malformed source untouched", () => {
      const broken = SOURCE.replace("</ul>", "");
      expectRejected(mutate("title", { type: "SET_TEXT", text: "x" }, broken), "INVALID_SOURCE", broken);
      expectRejected(mutate("title", { type: "SET_TEXT", text: "x" }, "export default function ("), "INVALID_SOURCE", "export default function (");
      expectRejected(mutate("title", { type: "SET_TEXT", text: "x" }, ""), "TARGET_NOT_FOUND", "");
    });

    it("rejects ambiguous and missing targets", () => {
      const duplicated = SOURCE.replace('data-forge-id="li_b"', 'data-forge-id="li_a"');
      expectRejected(mutate("li_a", { type: "SET_TEXT", text: "x" }, duplicated), "AMBIGUOUS_TARGET", duplicated);
      expectRejected(mutate("li_c", { type: "MOVE", parentId: "li_a" }, duplicated), "AMBIGUOUS_TARGET", duplicated);
      expectRejected(mutate("nope", { type: "REMOVE" }), "TARGET_NOT_FOUND");
      expectRejected(mutate("bad id!", { type: "REMOVE" }), "INVALID_MUTATION");
      expectRejected(mutate("title", { type: "EXPLODE" } as any), "UNSUPPORTED");
      expectRejected(mutate("title", undefined as any), "INVALID_MUTATION");
    });

    it("does not edit inside a protected region", () => {
      // The marker is a line comment; between JSX children it sits inside a JSX comment.
      const marked = SOURCE
        .replace('      <ul data-forge-id="list">', '      {/*\n      // [forge-protect-start: legal]\n      */}\n      <ul data-forge-id="list">')
        .replace("      </ul>", "      </ul>\n      {/*\n      // [forge-protect-end: legal]\n      */}");
      expect(validateSourceSyntax(marked, "x.tsx").isValid).toBe(true);
      expectRejected(mutate("li_a", { type: "SET_TEXT", text: "x" }, marked), "SOURCE_OWNED", marked);
      expectRejected(mutate("li_a", { type: "REMOVE" }, marked), "SOURCE_OWNED", marked);
      expect(mutate("title", { type: "SET_TEXT", text: "Outside" }, marked).updated).toBe(true);
    });

    it("keeps the legacy string form and refuses a missing change", () => {
      expect(updateJsxElementViaAst(SOURCE, "title", "Legacy").content).toContain(">Legacy</h1>");
      expect(updateJsxElementViaAst(SOURCE, "title")).toMatchObject({ updated: false, code: "INVALID_MUTATION", content: SOURCE });
    });
  });

  describe("preservation and round trip", () => {
    const sequence: Array<[string, JsxMutation]> = [
      ["title", { type: "SET_TEXT", text: "Fair pricing" }],
      ["hero", { type: "SET_CLASSES", add: ["wide"] }],
      ["hero", { type: "SET_STYLE", style: { paddingTop: 64, gap: "2rem" } }],
      ["cta", { type: "SET_PROP", name: "href", value: "/start" }],
      ["li_new", { type: "INSERT", parentId: "list", index: 0, element: { tag: "li", text: "New" } }],
      ["li_c", { type: "REORDER", index: 0 }],
      ["art", { type: "MOVE", parentId: "footer", index: 0 }],
    ];
    const inverse: Array<[string, JsxMutation]> = [
      ["art", { type: "MOVE", parentId: "hero" }],
      ["li_c", { type: "REORDER", index: 3 }],
      ["li_new", { type: "REMOVE" }],
      ["cta", { type: "SET_PROP", name: "href", value: "/signup" }],
      ["hero", { type: "SET_STYLE", style: { paddingTop: 48, gap: null } }],
      ["hero", { type: "SET_CLASSES", remove: ["wide"] }],
      ["title", { type: "SET_TEXT", text: "Simple pricing" }],
    ];

    const run = (source: string, steps: Array<[string, JsxMutation]>) =>
      steps.reduce((current, [id, mutation]) => {
        const result = mutate(id, mutation, current);
        expect(result.updated, `${id} ${mutation.type}: ${result.diagnostic}`).toBe(true);
        return result.content;
      }, source);

    it("keeps imports, hooks, handlers, helpers and comments byte-for-byte through a series of edits", () => {
      const edited = run(SOURCE, sequence);
      const untouched = [
        'import { track } from "../lib/analytics"; // user import',
        "// A user-owned helper the editor must never touch.",
        "  return `$${value.toFixed(2)}`;",
        "  const [open, setOpen] = useState(false);",
        "        {plans.map((plan) => (",
        '        <button onClick={() => { setOpen(!open); track("toggle"); }} data-forge-id="toggle">Toggle</button>',
        '      <footer className={open ? "footer open" : "footer"} style={{ ...base, margin: 0 }} data-forge-id="footer">',
      ];
      for (const line of untouched) expect(edited.split("\n")).toContain(line);
      expect(edited.slice(0, edited.indexOf("return ("))).toBe(SOURCE.slice(0, SOURCE.indexOf("return (")));
    });

    it("returns to the original source when every edit is reversed", () => {
      expect(run(run(SOURCE, sequence), inverse)).toBe(SOURCE);
    });

    it("preserves element identities and stays readable by the code-to-visual parser", () => {
      const ids = (source: string) => [...source.matchAll(/data-forge-id="([\w-]+)"/g)].map((m) => m[1]).sort();
      const edited = run(SOURCE, sequence);
      expect(ids(edited)).toEqual([...ids(SOURCE), "li_new"].sort());
      const parsed = parseSourceCodeToElements(edited, [], "src/pages/PricingPage.tsx");
      expect(parsed.success).toBe(true);
      const flat: any[] = [];
      const walk = (list: any[]) => list.forEach((el) => { flat.push(el); walk(el.children || []); });
      walk(parsed.elements);
      expect(flat.find((el) => el.id === "title")).toMatchObject({ type: "heading", content: "Fair pricing" });
      expect(flat.find((el) => el.id === "hero").styles).toMatchObject({ gap: "2rem" });
      expect(flat.find((el) => el.id === "list").children.map((el: any) => el.id)).toEqual(["li_c", "li_new", "li_a", "li_b"]);
    });

    it("keeps CRLF line endings", () => {
      const crlf = SOURCE.replace(/\n/g, "\r\n");
      const result = mutate("li_new", { type: "INSERT", parentId: "list", element: { tag: "li", text: "x" } }, crlf);
      expect(result.updated).toBe(true);
      expect(result.content.replace(/\r\n/g, "")).not.toContain("\n");
    });
  });

  describe("realtime operation pipeline", () => {
    const projectId = `proj_ast_${Date.now()}`;
    let n = 0;
    const op = (partial: Partial<VisualOperationPayload>): VisualOperationPayload => ({
      projectId,
      pageId: "page_pricing",
      nodeId: "title",
      operationType: "TEXT_EDIT",
      baseCheckpointId: "cp_base",
      expectedRevision: WorkspaceCoordinatorService.getCurrentRevision(projectId),
      actorId: "user_ast",
      tenantId: "tenant_ast",
      operationId: `op_ast_${++n}`,
      viewId: "view_ast",
      ...partial,
    });
    const send = (partial: Partial<VisualOperationPayload>) =>
      RealtimeSyncService.processVisualOperation(op(partial), "src/pages/PricingPage.tsx", SOURCE);

    it("commits every operation type that changes the source", async () => {
      for (const partial of [
        { operationType: "TEXT_EDIT", newValue: "Fair pricing" },
        { operationType: "PROPERTY_UPDATE", nodeId: "cta", propertyKey: "href", newValue: "/start" },
        { operationType: "PROPERTY_UPDATE", nodeId: "hero", propertyKey: "className", newValue: "hero light" },
        { operationType: "PROPERTY_UPDATE", nodeId: "hero", propertyKey: "style.paddingTop", newValue: 64 },
        { operationType: "REORDER", nodeId: "li_c", reorderIndex: 0 },
        { operationType: "DRAG", nodeId: "cta", parentNodeId: "empty" },
        { operationType: "REMOVE", nodeId: "li_b" },
        { operationType: "INSERT", nodeId: "li_new", parentNodeId: "list", newValue: { tag: "li", text: "New" } },
      ] as Array<Partial<VisualOperationPayload>>) {
        const before = WorkspaceCoordinatorService.getCurrentRevision(projectId);
        const result = await send(partial);
        expect(result, `${partial.operationType} ${partial.nodeId ?? "title"}`).toMatchObject({ success: true, sourceChanged: true, syncStatus: "SYNCHRONIZED" });
        expect(result.committedRevision).toBe(before + 1);
        expect(Object.keys(result.committedFileHashes)).toEqual(["src/pages/PricingPage.tsx"]);
        expect(result.changedRanges[0].startLine).toBeGreaterThan(12);
      }
    });

    it("does not commit, or claim a change, for no-op and rejected operations", async () => {
      const before = WorkspaceCoordinatorService.getCurrentRevision(projectId);
      const same = await send({ operationType: "TEXT_EDIT", newValue: "Simple pricing" });
      expect(same).toMatchObject({ success: true, sourceChanged: false, rejectionCode: "NO_CHANGE", committedFileHashes: {}, changedRanges: [] });

      for (const [partial, code] of [
        [{ operationType: "TEXT_EDIT", nodeId: "plans_title", newValue: "x" }, "SOURCE_OWNED"],
        [{ operationType: "TEXT_EDIT", nodeId: "missing", newValue: "x" }, "TARGET_NOT_FOUND"],
        [{ operationType: "DRAG", nodeId: "cta", newValue: { x: 10, y: 20 } }, "UNSUPPORTED"],
        [{ operationType: "PROPERTY_UPDATE", nodeId: "toggle", propertyKey: "onClick", newValue: "x" }, "SOURCE_OWNED"],
        [{ operationType: "REMOVE", nodeId: "root" }, "UNSUPPORTED"],
      ] as Array<[Partial<VisualOperationPayload>, string]>) {
        const result = await send(partial);
        expect(result, `${partial.operationType} ${partial.nodeId}`).toMatchObject({ success: false, sourceChanged: false, rejectionCode: code, syncStatus: "LOCAL_CHANGES" });
        expect(result.diagnostics[0].severity).toBe("error");
      }
      const broken = await RealtimeSyncService.processVisualOperation(op({ newValue: "x" }), "src/pages/PricingPage.tsx", SOURCE.replace("</ul>", ""));
      expect(broken).toMatchObject({ success: false, sourceChanged: false, rejectionCode: "INVALID_SOURCE", syncStatus: "INVALID_SOURCE" });
      expect(WorkspaceCoordinatorService.getCurrentRevision(projectId)).toBe(before);
    });
  });
});
