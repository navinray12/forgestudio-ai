import { Link } from "react-router-dom";

export default function SubscriptionPage(){
  return <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
      <h1 className="text-3xl font-bold">Organization billing</h1>
      <p className="mt-4 text-slate-300">
        ForgeStudio billing is organization-scoped. Paid plans are managed from an organization workspace so seats,
        quotas, verified checkout and provider reconciliation use the same tenant boundary.
      </p>
      <div role="note" className="mt-6 rounded border border-amber-700/60 bg-amber-950/30 p-4 text-sm text-amber-100">
        Legacy user-scoped paid-plan selection has been retired from this page. Selecting a plan in the workspace opens
        the configured payment provider; access changes only after a signed provider event is verified and reconciled.
      </div>
      <Link to="/dashboard" className="mt-6 inline-block rounded bg-blue-600 px-4 py-2 font-semibold text-white">
        Open workspace billing
      </Link>
    </div>
  </main>;
}
