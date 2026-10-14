/** Pure policy used by the real visual editor and its regression tests. */
export type WorkspaceRefreshDecision = "apply" | "stale" | "dirty" | "invalid";

export function decideWorkspaceRefresh(
  serverVersion: number,
  currentVersion: number,
  hasUnsavedChanges: () => boolean,
  forced = false,
): WorkspaceRefreshDecision {
  if (!Number.isSafeInteger(serverVersion) || serverVersion < 1 ||
      !Number.isSafeInteger(currentVersion) || currentVersion < 1) return "invalid";
  // Even an explicit refresh may not roll an acknowledged revision backwards.
  if (serverVersion < currentVersion || (serverVersion === currentVersion && !forced)) return "stale";
  if (!forced && hasUnsavedChanges()) return "dirty";
  return "apply";
}

export type PreviewCommand = { type: "reload" } | { type: "route"; route: string };

/** This bridge supports same-origin, explicitly embedded draft previews only.
 * Opaque/cross-origin frames need a separate authenticated channel, not a wildcard.
 */
export function readPreviewCommand(
  event: { source: unknown; origin: string; data: unknown },
  context: { parent: unknown; self: unknown; origin: string; isPreview: boolean },
): PreviewCommand | null {
  if (!context.isPreview || context.parent === context.self || !context.parent ||
      !context.origin || context.origin === "null" ||
      event.source !== context.parent || event.origin !== context.origin) return null;
  if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) return null;
  const data = event.data as Record<string, unknown>;
  if (data.type === "forge:preview:reload") return { type: "reload" };
  if (data.type !== "forge:preview:set-route" || typeof data.route !== "string") return null;
  const route = data.route;
  // Reject backslashes, ASCII whitespace, controls and DEL without a control-character regexp.
  const hasForbiddenPathCharacter = Array.from(route).some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code <= 0x20 || code === 0x7f;
  });
  if (!route.startsWith("/") || route.startsWith("//") || route.length > 2048 ||
      hasForbiddenPathCharacter) return null;
  return { type: "route", route };
}
