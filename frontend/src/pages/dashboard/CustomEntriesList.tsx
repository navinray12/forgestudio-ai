import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function api(path: string, init: RequestInit = {}) {
    const res = await fetch(`${apiUrl}${path}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        ...init,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error?.message || data.message || `Request failed (${res.status})`);
    return data;
}

interface PurgeRequest {
    id: string;
    status: string;
    reason: string;
    requestedById: string;
    approvedById: string | null;
    singleOwnerException: boolean;
    expiresAt: string;
    manifest: Array<{ entryId: string }>;
    createdAt: string;
}

export default function CustomEntriesList() {
    const { websiteId, cptId } = useParams();
    const [view, setView] = useState<"active" | "trash">("active");
    const [entries, setEntries] = useState<any[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [purgeRequests, setPurgeRequests] = useState<PurgeRequest[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [postTypeName, setPostTypeName] = useState<string | null>(null);

    useEffect(() => {
        if (!websiteId || !cptId) return;
        api(`/api/cpt/websites/${websiteId}/types`)
            .then((d) => setPostTypeName(d.data?.find((t: any) => t.id === cptId)?.name ?? null))
            .catch(() => setPostTypeName(null));
    }, [websiteId, cptId]);

    const load = useCallback(async () => {
        if (!cptId) return;
        setError(null);
        try {
            const data = await api(`/api/cpt/types/${cptId}/${view === "trash" ? "trash" : "entries"}`);
            setEntries(data.data);
            setSelected(new Set());
            if (view === "trash" && websiteId) {
                const requests = await api(`/api/cpt/websites/${websiteId}/purge-requests`);
                setPurgeRequests(requests.data);
            }
        } catch (e: any) {
            setError(e.message);
        }
    }, [cptId, view, websiteId]);

    useEffect(() => { void load(); }, [load]);

    const moveToTrash = async (entry: any) => {
        const reason = prompt(`Why are you moving "${entry.title}" to trash? (It can be restored later.)`);
        if (!reason || !reason.trim()) return;
        try {
            await api(`/api/cpt/entries/${entry.id}`, {
                method: "DELETE",
                body: JSON.stringify({ reason, expectedUpdatedAt: entry.updatedAt }),
            });
            await load();
        } catch (e: any) { setError(e.message); }
    };

    const restore = async (entry: any) => {
        try {
            await api(`/api/cpt/entries/${entry.id}/restore`, { method: "POST" });
            await load();
        } catch (e: any) { setError(e.message); }
    };

    const requestPurge = async (singleOwnerException: boolean) => {
        const reason = prompt(`Reason for permanently deleting ${selected.size} entr${selected.size === 1 ? "y" : "ies"}:`);
        if (!reason || !reason.trim()) return;
        try {
            await api(`/api/cpt/websites/${websiteId}/purge-requests`, {
                method: "POST",
                body: JSON.stringify({ entryIds: [...selected], reason, singleOwnerException }),
            });
            await load();
        } catch (e: any) { setError(e.message); }
    };

    const actOnRequest = async (request: PurgeRequest, action: "approve" | "execute") => {
        if (action === "execute" && !confirm(`Permanently delete ${request.manifest.length} entr${request.manifest.length === 1 ? "y" : "ies"}? This cannot be undone.`)) return;
        try {
            await api(`/api/cpt/purge-requests/${request.id}/${action}`, { method: "POST" });
            await load();
        } catch (e: any) { setError(e.message); }
    };

    const toggle = (id: string) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <Link to={`/dashboard?tab=cpts&site=${websiteId}`} className="inline-block mb-4 text-xs font-bold text-slate-500 hover:text-slate-900">← Content types</Link>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{postTypeName ? `${postTypeName} entries` : "Dynamic Entries"}</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage content populating custom structures safely mapped.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setView(view === "active" ? "trash" : "active")} className="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50">
                        {view === "active" ? "View trash" : "Back to entries"}
                    </button>
                    {view === "active" && (
                        <Link to={`/dashboard/cpts/${websiteId}/entries/${cptId}/editor`} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition">
                            + Add New Entry
                        </Link>
                    )}
                </div>
            </div>

            {error && <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">{error}</div>}

            {view === "trash" && (
                <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-800 space-y-2">
                    <p>Entries in trash are kept until they are restored or permanently deleted. Permanent deletion needs approval from another owner or admin, and the approval expires after one hour.</p>
                    {selected.size > 0 && (
                        <div className="flex gap-2">
                            <button onClick={() => requestPurge(false)} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold">Request permanent deletion ({selected.size})</button>
                            <button onClick={() => requestPurge(true)} className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 text-xs font-bold" title="Only when no other owner or admin exists; requires a recent sign-in">
                                I am the only owner
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            {view === "trash" && <th className="p-4 w-8"></th>}
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Title</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">{view === "trash" ? "Reason" : "Status"}</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Author</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">{view === "trash" ? "Trashed" : "Date"}</th>
                            <th className="p-4 text-xs font-bold text-slate-500"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {entries.length === 0 ? (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-500 text-sm">{view === "trash" ? "Trash is empty." : "No entries created yet."}</td></tr>
                        ) : entries.map(entry => (
                            <tr key={entry.id} className="hover:bg-slate-50 transition">
                                {view === "trash" && (
                                    <td className="p-4"><input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggle(entry.id)} /></td>
                                )}
                                <td className="p-4">
                                    <div className="font-bold text-slate-800 text-sm">{entry.title}</div>
                                    <div className="text-xs font-mono text-slate-500 mt-0.5">/{entry.slug}</div>
                                </td>
                                <td className="p-4">
                                    {view === "trash" ? (
                                        <span className="text-xs text-slate-600">{entry.deleteReason}</span>
                                    ) : (
                                        <span className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md ${entry.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {entry.status}
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-sm text-slate-600">{entry.author?.fullName || entry.author?.email || 'Unknown'}</td>
                                <td className="p-4 text-sm text-slate-500">{new Date(view === "trash" ? entry.deletedAt : entry.updatedAt).toLocaleDateString()}</td>
                                <td className="p-4 text-right space-x-3">
                                    {view === "trash" ? (
                                        <button onClick={() => restore(entry)} className="text-blue-600 hover:underline text-xs font-bold">Restore as draft</button>
                                    ) : (
                                        <>
                                            <Link to={`/dashboard/cpts/${websiteId}/entries/${cptId}/editor/${entry.id}`} className="text-blue-600 hover:underline text-xs font-bold">Edit</Link>
                                            <button onClick={() => moveToTrash(entry)} className="text-rose-600 hover:underline text-xs font-bold">Move to trash</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {view === "trash" && purgeRequests.length > 0 && (
                <div className="mt-6 bg-white border border-slate-200 rounded-3xl p-4 space-y-2">
                    <h2 className="text-sm font-bold text-slate-700">Permanent deletion requests</h2>
                    {purgeRequests.map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                            <span className="text-slate-600">
                                {r.manifest.length} entr{r.manifest.length === 1 ? "y" : "ies"} · {r.reason} · <b>{r.status}</b>
                                {(r.status === "PENDING_APPROVAL" || r.status === "APPROVED") && ` · expires ${new Date(r.expiresAt).toLocaleTimeString()}`}
                            </span>
                            <span className="space-x-2">
                                {r.status === "PENDING_APPROVAL" && (
                                    <button onClick={() => actOnRequest(r, "approve")} className="px-2 py-1 rounded bg-slate-800 text-white font-bold">Approve</button>
                                )}
                                {r.status === "APPROVED" && (
                                    <button onClick={() => actOnRequest(r, "execute")} className="px-2 py-1 rounded bg-rose-600 text-white font-bold">Delete permanently</button>
                                )}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
