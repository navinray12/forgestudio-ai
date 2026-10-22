/**
 * Pure parts of WebsiteEditor's handleSelectElement (which keeps its setter calls and their order).
 */

/** Ctrl / Cmd click: removes the id when it is selected, otherwise appends it (order kept). */
export function toggleSelectedId(prev: string[], id: string): string[] {
  const isAlreadySelected = prev.includes(id);
  const updated = isAlreadySelected
    ? prev.filter((item) => item !== id)
    : [...prev, id];
  return updated;
}

/**
 * Shift click: the ids from the anchor to the clicked id, inclusive, in tree (depth-first) order;
 * null when either is not in the tree.
 */
export function selectionRangeIds(allIds: string[], anchorId: string, id: string): string[] | null {
  const startIdx = allIds.indexOf(anchorId);
  const endIdx = allIds.indexOf(id);
  if (startIdx !== -1 && endIdx !== -1) {
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    const rangeIds = allIds.slice(minIdx, maxIdx + 1);
    return rangeIds;
  }
  return null;
}
