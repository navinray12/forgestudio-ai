import type { DeviceMode, EditorElement, ElementState, ElementStyles } from "../types";

/**
 * How the inspector writes one style key of an element: the per-element updater bodies of
 * WebsiteEditor's updateSelectedStyle / resetSelectedStyle, moved verbatim (only re-indented). The
 * handlers still guard on the selection and apply these through setElements(updateTreeElement(...)).
 *
 * normal state: desktop writes styles (and responsiveStyles.desktop when it exists); other devices
 * write responsiveStyles[device]. hover state: the same with hoverStyles / responsiveHoverStyles.
 */
export function applyStyleUpdate(el: EditorElement, key: keyof ElementStyles, value: any, activeElementState: ElementState, activeDevice: DeviceMode): EditorElement {
  if (activeElementState === "hover") {
    if (activeDevice === "desktop") {
      const newHoverStyles = { ...(el.hoverStyles || {}), [key]: value };
      let newResponsiveHover = el.responsiveHoverStyles;
      if (newResponsiveHover?.desktop) {
        newResponsiveHover = {
          ...newResponsiveHover,
          desktop: { ...newResponsiveHover.desktop, [key]: value },
        };
      }
      return { ...el, hoverStyles: newHoverStyles, responsiveHoverStyles: newResponsiveHover };
    } else {
      const currentDeviceObj = el.responsiveHoverStyles?.[activeDevice] || {};
      const updatedDeviceObj = { ...currentDeviceObj, [key]: value };
      return {
        ...el,
        responsiveHoverStyles: {
          ...el.responsiveHoverStyles,
          [activeDevice]: updatedDeviceObj,
        },
      };
    }
  } else {
    if (activeDevice === "desktop") {
      const newStyles = { ...el.styles, [key]: value };
      let newResponsive = el.responsiveStyles;
      if (newResponsive?.desktop) {
        newResponsive = {
          ...newResponsive,
          desktop: { ...newResponsive.desktop, [key]: value },
        };
      }
      return { ...el, styles: newStyles, responsiveStyles: newResponsive };
    } else {
      const currentDeviceObj = el.responsiveStyles?.[activeDevice] || {};
      const updatedDeviceObj = { ...currentDeviceObj, [key]: value };
      return {
        ...el,
        responsiveStyles: {
          ...el.responsiveStyles,
          [activeDevice]: updatedDeviceObj,
        },
      };
    }
  }
}

/**
 * Removes one style key the same way. Desktop drops the key (hoverStyles becomes undefined when empty);
 * other devices drop it from that device's object, removing the device entry when it becomes empty, and
 * return the element itself when the device has no entry.
 */
export function applyStyleReset(el: EditorElement, key: keyof ElementStyles, activeElementState: ElementState, activeDevice: DeviceMode): EditorElement {
  if (activeElementState === "hover") {
    if (activeDevice === "desktop") {
      const newHoverStyles = { ...(el.hoverStyles || {}) };
      delete newHoverStyles[key];
      let newResponsiveHover = el.responsiveHoverStyles;
      if (newResponsiveHover?.desktop) {
        const newDesktopResp = { ...newResponsiveHover.desktop };
        delete newDesktopResp[key];
        newResponsiveHover = { ...newResponsiveHover, desktop: newDesktopResp };
      }
      return {
        ...el,
        hoverStyles: Object.keys(newHoverStyles).length > 0 ? newHoverStyles : undefined,
        responsiveHoverStyles: newResponsiveHover,
      };
    } else {
      if (!el.responsiveHoverStyles?.[activeDevice]) return el;
      const currentDeviceObj = { ...el.responsiveHoverStyles[activeDevice] };
      delete currentDeviceObj[key];
      const newResponsiveHover = {
        ...el.responsiveHoverStyles,
        [activeDevice]: currentDeviceObj,
      };
      if (Object.keys(currentDeviceObj).length === 0) {
        delete newResponsiveHover[activeDevice];
      }
      return { ...el, responsiveHoverStyles: newResponsiveHover };
    }
  } else {
    if (activeDevice === "desktop") {
      const newStyles = { ...el.styles };
      delete newStyles[key];
      let newResponsive = el.responsiveStyles;
      if (newResponsive?.desktop) {
        const newDesktopResp = { ...newResponsive.desktop };
        delete newDesktopResp[key];
        newResponsive = { ...newResponsive, desktop: newDesktopResp };
      }
      return { ...el, styles: newStyles, responsiveStyles: newResponsive };
    } else {
      if (!el.responsiveStyles?.[activeDevice]) return el;
      const currentDeviceObj = { ...el.responsiveStyles[activeDevice] };
      delete currentDeviceObj[key];
      const newResponsive = {
        ...el.responsiveStyles,
        [activeDevice]: currentDeviceObj,
      };
      if (Object.keys(currentDeviceObj).length === 0) {
        delete newResponsive[activeDevice];
      }
      return { ...el, responsiveStyles: newResponsive };
    }
  }
}
