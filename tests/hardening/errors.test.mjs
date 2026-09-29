import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';
class AppError extends Error { constructor(message,statusCode,code){super(message);this.statusCode=statusCode;this.code=code;} }
async function fixture(){
 const logs=[]; const {errorMiddleware}=await loadTypeScript('backend/src/middlewares/error.middleware.ts',{'../utils/app-error.js':{AppError}}, {console:{error:(message)=>logs.push(message)}});
 const response={headers:{},headersSent:false,locals:{},setHeader(key,value){this.headers[key]=value;},type(value){this.contentType=value;return this;},status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;}};
 return {errorMiddleware,response,logs};
}
test('SEC-002: unexpected errors cannot expose SQL, tokens or stack through response/logging',async()=>{
 const f=await fixture();f.errorMiddleware(new Error('SELECT password FROM users; token=secret'),{},f.response,()=>{});
 assert.equal(f.response.statusCode,500);assert.equal(f.response.contentType,'application/problem+json');
 assert.ok(!JSON.stringify([f.response.body,f.logs]).includes('secret'));
 assert.ok(!JSON.stringify([f.response.body,f.logs]).includes('SELECT'));
 assert.equal(f.response.headers['Cache-Control'],'no-store');
 assert.equal(f.response.body.requestId,f.response.headers['X-Request-Id']);
});
test('API-001: known domain errors retain legacy and problem-details fields',async()=>{
 const f=await fixture();f.errorMiddleware(new AppError('Workspace not found',404,'NOT_FOUND'),{},f.response,()=>{});
 assert.equal(f.response.body.status,404);assert.equal(f.response.body.error.code,'NOT_FOUND');
 assert.equal(f.response.body.detail,'Workspace not found');assert.equal(f.logs.length,0);
});
for(const code of ['P1001','P1002','P1008','P1017','P2024'])test(`REL-001: ${code} becomes controlled service unavailability`,async()=>{
 const f=await fixture();f.errorMiddleware({code,message:'sensitive connection string'}, {},f.response,()=>{});
 assert.equal(f.response.statusCode,503);assert.equal(f.response.body.code,'DEPENDENCY_UNAVAILABLE');
});
for(const [type,status] of [['entity.too.large',413],['entity.parse.failed',400]])test(`API-002: ${type} maps without reflecting the body`,async()=>{
 const f=await fixture();f.errorMiddleware({type,body:'private-input'}, {},f.response,()=>{});
 assert.equal(f.response.statusCode,status);assert.ok(!JSON.stringify(f.response.body).includes('private-input'));
});
test('REL-001: an already-started response passes to connection error handling',async()=>{
 const f=await fixture();f.response.headersSent=true;const error=new Error('late failure');let observed;
 f.errorMiddleware(error,{},f.response,(value)=>{observed=value;});assert.equal(observed,error);assert.equal(f.response.body,undefined);
});
