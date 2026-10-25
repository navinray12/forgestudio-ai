import React from "react";
import type { PageSettingsData } from "../../../../features/revision-history/types/revisionHistory.types";
import { ImportWebsiteKitDialog, ReplaceTemplateDialog, SaveTemplateDialog } from "../../../../features/templates";
import type { Template, TemplateType } from "../../../../features/templates/types/template.types";
import type { EditorElement } from "../../types";

/** What renderTemplateDialogs reads: the editor values and callbacks the inline JSX used. */
export interface TemplateDialogsDeps {
  closeSaveTemplateDialog: () => void;
  elements: EditorElement[];
  handleConfirmImportWebsiteKit: (kitData: { website: { name: string; description?: string | undefined; settings?: Record<string, any> | undefined; }; pages: { id: string; title: string; path: string; elements: any[]; pageSettings: Record<string, any>; }[]; templates: any[]; }) => void;
  handleConfirmReplaceTemplate: (template: Template) => void;
  handleSaveTemplateSubmit: (elements: EditorElement[], pageSettings: PageSettingsData) => Promise<boolean>;
  isImportWebsiteKitOpen: boolean;
  isReplaceTemplateOpen: boolean;
  isSaveTemplateOpen: boolean;
  isSaveTemplateUpdateMode: boolean;
  isSavingTemplate: boolean;
  libraryTemplates: Template[];
  pageSettings: { [key: string]: any; title?: string | undefined; description?: string | undefined; path?: string | undefined; backgroundColor?: string | undefined; customHead?: string | undefined; isMaintenanceMode?: boolean | undefined; siteLanguage?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrl?: string | undefined; noindex?: boolean | undefined; nofollow?: boolean | undefined; };
  saveTemplateCategory: string;
  saveTemplateDescription: string;
  saveTemplateError: string | null;
  saveTemplateName: string;
  saveTemplateType: TemplateType;
  saveTemplateValidationError: string | null;
  selectedElement: EditorElement | null;
  setIsImportWebsiteKitOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsReplaceTemplateOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSaveTemplateCategory: React.Dispatch<React.SetStateAction<string>>;
  setSaveTemplateDescription: React.Dispatch<React.SetStateAction<string>>;
  setSaveTemplateName: React.Dispatch<React.SetStateAction<string>>;
  setSaveTemplateType: React.Dispatch<React.SetStateAction<TemplateType>>;
}

/**
 * Template dialogs: save as template, replace template confirmation and import website kit.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 11144-11178 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderTemplateDialogs({
  closeSaveTemplateDialog,
  elements,
  handleConfirmImportWebsiteKit,
  handleConfirmReplaceTemplate,
  handleSaveTemplateSubmit,
  isImportWebsiteKitOpen,
  isReplaceTemplateOpen,
  isSaveTemplateOpen,
  isSaveTemplateUpdateMode,
  isSavingTemplate,
  libraryTemplates,
  pageSettings,
  saveTemplateCategory,
  saveTemplateDescription,
  saveTemplateError,
  saveTemplateName,
  saveTemplateType,
  saveTemplateValidationError,
  selectedElement,
  setIsImportWebsiteKitOpen,
  setIsReplaceTemplateOpen,
  setSaveTemplateCategory,
  setSaveTemplateDescription,
  setSaveTemplateName,
  setSaveTemplateType,
}: TemplateDialogsDeps): React.ReactNode {
  return (
      <>
      <SaveTemplateDialog
        isOpen={isSaveTemplateOpen}
        isUpdateMode={isSaveTemplateUpdateMode}
        name={saveTemplateName}
        setName={setSaveTemplateName}
        description={saveTemplateDescription}
        setDescription={setSaveTemplateDescription}
        type={saveTemplateType}
        setType={setSaveTemplateType}
        category={saveTemplateCategory}
        setCategory={setSaveTemplateCategory}
        isSaving={isSavingTemplate}
        error={saveTemplateError}
        validationError={saveTemplateValidationError}
        onClose={closeSaveTemplateDialog}
        onSave={handleSaveTemplateSubmit}
        elements={elements}
        pageSettings={pageSettings}
      />

      {/* F-332 Replace Template Dialog Modal */}
      <ReplaceTemplateDialog
        isOpen={isReplaceTemplateOpen}
        targetElementName={selectedElement ? selectedElement.content || selectedElement.type : "Selected Element"}
        templates={libraryTemplates}
        onClose={() => setIsReplaceTemplateOpen(false)}
        onConfirmReplace={handleConfirmReplaceTemplate}
      />

      {/* F-336 Import Website Kit Dialog Modal */}
      <ImportWebsiteKitDialog
        isOpen={isImportWebsiteKitOpen}
        onClose={() => setIsImportWebsiteKitOpen(false)}
        onImportKit={handleConfirmImportWebsiteKit}
      />
      </>
  );
}
