import React from "react";

/** What renderShortcutsHelpOverlay reads: the editor values and callbacks the inline JSX used. */
export interface ShortcutsHelpOverlayDeps {
  isShortcutsHelpOpen: boolean;
  setIsShortcutsHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Keyboard shortcuts help overlay (opened with ?; Escape handling stays in useEditorShortcuts).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 14609-14722 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderShortcutsHelpOverlay({
  isShortcutsHelpOpen,
  setIsShortcutsHelpOpen,
}: ShortcutsHelpOverlayDeps): React.ReactNode {
  return (
      isShortcutsHelpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsShortcutsHelpOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <span className="text-lg">⌨️</span>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Keyboard Shortcuts</h3>
                  <p className="text-[11px] text-slate-400">Supported editor actions & key bindings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShortcutsHelpOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Shortcuts Content List */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Category 1: Editor Navigation & Canvas */}
              <div>
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <span>🚀</span> Editor & Navigation
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-700">Finder Search Palette</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Ctrl + K</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-700">Save Website</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Ctrl + S</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-700">Toggle Preview Mode</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Ctrl + P</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-700">Shortcuts Help Modal</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">?</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 sm:col-span-2">
                    <span className="text-xs font-semibold text-slate-700">Exit Fullscreen / Close Modal</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Esc</kbd>
                  </div>
                </div>
              </div>

              {/* Category 2: Element Editing & Clipboard */}
              <div>
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <span>🎨</span> Element Editing & Clipboard
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-700">Undo Action</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Ctrl + Z</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-700">Redo Action</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Ctrl + Y</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-700">Copy Element</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Ctrl + C</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-700">Paste Element</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Ctrl + V</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-700">Duplicate Element</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Ctrl + D</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-700">Delete Element</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Delete / Backspace</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-700">Move Section Up</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Alt + Up</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-700">Move Section Down</span>
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Alt + Down</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Press <kbd className="font-mono bg-white border border-slate-200 px-1 rounded">Esc</kbd> anytime to close</span>
              <button
                type="button"
                onClick={() => setIsShortcutsHelpOpen(false)}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )
  );
}
