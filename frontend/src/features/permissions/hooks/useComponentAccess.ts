import { useMemo } from "react";

export interface UserAccessContext {
  role: string;
  isRestrictedMode: boolean;
  canEditDesign: boolean;
  canEditContent: boolean;
  canManageSettings: boolean;
  canPublish: boolean;
  isComponentEditable: (componentId?: string, isProtected?: boolean) => boolean;
}

/** Presentation hints only; every backend operation still enforces its policy. */
export function useComponentAccess(website: any, allowedComponentIds?: Set<string>): UserAccessContext {
  return useMemo(() => {
    const suppliedRole = website?.userPermission || website?.role;
    const rawRole = typeof suppliedRole === "string" ? suppliedRole.toUpperCase() : "VIEWER";
    const isRestrictedMode = rawRole === "CLIENT" || rawRole === "CONTENT_EDITOR";
    const isOwner = rawRole === "OWNER" || rawRole === "PROJECT_OWNER";
    const isAdmin = isOwner || rawRole === "ADMIN" || rawRole === "PROJECT_ADMIN";
    const isDesigner = rawRole === "DESIGNER";
    const canEditDesign = !isRestrictedMode && (isAdmin || isDesigner);
    const canEditContent = isAdmin || isDesigner || isRestrictedMode;
    const isComponentEditable = (componentId?: string, isProtected?: boolean): boolean => {
      if (!componentId) return canEditContent;
      if (isAdmin) return true;
      if (isProtected && allowedComponentIds && !allowedComponentIds.has(componentId)) return false;
      return canEditContent;
    };
    return {
      role: rawRole, isRestrictedMode, canEditDesign, canEditContent,
      canManageSettings: isAdmin, canPublish: isAdmin || isDesigner, isComponentEditable,
    };
  }, [website?.userPermission, website?.role, allowedComponentIds]);
}
export default useComponentAccess;
