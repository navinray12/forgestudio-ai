// Fresh element ids for imported elements without an existing id.
// Moved verbatim from codeImporter.ts (now a compatibility entry point that re-exports the public API).

/**
 * Generate a unique ID for new elements if an existing ID is not available
 */
export function generateId(): string {
  return "el_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
}
