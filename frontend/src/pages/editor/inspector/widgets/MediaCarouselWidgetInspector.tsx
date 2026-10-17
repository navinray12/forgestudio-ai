/**
 * MediaCarouselWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, MediaCarouselItem } from "../../types";
import { ImagePickerControl } from "../shared/imagePicker";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// 22. Media Carousel Inspector (F-187)
export function MediaCarouselWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const items = el.mediaCarouselItems || [];

  return (
    <div className="space-y-4">
      {/* SECTION 1: ITEMS MANAGEMENT */}
      <UniversalItemManager<MediaCarouselItem>
        title="Carousel Media Items"
        items={items}
        onUpdate={(newItems) => updateProp("mediaCarouselItems", newItems)}
        createDefaultItem={() => ({
          id: "med_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          type: "image",
          url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
          title: "New Media Slide",
          caption: "Slide caption text...",
          altText: "Media Image",
        })}
        getItemHeaderLabel={(item) => (item.title || (item.type === "video" ? "Video Slide" : "Image Slide"))}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Media Type</label>
                <select
                  value={item.type || "image"}
                  onChange={(e) => updateItem({ type: e.target.value as any })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                >
                  <option value="image">📷 Image</option>
                  <option value="video">🎬 Video</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Title</label>
                <input
                  type="text"
                  value={item.title || ""}
                  onChange={(e) => updateItem({ title: e.target.value })}
                  placeholder="Slide Title..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                />
              </div>
            </div>

            <ImagePickerControl
              label={item.type === "video" ? "Thumbnail / Poster Image" : "Image URL"}
              value={item.url || ""}
              onChange={(url) => updateItem({ url })}
            />

            {item.type === "video" && (
              <div>
                <label className="block text-[10px] font-semibold text-cyan-700 mb-0.5">Video Source URL (YouTube / Vimeo / MP4)</label>
                <input
                  type="text"
                  value={item.videoUrl || ""}
                  onChange={(e) => updateItem({ videoUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-lg border border-cyan-200 bg-cyan-50/50 px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-cyan-500"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Caption</label>
              <input
                type="text"
                value={item.caption || ""}
                onChange={(e) => updateItem({ caption: e.target.value })}
                placeholder="Caption text..."
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
              />
            </div>
          </div>
        )}
      />

      {/* SECTION 2: NAVIGATION & AUTOPLAY */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Playback & Controls
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Autoplay
            </label>
            <input
              type="checkbox"
              checked={el.mediaCarouselAutoplay !== false}
              onChange={(e) => updateProp("mediaCarouselAutoplay", e.target.checked)}
              className="accent-cyan-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Infinite Loop
            </label>
            <input
              type="checkbox"
              checked={el.mediaCarouselLoop !== false}
              onChange={(e) => updateProp("mediaCarouselLoop", e.target.checked)}
              className="accent-cyan-600 rounded cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
            Autoplay Speed (ms)
          </label>
          <input
            type="number"
            min={1000}
            max={10000}
            step={500}
            value={el.mediaCarouselAutoplaySpeed || 3500}
            onChange={(e) => updateProp("mediaCarouselAutoplaySpeed", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Nav Arrows
            </label>
            <input
              type="checkbox"
              checked={el.mediaCarouselShowNav !== false}
              onChange={(e) => updateProp("mediaCarouselShowNav", e.target.checked)}
              className="accent-cyan-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Pagination Dots
            </label>
            <input
              type="checkbox"
              checked={el.mediaCarouselShowDots !== false}
              onChange={(e) => updateProp("mediaCarouselShowDots", e.target.checked)}
              className="accent-cyan-600 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: LAYOUT & SIZING */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Layout & Sizing
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Slides Per View
            </label>
            <select
              value={el.mediaCarouselSlidesPerView || 3}
              onChange={(e) => updateProp("mediaCarouselSlidesPerView", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
            >
              <option value={1}>1 Slide</option>
              <option value={2}>2 Slides</option>
              <option value={3}>3 Slides</option>
              <option value={4}>4 Slides</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Slide Gap (px)
            </label>
            <input
              type="number"
              min={0}
              max={40}
              value={el.mediaCarouselGap ?? 16}
              onChange={(e) => updateProp("mediaCarouselGap", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Aspect Ratio
            </label>
            <select
              value={el.mediaCarouselAspectRatio || "landscape"}
              onChange={(e) => updateProp("mediaCarouselAspectRatio", e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
            >
              <option value="landscape">Landscape (16:9)</option>
              <option value="square">Square (1:1)</option>
              <option value="portrait">Portrait (3:4)</option>
              <option value="video">Ultrawide (21:9)</option>
              <option value="auto">Auto Height</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Border Radius
            </label>
            <select
              value={el.mediaCarouselBorderRadius || "16px"}
              onChange={(e) => updateProp("mediaCarouselBorderRadius", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
            >
              <option value="0px">Square (0px)</option>
              <option value="8px">Rounded Small (8px)</option>
              <option value="16px">Rounded Large (16px)</option>
              <option value="24px">Extra Curved (24px)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
            Media Fit (Object Fit)
          </label>
          <select
            value={el.mediaCarouselImageSizing || "cover"}
            onChange={(e) => updateProp("mediaCarouselImageSizing", e.target.value as any)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
          >
            <option value="cover">Cover (Crop to fill)</option>
            <option value="contain">Contain (Fit inside)</option>
            <option value="fill">Fill (Stretch)</option>
          </select>
        </div>
      </div>

      {/* SECTION 4: STYLING & TRANSITIONS */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Transitions & Styling
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Transition Effect
            </label>
            <select
              value={el.mediaCarouselTransition || "slide"}
              onChange={(e) => updateProp("mediaCarouselTransition", e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
            >
              <option value="slide">Slide</option>
              <option value="fade">Fade</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Transition Speed (ms)
            </label>
            <input
              type="number"
              min={200}
              max={2000}
              step={100}
              value={el.mediaCarouselTransitionSpeed || 500}
              onChange={(e) => updateProp("mediaCarouselTransitionSpeed", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
            Card Background Color
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={el.mediaCarouselCardBg || "#0f172a"}
              onChange={(e) => updateProp("mediaCarouselCardBg", e.target.value)}
              className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
            />
            <input
              type="text"
              value={el.mediaCarouselCardBg || "#0f172a"}
              onChange={(e) => updateProp("mediaCarouselCardBg", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
