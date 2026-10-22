import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { EditorElement } from "../types";

/**
 * The editor's window keyboard shortcuts, moved verbatim from WebsiteEditor.tsx (same handler body,
 * same dependency list, so the listener is registered and replaced exactly as before: one window
 * keydown listener, replaced whenever a value in the dependency list changes, removed on unmount).
 * Some dependencies (elements, history, historyIndex, isPreview, saving) are not read by the handler
 * but are kept so the re-registration timing, and with it which render's callbacks the handler
 * captures, is unchanged.
 *
 * Ctrl/Cmd+K toggles the finder even while typing; otherwise shortcuts are ignored in inputs,
 * textareas and contentEditable. Escape closes help, then the finder, then full-screen. The finder's
 * own search input handles Escape separately (WebsiteEditor.tsx).
 */
export interface EditorShortcutsInput {
  selectedId: string | null;
  selectedIds: string[];
  copiedElement: unknown;
  elements: EditorElement[];
  historyIndex: number;
  history: EditorElement[][];
  isFullScreenCanvas: boolean;
  isPreview: boolean;
  saving: boolean;
  isShortcutsHelpOpen: boolean;
  isFinderOpen: boolean;
  setIsFinderOpen: Dispatch<SetStateAction<boolean>>;
  setIsShortcutsHelpOpen: Dispatch<SetStateAction<boolean>>;
  setIsFullScreenCanvas: Dispatch<SetStateAction<boolean>>;
  setIsPreview: Dispatch<SetStateAction<boolean>>;
  handleSave: () => unknown;
  handleDeleteElement: (id: string) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleCopyElement: () => void;
  handlePasteElement: () => void;
  handleDuplicateElement: (id: string) => void;
  handleReorderElement: (id: string, direction: "up" | "down") => void;
}

export function useEditorShortcuts({
  selectedId,
  selectedIds,
  copiedElement,
  elements,
  historyIndex,
  history,
  isFullScreenCanvas,
  isPreview,
  saving,
  isShortcutsHelpOpen,
  isFinderOpen,
  setIsFinderOpen,
  setIsShortcutsHelpOpen,
  setIsFullScreenCanvas,
  setIsPreview,
  handleSave,
  handleDeleteElement,
  handleUndo,
  handleRedo,
  handleCopyElement,
  handlePasteElement,
  handleDuplicateElement,
  handleReorderElement,
}: EditorShortcutsInput) {
  // Ctrl/Cmd+S calls the latest render's handleSave. The listener below is only re-registered when its
  // dependency list changes, and page settings (among other save inputs) are not in it, so calling the
  // captured handleSave saved stale page settings (Phase 7C, known issue #1).
  const latestHandleSave = useRef(handleSave);
  latestHandleSave.current = handleSave;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsFinderOpen((prev) => !prev);
        return;
      }

      if (isInput) return;

      if (e.key === "Escape") {
        if (isShortcutsHelpOpen) {
          e.preventDefault();
          setIsShortcutsHelpOpen(false);
        } else if (isFinderOpen) {
          e.preventDefault();
          setIsFinderOpen(false);
        } else if (isFullScreenCanvas) {
          e.preventDefault();
          setIsFullScreenCanvas(false);
        }
      } else if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setIsShortcutsHelpOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        latestHandleSave.current();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setIsPreview((prev) => !prev);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          handleDeleteElement(selectedId);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selectedId || selectedIds.length > 0) {
          e.preventDefault();
          handleCopyElement();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (copiedElement) {
          e.preventDefault();
          handlePasteElement();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (selectedId) {
          e.preventDefault();
          handleDuplicateElement(selectedId);
        }
      } else if (e.altKey && e.key === "ArrowUp") {
        if (selectedId) {
          e.preventDefault();
          handleReorderElement(selectedId, "up");
        }
      } else if (e.altKey && e.key === "ArrowDown") {
        if (selectedId) {
          e.preventDefault();
          handleReorderElement(selectedId, "down");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, selectedIds, copiedElement, elements, historyIndex, history, isFullScreenCanvas, isPreview, saving, isShortcutsHelpOpen, isFinderOpen]);
}
