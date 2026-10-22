import React from "react";
import type { ClientBillingConfig } from "../../../../../types/clientBilling.types";
import type { TabType } from "../types";
import { Check, Copy, DollarSign, Mail, RefreshCw, Send, Sliders } from "lucide-react";

/** What renderClientBillingTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface ClientBillingTabDeps {
  actionLoading: boolean;
  activeTab: TabType;
  clientBillingCopied: boolean;
  clientBillingForm: ClientBillingConfig;
  clientBillingLoading: boolean;
  clientInvoiceSending: boolean;
  fetchClientBilling: () => Promise<void>;
  handleSaveClientBilling: () => Promise<void>;
  handleSendClientInvoice: () => Promise<void>;
  setClientBillingCopied: React.Dispatch<React.SetStateAction<boolean>>;
  setClientBillingForm: React.Dispatch<React.SetStateAction<ClientBillingConfig>>;
  website: { id: string; name: string; slug: string; status: string; wpConnection?: { id: string; siteUrl: string; wpSiteName?: string | null | undefined; status: string; lastVerifiedAt?: string | null | undefined; } | null | undefined; };
}

/**
 * Agency client invoicing & markup tab.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 2565-2811 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderClientBillingTab({
  actionLoading,
  activeTab,
  clientBillingCopied,
  clientBillingForm,
  clientBillingLoading,
  clientInvoiceSending,
  fetchClientBilling,
  handleSaveClientBilling,
  handleSendClientInvoice,
  setClientBillingCopied,
  setClientBillingForm,
  website,
}: ClientBillingTabDeps): React.ReactNode {
  return (
              activeTab === "client-billing" && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                        Agency Client Invoicing & Markup Engine
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Add a recurring hosting markup to client sites, calculate agency profit margins, and dispatch custom-branded Stripe checkout links.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                          clientBillingForm.subscriptionStatus === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : clientBillingForm.subscriptionStatus === "PENDING"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        Status: {clientBillingForm.subscriptionStatus}
                      </span>
                      <button
                        onClick={fetchClientBilling}
                        disabled={clientBillingLoading}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="Refresh Client Billing"
                      >
                        <RefreshCw className={`w-4 h-4 ${clientBillingLoading ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Real-time Profit & Margin Calculator */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-blue-400" />
                        Hosting Markup & Pricing Configuration
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-slate-400 block mb-1.5">
                            Platform Base Cost (Wholesale)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-bold">$</span>
                            <input
                              type="number"
                              disabled
                              value={clientBillingForm.baseCostMonthly}
                              className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/60 text-slate-400 text-sm font-semibold cursor-not-allowed"
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 block">Fixed platform infrastructure fee</span>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-300 block mb-1.5">
                            Client Retail Price (Monthly)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-xs text-emerald-400 font-bold">$</span>
                            <input
                              type="number"
                              min={clientBillingForm.baseCostMonthly}
                              value={clientBillingForm.clientPriceMonthly}
                              onChange={(e) => {
                                const newPrice = Math.max(0, Number(e.target.value));
                                const margin = Math.max(0, newPrice - clientBillingForm.baseCostMonthly);
                                setClientBillingForm({
                                  ...clientBillingForm,
                                  clientPriceMonthly: newPrice,
                                  marginMonthly: margin,
                                });
                              }}
                              className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">Amount charged directly to your client</span>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-300 block mb-1.5">Billing Currency</label>
                          <select
                            value={clientBillingForm.currency}
                            onChange={(e) => setClientBillingForm({ ...clientBillingForm, currency: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-blue-500"
                          >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="INR">INR (₹)</option>
                            <option value="CAD">CAD ($)</option>
                            <option value="AUD">AUD ($)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-300 block mb-1.5">Billing Interval</label>
                          <select
                            value={clientBillingForm.billingInterval}
                            onChange={(e) => setClientBillingForm({ ...clientBillingForm, billingInterval: e.target.value as "month" | "year" })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-blue-500"
                          >
                            <option value="month">Monthly Recurring</option>
                            <option value="year">Annual Upfront</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Calculated Margin Hero Card */}
                    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 to-slate-900 p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                            Net Agency Profit
                          </span>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                            {clientBillingForm.clientPriceMonthly > 0
                              ? Math.round((clientBillingForm.marginMonthly / clientBillingForm.clientPriceMonthly) * 100)
                              : 0}% Margin
                          </span>
                        </div>
                        <div className="text-3xl font-extrabold text-white mt-3">
                          +{clientBillingForm.currency} {clientBillingForm.marginMonthly}
                          <span className="text-xs font-normal text-slate-400"> / mo</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          Projected profit on this single client website:
                        </p>
                      </div>

                      <div className="pt-4 border-t border-emerald-500/20 mt-4 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Annual Client Revenue:</span>
                          <span className="font-semibold text-slate-200">
                            {clientBillingForm.currency} {clientBillingForm.clientPriceMonthly * 12} / yr
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Annual Agency Profit:</span>
                          <span className="font-bold text-emerald-400">
                            +{clientBillingForm.currency} {clientBillingForm.marginMonthly * 12} / yr
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Client Contact & Checkout Details */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-indigo-400" />
                      Client Details & Checkout Link Dispatch
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">Client Contact Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Jane Doe / Acme Corp"
                          value={clientBillingForm.clientName}
                          onChange={(e) => setClientBillingForm({ ...clientBillingForm, clientName: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">Client Billing Email</label>
                        <input
                          type="email"
                          placeholder="billing@clientcompany.com"
                          value={clientBillingForm.clientEmail}
                          onChange={(e) => setClientBillingForm({ ...clientBillingForm, clientEmail: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Checkout URL Box */}
                    <div className="pt-2">
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Client Direct Payment URL
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={clientBillingForm.clientInvoiceUrl || `https://pay.forgestudio.io/c/${website.slug || website.id}`}
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 font-mono text-xs text-slate-300 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            const url = clientBillingForm.clientInvoiceUrl || `https://pay.forgestudio.io/c/${website.slug || website.id}`;
                            navigator.clipboard.writeText(url);
                            setClientBillingCopied(true);
                            setTimeout(() => setClientBillingCopied(false), 2000);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                        >
                          {clientBillingCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                      <p className="text-xs text-slate-400">
                        {clientBillingForm.lastBilledAt
                          ? `Last invoice dispatched: ${new Date(clientBillingForm.lastBilledAt).toLocaleDateString()}`
                          : "Client has not yet been invoiced."}
                      </p>
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={handleSaveClientBilling}
                          disabled={actionLoading}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
                        >
                          Save Markup Settings
                        </button>
                        <button
                          onClick={handleSendClientInvoice}
                          disabled={clientInvoiceSending}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition"
                        >
                          <Send className={`w-3.5 h-3.5 ${clientInvoiceSending ? "animate-pulse" : ""}`} />
                          <span>{clientInvoiceSending ? "Sending..." : "Send Client Invoice Email"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
  );
}
