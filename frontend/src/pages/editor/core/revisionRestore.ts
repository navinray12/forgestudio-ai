/**
 * Pure parts of WebsiteEditor's handleRestoreRevision (called by the Revision History panel after its
 * restore request), moved from the handler. The handler keeps its state updates, their order, the
 * autosave baseline update, the cleared selection and the message.
 */

/**
 * Deep copies of the restored pieces the handler applies, each only when the inline code applied it:
 * elements when they are an array, page settings when truthy, pages when fullRestoredState.pages is an
 * array, site parts when fullRestoredState.siteParts is truthy; otherwise undefined.
 */
export function restoredRevisionState(restoredElements: unknown, restoredPageSettings?: any, fullRestoredState?: any) {
  return {
    elements: Array.isArray(restoredElements) ? JSON.parse(JSON.stringify(restoredElements)) : undefined,
    pageSettings: restoredPageSettings ? JSON.parse(JSON.stringify(restoredPageSettings)) : undefined,
    pages: fullRestoredState?.pages && Array.isArray(fullRestoredState.pages) ? JSON.parse(JSON.stringify(fullRestoredState.pages)) : undefined,
    siteParts: fullRestoredState?.siteParts ? JSON.parse(JSON.stringify(fullRestoredState.siteParts)) : undefined,
  };
}

/** The editor values a restore falls back to when the restored state does not include them. */
export interface RevisionBaselineCurrent {
  pages: any;
  homePageId: any;
  siteParts: any;
  globalSettings: any;
  publishing: any;
  deployment: any;
  breakpoints: any;
  popups: any;
  pageCss: any;
}

/** The twelve updateAutosaveBaseline arguments of a restore, in order (restored values, else the current ones). */
export function revisionBaselineArgs(restoredElements: any, restoredPageSettings: any, fullRestoredState: any, current: RevisionBaselineCurrent) {
  const { pages, homePageId, siteParts, globalSettings, publishing, deployment, breakpoints, popups, pageCss } = current;
  return [
    restoredElements,
    restoredPageSettings,
    fullRestoredState?.pages || pages,
    fullRestoredState?.homePageId || homePageId,
    fullRestoredState?.siteParts || siteParts,
    fullRestoredState?.globalSettings || globalSettings,
    fullRestoredState?.globalStyles || globalSettings?.globalStyles,
    publishing,
    deployment,
    fullRestoredState?.breakpoints || breakpoints,
    fullRestoredState?.popups || popups,
    fullRestoredState?.pageCss || pageCss,
  ] as const;
}
