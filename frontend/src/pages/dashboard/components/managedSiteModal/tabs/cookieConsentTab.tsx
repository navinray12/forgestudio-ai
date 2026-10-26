import React from "react";
import type { TabType } from "../types";

/** What renderCookieConsentTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface CookieConsentTabDeps {
  actionLoading: boolean;
  activeTab: TabType;
  cookieForm: { enabled: boolean; message: string; buttonText: string; policyUrl: string; theme: "dark" | "light"; };
  handleSaveCookieConsent: (e: React.FormEvent<Element>) => Promise<void>;
  setCookieForm: React.Dispatch<React.SetStateAction<{ enabled: boolean; message: string; buttonText: string; policyUrl: string; theme: "dark" | "light"; }>>;
}

/**
 * Cookie consent tab.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 2336-2412 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderCookieConsentTab({
  actionLoading,
  activeTab,
  cookieForm,
  handleSaveCookieConsent,
  setCookieForm,
}: CookieConsentTabDeps): React.ReactNode {
  return (
              activeTab === "cookie-consent" && (
                <form onSubmit={handleSaveCookieConsent} className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Cookie Consent Banner</h3>
                      <p className="text-slate-400">Configure client-side consent prompt for published visitors</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cookieForm.enabled}
                        onChange={(e) => setCookieForm({ ...cookieForm, enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-2 font-bold text-slate-200">{cookieForm.enabled ? "Active" : "Disabled"}</span>
                    </label>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="font-semibold text-slate-300 block mb-1">Banner Prompt Message</label>
                      <textarea
                        rows={2}
                        value={cookieForm.message}
                        onChange={(e) => setCookieForm({ ...cookieForm, message: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-slate-300 block mb-1">Accept Button Text</label>
                        <input
                          type="text"
                          value={cookieForm.buttonText}
                          onChange={(e) => setCookieForm({ ...cookieForm, buttonText: e.target.value })}
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-300 block mb-1">Visual Theme</label>
                        <select
                          value={cookieForm.theme}
                          onChange={(e) => setCookieForm({ ...cookieForm, theme: e.target.value as "dark" | "light" })}
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                        >
                          <option value="dark">Dark Slate (Glass)</option>
                          <option value="light">Light Crisp</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-300 block mb-1">Privacy Policy URL (Optional)</label>
                      <input
                        type="text"
                        placeholder="https://example.com/privacy"
                        value={cookieForm.policyUrl}
                        onChange={(e) => setCookieForm({ ...cookieForm, policyUrl: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition disabled:opacity-50"
                    >
                      {actionLoading ? "Saving..." : "Save Cookie Consent Settings"}
                    </button>
                  </div>
                </form>
              )
  );
}
