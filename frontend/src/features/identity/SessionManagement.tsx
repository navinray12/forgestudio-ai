import { useEffect, useState } from "react";
import { identityRequest, startManagedLogin, type AccountSession, type IdentityCapabilities } from "./identity-api";
export function SessionManagement() {
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [managed, setManaged] = useState(false);
  const load = async (signal?: AbortSignal) => {
    const response = await identityRequest<{ data: AccountSession[] }>("/sessions", undefined, signal); setSessions(response.data);
  };
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([load(abort.signal), identityRequest<{data: IdentityCapabilities}>("/capabilities", undefined, abort.signal)
      .then(result => setManaged(result.data.managed))]).catch(err => { if (!abort.signal.aborted) setError(err.message); });
    return () => abort.abort();
  }, []);
  async function revoke(id: string) {
    setBusy(true); setError("");
    try {
      await identityRequest(`/sessions/${encodeURIComponent(id)}/revoke`, {});
      if (sessions.find(s => s.id === id)?.current) window.location.assign("/login");
      else await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Revocation failed."); } finally { setBusy(false); }
  }
  return <section aria-label="Session management">
    <h3 className="font-semibold">Active account sessions</h3>
    <p className="text-sm mt-2">Revoking a session removes its access on the next authorization check. No access token is displayed.</p>
    {error && <p role="alert" className="my-3">{error}</p>}
    <ul className="space-y-3 mt-4">{sessions.map(session => <li key={session.id} className="rounded border border-slate-600 p-3">
      <p>{session.current ? "This browser" : "Another session"} · {session.authMethod}</p>
      <p className="text-sm">Expires {new Date(session.expiresAt).toLocaleString()}</p>
      <button disabled={busy} className="mt-2 underline" onClick={() => void revoke(session.id)}>Revoke{session.current ? " this session" : " session"}</button>
    </li>)}</ul>
    {managed && <button disabled={busy} className="mt-4 underline" onClick={() => {
      setBusy(true); void startManagedLogin(true).catch(err => { setError(err.message); setBusy(false); });
    }}>Link or verify my managed identity</button>}
  </section>;
}
