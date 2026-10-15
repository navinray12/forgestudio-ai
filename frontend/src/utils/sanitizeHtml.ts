import DOMPurify from "dompurify";

/**
 * Standard configuration for HTML sanitization in editor canvas and rendering paths.
 * Allows safe HTML structure, styling classes, and responsive embed attributes
 * while strictly stripping executable scripts, event handlers, and dangerous embedded objects.
 */
export const EDITOR_DOMPURIFY_CONFIG: DOMPurify.Config = {
  FORBID_TAGS: ["style", "script", "embed", "object", "base"],
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
  ],
  ADD_TAGS: ["iframe"],
  ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"],
};

/**
 * Sanitize untrusted HTML markup before passing to dangerouslySetInnerHTML.
 * Prevents cross-collaborator stored XSS attacks while preserving valid editor layout.
 */
export function sanitizeHtml(markup: string, config: DOMPurify.Config = EDITOR_DOMPURIFY_CONFIG): string {
  if (!markup) return "";
  return DOMPurify.sanitize(markup, config) as string;
}
