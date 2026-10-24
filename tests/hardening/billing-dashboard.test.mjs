import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';
async function fixture(options={}) {
 const calls=[];const env={FRONTEND_URL:'https://studio.example',...options.env};
 const service=await loadTypeScript('backend/src/modules/billing/dashboard.service.ts',{
  './billing.service.js':{getOrganizationBilling:async(org,actor)=>{calls.push({org,actor});if(options.schemaFailure)throw Object.assign(Error('relation organization_billing_accounts does not exist'),{code:'42P01'});if(options.denied)throw Error('Forbidden');return {account:{providerCustomerId:'cus_owned'},subscription:{planKey:'team'}};},listOrganizationPlans:async()=>[{key:'team',name:'Team'}]},
  '../../platform/tenancy/tenant-unit-of-work.js':{withTenantTransaction:async(scope,fn)=>{calls.push(scope);return fn({query:async(sql,args)=>{assert.equal(args[0],'org');if(options.invoiceSchemaFailure)throw Object.assign(Error('issuedAt missing'),{code:'42703'});return {rows:[{id:'stored',providerInvoiceId:'inv_real',amount:431,currency:'USD',status:'PAID'}]};}});}},
 },{URLSearchParams,AbortSignal,process:{env},fetch:async(url,init)=>{calls.push({url,init});if(options.fail)throw Error('provider offline');const data=url.includes('billing_portal')?{url:'https://billing.stripe.com/p/session'}:url.includes('payment_methods')?{data:[{id:'pm',card:{brand:'visa',last4:'9876',exp_month:2,exp_year:2030}}]}:url.includes('subscriptions')?{data:[{status:'active',current_period_end:1800000000,items:{data:[{price:{unit_amount:1250,currency:'usd',recurring:{interval:'month'}}}]}}]}:{data:[{id:'in_a',number:'REAL-7',amount_paid:1250,status:'paid',currency:'usd',created:1700000000,invoice_pdf:'https://invoice.stripe.com/i/pdf'}]};return {ok:true,json:async()=>data};}});
 return {service,calls};
}
test('unconfigured billing returns stored invoices without fake card or downloads',async()=>{const f=await fixture();const result=await f.service.billingDashboard('org','actor');assert.equal(result.invoices[0].downloadUrl,null);assert.equal(result.paymentMethods.length,0);assert.equal(result.portalAvailable,false);assert.ok(result.blocked.length);assert.ok(!f.calls.some(c=>c.url));});
test('provider mapping preserves minor currency units, invoice URLs, masked cards and periods',async()=>{const f=await fixture({env:{STRIPE_SECRET_KEY:'test'}});const result=await f.service.billingDashboard('org','actor');assert.equal(result.invoices[0].amount,1250);assert.equal(result.paymentMethods[0].last4,'9876');assert.equal(result.subscriptionDetails.amount,1250);assert.equal(result.portalAvailable,true);assert.ok(f.calls.filter(c=>c.url).every(c=>c.url.includes('cus_owned')));});
test('authorization fails before provider reads or tenant invoice access',async()=>{const f=await fixture({denied:true,env:{STRIPE_SECRET_KEY:'test'}});await assert.rejects(f.service.billingDashboard('org','outsider'),/Forbidden/);assert.equal(f.calls.length,1);});
test('provider failure retains stored records and reports missing live sections',async()=>{const f=await fixture({fail:true,env:{STRIPE_SECRET_KEY:'test'}});const result=await f.service.billingDashboard('org','actor');assert.equal(result.invoices[0].number,'inv_real');assert.equal(result.blocked.length,4);});
test('portal uses the authorized customer and server return URL; rejects unsafe links',async()=>{const f=await fixture({env:{STRIPE_SECRET_KEY:'test'}});const result=await f.service.billingPortal('org','actor');assert.match(result.url,/billing.stripe.com/);const call=f.calls.find(c=>c.url);assert.equal(call.init.body.get('customer'),'cus_owned');assert.equal(call.init.body.get('return_url'),'https://studio.example/dashboard');for(const value of ['javascript:alert(1)','https://evil.example/x','https://billing.stripe.com.evil.example/x','http://invoice.stripe.com/x'])assert.equal(f.service.providerLink(value),null);});

test('missing billing tables and columns are actionable unavailable errors, never successful empty data',async()=>{
 for(const options of [{schemaFailure:true},{invoiceSchemaFailure:true}]){
  const f=await fixture(options);await assert.rejects(f.service.billingDashboard('org','actor'),error=>error.code==='BILLING_SCHEMA_UNAVAILABLE'&&error.statusCode===503&&!error.message.includes('organization_billing_accounts'));
  assert.ok(!f.calls.some(call=>call.url));
 }
});
test('missing schema in portal authorization also fails closed before contacting Stripe',async()=>{
 const f=await fixture({schemaFailure:true,env:{STRIPE_SECRET_KEY:'test'}});await assert.rejects(f.service.billingPortal('org','actor'),{code:'BILLING_SCHEMA_UNAVAILABLE',statusCode:503});assert.ok(!f.calls.some(call=>call.url));
});
test('the actual HTTP error middleware maps billing schema drift to 503 with an actionable response',async()=>{
 const f=await fixture({schemaFailure:true});
 const middleware=await loadTypeScript('backend/src/middlewares/error.middleware.ts');
 let status;let payload;const headers={};
 const res={headersSent:false,setHeader:(key,value)=>{headers[key]=value;},type:()=>res,status:value=>{status=value;return res;},json:value=>{payload=value;return res;}};
 try{await f.service.billingDashboard('org','actor');assert.fail('Schema read must fail');}catch(error){
  // loadTypeScript isolates modules in VM contexts; share the service's AppError constructor
  // through its prototype so middleware instanceof checks match the real process boundary.
  const shared=await loadTypeScript('backend/src/middlewares/error.middleware.ts',{'../utils/app-error.js':{AppError:error.constructor}});
  shared.errorMiddleware(error,{},res,()=>assert.fail('Unexpected next'));
 }
 assert.equal(status,503);assert.equal(payload.code,'BILLING_SCHEMA_UNAVAILABLE');assert.match(payload.detail,/database migrations/);assert.equal(headers['Cache-Control'],'no-store');assert.notEqual(payload.detail,'Something went wrong');
});
