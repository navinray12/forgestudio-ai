const apiBase=`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1`;

async function request<T>(organizationId:string,path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(`${apiBase}/organizations/${encodeURIComponent(organizationId)}/billing${path}`,{
    ...options,credentials:"include",cache:"no-store",
    signal:options.signal || AbortSignal.timeout(15000),
    headers:{"Content-Type":"application/json",...(options.headers||{})},
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.success) throw new Error(data?.error?.message||data?.message||"Billing request failed");
  return data as T;
}

export type BillingPlan={key:string;name:string;description:string;seatLimit:number;quotas:Record<string,number>};
export type BillingSummary={
  account:{provider:string;status:string}|null;
  subscription:{planKey:string;status:string;seatLimit:number;quotas:Record<string,number>;currentPeriodEnd:string|null}|null;
  seatsUsed:number;usage:Array<{resource:string;amount:string}>;
};

export async function loadOrganizationBilling(organizationId:string,signal?:AbortSignal){
  return request<{success:true}&BillingSummary>(organizationId,"/",{signal});
}
export async function loadOrganizationPlans(organizationId:string,signal?:AbortSignal){
  return request<{success:true;plans:BillingPlan[]}>(organizationId,"/plans",{signal});
}
export async function beginOrganizationCheckout(organizationId:string,planKey:string){
  const key=crypto.randomUUID();
  const returnBase=new URL(window.location.href);
  returnBase.search="";
  return request<{success:true;checkout:{url:string;checkoutId:string;replayed:boolean}}>(organizationId,"/checkout",{
    method:"POST",headers:{"Idempotency-Key":key},
    body:JSON.stringify({planKey,successUrl:`${returnBase.origin}/dashboard?billing=success`,cancelUrl:`${returnBase.origin}/dashboard?billing=cancelled`}),
  });
}
