import { sanitizeHtml } from "../../../../utils/sanitizeHtml";
import { resolveImageUrl } from "../../utils";
import type { EditorElement } from "../../types";

/** What renderBasicWidgetElements reads: renderElementTree's per-element values, then the editor values it closed over. */
export interface BasicWidgetElementsContext {
  el: EditorElement;
  apiUrl: any;
  isPreview: boolean;
}

/**
 * Canvas renderers: Link in bio, image / icon boxes, icon list, counter, progress bar, rating, alert, map, divider, spacer, HTML and shortcode.
 * Moved verbatim from renderElementTree's leaf wrapper in WebsiteEditor.tsx (the element-renderer
 * slots for link-in-bio, image-box, icon-box, icon-list, counter, progress-bar, rating, alert, google-maps, divider, spacer, html, shortcode). A plain function, called in one slot of the wrapper during
 * the editor's render: it returns a fragment of the original slot expressions in their original order,
 * of which only the slot for el.type renders.
 */
export function renderBasicWidgetElements({
  el,
  apiUrl,
  isPreview,
}: BasicWidgetElementsContext) {
  return (
    <>
        {el.type === "link-in-bio" && (() => {
          const links = el.bioLinks || [
            { id: "b1", label: "My Portfolio", url: "https://example.com", icon: "🌐", badge: "New" },
            { id: "b2", label: "Subscribe to Newsletter", url: "#", icon: "📩" }
          ];
          return (
            <div className="w-full max-w-sm mx-auto p-6 rounded-2xl bg-white shadow-xl border border-slate-100 text-center space-y-4">
              {el.bioAvatarUrl ? (
                <img src={resolveImageUrl(el.bioAvatarUrl, apiUrl)} alt="Bio Avatar" className="w-20 h-20 rounded-full mx-auto object-cover ring-4 ring-pink-100 shadow-md" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center text-2xl font-bold mx-auto shadow-md ring-4 ring-pink-100">
                  {(el.bioName || "@user").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="font-bold text-base text-slate-900">{el.bioName || "@username"}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{el.bioTagline || "Digital Creator & Designer"}</p>
              </div>
              <div className="space-y-2.5 pt-2">
                {links.map((link: any) => (
                  <a
                    key={link.id}
                    href={link.url || "#"}
                    onClick={(e) => { if (!isPreview) e.preventDefault(); }}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 hover:bg-pink-50 border border-slate-200/80 hover:border-pink-200 text-xs font-semibold text-slate-700 hover:text-pink-600 transition shadow-xs group"
                  >
                    <span className="flex items-center gap-2">
                      <span>{link.icon || "🔗"}</span>
                      <span>{link.label}</span>
                    </span>
                    {link.badge && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-pink-100 text-pink-700">
                        {link.badge}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          );
        })()}

        {el.type === "image-box" && (() => {
          const pos = el.imageBoxPosition || "top";
          const isRow = pos === "left" || pos === "right";
          const isReverse = pos === "right";
          return (
            <div className={`w-full flex ${isRow ? "flex-row" : "flex-col"} ${isReverse ? "flex-row-reverse" : ""} items-center gap-4 p-4 rounded-xl border border-slate-100 bg-white shadow-xs group hover:shadow-md transition`}>
              {el.src ? (
                <img src={resolveImageUrl(el.src, apiUrl)} alt={el.title || "Image Box"} className={`${isRow ? "w-1/3" : "w-full"} h-44 object-cover rounded-lg group-hover:scale-102 transition duration-300`} />
              ) : (
                <div className={`${isRow ? "w-1/3" : "w-full"} h-36 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs font-medium`}>
                  🖼️ Image Box
                </div>
              )}
              <div className="flex-1 text-left space-y-1">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">{el.title || "Image Box Feature"}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{el.content || "Detailed description of the feature or highlight box element."}</p>
                {el.href && (
                  <a href={el.href} onClick={(e) => { if (!isPreview) e.preventDefault(); }} className="inline-block pt-1 text-xs font-bold text-blue-600 hover:underline">
                    Learn More →
                  </a>
                )}
              </div>
            </div>
          );
        })()}

        {el.type === "icon-box" && (() => {
          const pos = el.iconBoxPosition || "top";
          const isRow = pos === "left" || pos === "right";
          const isReverse = pos === "right";
          return (
            <div className={`w-full flex ${isRow ? "flex-row" : "flex-col"} ${isReverse ? "flex-row-reverse" : ""} items-start gap-3.5 p-5 rounded-xl border border-slate-100 bg-white shadow-xs group hover:shadow-md transition`}>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                {el.iconName || el.icon || "⚡"}
              </div>
              <div className="space-y-1 text-left">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition">{el.title || "Icon Box Heading"}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{el.content || "Brief explanatory text about this service, capability, or key benefit."}</p>
              </div>
            </div>
          );
        })()}

        {el.type === "icon-list" && (() => {
          const items = el.iconListItems || [
            { id: "1", text: "High priority SLA support", icon: "✓", color: "#10b981" },
            { id: "2", text: "Unlimited custom domains", icon: "✓", color: "#10b981" },
            { id: "3", text: "Advanced analytics dashboard", icon: "✓", color: "#10b981" }
          ];
          return (
            <div className="w-full space-y-2 text-left">
              {items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {item.icon || "✓"}
                  </span>
                  {item.url ? (
                    <a href={item.url} onClick={(e) => { if (!isPreview) e.preventDefault(); }} className="hover:text-emerald-600 hover:underline">
                      {item.text}
                    </a>
                  ) : (
                    <span>{item.text}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {el.type === "counter" && (
          <div className="w-full p-5 rounded-xl bg-white border border-slate-100 text-center shadow-xs">
            <div className="text-3xl font-extrabold text-blue-600 tracking-tight font-mono">
              <span>{el.counterPrefix || ""}</span>
              <span>{el.counterEnd ?? 100}</span>
              <span>{el.counterSuffix || "+"}</span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-1 uppercase tracking-wider">{el.counterTitle || "Happy Customers"}</p>
          </div>
        )}

        {el.type === "progress-bar" && (
          <div className="w-full space-y-1.5 text-left">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>{el.progressLabel || "Skill Level"}</span>
              <span className="font-mono text-teal-600">{el.progressValue ?? 85}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full overflow-hidden" style={{ height: `${el.progressHeight || 12}px` }}>
              <div
                className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-1000"
                style={{ width: `${el.progressValue ?? 85}%` }}
              />
            </div>
          </div>
        )}

        {el.type === "rating" && (() => {
          const max = el.ratingMax || 5;
          const score = el.ratingValue ?? 4.8;
          const stars = Array.from({ length: max }, (_, i) => i + 1);
          return (
            <div className="w-full flex items-center gap-2">
              <div className="flex items-center gap-1">
                {stars.map((s) => (
                  <span key={s} style={{ color: s <= Math.round(score) ? (el.ratingColor || "#f59e0b") : "#cbd5e1" }} className="text-lg">
                    ★
                  </span>
                ))}
              </div>
              {el.ratingShowText !== false && (
                <span className="text-xs font-bold text-slate-700 font-mono">
                  {score} / {max}
                </span>
              )}
            </div>
          );
        })()}

        {el.type === "alert" && (() => {
          const type = el.alertType || "info";
          const bgMap: Record<string, string> = {
            info: "bg-blue-50 border-blue-200 text-blue-900",
            success: "bg-emerald-50 border-emerald-200 text-emerald-900",
            warning: "bg-amber-50 border-amber-200 text-amber-900",
            danger: "bg-rose-50 border-rose-200 text-rose-900"
          };
          const iconMap: Record<string, string> = {
            info: "ℹ️",
            success: "✅",
            warning: "⚠️",
            danger: "🚨"
          };
          return (
            <div className={`w-full p-4 rounded-xl border flex items-start justify-between gap-3 text-left ${bgMap[type] || bgMap.info}`}>
              <div className="flex items-start gap-2.5">
                <span className="text-base leading-none">{iconMap[type]}</span>
                <div className="space-y-0.5">
                  <h5 className="font-bold text-xs">{el.alertTitle || "Notice"}</h5>
                  <p className="text-xs opacity-90">{el.content || "This is an important alert banner message."}</p>
                </div>
              </div>
              {el.alertDismissible && (
                <button type="button" className="text-xs opacity-60 hover:opacity-100 font-bold">✕</button>
              )}
            </div>
          );
        })()}

        {el.type === "google-maps" && (
          <div className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100 relative" style={{ height: `${el.mapHeight || 350}px` }}>
            <iframe
              title="Google Map Location"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              src={`https://maps.google.com/maps?q=${encodeURIComponent(el.mapAddress || "San Francisco, CA")}&t=&z=${el.mapZoom || 14}&ie=UTF8&iwloc=&output=embed`}
            />
          </div>
        )}

        {el.type === "divider" && (
          <div className="w-full flex justify-center my-3">
            <hr
              style={{
                borderTopStyle: (el.dividerStyle as any) || "solid",
                borderTopWidth: `${el.dividerWeight || 2}px`,
                borderTopColor: el.dividerColor || "#cbd5e1",
                width: el.dividerWidth || "100%",
                borderBottom: "none",
                borderLeft: "none",
                borderRight: "none"
              }}
            />
          </div>
        )}

        {el.type === "spacer" && (
          <div
            className="w-full flex items-center justify-center border border-dashed border-slate-300/60 bg-slate-50/40 rounded my-1 text-[10px] text-slate-400 font-mono select-none"
            style={{ height: `${el.spacerHeight || 40}px` }}
          >
            {!isPreview && `Spacer (${el.spacerHeight || 40}px)`}
          </div>
        )}

        {el.type === "html" && (
          <div
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(
                el.content || "<p class='p-4 border border-dashed rounded text-xs text-slate-400 text-center font-mono'>Custom HTML Block</p>"
              ),
            }}
            className="w-full h-full"
          />
        )}

        {el.type === "shortcode" && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded text-xs font-mono text-amber-800 text-center break-all transition">
            {el.content ? `[ ${el.content} ]` : "Enter Shortcode here"}
            <div className="opacity-60 text-[9px] mt-1 uppercase font-bold tracking-wider">Renders Dynamically on Publish</div>
          </div>
        )}
    </>
  );
}
