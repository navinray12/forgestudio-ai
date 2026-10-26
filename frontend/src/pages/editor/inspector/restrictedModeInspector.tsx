import React from "react";
import { ContentOnlyInspector } from "../components/ContentOnlyInspector";
import type { EditorElement } from "../types";
import { updateTreeElement } from "../utils";
import { triggerImagePicker } from "./DynamicWidgetInspectors";

/** What renderRestrictedModeInspector reads: the editor values and callbacks the inline JSX used. */
export interface RestrictedModeInspectorDeps {
  selectedElementAny: any;
  setElements: React.Dispatch<React.SetStateAction<EditorElement[]>>;
}

/**
 * Inspector in restricted (content-only) mode: the ContentOnlyInspector with its element update and image picker wiring.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3670-3678 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderRestrictedModeInspector({
  selectedElementAny,
  setElements,
}: RestrictedModeInspectorDeps): React.ReactNode {
  return (
              <ContentOnlyInspector
                element={selectedElementAny}
                onUpdateElement={(id, updates) => {
                  setElements((prev) => updateTreeElement(prev, id, (el) => ({ ...el, ...updates })));
                }}
                onTriggerImagePicker={(callback) => {
                  triggerImagePicker(callback);
                }}
              />
  );
}
