/**
 * OffCanvasWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useEffect } from "react";
import { OffCanvasBoxIcon } from "../../icons";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-206: Off Canvas Renderer */
export const OffCanvasWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
  renderChildren,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
  renderChildren?: (children?: EditorElement[]) => React.ReactNode;
}) => {
  const buttonText = el.offCanvasButtonText || "Open Panel";
  const title = el.offCanvasTitle || "Navigation & Tools";
  const position = el.offCanvasPosition || "right";
  const panelWidth = el.offCanvasWidth || "340px";
  const showOverlay = el.offCanvasOverlay ?? true;
  const btnBg = el.offCanvasButtonBgColor || "#0f172a";
  const btnText = el.offCanvasButtonTextColor || "#ffffff";
  const panelBg = el.offCanvasPanelBgColor || "#ffffff";
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      className="w-full flex justify-start transition-all"
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
        paddingTop: mergedStyles.paddingTop,
        paddingRight: mergedStyles.paddingRight,
        paddingBottom: mergedStyles.paddingBottom,
        paddingLeft: mergedStyles.paddingLeft,
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition hover:shadow-md active:scale-95 cursor-pointer"
        style={{ backgroundColor: btnBg, color: btnText }}
      >
        <OffCanvasBoxIcon />
        <span>{buttonText}</span>
      </button>

      {/* Slide-in Panel Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex overflow-hidden">
          {/* Backdrop Overlay */}
          {showOverlay && (
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fadeIn"
              onClick={() => setIsOpen(false)}
            />
          )}

          {/* Off Canvas Sliding Panel */}
          <div
            className={`fixed top-0 bottom-0 z-50 flex flex-col shadow-2xl transition-transform duration-300 ${
              position === "right" ? "right-0" : "left-0"
            }`}
            style={{ width: panelWidth, backgroundColor: panelBg }}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">{title}</h4>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Panel Content Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {renderChildren ? (
                renderChildren(el.children)
              ) : el.children && el.children.length > 0 ? (
                <div className="space-y-3">
                  {el.children.map((child) => (
                    <div key={child.id} className="p-2 border border-slate-100 rounded-lg">
                      {child.type} widget
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  <span>Off-Canvas Panel Content Area</span>
                  <span className="mt-1 text-[10px] text-slate-400">Drag & drop elements here</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
