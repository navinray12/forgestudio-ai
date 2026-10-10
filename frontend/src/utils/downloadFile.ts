export const API_ORIGIN: string = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Download a file from an authenticated API endpoint.
 *
 * A plain `<a href download>` cannot report failures: an expired session or a
 * server error would be saved to disk as a corrupt ".zip". This fetches the
 * response first, rejects anything that is not the expected file, and only then
 * hands the bytes to the browser.
 */
export async function downloadAuthenticatedFile(
  url: string,
  fallbackFilename: string,
  expectedType = "application/zip"
): Promise<string> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(url, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !contentType.includes(expectedType)) {
    let message = "";
    if (contentType.includes("json")) {
      const data = await res.json().catch(() => null);
      message = data?.error?.message || data?.message || data?.detail || "";
    }
    throw new Error(message || `Download failed (${res.status} ${res.statusText || "unexpected response"})`);
  }

  const blob = await res.blob();
  if (blob.size === 0) throw new Error("Download failed: the server returned an empty file");

  const disposition = res.headers.get("content-disposition") || "";
  const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || fallbackFilename;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  return filename;
}
