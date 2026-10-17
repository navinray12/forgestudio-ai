/**
 * NestedTabsWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";
import { UniversalItemManager } from "../shared/UniversalItemManager";

/* F-166: Nested Tabs Inspector */
export function NestedTabsWidgetInspector({
  el,
  updateProp,
}: {
  el: EditorElement;
  updateProp: (key: string, value: any) => void;
}) {
  const tabs = el.tabsItems || [
    { id: "tab1", title: "Tab 1", icon: "layers" },
    { id: "tab2", title: "Tab 2", icon: "sparkles" },
    { id: "tab3", title: "Tab 3", icon: "settings" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Nested Tabs Settings</h4>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Tabs Orientation</label>
          <select
            value={el.tabsOrientation || "horizontal"}
            onChange={(e) => updateProp("tabsOrientation", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
          >
            <option value="horizontal">Horizontal Top Bar</option>
            <option value="vertical">Vertical Left Sidebar</option>
          </select>
        </div>
      </div>

      <UniversalItemManager
        title="Tab Items"
        items={tabs}
        onUpdate={(newItems) => updateProp("tabsItems", newItems)}
        createDefaultItem={() => ({
          id: "tab_" + Date.now(),
          title: `Tab ${tabs.length + 1}`,
          icon: "layers",
          content: "Tab panel description content."
        })}
        getItemHeaderLabel={(item, idx) => item.title || `Tab ${idx + 1}`}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Tab Title</label>
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateItem({ title: e.target.value })}
                className="w-full rounded border border-slate-200 px-2.5 py-1 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Lucide Icon Name</label>
              <input
                type="text"
                value={item.icon || ""}
                onChange={(e) => updateItem({ icon: e.target.value })}
                placeholder="e.g. layers, sparkles, star"
                className="w-full rounded border border-slate-200 px-2.5 py-1 text-xs font-medium"
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}
