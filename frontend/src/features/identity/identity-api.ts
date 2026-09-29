const api = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1/auth`;
export interface IdentityCapabilities { local: boolean; managed: boolean; phone: boolean }
export interface AccountSession { id: string; createdAt: string; expiresAt: string; lastUsedAt: string | null; authMethod: string; current: boolean }
export async function identityRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${api}${path}`, { method: body === undefined ? "GET" : "POST",
    credentials: "include", cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) throw new Error(data?.error?.message || data?.message || "The identity request failed.");
  return data as T;
}
export async function startManagedLogin(link = false) {
  const result = await identityRequest<{ data: { authorizationUrl: string } }>(link ? "/oidc/link" : "/oidc/start", {});
  const url = new URL(result.data.authorizationUrl);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("The provider returned an invalid sign-in destination.");
  window.location.assign(url.href);
}
