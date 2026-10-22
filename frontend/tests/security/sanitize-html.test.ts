// @vitest-environment jsdom
/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Regression guard for src/utils/sanitizeHtml.ts (editor / published-site HTML sanitizer).
 *
 * The inline snapshots were recorded from the unmodified sanitizer before its TypeScript errors were
 * fixed (PR #41 CI), so a type-only change must leave every output identical. They cover the forbidden
 * tags and event attributes, URI filtering, the iframe and link hardening hooks, the CSS neutralizing
 * hook, data attributes, the custom-config parameter and the empty input.
 */
import { EDITOR_DOMPURIFY_CONFIG, sanitizeHtml } from "../../src/utils/sanitizeHtml";

describe("sanitizeHtml", () => {
  it("returns a string, and an empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(typeof sanitizeHtml("<p>x</p>")).toBe("string");
  });

  it("removes scripts and forbidden embedding tags", () => {
    expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).toMatchInlineSnapshot(`"<p>hi</p>"`);
    expect(sanitizeHtml('<div><embed src="x.swf"><object data="x"></object><applet></applet><base href="https://evil"><meta http-equiv="refresh" content="0"><link rel="stylesheet" href="x.css">ok</div>')).toMatchInlineSnapshot(`"<div>ok</div>"`);
    expect(sanitizeHtml('<frameset><frame src="x"></frameset><p>after</p>')).toMatchInlineSnapshot(`""`);
  });

  it("removes event handler attributes and formaction", () => {
    expect(sanitizeHtml('<img src="x.png" onerror="alert(1)" onload="alert(2)">')).toMatchInlineSnapshot(`"<img src="x.png">"`);
    expect(sanitizeHtml('<button onclick="a()" onmouseover="b()" onfocus="c()" formaction="javascript:d()">b</button>')).toMatchInlineSnapshot(`"<button>b</button>"`);
    expect(sanitizeHtml('<input oninput="a()" onchange="b()" onkeydown="c()" onkeyup="d()" onkeypress="e()"><div onmouseenter="f()" onmouseleave="g()">x</div>')).toMatchInlineSnapshot(`"<input><div>x</div>"`);
  });

  it("filters dangerous URIs and keeps safe ones", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toMatchInlineSnapshot(`"<a>x</a>"`);
    expect(sanitizeHtml('<a href="https://example.test/p">a</a><a href="mailto:a@example.test">m</a><a href="tel:+100">t</a><a href="/relative">r</a>')).toMatchInlineSnapshot(`"<a href="https://example.test/p">a</a><a href="mailto:a@example.test">m</a><a href="tel:+100">t</a><a href="/relative">r</a>"`);
    expect(sanitizeHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">')).toMatchInlineSnapshot(`"<img src="data:text/html;base64,PHNjcmlwdD4=">"`);
  });

  it("hardens iframes: unsafe src removed, default sandbox, no-referrer, lazy loading", () => {
    expect(sanitizeHtml('<iframe src="https://www.youtube.com/embed/x" allowfullscreen frameborder="0"></iframe>')).toMatchInlineSnapshot(`"<iframe src="https://www.youtube.com/embed/x" allowfullscreen="" frameborder="0" sandbox="allow-scripts allow-same-origin allow-presentation" referrerpolicy="no-referrer" loading="lazy"></iframe>"`);
    expect(sanitizeHtml('<iframe src="javascript:alert(1)"></iframe>')).toMatchInlineSnapshot(`"<iframe sandbox="allow-scripts allow-same-origin allow-presentation" referrerpolicy="no-referrer" loading="lazy"></iframe>"`);
    expect(sanitizeHtml('<iframe src="data:text/html,x"></iframe><iframe src=" VBScript:x"></iframe>')).toMatchInlineSnapshot(`"<iframe sandbox="allow-scripts allow-same-origin allow-presentation" referrerpolicy="no-referrer" loading="lazy"></iframe><iframe sandbox="allow-scripts allow-same-origin allow-presentation" referrerpolicy="no-referrer" loading="lazy"></iframe>"`);
    expect(sanitizeHtml('<iframe src="https://example.test" sandbox="allow-forms" referrerpolicy="unsafe-url" loading="eager"></iframe>')).toMatchInlineSnapshot(`"<iframe src="https://example.test" sandbox="allow-forms" referrerpolicy="no-referrer" loading="lazy"></iframe>"`);
  });

  // DOMPurify's default allow-list drops `target`, so the hook's rel=noopener branch is not reached and no
  // target=_blank survives (recorded current behaviour).
  it("drops target attributes from links (no target=_blank survives)", () => {
    expect(sanitizeHtml('<a href="https://example.test" target="_blank" rel="opener">x</a><a href="https://example.test" target="_self">y</a>')).toMatchInlineSnapshot(`"<a href="https://example.test" rel="opener">x</a><a href="https://example.test">y</a>"`);
  });

  it("neutralizes @import, expression() and behavior in style blocks", () => {
    expect(sanitizeHtml('<div>a</div><style>@import url(https://evil/x.css); .a{width:expression(alert(1)); behavior: url(x.htc); color:red}</style>')).toMatchInlineSnapshot(`"<div>a</div><style>/* @import blocked */ .a{width:/* expression blocked */); /* behavior blocked */ color:red}</style>"`);
  });

  it("keeps data attributes, classes and inline styles", () => {
    expect(sanitizeHtml('<section class="hero" data-el-id="el1" data-x="1" style="color:red">t</section>')).toMatchInlineSnapshot(`"<section class="hero" data-el-id="el1" data-x="1" style="color:red">t</section>"`);
  });

  it("uses a custom config when given one", () => {
    expect(sanitizeHtml("<b>b</b><i>i</i>", { ALLOWED_TAGS: ["b"] })).toMatchInlineSnapshot(`"<b>b</b>i"`);
    expect(sanitizeHtml('<iframe src="https://example.test"></iframe>', { ...EDITOR_DOMPURIFY_CONFIG, FORBID_TAGS: ["iframe"] })).toMatchInlineSnapshot(`""`);
  });
});
