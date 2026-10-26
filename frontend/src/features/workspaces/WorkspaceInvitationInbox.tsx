import { useEffect, useRef, useState } from "react";
import { workspaceRequest, WorkspaceRequestError } from "./workspace-api";
import { notifyMembersChanged } from "./members-sync";
import { Mail, RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";

type Invitation = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
  expiresAt: string;
};

export function WorkspaceInvitationInbox({
  apiUrl,
  onJoined,
}: {
  apiUrl: string;
  onJoined: (id: string) => void;
}) {
  const [items, setItems] = useState<Invitation[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const lifetime = useRef<AbortController | null>(null);
  const keys = useRef(new Map<string, string>());

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    keys.current.clear();
    return () => controller.abort();
  }, [apiUrl]);

  useEffect(() => {
    const controller = new AbortController();
    workspaceRequest<{
      invitations: Invitation[];
    }>(apiUrl, "/invitations/inbox", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setError("");
          setItems(data.invitations || []);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          if (failure instanceof WorkspaceRequestError && failure.status === 401) {
            setItems([]);
            return;
          }
          setError(
            failure instanceof Error ? failure.message : "Invitation inbox unavailable"
          );
        }
      });
    return () => controller.abort();
  }, [apiUrl, refresh]);

  async function accept(item: Invitation) {
    if (busy) return;
    setBusy(true);
    setError("");
    const signal = lifetime.current?.signal;
    if (!keys.current.has(item.id)) keys.current.set(item.id, crypto.randomUUID());

    try {
      await workspaceRequest(
        apiUrl,
        `/${item.workspaceId}/invitations/${item.id}/accept`,
        {
          method: "POST",
          payload: {},
          key: keys.current.get(item.id),
          signal,
        }
      );
      if (!signal?.aborted) {
        keys.current.delete(item.id);
        setRefresh((value) => value + 1);
        notifyMembersChanged(item.workspaceId);
        onJoined(item.workspaceId);
      }
    } catch (failure) {
      if (!signal?.aborted) {
        setError(
          failure instanceof Error ? failure.message : "Invitation acceptance failed"
        );
      }
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }

  return (
    <div className="w-full text-xs font-sans">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition py-1 cursor-pointer select-none group"
      >
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition" />
        )}
        <Mail className="w-3.5 h-3.5 text-indigo-400" />
        <span className="font-semibold text-slate-300 group-hover:text-white transition">
          Workspace invitation inbox
        </span>
        {items.length > 0 ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white animate-pulse">
            {items.length} Pending
          </span>
        ) : (
          <span className="text-[10px] text-slate-500 font-medium">
            (0 pending)
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mt-2 p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Pending Workspace Invites
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRefresh((v) => v + 1)}
              className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${busy ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {items.length === 0 && !error ? (
            <p className="text-[11px] text-slate-400 py-1">
              No pending invitations. When another user invites you to a workspace, invitations will appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-700/60 bg-slate-800/60"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🏢</span>
                    <div>
                      <div className="font-bold text-white text-xs">{item.workspaceName}</div>
                      <div className="text-[10px] text-slate-400">
                        Role: <span className="text-indigo-300 font-semibold">{item.role}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void accept(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{busy ? "Joining…" : "Accept invitation"}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
