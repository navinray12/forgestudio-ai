import React from "react";
import { MotionInteractionInspector } from "..";
import type { ElementStyles } from "../../types";

/** What renderMotionAccordion reads: the editor values and callbacks the inline JSX used. */
export interface MotionAccordionDeps {
  renderAccordion: (title: string, id: string, children: React.ReactNode) => React.JSX.Element;
  selectedElementAny: any;
  updateSelectedProp: (key: string, value: any) => void;
  updateSelectedStyle: (key: keyof ElementStyles, value: any) => void;
}

/**
 * Selected-element inspector: the Motion & Interaction accordion (always last).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 5926-5934 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderMotionAccordion({
  renderAccordion,
  selectedElementAny,
  updateSelectedProp,
  updateSelectedStyle,
}: MotionAccordionDeps): React.ReactNode {
  return (
                    renderAccordion(
                      "Motion & Interaction",
                      "motion-interaction",
                      <MotionInteractionInspector
                        selectedElement={selectedElementAny}
                        updateSelectedProp={updateSelectedProp}
                        updateSelectedStyle={updateSelectedStyle}
                      />
                    )
  );
}
