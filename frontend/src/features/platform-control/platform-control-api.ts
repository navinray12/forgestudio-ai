const base=`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1`;

async function request<T>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(`${base}${path}`,{
    ...options,credentials:"include",cache:"no-store",
    signal:options.signal || AbortSignal.timeout(15000),
    headers:{"Content-Type":"application/json",...(options.headers||{})},
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.success) throw new Error(data?.error?.message||data?.message||"Platform request failed");
  return data as T;
}

export type Capability={
  id:string;owner:string;criticality:"LOCKED"|"REQUIRED"|"OPTIONAL";changeClass:string;minTier:string;
  provider:string|null;desiredState:string;observedState:string;dependencies:string[];offBehaviour:string;version:number|null;
};
export type PlatformOverview={
  tier:string;referenceTarget:{registeredUsers:number;dynamicRps:number;qualificationRps:number;qualified:boolean};
  openChanges:number;jobStates:Array<{status:string;count:number}>;unresolvedTenantBackfill:Array<{resourceType:string;count:number}>;note:string;
};
export type PlatformChange={
  id:string;class:string;scope:{capabilityId?:string};oldState:any;desiredState:any;status:string;reason:string;planDigest:string;
  requester:string;approver:string|null;requestedAt:string;approvedAt:string|null;updatedAt:string;
};

export async function enterPlatformControl(){return request<{success:true;expiresAt:string}>("/platform-auth/session",{method:"POST",body:"{}"});}
export async function loadPlatformOverview(){return request<{success:true}&PlatformOverview>("/platform/overview");}
export async function loadCapabilities(){return request<{success:true;capabilities:Capability[]}>("/platform/capabilities");}
export async function loadChanges(){return request<{success:true;changes:PlatformChange[]}>("/platform/changes");}
export async function createChange(capabilityId:string,desiredState:string,reason:string){
  return request<{success:true;change:any}>("/platform/changes",{method:"POST",body:JSON.stringify({capabilityId,desiredState,reason})});
}
export async function approveChange(id:string,planDigest:string){
  return request<{success:true;change:any}>(`/platform/changes/${encodeURIComponent(id)}/approve`,{method:"POST",body:JSON.stringify({planDigest})});
}
export async function applyChange(id:string,planDigest:string){
  return request<{success:true;change:any}>(`/platform/changes/${encodeURIComponent(id)}/apply`,{method:"POST",body:JSON.stringify({planDigest})});
}
