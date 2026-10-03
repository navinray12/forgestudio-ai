import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  billingInterval: string;
  websiteLimit: number;
  storageLimitMb: number;
  aiCreditLimit: number;
  features?: string[] | Record<string, any>;
  isActive: boolean;
}

interface SubscriptionInfo {
  id: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  plan: Plan;
}

interface Invoice {
  id: string;
  planId: string;
  amount: number;
  currency: string;
  status: string;
  invoiceNumber: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  createdAt: string;
}

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const defaultPlans: Plan[] = [
    {
      id: "free-tier",
      name: "Starter (Free)",
      slug: "free",
      price: 0,
      currency: "USD",
      billingInterval: "month",
      websiteLimit: 3,
      storageLimitMb: 500,
      aiCreditLimit: 50,
      features: [
        "Up to 3 Active Websites",
        "50 AI Generation Credits / month",
        "Responsive Drag-and-Drop Builder",
        "Standard Global CDN Hosting",
        "Community Support",
      ],
      isActive: true,
    },
    {
      id: "pro-tier",
      name: "Professional",
      slug: "professional",
      price: 29,
      currency: "USD",
      billingInterval: "month",
      websiteLimit: 15,
      storageLimitMb: 10000,
      aiCreditLimit: 500,
      features: [
        "Up to 15 Active Websites",
        "500 AI Generation & Design Credits",
        "Custom Code & Full AST Preview Sandbox",
        "Custom Domains & SSL Certificates",
        "Priority High-Speed Rendering",
        "Export Complete Source Bundles",
      ],
      isActive: true,
    },
    {
      id: "agency-tier",
      name: "Agency & Enterprise",
      slug: "agency",
      price: 79,
      currency: "USD",
      billingInterval: "month",
      websiteLimit: 50,
      storageLimitMb: 50000,
      aiCreditLimit: 2000,
      features: [
        "Unlimited / 50 Client Websites",
        "2,000 AI Credits + Claude 3.7 & Stitch",
        "White-label Branding & Custom Domain",
        "Team Role-Based Access Control",
        "Granular Permission Management",
        "24/7 Dedicated Priority SLA",
      ],
      isActive: true,
    },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const authHeaders = getAuthHeaders();

      // 1. Fetch current subscription
      try {
        const subRes = await fetch(`${apiUrl}/api/v1/subscriptions/current`, {
          credentials: "include",
          headers: { ...authHeaders },
        });
        if (subRes.ok) {
          const subData = await subRes.json();
          if (subData?.data?.subscription) {
            setSubscription(subData.data.subscription);
          }
        }
      } catch (e) {
        console.warn("Could not retrieve current subscription:", e);
      }

      // 2. Fetch all active plans
      try {
        const plansRes = await fetch(`${apiUrl}/api/v1/subscriptions/plans`, {
          credentials: "include",
          headers: { ...authHeaders },
        });
        if (plansRes.ok) {
          const plansData = await plansRes.json();
          if (plansData?.data?.plans && Array.isArray(plansData.data.plans) && plansData.data.plans.length > 0) {
            setPlans(plansData.data.plans);
          } else {
            setPlans(defaultPlans);
          }
        } else {
          setPlans(defaultPlans);
        }
      } catch {
        setPlans(defaultPlans);
      }

      // 3. Fetch invoices
      try {
        const invRes = await fetch(`${apiUrl}/api/v1/subscriptions/invoices`, {
          credentials: "include",
          headers: { ...authHeaders },
        });
        if (invRes.ok) {
          const invData = await invRes.json();
          if (invData?.data?.invoices && Array.isArray(invData.data.invoices)) {
            setInvoices(invData.data.invoices);
          }
        }
      } catch (e) {
        console.warn("Could not retrieve invoices:", e);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load subscription information.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    if (subscription?.plan?.slug === plan.slug) return;
    setActionBusy(plan.slug);
    setError("");
    setSuccess("");

    try {
      const authHeaders = getAuthHeaders();
      const res = await fetch(`${apiUrl}/api/v1/subscriptions/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        credentials: "include",
        body: JSON.stringify({ planSlug: plan.slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || "Failed to select plan.");
      }

      setSuccess(`Plan changed to ${plan.name} successfully!`);
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Could not complete plan update.");
    } finally {
      setActionBusy(null);
    }
  };

  const parseFeatures = (features: any): string[] => {
    if (Array.isArray(features)) return features;
    if (typeof features === "object" && features !== null) {
      return Object.entries(features).map(([k, v]) => `${k}: ${v}`);
    }
    return [
      "Responsive visual design editor",
      "Custom components & CSS styling",
      "Full export & publishing tools",
      "Fast global CDN delivery"
    ];
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 font-semibold text-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span>Loading subscription plans…</span>
        </div>
      </main>
    );
  }

  const currentSlug = subscription?.plan?.slug || "free";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <span>←</span>
              <span>Back to Dashboard</span>
            </Link>
            <div>
              <h1 className="text-2xl font-black text-white">Subscription & Plans</h1>
              <p className="text-xs text-slate-400 mt-0.5">Manage your tier, quotas, resource limits, and invoices</p>
            </div>
          </div>

          {subscription && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
              <span className="text-xs text-slate-400">Current Tier:</span>
              <span className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider">
                {subscription.plan?.name || "Free"}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
            </div>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs font-semibold text-red-300 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs font-semibold text-emerald-300 flex items-center justify-between">
            <span>✔ {success}</span>
            <button onClick={() => setSuccess("")} className="text-emerald-400 hover:text-emerald-200">✕</button>
          </div>
        )}

        {/* Current Plan Overview Card */}
        {subscription && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Plan Status</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    subscription.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {subscription.status}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Website Quota</span>
                <div className="mt-1 text-lg font-black text-white">
                  {subscription.plan?.websiteLimit ? `${subscription.plan.websiteLimit} Websites` : "Unlimited"}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">AI Credits</span>
                <div className="mt-1 text-lg font-black text-indigo-400">
                  {subscription.plan?.aiCreditLimit || 0} Credits
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Storage Limit</span>
                <div className="mt-1 text-lg font-black text-white">
                  {subscription.plan?.storageLimitMb || 100} MB
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plans Catalog Grid */}
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">Choose Your Plan</h2>
            <p className="text-xs text-slate-400">Select a tier suited to your workflow and scale</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => {
              const isCurrent = currentSlug === p.slug;
              const featList = parseFeatures(p.features);

              return (
                <div
                  key={p.id}
                  className={`flex flex-col justify-between rounded-2xl border p-6 transition duration-200 ${
                    isCurrent
                      ? "border-indigo-500 bg-indigo-950/20 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-950/50"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-white">{p.name}</h3>
                      {isCurrent && (
                        <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/40">
                          Current Plan
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">
                        {p.price === 0 ? "Free" : `${p.currency === "INR" ? "₹" : "$"}${p.price}`}
                      </span>
                      {p.price > 0 && (
                        <span className="text-xs text-slate-400">/{p.billingInterval || "month"}</span>
                      )}
                    </div>

                    <div className="mt-6 space-y-2.5 border-t border-slate-800/80 pt-4 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>{p.websiteLimit ? `Up to ${p.websiteLimit} Websites` : "Unlimited Websites"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>{p.aiCreditLimit || 0} AI Generation Credits</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>{p.storageLimitMb || 100} MB Cloud Asset Storage</span>
                      </div>
                      {featList.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-slate-400">
                          <span className="text-indigo-400 font-bold">✓</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-800/80">
                    <button
                      type="button"
                      disabled={isCurrent || actionBusy === p.slug}
                      onClick={() => handleSelectPlan(p)}
                      className={`w-full rounded-xl py-2.5 text-xs font-bold transition shadow-sm cursor-pointer ${
                        isCurrent
                          ? "bg-slate-800 text-slate-400 cursor-default"
                          : "bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50"
                      }`}
                    >
                      {actionBusy === p.slug
                        ? "Updating..."
                        : isCurrent
                        ? "Active Plan"
                        : p.price === 0
                        ? "Switch to Free"
                        : `Upgrade to ${p.name}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Past Invoices & History */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white">Billing History & Invoices</h3>
            <button
              onClick={fetchData}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Refresh
            </button>
          </div>

          {invoices.length === 0 ? (
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-8 text-center text-xs text-slate-500">
              No past invoices cataloged yet. Invoices will automatically appear here when billing events are recorded.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/30">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-900/40 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-200">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        {inv.currency === "INR" ? "₹" : "$"}{inv.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300 border border-emerald-500/30">
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
