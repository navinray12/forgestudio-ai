/**
 * imagePicker. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import React from "react";

// Programmatically opens the OS File Picker dialog (100% reliable click trigger)
export const triggerImagePicker = (callback: (url: string) => void) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*,application/json,.json";
  input.onchange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    // 1. Attempt server upload first for backend persistence
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        const serverUrl = data.url || data?.data?.url;
        if (serverUrl) {
          callback(serverUrl);
          return;
        }
      }
    } catch {
      // Backend upload endpoint unavailable or offline mode
    }

    // 2. Fallback to instant local Data URL
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        callback(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
};

export const PRESET_SAMPLE_IMAGES = [
  { label: "Modern Office", url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1000&auto=format&fit=crop&q=80" },
  { label: "Creative UX", url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1000&auto=format&fit=crop&q=80" },
  { label: "Minimalist", url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000&auto=format&fit=crop&q=80" },
  { label: "Tech Work", url: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1000&auto=format&fit=crop&q=80" },
  { label: "Nature View", url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1000&auto=format&fit=crop&q=80" },
  { label: "Coffee Shop", url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=1000&auto=format&fit=crop&q=80" }
];

export function ImagePickerControl({
  value,
  onChange,
  label = "Image Source URL"
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [showPresets, setShowPresets] = React.useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700">{label}</label>
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
        >
          {showPresets ? "Hide Presets" : "🖼️ Sample Gallery"}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://images.unsplash.com/... or click select image"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 shadow-xs"
        />
        <button
          type="button"
          onClick={() => triggerImagePicker(onChange)}
          className="shrink-0 flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
        >
          <span>📁 Select Image</span>
        </button>
      </div>

      {showPresets && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-1.5 mt-2 animate-in fade-in zoom-in-95">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Click Sample Image to Apply</p>
          <div className="grid grid-cols-3 gap-1.5">
            {PRESET_SAMPLE_IMAGES.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onChange(img.url);
                  setShowPresets(false);
                }}
                className="group relative rounded-lg overflow-hidden border border-slate-200 aspect-video hover:border-blue-500 transition cursor-pointer"
              >
                <img src={img.url} alt={img.label} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <span className="text-[9px] font-bold text-white px-1 text-center truncate">{img.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
