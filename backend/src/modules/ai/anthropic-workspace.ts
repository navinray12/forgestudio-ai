let cachedWorkspaceId: string | null = process.env.ANTHROPIC_WORKSPACE_ID || null;
let resolvedOnce = false;

export async function resolveAnthropicWorkspaceId(apiKey?: string): Promise<string | null> {
  if (cachedWorkspaceId) return cachedWorkspaceId;
  if (process.env.ANTHROPIC_WORKSPACE_ID) {
    cachedWorkspaceId = process.env.ANTHROPIC_WORKSPACE_ID.trim();
    return cachedWorkspaceId;
  }
  if (resolvedOnce) return null;
  resolvedOnce = true;

  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/organizations/workspaces", {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
    });
    if (res.ok) {
      const data = await res.json() as any;
      if (Array.isArray(data?.data) && data.data[0]?.id) {
        cachedWorkspaceId = String(data.data[0].id);
        console.log(`[ANTHROPIC] Auto-resolved organization workspace ID: ${cachedWorkspaceId}`);
        return cachedWorkspaceId;
      }
    }
  } catch {}

  return null;
}
