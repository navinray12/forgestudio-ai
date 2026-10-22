import React from "react";
import type { TabType } from "../types";
import { Key, Lock, RefreshCw, Shield, ShieldAlert, ShieldCheck, Zap } from "lucide-react";

/** What renderSecurityTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface SecurityTabDeps {
  activeTab: TabType;
  cdnSaving: boolean;
  fetchSecurityOverview: () => Promise<void>;
  firewallForm: { mode: "allow" | "deny"; ipsText: string; };
  firewallSaving: boolean;
  handlePurgeCache: () => Promise<void>;
  handleRunSecurityAudit: () => Promise<void>;
  handleSaveFirewall: (e: React.FormEvent<Element>) => Promise<void>;
  handleSavePrivacy: (e: React.FormEvent<Element>) => Promise<void>;
  handleSaveSiteLock: (e: React.FormEvent<Element>) => Promise<void>;
  handleToggleCdn: (enabled: boolean) => Promise<void>;
  privacyForm: { noIndex: boolean; maintenanceMode: boolean; };
  privacySaving: boolean;
  purgingCache: boolean;
  scanningSecurity: boolean;
  securityLoading: boolean;
  securityOverview: any;
  setFirewallForm: React.Dispatch<React.SetStateAction<{ mode: "allow" | "deny"; ipsText: string; }>>;
  setPrivacyForm: React.Dispatch<React.SetStateAction<{ noIndex: boolean; maintenanceMode: boolean; }>>;
  setSiteLockForm: React.Dispatch<React.SetStateAction<{ enabled: boolean; password: string; hint: string; }>>;
  siteLockForm: { enabled: boolean; password: string; hint: string; };
  siteLockSaving: boolean;
}

/**
 * Security & access tab: site lock, privacy, IP firewall, security audit, cache and CDN.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 3849-4177 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderSecurityTab({
  activeTab,
  cdnSaving,
  fetchSecurityOverview,
  firewallForm,
  firewallSaving,
  handlePurgeCache,
  handleRunSecurityAudit,
  handleSaveFirewall,
  handleSavePrivacy,
  handleSaveSiteLock,
  handleToggleCdn,
  privacyForm,
  privacySaving,
  purgingCache,
  scanningSecurity,
  securityLoading,
  securityOverview,
  setFirewallForm,
  setPrivacyForm,
  setSiteLockForm,
  siteLockForm,
  siteLockSaving,
}: SecurityTabDeps): React.ReactNode {
  return (
              activeTab === "security" && (
                <div className="space-y-6">
                  {/* Header & Refresh */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-400" />
                        Security, Privacy & Edge Shield
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Automated vulnerability heuristics, password protection, search engine indexing, and edge firewall rules.
                      </p>
                    </div>
                    <button
                      onClick={fetchSecurityOverview}
                      disabled={securityLoading}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition self-start sm:self-auto"
                      title="Refresh Security Status"
                    >
                      <RefreshCw className={`w-4 h-4 ${securityLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {/* Security Health Audit Card */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl border ${
                          (securityOverview?.lastSecurityAudit?.score ?? 100) >= 90
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-white">
                              {securityOverview?.lastSecurityAudit?.score ?? 100} / 100
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              (securityOverview?.lastSecurityAudit?.score ?? 100) >= 90
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            }`}>
                              Shield Active — {securityOverview?.lastSecurityAudit?.status || "Clean"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Last full heuristic audit: {securityOverview?.lastSecurityAudit?.scannedAt ? new Date(securityOverview.lastSecurityAudit.scannedAt).toLocaleString() : "Just now"}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleRunSecurityAudit}
                        disabled={scanningSecurity}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${scanningSecurity ? "animate-spin" : ""}`} />
                        <span>{scanningSecurity ? "Analyzing DOM & Scripts..." : "Run Security Scan Now"}</span>
                      </button>
                    </div>

                    {/* Checklist of Heuristic Checks */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {(securityOverview?.lastSecurityAudit?.checks || [
                        { id: "mixed_content", name: "Insecure Mixed Content", status: "PASS", details: "All media, styles, and scripts enforce HTTPS encryption" },
                        { id: "script_eval", name: "Script Injection Heuristics", status: "PASS", details: "No eval() sinks or dangerous javascript: pseudo-protocols found" },
                        { id: "malware_sig", name: "Malware & Iframe Signatures", status: "PASS", details: "Zero suspicious cross-origin frames or script obfuscation detected" },
                        { id: "ssl_baseline", name: "SSL Transport Integrity", status: "PASS", details: "Edge TLS 1.3 enforced for public visitor routing" },
                      ]).map((check: any) => (
                        <div key={check.id} className="p-3 rounded-lg border border-slate-800/90 bg-slate-900/60 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-200">{check.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              check.status === "PASS"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : check.status === "WARN"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-red-500/10 text-red-400"
                            }`}>
                              {check.status === "PASS" ? "PASS" : "ATTENTION"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{check.details}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Client Site Lock Card */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <Lock className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Client Site Lock</h4>
                            <p className="text-[11px] text-slate-400">Password-protect entire public website</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={siteLockForm.enabled}
                            onChange={(e) => setSiteLockForm({ ...siteLockForm, enabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      <form onSubmit={handleSaveSiteLock} className="space-y-3 text-xs">
                        <p className="text-[11px] text-slate-400">
                          When active, public visitors will be prompted for this password before they can view any pages.
                        </p>
                        {siteLockForm.enabled && (
                          <div className="space-y-3 pt-1">
                            <div>
                              <label className="block font-semibold text-slate-300 mb-1">
                                Site Access Password {securityOverview?.siteLock?.hasPassword ? "(Leave blank to keep existing)" : ""}
                              </label>
                              <input
                                type="password"
                                value={siteLockForm.password}
                                onChange={(e) => setSiteLockForm({ ...siteLockForm, password: e.target.value })}
                                placeholder={securityOverview?.siteLock?.hasPassword ? "••••••••••••" : "Enter access password..."}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-300 mb-1">Password Hint (Optional)</label>
                              <input
                                type="text"
                                value={siteLockForm.hint}
                                onChange={(e) => setSiteLockForm({ ...siteLockForm, hint: e.target.value })}
                                placeholder="e.g. Staging review passkey"
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                        <div className="pt-2">
                          <button
                            type="submit"
                            disabled={siteLockSaving}
                            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition disabled:opacity-50"
                          >
                            {siteLockSaving ? "Saving Site Lock..." : "Save Site Lock Settings"}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Search Engine Privacy & Maintenance Mode Card */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
                      <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
                        <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Search Privacy & Maintenance</h4>
                          <p className="text-[11px] text-slate-400">Control indexing and public availability</p>
                        </div>
                      </div>

                      <form onSubmit={handleSavePrivacy} className="space-y-4 text-xs">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                          <div>
                            <div className="font-semibold text-slate-200">Discourage Search Engine Indexing</div>
                            <p className="text-[11px] text-slate-400 mt-0.5">Injects noindex & nofollow robot tags into all pages</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={privacyForm.noIndex}
                              onChange={(e) => setPrivacyForm({ ...privacyForm, noIndex: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                          <div>
                            <div className="font-semibold text-slate-200">Maintenance Mode Splash</div>
                            <p className="text-[11px] text-slate-400 mt-0.5">Show an "Under Maintenance" holding screen to visitors</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={privacyForm.maintenanceMode}
                              onChange={(e) => setPrivacyForm({ ...privacyForm, maintenanceMode: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                          </label>
                        </div>

                        <div>
                          <button
                            type="submit"
                            disabled={privacySaving}
                            className="w-full rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-teal-500/20 transition disabled:opacity-50"
                          >
                            {privacySaving ? "Saving Privacy..." : "Save Privacy Settings"}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* IP Access Firewall Card */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                            <ShieldAlert className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">IP Access Firewall</h4>
                            <p className="text-[11px] text-slate-400">Network-level visitor filtering</p>
                          </div>
                        </div>
                        <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setFirewallForm({ ...firewallForm, mode: "deny" })}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded ${
                              firewallForm.mode === "deny"
                                ? "bg-red-500 text-white"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            Denylist
                          </button>
                          <button
                            type="button"
                            onClick={() => setFirewallForm({ ...firewallForm, mode: "allow" })}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded ${
                              firewallForm.mode === "allow"
                                ? "bg-emerald-600 text-white"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            Allowlist
                          </button>
                        </div>
                      </div>

                      <form onSubmit={handleSaveFirewall} className="space-y-3 text-xs">
                        <p className="text-[11px] text-slate-400">
                          {firewallForm.mode === "deny"
                            ? "Block incoming requests from the following IP addresses or CIDR blocks:"
                            : "Restrict website access exclusively to the following IP addresses:"}
                        </p>
                        <textarea
                          rows={3}
                          value={firewallForm.ipsText}
                          onChange={(e) => setFirewallForm({ ...firewallForm, ipsText: e.target.value })}
                          placeholder={"192.168.1.1\n10.0.0.0/24"}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 font-mono text-xs text-white focus:border-red-500 focus:outline-none"
                        />
                        <div>
                          <button
                            type="submit"
                            disabled={firewallSaving}
                            className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
                          >
                            {firewallSaving ? "Updating Firewall..." : "Save Firewall Rules"}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Edge Cache & Cloudflare CDN Card */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
                      <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
                        <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Edge Cache & Cloudflare CDN</h4>
                          <p className="text-[11px] text-slate-400">Global content acceleration and cache invalidation</p>
                        </div>
                      </div>

                      <div className="space-y-4 text-xs">
                        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-200">Purge Dynamic Edge Cache</div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Last purged: {securityOverview?.cache?.lastPurgedAt ? new Date(securityOverview.cache.lastPurgedAt).toLocaleString() : "Never"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handlePurgeCache}
                            disabled={purgingCache}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold shadow-md shadow-orange-500/20 transition disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${purgingCache ? "animate-spin" : ""}`} />
                            <span>{purgingCache ? "Purging..." : "Purge Cache"}</span>
                          </button>
                        </div>

                        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-200">Cloudflare Edge Proxy</div>
                            <p className="text-[11px] text-slate-400 mt-0.5">Accelerate assets with Cloudflare edge caching</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={securityOverview?.cdn?.cloudflareEnabled || false}
                              disabled={cdnSaving}
                              onChange={(e) => handleToggleCdn(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
  );
}
