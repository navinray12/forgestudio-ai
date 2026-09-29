import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTypeScript} from './load-typescript.mjs';
const policy=await loadTypeScript('backend/src/services/websites/document-policy.ts');
const editor={version:1,elements:[{id:'a',type:'heading',content:{text:'Old'},style:{color:'black'}}]};
const design={canDesign:true,canContent:true,canManage:false,editableProtectedIds:new Set()};
const content={...design,canDesign:false};
for(const value of [null,[],1,'x',undefined])test(`DOC-001: invalid root ${typeof value} is rejected`,()=>assert.throws(()=>policy.documentObject(value),{code:'DOCUMENT_INVALID'}));
test('DOC-002: canonical hashing ignores object key order',()=>assert.equal(policy.canonicalDocumentJson({b:2,a:{d:4,c:3}}),policy.canonicalDocumentJson({a:{c:3,d:4},b:2})));
for(const value of [NaN,Infinity,()=>{},new Date(),{x:undefined},JSON.parse('{"__proto__":{"admin":true}}')])test(`DOC-003: unsupported values cannot enter durable document ${String(value)}`,()=>assert.throws(()=>policy.documentObject({data:value}),{code:'DOCUMENT_INVALID'}));
test('DOC-004: accessor properties are never executed',()=>{let invoked=false;const obj={};Object.defineProperty(obj,'secret',{get(){invoked=true;return 1;},enumerable:true});assert.throws(()=>policy.documentObject(obj));assert.equal(invoked,false);});
test('DOC-005: document bytes and recursion are bounded',()=>{
 assert.throws(()=>policy.documentObject({text:'x'.repeat(4*1024*1024)}),{code:'DOCUMENT_TOO_LARGE'});
 const cycle={};cycle.self=cycle;assert.throws(()=>policy.documentObject(cycle),{code:'DOCUMENT_TOO_COMPLEX'});
});
for(const key of ['publishing','publishedData','releases','currentReleaseId','deployment','hostingConfig','backups'])test(`DOC-006: draft cannot forge ${key}`,()=>assert.throws(()=>policy.authorizeDocumentEdit(editor,{...editor,[key]:{status:'PUBLISHED'}},{...design,canManage:true}),{code:'PUBLISH_COMMAND_REQUIRED'}));
test('DOC-007: content role edits existing copy but cannot change layout or add a page',()=>{
 const next=structuredClone(editor);next.elements[0].content.text='New';assert.equal(policy.authorizeDocumentEdit(editor,next,content).elements[0].content.text,'New');
 next.elements[0].style.color='red';assert.throws(()=>policy.authorizeDocumentEdit(editor,next,content),{code:'DOCUMENT_EDIT_FORBIDDEN'});
 assert.throws(()=>policy.authorizeDocumentEdit(editor,{...editor,pages:[{id:'p',elements:[]}]},content),{code:'DOCUMENT_EDIT_FORBIDDEN'});
});
test('DOC-008: protected page, popup and header nodes cannot be removed or changed',()=>{
 for(const source of [{elements:[{id:'p',isProtected:true}]},{pages:[{id:'home',elements:[{id:'p',isProtected:true}]}]},{siteParts:{header:{elements:[{id:'p',isProtected:true}]}}},{popups:[{id:'pop',elements:[{id:'p',isProtected:true}]}]}]) {
  const target=JSON.parse(JSON.stringify(source).replace('"isProtected":true','"isProtected":false'));
  assert.throws(()=>policy.authorizeDocumentEdit(source,target,design),{code:'PROTECTED_COMPONENT'});
 }
});
test('DOC-009: design role can add ordinary nodes but cannot add protection',()=>{
 assert.equal(policy.authorizeDocumentEdit({elements:[]},{elements:[{id:'new',isProtected:false}]},design).elements.length,1);
 assert.throws(()=>policy.authorizeDocumentEdit({elements:[]},{elements:[{id:'new',isProtected:true}]},design),{code:'PROTECTED_COMPONENT'});
});
test('DOC-010: duplicate node ids are rejected',()=>assert.throws(()=>policy.validateDocumentTree({elements:[{id:'a'},{id:'a'}]}),{code:'DOCUMENT_INVALID'}));
test('DOC-011: document ETag binds both website identity and version',()=>{
 const id='f43a91fa-6a42-4089-8747-caa30c42ab13';assert.equal(policy.parseDocumentETag(id,policy.documentETag(id,5)),5);
 for(const value of [undefined,'*','W/"5"','"5"',policy.documentETag('c43a91fa-6a42-4089-8747-caa30c42ab13',5)])assert.throws(()=>policy.parseDocumentETag(id,value),{code:'DOCUMENT_PRECONDITION_REQUIRED'});
});

test('DOC-012: SEO permission edits approved metadata only, never routes or layout',()=>{
 const before={pages:[{id:'home',elements:[],pageSettings:{path:'/',seoTitle:'Old'}}]};
 const after=structuredClone(before);after.pages[0].pageSettings.seoTitle='New';
 assert.equal(policy.authorizeDocumentEdit(before,after,{...content,canSeo:true}).pages[0].pageSettings.seoTitle,'New');
 after.pages[0].pageSettings.path='/forged';assert.throws(()=>policy.authorizeDocumentEdit(before,after,{...content,canSeo:true}),{code:'DOCUMENT_EDIT_FORBIDDEN'});
});
