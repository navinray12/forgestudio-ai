import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTypeScript} from './load-typescript.mjs';
async function fixture({failure=false}={}) {
 const queries=[];
 const module=await loadTypeScript('backend/src/controllers/health.controller.ts',{'../config/prisma.js':{pgPool:{query:async(input)=>{queries.push(input);if(failure)throw new Error('private connection detail');return {rows:[]};}}}}, {process:{env:{}}});
 const res={status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
 return {module,res,queries};
}
test('REL-001: liveness performs no database query',async()=>{
 const f=await fixture({failure:true});f.module.livenessCheck({},f.res);assert.equal(f.res.statusCode,200);assert.equal(f.queries.length,0);
});
test('SEC-002: readiness failure does not expose private error details',async()=>{
 const f=await fixture({failure:true});await f.module.healthCheck({},f.res);assert.equal(f.res.statusCode,503);
 assert.ok(!JSON.stringify(f.res.body).includes('private'));assert.equal(f.queries[0].text,'SELECT 1');
});
test('L-11: migration status is a bounded read and never repairs history',async()=>{
 const f=await fixture();await f.module.prismaMigrationStatus({},f.res);
 assert.equal(f.queries.length,1);assert.match(f.queries[0].text,/^SELECT /);assert.match(f.queries[0].text,/LIMIT 200/);
 assert.doesNotMatch(f.queries[0].text,/UPDATE|INSERT|DELETE|\blogs\b/);assert.equal(f.res.body.readOnly,true);
});
for(const name of ['prismaMigrationRecover','diagnosePorts','sanitizeDemo'])test(`L-11: retired ${name} has no effects`,async()=>{
 const f=await fixture();await f.module[name]({},f.res);assert.equal(f.res.statusCode,410);assert.equal(f.queries.length,0);
});
test('FG-020: HTTP sign-off cannot claim production readiness from hardcoded checks',async()=>{
 const f=await fixture();f.module.signOffReport({},f.res);assert.equal(f.res.body.productionReady,false);assert.equal(f.res.body.status,'NOT_VERIFIED');
});
test('SEC-002: privileged diagnostic routes require authentication and a staff guard',async()=>{
 const recorded=[];const auth=()=>{};const roles=()=>{};
 await loadTypeScript('backend/src/routes/health.routes.ts',{
  express:{Router:()=>({get:(path,...handlers)=>recorded.push({path,handlers}),post:(path,...handlers)=>recorded.push({path,handlers})})},
  '../middlewares/auth.middleware.js':{requireAuth:auth,requireRole:()=>roles},
  '../controllers/health.controller.js':Object.fromEntries(['healthCheck','livenessCheck','canaryManifest','signOffReport','sanitizeDemo','prismaMigrationStatus','prismaMigrationRecover','diagnosePorts'].map(name=>[name,()=>{}])),
 });
 for(const route of recorded.filter(route=>!['/health','/live','/ready'].includes(route.path))){assert.equal(route.handlers[0],auth);assert.equal(route.handlers[1],roles);}
});
