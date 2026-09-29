import test from 'node:test';import assert from 'node:assert/strict';import {loadTypeScript} from './load-typescript.mjs';
const module=await loadTypeScript('frontend/src/features/editor-access/document-save-coordinator.ts',{}, {AbortSignal,crypto:globalThis.crypto});
const transport=await loadTypeScript('frontend/src/features/editor-access/save-authorized-website.ts',{}, {AbortSignal});
const ack=version=>({id:'site',name:'Site',slug:'site',status:'DRAFT',documentVersion:version,updatedAt:new Date().toISOString()});
test('DOC-CLIENT-001: manual and automatic commands are serialized using acknowledged versions',async()=>{
 const calls=[];let counter=0;const writer=new module.DocumentSaveCoordinator(async(payload,options)=>{calls.push({payload,options});return ack(options.expectedVersion+1);},()=>`test-key-${++counter}`);
 writer.initialize(1);await Promise.all([writer.save({editorData:{text:'A'}}),writer.save({editorData:{text:'B'}})]);
 assert.deepEqual(calls.map(c=>c.options.expectedVersion),[1,2]);assert.notEqual(calls[0].options.key,calls[1].options.key);
});
test('DOC-CLIENT-002: unknown result retries immutable prior bytes and key before newer changes',async()=>{
 const calls=[];let counter=0;const writer=new module.DocumentSaveCoordinator(async(payload,options)=>{calls.push({payload,options});if(calls.length===1)throw new Error('network');return ack(options.expectedVersion+1);},()=>`test-key-${++counter}`);
 writer.initialize(1);await assert.rejects(writer.save({editorData:{text:'A'}}));await writer.save({editorData:{text:'B'}});
 assert.equal(calls[0].options.key,calls[1].options.key);assert.equal(calls[1].payload.editorData.text,'A');assert.equal(calls[2].options.expectedVersion,2);assert.equal(calls[2].payload.editorData.text,'B');
});
test('DOC-CLIENT-003: repeating the same unknown save does not create a second command',async()=>{
 const calls=[];let key=0;const writer=new module.DocumentSaveCoordinator(async(payload,options)=>{calls.push(options);if(calls.length===1)throw new Error('lost ack');return ack(2);},()=>`test-key-${++key}`);
 writer.initialize(1);const payload={editorData:{text:'A'}};await assert.rejects(writer.save(payload));assert.equal((await writer.save(payload)).documentVersion,2);assert.equal(calls.length,2);assert.equal(key,1);
});
test('DOC-CLIENT-004: conflict freezes further writes until explicit canonical reload',async()=>{
 // Use the same module realm's transport class through a typed response; a plain
 // object with a status is intentionally not accepted as a trusted transport error.
 let calls=0;const load=await loadTypeScript('frontend/src/features/editor-access/document-save-coordinator.ts',{}, {AbortSignal,fetch:async()=>{calls++;return {ok:false,status:412,json:async()=>({code:'DOCUMENT_VERSION_CONFLICT',detail:'Reload and compare'})};},crypto:globalThis.crypto});
 const writer=load.createDocumentSaveCoordinator('http://local','site');writer.initialize(1);
 await assert.rejects(writer.save({editorData:{text:'A'}}),{status:412});await assert.rejects(writer.save({editorData:{text:'B'}}),{status:412});assert.equal(calls,1);
});
test('DOC-CLIENT-005: draft transport strips server-owned fields without mutating editor state',()=>{
 const input={editorData:{elements:[],publishing:{status:'PUBLISHED'},publishedData:{secret:'draft'},hostingConfig:{x:1}}};
 const output=transport.draftWritePayload(input);assert.deepEqual(Object.keys(output.editorData),['elements']);assert.ok(input.editorData.publishedData);
});
test('DOC-CLIENT-006: valid save transports scope, version, intent and idempotency key',async()=>{
 let sent;const {saveAuthorizedWebsite}=await loadTypeScript('frontend/src/features/editor-access/save-authorized-website.ts',{}, {AbortSignal,fetch:async(url,options)=>{sent=options;return {ok:true,status:200,json:async()=>({website:ack(2)})};}});
 await saveAuthorizedWebsite('http://local','site',{editorData:{elements:[]}},{expectedVersion:1,key:'test-save-0001'});
 assert.equal(sent.headers['If-Match'],'"site:document:1"');assert.equal(sent.headers['Idempotency-Key'],'test-save-0001');assert.equal(sent.headers['X-Forge-Intent'],'document-command');
});
