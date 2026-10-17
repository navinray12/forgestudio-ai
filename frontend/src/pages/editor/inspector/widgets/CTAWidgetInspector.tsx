/**
 * CTAWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";
import { ImagePickerControl } from "../shared/imagePicker";

// 21. Call to Action (CTA) Inspector (F-186)
export function CTAWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Layout & Container Styling */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Layout & Container Style
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Content Alignment
            </label>
            <select
              value={el.ctaLayout || "centered"}
              onChange={(e) => updateProp("ctaLayout", e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-rose-500"
            >
              <option value="centered">Centered Stack</option>
              <option value="left-aligned">Left Aligned</option>
              <option value="split">Split Row (Title Left, CTA Right)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Card Border Radius
            </label>
            <select
              value={el.ctaCardBorderRadius || "24px"}
              onChange={(e) => updateProp("ctaCardBorderRadius", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-rose-500"
            >
              <option value="0px">Square (0px)</option>
              <option value="12px">Rounded (12px)</option>
              <option value="24px">Curved Large (24px)</option>
              <option value="36px">Pill / Soft (36px)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Card Background
            </label>
            <input
              type="text"
              value={el.ctaCardBg || "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"}
              onChange={(e) => updateProp("ctaCardBg", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono text-slate-800 outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Text Color
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={el.ctaTextColor || "#ffffff"}
                onChange={(e) => updateProp("ctaTextColor", e.target.value)}
                className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
              />
              <input
                type="text"
                value={el.ctaTextColor || "#ffffff"}
                onChange={(e) => updateProp("ctaTextColor", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Heading & Content */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Heading & Media Content
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Icon / Emoji
            </label>
            <input
              type="text"
              value={el.ctaIcon || "⚡"}
              onChange={(e) => updateProp("ctaIcon", e.target.value)}
              placeholder="⚡, 🚀, 💡..."
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <ImagePickerControl
              label="Optional Image"
              value={el.ctaImage || ""}
              onChange={(url) => updateProp("ctaImage", url)}
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
            Heading
          </label>
          <input
            type="text"
            value={el.ctaHeading !== undefined ? el.ctaHeading : "Boost Your Conversions Today"}
            onChange={(e) => updateProp("ctaHeading", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
            Description
          </label>
          <textarea
            rows={2}
            value={el.ctaDescription !== undefined ? el.ctaDescription : (el.ctaDesc || "Start your 14-day free trial. Cancel anytime.")}
            onChange={(e) => {
              updateProp("ctaDescription", e.target.value);
              updateProp("ctaDesc", e.target.value);
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Button Customization */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Button Customization
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Button Text
            </label>
            <input
              type="text"
              value={el.ctaButtonText !== undefined ? el.ctaButtonText : "Claim Your Free Trial →"}
              onChange={(e) => updateProp("ctaButtonText", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Button Link URL
            </label>
            <input
              type="text"
              value={el.ctaButtonUrl || "#"}
              onChange={(e) => updateProp("ctaButtonUrl", e.target.value)}
              placeholder="#"
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono text-slate-800 outline-none focus:border-rose-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Button Background
            </label>
            <input
              type="text"
              value={el.ctaButtonBg || "linear-gradient(135deg, #e11d48 0%, #be123c 100%)"}
              onChange={(e) => updateProp("ctaButtonBg", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono text-slate-800 outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Button Radius
            </label>
            <select
              value={el.ctaButtonBorderRadius || "12px"}
              onChange={(e) => updateProp("ctaButtonBorderRadius", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-rose-500"
            >
              <option value="0px">Square (0px)</option>
              <option value="8px">Rounded Small (8px)</option>
              <option value="12px">Rounded Medium (12px)</option>
              <option value="9999px">Pill / Capsule</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
            Button Text Color
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={el.ctaButtonTextColor || "#ffffff"}
              onChange={(e) => updateProp("ctaButtonTextColor", e.target.value)}
              className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
            />
            <input
              type="text"
              value={el.ctaButtonTextColor || "#ffffff"}
              onChange={(e) => updateProp("ctaButtonTextColor", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
