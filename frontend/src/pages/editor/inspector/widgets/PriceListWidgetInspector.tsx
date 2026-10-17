/**
 * PriceListWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, PriceListItem } from "../../types";
import { ImagePickerControl } from "../shared/imagePicker";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// 19. Price List Inspector (F-183)
export function PriceListWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const items = el.priceListItems || [];

  return (
    <div className="space-y-4">
      {/* Layout & Separator Settings */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Layout & Leader Settings
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Item Spacing (Gap)
            </label>
            <input
              type="number"
              min={8}
              max={60}
              value={el.priceListGap ?? 20}
              onChange={(e) => updateProp("priceListGap", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Leader Line Style
            </label>
            <select
              value={el.priceListSeparatorStyle || "dotted"}
              onChange={(e) => updateProp("priceListSeparatorStyle", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-teal-500"
            >
              <option value="dotted">Dotted Leader (...) </option>
              <option value="dashed">Dashed Line (---)</option>
              <option value="solid">Solid Line (___)</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>

        {/* Thumbnail toggle & size */}
        <div className="pt-2 border-t border-slate-200/60 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-700 cursor-pointer">
              Show Media / Thumbnails
            </label>
            <input
              type="checkbox"
              checked={el.priceListShowImages !== false}
              onChange={(e) => updateProp("priceListShowImages", e.target.checked)}
              className="accent-teal-600 rounded cursor-pointer"
            />
          </div>

          {el.priceListShowImages !== false && (
            <div>
              <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-0.5">
                <span>Thumbnail Size</span>
                <span>{el.priceListImageSize || 48}px</span>
              </div>
              <input
                type="range"
                min={32}
                max={96}
                value={el.priceListImageSize || 48}
                onChange={(e) => updateProp("priceListImageSize", Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Colors & Alignment */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
              Title Color
            </label>
            <input
              type="color"
              value={el.priceListTitleColor || "#0f172a"}
              onChange={(e) => updateProp("priceListTitleColor", e.target.value)}
              className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
              Price Color
            </label>
            <input
              type="color"
              value={el.priceListPriceColor || "#2563eb"}
              onChange={(e) => updateProp("priceListPriceColor", e.target.value)}
              className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
              Price Pill Bg
            </label>
            <input
              type="color"
              value={el.priceListPriceBg || "#eff6ff"}
              onChange={(e) => updateProp("priceListPriceBg", e.target.value)}
              className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
            />
          </div>
        </div>
      </div>

      {/* Item Manager */}
      <UniversalItemManager<PriceListItem>
        title={`Services & Menu Items (${items.length})`}
        items={items}
        onUpdate={(newItems) => updateProp("priceListItems", newItems)}
        createDefaultItem={() => ({
          id: "pli_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          name: `New Service Item ${items.length + 1}`,
          title: `New Service Item ${items.length + 1}`,
          price: "$25.00",
          description: "Description of product or service offering.",
          imageUrl: "",
          icon: "✨",
        })}
        getItemHeaderLabel={(item) => `${item.title || item.name} (${item.price})`}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Item Name</label>
                <input
                  type="text"
                  value={item.title || item.name || ""}
                  onChange={(e) => updateItem({ title: e.target.value, name: e.target.value })}
                  placeholder="e.g. Signature Espresso"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Price Display</label>
                <input
                  type="text"
                  value={item.price}
                  onChange={(e) => updateItem({ price: e.target.value })}
                  placeholder="e.g. $4.50 or From $20"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Description</label>
              <textarea
                rows={2}
                value={item.description || ""}
                onChange={(e) => updateItem({ description: e.target.value })}
                placeholder="Item description copy..."
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Icon / Emoji</label>
                <input
                  type="text"
                  value={item.icon || ""}
                  onChange={(e) => updateItem({ icon: e.target.value })}
                  placeholder="e.g. ☕ or ✂️"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Image Position</label>
                <select
                  value={item.imagePos || "left"}
                  onChange={(e) => updateItem({ imagePos: e.target.value as any })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
                >
                  <option value="left">Left Side</option>
                  <option value="right">Right Side</option>
                </select>
              </div>
            </div>

            <ImagePickerControl
              label="Thumbnail Image"
              value={item.imageUrl || ""}
              onChange={(url) => updateItem({ imageUrl: url })}
            />
          </div>
        )}
      />
    </div>
  );
}
