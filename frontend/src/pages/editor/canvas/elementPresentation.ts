import type { EditorElement } from "../types";

/**
 * renderElementTree's custom-attribute props, moved verbatim: the element's custom attributes with a
 * non-blank name, as { trimmedName: value or "" } (later entries with the same name win).
 */
export function resolveCustomAttrProps(el: EditorElement): any {
  const customAttrs = Array.isArray(el.customAttributes) ? el.customAttributes : [];
  const customAttrProps = customAttrs.reduce((acc, curr) => {
    if (curr.name && curr.name.trim()) acc[curr.name.trim()] = curr.value || "";
    return acc;
  }, {} as any);
  return customAttrProps;
}
