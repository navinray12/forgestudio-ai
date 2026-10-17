import type { ElementStyles } from "../types";
import { resolveImageUrl } from "../utils";

/**
 * Returns compileBackgroundAndBorderStyles bound to the editor's apiUrl (used to resolve relative
 * background images). The returned function is moved verbatim from WebsiteEditor.tsx.
 */
export const createBackgroundAndBorderStylesCompiler = (apiUrl: string) => {
  const compileBackgroundAndBorderStyles = (mergedStyles: ElementStyles): React.CSSProperties => {
    const styles: React.CSSProperties = {};

    if (mergedStyles.backgroundColor) {
      styles.backgroundColor = mergedStyles.backgroundColor;
    }
    if (mergedStyles.backgroundImage) {
      const bgImg = mergedStyles.backgroundImage.startsWith("url(")
        ? mergedStyles.backgroundImage
        : `url('${resolveImageUrl(mergedStyles.backgroundImage, apiUrl)}')`;
      styles.backgroundImage = bgImg;
    }
    if (mergedStyles.backgroundPosition) {
      styles.backgroundPosition = mergedStyles.backgroundPosition;
    }
    if (mergedStyles.backgroundSize) {
      styles.backgroundSize = mergedStyles.backgroundSize;
    }
    if (mergedStyles.backgroundRepeat) {
      styles.backgroundRepeat = mergedStyles.backgroundRepeat;
    }

    if (mergedStyles.borderStyle && mergedStyles.borderStyle !== "none") {
      styles.borderStyle = mergedStyles.borderStyle;
      styles.borderWidth = mergedStyles.borderWidth || "1px";
      styles.borderColor = mergedStyles.borderColor || "#cbd5e1";
    }

    if (
      mergedStyles.borderTopLeftRadius ||
      mergedStyles.borderTopRightRadius ||
      mergedStyles.borderBottomRightRadius ||
      mergedStyles.borderBottomLeftRadius
    ) {
      styles.borderTopLeftRadius = mergedStyles.borderTopLeftRadius || mergedStyles.borderRadius || "0px";
      styles.borderTopRightRadius = mergedStyles.borderTopRightRadius || mergedStyles.borderRadius || "0px";
      styles.borderBottomRightRadius = mergedStyles.borderBottomRightRadius || mergedStyles.borderRadius || "0px";
      styles.borderBottomLeftRadius = mergedStyles.borderBottomLeftRadius || mergedStyles.borderRadius || "0px";
    } else if (mergedStyles.borderRadius) {
      styles.borderRadius = mergedStyles.borderRadius;
    }

    if (mergedStyles.boxShadow) {
      styles.boxShadow = mergedStyles.boxShadow;
    }

    for (const property of ["background", "border", "borderTop", "borderRight", "borderBottom", "borderLeft"]) {
      if (mergedStyles[property] !== undefined) Object.assign(styles, { [property]: mergedStyles[property] });
    }

    return styles;
  };
  return compileBackgroundAndBorderStyles;
};

/** Moved verbatim from WebsiteEditor.tsx, which imports it from here. */
export const compilePositioningStyles = (mergedStyles: ElementStyles): React.CSSProperties => {
  const styles: React.CSSProperties = {};

  if (mergedStyles.position && mergedStyles.position !== "static") {
    styles.position = mergedStyles.position;
  }

  if (mergedStyles.top !== undefined && mergedStyles.top !== "") {
    styles.top = mergedStyles.top;
  }
  if (mergedStyles.right !== undefined && mergedStyles.right !== "") {
    styles.right = mergedStyles.right;
  }
  if (mergedStyles.bottom !== undefined && mergedStyles.bottom !== "") {
    styles.bottom = mergedStyles.bottom;
  }
  if (mergedStyles.left !== undefined && mergedStyles.left !== "") {
    styles.left = mergedStyles.left;
  }

  if (mergedStyles.zIndex !== undefined && mergedStyles.zIndex !== null && mergedStyles.zIndex !== "") {
    styles.zIndex = Number(mergedStyles.zIndex);
  }

  if (
    mergedStyles.transformRotate ||
    mergedStyles.transformScale ||
    mergedStyles.transformTranslateX ||
    mergedStyles.transformTranslateY
  ) {
    const transforms: string[] = [];
    if (mergedStyles.transformRotate) transforms.push(`rotate(${mergedStyles.transformRotate})`);
    if (mergedStyles.transformScale) transforms.push(`scale(${mergedStyles.transformScale})`);
    if (mergedStyles.transformTranslateX || mergedStyles.transformTranslateY) {
      const tx = mergedStyles.transformTranslateX || "0px";
      const ty = mergedStyles.transformTranslateY || "0px";
      transforms.push(`translate(${tx}, ${ty})`);
    }
    styles.transform = transforms.join(" ");
  }

  if (mergedStyles.opacity !== undefined && mergedStyles.opacity !== null && mergedStyles.opacity !== "") {
    styles.opacity = Number(mergedStyles.opacity);
  }

  if (mergedStyles.overflowX) styles.overflowX = mergedStyles.overflowX as any;
  if (mergedStyles.overflowY) styles.overflowY = mergedStyles.overflowY as any;

  return styles;
};
