/**
 * Shared request helper for every forgeProjectService method: API base (computed once when the module
 * loads), JSON headers, the Bearer token from localStorage, cookies, error extraction and allowFailure.
 * Moved verbatim from forgeProjectService.ts.
 */
export const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1/projects`;

export async function request<T>(endpoint: string, options: RequestInit & { allowFailure?: boolean } = {}): Promise<T> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  let data: any = null;

  if (contentType.includes("json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  // Some operations report a structured, non-successful outcome (diagnostics,
  // conflicts) that the caller needs in full rather than as a thrown message
  if (options.allowFailure && data && typeof data === "object") {
    return data;
  }

  if (!res.ok || (data && data.success === false)) {
    const errorMsg =
      data?.error?.message ||
      data?.detail ||
      data?.message ||
      `Request failed with status ${res.status} (${res.statusText})`;
    throw new Error(errorMsg);
  }

  if (!data) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Server returned non-JSON response (${res.status} ${res.statusText})`);
  }

  return data;
}
