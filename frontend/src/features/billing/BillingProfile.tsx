import { useEffect, useState, type FormEvent } from "react";

import { workspaceRequest, type WorkspaceSummary } from "../workspaces/workspace-api";
import "./BillingView.css";

type Profile = { organizationName: string; billingEmail: string; taxId: string; companyName: string; address: string; phone: string; website: string; paymentMethod: "card" | "bank" | "paypal" };
const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
const empty: Profile = { organizationName: "", billingEmail: "", taxId: "", companyName: "", address: "", phone: "", website: "", paymentMethod: "card" };
async function profileRequest(id: string, signal?: AbortSignal, profile?: Profile): Promise<Profile> {

  const response = await fetch(`${base}/api/v1/organizations/${encodeURIComponent(id)}/billing/profile`, {
    method: profile ? "PUT" : "GET", credentials: "include", cache: "no-store", signal: signal || AbortSignal.timeout(15000),
    headers: { ...(profile ? { "Content-Type": "application/json", "X-Forge-Intent": "billing-profile" } : {}) },
    body: profile ? JSON.stringify(profile) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) throw new Error(data?.error?.message || data?.message || "Unable to load billing profile.");
  return data.profile;
}
export default function BillingProfile({ selectedOrganizationId }: { selectedOrganizationId?: string }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [profile, setProfile] = useState<Profile>(empty);
  const [saved, setSaved] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (selectedOrganizationId) return;
    const controller = new AbortController();
    workspaceRequest<{ workspaces: WorkspaceSummary[] }>(base, "", { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setWorkspaces(data.workspaces); setWorkspaceId(data.workspaces[0]?.id || ""); if (!data.workspaces.length) { setLoading(false); setError("No workspace is available for billing."); } } })
      .catch(failure => { if (!controller.signal.aborted) { setError(failure.message); setLoading(false); } });
    return () => controller.abort();
  }, [retry, selectedOrganizationId]);
  const organizationId = selectedOrganizationId || workspaces.find(item => item.id === workspaceId)?.organizationId;
  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    async function loadProfile() {
    setLoading(true); setSaved(null); setError(""); setSuccess("");
    await profileRequest(organizationId!, controller.signal).then(data => { if (!controller.signal.aborted) { setProfile(data); setSaved(data); } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    void loadProfile();
    return () => controller.abort();
  }, [organizationId, retry]);
  function change(key: keyof Profile, value: string) { setProfile(current => ({ ...current, [key]: value })); setSuccess(""); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!organizationId || !saved) return;
    setBusy(true); setError(""); setSuccess("");
    try { const data = await profileRequest(organizationId, undefined, profile); setProfile(data); setSaved(data); setSuccess("Billing details and payment preference saved."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save billing details."); }
    finally { setBusy(false); }
  }
  const fields = {
    organizationName: { label: "Company / Organization Name", icon: "organization", placeholder: "Your organization", helper: "This will appear on your invoices." },
    billingEmail: { label: "Billing Email", icon: "mail", placeholder: "billing@company.com", helper: "We'll send all billing updates and invoices to this address.", type: "email" },
    taxId: { label: "Tax ID (Optional)", icon: "tax", placeholder: "e.g. 12-3456789", helper: "Add your tax ID for business invoices." },
    companyName: { label: "Company Name", icon: "mail", placeholder: "Your company" },
    address: { label: "Address", icon: "address", placeholder: "123 Business Street, City, State, ZIP" },
    phone: { label: "Phone Number", icon: "phone", placeholder: "+91 98765 43210", type: "tel" },
    website: { label: "Website (Optional)", icon: "globe", placeholder: "https://yourwebsite.com", type: "url" },
  };
  function field(key: keyof typeof fields) {
    const item = fields[key];
    return <label className="billing-field" key={key} htmlFor={`billing-${key}`}><span>{item.label}</span><div><img src={`/billing/${item.icon}.svg`} alt="" /><input id={`billing-${key}`} type={"type" in item ? item.type : "text"} value={profile[key]} onChange={event => change(key, event.target.value)} placeholder={item.placeholder} required={key !== "taxId" && key !== "website"} maxLength={key === "address" ? 500 : key === "website" ? 2048 : key === "phone" ? 40 : key === "taxId" ? 100 : key === "billingEmail" ? 254 : 255} pattern={key === "phone" ? "[+0-9\\s().\\-]{5,40}" : undefined} /></div>{"helper" in item && <small>{item.helper}</small>}</label>;
  }
  return <div className="billing-page"><img className="billing-ambient" src="/billing/ambient.svg" alt="" /><div className="billing-heading"><h1>Billing</h1><p>Manage your workspace billing, invoices, and payment methods.</p></div>
    {!selectedOrganizationId && workspaces.length > 1 && <label className="billing-workspace">Workspace <select value={workspaceId} disabled={busy} onChange={event => setWorkspaceId(event.target.value)}>{workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {error && <div className="billing-message billing-error" role="alert">{error} {!busy && <button type="button" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Try again</button>}</div>}
    {loading && <p role="status">Loading billing details...</p>}
    {success && <p className="billing-message billing-success" role="status">{success}</p>}
    <form onSubmit={submit}><fieldset disabled={loading || busy || !saved}>
      <section className="billing-card billing-details"><h2>Billing Details</h2><p>Update your billing information and manage invoices.</p>{field("organizationName")}{field("billingEmail")}{field("taxId")}</section>
      <section className="billing-card billing-company"><h2>Company Billing Profile</h2><p>Add your company details to be shown on invoices.</p>{field("companyName")}{field("address")}<div className="billing-columns">{field("phone")}{field("website")}</div></section>
      <section className="billing-card billing-payment"><div className="billing-payment-heading"><span><img src="/billing/payment.svg" alt="" /></span><div><h2>Payment Method</h2><p>Choose how you want to pay for your subscription.</p></div></div>
        <div className="billing-methods">{([{ key: "card", name: "Credit / Debit Card", detail: "Visa, MasterCard, RuPay, Amex", icon: "card" }, { key: "bank", name: "Bank Transfer", detail: "Direct bank transfer (ACH/NEFT)", icon: "bank" }, { key: "paypal", name: "PayPal", detail: "Secure and easy payments", icon: "paypal" }] as const).map(({ key, name, detail, icon }) => <label key={key} className={`billing-method ${profile.paymentMethod === key ? "selected" : ""}`}><div><input type="radio" name="paymentMethod" value={key} checked={profile.paymentMethod === key} onChange={() => change("paymentMethod", key)} />{key === "paypal" ? <span className="billing-paypal">P</span> : <img src={`/billing/${icon}.svg`} alt="" />}</div><div className="billing-method-copy"><strong>{name}</strong><small>{detail}</small>{key === "card" && <span className="billing-brands"><b>VISA</b><b className="billing-mastercard" aria-label="Mastercard"><i /><i /></b><b>RuPay</b><b>AMEX</b></span>}</div></label>)}</div>
        <div className="billing-security"><span><img src="/billing/lock.svg" alt="" /></span><p><strong>Your payment information is secure.</strong> This form saves your billing details and preferred payment method. Payment authorization is completed through the payment provider.</p></div>
        <div className="billing-actions"><button type="button" className="billing-cancel" onClick={() => { if (saved) setProfile(saved); setError(""); setSuccess(""); }}>Cancel</button><button type="submit" className="billing-next">{busy ? "Saving..." : "Next"}</button></div>
      </section>
    </fieldset></form>
  </div>;
}
