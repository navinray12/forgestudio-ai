/** Legacy role vocabulary retained while access moves behind module contracts. */
const owner = [
  "VIEW", "EDIT", "CREATE", "DELETE", "PUBLISH", "ROLLBACK", "MANAGE_TEAM",
  "MANAGE_SETTINGS", "MANAGE_INTEGRATIONS", "COMMENT", "EDIT_CONTENT",
  "EDIT_DESIGN", "MANAGE_MEMBERS", "MANAGE_PERMISSIONS", "MANAGE_PROJECT",
  "CUSTOM_CODE", "EDIT_SEO", "VIEW_ANALYTICS",
];
const admin = owner.filter((capability) => capability !== "DELETE");

export const DEFAULT_CAPABILITIES: Record<string, string[]> = {
  OWNER: [...owner], PROJECT_OWNER: [...owner],
  ADMIN: [...admin], PROJECT_ADMIN: [...admin],
  DESIGNER: ["VIEW", "EDIT", "CREATE", "PUBLISH", "COMMENT", "EDIT_CONTENT", "EDIT_DESIGN"],
  DEVELOPER: ["VIEW", "EDIT", "CREATE", "COMMENT", "EDIT_DESIGN", "EDIT_CONTENT", "CUSTOM_CODE", "MANAGE_INTEGRATIONS", "SFTP_ACCESS", "VIEW_LOGS"],
  CONTENT_EDITOR: ["VIEW", "EDIT", "COMMENT", "EDIT_CONTENT"],
  CLIENT: ["VIEW", "EDIT", "COMMENT", "EDIT_CONTENT"],
  SEO_MANAGER: ["VIEW", "EDIT", "COMMENT", "EDIT_CONTENT", "EDIT_SEO", "VIEW_ANALYTICS", "RUN_AUDIT"],
  REVIEWER: ["VIEW", "COMMENT"],
  VIEWER: ["VIEW"],
};

const knownCapabilities = new Set([...Object.values(DEFAULT_CAPABILITIES).flat(), "EDIT_ANALYTICS"]);
export function isKnownCapability(value: string): boolean {
  return knownCapabilities.has(value);
}

/** EDIT is a legacy umbrella. Denying it also denies its specialized actions;
 * denying either specialized action blocks an ambiguous umbrella EDIT request.
 */
export function relatedCapabilities(capability: string): string[] {
  if (capability === "EDIT") return ["EDIT", "EDIT_CONTENT", "EDIT_DESIGN"];
  if (capability === "EDIT_CONTENT" || capability === "EDIT_DESIGN") return [capability, "EDIT"];
  if (capability === "MANAGE_TEAM" || capability === "MANAGE_MEMBERS") return ["MANAGE_TEAM", "MANAGE_MEMBERS"];
  return [capability];
}

export function roleGrants(role: string, capability: string): boolean {
  if (!isKnownCapability(capability)) return false;
  if (role === "OWNER" || role === "PROJECT_OWNER") return true;
  const grants = DEFAULT_CAPABILITIES[role] || [];
  if (grants.includes(capability)) return true;
  if (capability === "EDIT") return grants.includes("EDIT_CONTENT") || grants.includes("EDIT_DESIGN");
  if (capability === "MANAGE_TEAM") return grants.includes("MANAGE_MEMBERS");
  return false;
}
