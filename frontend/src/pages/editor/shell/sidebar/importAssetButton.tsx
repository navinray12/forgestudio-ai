import React from "react";
import type { ElementType } from "../../types";

/** What renderImportAssetButton reads: the editor values and callbacks the inline JSX used. */
export interface ImportAssetButtonDeps {
  disabledWidgets: ElementType[];
  handleImportAsset: (file: File) => Promise<void>;
  importFileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploading: boolean;
}

/**
 * Left sidebar, Elements tab: the Import Asset / File input and button (F-014).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3510-3533 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderImportAssetButton({
  disabledWidgets,
  handleImportAsset,
  importFileInputRef,
  isUploading,
}: ImportAssetButtonDeps): React.ReactNode {
  return (
                !disabledWidgets.includes("import-asset") && (
                  <>
                    <input
                      ref={importFileInputRef}
                      type="file"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.json,.svg"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleImportAsset(e.target.files[0]);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => importFileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 p-2.5 text-xs font-bold text-blue-700 hover:border-blue-500 hover:bg-blue-100/60 transition disabled:opacity-50 shadow-xs"
                    >
                      <span>📁</span>
                      <span>{isUploading ? "Importing Asset..." : "Import Asset / File"}</span>
                    </button>
                  </>
                )
  );
}
