/** One-time, hash-bound repair of three compile blockers found by build validation.
 * The CI worker can publish Git blobs, but NEVER updates a branch or creates a
 * commit. The repository owner applies the validated blobs as a normal commit.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const files = {
  'backend/src/tests/controller-auth-safeguard.test.ts': '69005e186aa29e206b9306799e785831e4f00ec6',
  'frontend/src/pages/editor/types/index.ts': '87b2cc5dac90bea94e82a1dec5b283a6b23d7b02',
  'frontend/src/pages/published/PublishedSite.tsx': '8bec6b94082cede942908e18302a9f5a88219ece',
};
function blobHash(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
function repair(path, source) {
  if (path.endsWith('controller-auth-safeguard.test.ts')) {
    return source.replaceAll('(req, res);', '(req, res, (error?: unknown) => { throw error ?? new Error("Unexpected next call"); });');
  }
  if (path.endsWith('types/index.ts')) {
    return source.replace('  masonryColumns?: number;', '  masonryEngine?: string;\n  masonryColumns?: number;')
      .replace('  scrollSnapType?: string;\n  overflowX?: string;', '  scrollSnapType?: string;\n  scrollSnapAlign?: string;\n  scrollSnapStop?: string;\n  overflowX?: string;');
  }
  const declaration = '    const [sitePartsState, setSitePartsState] = useState<any>(null);';
  if (source.split(declaration).length !== 3) throw new Error('Unexpected published-site state declarations');
  const second = source.lastIndexOf(declaration);
  return source.slice(0, second) + source.slice(second + declaration.length + 1);
}

if (process.argv[2] === 'apply') {
  const prepared = Object.entries(files).map(([path, expected]) => {
    const bytes = readFileSync(path);
    if (blobHash(bytes) !== expected) throw new Error(`Source changed; re-review required: ${path}`);
    const content = repair(path, bytes.toString('utf8'));
    if (content === bytes.toString('utf8')) throw new Error(`No repair applied: ${path}`);
    return { path, content };
  });
  for (const { path, content } of prepared) writeFileSync(path, content);
  execFileSync('git', ['add', '--', ...Object.keys(files)]);
  console.log('Prepared three hash-bound build repairs; no branch updated.');
} else if (process.argv[2] === 'export') {
  if (process.env.GITHUB_REPOSITORY !== 'ooarchitect92/forge' || !process.env.GH_TOKEN) {
    throw new Error('Export requires this repository CI identity');
  }
  const changed = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim().split('\n').sort();
  if (JSON.stringify(changed) !== JSON.stringify(Object.keys(files).sort())) throw new Error('Unexpected staged files');
  const tree = [];
  for (const path of changed) {
    const content = readFileSync(path);
    const response = await fetch('https://api.github.com/repos/ooarchitect92/forge/git/blobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ content: content.toString('base64'), encoding: 'base64' }),
    });
    if (!response.ok) throw new Error(`Blob export failed (${response.status}) for ${path}`);
    const { sha } = await response.json();
    if (sha !== blobHash(content)) throw new Error(`Export integrity mismatch: ${path}`);
    tree.push({ path, mode: '100644', type: 'blob', sha });
  }
  writeFileSync('validated-build-repairs.json', JSON.stringify({
    base_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    original_blobs: files, tree,
    gates: ['backend production build', 'frontend production build', 'hardening source-unit tests'],
    branch_updated: false,
  }, null, 2) + '\n');
} else {
  throw new Error('Use apply or export; this helper never updates refs.');
}
