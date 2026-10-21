import React from "react";
import { FontPickerModal } from "../../../../components/FontPickerModal";
import type { DocumentAcknowledgement } from "../../../../features/editor-access/save-authorized-website";
import { ClassManagerModal } from "../../components/ClassManagerModal";
import IconPickerModal from "../../components/IconPickerModal";
import { VariablesManagerModal } from "../../components/VariablesManagerModal";
import type { DeviceMode, EditorElement, ElementState, ElementStyles } from "../../types";
import { getControlStyleValue } from "../../utils";

/** What renderDesignSystemModals reads: the editor values and callbacks the inline JSX used. */
export interface DesignSystemModalsDeps {
  activeDevice: DeviceMode;
  activeElementState: ElementState;
  fontPickerCallback: ((family: string) => void) | null;
  globalClasses: any[];
  globalVariables: any[];
  handleSave: () => Promise<DocumentAcknowledgement | undefined>;
  iconPickerTargetField: string;
  isClassModalOpen: boolean;
  isFontPickerModalOpen: boolean;
  isIconPickerOpen: boolean;
  isVariablesModalOpen: boolean;
  selectedElementAny: any;
  setGlobalClasses: React.Dispatch<React.SetStateAction<any[]>>;
  setGlobalVariables: React.Dispatch<React.SetStateAction<any[]>>;
  setIsClassModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsFontPickerModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsIconPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsVariablesModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  updateSelectedProp: (key: string, value: any) => void;
  updateSelectedStyle: (key: keyof ElementStyles, value: any) => void;
}

/**
 * Design-system modals: icon picker, font picker, global variables manager and global class manager.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 11317-11378 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderDesignSystemModals({
  activeDevice,
  activeElementState,
  fontPickerCallback,
  globalClasses,
  globalVariables,
  handleSave,
  iconPickerTargetField,
  isClassModalOpen,
  isFontPickerModalOpen,
  isIconPickerOpen,
  isVariablesModalOpen,
  selectedElementAny,
  setGlobalClasses,
  setGlobalVariables,
  setIsClassModalOpen,
  setIsFontPickerModalOpen,
  setIsIconPickerOpen,
  setIsVariablesModalOpen,
  updateSelectedProp,
  updateSelectedStyle,
}: DesignSystemModalsDeps): React.ReactNode {
  return (
      <>
      <IconPickerModal
        isOpen={isIconPickerOpen}
        onClose={() => setIsIconPickerOpen(false)}
        currentIcon={
          selectedElementAny
            ? (selectedElementAny as any)[iconPickerTargetField] || selectedElementAny.iconName || selectedElementAny.icon || ""
            : ""
        }
        onSelectIcon={(iconName, iconProvider) => {
          if (selectedElementAny) {
            updateSelectedProp((iconPickerTargetField || "iconName") as keyof EditorElement, iconName);
            if (iconProvider) {
              updateSelectedProp("iconProvider", iconProvider);
            }
            updateSelectedProp("icon", iconName);
          }
        }}
        onRemoveIcon={() => {
          if (selectedElementAny) {
            updateSelectedProp((iconPickerTargetField || "iconName") as keyof EditorElement, "");
            updateSelectedProp("icon", "");
          }
        }}
      />

      {/* Dynamic Font System Modal */}
      <FontPickerModal
        isOpen={isFontPickerModalOpen}
        onClose={() => setIsFontPickerModalOpen(false)}
        selectedFont={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "fontFamily")}
        onSelectFont={(fontFamily) => {
          if (fontPickerCallback) {
            fontPickerCallback(fontFamily);
          } else {
            updateSelectedStyle("fontFamily", fontFamily);
          }
          setIsFontPickerModalOpen(false);
        }}
      />

      {/* F-339: Variables Manager Modal */}
      <VariablesManagerModal
        isOpen={isVariablesModalOpen}
        onClose={() => setIsVariablesModalOpen(false)}
        variables={globalVariables}
        onSaveVariables={(updated) => {
          setGlobalVariables(updated);
          handleSave();
        }}
      />

      {/* F-340: Global Class Manager Modal */}
      <ClassManagerModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        classes={globalClasses}
        userRole="OWNER"
        onSaveClasses={(updated) => {
          setGlobalClasses(updated);
          handleSave();
        }}
      />
      </>
  );
}
