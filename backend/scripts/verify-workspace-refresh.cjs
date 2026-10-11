/** Actual source policies/effect callbacks with explicit transport/React/DB doubles.
 * Not browser, database, full-stack, or release certification.
 */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
function evaluate(code, globals={}) {
 const mod={exports:{}};
 const compiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
 assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(compiled.outputText,{module:mod,exports:mod.exports,console,AbortController,AbortSignal,URL,Buffer,...globals},{timeout:2000});
 return mod.exports;
}
function moduleAt(file,deps={},globals={}) {
 return evaluate(read(file),{require:id=>{
  if(id.startsWith('node:'))return require(id);
  if(Object.hasOwn(deps,id))return deps[id];
  throw Error(`Unmocked dependency ${id}`);
 },...globals});
}
const helper='frontend/src/features/developer-workspace/services/workspaceRefreshPolicy.ts';
const {decideWorkspaceRefresh:decision,readPreviewCommand:command}=moduleAt(helper);
const cases=[
 ['clean newer',2,1,false,false,'apply'],['dirty newer',2,1,true,false,'dirty'],
 ['same',1,1,false,false,'stale'],['older',1,2,false,false,'stale'],
 ['forced same',2,2,false,true,'apply'],['forced dirty',3,2,true,true,'apply'],
 ['forced older',1,2,true,true,'stale'],['invalid server',NaN,1,false,false,'invalid'],
 ['zero',0,1,false,false,'invalid'],['fraction',1.5,1,false,false,'invalid'],
 ['invalid current',2,0,false,false,'invalid'],['overflow',Number.MAX_SAFE_INTEGER+1,1,false,false,'invalid'],
];
for(const [name,s,c,dirty,forced,expected] of cases)test(`refresh decision: ${name}`,()=>assert.equal(decision(s,c,()=>dirty,forced),expected));
test('dirty predicate is evaluated, not treated as an always-true function',()=>{
 let calls=0;assert.equal(decision(2,1,()=>{calls++;return false;}),'apply');assert.equal(calls,1);
});
const parent={},self={},origin='https://forge.example';
const ctx={parent,self,origin,isPreview:true};
const event=(data,changes={})=>({source:parent,origin,data,...changes});
test('same-origin parent can request reload',()=>assert.equal(command(event({type:'forge:preview:reload'}),ctx).type,'reload'));
test('same-origin parent can select a local route',()=>assert.equal(command(event({type:'forge:preview:set-route',route:'/about'}),ctx).route,'/about'));
for(const [name,changes,context] of [
 ['wrong source',{source:{}},ctx],['wrong origin',{origin:'https://other.example'},ctx],
 ['public page',{}, {...ctx,isPreview:false}],['top level',{}, {...ctx,parent:self}],
 ['opaque origin',{origin:'null'},{...ctx,origin:'null'}],['missing parent',{}, {...ctx,parent:null}],
])test(`bridge rejects ${name}`,()=>assert.equal(command(event({type:'forge:preview:reload'},changes),context),null));
for(const route of ['https://other.example','//other.example','/\\other','/with space','/\nreload','x','/'+ 'a'.repeat(2048),42,null])test(`invalid preview route ${JSON.stringify(route).slice(0,60)}`,()=>assert.equal(command(event({type:'forge:preview:set-route',route}),ctx),null));
for(const data of [null,[],42,'reload',{}, {type:'delete-everything'}])test(`invalid bridge data ${JSON.stringify(data)}`,()=>assert.equal(command(event(data),ctx),null));
const loaderFile='frontend/src/features/developer-workspace/services/loadSiteSnapshot.ts';
function loader(fetcher){
 const authorized=moduleAt('frontend/src/features/editor-access/load-authorized-website.ts',{}, {fetch:fetcher});
 return moduleAt(loaderFile,{'../../editor-access/load-authorized-website':authorized},{fetch:fetcher}).loadSiteSnapshot;
}
const response=(site,status=200,contentType='application/json')=>({ok:status===200,status,headers:{get:()=>contentType},json:async()=>({website:site})});
for(const status of [401,403,404,500])test(`draft ${status} never falls back to public`,async()=>{
 const calls=[];const load=loader(async(url)=>{calls.push(url);return response({},status);});
 await assert.rejects(load('https://api.example','site',true,new AbortController().signal));
 assert.equal(calls.length,1);assert.ok(!calls[0].includes('/public/'));
});
test('authorized draft preserves role and cancellation signal',async()=>{
 let request;const signal=new AbortController().signal;
 const load=loader(async(url,options)=>{request={url,options};return response({id:'site',userPermission:'VIEWER'});});
 assert.equal((await load('https://api.example','site',true,signal)).userPermission,'VIEWER');
 assert.equal(request.options.signal,signal);assert.equal(request.options.credentials,'include');
});
test('public read sends no credential and validates returned site',async()=>{
 let request;const load=loader(async(url,options)=>{request={url,options};return response({id:'site'});});
 assert.equal((await load('https://api.example','site',false,new AbortController().signal)).id,'site');
 assert.equal(request.options.credentials,'omit');assert.match(request.url,/\/public\/site$/);
});
for(const [name,r] of [['other site',response({id:'other'})],['HTML',response({},200,'text/html')],['unavailable',response({},503)]])test(`public load rejects ${name}`,async()=>{
 const load=loader(async()=>r);await assert.rejects(load('https://api.example','site',false,new AbortController().signal));
});
function effectSource(predicate){
 const file='frontend/src/pages/published/PublishedSite.tsx';
 const parsed=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let result;
 function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(parsed)==='useEffect'&&predicate(node.getText(parsed))){assert.equal(result,undefined);result=node.arguments[0].getText(parsed);}ts.forEachChild(node,visit);}
 visit(parsed);assert.ok(result,'Actual PublishedSite effect was not found');return result;
}
const loadEffect=effectSource(text=>text.includes('const fetchWebsite = async'));
const bridgeEffect=effectSource(text=>text.includes('const handleParentMessage'));
function callbackSource(name){
 const f='frontend/src/pages/editor/WebsiteEditor.tsx';const parsed=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let result;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(parsed)===name){result=n.initializer.arguments[0].getText(parsed);}ts.forEachChild(n,visit);}visit(parsed);assert.ok(result);return result;
}
const editorReload=callbackSource('reloadWebsiteFromWorkspace');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function setupLoad(load){
 const writes=[];const globals={websiteId:'site',apiUrl:'https://api.example',pageSlug:undefined,isPreview:true,loadSiteSnapshot:load,DEFAULT_BREAKPOINTS:[],window:{location:{search:''}},findTargetPage:(pages,slug)=>pages.find(p=>p.slug===slug)};
 for(const name of ['setLoading','setErrorMessage','setElements','setPages','setActivePageId','setPopups','setBreakpoints','setGlobalSettings','setGlobalVariables','setGlobalClasses','setCustomCodeSnippets','setSiteStatus','_setThemeRules','setCookieConsentConfig','setExperiments','setSitePartsState'])globals[name]=value=>writes.push({name,value});
 return{writes,start:()=>evaluate(`module.exports = (${loadEffect});`,globals)()};
}
test('actual load effect ignores late data after cleanup',async()=>{
 const wait=deferred();let signal;const h=setupLoad(async(_a,_b,_c,s)=>{signal=s;return wait.promise;});
 const cleanup=h.start();cleanup();const before=h.writes.length;wait.resolve({id:'site',editorData:{elements:[{id:'late'}]}});await settle();
 assert.equal(signal.aborted,true);assert.equal(h.writes.length,before);
});
test('actual load effect replaces pages and clears removed optional state',async()=>{
 const h=setupLoad(async()=>({id:'site',status:'PUBLISHED',editorData:{elements:[{id:'fresh'}]}}));h.start();await settle();
 assert.ok(h.writes.some(x=>x.name==='setElements'&&x.value[0]?.id==='fresh'));
 for(const name of ['setPopups','setGlobalClasses','setGlobalVariables','setCustomCodeSnippets','setExperiments'])assert.ok(h.writes.some(x=>x.name===name&&Array.isArray(x.value)&&x.value.length===0));
 assert.equal(h.writes.filter(x=>x.name==='setLoading').at(-1).value,false);
});
test('actual load effect rejects malformed saved JSON instead of generating an empty document',async()=>{
 const h=setupLoad(async()=>({id:'site',editorData:'{broken'}));h.start();await settle();
 assert.ok(h.writes.some(x=>x.name==='setErrorMessage'&&x.value));
 assert.ok(!h.writes.some(x=>x.name==='setPages'&&x.value.length));
});
test('actual load effect records failure then supports a successful retry',async()=>{
 let fail=true;const h=setupLoad(async()=>{if(fail)throw Error('offline');return{id:'site',editorData:{elements:[]}};});
 h.start();await settle();assert.ok(h.writes.some(x=>x.name==='setErrorMessage'&&x.value));
 fail=false;h.start();await settle();assert.equal(h.writes.filter(x=>x.name==='setErrorMessage').at(-1).value,'');
});
test('actual bridge invokes reload state rather than inaccessible fetchWebsite',()=>{
 const events={};let tick=0;
 const window={parent,location:{origin},addEventListener:(type,handler)=>events[type]=handler,removeEventListener:(type,handler)=>{assert.equal(events[type],handler);delete events[type];}};
 const context={window,isPreview:true,pages:[],activePageId:'home',readPreviewCommand:command,setReloadTick:fn=>tick=fn(tick),setElements:()=>{},setActivePageId:()=>{}};
 const cleanup=evaluate(`module.exports=(${bridgeEffect});`,context)();
 events.message(event({type:'forge:preview:reload'}));assert.equal(tick,1);
 events.message(event({type:'forge:preview:reload'},{source:{}}));assert.equal(tick,1);
 cleanup();assert.equal(events.message,undefined);
});
function setupEditor(load,dirty=false){
 const writes=[];const refs={workspaceReloadSequence:{current:0},hasUnsavedRef:{current:()=>dirty},websiteDocVerRef:{current:1},activePageIdRef:{current:'home'}};
 const g={...refs,websiteId:'site',apiUrl:'https://api.example',loadAuthorizedWebsite:load,decideWorkspaceRefresh:decision,documentWriter:{initialize:v=>writes.push(['revision',v])},updateAutosaveBaseline:()=>{},siteParts:{},globalSettings:{},publishing:{},deployment:{},breakpoints:[],popups:[],pageCss:'',setTimeout:()=>0};
 for(const name of ['setSaveMessage','setWebsite','setPages','setActivePageId','setActivePreviewPageId','setElements','setPageSettings','setBreakpoints','setHomePageId'])g[name]=value=>writes.push([name,value]);
 return{...refs,writes,reload:evaluate(`module.exports=(${editorReload});`,g)};
}
const site=version=>({id:'site',name:'Example',documentVersion:version,editorData:{pages:[{id:'home',name:'Home',slug:'/',elements:[{id:'heading'}],pageSettings:{title:'Home'}}]}});
test('actual editor reload applies a newer clean snapshot',async()=>{
 const h=setupEditor(async()=>site(2));await h.reload();assert.equal(h.websiteDocVerRef.current,2);assert.ok(h.writes.some(([k])=>k==='setWebsite'));
});
test('actual editor reload retains dirty local work',async()=>{
 const h=setupEditor(async()=>site(2),true);await h.reload();assert.equal(h.websiteDocVerRef.current,1);assert.ok(!h.writes.some(([k])=>k==='setWebsite'));assert.ok(h.writes.some(([k])=>k==='setSaveMessage'));
});
test('actual editor reload ignores out-of-order responses',async()=>{
 const first=deferred(),second=deferred();let calls=0;const h=setupEditor(()=>++calls===1?first.promise:second.promise);
 const a=h.reload(),b=h.reload();second.resolve(site(3));await b;first.resolve(site(2));await a;
 assert.equal(h.websiteDocVerRef.current,3);assert.equal(h.writes.filter(([k])=>k==='setWebsite').length,1);
});
test('actual editor reload cannot apply after subscription cleanup invalidates its sequence',async()=>{
 const d=deferred();const h=setupEditor(()=>d.promise);const request=h.reload();h.workspaceReloadSequence.current++;d.resolve(site(2));await request;assert.equal(h.writes.length,0);
});
// Backend integration boundaries: real services, explicitly mocked persistence.
test('heartbeat resolves display identity from the server, not request data',async()=>{
 const calls=[];const db={user:{findUnique:async()=>({fullName:'Verified member'})},forgeCollaborationSession:{upsert:async p=>calls.push(p)}};
 const {CollaborationEngineService}=moduleAt('backend/src/modules/collaboration/collaborationEngine.service.ts',{'../../config/prisma.js':{prisma:db},'../../utils/app-error.js':{AppError:Error},'../../services/project/forgeFilesystem.service.js':{forgeFilesystemService:{}}});
 const peers=await new CollaborationEngineService().heartbeatSession('p','u',{name:'Forged name',color:'bad css'});
 assert.equal(peers[0].name,'Verified member');assert.match(peers[0].color,/^#[a-f0-9]{6}$/);assert.equal(calls.length,1);
});
test('heartbeat rejects an unresolved authenticated principal',async()=>{
 const db={user:{findUnique:async()=>null}};
 const {CollaborationEngineService}=moduleAt('backend/src/modules/collaboration/collaborationEngine.service.ts',{'../../config/prisma.js':{prisma:db},'../../utils/app-error.js':{AppError:Error},'../../services/project/forgeFilesystem.service.js':{forgeFilesystemService:{}}});
 await assert.rejects(new CollaborationEngineService().heartbeatSession('p','absent'),/Authenticated/);
});
test('scaffold caller uses supported option and result contracts (not full-stack qualification)',async()=>{
 let options,audit;
 const {FullStackGeneratorService}=moduleAt('backend/src/services/generator/fullStackGenerator.service.ts',{
 '../../utils/app-error.js':{AppError:Error},'../../config/prisma.js':{prisma:{}},
 '../project/forgeProject.service.js':{forgeProjectService:{getProjectById:async()=>({id:'p',name:'Original'})}},
 '../project/forgeFilesystem.service.js':{forgeFilesystemService:{writeFile:async()=>{}}},
 '../../modules/design-system/projectTemplate.service.js':{projectTemplateService:{scaffoldTemplate:async(_p,_t,o)=>{options=o;return{filesCreated:['a.tsx','b.css'],templateName:'test'};}}},
 './projectGenerator.service.js':{projectGeneratorService:{}},'../audit.service.js':{recordAuditLog:async o=>audit=o},
 },{process:{env:{}}});
 const result=await new FullStackGeneratorService().generateFullStackProject({projectId:'p',name:'Chosen',authorId:'actor',prompt:'not tested',useAiIfAvailable:false});
 assert.equal(options.userId,'actor');assert.equal(options.customVariables.name,'Chosen');assert.equal(result.filesCreated,2);assert.equal(audit.details.filesCreated,2);
});
