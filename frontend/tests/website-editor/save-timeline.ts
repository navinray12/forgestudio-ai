/* global vi -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Records, in order, what a save or publish does that other code can observe: document requests
 * (website PUT / publish POST and the Code Workspace source-sync calls), workspace-sync broadcasts,
 * writes of the draft and sync-event localStorage keys, and the status / alert messages as rendered.
 * Messages are recorded when React renders them, so they follow the synchronous side effects of
 * the same handler step. The autosave badge (also role="status") is excluded.
 */
import { API, SITE_ID, type Route_ } from "./editor-harness";

const TRACKED_KEYS = ["forge_workspace_sync_event", `forgestudio_editor_${SITE_ID}`];
const BADGE = /^(Saved( just now| \d+[smh] ago)?|Saving.*|Unsaved changes|Save failed)$/;
const DOCUMENT_REQUEST = new RegExp(`^${API.replace(/[.:/]/g, (c) => "\\" + c)}/api/(websites/${SITE_ID}(/publish)?|v1/projects/.*)$`);

export function recordTimeline() {
  const events: string[] = [];
  const broadcasts: unknown[] = [];
  class RecordingChannel {
    name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    constructor(name: string) { this.name = name; }
    postMessage(message: any) { broadcasts.push(message); events.push(`broadcast ${this.name} ${message?.type} v${message?.documentVersion}`); }
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return false; }
  }
  vi.stubGlobal("BroadcastChannel", RecordingChannel);
  const realSetItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
    if (TRACKED_KEYS.includes(key)) events.push(`storage ${key}`);
    return realSetItem.call(this, key, value);
  });
  const route: Route_ = (r) => {
    if (r.method !== "GET" && DOCUMENT_REQUEST.test(r.url)) events.push(`${r.method} ${r.url.slice(API.length)}`);
    return undefined;
  };
  const shown = { status: "", alert: "" };
  const scan = () => {
    const status = [...document.querySelectorAll('[role="status"]')].map((n) => n.textContent?.trim() ?? "").filter((t) => t && !BADGE.test(t)).join(" | ");
    const alert = [...document.querySelectorAll('span[role="alert"]')].map((n) => n.textContent?.trim() ?? "").filter(Boolean).join(" | ");
    if (status !== shown.status) { shown.status = status; events.push(`status ${status || "(cleared)"}`); }
    if (alert !== shown.alert) { shown.alert = alert; events.push(`alert ${alert || "(cleared)"}`); }
  };
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  return {
    events,
    broadcasts,
    route,
    /** Events recorded after the given index (e.g. from just before an action). */
    since: (index: number) => events.slice(index),
    stop: () => observer.disconnect(),
  };
}
