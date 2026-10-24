import {z} from 'zod';
import {prisma} from '../../config/prisma.js';
import {AppError} from '../../utils/app-error.js';
import {verifyProjectAccess} from '../../modules/data-platform/common/project-access.js';
import type {LeadNotification} from '../leads/leadIntake.service.js';
const line=z.string().trim().min(1).max(100).regex(/^[^\r\n]+$/);
const email=z.string().trim().email().max(254);
export const notificationSettingsSchema=z.object({enabled:z.boolean(),timing:z.enum(['immediately','hour','day']),senderName:line,senderEmail:email,recipients:z.array(email).max(20),sendToSubmitter:z.boolean(),subject:z.string().trim().min(1).max(300).regex(/^[^\r\n]+$/),replyTo:email}).strict().superRefine((value,ctx)=>{
 if(value.enabled&&!value.recipients.length&&!value.sendToSubmitter)ctx.addIssue({code:'custom',message:'Add at least one recipient.',path:['recipients']});
 if([...value.subject.matchAll(/\{\{([^}]+)\}\}/g)].some(match=>!['siteName','formName'].includes(match[1].trim())))ctx.addIssue({code:'custom',message:'Use only {{siteName}} and {{formName}} variables.',path:['subject']});
});
export type NotificationSettings=z.infer<typeof notificationSettingsSchema>;
export const defaultNotificationSettings:NotificationSettings={enabled:true,timing:'immediately',senderName:'ForgeStudio Forms',senderEmail:'no-reply@forgestudio.io',recipients:[],sendToSubmitter:false,subject:'New form submission on {{siteName}} — {{formName}}',replyTo:'no-reply@forgestudio.io'};
export function parseNotificationSettings(input:unknown){const result=notificationSettingsSchema.safeParse(input);if(!result.success)throw new AppError(result.error.issues[0]?.message||'Check your notification settings.',400,'VALIDATION_ERROR');return{...result.data,recipients:[...new Set(result.data.recipients.map(value=>value.toLowerCase()))]};}
async function authorize(websiteId:string,userId:string){if(!z.string().uuid().safeParse(websiteId).success)throw new AppError('Invalid website ID.',400,'VALIDATION_ERROR');const access=await verifyProjectAccess(websiteId,userId);if(!access.canAdminister)throw new AppError('Only site owners and admins can manage form notifications.',403,'FORBIDDEN');}
function document(value:any){return typeof value==='string'?JSON.parse(value):value||{}}
export function discoverForms(data:any){const forms=new Map<string,{id:string;name:string}>();const visited=new Set<any>();let budget=0;
 const walk=(value:any,depth=0)=>{if(!value||typeof value!=='object'||depth>40||++budget>50000||visited.has(value))return;visited.add(value);if(value.type==='form'&&typeof value.id==='string'){const config=value.formConfig||value.config;const id=config?.id||value.id;forms.set(id,{id,name:config?.formName||value.formName||value.formTitle||'Website Form'})}for(const [key,child]of Object.entries(value)){if(['publishedData','releases','backups','deploymentHistory'].includes(key))continue;if(child&&typeof child==='object')walk(child,depth+1)}};walk(data);return [...forms.values()];}
