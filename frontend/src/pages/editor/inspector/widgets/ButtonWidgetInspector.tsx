/**
 * ButtonWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import { getLinkedPageStatus, resolveButtonHref, getCurrentResolvedPageUrl } from "../../widgets/renderers";
import type { EditorElement, PageConfig, SiteProduct } from "../../types";
import { UniversalIconControls } from "../shared/UniversalIconControls";

// 14. Button Widget Inspector
export function ButtonWidgetInspector({
  el,
  updateProp,
  updateStyle,
  pages,
  activePageId,
  onCreatePage,
  siteProducts,
  onOpenIconPicker,
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
  updateStyle?: (key: string, val: any) => void;
  pages?: PageConfig[];
  activePageId?: string;
  onCreatePage?: (customName?: string) => PageConfig;
  siteProducts?: SiteProduct[];
  onOpenIconPicker?: () => void;
}) {
  const currentButtonColor = el.styles?.backgroundColor || el.buttonBg || "#2563eb";
  const currentContainerBg = el.containerBg || "transparent";
  const currentTextColor = el.styles?.color || el.buttonColor || "#ffffff";

  // Destination mode inference
  const activeDest = el.destinationType || el.linkType || (el.pageId ? "page" : "url");

  // Linked Page Status
  const pageStatus = getLinkedPageStatus(el, pages);
  const resolvedHref = resolveButtonHref(el, pages);

  // Independent Button Color (Button Fill) ONLY
  const handleButtonColorChange = (color: string) => {
    updateProp("buttonBg", color);
    if (updateStyle) {
      updateStyle("backgroundColor", color);
    }
  };

  // Independent Container Background Color ONLY
  const handleContainerBgChange = (bg: string) => {
    updateProp("containerBg", bg);
  };

  // Independent Text Color ONLY
  const handleTextColorChange = (text: string) => {
    updateProp("buttonColor", text);
    if (updateStyle) {
      updateStyle("color", text);
    }
  };

  // Preset helper
  const applyPreset = (buttonColor: string, textColor: string) => {
    handleButtonColorChange(buttonColor);
    handleTextColorChange(textColor);
  };

  return (
    <div className="space-y-4 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
        <span>🔘</span> Button Configuration
      </h3>

      {/* Button Label */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Button Label</label>
        <input
          type="text"
          value={el.content || el.buttonText || ""}
          onChange={(e) => {
            updateProp("content", e.target.value);
            updateProp("buttonText", e.target.value);
          }}
          placeholder="Click Me"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
        />
      </div>

      {/* Universal Icon Controls */}
      <UniversalIconControls
        el={el}
        updateProp={updateProp}
        updateStyle={updateStyle}
        onOpenIconPicker={onOpenIconPicker}
        showContainerControls={false}
      />

      {/* Link / Navigation Controls */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <span>🔗</span> Destination Link
          </label>
          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]" title={resolvedHref}>
            {resolvedHref}
          </span>
        </div>

        {/* Link Type Selector */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
            Link Destination Type
          </label>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => {
                const defaultPage = pages?.find((p) => p.isHome || p.id === "home") || pages?.[0];
                updateProp("destinationType", "page");
                updateProp("linkType", "page");
                if (defaultPage) {
                  updateProp("pageId", defaultPage.id);
                  updateProp("href", defaultPage.slug);
                  updateProp("linkUrl", defaultPage.slug);
                }
              }}
              className={`rounded py-1 px-2 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                activeDest === "page"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>📄</span> Internal Page
            </button>
            <button
              type="button"
              onClick={() => {
                updateProp("destinationType", "url");
                updateProp("linkType", "url");
              }}
              className={`rounded py-1 px-2 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                activeDest === "url"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>🌐</span> Custom URL
            </button>
          </div>
        </div>

        {/* INTERNAL PAGE MODE */}
        {activeDest === "page" && (
          <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-blue-900 uppercase">Target Page</label>
              {onCreatePage && (
                <button
                  type="button"
                  onClick={() => {
                    const created = onCreatePage();
                    updateProp("pageId", created.id);
                    updateProp("href", created.slug);
                    updateProp("linkUrl", created.slug);
                  }}
                  className="text-[10px] font-extrabold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  + Create New Page
                </button>
              )}
            </div>

            <select
              value={el.pageId || ""}
              onChange={(e) => {
                const selectedP = pages?.find((p) => p.id === e.target.value);
                updateProp("pageId", e.target.value);
                updateProp("destinationType", "page");
                updateProp("linkType", "page");
                if (selectedP) {
                  updateProp("href", selectedP.slug);
                  updateProp("linkUrl", selectedP.slug);
                }
              }}
              className="w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="">-- Select Project Page --</option>
              {(pages || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.slug}){p.isHome ? " [Home]" : ""}
                </option>
              ))}
            </select>

            {/* Warning Alert if referenced page was deleted */}
            {el.pageId && !pageStatus.pageExists && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] font-medium text-amber-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <span>⚠️</span> Linked page no longer exists
                </div>
                <p className="text-[10px] leading-tight text-amber-700">
                  The referenced page has been deleted. Please select another available page or switch to a custom URL.
                </p>
              </div>
            )}

            {pageStatus.pageExists && pageStatus.pageName && (
              <div className="flex items-center justify-between text-[10px] text-blue-700 bg-blue-100/60 px-2 py-1 rounded font-medium">
                <span>Route: <strong className="font-mono">{resolvedHref}</strong></span>
                <span className="text-[9px] bg-blue-200 px-1.5 py-0.5 rounded font-bold uppercase">Dynamic</span>
              </div>
            )}
          </div>
        )}

        {/* CUSTOM URL MODE */}
        {activeDest === "url" && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Custom Link URL</label>
              <button
                type="button"
                onClick={() => {
                  const currPage = getCurrentResolvedPageUrl(pages, activePageId);
                  updateProp("href", currPage);
                  updateProp("linkUrl", currPage);
                }}
                className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Use Current Page
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={el.href || el.linkUrl || ""}
                onChange={(e) => {
                  updateProp("href", e.target.value);
                  updateProp("linkUrl", e.target.value);
                }}
                placeholder="https://example.com or /about or #section"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              />
              {(el.href || el.linkUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    updateProp("href", "");
                    updateProp("linkUrl", "");
                  }}
                  title="Clear URL"
                  className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="text-[10px] text-slate-400">
              Enter absolute URL (<code className="font-mono">https://...</code>), relative path (<code className="font-mono">/about</code>), anchor (<code className="font-mono">#contact</code>), or action (<code className="font-mono">popup:open(id)</code>).
            </div>
          </div>
        )}

        {/* Target & Link Attributes */}
        <div className="pt-2 border-t border-slate-200/60 space-y-2">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={el.target === "_blank"}
              onChange={(e) => updateProp("target", e.target.checked ? "_blank" : "_self")}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Open link in new tab (<code className="text-[10px] font-mono text-slate-500">target="_blank"</code>)</span>
          </label>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase tracking-wider">
                Rel Attributes
              </label>
              <input
                type="text"
                value={el.rel || ""}
                onChange={(e) => updateProp("rel", e.target.value)}
                placeholder="noopener noreferrer"
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase tracking-wider">
                Icon Position
              </label>
              <select
                value={el.iconPosition || "left"}
                onChange={(e) => updateProp("iconPosition", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="left">Left of Text</option>
                <option value="right">Right of Text</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={Boolean(el.download)}
              onChange={(e) => updateProp("download", e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Trigger file download (<code className="text-[10px] font-mono text-slate-500">download</code> attribute)</span>
          </label>
        </div>
      </div>

      {/* Independent Manual Color Controls */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <label className="block text-xs font-bold text-slate-700">Button & Background Colors</label>
        
        <div className="grid grid-cols-2 gap-2">
          {/* Button Color ONLY */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
              Button Fill Color
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={currentButtonColor.startsWith("#") ? currentButtonColor : "#2563eb"}
                onChange={(e) => handleButtonColorChange(e.target.value)}
                className="h-7 w-7 rounded border border-slate-300 cursor-pointer p-0 bg-transparent shrink-0"
              />
              <input
                type="text"
                value={currentButtonColor}
                onChange={(e) => handleButtonColorChange(e.target.value)}
                placeholder="#2563eb"
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Background Color ONLY */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
              Container Bg
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={currentContainerBg.startsWith("#") ? currentContainerBg : "#ffffff"}
                onChange={(e) => handleContainerBgChange(e.target.value)}
                className="h-7 w-7 rounded border border-slate-300 cursor-pointer p-0 bg-transparent shrink-0"
              />
              <input
                type="text"
                value={currentContainerBg}
                onChange={(e) => handleContainerBgChange(e.target.value)}
                placeholder="transparent"
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Text Color */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
            Text Color
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={currentTextColor.startsWith("#") ? currentTextColor : "#ffffff"}
              onChange={(e) => handleTextColorChange(e.target.value)}
              className="h-7 w-7 rounded border border-slate-300 cursor-pointer p-0 bg-transparent shrink-0"
            />
            <input
              type="text"
              value={currentTextColor}
              onChange={(e) => handleTextColorChange(e.target.value)}
              placeholder="#ffffff"
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Color Presets */}
        <div className="pt-1">
          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Color Presets</label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => applyPreset("#2563eb", "#ffffff")}
              className="py-1 px-2 rounded-lg bg-blue-600 text-white text-[10px] font-bold shadow-xs hover:opacity-90 transition cursor-pointer"
            >
              Primary Blue
            </button>
            <button
              type="button"
              onClick={() => applyPreset("#0f172a", "#ffffff")}
              className="py-1 px-2 rounded-lg bg-slate-900 text-white text-[10px] font-bold shadow-xs hover:opacity-90 transition cursor-pointer"
            >
              Dark Slate
            </button>
            <button
              type="button"
              onClick={() => applyPreset("#059669", "#ffffff")}
              className="py-1 px-2 rounded-lg bg-emerald-600 text-white text-[10px] font-bold shadow-xs hover:opacity-90 transition cursor-pointer"
            >
              Emerald Green
            </button>
            <button
              type="button"
              onClick={() => applyPreset("#d97706", "#ffffff")}
              className="py-1 px-2 rounded-lg bg-amber-600 text-white text-[10px] font-bold shadow-xs hover:opacity-90 transition cursor-pointer"
            >
              Sunset Amber
            </button>
            <button
              type="button"
              onClick={() => applyPreset("#dc2626", "#ffffff")}
              className="py-1 px-2 rounded-lg bg-red-600 text-white text-[10px] font-bold shadow-xs hover:opacity-90 transition cursor-pointer"
            >
              Crimson Red
            </button>
            <button
              type="button"
              onClick={() => applyPreset("#7c3aed", "#ffffff")}
              className="py-1 px-2 rounded-lg bg-purple-600 text-white text-[10px] font-bold shadow-xs hover:opacity-90 transition cursor-pointer"
            >
              Royal Violet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
