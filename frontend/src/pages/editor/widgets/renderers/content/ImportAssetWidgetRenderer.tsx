/**
 * ImportAssetWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useRef } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

// ==========================================
// IMPORT ASSET WIDGET RENDERER
// ==========================================
export const ImportAssetWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview?: boolean;
  mergedStyles?: ElementStyles | any;
}) => {
  const [assetUrl, setAssetUrl] = useState<string>(el.src || el.href || "");
  const [assetName, setAssetName] = useState<string>(el.content || el.alt || "Uploaded Asset");
  const [assetType, setAssetType] = useState<string>(el.assetType || "image");
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAssetUrl(url);
      setAssetName(file.name);
      el.src = url;
      el.href = url;
      el.content = file.name;

      if (file.type.startsWith("image/")) {
        setAssetType("image");
      } else if (file.type.startsWith("video/")) {
        setAssetType("video");
      } else if (file.type.startsWith("audio/")) {
        setAssetType("audio");
      } else {
        setAssetType("file");
      }
    }
  };

  return (
    <div
      className="w-full relative rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/30 p-6 text-center transition hover:border-blue-500 hover:bg-blue-50/60"
      style={mergedStyles as React.CSSProperties}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      {assetUrl ? (
        <div className="flex flex-col items-center justify-center gap-3">
          {assetType === "image" && (
            <img src={assetUrl} alt={assetName} className="max-h-48 rounded-xl object-contain shadow-md" />
          )}
          {assetType === "video" && (
            <video src={assetUrl} controls className="max-h-48 w-full rounded-xl shadow-md" />
          )}
          {assetType === "audio" && (
            <audio src={assetUrl} controls className="w-full" />
          )}
          {assetType === "file" && (
            <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-slate-200">
              <span className="text-2xl">📄</span>
              <div className="text-left">
                <span className="block text-xs font-bold text-slate-800">{assetName}</span>
                <a href={assetUrl} download className="text-[11px] font-semibold text-blue-600 hover:underline">Download Asset</a>
              </div>
            </div>
          )}

          {!isPreview && isHovered && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition active:scale-95 cursor-pointer"
            >
              <span>📁 Replace Asset</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 cursor-pointer" onClick={() => !isPreview && fileInputRef.current?.click()}>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 text-xl font-bold">
            📁
          </div>
          <h4 className="text-sm font-bold text-slate-800">Import Asset / Upload File</h4>
          <p className="text-xs text-slate-500 max-w-xs">Click to browse or drop images, vectors, videos & document assets here.</p>
        </div>
      )}
    </div>
  );
};
