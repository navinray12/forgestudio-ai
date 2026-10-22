/**
 * Site-part visibility rule shared by the backend compilers. It mirrors the editor's
 * frontend/src/pages/editor/core/siteParts.ts (isSitePartEnabled): a site part is shown unless
 * explicitly disabled; `enabled` (draft spelling) wins over `isEnabled` (published-snapshot and
 * legacy spelling). Kept dependency-free so any backend module can use it.
 */
export function isSitePartEnabled(part: unknown): boolean {
  if (!part || typeof part !== "object") return true;
  const { enabled, isEnabled } = part as { enabled?: unknown; isEnabled?: unknown };
  return Boolean(enabled ?? isEnabled ?? true);
}
