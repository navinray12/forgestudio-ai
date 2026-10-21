import React from "react";
import { AccessibilityStatementModal } from "../../../../components/accessibility/AccessibilityStatementModal";
import { AccessibilityWidget } from "../../../../components/accessibility/AccessibilityWidget";
import { ReadingGuideBar } from "../../../../components/accessibility/ReadingGuideBar";
import { SupportCredentialsModal } from "../../components/SupportCredentialsModal";
import type { WebsiteData } from "../../types";

/** What renderAccessibilityAndSupport reads: the editor values and callbacks the inline JSX used. */
export interface AccessibilityAndSupportDeps {
  globalSettings: any;
  isStatementOpen: boolean;
  isSupportCredentialsOpen: boolean;
  setIsStatementOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSupportCredentialsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  website: WebsiteData;
}

/**
 * Reading guide bar, accessibility widget and statement modal, and the support credentials modal.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 11413-11428 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderAccessibilityAndSupport({
  globalSettings,
  isStatementOpen,
  isSupportCredentialsOpen,
  setIsStatementOpen,
  setIsSupportCredentialsOpen,
  website,
}: AccessibilityAndSupportDeps): React.ReactNode {
  return (
      <>
      <ReadingGuideBar />
      <AccessibilityWidget
        config={globalSettings?.accessibilityWidget}
        onOpenStatement={() => setIsStatementOpen(true)}
      />
      <AccessibilityStatementModal
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        organizationName={globalSettings?.siteIdentity?.name || website?.name || "Website"}
      />

      {/* F-020 Temporary Support Credentials Modal */}
      <SupportCredentialsModal
        isOpen={isSupportCredentialsOpen}
        onClose={() => setIsSupportCredentialsOpen(false)}
      />
      </>
  );
}
