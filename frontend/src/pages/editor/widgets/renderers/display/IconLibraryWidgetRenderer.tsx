/**
 * IconLibraryWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { IconRenderer } from "../../icons";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-222: Advanced Icon Library Renderer */
export const IconLibraryWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const iconName = el.iconName || el.icon || "Star";
  const iconSize = el.iconSize || 36;
  const iconColor = el.iconColor || mergedStyles.color || "#2563eb";
  const iconBgColor = el.iconBgColor || "transparent";
  const iconBorderRadius = el.iconBorderRadius || "8px";
  const iconPadding = el.iconPadding ?? 8;
  const alignment = el.iconAlignment || "center";
  const rotate = el.iconRotate || 0;
  const flipH = Boolean(el.iconFlipH);
  const flipV = Boolean(el.iconFlipV);
  const strokeWidth = el.iconStrokeWidth || 2;

  const alignClass =
    alignment === "left"
      ? "justify-start"
      : alignment === "right"
      ? "justify-end"
      : "justify-center";

  return (
    <div
      className={`w-full flex ${alignClass} transition-all`}
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
      }}
    >
      <div
        className="inline-flex items-center justify-center transition-transform hover:scale-105"
        style={{
          backgroundColor: iconBgColor,
          borderRadius: iconBorderRadius,
          padding: `${iconPadding}px`,
        }}
      >
        <IconRenderer
          iconName={iconName}
          size={iconSize}
          color={iconColor}
          rotate={rotate}
          flipH={flipH}
          flipV={flipV}
          strokeWidth={strokeWidth}
        />
      </div>
    </div>
  );
};
