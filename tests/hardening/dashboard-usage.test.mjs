import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const now = new Date('2026-10-23T12:00:00Z');
const site = (id, overrides={}) => ({ id, userId:'owner', organizationId:null, workspaceId:null, organization:null, workspace:null, collaborators:[], granularPermissions:[], ...overrides });
async function fixture(options={}) {
  const calls={};
  const plan={name:'Actual plan',websiteLimit:8,storageLimitMb:4096,aiCreditLimit:713,billingInterval:'monthly'};
  const subscription={status:'ACTIVE',plan,currentPeriodStart:new Date('2026-10-01T00:00:00Z'),currentPeriodEnd:new Date('2026-11-01T00:00:00Z')};
  const prisma={
    website:{count:async args=>{calls.count=args;return 2;},findMany:async args=>{calls.sites??=[];calls.sites.push(args);return args.select.name ? [{id:'a',name:'Alpha'},{id:'b',name:'Beta'}] : options.sites??[site('a'),site('b')];}},
    mediaAsset:{aggregate:async args=>{calls.storage=args;if(options.storageFailure)throw Error('database secret');return {_sum:{sizeBytes:1048576}};}},
    user:{findUniqueOrThrow:async args=>{calls.balance=args;if(options.balanceFailure)throw Error('offline');return {optimizationCredits:37};},findMany:async args=>{calls.actors=args;return [{id:'u1',fullName:'Morgan'},{id:'u2',fullName:'Taylor'}];}},
    optimizationCreditLedger:{count:async args=>{calls.optimizations=args;return 4;}},
    aiExecution:{groupBy:async args=>{calls.activity=args;if(options.activityFailure)throw Error('offline');return options.rows??[
      {websiteId:'a',actorId:'u1',createdAt:new Date('2026-10-02T10:00:00Z'),_sum:{reservedUnits:3},_count:{_all:1}},
      {websiteId:'a',actorId:'u1',createdAt:new Date('2026-10-02T11:00:00Z'),_sum:{reservedUnits:2},_count:{_all:1}},
      {websiteId:'b',actorId:'u2',createdAt:new Date('2026-10-03T10:00:00Z'),_sum:{reservedUnits:7},_count:{_all:1}},
    ];}},
  };
  const service=await loadTypeScript('backend/src/services/dashboard-usage.service.ts',{
    '../config/prisma.js':{prisma},'../../config/prisma.js':{prisma},
    './subscription.service.js':{getUserSubscription:async id=>{calls.subscription=id;if(options.subscriptionFailure)throw Error('missing subscription');return {...subscription,...options.subscription};}},
    './license.service.js':{getUserLicenses:async id=>{calls.license=id;return [
      {status:'ACTIVE',expiresAt:null,telemetry:{productionActivations:2,localhostActivations:1}},
      {status:'ACTIVE',expiresAt:'2020-01-01',telemetry:{productionActivations:9,localhostActivations:9}},
      {status:'REVOKED',telemetry:{productionActivations:9,localhostActivations:9}},
    ];}},
    '../workspaces/access.js':{requireActiveActor:async()=>{}},
  });
  return {service,calls};
}
test('dashboard telemetry reads actual quotas, balances and active unexpired license usage without fabricating AI credits',async()=>{
  const {service,calls}=await fixture();const result=await service.getDashboardUsage('owner','cycle',now);
  assert.equal(result.websites.used,2);assert.equal(result.websites.limit,8);assert.equal(result.storage.usedBytes,1048576);
  assert.equal(result.optimization.balance,37);assert.equal(result.optimization.performed,4);
  assert.equal(result.licensing.production,2);assert.equal(result.licensing.development,1);assert.equal(result.licensing.activeLicenses,1);
  assert.equal(result.credits.allowance,713);assert.equal(result.credits.used,null);assert.equal(result.credits.remaining,null);
  assert.equal(result.activity.units,12);assert.equal(result.activity.executions,3);assert.equal(result.activity.daily.length,2);
  assert.equal(result.activity.daily[0].units,5);assert.equal(result.activity.breakdown[0].websiteName,'Beta');
  assert.equal(result.activity.breakdown.find(row=>row.userName==='Morgan').executions,2);
  assert.equal(calls.count.where.userId,'owner');assert.equal(calls.count.where.status,undefined);assert.equal(calls.count.where.deletedAt,undefined);
  assert.equal(calls.storage.where.userId,'owner');assert.equal(calls.balance.where.id,'owner');assert.equal(calls.optimizations.where.actionType,'IMAGE_OPTIMIZATION');
  assert.equal(calls.activity.where.status,'COMPLETED');assert.equal(calls.activity.where.createdAt.gte.toISOString(),'2026-10-01T00:00:00.000Z');
  assert.equal(calls.activity.where.createdAt.lt.toISOString(),now.toISOString());assert.deepEqual(Array.from(calls.activity.where.websiteId.in),['a','b']);
});
test('revoked membership and explicit VIEW denial cannot reveal site names or activity',async()=>{
  const {service,calls}=await fixture({sites:[site('a'),site('revoked',{workspaceId:'ws',organizationId:'org',organization:{ownerId:'owner',members:[]},workspace:{ownerId:'owner',organizationId:'org',members:[]}}),site('denied',{granularPermissions:[{effect:'DENY'}]})],rows:[]});
  const result=await service.getDashboardUsage('owner','30d',now);assert.deepEqual(Array.from(calls.activity.where.websiteId.in),['a']);
  assert.equal(calls.activity.where.createdAt.gte.toISOString(),'2026-09-23T12:00:00.000Z');assert.equal(result.activity.units,0);
});
test('failed sources remain unavailable and healthy sections still render real data',async()=>{
  const {service}=await fixture({storageFailure:true,balanceFailure:true,activityFailure:true});const result=await service.getDashboardUsage('owner','90d',now);
  assert.equal(result.storage.usedBytes,null);assert.equal(result.optimization.balance,null);assert.equal(result.activity,null);
  assert.equal(result.websites.used,2);assert.equal(result.issues.length,3);assert.ok(!JSON.stringify(result).includes('database secret'));
});
test('missing subscription does not provision a plan or claim a reset date; rolling activity remains available',async()=>{
  const {service,calls}=await fixture({subscriptionFailure:true});const cycle=await service.getDashboardUsage('owner','cycle',now);
  assert.equal(cycle.subscription,null);assert.equal(cycle.websites.limit,null);assert.equal(cycle.credits.allowance,null);assert.equal(cycle.activity,null);assert.equal(calls.activity,undefined);
  const rolling=await service.getDashboardUsage('owner','90d',now);assert.equal(rolling.activity.executions,3);
});
test('cycle is half-open and bounded by the real period end, while a null end never invents a reset',async()=>{
  const {service,calls}=await fixture({subscription:{currentPeriodEnd:new Date('2026-10-15T00:00:00Z')}});await service.getDashboardUsage('owner','cycle',now);
  assert.equal(calls.activity.where.createdAt.lt.toISOString(),'2026-10-15T00:00:00.000Z');
  const missingEnd=await fixture({subscription:{currentPeriodEnd:null}});const result=await missingEnd.service.getDashboardUsage('owner','cycle',now);
  assert.equal(result.subscription.currentPeriodEnd,null);assert.equal(result.range.end,now.toISOString());
});
test('invalid ranges and absent authentication are rejected before any data reads',async()=>{
  const {service,calls}=await fixture();await assert.rejects(service.getDashboardUsage('','cycle',now),{code:'UNAUTHORIZED'});
  await assert.rejects(service.getDashboardUsage('owner','year',now),{code:'INVALID_USAGE_RANGE'});assert.equal(calls.subscription,undefined);
});
test('chart model preserves actual totals when bucketing, with zeroes only on known empty days',async()=>{
  const model=await loadTypeScript('frontend/src/features/usage/usage-model.ts');
  const data={range:{start:'2026-07-01T00:00:00Z',end:now.toISOString()},activity:{daily:[{date:'2026-07-02',units:3,executions:1},{date:'2026-10-22',units:7,executions:2}]}};
  const buckets=model.chartBuckets(data);assert.ok(buckets.length<=31);assert.equal(buckets.reduce((sum,row)=>sum+row.units,0),10);
  assert.equal(buckets.reduce((sum,row)=>sum+row.executions,0),3);assert.equal(model.percentage(2,0),null);assert.equal(model.percentage(12,10),100);assert.equal(model.number(null),'Unavailable');
  assert.equal(model.chartBuckets({...data,activity:null}).length,0);
});
test('dashboard HTTP handler takes scope from the session, validates range, and forbids caching',async()=>{
  const calls=[];const controller=await loadTypeScript('backend/src/controllers/usage.controller.ts',{
    '../services/usage.service.js':{getUserUsageSummary:async()=>{throw Error('legacy endpoint must remain independent');}},
    '../services/dashboard-usage.service.js':{getDashboardUsage:async(...args)=>{calls.push(args);return {success:true};}},
  });
  const headers={};let payload;let failure;
  const res={locals:{user:{id:'session-owner'}},setHeader:(name,value)=>{headers[name]=value;},json:value=>{payload=value;}};
  await controller.getDashboardUsageHandler({query:{range:'30d',userId:'someone-else'}},res,error=>{failure=error;});
  assert.deepEqual(Array.from(calls[0]),['session-owner','30d']);assert.equal(headers['Cache-Control'],'private, no-store');assert.equal(payload.success,true);assert.equal(failure,undefined);
  await controller.getDashboardUsageHandler({query:{range:['cycle','90d']}},res,error=>{failure=error;});assert.equal(failure.code,'INVALID_USAGE_RANGE');
  res.locals={};await controller.getDashboardUsageHandler({query:{}},res,error=>{failure=error;});assert.equal(failure.code,'UNAUTHORIZED');assert.equal(calls.length,1);
});
