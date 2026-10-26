import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { EditorElement } from "../types";

/**
 * Owns the editor's single window shortcut listener and removes it on unmount.
 * Save uses the latest callback so page-setting edits cannot be saved from a stale render.
 * Ctrl/Cmd+K works while typing. Escape closes help, then Finder, then full-screen
 * before the typing guard; other editor shortcuts leave input fields alone.
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

      if (e.key === "Escape") {
        if (isShortcutsHelpOpen) {
          e.preventDefault();
          setIsShortcutsHelpOpen(false);
          return;
        } else if (isFinderOpen) {
          e.preventDefault();
          setIsFinderOpen(false);
          return;
        } else if (isFullScreenCanvas) {
          e.preventDefault();
          setIsFullScreenCanvas(false);
          return;
        }
      }

      if (isInput) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
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
