import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { EditorElement } from "../types";

/**
 * Undo/redo history for the editor canvas, moved verbatim from WebsiteEditor.tsx.
 *
 * Every change to `elements` (other than one made by undo/redo) records a deep copy; a new edit
 * after undo drops the redo branch; at most 50 entries are kept. The two resets keep the exact
 * call-site behaviour they replace:
 *  - resetHistoryTo(els): history = [els], index 0 (page / scope / new-page switches). The recording
 *    effect then also records the new elements, so the first undo after a switch is a no-op.
 *  - clearHistoryForLoad(): history = [], index -1 (initial load, Code Workspace reload), so the
 *    elements set in the same update become entry 0 and undo cannot cross the boundary.
 */
export function useEditorHistory(elements: EditorElement[], setElements: Dispatch<SetStateAction<EditorElement[]>>) {
  // Revision & History State (F-013)
  const [history, setHistory] = useState<EditorElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isUndoRedoAction = useRef(false);

  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }

    setHistory((prev) => {
      const sliced = historyIndex >= 0 ? prev.slice(0, historyIndex + 1) : prev;
      const updated = [...sliced, JSON.parse(JSON.stringify(elements))];
      if (updated.length > 50) updated.shift();
      return updated;
    });

    setHistoryIndex(historyIndex >= 0 ? Math.min(historyIndex + 1, 49) : 0);
  }, [elements]);

  const handleUndo = () => {
    if (historyIndex > 0 && history[historyIndex - 1]) {
      isUndoRedoAction.current = true;
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(JSON.parse(JSON.stringify(history[newIndex])));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1 && history[historyIndex + 1]) {
      isUndoRedoAction.current = true;
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(JSON.parse(JSON.stringify(history[newIndex])));
    }
  };

  const resetHistoryTo = (entry: EditorElement[]) => {
    setHistory([entry]);
    setHistoryIndex(0);
  };

  const clearHistoryForLoad = () => {
    setHistory([]);
    setHistoryIndex(-1);
  };

  return { history, historyIndex, handleUndo, handleRedo, resetHistoryTo, clearHistoryForLoad };
}
