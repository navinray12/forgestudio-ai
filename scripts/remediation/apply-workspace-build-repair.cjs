/** One reviewed patch, no branch writes. Upload mode creates unattached blobs only.
 * Runs in a fresh trusted job; it never executes project code with write credentials.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');process.chdir(root);
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const files=[
 'backend/scripts/verify-workspace-refresh.cjs','backend/scripts/verify-page-registration.cjs',
 'backend/scripts/test-typescript-api.cjs','backend/src/app.ts',
 'backend/src/modules/collaboration/collaborationEngine.service.ts','backend/src/services/cli/forgeCli.service.ts',
 'backend/src/services/generator/fullStackGenerator.service.ts',
 'frontend/src/features/developer-workspace/services/loadSiteSnapshot.ts',
 'frontend/src/features/developer-workspace/services/workspaceRefreshPolicy.ts',
 'frontend/src/pages/editor/WebsiteEditor.tsx','frontend/src/pages/published/PublishedSite.tsx',
];
const manifest=JSON.parse(fs.readFileSync('scripts/remediation/workspace-build-repair.json','utf8'));
const patch=fs.readFileSync('scripts/remediation/workspace-build-repair.patch');
const supplemental=fs.readFileSync('scripts/remediation/compiler-test-loader.patch');
function requireThat(ok,message){if(!ok)throw Error(message);}
function blob(data){return crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');}
function digest(data){return crypto.createHash('sha256').update(data).digest('hex');}
requireThat(manifest.version===1&&manifest.repository==='navinray12/forgestudio-ai','Wrong manifest');
requireThat(manifest.files.length===files.length&&new Set(manifest.files.map(x=>x.path)).size===files.length,'Wrong manifest file count');
requireThat(digest(patch)===manifest.patchSha256,'Patch digest mismatch');
requireThat(digest(supplemental)===manifest.supplementalPatchSha256,'Supplemental patch digest mismatch');
requireThat(!git('diff','--name-only')&&!git('diff','--cached','--name-only'),'Refusing a dirty checkout');
for(const row of manifest.files){
 requireThat(files.includes(row.path)&&row.mode==='100644'&&/^[0-9a-f]{40}$/.test(row.after),'Unexpected path/mode/hash');
 if(row.before===null){requireThat(!fs.existsSync(row.path),`New path occupied: ${row.path}`);}
 else {
  requireThat(fs.lstatSync(row.path).isFile()&&!fs.lstatSync(row.path).isSymbolicLink(),`Not a regular file: ${row.path}`);
  requireThat(blob(fs.readFileSync(row.path))===row.before,`Base file changed: ${row.path}`);
 }
}
for(const file of ['scripts/remediation/workspace-build-repair.patch','scripts/remediation/compiler-test-loader.patch']){
 git('apply','--check','--index',file);git('apply','--index',file);
}
const changed=git('diff','--cached','--name-only').split('\n').sort();
const expectedChanges=manifest.files.filter(row=>row.before!==row.after).map(row=>row.path).sort();
requireThat(JSON.stringify(changed)===JSON.stringify(expectedChanges),'Unexpected changed paths');
for(const row of manifest.files)requireThat(blob(fs.readFileSync(row.path))===row.after,`Candidate hash mismatch: ${row.path}`);
console.log(`Verified reviewed patch: ${files.length} files, SHA256 ${manifest.patchSha256}`);
async function upload(){
 requireThat(process.env.GITHUB_REPOSITORY===manifest.repository&&process.env.GITHUB_REF==='refs/heads/main','Upload restricted to this repository/main');
 requireThat(process.env.GITHUB_TOKEN&&process.env.RUNNER_TEMP,'Missing scoped job configuration');
 const entries=[];
 for(const row of manifest.files){
  const response=await fetch(`https://api.github.com/repos/${manifest.repository}/git/blobs`,{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),
   headers:{authorization:`Bearer ${process.env.GITHUB_TOKEN}`,accept:'application/vnd.github+json','content-type':'application/json'},
   body:JSON.stringify({encoding:'base64',content:fs.readFileSync(row.path).toString('base64')}),
  });
  requireThat(response.ok,`Blob upload failed (${response.status}) for ${row.path}`);
  const result=await response.json();requireThat(result.sha===row.after,`Remote blob mismatch: ${row.path}`);
  entries.push({path:row.path,mode:row.mode,type:'blob',sha:result.sha});
 }
 const evidence={sourceCommit:process.env.GITHUB_SHA,patchSha256:manifest.patchSha256,supplementalPatchSha256:manifest.supplementalPatchSha256,entries,branchUpdated:false};
 fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'workspace-build-repair-objects.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence,null,2));
}
if(process.argv.includes('--upload-blobs'))upload().catch(e=>{console.error(e.message);process.exitCode=1;});
