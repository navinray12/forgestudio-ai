/**
 * LoopCarouselWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, LoopCarouselItem } from "../../types";
import { ImagePickerControl } from "../shared/imagePicker";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// 24. Loop Carousel Inspector (F-190)
export function LoopCarouselWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const items = el.loopCarouselItems || [];

  return (
    <div className="space-y-4">
      {/* SECTION 1: ITEMS MANAGEMENT */}
      <UniversalItemManager<LoopCarouselItem>
        title="Loop Carousel Cards"
        items={items}
        onUpdate={(newItems) => updateProp("loopCarouselItems", newItems)}
        createDefaultItem={() => ({
          id: "item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          title: `New Card Item #${items.length + 1}`,
          description: "Add details for this loop carousel slide.",
          badge: "FEATURE",
          buttonText: "Learn More",
          linkUrl: "#",
        })}
        getItemHeaderLabel={(item) => item.title || "Card Slide"}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Title</label>
                <input
                  type="text"
                  value={item.title || ""}
                  onChange={(e) => updateItem({ title: e.target.value })}
                  placeholder="Card title..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Badge / Tag</label>
                <input
                  type="text"
                  value={item.badge || ""}
                  onChange={(e) => updateItem({ badge: e.target.value })}
                  placeholder="e.g. NEW, PRO"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Description</label>
              <textarea
                rows={2}
                value={item.description || ""}
                onChange={(e) => updateItem({ description: e.target.value })}
                placeholder="Card details..."
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
              />
            </div>

            <div>
              <ImagePickerControl
                label="Card Image"
                value={item.imageUrl || ""}
                onChange={(url) => updateItem({ imageUrl: url })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Button Label</label>
                <input
                  type="text"
                  value={item.buttonText || ""}
                  onChange={(e) => updateItem({ buttonText: e.target.value })}
                  placeholder="Learn More..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Link URL</label>
                <input
                  type="text"
                  value={item.linkUrl || "#"}
                  onChange={(e) => updateItem({ linkUrl: e.target.value })}
                  placeholder="#"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                />
              </div>
            </div>
          </div>
        )}
      />

      {/* SECTION 2: CONTROLS & LAYOUT */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Carousel Controls & Layout
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Transition Effect
            </label>
            <select
              value={el.loopCarouselTransition || "slide"}
              onChange={(e) => updateProp("loopCarouselTransition", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
            >
              <option value="slide">Slide Track</option>
              <option value="fade">Cross Fade</option>
              <option value="continuous">Continuous Ticker</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Slides Per View
            </label>
            <select
              value={el.loopCarouselSlidesPerView || 3}
              onChange={(e) => updateProp("loopCarouselSlidesPerView", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
            >
              <option value={1}>1 Slide</option>
              <option value={2}>2 Slides</option>
              <option value={3}>3 Slides</option>
              <option value={4}>4 Slides</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Card Gap (px)
            </label>
            <input
              type="number"
              value={el.loopCarouselGap ?? 20}
              onChange={(e) => updateProp("loopCarouselGap", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Autoplay Speed (ms)
            </label>
            <input
              type="number"
              step={500}
              min={1000}
              value={el.loopCarouselAutoplaySpeed || 3500}
              onChange={(e) => updateProp("loopCarouselAutoplaySpeed", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Card Background
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={el.loopCarouselCardBg || "#ffffff"}
                onChange={(e) => updateProp("loopCarouselCardBg", e.target.value)}
                className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
              />
              <input
                type="text"
                value={el.loopCarouselCardBg || "#ffffff"}
                onChange={(e) => updateProp("loopCarouselCardBg", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Border Radius
            </label>
            <select
              value={el.loopCarouselBorderRadius || "16px"}
              onChange={(e) => updateProp("loopCarouselBorderRadius", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
            >
              <option value="0px">Square (0px)</option>
              <option value="8px">Rounded (8px)</option>
              <option value="16px">Large (16px)</option>
              <option value="24px">X-Large (24px)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Autoplay
            </label>
            <input
              type="checkbox"
              checked={el.loopCarouselAutoplay !== false}
              onChange={(e) => updateProp("loopCarouselAutoplay", e.target.checked)}
              className="accent-purple-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Infinite Loop
            </label>
            <input
              type="checkbox"
              checked={el.loopCarouselLoop !== false}
              onChange={(e) => updateProp("loopCarouselLoop", e.target.checked)}
              className="accent-purple-600 rounded cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Nav Arrows
            </label>
            <input
              type="checkbox"
              checked={el.loopCarouselShowNav !== false}
              onChange={(e) => updateProp("loopCarouselShowNav", e.target.checked)}
              className="accent-purple-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Pagination Dots
            </label>
            <input
              type="checkbox"
              checked={el.loopCarouselShowDots !== false}
              onChange={(e) => updateProp("loopCarouselShowDots", e.target.checked)}
              className="accent-purple-600 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
