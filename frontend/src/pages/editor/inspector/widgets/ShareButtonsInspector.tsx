/**
 * ShareButtonsInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import { getCurrentResolvedPageUrl, isSafeShareUrl } from "../../widgets/renderers";
import type { EditorElement, PageConfig, ShareNetworkItem, ShareNetworkType, ShareActionType } from "../../types";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// 6. Share Buttons Inspector
export function ShareButtonsInspector({
  el,
  updateProp,
  pages,
  activePageId,
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
  pages?: PageConfig[];
  activePageId?: string;
}) {
  const networks = el.shareNetworks || [];
  const shareUrlSource = el.shareUrlSource || "current-page";
  const shareUrl = el.shareUrl || "";
  const shareText = el.shareText || "";
  const shareHashtags = el.shareHashtags || "";

  const resolvedPageUrl = getCurrentResolvedPageUrl(pages, activePageId);
  const activePageObj = pages?.find((p) => p.id === activePageId || p.slug === activePageId);
  const activePageName = activePageObj?.name || "Current Page";

  // URL Safety & Validation
  const isValidUrl = isSafeShareUrl(shareUrl);
  const isHttpOrRelative = !shareUrl || shareUrl.startsWith("http://") || shareUrl.startsWith("https://") || shareUrl.startsWith("/") || shareUrl.startsWith("#");

  const handleUseCurrentPage = () => {
    updateProp("shareUrlSource", "current-page");
    updateProp("shareUrl", resolvedPageUrl);
  };

  return (
    <div className="space-y-4">
      {/* 1. DESTINATION URL & METADATA CONFIGURATION */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider">
            🔗 SHARE DESTINATION & URL
          </span>
          {shareUrlSource === "current-page" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
              ⚡ Current Page
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
              🎯 Custom URL
            </span>
          )}
        </div>

        {/* URL Source Radio / Toggle */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
            URL Source Mode
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-white border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => updateProp("shareUrlSource", "current-page")}
              className={`py-1.5 px-2 text-xs font-bold rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                shareUrlSource === "current-page"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>📄 Current Page</span>
            </button>
            <button
              type="button"
              onClick={() => updateProp("shareUrlSource", "custom")}
              className={`py-1.5 px-2 text-xs font-bold rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                shareUrlSource === "custom"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🌐 Custom URL</span>
            </button>
          </div>
        </div>

        {/* Current Page Mode Preview info */}
        {shareUrlSource === "current-page" && (
          <div className="rounded-lg bg-white border border-blue-100 p-2.5 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
              <span>Active Page: <strong className="text-blue-600">{activePageName}</strong></span>
              <span className="text-[10px] font-mono text-slate-400">ID: {activePageId || "home"}</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 truncate bg-slate-50 p-1.5 rounded border border-slate-200/60">
              {resolvedPageUrl}
            </div>
            <p className="text-[10px] text-slate-400">
              Shares automatically update to match whatever page the user is viewing.
            </p>
          </div>
        )}

        {/* Custom URL Input Field */}
        {shareUrlSource === "custom" && (
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[10px] font-semibold text-slate-600">
                  Destination URL
                </label>
                <button
                  type="button"
                  onClick={handleUseCurrentPage}
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                >
                  [ Use Current Page ]
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={shareUrl}
                  onChange={(e) => updateProp("shareUrl", e.target.value)}
                  placeholder="https://example.com/about or /pricing"
                  className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none transition ${
                    !isValidUrl
                      ? "border-red-400 focus:border-red-500 bg-red-50/30"
                      : "border-slate-300 focus:border-blue-500"
                  }`}
                />
                {shareUrl && (
                  <button
                    type="button"
                    onClick={() => updateProp("shareUrl", "")}
                    className="absolute right-2 text-xs text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Clear URL"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* URL Validation helper badges */}
            {!isValidUrl ? (
              <div className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-md p-1.5 flex items-center gap-1">
                <span>⚠️ Unsafe URL protocol (javascript:, data: are blocked).</span>
              </div>
            ) : !isHttpOrRelative && shareUrl.trim() !== "" ? (
              <div className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-1 flex items-center gap-1">
                <span>ℹ️ Note: Consider adding http:// or https:// for external links.</span>
              </div>
            ) : shareUrl.trim() !== "" ? (
              <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 flex items-center justify-between">
                <span>✓ Valid Destination URL</span>
                <span className="font-mono text-[9px] truncate max-w-[150px]">{shareUrl}</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Share Text & Hashtags Fields */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-100">
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
              Share Text / Caption
            </label>
            <input
              type="text"
              value={shareText}
              onChange={(e) => updateProp("shareText", e.target.value)}
              placeholder="Check out this page!"
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
              Hashtags (Comma separated)
            </label>
            <input
              type="text"
              value={shareHashtags}
              onChange={(e) => updateProp("shareHashtags", e.target.value)}
              placeholder="ForgeStudio, WebsiteBuilder"
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 2. LAYOUT & APPEARANCE */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Layout & Appearance
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Layout</label>
            <select
              value={el.shareLayout || "horizontal"}
              onChange={(e) => updateProp("shareLayout", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="horizontal">Horizontal Row</option>
              <option value="vertical">Vertical Column</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Button Style</label>
            <select
              value={el.shareButtonStyle || "brand"}
              onChange={(e) => updateProp("shareButtonStyle", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="brand">Brand Colors</option>
              <option value="solid">Solid Palette</option>
              <option value="outline">Outline Border</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alignment</label>
            <select
              value={el.shareAlignment || "left"}
              onChange={(e) => updateProp("shareAlignment", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Size</label>
            <select
              value={el.shareButtonSize || "md"}
              onChange={(e) => updateProp("shareButtonSize", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Gap (px)</label>
            <input
              type="number"
              min={0}
              max={50}
              value={el.shareGap ?? 10}
              onChange={(e) => updateProp("shareGap", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
          <label className="text-[11px] font-semibold text-slate-700 cursor-pointer">
            Show Button Text Labels
          </label>
          <input
            type="checkbox"
            checked={el.shareShowLabels !== false}
            onChange={(e) => updateProp("shareShowLabels", e.target.checked)}
            className="accent-blue-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* 3. INDIVIDUAL SOCIAL NETWORKS MANAGER */}
      <UniversalItemManager<ShareNetworkItem>
        title={`Social Networks (${networks.length})`}
        items={networks}
        onUpdate={(newItems) => updateProp("shareNetworks", newItems)}
        createDefaultItem={() => ({
          id: "net_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          network: "facebook",
          actionType: "open-url",
          destinationType: "url",
          customUrl: "https://facebook.com",
          target: "_blank",
          label: "Facebook",
          urlSource: "custom"
        })}
        getItemHeaderLabel={(item) => (item.label ? `${item.network} (${item.label})` : item.network)}
        renderItemFields={(item, idx, updateItem) => {
          const isUrlDest = (item.destinationType || "url") === "url";
          const isPageDest = item.destinationType === "page";

          return (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Network</label>
                  <select
                    value={item.network}
                    onChange={(e) => {
                      const net = e.target.value as ShareNetworkType;
                      let defaultAction: ShareActionType = "open-url";
                      if (net === "copy") defaultAction = "copy";
                      else if (net === "email") defaultAction = "email";
                      else if (net === "facebook" || net === "twitter" || net === "linkedin" || net === "whatsapp" || net === "pinterest" || net === "reddit") defaultAction = "share";

                      updateItem({
                        network: net,
                        actionType: item.actionType || defaultAction,
                        label: item.label || (net.charAt(0).toUpperCase() + net.slice(1))
                      });
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="twitter">X / Twitter</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="pinterest">Pinterest</option>
                    <option value="reddit">Reddit</option>
                    <option value="email">Email</option>
                    <option value="copy">Copy Link</option>
                    <option value="custom">Custom Link / Website</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Custom Label</label>
                  <input
                    type="text"
                    value={item.label || ""}
                    onChange={(e) => updateItem({ label: e.target.value })}
                    placeholder="Label..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Action Type & Target */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Action Type</label>
                  <select
                    value={item.actionType || "open-url"}
                    onChange={(e) => updateItem({ actionType: e.target.value as ShareActionType })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="open-url">Open URL / Profile</option>
                    <option value="share">Social Share Popup</option>
                    <option value="copy">Copy Link to Clipboard</option>
                    <option value="email">Send Mail (mailto:)</option>
                    <option value="custom">Custom Action</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Target Window</label>
                  <select
                    value={item.target || "_blank"}
                    onChange={(e) => updateItem({ target: e.target.value as "_blank" | "_self" })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="_blank">New Tab (_blank)</option>
                    <option value="_self">Same Tab (_self)</option>
                  </select>
                </div>
              </div>

              {/* Destination Selector: Page vs External URL */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase">
                    Destination Mode
                  </label>
                  <select
                    value={item.destinationType || "url"}
                    onChange={(e) => updateItem({ destinationType: e.target.value as "url" | "page" })}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                  >
                    <option value="url">External URL / Custom Link</option>
                    <option value="page">Internal Website Page</option>
                  </select>
                </div>

                {isPageDest && (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Select Page
                    </label>
                    <select
                      value={item.pageId || pages?.[0]?.id || ""}
                      onChange={(e) => updateItem({ pageId: e.target.value, destinationType: "page" })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                    >
                      {pages && pages.length > 0 ? (
                        pages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.slug})
                          </option>
                        ))
                      ) : (
                        <option value="">No pages available</option>
                      )}
                    </select>
                  </div>
                )}

                {isUrlDest && (
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="block text-[10px] font-semibold text-slate-500">
                        Button Custom URL
                      </label>
                      <select
                        value={item.urlSource || (item.customUrl ? "custom" : "inherit")}
                        onChange={(e) => {
                          const newSource = e.target.value as "inherit" | "custom";
                          updateItem({
                            urlSource: newSource,
                            customUrl: newSource === "inherit" ? "" : item.customUrl
                          });
                        }}
                        className="text-[10px] font-medium text-slate-500 bg-transparent border-0 underline"
                      >
                        <option value="custom">Custom URL</option>
                        <option value="inherit">Inherit Widget URL</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={item.customUrl || item.buttonUrl || ""}
                      onChange={(e) => updateItem({ customUrl: e.target.value, buttonUrl: e.target.value, urlSource: "custom", destinationType: "url" })}
                      placeholder="https://facebook.com/my-page or /about"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Custom text/hashtags per button */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Custom Share Text</label>
                  <input
                    type="text"
                    value={item.shareText || ""}
                    onChange={(e) => updateItem({ shareText: e.target.value })}
                    placeholder="Override text..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Custom Hashtags</label>
                  <input
                    type="text"
                    value={item.hashtags || ""}
                    onChange={(e) => updateItem({ hashtags: e.target.value })}
                    placeholder="tag1, tag2..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!item.isDisabled}
                    onChange={(e) => updateItem({ isDisabled: !e.target.checked })}
                    className="accent-blue-600 rounded cursor-pointer"
                  />
                  <span>Enable Button</span>
                </label>
                {item.isDisabled && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    Hidden / Disabled
                  </span>
                )}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