export async function formsDashboard(websiteId:string,userId:string){
 await authorize(websiteId,userId);
 const site=await prisma.website.findUnique({where:{id:websiteId},select:{name:true,editorData:true,user:{select:{email:true}},mailerConfig:{select:{host:true,fromName:true,fromEmail:true}}}});
 if(!site)throw new AppError('Site not found.',404,'NOT_FOUND');const data=document(site.editorData);
 const sender=site.mailerConfig?.fromEmail||process.env.SMTP_FROM||process.env.SMTP_USER||defaultNotificationSettings.senderEmail;
 const settings=data.formNotifications||{...defaultNotificationSettings,senderName:site.mailerConfig?.fromName||defaultNotificationSettings.senderName,senderEmail:sender,replyTo:sender,recipients:site.user.email?[site.user.email]:[]};
 const smtpConfigured=Boolean(site.mailerConfig?.host||process.env.SMTP_HOST);
 const rows:any[]=await prisma.$queryRaw`SELECT "formId",max("formName") AS "formName",count(*)::int AS submissions,max("createdAt") AS "lastSubmission" FROM form_submissions WHERE "websiteId"=${websiteId}::uuid GROUP BY "formId" ORDER BY max("createdAt") DESC`;
 const forms=new Map(discoverForms(data).map(form=>[form.id,{...form,submissions:0,lastSubmission:null as string|null}]));
 for(const row of rows){forms.set(row.formId,{id:row.formId,name:forms.get(row.formId)?.name||row.formName||'Website Form',submissions:row.submissions,lastSubmission:row.lastSubmission?new Date(row.lastSubmission).toISOString():null})}
 return{settings,smtpConfigured,configured:Boolean(data.formNotifications),forms:[...forms.values()].sort((a,b)=>(b.lastSubmission||'').localeCompare(a.lastSubmission||''))};
}
export async function saveNotifications(websiteId:string,userId:string,input:unknown){await authorize(websiteId,userId);const settings=parseNotificationSettings(input);await prisma.$executeRaw`UPDATE websites SET "editorData"=jsonb_set(COALESCE("editorData",'{}'::jsonb),'{formNotifications}',${JSON.stringify(settings)}::jsonb),"documentVersion"="documentVersion"+1,"updatedAt"=now() WHERE id=${websiteId}::uuid`;return settings;}
export async function formEntries(websiteId:string,userId:string,formId:string,page:number){await authorize(websiteId,userId);const offset=(page-1)*25;const rows:any[]=await prisma.$queryRaw`SELECT id,data,"createdAt" FROM form_submissions WHERE "websiteId"=${websiteId}::uuid AND "formId"=${formId} ORDER BY "createdAt" DESC LIMIT 26 OFFSET ${offset}`;return{entries:rows.slice(0,25).map(row=>({...row,createdAt:new Date(row.createdAt).toISOString()})),hasMore:rows.length>25,page};}
const escape=(value:unknown)=>String(typeof value==='object'?JSON.stringify(value):value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function buildFormNotifications(input:{settings:unknown;websiteId:string;siteName:string;formName:string;fields:Record<string,unknown>;now?:Date}):LeadNotification[]{
 const settings=parseNotificationSettings(input.settings);if(!settings.enabled)return[];
 const recipients=new Set(settings.recipients);
 if(settings.sendToSubmitter){const submitter=Object.entries(input.fields).find(([key,value])=>/e-?mail/i.test(key)&&email.safeParse(value).success)?.[1]||Object.values(input.fields).find(value=>email.safeParse(value).success);if(typeof submitter==='string')recipients.add(submitter.trim().toLowerCase());}
 const safeLine=(value:string)=>value.replace(/[\r\n]+/g,' ').slice(0,150);
 const subject=settings.subject.replace(/\{\{\s*(siteName|formName)\s*\}\}/g,(_match,key)=>safeLine(key==='siteName'?input.siteName:input.formName));
 const html=`<div style="font-family:Arial,sans-serif;max-width:640px"><h2>${escape(input.formName)}</h2><p>New submission on ${escape(input.siteName)}</p><table>${Object.entries(input.fields).map(([key,value])=>`<tr><th style="text-align:left;padding:8px">${escape(key)}</th><td style="padding:8px">${escape(value)}</td></tr>`).join('')}</table></div>`;
 const delay=settings.timing==='hour'?3600000:settings.timing==='day'?86400000:0;
 return [...recipients].map((to,index)=>({type:'FORM_NOTIFICATION_EMAIL',key:`notification-${index}`,runAt:new Date((input.now||new Date()).getTime()+delay),payload:{websiteId:input.websiteId,to,subject,html,fromName:settings.senderName,fromEmail:settings.senderEmail,replyTo:settings.replyTo,requireDelivery:true}}));
}
