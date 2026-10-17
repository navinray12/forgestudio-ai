/**
 * VideoPlaylistInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, PlaylistItem } from "../../types";
import { triggerImagePicker } from "../shared/imagePicker";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// 9. Video Playlist Inspector
export function VideoPlaylistInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const items = el.playlistItems || [];

  return (
    <div className="space-y-3">
      <UniversalItemManager<PlaylistItem>
        title="Video Playlist Items"
        items={items}
        onUpdate={(newItems) => updateProp("playlistItems", newItems)}
        createDefaultItem={() => ({
          id: "vid_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          title: "New Playlist Video",
          videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          thumbnailUrl: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=600&q=80",
          duration: "3:45"
        })}
        getItemHeaderLabel={(item) => item.title}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Video Title</label>
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateItem({ title: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Video URL</label>
              <input
                type="text"
                value={item.videoUrl || item.url || ""}
                onChange={(e) => {
                  updateItem({ videoUrl: e.target.value, url: e.target.value });
                }}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Thumbnail URL</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={item.thumbnailUrl || item.thumbnail || ""}
                  onChange={(e) => updateItem({ thumbnailUrl: e.target.value, thumbnail: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => triggerImagePicker((url) => updateItem({ thumbnailUrl: url, thumbnail: url }))}
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
