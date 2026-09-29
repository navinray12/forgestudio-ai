import { useEffect, useRef, useState } from "react";
import { workspaceRequest } from "./workspace-api";
type Invitation = {
    id: string;
    workspaceId: string;
    workspaceName: string;
    role: string;
    expiresAt: string;
};
export function WorkspaceInvitationInbox({ apiUrl, onJoined }: {
    apiUrl: string;
    onJoined: (id: string) => void;
}) {
    const [items, setItems] = useState<Invitation[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const lifetime = useRef<AbortController | null>(null);
    const keys = useRef(new Map<string, string>());
    useEffect(() => { const controller = new AbortController(); lifetime.current = controller; keys.current.clear(); return () => controller.abort(); }, [apiUrl]);
    useEffect(() => {
        const controller = new AbortController();
        setError("");
        setItems([]);
        workspaceRequest<{
            invitations: Invitation[];
        }>(apiUrl, "/invitations/inbox", { signal: controller.signal })
            .then(data => { if (!controller.signal.aborted)
            setItems(data.invitations); })
            .catch(failure => { if (!controller.signal.aborted)
            setError(failure instanceof Error ? failure.message : "Invitation inbox unavailable"); });
        return () => controller.abort();
    }, [apiUrl, refresh]);
    async function accept(item: Invitation) {
        if (busy)
            return;
        setBusy(true);
        setError("");
        const signal = lifetime.current?.signal;
        if (!keys.current.has(item.id))
            keys.current.set(item.id, crypto.randomUUID());
        try {
            await workspaceRequest(apiUrl, `/${item.workspaceId}/invitations/${item.id}/accept`, { method: "POST", payload: {}, key: keys.current.get(item.id), signal });
            if (!signal?.aborted) {
                keys.current.delete(item.id);
                setRefresh(value => value + 1);
                onJoined(item.workspaceId);
            }
        }
        catch (failure) {
            if (!signal?.aborted)
                setError(failure instanceof Error ? failure.message : "Invitation acceptance failed");
        }
        finally {
            if (!signal?.aborted)
                setBusy(false);
        }
    }
    return <details className="text-sm"><summary>Workspace invitation inbox</summary>
  {error && <p role="alert">{error}</p>}<button type="button" disabled={busy} onClick={() => setRefresh(value => value + 1)} className="underline">Refresh invitations</button>
  {!items.length && !error && <p>No pending invitations.</p>}
  <ul>{items.map(item => <li key={item.id} className="flex gap-2 items-center py-1"><span>{item.workspaceName} · {item.role}</span><button type="button" disabled={busy} className="underline" onClick={() => void accept(item)}>Accept invitation</button></li>)}</ul>
 </details>;
}
