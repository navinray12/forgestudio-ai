let cachedWorkspaceId: string | null = process.env.ANTHROPIC_WORKSPACE_ID ? process.env.ANTHROPIC_WORKSPACE_ID.trim() : null;

/**
 * Returns the configured Anthropic workspace ID if explicitly provided.
 * Standard workspace-scoped keys (e.g. sk-ant-api03-...) must NOT send the
 * anthropic-workspace-id header; doing so results in HTTP 400 errors.
 */
export async function resolveAnthropicWorkspaceId(_apiKey?: string): Promise<string | null> {
  if (cachedWorkspaceId) return cachedWorkspaceId;
  if (process.env.ANTHROPIC_WORKSPACE_ID) {
    cachedWorkspaceId = process.env.ANTHROPIC_WORKSPACE_ID.trim();
    return cachedWorkspaceId;
  }
  return null;
}
