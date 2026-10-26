/**
 * TestimonialCarouselWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, TestimonialItem } from "../../types";
import { ImagePickerControl } from "../shared/imagePicker";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// 23. Testimonial Carousel Inspector (F-188)
export function TestimonialCarouselWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const items = el.testimonialItems || [];

  return (
    <div className="space-y-4">
      {/* SECTION 1: ITEMS MANAGEMENT */}
      <UniversalItemManager<TestimonialItem>
        title="Testimonial Items"
        items={items}
        onUpdate={(newItems) => updateProp("testimonialItems", newItems)}
        createDefaultItem={() => ({
          id: "test_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          quote: "Outstanding experience! The results exceeded our expectations.",
          name: "Alex Morgan",
          role: "Creative Director",
          avatarUrl: "",
          rating: 5,
        })}
        getItemHeaderLabel={(item) => item.name || "Testimonial Card"}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Quote Text</label>
              <textarea
                rows={2}
                value={item.quote || ""}
                onChange={(e) => updateItem({ quote: e.target.value })}
                placeholder="Client feedback quote..."
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Customer Name</label>
                <input
                  type="text"
                  value={item.name || ""}
                  onChange={(e) => updateItem({ name: e.target.value })}
                  placeholder="Full Name..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Role / Company</label>
                <input
                  type="text"
                  value={item.role || ""}
                  onChange={(e) => updateItem({ role: e.target.value })}
                  placeholder="Job Title..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Rating (Stars)</label>
                <select
                  value={item.rating ?? 5}
                  onChange={(e) => updateItem({ rating: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                >
                  <option value={5}>5 Stars (★★★★★)</option>
                  <option value={4}>4 Stars (★★★★☆)</option>
                  <option value={3}>3 Stars (★★★☆☆)</option>
                  <option value={2}>2 Stars (★★☆☆☆)</option>
                  <option value={1}>1 Star (★☆☆☆☆)</option>
                </select>
              </div>

              <ImagePickerControl
                label="Avatar Image"
                value={item.avatarUrl || ""}
                onChange={(url) => updateItem({ avatarUrl: url })}
              />
            </div>
          </div>
        )}
      />

      {/* SECTION 2: CAROUSEL LAYOUT & PLAYBACK */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Carousel Controls & Layout
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Slides Per View
            </label>
            <select
              value={el.testimonialSlidesPerView || 2}
              onChange={(e) => updateProp("testimonialSlidesPerView", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
            >
              <option value={1}>1 Testimonial</option>
              <option value={2}>2 Testimonials</option>
              <option value={3}>3 Testimonials</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Card Spacing (px)
            </label>
            <input
              type="number"
              min={0}
              max={40}
              value={el.testimonialGap ?? 20}
              onChange={(e) => updateProp("testimonialGap", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Autoplay
            </label>
            <input
              type="checkbox"
              checked={el.testimonialAutoplay !== false}
              onChange={(e) => updateProp("testimonialAutoplay", e.target.checked)}
              className="accent-emerald-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Infinite Loop
            </label>
            <input
              type="checkbox"
              checked={el.testimonialLoop !== false}
              onChange={(e) => updateProp("testimonialLoop", e.target.checked)}
              className="accent-emerald-600 rounded cursor-pointer"
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
              checked={el.testimonialShowNav !== false}
              onChange={(e) => updateProp("testimonialShowNav", e.target.checked)}
              className="accent-emerald-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Pagination Dots
            </label>
            <input
              type="checkbox"
              checked={el.testimonialShowDots !== false}
              onChange={(e) => updateProp("testimonialShowDots", e.target.checked)}
              className="accent-emerald-600 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: STYLING & COLORS */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Styling & Colors
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Card Background
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={el.testimonialCardBg || "#ffffff"}
                onChange={(e) => updateProp("testimonialCardBg", e.target.value)}
                className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
              />
              <input
                type="text"
                value={el.testimonialCardBg || "#ffffff"}
                onChange={(e) => updateProp("testimonialCardBg", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Border Radius
            </label>
            <select
              value={el.testimonialCardBorderRadius || "16px"}
              onChange={(e) => updateProp("testimonialCardBorderRadius", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
            >
              <option value="0px">Square (0px)</option>
              <option value="8px">Rounded Small (8px)</option>
              <option value="16px">Rounded Large (16px)</option>
              <option value="24px">Extra Curved (24px)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Star Rating Color
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={el.testimonialStarColor || "#f59e0b"}
                onChange={(e) => updateProp("testimonialStarColor", e.target.value)}
                className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
              />
              <input
                type="text"
                value={el.testimonialStarColor || "#f59e0b"}
                onChange={(e) => updateProp("testimonialStarColor", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Text Color
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={el.testimonialTextColor || "#1e293b"}
                onChange={(e) => updateProp("testimonialTextColor", e.target.value)}
                className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
              />
              <input
                type="text"
                value={el.testimonialTextColor || "#1e293b"}
                onChange={(e) => updateProp("testimonialTextColor", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
