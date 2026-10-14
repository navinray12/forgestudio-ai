import { FontRegistry } from './FontRegistry';

export function getCleanFontName(fontFamily: string): string {
  if (!fontFamily) return '';
  return fontFamily.split(',')[0].replace(/["']/g, '').trim();
}

/**
 * Traverses an element AST tree to collect all active font families used across all devices and states.
 */
export function collectFontsFromElements(elements: unknown[]): Set<string> {
  const fonts = new Set<string>();

  function checkStyleObject(value: unknown) {
    if (typeof value !== 'object' || value === null || !('fontFamily' in value)) return;
    if (typeof value.fontFamily !== 'string') return;
    const cleanName = getCleanFontName(value.fontFamily);
    if (cleanName && !['inherit', 'sans-serif', 'serif', 'monospace', 'system-ui'].includes(cleanName)) {
      fonts.add(cleanName);
    }
  }

  function traverse(node: unknown) {
    if (typeof node !== 'object' || node === null) return;
    if (Array.isArray(node)) {
      node.forEach(traverse);
      return;
    }
    const element = node as Record<string, unknown>;
    for (const styleKey of ['style', 'styles', 'desktopStyle', 'tabletStyle', 'mobileStyle', 'hoverStyle']) {
      checkStyleObject(element[styleKey]);
    }
    if (Array.isArray(element.children)) element.children.forEach(traverse);
    if (Array.isArray(element.items)) element.items.forEach(traverse);
  }

  if (Array.isArray(elements)) elements.forEach(traverse);
  return fonts;
}

/**
 * Builds an optimized Google Fonts CSS URL for a set of font family names.
 */
export function buildGoogleFontsUrl(fontFamilies: Set<string> | string[]): string | null {
  const families = Array.from(fontFamilies).filter(fontName => {
    const fontMeta = FontRegistry.getFontMetadata(fontName);
    return fontMeta && fontMeta.source === 'google';
  });

  if (families.length === 0) return null;

  const familyQueries = families.map(fontName => {
    const fontMeta = FontRegistry.getFontMetadata(fontName);
    const weights = fontMeta?.weights || [400, 700];
    const hasItalic = fontMeta?.hasItalic;

    const formattedName = fontName.replace(/\s+/g, '+');

    if (hasItalic) {
      const pairs: string[] = [];
      weights.forEach(w => pairs.push(`0,${w}`));
      weights.forEach(w => pairs.push(`1,${w}`));
      return `family=${formattedName}:ital,wght@${pairs.join(';')}`;
    } else {
      return `family=${formattedName}:wght@${weights.join(';')}`;
    }
  });

  return `https://fonts.googleapis.com/css2?${familyQueries.join('&')}&display=swap`;
}

/**
 * Injects or updates a dynamic <link> stylesheet in the DOM document head for active fonts.
 */
export function syncDocumentFonts(elements: unknown[]): void {
  const usedFonts = collectFontsFromElements(elements);
  const cssUrl = buildGoogleFontsUrl(usedFonts);

  const existingLink = document.getElementById('forgestudio-dynamic-fonts') as HTMLLinkElement | null;

  if (!cssUrl) {
    if (existingLink) {
      existingLink.remove();
    }
    return;
  }

  if (existingLink) {
    if (existingLink.href !== cssUrl) {
      existingLink.href = cssUrl;
    }
  } else {
    const link = document.createElement('link');
    link.id = 'forgestudio-dynamic-fonts';
    link.rel = 'stylesheet';
    link.href = cssUrl;
    document.head.appendChild(link);
  }
}
