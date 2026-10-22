import DOMPurify, { type Config } from "dompurify";

/**
 * Standard configuration for HTML sanitization in editor canvas and rendering paths.
 * Allows safe HTML structure, styling classes, and responsive embed attributes
 * while strictly stripping executable scripts, event handlers, and dangerous embedded objects.
 */
export const EDITOR_DOMPURIFY_CONFIG: Config = {
  FORBID_TAGS: ["script", "embed", "object", "base", "meta", "link", "applet", "frame", "frameset"],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "onmouseover",
    "onfocus",
    "oninput",
    "onchange",
    "onkeydown",
    "onkeyup",
    "onkeypress",
    "onmouseenter",
    "onmouseleave",
    "formaction",
  ],
  ADD_TAGS: ["iframe"],
  ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "sandbox", "referrerpolicy", "loading"],
  ALLOW_DATA_ATTR: true,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

// Hook: enforce iframe sandbox restrictions and clean dangerous CSS rules
let hooksAttached = false;
function ensurePurifyHooks() {
  if (hooksAttached || typeof DOMPurify.addHook !== "function") return;
  hooksAttached = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    // 1. Hardening for iframes: enforce sandbox restrictions and secure referrerpolicy
    if (node.tagName === "IFRAME") {
      const src = (node.getAttribute("src") || "").trim().toLowerCase();
      if (src.startsWith("javascript:") || src.startsWith("data:") || src.startsWith("vbscript:")) {
        node.removeAttribute("src");
      }
      if (!node.getAttribute("sandbox")) {
        node.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
      }
      node.setAttribute("referrerpolicy", "no-referrer");
      node.setAttribute("loading", "lazy");
    }

    // 2. Hardening for external links
    if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
      node.setAttribute("rel", "noopener noreferrer");
    }
  });

  DOMPurify.addHook("uponSanitizeElement", (node) => {
    // 3. Neutralize CSS @import and expression() inside style blocks. This hook receives any Node;
    // nodeName equals tagName for elements and is never "STYLE" for other node types.
    if (node.nodeName === "STYLE" && node.textContent) {
      node.textContent = node.textContent
        .replace(/@import\s+[^;]+;/gi, "/* @import blocked */")
        .replace(/expression\s*\([^)]*\)/gi, "/* expression blocked */")
        .replace(/behavior\s*:[^;]+;/gi, "/* behavior blocked */");
    }
  });
}

/**
 * Sanitize untrusted HTML markup before passing to dangerouslySetInnerHTML.
 * Prevents cross-collaborator stored XSS attacks while preserving valid editor layout.
 */
export function sanitizeHtml(markup: string, config: Config = EDITOR_DOMPURIFY_CONFIG): string {
  if (!markup) return "";
  ensurePurifyHooks();
  // A string unless the config asks for DOM nodes or TrustedHTML; no caller does, and String() covers it.
  const sanitized: unknown = DOMPurify.sanitize(markup, config);
  return typeof sanitized === "string" ? sanitized : String(sanitized);
}
