/**
 * IconListWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// Icon List Inspector (F-155)
export function IconListWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const items: { id: string; text: string; icon: string; color: string; url?: string }[] = el.iconListItems || [
    { id: "item_1", text: "High priority SLA support", icon: "✓", color: "#10b981", url: "" },
    { id: "item_2", text: "Unlimited custom domains", icon: "✓", color: "#10b981", url: "" },
    { id: "item_3", text: "Advanced analytics dashboard", icon: "✓", color: "#10b981", url: "" }
  ];

  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
        <span>📋</span> Icon List Settings
      </h3>

      <UniversalItemManager<{ id: string; text: string; icon: string; color: string; url?: string }>
        title="List Items"
        items={items}
        onUpdate={(newItems) => updateProp("iconListItems", newItems)}
        createDefaultItem={() => ({
          id: "item_" + Date.now(),
          text: "New Feature Item",
          icon: "✓",
          color: "#10b981",
          url: ""
        })}
        getItemHeaderLabel={(item) => item.text || "Untitled Item"}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <div className="col-span-2">
                <label className="block text-[9px] font-bold text-slate-500 uppercase">Item Text</label>
                <input
                  type="text"
                  value={item.text}
                  onChange={(e) => updateItem({ text: e.target.value })}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase">Icon</label>
                <input
                  type="text"
                  value={item.icon || "✓"}
                  onChange={(e) => updateItem({ icon: e.target.value })}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-medium"
                />
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase">Optional Link</label>
              <input
                type="text"
                value={item.url || ""}
                onChange={(e) => updateItem({ url: e.target.value })}
                placeholder="https://..."
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-medium"
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}
