/** No local draft is evidence of current access. Recovery is a separate action
 * after authorization; denied/unavailable requests must not load another user's
 * old browser cache as an editable owner session.
 */
export async function loadAuthorizedWebsite(base: string, websiteId: string, signal: AbortSignal) {
  const response = await fetch(`${base}/api/websites/${encodeURIComponent(websiteId)}`, { credentials: "include", signal });
  if (!response.ok) {
    if ([401, 403, 404].includes(response.status)) throw new Error("This website is unavailable or you no longer have access.");
    throw new Error("The website could not be loaded. Retry when the service is available.");
  }
  const body = await response.json();
  const website = body?.website;
  if (!website || website.id !== websiteId || typeof website.userPermission !== "string") {
    throw new Error("The website response did not contain a valid access scope.");
  }
  return website;
}
