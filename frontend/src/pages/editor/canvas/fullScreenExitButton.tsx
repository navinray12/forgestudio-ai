import React from "react";

/** What renderFullScreenExitButton reads: the editor values and callbacks the inline JSX used. */
export interface FullScreenExitButtonDeps {
  isFullScreenCanvas: boolean;
  setIsFullScreenCanvas: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Canvas: the exit button shown in full-screen canvas mode.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3584-3596 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderFullScreenExitButton({
  isFullScreenCanvas,
  setIsFullScreenCanvas,
}: FullScreenExitButtonDeps): React.ReactNode {
  return (
          isFullScreenCanvas && (
            <div className="absolute top-4 right-6 z-50">
              <button
                type="button"
                onClick={() => setIsFullScreenCanvas(false)}
                className="flex items-center gap-1.5 rounded-full bg-slate-900/90 text-white px-4 py-2 text-xs font-bold shadow-lg border border-slate-700 hover:bg-black hover:scale-105 transition"
                title="Exit Full Screen Mode (Esc)"
              >
                <span>✕</span>
                <span>Exit Full Screen (Esc)</span>
              </button>
            </div>
          )
  );
}
