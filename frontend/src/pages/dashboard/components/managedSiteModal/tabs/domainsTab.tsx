import React from "react";
import type { TabType } from "../types";
import { AlertCircle, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Globe, Lock, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

/** What renderDomainsTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface DomainsTabDeps {
  actionLoading: boolean;
  activeTab: TabType;
  copiedKey: string | null;
  domainAdding: boolean;
  domains: any[];
  domainsLoading: boolean;
  expandedDnsDomain: string | null;
  fetchDomains: () => Promise<void>;
  handleAddDomain: (e: React.FormEvent<Element>) => Promise<void>;
  handleCopy: (text: string, key: string) => void;
  handleSetPrimaryDomain: (domainName: string) => Promise<void>;
  handleVerifyDomain: (domainName: string) => Promise<void>;
  newDomainInput: string;
  setDeleteDomainConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteDomainTarget: React.Dispatch<React.SetStateAction<string | null>>;
  setExpandedDnsDomain: React.Dispatch<React.SetStateAction<string | null>>;
  setNewDomainInput: React.Dispatch<React.SetStateAction<string>>;
  verifyingDomain: string | null;
}

/**
 * Custom domains & DNS tab.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 3202-3510 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderDomainsTab({
  actionLoading,
  activeTab,
  copiedKey,
  domainAdding,
  domains,
  domainsLoading,
  expandedDnsDomain,
  fetchDomains,
  handleAddDomain,
  handleCopy,
  handleSetPrimaryDomain,
  handleVerifyDomain,
  newDomainInput,
  setDeleteDomainConfirmOpen,
  setDeleteDomainTarget,
  setExpandedDnsDomain,
  setNewDomainInput,
  verifyingDomain,
}: DomainsTabDeps): React.ReactNode {
  return (
              activeTab === "domains" && (
                <div className="space-y-6">
                  {/* Header & Refresh */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-400" />
                        Custom Domains & DNS Routing
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Attach custom branded domains, configure routing DNS records, and automate SSL certificate provisioning.
                      </p>
                    </div>
                    <button
                      onClick={fetchDomains}
                      disabled={domainsLoading}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition self-start sm:self-auto"
                      title="Refresh Domains"
                    >
                      <RefreshCw className={`w-4 h-4 ${domainsLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {/* Connect Domain Form Card */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                    <form onSubmit={handleAddDomain} className="space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Plus className="w-4 h-4 text-blue-400" />
                        Connect New Custom Domain
                      </h4>
                      <p className="text-xs text-slate-400">
                        Enter your domain or subdomain (e.g. <span className="font-mono text-slate-300">mybrand.com</span> or <span className="font-mono text-slate-300">shop.mybrand.com</span>).
                      </p>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">https://</span>
                          <input
                            type="text"
                            required
                            value={newDomainInput}
                            onChange={(e) => setNewDomainInput(e.target.value)}
                            placeholder="mybrand.com"
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-16 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={domainAdding || !newDomainInput.trim()}
                          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition disabled:opacity-50 whitespace-nowrap"
                        >
                          {domainAdding ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              Connect Domain
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Connected Domains Table */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Connected Domains ({domains.length})
                      </h4>
                    </div>

                    {domainsLoading ? (
                      <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-950/40 text-xs text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                        Loading domains...
                      </div>
                    ) : domains.length === 0 ? (
                      <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-950/40 text-xs text-slate-500">
                        <Globe className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        No custom domains connected yet. Connect your custom domain above to establish your production branding.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {domains.map((d: any) => {
                          const isVerified = d.status === "active";
                          const isExpanded = expandedDnsDomain === d.domain;
                          const isVerifying = verifyingDomain === d.domain;

                          return (
                            <div
                              key={d.domain}
                              className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden"
                            >
                              {/* Domain Summary Row */}
                              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/30">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-sm text-white font-mono">{d.domain}</span>
                                    <a
                                      href={`https://${d.domain}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-slate-400 hover:text-blue-400 transition"
                                      title="Open domain"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    {d.isPrimary && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        Primary Domain
                                      </span>
                                    )}
                                    {/* Upgraded Modern Status Badge (F-Scope 2) */}
                                    {d.sslStatus === "ACTIVE" || (isVerified && d.sslEnabled) ? (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-xs">
                                        <Lock className="w-3 h-3 text-emerald-400" />
                                        SSL Active
                                      </span>
                                    ) : isVerifying || d.sslStatus === "VERIFYING" ? (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 animate-pulse">
                                        <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                                        Verifying DNS
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                                        <AlertCircle className="w-3 h-3 text-amber-400" />
                                        Action Needed
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Added on {new Date(d.addedAt).toLocaleDateString()}
                                    {d.verifiedAt && ` • Verified on ${new Date(d.verifiedAt).toLocaleDateString()}`}
                                  </div>
                                </div>

                                {/* Row Actions */}
                                <div className="flex items-center gap-2 self-end sm:self-center">
                                  {(!isVerified || d.sslStatus !== "ACTIVE") && (
                                    <button
                                      onClick={() => handleVerifyDomain(d.domain)}
                                      disabled={isVerifying}
                                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
                                    >
                                      <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin" : ""}`} />
                                      <span>{isVerifying ? "Issuing SSL..." : "Verify DNS & Issue SSL"}</span>
                                    </button>
                                  )}
                                  {isVerified && !d.isPrimary && (
                                    <button
                                      onClick={() => handleSetPrimaryDomain(d.domain)}
                                      disabled={actionLoading}
                                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                                    >
                                      Set as Primary
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setExpandedDnsDomain(isExpanded ? null : d.domain)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                                    title="Toggle DNS Instructions"
                                  >
                                    <span>DNS Records</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteDomainTarget(d.domain);
                                      setDeleteDomainConfirmOpen(true);
                                    }}
                                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
                                    title="Disconnect domain"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Expandable DNS Records Card */}
                              {isExpanded && (
                                <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                                      <span>Required DNS Records for</span>
                                      <span className="font-mono text-blue-400">{d.domain}</span>
                                    </div>
                                    <span className="text-[11px] text-slate-400">
                                      Configure at your DNS provider (e.g. Cloudflare, Namecheap, GoDaddy)
                                    </span>
                                  </div>

                                  <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/90">
                                    <table className="w-full text-left text-xs text-slate-300">
                                      <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                                        <tr>
                                          <th className="px-3.5 py-2.5">Type</th>
                                          <th className="px-3.5 py-2.5">Host / Name</th>
                                          <th className="px-3.5 py-2.5">Value / Target</th>
                                          <th className="px-3.5 py-2.5">TTL</th>
                                          <th className="px-3.5 py-2.5 text-right">Copy</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                                        {[
                                          { type: "A", name: "@", value: "76.76.21.21", ttl: 3600 },
                                          { type: "CNAME", name: "www", value: "cname.forgestudio.app", ttl: 3600 },
                                          {
                                            type: "TXT",
                                            name: "_forgestudio-challenge",
                                            value: d.verificationToken,
                                            ttl: 300,
                                          },
                                        ].map((record) => {
                                          const copyKey = `${d.domain}_${record.type}_${record.name}`;
                                          const isCopied = copiedKey === copyKey;
                                          return (
                                            <tr key={record.type + record.name} className="hover:bg-slate-800/40 transition">
                                              <td className="px-3.5 py-2 font-bold text-blue-400">{record.type}</td>
                                              <td className="px-3.5 py-2 text-slate-200">{record.name}</td>
                                              <td className="px-3.5 py-2 text-slate-300 truncate max-w-[240px]" title={record.value}>
                                                {record.value}
                                              </td>
                                              <td className="px-3.5 py-2 text-slate-400">{record.ttl}</td>
                                              <td className="px-3.5 py-2 text-right">
                                                <button
                                                  onClick={() => handleCopy(record.value, copyKey)}
                                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-[10px]"
                                                >
                                                  {isCopied ? (
                                                    <>
                                                      <Check className="w-3 h-3 text-emerald-400" />
                                                      <span className="text-emerald-400">Copied</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Copy className="w-3 h-3" />
                                                      <span>Copy</span>
                                                    </>
                                                  )}
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* SSL Certificate & Auto-Renewal Diagnostic Card */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-900/60 text-xs">
                                    <div>
                                      <div className="text-[10px] font-bold text-slate-500 uppercase">Certificate Authority</div>
                                      <div className="font-semibold text-slate-200 mt-0.5">
                                        {d.sslIssuer || "Let's Encrypt Authority X3 (ACME v2)"}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold text-slate-500 uppercase">Auto-Renewal</div>
                                      <div className="font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>Automated Every 90 Days</span>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold text-slate-500 uppercase">Certificate Expiration</div>
                                      <div className="font-semibold text-slate-300 mt-0.5">
                                        {d.sslExpiresAt ? new Date(d.sslExpiresAt).toLocaleDateString() : "Provisioning on verify"}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Pre-Flight DNS Diagnostic Notice */}
                                  {d.dnsPreflight?.errors && d.dnsPreflight.errors.length > 0 && (
                                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 space-y-1 text-xs text-amber-200">
                                      <div className="font-bold flex items-center gap-1.5 text-amber-400">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>Pre-Flight DNS Diagnostic Notice:</span>
                                      </div>
                                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-300/90 pl-1">
                                        {d.dnsPreflight.errors.map((err: string, i: number) => (
                                          <li key={i}>{err}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                                    <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
                                    <span>
                                      Global DNS propagation can take anywhere from a few minutes to up to 24-48 hours. Once propagated, click <strong>Verify DNS & Issue SSL</strong> to activate your edge certificate.
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
  );
}
