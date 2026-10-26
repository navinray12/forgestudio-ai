// HTML escaping for text / attribute values and the custom <head> sanitizer used by the static compiler.
// Moved verbatim from staticCompiler.ts (sanitizeCustomHead is re-exported there).

export function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeCustomHead(rawHead: string | undefined): string {
  if (!rawHead || typeof rawHead !== "string") return "";
  let sanitized = rawHead.trim();
  if (!sanitized) return "";

  // Strip dangerous framing and embedding elements
  sanitized = sanitized
    .replace(/<iframe\b[^>]*>([\s\S]*?<\/iframe>)?/gi, "")
    .replace(/<object\b[^>]*>([\s\S]*?<\/object>)?/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/<applet\b[^>]*>([\s\S]*?<\/applet>)?/gi, "")
    .replace(/<form\b[^>]*>([\s\S]*?<\/form>)?/gi, "");

  // Strip dangerous inline event handlers (onload=, onerror=, etc.)
  sanitized = sanitized.replace(/\son[a-z]+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, "");

  // Neutralize javascript: and vbscript: URI schemes in attributes
  sanitized = sanitized.replace(/(href|src)\s*=\s*['"]\s*(javascript|vbscript):[^'"]*['"]/gi, "$1=\"#\"");

  return sanitized;
}
