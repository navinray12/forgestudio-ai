import React from "react";
import PopupManagerModal from "../../components/PopupManagerModal";
import PopupRuntimePreview from "../../components/PopupRuntimePreview";
import type { EditorElement } from "../../types";

/** What renderPopupSections reads: the editor values and callbacks the inline JSX used. */
export interface PopupSectionsDeps {
  globalSettings: any;
  handleCreatePopup: (popup: any) => void;
  handleDeletePopup: (id: string) => void;
  handleDuplicatePopup: (id: string) => void;
  handleSelectPopupForEdit: (popup: any) => void;
  handleTrackPopupClick: (id: string) => void;
  handleTrackPopupView: (id: string) => void;
  handleUpdatePopup: (id: string, popup: any) => void;
  isPopupManagerOpen: boolean;
  isPreview: boolean;
  popups: any[];
  renderElementTree: (el: EditorElement) => React.ReactNode;
  setIsPopupManagerOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Popup manager modal and, in preview, the popup runtime preview.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 11085-11106 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderPopupSections({
  globalSettings,
  handleCreatePopup,
  handleDeletePopup,
  handleDuplicatePopup,
  handleSelectPopupForEdit,
  handleTrackPopupClick,
  handleTrackPopupView,
  handleUpdatePopup,
  isPopupManagerOpen,
  isPreview,
  popups,
  renderElementTree,
  setIsPopupManagerOpen,
}: PopupSectionsDeps): React.ReactNode {
  return (
      <>
      <PopupManagerModal
        isOpen={isPopupManagerOpen}
        onClose={() => setIsPopupManagerOpen(false)}
        popups={popups}
        onSelectPopupForEdit={handleSelectPopupForEdit}
        onCreatePopup={handleCreatePopup}
        onUpdatePopup={handleUpdatePopup}
        onDeletePopup={handleDeletePopup}
        onDuplicatePopup={handleDuplicatePopup}
      />

      {/* Runtime Simulation in Preview Mode (F-282 - F-291) */}
      {isPreview && (
        <PopupRuntimePreview
          popups={popups}
          renderElementTree={renderElementTree}
          onTrackView={handleTrackPopupView}
          onTrackClick={handleTrackPopupClick}
          isPreviewMode={true}
          globalSettings={globalSettings}
        />
      )}
      </>
  );
}
