import { loadAuthorizedWebsite } from "../../editor-access/load-authorized-website";

/** A draft load must not silently fall back to a public, older revision. */
export async function loadSiteSnapshot(
  apiUrl: string, websiteId: string, isPreview: boolean, signal: AbortSignal,
): Promise<any> {
  if (isPreview) return loadAuthorizedWebsite(apiUrl, websiteId, signal);
  const response = await fetch(`${apiUrl}/api/v1/websites/public/${encodeURIComponent(websiteId)}`, {
    signal, credentials: "omit",
  });
  if (!response.ok) {
    let msg = "This website is unavailable.";
    try {
      const errJson = await response.json();
      if (errJson?.detail) msg = errJson.detail;
      else if (errJson?.error?.message) msg = errJson.error.message;
      else if (errJson?.message) msg = errJson.message;
    } catch (_e) {}
    throw new Error(msg);
  }
  if (!(response.headers.get("content-type") || "").includes("application/json")) {
    throw new Error("The website server returned an invalid response.");
  }
  const body = await response.json();
  const website = body?.website || body;
  if (!website || typeof website !== "object" || website.id !== websiteId) {
    throw new Error("The website response did not match the requested site.");
  }
  return website;
}
