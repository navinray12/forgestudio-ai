/**
 * SlidesWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, SlideItem } from "../../types";
import { triggerImagePicker } from "../shared/imagePicker";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// 5. Slides Widget Inspector
export function SlidesWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const slides = el.slidesItems || [];

  return (
    <div className="space-y-3">
      {/* Slider Settings */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Height</label>
          <input
            type="text"
            value={el.slidesHeight || "450px"}
            onChange={(e) => updateProp("slidesHeight", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Transition</label>
          <select
            value={el.slidesTransition || "slide"}
            onChange={(e) => updateProp("slidesTransition", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="slide">Slide</option>
            <option value="fade">Fade</option>
          </select>
        </div>
      </div>

      <UniversalItemManager<SlideItem>
        title="Slides Manager"
        items={slides}
        onUpdate={(newItems) => updateProp("slidesItems", newItems)}
        createDefaultItem={() => ({
          id: "slide_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          title: "New Slide Heading",
          description: "Enter your compelling slide subtitle or feature description here.",
          bgImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=80",
          bgColor: "#0f172a",
          buttonText: "Explore Now",
          buttonUrl: "#"
        })}
        getItemHeaderLabel={(item, idx) => item.title || `Slide #${idx + 1}`}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Title</label>
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateItem({ title: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Description</label>
              <textarea
                rows={2}
                value={item.description || ""}
                onChange={(e) => updateItem({ description: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Background Image</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={item.bgImage || ""}
                  onChange={(e) => updateItem({ bgImage: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => triggerImagePicker((url) => updateItem({ bgImage: url }))}
                  className="shrink-0 flex items-center gap-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 text-[10px] font-bold cursor-pointer transition active:scale-95"
                >
                  <span>📁 Select Image</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Button Text</label>
                <input
                  type="text"
                  value={item.buttonText || ""}
                  onChange={(e) => updateItem({ buttonText: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Button URL</label>
                <input
                  type="text"
                  value={item.buttonUrl || ""}
                  onChange={(e) => updateItem({ buttonUrl: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}
