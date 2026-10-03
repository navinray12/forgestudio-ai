import { readFileSync, writeFileSync, existsSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const repository = 'ooarchitect92/forge';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trim();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBlob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const requireCondition = (value, code) => { if (!value) throw new Error(code); };
const pointer = JSON.parse(readFileSync('scripts/maintenance/active-increment.json', 'utf8'));
const temporary = process.env.RUNNER_TEMP;
requireCondition(temporary && process.env.GITHUB_REPOSITORY === repository, 'QUALIFICATION_ENVIRONMENT_REQUIRED');
requireCondition(pointer.repository === repository && pointer.schemaVersion === 1, 'INVALID_POINTER');
const saved = join(temporary, 'reviewed-increment.json');
const token = process.env.GH_TOKEN;
async function github(path, body) {
  requireCondition(token, 'QUALIFICATION_TOKEN_REQUIRED');
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', ...(body ? {'Content-Type':'application/json'} : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  requireCondition(response.ok, `GITHUB_OBJECT_OPERATION_FAILED_${response.status}`);
  return response.json();
}
function validPath(path) {
  return typeof path === 'string' && path.length < 500 &&
    /^(backend|frontend|website|packages|config|infra|operations|tests|scripts|docs|\.github)\/[A-Za-z0-9_.\/-]+$/.test(path) &&
    !path.split('/').some(part => !part || part === '.' || part === '..' || part === '.git');
}
function entries(changes) {
  requireCondition(changes.schemaVersion === 1 && changes.repository === repository, 'INVALID_CHANGESET');
  requireCondition(Array.isArray(changes.files) && changes.files.length > 0 && changes.files.length <= 300, 'INVALID_FILE_COUNT');
  const seen = new Set();
  for (const entry of changes.files) {
    requireCondition(validPath(entry.path) && !seen.has(entry.path), 'INVALID_OR_DUPLICATE_PATH'); seen.add(entry.path);
    for (const field of ['before','after']) requireCondition(entry[field] === null || /^[a-f0-9]{40}$/.test(entry[field]), 'INVALID_OBJECT_ID');
    for (const ancestor of entry.path.split('/').slice(0,-1).map((_,index)=>entry.path.split('/').slice(0,index+1).join('/'))) {
      requireCondition(!existsSync(ancestor) || !lstatSync(ancestor).isSymbolicLink(), 'SYMLINK_ANCESTOR_FORBIDDEN');
    }
  }
  return seen;
}
function indexMatches(changes) {
  for (const entry of changes.files) {
    const record = git('ls-files', '--stage', '--', entry.path);
    if (entry.after === null) requireCondition(!record, 'DELETED_FILE_STILL_TRACKED');
    else requireCondition(record.startsWith(`100644 ${entry.after} 0\t`), 'UNEXPECTED_STAGED_OBJECT');
  }
  const expected = [...entries(changes)].sort();
  const actual = git('diff', '--cached', '--name-only').split('\n').filter(Boolean).sort();
  requireCondition(JSON.stringify(expected) === JSON.stringify(actual), 'UNEXPECTED_STAGED_FILES');
}
if (process.argv[2] === 'stage') {
  requireCondition(git('status','--porcelain') === '', 'CLEAN_CHECKOUT_REQUIRED');
  requireCondition(Array.isArray(pointer.parts) && pointer.parts.length > 0 && pointer.parts.length <= 32, 'INVALID_PARTS');
  const chunks = [];
  for (const id of pointer.parts) {
    requireCondition(/^[a-f0-9]{40}$/.test(id), 'INVALID_PART');
    const object = await github(`git/blobs/${id}`);
    requireCondition(object.encoding === 'base64', 'UNEXPECTED_BLOB_ENCODING');
    const bytes = Buffer.from(object.content, 'base64');
    requireCondition(gitBlob(bytes) === id && bytes.length < 100000, 'PART_INTEGRITY_FAILURE');
    chunks.push(bytes.toString('utf8'));
  }
  const compressed = Buffer.from(chunks.join(''), 'base64');
  requireCondition(sha(compressed) === pointer.sha256, 'CHANGESET_INTEGRITY_FAILURE');
  const changes = JSON.parse(brotliDecompressSync(compressed, { maxOutputLength: 16 * 1024 * 1024 }).toString('utf8'));
  const paths = entries(changes);
  for (const entry of changes.files) {
    const record = git('ls-files', '--stage', '--', entry.path);
    requireCondition(entry.before === null ? !record : record.startsWith(`100644 ${entry.before} 0\t`), 'BASE_OBJECT_CHANGED');
    requireCondition(!existsSync(entry.path) || !lstatSync(entry.path).isSymbolicLink(), 'SYMLINK_FORBIDDEN');
  }
  requireCondition(typeof changes.patch === 'string' && changes.patch.length < 16000000, 'INVALID_PATCH');
  for (const line of changes.patch.split('\n').filter(line=>line.startsWith('diff --git '))) {
    const match = /^diff --git a\/(\S+) b\/(\S+)$/.exec(line);
    requireCondition(match && match[1] === match[2] && paths.has(match[1]), 'UNDECLARED_PATCH_PATH');
  }
  const patch = join(temporary, 'reviewed-increment.patch'); writeFileSync(patch, changes.patch);
  git('apply', '--check', '--index', patch); git('apply', '--index', patch);
  // Generated Prisma assets may be binary and are deliberately absent from the textual patch.
  for (const entry of changes.files.filter(entry=>entry.after===null)) {
    if (git('ls-files','--',entry.path)) git('rm', '--', entry.path);
  }
  indexMatches(changes);
  const overrides = pointer.overrides ?? [];
  requireCondition(Array.isArray(overrides) && overrides.length <= 100, 'INVALID_CORRECTIONS');
  for (const correction of overrides) {
    const entry = changes.files.find(entry => entry.path === correction.path);
    requireCondition(entry && entry.after === correction.before && /^[a-f0-9]{40}$/.test(correction.after), 'CORRECTION_BASE_MISMATCH');
    const object = await github(`git/blobs/${correction.after}`);
    requireCondition(object.encoding === 'base64', 'UNEXPECTED_BLOB_ENCODING');
    const bytes = Buffer.from(object.content, 'base64');
    requireCondition(gitBlob(bytes) === correction.after && bytes.length < 2000000, 'CORRECTION_INTEGRITY_FAILURE');
    writeFileSync(entry.path, bytes); git('add', '--', entry.path); entry.after = correction.after;
  }
  indexMatches(changes); git('diff','--cached','--check');
  writeFileSync(saved, JSON.stringify(changes));
  console.log(`Staged ${changes.files.length} reviewed file changes. No branch updated.`);
} else if (process.argv[2] === 'export') {
  const changes = JSON.parse(readFileSync(saved,'utf8')); indexMatches(changes);
  const result = [];
  for (const entry of changes.files) {
    if (entry.after === null) { result.push({path:entry.path,mode:'100644',type:'blob',sha:null}); continue; }
    requireCondition(existsSync(entry.path) && lstatSync(entry.path).isFile() && !lstatSync(entry.path).isSymbolicLink(), 'FILE_CHANGED_DURING_TEST');
    const bytes = readFileSync(entry.path); requireCondition(gitBlob(bytes) === entry.after, 'FILE_CHANGED_DURING_TEST');
    const object = await github('git/blobs', {content:bytes.toString('base64'),encoding:'base64'});
    requireCondition(object.sha === entry.after, 'EXPORTED_OBJECT_MISMATCH');
    result.push({path:entry.path,mode:'100644',type:'blob',sha:entry.after});
  }
  writeFileSync('qualified-increment.json', JSON.stringify({repository, qualificationCommit:process.env.GITHUB_SHA,
    changesetSha256:pointer.sha256, pointerSha256:sha(Buffer.from(JSON.stringify(pointer))), testedTree:git('write-tree'), files:result,
    scope:'Production builds, source-unit, real PostgreSQL/HTTP and browser workspace journey; not production certification'},null,2));
  console.log(`Exported ${result.length} verified file mappings. No branch updated.`);
} else throw new Error('EXPECTED_STAGE_OR_EXPORT');
