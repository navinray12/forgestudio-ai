import { useCallback, useEffect, useRef, useState } from "react";
import { workspaceRequest, WorkspaceRequestError } from "./workspace-api";
import type { WorkspaceDetails, WorkspaceSummary } from "./workspace-api";
import type { WorkspaceInvitation } from "./members-model";
import { subscribeToMembersChanges } from "./members-sync";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
interface MembersData {
  workspaces: WorkspaceSummary[]; workspace: WorkspaceDetails | null; invitations: WorkspaceInvitation[];
  loading: boolean; refreshing: boolean; error: string; sessionExpired: boolean;
}
const empty: MembersData = { workspaces: [], workspace: null, invitations: [], loading: true, refreshing: false, error: "", sessionExpired: false };

export function useMembersData() {
  const [data, setData] = useState<MembersData>(empty);
  const selected = useRef("");
  const inFlight = useRef<AbortController | null>(null);
  const expired = useRef(false);
  const pauseRefresh = useRef(false);
  const reloadRequested = useRef(false);
  const setRefreshPaused = useCallback((paused: boolean) => { pauseRefresh.current = paused; }, []);
  const expireSession = useCallback((message: string) => {
    expired.current = true; inFlight.current?.abort();
    setData({ ...empty, loading: false, sessionExpired: true, error: message });
  }, []);
  const load = useCallback(async function loadMembers(): Promise<boolean> {
    if (expired.current) return false;
    inFlight.current?.abort();
    const controller = new AbortController(); inFlight.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    try {
      const list = await workspaceRequest<{ workspaces: WorkspaceSummary[] }>(apiUrl, "", { signal });
      const workspaces = list.workspaces || [];
      const id = workspaces.some(item => item.id === selected.current) ? selected.current : workspaces[0]?.id || "";
      let workspace: WorkspaceDetails | null = null;
      let invitations: WorkspaceInvitation[] = [];
      if (id) {
        workspace = (await workspaceRequest<{ workspace: WorkspaceDetails }>(apiUrl, `/${id}`, { signal })).workspace;
        if (workspace.userRole !== "MEMBER") invitations = (await workspaceRequest<{ invitations: WorkspaceInvitation[] }>(apiUrl, `/${id}/invitations`, { signal })).invitations || [];
      }
      if (controller.signal.aborted) return false;
      selected.current = id;
      setData({ workspaces, workspace, invitations, loading: false, refreshing: false, error: "", sessionExpired: false });
      return true;
    } catch (failure) {
      if (controller.signal.aborted) return false;
      const message = failure instanceof Error ? failure.message : "Unable to load workspace members.";
      if (failure instanceof WorkspaceRequestError && failure.status === 401) expireSession(message);
      else setData(previous => ({ ...previous, loading: false, refreshing: false, error: message,
        ...(failure instanceof WorkspaceRequestError && [403, 404].includes(failure.status) ? { workspace: null, invitations: [] } : {}) }));
      return false;
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        if (reloadRequested.current && !pauseRefresh.current && !expired.current && !document.hidden) {
          reloadRequested.current = false;
          void loadMembers();
        }
      }
    }
  }, [expireSession]);
  const refresh = useCallback(() => {
    if (expired.current) return Promise.resolve(false);
    setData(previous => ({ ...previous, refreshing: true }));
    return load();
  }, [load]);
  const selectWorkspace = useCallback((id: string) => {
    selected.current = id;
    setData(previous => ({ ...previous, workspace: null, invitations: [], loading: true, error: "" }));
    void load();
  }, [load]);
  useEffect(() => {
    void load();
    const quietlyRefresh = () => {
      if (document.hidden || pauseRefresh.current || expired.current) return;
      if (inFlight.current) reloadRequested.current = true;
      else void load();
    };
    window.addEventListener("focus", quietlyRefresh);
    document.addEventListener("visibilitychange", quietlyRefresh);
    const unsubscribe = subscribeToMembersChanges(id => { if (!selected.current || id === selected.current) quietlyRefresh(); });
    const timer = window.setInterval(quietlyRefresh, 30_000);
    return () => {
      reloadRequested.current = false;
      inFlight.current?.abort(); window.clearInterval(timer); unsubscribe();
      window.removeEventListener("focus", quietlyRefresh); document.removeEventListener("visibilitychange", quietlyRefresh);
    };
  }, [load]);
  return { ...data, refresh, load, selectWorkspace, expireSession, setRefreshPaused };
}
