/**
 * GalleryWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, GalleryImageItem } from "../../types";
import { ImagePickerControl } from "../shared/imagePicker";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// 4. Gallery Widget Inspector (F-184)
export function GalleryWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const images = el.galleryImages || el.basicGalleryImages || [];

  return (
    <div className="space-y-4">
      {/* Grid Layout & Aspect Ratio */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Grid & Image Layout
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Grid Columns
            </label>
            <select
              value={el.galleryColumns || el.basicGalleryColumns || 3}
              onChange={(e) => {
                const val = Number(e.target.value);
                updateProp("galleryColumns", val);
                updateProp("basicGalleryColumns", val);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
            >
              <option value={1}>1 Column</option>
              <option value={2}>2 Columns</option>
              <option value={3}>3 Columns</option>
              <option value={4}>4 Columns</option>
              <option value={5}>5 Columns</option>
              <option value={6}>6 Columns</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Image Gap (px)
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={el.galleryGap ?? el.basicGalleryGap ?? 16}
              onChange={(e) => {
                const val = Number(e.target.value);
                updateProp("galleryGap", val);
                updateProp("basicGalleryGap", val);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Aspect Ratio
            </label>
            <select
              value={el.galleryAspectRatio || "square"}
              onChange={(e) => updateProp("galleryAspectRatio", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
            >
              <option value="square">Square (1:1)</option>
              <option value="landscape">Landscape (16:9)</option>
              <option value="portrait">Portrait (3:4)</option>
              <option value="auto">Original / Auto</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Hover Interaction
            </label>
            <select
              value={el.galleryHoverEffect || "zoom"}
              onChange={(e) => updateProp("galleryHoverEffect", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
            >
              <option value="zoom">Zoom Scale</option>
              <option value="lift">Lift & Elevation</option>
              <option value="fade">Subtle Fade</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Corner Radius
            </label>
            <select
              value={el.galleryBorderRadius || "16px"}
              onChange={(e) => updateProp("galleryBorderRadius", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
            >
              <option value="0px">Square (0px)</option>
              <option value="8px">Rounded Small (8px)</option>
              <option value="16px">Rounded Large (16px)</option>
              <option value="24px">Extra Rounded (24px)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Caption Style
            </label>
            <select
              value={el.galleryCaptionPosition || "overlay"}
              onChange={(e) => updateProp("galleryCaptionPosition", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
            >
              <option value="overlay">Overlay on Image</option>
              <option value="below">Below Image</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
          <label className="text-[11px] font-semibold text-slate-700 cursor-pointer">
            Show Image Captions
          </label>
          <input
            type="checkbox"
            checked={el.galleryShowCaptions !== false}
            onChange={(e) => updateProp("galleryShowCaptions", e.target.checked)}
            className="accent-pink-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Gallery Images Manager */}
      <UniversalItemManager<GalleryImageItem>
        title={`Gallery Photos (${images.length})`}
        items={images}
        onUpdate={(newItems) => {
          updateProp("galleryImages", newItems);
          updateProp("basicGalleryImages", newItems);
        }}
        createDefaultItem={() => ({
          id: "gimg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80",
          caption: `Photo ${images.length + 1}`,
          altText: "Gallery Photo",
        })}
        getItemHeaderLabel={(item, idx) => item.caption || `Photo #${idx + 1}`}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2">
            <ImagePickerControl
              label="Photo File / Source URL"
              value={item.url}
              onChange={(url) => updateItem({ url })}
            />
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Caption Text</label>
              <input
                type="text"
                value={item.caption || ""}
                onChange={(e) => updateItem({ caption: e.target.value })}
                placeholder="Optional image caption..."
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alt Text</label>
              <input
                type="text"
                value={item.altText || ""}
                onChange={(e) => updateItem({ altText: e.target.value })}
                placeholder="SEO image alt description..."
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800"
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}
