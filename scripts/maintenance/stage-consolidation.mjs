import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync, lstatSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

// Immutable-object staging only. No remote branch may be moved or deleted here.
// Another merge arrived while the first candidate was being qualified. Preserve
// it as ancestry and reconcile its exact duplicate-source blobs, never overwrite
// an unrecognized later edit or roll the repository back to the earlier base.
const repo='ooarchitect92/forge';
const source='20e7f7b25d7465f4b647b36e39d9e686e35a2c1e';
const base='9d1f456e206aac2e45ef50bbe6b4d0581d839220';
const interveningMerge='b8e40fb8d42dd55d156ee08fd137c52117615e32';
const payloadHash='2d5b51346e1ade7e584ea64cb028567e47dfcd71d881d8539077779e263b3e4f';
const parts=[
 '100fc0b8f8e22a953ded857865a7f3852a089c3b',
 '931fc304213b05bddd24faa3e044727b8cae28b5',
 '004ebf912ed244b4df7908f02ec3f586d7090f4a',
 '8d49efed64cde34bd6710ec699f919676bad9026',
 'fc4a0dd08c9b6383192ffe3b63273422706cb8f0',
 {sha:'c253571ea3f5bf53d671e9ad0cd24402164f8215',from:'A3SbcwK6AO',to:'A3SbcwK2AO',corrected:'329733aad80a14bd7a08d91f9644b3312ab7689b'},
 '59b42e4d0645a65841182072a1a98741d5c883ea',
 {sha:'63c4e33cbe016b9235f4d1cecf7d4913a073043d',from:'Frrjps0N3fff',to:'Frrjps0p3fff',corrected:'bec30c213fa230f765f9c8c3c42afbd947b7f3c4'},
 '8f6cfa9b3a7b30a7f12696149d8e40a34ad77bce',
 '5438cbf17cc7858f042d857ff33f2880b7ce9032',
 '027c0d5899f0593f3aecf5b07d826b1f77cd8e86',
 '81cc599692e75ab7e6bbefc70a6853a1d01808a0',
 'a2c9639d5fc371e28af041cdcd152763a59289c9',
 'b80273e05c6b55b9940a3429858985c883f60c23',
 '1b1b75217e40612d68064bad7aa813f44b6f872a',
 '225f2152be347ea7ccf02a8778595fbcdc9df09e',
];
const corrections=[
 {path:'.github/workflows/saas-foundations.yml',before:'3ca1b101cf42bc1f1d2332ef5a9cf6d3e5e82919',after:'44ba7195b798b8e32807d53f65c72266711e3d02'},
 {path:'tests/browser/saas-foundations-journey.py',before:'1a25d08a17ed80f7581f8b7fc6bb6a8b1e800e72',after:'8f78fb5a5c2eaab879aee2ec4887998d26ff803f'},
];
const root=process.cwd();
const output=resolve(process.env.RUNNER_TEMP||'/tmp','consolidation-candidate');
mkdirSync(output,{recursive:true});
if(process.env.GITHUB_REPOSITORY!==repo||!process.env.GH_TOKEN)throw Error('Authorized repository context required');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:64*1024*1024}).trim();
const hash=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
function objectAt(ref,path){try{return git('rev-parse','--verify',`${ref}:${path}`);}catch{return null;}}
async function api(path,body){
 const r=await fetch(`https://api.github.com/repos/${repo}/${path}`,{
  method:body?'POST':'GET',signal:AbortSignal.timeout(30000),
  headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{}),
 });
 if(!r.ok)throw Error(`GitHub object request failed: ${r.status} ${path}`);
 return r.json();
}
async function blob(sha){
 const obj=await api(`git/blobs/${sha}`);
 if(obj.encoding!=='base64'||obj.size>8*1024*1024)throw Error('Invalid blob representation');
 const b=Buffer.from(obj.content.replace(/\s/g,''),'base64');
 if(hash(b)!==sha)throw Error('Blob hash mismatch');
 return b;
}
function safePath(path){
 if(typeof path!=='string'||!path||path.includes('\\')||path.startsWith('/')||path.split('/').some(p=>!p||p==='.'||p==='..'||p==='.git'))throw Error('Unsafe candidate path');
 const target=resolve(root,path);
 if(!target.startsWith(root+'/'))throw Error('Path escaped repository');
 let current=dirname(target);
 while(current!==root){if(existsSync(current)&&lstatSync(current).isSymbolicLink())throw Error('Symlink directory rejected');current=dirname(current);}
 if(existsSync(target)&&lstatSync(target).isSymbolicLink())throw Error('Symlink target rejected');
 return target;
}
async function localObject(sha){
 const bytes=await blob(sha);
 const stored=execFileSync('git',['hash-object','-w','--stdin'],{input:bytes,encoding:'utf8'}).trim();
 if(stored!==sha)throw Error('Local object mismatch');
 return bytes;
}
const mode=process.argv[2];
if(mode==='stage'){
 if(git('status','--porcelain'))throw Error('Stage requires a clean checkout');
 for(const sha of [base,source,interveningMerge])git('merge-base','--is-ancestor',sha,'HEAD');
 const mergeParents=git('show','-s','--format=%P',interveningMerge).split(' ');
 if(mergeParents.length!==2||mergeParents[1]!==source)throw Error('Unexpected intervening merge');
 const main=(await api('git/ref/heads/main')).object.sha;
 if(main!==git('rev-parse','HEAD'))throw Error('Main advanced; rebuild against current head');
 if((await api('git/ref/heads/qualification/saas-foundations')).object.sha!==source)throw Error('Source branch advanced');
 const buffers=[];
 for(const item of parts){
  let b=await blob(typeof item==='string'?item:item.sha);
  if(typeof item!=='string'){
   const encoded=b.toString('base64');
   if(encoded.split(item.from).length!==2)throw Error('Unexpected transfer correction');
   b=Buffer.from(encoded.replace(item.from,item.to),'base64');
   if(hash(b)!==item.corrected)throw Error('Corrected chunk hash mismatch');
  }
  buffers.push(b);
 }
 const compressed=Buffer.concat(buffers);
 if(compressed.length!==48092||createHash('sha256').update(compressed).digest('hex')!==payloadHash)throw Error('Payload integrity failure');
 const p=JSON.parse(gunzipSync(compressed,{maxOutputLength:20*1024*1024}));
 if(p.schemaVersion!==1||p.repository!==repo||p.base!==base||p.source!==source||p.files.length!==62)throw Error('Unexpected payload');
 const seen=new Set();
 for(const f of p.files){
  safePath(f.path);
  if(seen.has(f.path)||!['100644','100755'].includes(f.mode)||!/^[a-f0-9]{40}$/.test(f.after))throw Error('Invalid file manifest');
  seen.add(f.path);
  if(objectAt(base,f.path)!==f.before)throw Error(`Payload base mismatch: ${f.path}`);
  const current=objectAt('HEAD',f.path);
  if(current!==f.before&&current!==objectAt(interveningMerge,f.path))throw Error(`Unreviewed concurrent change: ${f.path}`);
 }
 // Reconstruct the original reviewed patch in a separate index. It does not
 // reset HEAD, the working tree, or newer main-only source/workflow changes.
 const scratch=resolve(output,'reconstruction.index');rmSync(scratch,{force:true});
 const indexEnv={...process.env,GIT_INDEX_FILE:scratch};
 const indexGit=(...args)=>execFileSync('git',args,{encoding:'utf8',env:indexEnv,maxBuffer:64*1024*1024}).trim();
 indexGit('read-tree',base);
 for(const [path,sha] of Object.entries(p.refs)){
  const f=p.files.find(x=>x.path===path);
  if(!f||f.after!==sha)throw Error('Undeclared blob reference');
  await localObject(sha);indexGit('update-index','--add','--cacheinfo',f.mode,sha,path);
 }
 const patch=resolve(output,'reviewed.patch');writeFileSync(patch,p.patch);
 indexGit('apply','--cached','--check',patch);indexGit('apply','--cached',patch);
 for(const f of p.files){if(indexGit('rev-parse',`:${f.path}`)!==f.after)throw Error(`Reconstruction mismatch: ${f.path}`);}
 for(const c of corrections){
  const f=p.files.find(x=>x.path===c.path);
  if(!f||f.after!==c.before)throw Error('Correction base mismatch');
  await localObject(c.after);indexGit('update-index','--add','--cacheinfo',f.mode,c.after,f.path);f.after=c.after;
 }
 const record=JSON.parse(execFileSync('git',['cat-file','blob',indexGit('rev-parse',':config/consolidation.json')],{encoding:'utf8'}));
 if(record.mergedSource.sha!==source||record.sourceChangedPathCount!==42)throw Error('Invalid reconciliation record');
 const retire=record.resolutions.filter(r=>r.disposition==='superseded-by-canonical-module').map(r=>({path:r.sourcePath,sourceBlob:r.sourceBlob}));
 const archivedMigration=record.resolutions.find(r=>r.sourcePath==='backend/prisma/migrations/20260929013000_saas_production_foundations/migration.sql');
 if(!archivedMigration?.archive)throw Error('Experimental migration archive missing');
 if(indexGit('rev-parse',`:${archivedMigration.archive}`)!==archivedMigration.sourceBlob)throw Error('Archived SQL is not byte-identical');
 retire.push({path:archivedMigration.sourcePath,sourceBlob:archivedMigration.sourceBlob});
 for(const r of retire){
  safePath(r.path);
  if(seen.has(r.path)||objectAt(base,r.path)!==null||objectAt('HEAD',r.path)!==r.sourceBlob||objectAt(interveningMerge,r.path)!==r.sourceBlob)throw Error(`Retirement requires fresh review: ${r.path}`);
 }
 const files=[];
 for(const f of p.files){
  const before=objectAt('HEAD',f.path);
  if(before===f.after)continue;
  const bytes=execFileSync('git',['cat-file','blob',f.after]);
  const target=safePath(f.path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);chmodSync(target,f.mode==='100755'?0o755:0o644);
  git('add','--',f.path);files.push({...f,before});
 }
 for(const r of retire){git('rm','--',r.path);files.push({path:r.path,mode:'100644',before:r.sourceBlob,after:null});}
 const changed=git('diff','--cached','--name-only','-z').split('\0').filter(Boolean);
 if(changed.length!==files.length||changed.some(path=>!files.some(f=>f.path===path)))throw Error('Undeclared staged change');
 for(const f of files){if(objectAt('',f.path)!==f.after)throw Error(`Staged output mismatch: ${f.path}`);}
 const tree=git('write-tree');
 const env={...process.env,GIT_AUTHOR_NAME:'Forge integration qualification',GIT_AUTHOR_EMAIL:'forge-qualification@users.noreply.github.com',GIT_COMMITTER_NAME:'Forge integration qualification',GIT_COMMITTER_EMAIL:'forge-qualification@users.noreply.github.com'};
 const candidate=execFileSync('git',['commit-tree',tree,'-p',main,'-m','Qualification-only semantic consolidation after history merge'],{encoding:'utf8',env}).trim();
 git('checkout','--detach',candidate);
 const metadata={schemaVersion:2,repository:repo,baseHead:main,sourceHead:source,historyMerge:interveningMerge,testedTree:tree,testedCommit:candidate,files,payloadSha256:payloadHash};
 writeFileSync(resolve(output,'candidate.json'),JSON.stringify(metadata,null,2)+'\n');
 console.log(`Staged ${files.length} reviewed changes in tree ${tree}; newer main history preserved; remote refs unchanged`);
}else if(mode==='export'){
 const metadata=JSON.parse(readFileSync(resolve(output,'candidate.json')));
 if(metadata.repository!==repo||git('rev-parse','HEAD^{tree}')!==metadata.testedTree||git('status','--porcelain','--untracked-files=no'))throw Error('Candidate changed during qualification');
 const elements=[];
 for(const f of metadata.files){
  if(f.after===null){if(existsSync(safePath(f.path)))throw Error('Retired file reappeared');elements.push({path:f.path,mode:f.mode,type:'blob',sha:null});continue;}
  const data=readFileSync(safePath(f.path));
  if(hash(data)!==f.after)throw Error('Working file differs from qualified content');
  const result=await api('git/blobs',{encoding:'base64',content:data.toString('base64')});
  if(result.sha!==f.after)throw Error('Exported hash mismatch');
  elements.push({path:f.path,mode:f.mode,type:'blob',sha:f.after});
 }
 const baseTree=(await api(`git/commits/${metadata.baseHead}`)).tree.sha;
 const exported=await api('git/trees',{base_tree:baseTree,tree:elements});
 if(exported.sha!==metadata.testedTree)throw Error('Exported tree differs from tested tree');
 writeFileSync(resolve(output,'qualified-merge.json'),JSON.stringify({...metadata,exportedTree:exported.sha},null,2)+'\n');
 console.log(`Exported tested tree ${exported.sha}; publication remains a separate guarded action`);
}else throw Error('Use stage or export');
