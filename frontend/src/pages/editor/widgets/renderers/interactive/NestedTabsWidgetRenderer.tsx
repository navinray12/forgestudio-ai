/**
 * NestedTabsWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { IconRenderer } from "../../icons";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-166: Nested Tabs Widget Renderer */
export const NestedTabsWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const [activeTab, setActiveTab] = useState(el.tabsActiveIndex || 0);
  const tabs = el.tabsItems || [
    { id: "tab1", title: "Tab 1", icon: "layers" },
    { id: "tab2", title: "Tab 2", icon: "sparkles" },
    { id: "tab3", title: "Tab 3", icon: "settings" },
  ];
  const isVertical = el.tabsOrientation === "vertical";

  return (
    <div
      className="w-full flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
      }}
    >
      <div className={isVertical ? "flex flex-col md:flex-row gap-4" : "flex flex-col gap-4"}>
        {/* Tabs Bar */}
        <div
          className={
            isVertical
              ? "flex flex-col gap-1.5 w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-3"
              : "flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3"
          }
        >
          {tabs.map((tab, idx) => {
            const isActive = activeTab === idx;
            return (
              <button
                key={tab.id || idx}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                {tab.icon && <IconRenderer iconName={tab.icon} className="w-3.5 h-3.5" />}
                <span>{tab.title || `Tab ${idx + 1}`}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panel */}
        <div className="flex-1 p-4 rounded-xl bg-slate-50 border border-slate-200/60 min-h-[120px]">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            {tabs[activeTab]?.title || `Tab ${activeTab + 1}`} Content
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            {tabs[activeTab]?.content ||
              "Tab panel active content. Drop container elements or widgets inside this tab panel from the editor canvas."}
          </p>
        </div>
      </div>
    </div>
  );
};
