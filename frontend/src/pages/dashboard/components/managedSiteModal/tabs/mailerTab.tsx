import React from "react";
import type { TabType } from "../types";
import { CheckCircle2 } from "lucide-react";

/** What renderMailerTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface MailerTabDeps {
  actionLoading: boolean;
  activeTab: TabType;
  handleSaveMailer: (e: React.FormEvent<Element>) => Promise<void>;
  handleTestMailer: () => Promise<void>;
  mailerForm: { host: string; port: number; username: string; password: string; fromName: string; fromEmail: string; };
  mailerVerified: boolean;
  setMailerForm: React.Dispatch<React.SetStateAction<{ host: string; port: number; username: string; password: string; fromName: string; fromEmail: string; }>>;
  setTestRecipient: React.Dispatch<React.SetStateAction<string>>;
  testRecipient: string;
}

/**
 * Site mailer (SMTP) tab.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 2162-2272 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderMailerTab({
  actionLoading,
  activeTab,
  handleSaveMailer,
  handleTestMailer,
  mailerForm,
  mailerVerified,
  setMailerForm,
  setTestRecipient,
  testRecipient,
}: MailerTabDeps): React.ReactNode {
  return (
              activeTab === "mailer" && (
                <form onSubmit={handleSaveMailer} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Dedicated SMTP Dispatcher</h3>
                      <p className="text-xs text-slate-400">Configure transactional outbound mail credentials for this website</p>
                    </div>
                    {mailerVerified && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 flex items-center gap-1 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">SMTP Host</label>
                      <input
                        type="text"
                        placeholder="smtp.mailgun.org"
                        value={mailerForm.host}
                        onChange={(e) => setMailerForm({ ...mailerForm, host: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Port</label>
                      <input
                        type="number"
                        placeholder="587"
                        value={mailerForm.port}
                        onChange={(e) => setMailerForm({ ...mailerForm, port: parseInt(e.target.value) || 587 })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Username</label>
                      <input
                        type="text"
                        placeholder="postmaster@yourdomain.com"
                        value={mailerForm.username}
                        onChange={(e) => setMailerForm({ ...mailerForm, username: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Password / API Secret</label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={mailerForm.password}
                        onChange={(e) => setMailerForm({ ...mailerForm, password: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">From Name</label>
                      <input
                        type="text"
                        placeholder="My Awesome Site"
                        value={mailerForm.fromName}
                        onChange={(e) => setMailerForm({ ...mailerForm, fromName: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">From Email Address</label>
                      <input
                        type="email"
                        placeholder="noreply@yourdomain.com"
                        value={mailerForm.fromEmail}
                        onChange={(e) => setMailerForm({ ...mailerForm, fromEmail: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        placeholder="test-recipient@example.com"
                        value={testRecipient}
                        onChange={(e) => setTestRecipient(e.target.value)}
                        className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleTestMailer}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
                      >
                        Send Test Email
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition disabled:opacity-50"
                    >
                      {actionLoading ? "Saving..." : "Save SMTP Config"}
                    </button>
                  </div>
                </form>
              )
  );
}
