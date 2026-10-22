/**
 * PortfolioWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, PortfolioItem } from "../../types";
import { triggerImagePicker } from "../shared/imagePicker";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// 15. Portfolio Inspector
export function PortfolioWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const items = el.portfolioItems || [];

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Columns</label>
        <select
          value={el.portfolioColumns || 3}
          onChange={(e) => updateProp("portfolioColumns", parseInt(e.target.value, 10))}
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
        >
          <option value={2}>2 Columns</option>
          <option value={3}>3 Columns</option>
          <option value={4}>4 Columns</option>
        </select>
      </div>

      <UniversalItemManager<PortfolioItem>
        title="Portfolio Items"
        items={items}
        onUpdate={(newItems) => updateProp("portfolioItems", newItems)}
        createDefaultItem={() => ({
          id: "port_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          title: "New Project",
          category: "Branding",
          image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80",
          url: "#",
          description: "Project showcase details..."
        })}
        getItemHeaderLabel={(item) => `${item.title} (${item.category || "General"})`}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Project Title</label>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem({ title: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Category</label>
                <input
                  type="text"
                  value={item.category || ""}
                  onChange={(e) => updateItem({ category: e.target.value })}
                  placeholder="Design, Web, Tech..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Image URL</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={item.image || ""}
                  onChange={(e) => updateItem({ image: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => triggerImagePicker((url) => updateItem({ image: url }))}
                  className="shrink-0 flex items-center gap-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 text-[10px] font-bold cursor-pointer transition active:scale-95"
                >
                  <span>📁 Select Image</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Description</label>
              <textarea
                value={item.description || ""}
                onChange={(e) => updateItem({ description: e.target.value })}
                rows={2}
                placeholder="Project showcase details..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Project URL</label>
              <input
                type="text"
                value={item.url || ""}
                onChange={(e) => updateItem({ url: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}
