import { useCallback,useEffect,useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { approveChange,applyChange,createChange,enterPlatformControl,loadCapabilities,loadChanges,loadPlatformOverview,type Capability,type PlatformChange,type PlatformOverview } from "./platform-control-api";

export default function PlatformControlPage(){
  const {user}=useAuth();
  const [ready,setReady]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [overview,setOverview]=useState<PlatformOverview|null>(null);
  const [capabilities,setCapabilities]=useState<Capability[]>([]);
  const [changes,setChanges]=useState<PlatformChange[]>([]);
  const [reason,setReason]=useState("Operational capability change after dependency review");

  const refresh=useCallback(async()=>{
    const [o,c,h]=await Promise.all([loadPlatformOverview(),loadCapabilities(),loadChanges()]);
    setOverview(o);setCapabilities(c.capabilities);setChanges(h.changes);
  },[]);

  useEffect(()=>{let active=true;(async()=>{
    try{await enterPlatformControl();if(!active)return;setReady(true);await refresh();}
    catch(e){if(active)setError(e instanceof Error?e.message:"Platform control authentication failed");}
    finally{if(active)setLoading(false);}
  })();return()=>{active=false};},[refresh]);

  async function requestToggle(capability:Capability){
    setError("");
    try{
      if(capability.changeClass!=="A") throw new Error(`Class ${capability.changeClass} changes require their governed executor and cannot be applied from this runtime control.`);
      const next=capability.desiredState==="ENABLED"?"DISABLED":"ENABLED";
      await createChange(capability.id,next,reason);await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Change request failed");}
  }
  async function approve(change:PlatformChange){
    setError("");try{await approveChange(change.id,change.planDigest);await refresh();}catch(e){setError(e instanceof Error?e.message:"Approval failed");}
  }
  async function apply(change:PlatformChange){
    setError("");try{await applyChange(change.id,change.planDigest);await refresh();}catch(e){setError(e instanceof Error?e.message:"Apply failed");}
  }

  if(loading) return <main className="min-h-screen bg-slate-950 text-slate-200 p-8" aria-busy="true"><p>Opening secured Platform Control Center…</p></main>;
  if(!ready) return <main className="min-h-screen bg-slate-950 text-slate-200 p-8"><h1 className="text-2xl font-semibold">Platform Control Center</h1><p role="alert" className="mt-4 text-rose-300">{error||"A recent phishing-resistant platform session is required."}</p></main>;

  return <main id="main-content" className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
    <a href="#capabilities" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:text-black focus:p-2">Skip to capabilities</a>
    <header className="mb-8">
      <h1 className="text-3xl font-semibold">Platform Control Center</h1>
      <p className="text-slate-400 mt-2">Separate PLATFORM audience • operator {user?.email||user?.id}</p>
      {overview&&<p className="mt-2 text-sm">Tier <strong>{overview.tier}</strong> · reference target {overview.referenceTarget.dynamicRps.toLocaleString()} RPS · qualification <strong>{overview.referenceTarget.qualified?"verified":"not yet verified"}</strong></p>}
    </header>
    {error&&<div role="alert" aria-live="assertive" className="mb-6 rounded border border-rose-700 bg-rose-950/40 p-3">{error}</div>}
    {overview&&<section aria-labelledby="platform-health" className="mb-8">
      <h2 id="platform-health" className="text-xl font-semibold">Operational overview</h2>
      <dl className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded bg-slate-900 p-4"><dt className="text-slate-400">Open changes</dt><dd className="text-2xl">{overview.openChanges}</dd></div>
        <div className="rounded bg-slate-900 p-4"><dt className="text-slate-400">Qualified ceiling</dt><dd className="text-2xl">{overview.referenceTarget.qualificationRps.toLocaleString()} RPS target</dd></div>
        <div className="rounded bg-slate-900 p-4"><dt className="text-slate-400">Ownership conflicts</dt><dd className="text-2xl">{overview.unresolvedTenantBackfill.reduce((a,b)=>a+Number(b.count),0)}</dd></div>
      </dl>
      <p className="mt-3 text-sm text-amber-200">{overview.note}</p>
    </section>}
    <section id="capabilities" aria-labelledby="capability-heading">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div><h2 id="capability-heading" className="text-xl font-semibold">Capabilities</h2><p className="text-sm text-slate-400">Desired and observed states are displayed separately. Locked controls have no switch.</p></div>
        <label className="text-sm">Change reason
          <input value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 block w-full min-w-80 rounded bg-slate-900 border border-slate-700 px-3 py-2" />
        </label>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left"><caption className="sr-only">Platform capability states and governed actions</caption>
          <thead><tr className="border-b border-slate-700"><th scope="col" className="p-2">Capability</th><th scope="col">Class</th><th scope="col">Desired</th><th scope="col">Observed</th><th scope="col">Action</th></tr></thead>
          <tbody>{capabilities.map(c=><tr key={c.id} className="border-b border-slate-800">
            <th scope="row" className="p-2"><div>{c.id}</div><div className="text-xs font-normal text-slate-500">{c.offBehaviour}</div></th>
            <td>{c.changeClass}</td><td>{c.desiredState}</td><td>{c.observedState}</td>
            <td>{c.criticality==="LOCKED"?<span aria-label="Locked capability">🔒 Locked</span>:<button disabled={c.changeClass!=="A"} onClick={()=>void requestToggle(c)} className="rounded bg-indigo-600 disabled:bg-slate-700 px-3 py-1.5">Request {c.desiredState==="ENABLED"?"disable":"enable"}</button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    <section className="mt-10" aria-labelledby="changes-heading">
      <h2 id="changes-heading" className="text-xl font-semibold">Changes</h2>
      <div className="mt-3 space-y-3">{changes.length===0?<p className="text-slate-400">No recorded changes.</p>:changes.map(ch=><article key={ch.id} className="rounded border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap gap-3 justify-between"><div><strong>{ch.scope?.capabilityId||"platform change"}</strong> · {ch.status}</div><code className="text-xs break-all">{ch.planDigest}</code></div>
        <p className="mt-2 text-sm text-slate-300">{ch.reason}</p>
        <div className="mt-3 flex gap-2">
          {ch.status==="AWAITING_APPROVAL"&&ch.requester!==user?.id&&<button onClick={()=>void approve(ch)} className="rounded bg-emerald-700 px-3 py-1.5">Approve exact plan</button>}
          {ch.status==="APPROVED"&&<button onClick={()=>void apply(ch)} className="rounded bg-indigo-600 px-3 py-1.5">Apply approved plan</button>}
        </div>
      </article>)}</div>
    </section>
    <div className="sr-only" aria-live="polite">{loading?"Loading":error||"Platform control data loaded"}</div>
  </main>;
}
