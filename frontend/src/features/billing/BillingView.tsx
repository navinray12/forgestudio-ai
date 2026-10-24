import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Download, FileText, ShieldCheck, Sparkles, Star, MessageSquare, ChevronRight, CalendarDays, Crown } from "lucide-react";
import { workspaceRequest, type WorkspaceSummary } from "../workspaces/workspace-api";
import BillingProfile from "./BillingProfile";
import "./BillingDashboard.css";

const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
type Invoice = { id: string; number: string; amount: number; currency: string; status: string; issuedAt: string; periodStart?: string; periodEnd?: string; downloadUrl: string | null };
type Dashboard = { subscription: { planKey: string; status: string; currentPeriodEnd: string | null } | null; plans: { key: string; name: string }[]; invoices: Invoice[]; paymentMethods: { id: string; brand: string; last4: string; expiry: string }[]; subscriptionDetails: { amount: number | null; currency: string; interval: string; status: string; nextBilling: string | null } | null; blocked: string[]; portalAvailable: boolean; checkoutAvailable: boolean };
function safeBillingLink(value: string | null) {
  if (!value) return undefined;
  try { const url = new URL(value); return url.protocol === "https:" && ["invoice.stripe.com", "pay.stripe.com", "billing.stripe.com"].includes(url.hostname) ? url.href : undefined; } catch { return undefined; }
}
function money(amount: number | null | undefined, currency?: string) { if (amount == null || !currency) return "Price unavailable"; try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100); } catch { return "Price unavailable"; } }
function date(value?: string | null) { return value ? new Date(value).toLocaleDateString() : "Not available"; }
async function request(path: string, signal?: AbortSignal, portal = false) {
  const response = await fetch(`${base}${path}`, { credentials: "include", cache: "no-store", signal, method: portal ? "POST" : "GET", headers: portal ? { "X-Forge-Intent": "billing-portal" } : {} });
  const body = await response.json().catch(() => null);
  if (response.status === 401) throw new Error("Your session has expired. Sign in again.");
  if (!response.ok || !body?.success) throw new Error(body?.error?.message || body?.message || "Unable to load billing.");
  return body;
}
export default function BillingView({ workspace, workspaceLoading = false }: { workspace?: WorkspaceSummary | null; workspaceLoading?: boolean }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0); const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("");
  const [planKey, setPlanKey] = useState("");
  const checkoutKeys = useRef(new Map<string, string>());
  const organizationId = workspace !== undefined ? workspace?.organizationId : workspaces.find(item => item.id === workspaceId)?.organizationId;
  const isLoading = workspace !== undefined && !organizationId ? workspaceLoading : loading;
  useEffect(() => {
    if (workspace !== undefined) return;
    const controller = new AbortController();
    workspaceRequest<{ workspaces: WorkspaceSummary[] }>(base, "", { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setWorkspaces(result.workspaces); setWorkspaceId(current => result.workspaces.some(item => item.id === current) ? current : result.workspaces[0]?.id || "");
      if (!result.workspaces.length) { setLoading(false); setError("No workspace is available for billing."); }
    }).catch(failure => { if (!controller.signal.aborted) { setError(failure.message); setLoading(false); } });
    return () => controller.abort();
  }, [retry, workspace]);
  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(""); setData(null);
      try { const body = await request(`/api/v1/organizations/${organizationId}/billing/dashboard`, controller.signal); if (!controller.signal.aborted) setData(body); }
      catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load billing."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [organizationId, retry]);
  async function portal() {
    if (!organizationId) return; setBusy(true); setError("");
    try { const result = await request(`/api/v1/organizations/${organizationId}/billing/portal`, undefined, true); const url = safeBillingLink(result.url); if (!url) throw new Error("Invalid payment provider link."); window.location.assign(url); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to open payment management."); } finally { setBusy(false); }
  }
  async function checkout() {
    if (!organizationId || !planKey) return;
    setBusy(true); setError("");
    const scope = `${organizationId}:${planKey}`;
    if (!checkoutKeys.current.has(scope)) checkoutKeys.current.set(scope, crypto.randomUUID());
    try {
      const response = await fetch(`${base}/api/v1/organizations/${organizationId}/billing/checkout`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "Idempotency-Key": checkoutKeys.current.get(scope)!, "X-Forge-Intent": "billing-checkout" }, body: JSON.stringify({ planKey, successUrl: `${location.origin}/dashboard`, cancelUrl: `${location.origin}/dashboard` }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || body?.message || "Checkout is unavailable.");
      const url = new URL(body.checkout.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("Invalid checkout provider link.");
      window.location.assign(url.href);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to start checkout."); } finally { setBusy(false); }
  }
  const invoices = data?.invoices.filter(item => item.number.toLowerCase().includes(search.toLowerCase()) && (!status || item.status.toLowerCase() === status)) ?? [];
  const latest = data?.invoices.find(item => safeBillingLink(item.downloadUrl));
  return <div className="billing-dashboard">

    {error && <div className="bd-alert" role="alert">{error} {error.toLowerCase().includes("session") ? <Link to="/login">Sign in</Link> : <button onClick={() => setRetry(value => value + 1)}>Try again</button>}</div>}
    <div className="bd-grid"><div><section className="bd-hero"><p>SUBSCRIPTION &amp; BILLING</p><div className="bd-hero-art" aria-hidden="true"><span className="bd-secure"><ShieldCheck size={13} /> Secure Payments</span><div className="bd-illustration-card"><span>Invoice</span><i /><i /><b>&bull;&bull;&bull;&bull;</b><em /></div></div><h1>Manage your plan,<br />payments and invoices</h1><div>View your current subscription, track invoices, update payment methods, and manage your billing details — all in one place.</div></section>
      {isLoading && <p role="status">Loading billing…</p>}
      {data?.blocked.map(message => <p className="bd-alert" key={message}>{message}</p>)}
      <section className="bd-panel bd-invoices"><div className="bd-invoice-heading"><FileText /><div><h2>Billing &amp; Invoices</h2><p>View and download your invoices and payment details.</p></div></div><div className="bd-filters"><input aria-label="Search invoices" placeholder="Search invoices…" value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="Invoice status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All</option>{[...new Set(data?.invoices.map(item => item.status.toLowerCase()))].map(value => <option key={value}>{value}</option>)}</select></div><div className="bd-table"><table><thead><tr><th>Invoice number</th><th>Date</th><th>Billing period</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{invoices.map(item => <tr key={item.id}><td><span className="bd-invoice-id"><FileText size={14} />{item.number}</span></td><td>{date(item.issuedAt)}</td><td>{item.periodStart ? `${date(item.periodStart)} – ${date(item.periodEnd)}` : "Not available"}</td><td>{money(Number(item.amount), item.currency)}</td><td><span className="bd-status" data-status={item.status.toLowerCase()}>{item.status}</span></td><td>{safeBillingLink(item.downloadUrl) ? <a href={safeBillingLink(item.downloadUrl)} target="_blank" rel="noopener noreferrer"><Download size={13} /> Download</a> : <span>Download unavailable</span>}</td></tr>)}</tbody></table></div>{!isLoading && !invoices.length && <p className="bd-empty">{data ? data.invoices.length ? "No invoices match your filters." : "No invoices yet." : "Invoices are unavailable."}</p>}</section>
      {data && <details className="bd-profile bd-plans"><summary>Available plans</summary>{data.plans.length ? <><select aria-label="Choose billing plan" value={planKey} onChange={event => setPlanKey(event.target.value)}><option value="">Choose a plan</option>{data.plans.map(plan => <option key={plan.key} value={plan.key}>{plan.name}</option>)}</select>{data.subscription ? <button disabled={!data.portalAvailable || busy} onClick={() => void portal()}>Change plan securely</button> : <button disabled={!data.checkoutAvailable || !planKey || busy} onClick={() => void checkout()}>Continue to checkout</button>}</> : <p>No organization plans are configured.</p>}</details>}
      <details className="bd-profile"><summary>Billing details and payment preference</summary><BillingProfile key={organizationId} selectedOrganizationId={organizationId} /></details>
    </div><aside><section className="bd-panel bd-current"><p className="bd-current-label">Current Plan <Crown size={12} /></p><h2>{data?.plans.find(plan => plan.key === data.subscription?.planKey)?.name || data?.subscription?.planKey || (data ? "No subscription" : isLoading ? "Loading…" : "Subscription unavailable")}</h2><span className="bd-status" data-status={(data?.subscriptionDetails?.status || data?.subscription?.status || "").toLowerCase()}>{data?.subscriptionDetails?.status || data?.subscription?.status || "Not available"}</span><h3>{money(data?.subscriptionDetails?.amount, data?.subscriptionDetails?.currency)}{data?.subscriptionDetails?.interval && <small> / {data.subscriptionDetails.interval}</small>}</h3><p className="bd-next-label"><CalendarDays size={16} /> Next billing date</p><strong className="bd-next-date">{date(data?.subscriptionDetails?.nextBilling || data?.subscription?.currentPeriodEnd)}</strong><div className="bd-methods">{data?.paymentMethods.map(method => <div key={method.id} title={`Expires ${method.expiry}`}><CreditCard size={16} /><span>Card ending in {method.last4}<small>{method.brand} &bull;&bull;&bull;&bull; {method.last4}</small></span></div>)}{data && !data.paymentMethods.length && <p>No saved card is available.</p>}</div><button disabled={!data?.portalAvailable || busy} onClick={() => void portal()}>Manage payment method →</button>{data && !data.portalAvailable && <p>Payment management requires Stripe, a linked customer and a configured return URL.</p>}</section>
      <h2 className="bd-quick-title"><Sparkles size={14} /> QUICK ACTIONS</h2><div className="bd-quick"><button disabled={!data?.portalAvailable || busy} onClick={() => void portal()}><Star size={17} />Change / Upgrade Plan <ChevronRight size={14} /><small>Manage your subscription securely</small></button><button disabled={!data?.portalAvailable || busy} onClick={() => void portal()}><CreditCard size={17} />Update Payment Method <ChevronRight size={14} /><small>Add or change your card</small></button>{latest ? <a href={safeBillingLink(latest.downloadUrl)} target="_blank" rel="noopener noreferrer"><Download size={17} />Download Latest Invoice<ChevronRight size={14} /><small>Get a copy of your invoice</small></a> : <button disabled><Download size={17} />Download Latest Invoice<ChevronRight size={14} /><small>No downloadable invoice available</small></button>}<Link to="/support"><MessageSquare size={17} />Contact Support<ChevronRight size={14} /><small>We’re here to help</small></Link></div><section className="bd-help"><h2>Need help with billing?</h2><p>Contact our support team with your billing questions.</p><Link to="/support">Get Support →</Link></section>
    </aside></div>
  </div>;
}
