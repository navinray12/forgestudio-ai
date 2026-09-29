import { useEffect,useState } from "react";
import { beginOrganizationCheckout,loadOrganizationBilling,loadOrganizationPlans,type BillingPlan,type BillingSummary } from "./organization-billing-api";

export function OrganizationBillingPanel({organizationId}:{organizationId:string}){
  const [summary,setSummary]=useState<BillingSummary|null>(null);
  const [plans,setPlans]=useState<BillingPlan[]>([]);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");
  useEffect(()=>{
    const controller=new AbortController();setError("");
    Promise.all([loadOrganizationBilling(organizationId,controller.signal),loadOrganizationPlans(organizationId,controller.signal)])
      .then(([billing,catalog])=>{if(!controller.signal.aborted){setSummary(billing);setPlans(catalog.plans);}})
      .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Unable to load organization billing");});
    return()=>controller.abort();
  },[organizationId]);

  async function checkout(plan:BillingPlan){
    setBusy(plan.key);setError("");
    try{
      const result=await beginOrganizationCheckout(organizationId,plan.key);
      const target=new URL(result.checkout.url);
      if(target.protocol!=="https:"||target.username||target.password) throw new Error("Billing provider returned an invalid checkout destination");
      window.location.assign(target.href);
    }catch(e){setError(e instanceof Error?e.message:"Unable to start checkout");setBusy("");}
  }

  return <section aria-labelledby="organization-billing-heading" className="rounded-lg border border-slate-200 p-4">
    <h4 id="organization-billing-heading" className="font-semibold">Organization billing</h4>
    <p className="mt-1 text-xs text-slate-500">Paid access becomes active only after a verified provider event is reconciled by the backend.</p>
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {!summary&&!error&&<p role="status" className="mt-3 text-sm">Loading billing…</p>}
    {summary&&<div className="mt-3 text-sm">
      <p>Subscription: <strong>{summary.subscription?.planKey||"No commercial plan"}</strong> · {summary.subscription?.status||"INACTIVE"}</p>
      <p>Seats: {summary.seatsUsed}/{summary.subscription?.seatLimit||0}</p>
    </div>}
    {plans.length>0&&<div className="mt-4 grid gap-3 md:grid-cols-2">
      {plans.map(plan=><article key={plan.key} className="rounded border p-3">
        <h5 className="font-medium">{plan.name}</h5>
        {plan.description&&<p className="text-xs text-slate-500 mt-1">{plan.description}</p>}
        <p className="text-xs mt-2">Seat limit: {plan.seatLimit}</p>
        <button type="button" disabled={!!busy||summary?.subscription?.planKey===plan.key} onClick={()=>void checkout(plan)}
          className="mt-3 rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:bg-slate-400">
          {summary?.subscription?.planKey===plan.key?"Current plan":busy===plan.key?"Opening checkout…":`Choose ${plan.name}`}
        </button>
      </article>)}
    </div>}
    {plans.length===0&&summary&&<p className="mt-3 text-sm text-slate-500">No paid plans are configured for this environment.</p>}
    <div className="sr-only" aria-live="polite">{busy?"Opening secure checkout":error||"Billing information loaded"}</div>
  </section>;
}
