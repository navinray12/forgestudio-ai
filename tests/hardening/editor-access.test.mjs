import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTypeScript} from './load-typescript.mjs';
const {useComponentAccess}=await loadTypeScript('frontend/src/features/permissions/hooks/useComponentAccess.ts', {react:{useMemo:(fn)=>fn()}});
for(const website of [null,{}, {role:{}}, {userPermission:'VIEWER'}])test(`AUTH-002: missing or read-only editor access does not default to owner (${JSON.stringify(website)})`,()=>{
 const access=useComponentAccess(website);assert.equal(access.canEditDesign,false);assert.equal(access.canPublish,false);assert.equal(access.canManageSettings,false);
});
for(const status of [401,403,404,500])test(`AUTH-003: denied/unavailable load ${status} cannot use browser cache`,async()=>{
 const {loadAuthorizedWebsite}=await loadTypeScript('frontend/src/features/editor-access/load-authorized-website.ts',{}, {fetch:async()=>({ok:false,status})});
 await assert.rejects(loadAuthorizedWebsite('https://example.test','site',new AbortController().signal));
});
test('TEN-001: wrong website identity in response is rejected',async()=>{
 const {loadAuthorizedWebsite}=await loadTypeScript('frontend/src/features/editor-access/load-authorized-website.ts',{}, {fetch:async()=>({ok:true,json:async()=>({website:{id:'other',userPermission:'OWNER'}})})});
 await assert.rejects(loadAuthorizedWebsite('https://example.test','site',new AbortController().signal),/scope/);
});
test('AUTH-001: valid authorized response preserves current actor role',async()=>{
 let request;const {loadAuthorizedWebsite}=await loadTypeScript('frontend/src/features/editor-access/load-authorized-website.ts',{}, {fetch:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({website:{id:'site',userPermission:'VIEWER'}})};}});
 const signal=new AbortController().signal;const data=await loadAuthorizedWebsite('https://example.test','site',signal);
 assert.equal(data.userPermission,'VIEWER');assert.equal(request.options.signal,signal);assert.equal(request.options.credentials,'include');
});
for(const status of [403,409,412,500])test(`FG-003: failed save ${status} cannot acknowledge a persisted document`,async()=>{
 const {saveAuthorizedWebsite}=await loadTypeScript('frontend/src/features/editor-access/save-authorized-website.ts',{}, {AbortSignal,fetch:async()=>({ok:false,status,json:async()=>({error:{message:'not committed'}})})});
 await assert.rejects(saveAuthorizedWebsite('https://example.test','site',{editorData:{}},{expectedVersion:1,key:'test-save-0001'}),/not committed/);
});
test('FG-003: network failure does not become local-save success',async()=>{
 const {saveAuthorizedWebsite}=await loadTypeScript('frontend/src/features/editor-access/save-authorized-website.ts',{}, {AbortSignal,fetch:async()=>{throw new Error('network unavailable');}});
 await assert.rejects(saveAuthorizedWebsite('https://example.test','site',{editorData:{}},{expectedVersion:1,key:'test-save-0001'}),/outcome is unknown/);
});
test('FG-003: acknowledgement must reference the saved site',async()=>{
 const {saveAuthorizedWebsite}=await loadTypeScript('frontend/src/features/editor-access/save-authorized-website.ts',{}, {AbortSignal,fetch:async()=>({ok:true,json:async()=>({website:{id:'other'}})})});
 await assert.rejects(saveAuthorizedWebsite('https://example.test','site',{editorData:{}},{expectedVersion:1,key:'test-save-0001'}),/acknowledgement/);
});
