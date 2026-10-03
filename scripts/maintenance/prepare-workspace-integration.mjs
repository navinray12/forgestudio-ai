import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// One-time reviewed patch transport. This script never creates a commit or
// updates a branch. Only the exact source hashes below may be replaced.
const allowed = [
  'backend/src/app.ts', 'backend/src/services/website.service.ts',
  'backend/prisma/schema.prisma',
  'frontend/src/pages/dashboard/components/WorkspaceSwitcher.tsx',
  'frontend/src/pages/dashboard/UserDashboard.tsx', 'frontend/src/App.tsx',
  'frontend/src/pages/editor/WebsiteEditor.tsx',
  'frontend/src/features/autosave/hooks/useAutosave.ts',
].sort();
const manifest = JSON.parse(readFileSync('scripts/maintenance/workspace-integration.patch.json', 'utf8'));
if (manifest.version !== 1 || JSON.stringify(manifest.patches.map(p => p.path).sort()) !== JSON.stringify(allowed)) {
  throw new Error('Unexpected workspace integration manifest');
}
const hash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
function uniqueIndex(source, text) {
  const first = source.indexOf(text);
  if (!text || first < 0 || source.indexOf(text, first + 1) !== -1) throw new Error('Patch anchor is missing or ambiguous');
  return first;
}
function applyPatch(source, changes) {
  for (const change of changes) {
    if (change.replaceAll === true) { source = change.new; continue; }
    if (change.old !== undefined) {
      const index = uniqueIndex(source, change.old);
      source = source.slice(0,index) + change.new + source.slice(index + change.old.length);
    } else {
      const start = uniqueIndex(source, change.start);
      const end = source.indexOf(change.end, start + change.start.length);
      if (end < 0) throw new Error('Patch end is missing');
      source = source.slice(0,start) + change.new + source.slice(end);
    }
  }
  return Buffer.from(source);
}
if (process.argv[2] === 'apply') {
  const replacements = manifest.patches.map(patch => {
    const bytes = readFileSync(patch.path);
    if (hash(bytes) !== patch.baseBlob) throw new Error(`Source changed; review required: ${patch.path}`);
    const target = applyPatch(bytes.toString('utf8'), patch.changes);
    if (hash(target) !== patch.targetBlob) throw new Error(`Patch result mismatch: ${patch.path}`);
    return { path: patch.path, target };
  });
  for (const item of replacements) writeFileSync(item.path, item.target);
  execFileSync('git', ['add', '--', ...allowed]);
  console.log('Applied eight reviewed integration patches; no branch changed');
} else if (process.argv[2] === 'export') {
  if (process.env.GITHUB_REPOSITORY !== 'ooarchitect92/forge' || process.env.GITHUB_REF !== 'refs/heads/main' || !process.env.GH_TOKEN) {
    throw new Error('Export requires the authorized main CI identity');
  }
  const changed = execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim().split('\n').sort();
  if (JSON.stringify(changed) !== JSON.stringify(allowed)) throw new Error('Unexpected staged changes');
  const tree = [];
  for (const patch of manifest.patches) {
    const content = readFileSync(patch.path);
    if (hash(content) !== patch.targetBlob) throw new Error(`Validated source changed: ${patch.path}`);
    const response = await fetch('https://api.github.com/repos/ooarchitect92/forge/git/blobs', {
      method:'POST', headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
      body:JSON.stringify({content:content.toString('base64'),encoding:'base64'}),
    });
    if (!response.ok) throw new Error(`Blob export failed (${response.status}) for ${patch.path}`);
    const {sha} = await response.json();
    if (sha !== patch.targetBlob) throw new Error('Export integrity mismatch');
    tree.push({path:patch.path,mode:'100644',type:'blob',sha});
  }
  writeFileSync('validated-workspace-integration.json',JSON.stringify({
    base_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    tree, original_blobs:manifest.patches.map(({path,baseBlob})=>({path,sha:baseBlob})),
    gates:['backend production build','frontend production build','hardening source-unit','PostgreSQL workspace/HTTP contracts'],
    branch_updated:false,
  },null,2)+'\n');
} else { throw new Error('Use apply or export'); }
