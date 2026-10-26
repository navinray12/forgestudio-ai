export type IntegrationSettings = { googleTags: Array<{name:string;id:string}>; googleMapsApiKey:string; metaPixelId:string; delayPixelConsent:boolean; blockBots:boolean; filterSpam:boolean; recaptchaSiteKey:string; recaptchaEnabled:boolean; webhooks:Array<{id:string;url:string;event:'form.submitted'}> };
export type IntegrationResponse = { settings:IntegrationSettings; providers:{turnstileConfigured:boolean;recaptchaConfigured:boolean} };
export const emptySettings:IntegrationSettings={googleTags:[],googleMapsApiKey:'',metaPixelId:'',delayPixelConsent:false,blockBots:false,filterSpam:false,recaptchaSiteKey:'',recaptchaEnabled:false,webhooks:[]};
const base=import.meta.env.VITE_API_URL||'http://localhost:5000';
export async function integrationRequest<T>(path:string,options:{method?:string;body?:unknown;signal?:AbortSignal}={}):Promise<T>{
 const token=localStorage.getItem('token');
 const response=await fetch(`${base}${path}`,{method:options.method||'GET',credentials:'include',cache:'no-store',signal:options.signal||AbortSignal.timeout(15000),headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(options.body?{'Content-Type':'application/json','X-Forge-Intent':'integration-settings'}:{})},body:options.body?JSON.stringify(options.body):undefined});
 const data=await response.json().catch(()=>null);if(!response.ok||!data?.success)throw new Error(data?.error?.message||data?.message||'Integration request failed.');return data;
}
