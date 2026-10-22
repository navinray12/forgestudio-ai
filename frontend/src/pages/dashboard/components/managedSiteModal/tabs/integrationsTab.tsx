import React from "react";
import type { TabType } from "../types";
import { CheckCircle2, RefreshCw, Share2 } from "lucide-react";

/** What renderIntegrationsTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface IntegrationsTabDeps {
  activeTab: TabType;
  handleTestIntegration: (type: "google-sheets" | "mailchimp" | "zapier") => Promise<void>;
  integrationsForm: { googleSheetsWebhookUrl: string; mailchimpApiKey: string; mailchimpListId: string; zapierWebhookUrl: string; };
  setIntegrationsForm: React.Dispatch<React.SetStateAction<{ googleSheetsWebhookUrl: string; mailchimpApiKey: string; mailchimpListId: string; zapierWebhookUrl: string; }>>;
  testingIntegration: string | null;
}

/**
 * Lead & external integrations tab (Google Sheets, Mailchimp, Zapier).
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 2414-2563 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderIntegrationsTab({
  activeTab,
  handleTestIntegration,
  integrationsForm,
  setIntegrationsForm,
  testingIntegration,
}: IntegrationsTabDeps): React.ReactNode {
  return (
              activeTab === "integrations" && (
                <div className="space-y-6 text-xs">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Share2 className="w-5 h-5 text-indigo-400" />
                      Lead Integrations & Webhook Connectors
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Connect your site to external marketing and productivity platforms for real-time lead distribution.
                    </p>
                  </div>

                  {/* 1. Google Sheets */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📊</span>
                        <div>
                          <h4 className="font-bold text-white text-sm">Google Sheets Connector</h4>
                          <p className="text-slate-400 text-[11px]">
                            Automatically append incoming form submissions to your Google Sheet in real-time.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTestIntegration("google-sheets")}
                        disabled={testingIntegration === "google-sheets"}
                        className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-semibold transition flex items-center gap-1.5"
                      >
                        {testingIntegration === "google-sheets" ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Test Row Append</span>
                      </button>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-300 block mb-1">Google Web App / Script URL</label>
                      <input
                        type="text"
                        placeholder="https://script.google.com/macros/s/.../exec"
                        value={integrationsForm.googleSheetsWebhookUrl}
                        onChange={(e) =>
                          setIntegrationsForm({ ...integrationsForm, googleSheetsWebhookUrl: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* 2. Mailchimp */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🐵</span>
                        <div>
                          <h4 className="font-bold text-white text-sm">Mailchimp Audience Sync</h4>
                          <p className="text-slate-400 text-[11px]">
                            Automatically create or update newsletter subscribers with merge fields.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTestIntegration("mailchimp")}
                        disabled={testingIntegration === "mailchimp"}
                        className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold transition flex items-center gap-1.5"
                      >
                        {testingIntegration === "mailchimp" ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Test API Ping</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-semibold text-slate-300 block mb-1">Mailchimp API Key</label>
                        <input
                          type="password"
                          placeholder="xxxxxxxxxxxxxxxxxxxxxxxx-us1"
                          value={integrationsForm.mailchimpApiKey}
                          onChange={(e) =>
                            setIntegrationsForm({ ...integrationsForm, mailchimpApiKey: e.target.value })
                          }
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-300 block mb-1">Audience List ID</label>
                        <input
                          type="text"
                          placeholder="e.g. 84a7e3d1c9"
                          value={integrationsForm.mailchimpListId}
                          onChange={(e) =>
                            setIntegrationsForm({ ...integrationsForm, mailchimpListId: e.target.value })
                          }
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Zapier */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">⚡</span>
                        <div>
                          <h4 className="font-bold text-white text-sm">Zapier Catch Hook</h4>
                          <p className="text-slate-400 text-[11px]">
                            Trigger multi-step Zapier automated workflows on incoming leads.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTestIntegration("zapier")}
                        disabled={testingIntegration === "zapier"}
                        className="px-3 py-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 font-semibold transition flex items-center gap-1.5"
                      >
                        {testingIntegration === "zapier" ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Send Test Webhook</span>
                      </button>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-300 block mb-1">Zapier Webhook Catch URL</label>
                      <input
                        type="text"
                        placeholder="https://hooks.zapier.com/hooks/catch/..."
                        value={integrationsForm.zapierWebhookUrl}
                        onChange={(e) =>
                          setIntegrationsForm({ ...integrationsForm, zapierWebhookUrl: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )
  );
}
