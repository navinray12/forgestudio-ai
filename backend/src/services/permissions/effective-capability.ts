import { isKnownCapability, relatedCapabilities, roleGrants } from "./capabilities.js";
export interface PermissionOverride { resourceId: string; capability: string; effect: string; }
/** One evaluator shared by transactional commands and legacy transport guards. */
export function effectiveCapability(input: {
  role: string; archived: boolean; resourceId: string; capability: string;
  overrides: PermissionOverride[];
}): boolean {
  if (!input.resourceId || !isKnownCapability(input.capability) || (input.archived && input.capability !== "VIEW")) return false;
  const related = relatedCapabilities(input.capability);
  const applicable = input.overrides.filter(grant =>
    (grant.resourceId === "*" || grant.resourceId === input.resourceId) && related.includes(grant.capability));
  if (applicable.some(grant => grant.effect !== "ALLOW")) return false;
  if (applicable.some(grant => grant.capability === input.capability)) return true;
  return roleGrants(input.role, input.capability);
}
