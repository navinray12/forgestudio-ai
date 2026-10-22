/**
 * BasicGalleryWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, ElementStyles } from "../../../types";

/* F-214: Basic Gallery Renderer */
export const BasicGalleryWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  elStyle?: React.CSSProperties;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const images = el.basicGalleryImages && el.basicGalleryImages.length > 0 ? el.basicGalleryImages : [
    { id: "1", url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80", caption: "Architecture" },
    { id: "2", url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&auto=format&fit=crop&q=80", caption: "Interior" },
    { id: "3", url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80", caption: "Workspace" },
  ];
  const columns = el.basicGalleryColumns || 3;
  const gap = el.basicGalleryGap ?? 12;
  const borderRadius = el.basicGalleryBorderRadius || "12px";

  return (
    <div
      className="w-full grid transition-all"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${gap}px`,
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
      }}
    >
      {images.map((img) => (
        <div key={img.id} className="group relative overflow-hidden bg-slate-100 shadow-xs" style={{ borderRadius }}>
          <img
            src={img.url}
            alt={img.caption || "Gallery item"}
            className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {img.caption && (
            <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 p-2 text-center text-white text-[11px] font-medium backdrop-blur-xs">
              {img.caption}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
