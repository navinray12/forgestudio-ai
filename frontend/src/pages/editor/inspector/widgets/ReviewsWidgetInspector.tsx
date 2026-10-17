/**
 * ReviewsWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, ReviewItem } from "../../types";
import { triggerImagePicker } from "../shared/imagePicker";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// 8. Reviews / Testimonials Inspector
export function ReviewsWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const reviews = el.reviewItems || el.testimonialItems || [];

  return (
    <div className="space-y-3">
      <UniversalItemManager<ReviewItem>
        title="Customer Reviews"
        items={reviews as ReviewItem[]}
        onUpdate={(newItems) => {
          updateProp("reviewItems", newItems);
          updateProp("testimonialItems", newItems.map(r => ({
            id: r.id,
            quote: r.reviewText,
            name: r.reviewerName,
            role: r.reviewerTitle || "Customer",
            avatarUrl: r.avatarUrl,
            rating: r.rating
          })));
        }}
        createDefaultItem={() => ({
          id: "rev_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          reviewerName: "Alex Morgan",
          reviewerTitle: "Verified Purchaser",
          reviewText: "Outstanding quality! Exceeded all expectations.",
          rating: 5,
          avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80",
          verified: true
        })}
        getItemHeaderLabel={(item) => `${item.reviewerName} (${item.rating}★)`}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Reviewer Name</label>
                <input
                  type="text"
                  value={item.reviewerName}
                  onChange={(e) => updateItem({ reviewerName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Rating (1 to 5 Stars)</label>
                <select
                  value={item.rating}
                  onChange={(e) => updateItem({ rating: parseInt(e.target.value, 10) })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium"
                >
                  <option value={5}>⭐⭐⭐⭐⭐ (5 Stars)</option>
                  <option value={4}>⭐⭐⭐⭐ (4 Stars)</option>
                  <option value={3}>⭐⭐⭐ (3 Stars)</option>
                  <option value={2}>⭐⭐ (2 Stars)</option>
                  <option value={1}>⭐ (1 Star)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Review Copy</label>
              <textarea
                rows={2}
                value={item.reviewText}
                onChange={(e) => updateItem({ reviewText: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Avatar Image URL</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={item.avatarUrl || ""}
                  onChange={(e) => updateItem({ avatarUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => triggerImagePicker((url) => updateItem({ avatarUrl: url }))}
                  className="shrink-0 flex items-center gap-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 text-[10px] font-bold cursor-pointer transition active:scale-95"
                >
                  <span>📁 Select Image</span>
                </button>
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}
