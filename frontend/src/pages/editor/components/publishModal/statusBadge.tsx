import React from "react";

// Badge for a deployment status (deployment history in the ForgeStudio Live tab). Pure: depends only on
// its argument. Moved verbatim from PublishModal.tsx.
export const getStatusBadge = (status: string) => {
  switch (status) {
    case "PUBLISHED":
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PUBLISHED</span>;
    case "DEPLOYING":
    case "BUILDING":
    case "VALIDATING":
    case "PROCESSING":
    case "VERIFYING":
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse">{status}</span>;
    case "RECONCILIATION_REQUIRED":
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">RECONCILIATION</span>;
    case "VALIDATION_FAILED":
    case "BUILD_FAILED":
    case "DEPLOY_FAILED":
    case "VERIFICATION_FAILED":
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">FAILED</span>;
    default:
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">{status}</span>;
  }
};
