/**
 * VideoWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import React from "react";
import type { EditorElement } from "../../types";

// File upload helper converts file to Data URL
export const handleImageFileUpload = (
  e: React.ChangeEvent<HTMLInputElement>,
  callback: (url: string) => void
) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    if (ev.target?.result) {
      callback(ev.target.result as string);
    }
  };
  reader.readAsDataURL(file);
};

// 3. Single Video Inspector
export function VideoWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
        <span>🎬</span> Video Settings
      </h3>

      {/* Video Source URL */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Video URL (YouTube, Vimeo, MP4)
        </label>
        <input
          type="text"
          value={el.src || ""}
          onChange={(e) => updateProp("src", e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... or https://.../video.mp4"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
        />
      </div>

      {/* Poster Image */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Poster Image URL
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={el.videoPoster || ""}
            onChange={(e) => updateProp("videoPoster", e.target.value)}
            placeholder="https://images.unsplash.com/..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
          />
          <label className="shrink-0 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1.5 text-xs font-bold cursor-pointer transition">
            Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageFileUpload(e, (url) => updateProp("videoPoster", url))}
            />
          </label>
        </div>
      </div>

      {/* Video Options Toggles */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={el.videoAutoplay || false}
            onChange={(e) => updateProp("videoAutoplay", e.target.checked)}
            className="rounded border-slate-300 text-blue-600"
          />
          <span>Autoplay</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={el.videoLoop || false}
            onChange={(e) => updateProp("videoLoop", e.target.checked)}
            className="rounded border-slate-300 text-blue-600"
          />
          <span>Loop</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={el.videoMuted !== false}
            onChange={(e) => updateProp("videoMuted", e.target.checked)}
            className="rounded border-slate-300 text-blue-600"
          />
          <span>Muted</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={el.videoControls !== false}
            onChange={(e) => updateProp("videoControls", e.target.checked)}
            className="rounded border-slate-300 text-blue-600"
          />
          <span>Controls</span>
        </label>
      </div>
    </div>
  );
}
