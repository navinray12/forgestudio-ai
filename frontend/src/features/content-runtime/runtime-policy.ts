function strictHttpsOrigin(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return url.origin;
  } catch { return null; }
}

/** Active tenant content must never render on the management origin. Explicit
 * origin configuration is necessary but not sufficient deployment qualification:
 * cookies, CSP, routing and credential isolation must also be verified.
 */
export function permitsActiveContent(currentOrigin: unknown, studioOrigin: unknown, contentOrigin: unknown): boolean {
  const current = strictHttpsOrigin(currentOrigin);
  const studio = strictHttpsOrigin(studioOrigin);
  const content = strictHttpsOrigin(contentOrigin);
  if (!current || !studio || !content || current !== content || content === studio) return false;
  // Different ports on one hostname do not isolate host-scoped cookies.
  return new URL(content).hostname !== new URL(studio).hostname;
}

export function isolatedScriptDocument(code: string): string {
  // Script closing tags are escaped so an embedded snippet cannot rewrite this
  // document's CSP. It still runs as untrusted code in an opaque sandbox origin.
  const source = code.replace(/<\/script/gi, "<\\/script");
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'none'; connect-src 'none'; img-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><title>Isolated custom script</title></head><body><script>try {\n${source}\n} catch (_) { console.error('Custom script failed'); }</script></body></html>`;
}
