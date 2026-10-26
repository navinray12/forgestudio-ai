/**
 * NestedAccordionWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { IconRenderer } from "../../icons";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-167: Nested Accordion Widget Renderer */
export const NestedAccordionWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const items = el.accordionItems || [
    { id: "acc1", title: "1. What features are included in ForgeStudio?", icon: "help-circle" },
    { id: "acc2", title: "2. How does document persistence work?", icon: "database" },
    { id: "acc3", title: "3. Can I export clean React or HTML code?", icon: "code" },
  ];
  const allowMultiple = el.accordionAllowMultiple || false;
  const [openIds, setOpenIds] = useState<string[]>(el.accordionActiveIds || [items[0]?.id || "acc1"]);

  const toggleAccordion = (itemId: string) => {
    if (allowMultiple) {
      setOpenIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
    } else {
      setOpenIds((prev) => (prev.includes(itemId) ? [] : [itemId]));
    }
  };

  return (
    <div
      className="w-full flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
      }}
    >
      {items.map((item, idx) => {
        const isOpen = openIds.includes(item.id || String(idx));
        return (
          <div
            key={item.id || idx}
            className="rounded-xl border border-slate-200 overflow-hidden transition-all bg-white"
          >
            <button
              type="button"
              onClick={() => toggleAccordion(item.id || String(idx))}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition cursor-pointer ${
                isOpen ? "bg-blue-50/80 text-blue-900 font-bold" : "bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {item.icon && <IconRenderer iconName={item.icon} className="w-4 h-4 text-blue-600" />}
                <span className="text-xs">{item.title || `Accordion Item ${idx + 1}`}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-blue-600" : ""}`} />
            </button>
            {isOpen && (
              <div className="p-4 bg-white border-t border-slate-200/60 text-xs text-slate-600 leading-relaxed animate-in fade-in duration-150">
                {item.content ||
                  "Accordion panel expandable body. Place text, buttons, forms, or child canvas elements inside this section."}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
