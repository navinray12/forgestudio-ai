/**
 * LinkInBioWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";
import { ImagePickerControl } from "../shared/imagePicker";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// --------------------------------------------------
// Additional Scope A, Scope B & Scope C Inspectors
// --------------------------------------------------

// Link in Bio Inspector (F-147)
export function LinkInBioWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const links = el.bioLinks || [
    { id: "bio_1", label: "My Portfolio", url: "https://example.com", icon: "🌐", badge: "New" },
    { id: "bio_2", label: "Subscribe to Newsletter", url: "https://example.com/newsletter", icon: "📩" }
  ];

  return (
    <div className="space-y-4 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-pink-600 flex items-center gap-1.5">
        <span>🔗</span> Link in Bio Settings
      </h3>

      <ImagePickerControl
        label="Avatar Profile Image"
        value={el.bioAvatarUrl || ""}
        onChange={(url) => updateProp("bioAvatarUrl", url)}
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Profile Name</label>
          <input
            type="text"
            value={el.bioName || ""}
            onChange={(e) => updateProp("bioName", e.target.value)}
            placeholder="@username"
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Bio Tagline</label>
          <input
            type="text"
            value={el.bioTagline || ""}
            onChange={(e) => updateProp("bioTagline", e.target.value)}
            placeholder="Digital Creator & Designer"
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium"
          />
        </div>
      </div>

      <UniversalItemManager
        title="Bio Links"
        items={links}
        onUpdate={(newLinks) => updateProp("bioLinks", newLinks)}
        createDefaultItem={() => ({
          id: "bio_" + Date.now(),
          label: "New Link",
          url: "https://example.com",
          icon: "🔗",
          badge: ""
        })}
        getItemHeaderLabel={(item) => item.label || "Untitled Link"}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase">Label</label>
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem({ label: e.target.value })}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase">Icon (Emoji/Text)</label>
                <input
                  type="text"
                  value={item.icon || ""}
                  onChange={(e) => updateItem({ icon: e.target.value })}
                  placeholder="🌐"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-medium"
                />
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase">Target URL</label>
              <input
                type="text"
                value={item.url}
                onChange={(e) => updateItem({ url: e.target.value })}
                placeholder="https://..."
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase">Badge Text (Optional)</label>
              <input
                type="text"
                value={item.badge || ""}
                onChange={(e) => updateItem({ badge: e.target.value })}
                placeholder="Hot / New / Sale"
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-medium"
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}
