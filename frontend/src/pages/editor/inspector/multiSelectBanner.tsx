import React from "react";

/** What renderMultiSelectBanner reads: the editor values and callbacks the inline JSX used. */
export interface MultiSelectBannerDeps {
  selectedIds: string[];
}

/**
 * Inspector: the Multi-Select banner shown when more than one element is selected.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3680-3684 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderMultiSelectBanner({
  selectedIds,
}: MultiSelectBannerDeps): React.ReactNode {
  return (
                selectedIds.length > 1 && (
                  <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 p-2 text-center text-xs font-semibold text-blue-700">
                    Multi-Select ({selectedIds.length} elements selected)
                  </div>
                )
  );
}
