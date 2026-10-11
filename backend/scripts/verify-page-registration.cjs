/**
 * Offline-friendly regression suite for actual recognition/registry/sync modules.
 * Run: node --test scripts/verify-page-registration.cjs (from backend).
 * TypeScript is the repository dev dependency; no DB/provider is contacted.
 * The sync tests explicitly stub persistence, parsing and compilation boundaries;
 * they do NOT certify browser, real-DB, compiler fidelity, or end-to-end workflows.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loadSource(relativePath, dependencies) {
  const filename = path.join(root, relativePath);
  const content = fs.readFileSync(filename, 'utf8');
  const parsed = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true);
  assert.equal(parsed.parseDiagnostics.length, 0, `Invalid syntax in ${relativePath}`);
  const output = ts.transpileModule(content, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    fileName: filename, reportDiagnostics: true,
  });
  assert.equal(output.diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);
  const mod = { exports: {} };
  const requireStub = (id) => {
    if (id.startsWith('node:')) return require(id);
    if (Object.hasOwn(dependencies, id)) return dependencies[id];
    throw new Error(`Unexpected dependency in isolated test: ${id}`);
  };
  // This is a unit-test loader for trusted repository code, NOT an untrusted-code sandbox.
  const wrapper = vm.runInThisContext(`(function(require,module,exports){${output.outputText}\n})`, { filename });
  wrapper(requireStub, mod, mod.exports);
  return mod.exports;
}
const recognition = loadSource('src/services/compiler/pageRecognition.ts', {});
const { isRecognizedPageEntry: recognize, classifyPageEntry: classify, resolvePageSourceTarget: resolve } = recognition;

const routes = [
  ['react', 'src/pages/HomePage.tsx', '/'],
  ['react', 'src/pages/index.tsx', '/'],
  ['react', 'src/pages/IndexPage.tsx', '/'],
  ['react', 'src/pages/AboutPage.tsx', '/about'],
  ['react', 'src/pages/admin/HomePage.tsx', '/admin/home'],
  ['react', 'src/pages/admin/index.tsx', '/admin'],
  ['react', 'src/pages/admin/IndexPage.tsx', '/admin'],
  ['react', 'src/pages/admin/ReportsPage.tsx', '/admin/reports'],
  ['react', 'src/pages/account/UserProfilePage.jsx', '/account/user-profile'],
  ['react', 'src/pages/APIStatusPage.tsx', '/api-status'],
  ['react', 'src/pages/help_center/FaqPage.tsx', '/help-center/faq'],
  ['react', 'src/pages/2026SummaryPage.tsx', '/2026-summary'],
  ['react', 'src/pages/你好Page.tsx', '/你好'],
  ['react', 'src\\pages\\AboutPage.tsx', '/about'],
  ['react', './src/pages/AboutPage.tsx', '/about'],
  ['nextjs', 'app/page.tsx', '/'],
  ['nextjs', 'src/app/page.jsx', '/'],
  ['nextjs', 'app/(marketing)/page.tsx', '/'],
  ['nextjs', 'src/app/(one)/(two)/about/page.tsx', '/about'],
  ['nextjs', 'app/about/page.tsx', '/about'],
  ['nextjs', 'app/components/page.tsx', '/components'],
  ['nextjs', 'app/api/page.tsx', '/api'],
  ['nextjs', 'app/AboutUs/page.tsx', '/AboutUs'],
  ['nextjs', 'app/projects/[projectId]/page.tsx', '/projects/[projectId]'],
  ['nextjs', 'app/docs/[...slug]/page.tsx', '/docs/[...slug]'],
  ['nextjs', 'app/docs/[[...slug]]/page.tsx', '/docs/[[...slug]]'],
  ['nextjs', 'app/%5Fmanual/page.tsx', '/%5Fmanual'],
  ['nextjs', 'pages/index.tsx', '/'],
  ['nextjs', 'src/pages/team/index.tsx', '/team'],
  ['nextjs', 'pages/team/about.tsx', '/team/about'],
  ['nextjs', 'pages/Products/[productId].tsx', '/Products/[productId]'],
  ['nextjs', 'pages/Docs/[...slug].tsx', '/Docs/[...slug]'],
  ['nextjs', 'pages/_team/index.tsx', '/_team'],
  ['nextjs', 'src/pages/ContactUs.jsx', '/ContactUs'],
];
for (const [framework, file, route] of routes) test(`recognition ${framework}: ${file} -> ${route}`, () => {
  const result = recognize(file, framework);
  assert.equal(result.isPage, true);
  assert.equal(result.routePath, route);
  assert.equal(result.targetFilePath, file.replace(/\\/g, '/').replace(/^\.\//, ''));
  assert.match(result.componentName, /^[A-Z_$][A-Za-z0-9_$]*$/);
  assert.deepEqual(recognize(file, framework), result, 'Recognition must be deterministic');
});
const excluded = [
  ['react', 'Widget.tsx'], ['nextjs', 'about.tsx'],
  ['react', 'src/components/ReportsPage.tsx'], ['react', 'app/about/page.tsx'],
  ['nextjs', 'src/pages/api/report.tsx'], ['nextjs', 'pages/api.tsx'],
  ['nextjs', 'pages/_app.tsx'], ['nextjs', 'pages/_document.tsx'],
  ['nextjs', 'pages/_error.tsx'], ['nextjs', 'pages/404.tsx'], ['nextjs', 'pages/500.tsx'],
  ['nextjs', 'app/homepage.tsx'], ['nextjs', 'app/not-a-page.tsx'],
  ['nextjs', 'app/about/layout.tsx'], ['nextjs', 'app/about/loading.tsx'],
  ['nextjs', 'app/about/error.tsx'], ['nextjs', 'app/about/route.ts'],
  ['nextjs', 'app/_private/page.tsx'], ['nextjs', 'src/app/_private/about/page.tsx'],
  ['react', 'src/pages/_components/CardPage.tsx'],
  ['react', 'src/pages/Report.test.tsx'], ['react', 'src/pages/Report.spec.tsx'],
  ['react', 'src/pages/Report.stories.tsx'], ['react', 'src/pages/__tests__/Report.tsx'],
  ['nextjs', 'app/__tests__/about/page.tsx'], ['react', 'node_modules/src/pages/X.tsx'],
];
for (const [framework, file] of excluded) test(`non-page ${framework}: ${file}`, () => assert.equal(recognize(file, framework).isPage, false));
const unsafe = ['', '../app/page.tsx', '/app/page.tsx', '\\app\\page.tsx', 'C:\\app\\page.tsx', 'app/../page.tsx', 'app/./page.tsx', 'app//page.tsx', 'app/ page.tsx', 'app/page.tsx\0', 'app/?/page.tsx'];
for (const file of unsafe) test(`unsafe path ${JSON.stringify(file)}`, () => assert.equal(classify(file, 'nextjs').status, 'invalid'));
const unsupported = [
  ['nextjs', 'app/@modal/page.tsx', 'ADVANCED_NEXT_ROUTE'],
  ['nextjs', 'app/(.)photos/page.tsx', 'ADVANCED_NEXT_ROUTE'],
  ['nextjs', 'app/(..)(..)photos/page.tsx', 'ADVANCED_NEXT_ROUTE'],
  ['nextjs', 'app/(...)photos/page.tsx', 'ADVANCED_NEXT_ROUTE'],
  ['nextjs', 'app/[id]/[id]/page.tsx', 'DUPLICATE_ROUTE_PARAMETER'],
  ['nextjs', 'app/[...slug]/edit/page.tsx', 'NONTERMINAL_CATCH_ALL'],
  ['nextjs', 'app/[[]/page.tsx', 'UNSUPPORTED_ROUTE_SEGMENT'],
  ['nextjs', 'app/100%done/page.tsx', 'INVALID_ROUTE_ENCODING'],
  ['react', 'src/pages/[id].tsx', 'UNSUPPORTED_REACT_ROUTE'],
];
for (const [framework, file, code] of unsupported) test(`explicit unsupported: ${file}`, () => {
  assert.equal(classify(file, framework).code, code);
  assert.equal(recognize(file, framework).isPage, false);
});
test('catch-all parameters retain kind and case', () => {
  assert.deepEqual(recognize('app/[teamId]/[[...fileParts]]/page.tsx', 'nextjs').parameters, [
    { name: 'teamId', kind: 'single' }, { name: 'fileParts', kind: 'optional-catch-all' },
  ]);
});
test('suggested symbols include parent routes and remain valid', () => {
  assert.notEqual(recognize('src/pages/admin/ReportsPage.tsx').componentName, recognize('src/pages/team/ReportsPage.tsx').componentName);
  assert.notEqual(recognize('src/pages/你好Page.tsx').componentName, recognize('src/pages/世界Page.tsx').componentName);
});
function page(key, filePath, routePath, name = 'Same title') { return { key, pageId: key, filePath, routePath, name, title: name, componentName: 'Page', isHome: routePath === '/' }; }
const home = page('home', 'app/page.tsx', '/', 'Home');
test('existing pages match exact source, not display name', () => {
  const pages = [page('a', 'src/pages/team/ReportsPage.tsx', '/team/reports', 'Reports')];
  assert.equal(resolve(pages, 'src/pages/admin/ReportsPage.tsx', 'react').status, 'new');
  assert.equal(resolve(pages, pages[0].filePath, 'react').page.key, 'a');
});
const collisions = [
  ['app/about/page.tsx', '/about', 'app/(marketing)/about/page.tsx'],
  ['app/About/page.tsx', '/About', 'app/about/page.tsx'],
  ['app/team/[id]/page.tsx', '/team/:id', 'app/team/[slug]/page.tsx'],
  ['app/team/[id]/edit/page.tsx', '/team/:id/edit', 'app/team/[slug]/view/page.tsx'],
  ['app/docs/page.tsx', '/docs', 'app/docs/[[...slug]]/page.tsx'],
  ['app/docs/[[...slug]]/page.tsx', '/docs/[[...slug]]', 'app/docs/page.tsx'],
  ['app/docs/[...slug]/page.tsx', '/docs/[...slug]', 'app/docs/[[...slug]]/page.tsx'],
];
for (const [existingPath, route, requested] of collisions) test(`collision blocks takeover: ${requested}`, () => {
  const pages = [page('owned', existingPath, route)];
  const before = JSON.stringify(pages);
  const result = resolve(pages, requested, 'nextjs');
  assert.equal(result.status, 'conflict');
  assert.equal(result.conflictingPages[0].key, 'owned');
  assert.equal(JSON.stringify(pages), before);
});
test('static/dynamic route precedence is not a collision', () => {
  assert.equal(resolve([page('new', 'app/blog/new/page.tsx', '/blog/new')], 'app/blog/[slug]/page.tsx', 'nextjs').status, 'new');
});
test('duplicate source owners require explicit repair', () => {
  assert.equal(resolve([home, { ...home, key: 'duplicate' }], home.filePath, 'nextjs').code, 'DUPLICATE_PAGE_SOURCE');
});

class AppError extends Error { constructor(message, statusCode, code) { super(message); this.statusCode = statusCode; this.code = code; } }
/** Real exported service under test, with explicitly controlled boundary doubles. */
function serviceHarness({ pages = [home], filePath = 'app/about/page.tsx', framework = 'nextjs', mismatch = false, saveConflict = false, relocate = false, routeChange = false, existingOutcome = 'unchanged', importOk = true, baselineChanged = false } = {}) {
  const calls = { readFile: 0, save: 0, compile: 0, ownership: 0, reconcile: 0, imported: 0 };
  const initialDoc = { pages: pages.map((p) => ({ id: p.key, name: p.name, slug: p.routePath, elements: [] })) };
  const website = { id: 'site', documentVersion: 1, editorData: structuredClone(initialDoc) };
  const project = { id: 'project', websiteId: mismatch ? 'another-site' : 'site', name: 'Test', slug: 'test', framework, ownerId: 'actor', metadata: {} };
  const file = { id: 'source', path: filePath, content: 'export default function AboutPage() { return <h1>Real source</h1>; }', isGenerated: false, version: 1 };
  const originalSource = file.content;
  const registry = loadSource('src/services/compiler/pageRegistry.ts', {
    './pageRecognition.js': recognition,
    '../../utils/app-error.js': { AppError },
    './unifiedCompiler.service.js': {
      pageComponentName: (name) => name.endsWith('Page') ? name : `${name}Page`,
      visualDocumentToIR(doc) {
        return { components: (doc.pages || []).map((p) => {
          const known = pages.find((v) => v.key === p.id);
          return { id: p.id, pageId: p.id, isPage: true, name: known?.componentName || 'About',
            routePath: known?.routePath || (routeChange ? '/altered' : p.slug),
            filePath: known?.filePath || (relocate ? 'app/relocated/page.tsx' : filePath) };
        }), routes: (doc.pages || []).map((p) => ({ componentId: p.id, title: p.name })) };
      },
    },
  });
  if (baselineChanged) project.metadata.visualSync = { pages: { [pages[0].key]: { hash: 'older-hash' } } };
  const module = loadSource('src/services/compiler/visualCodeSync.service.ts', {
    './tsCompiler.js': { ts }, '../../utils/app-error.js': { AppError },
    '../project/forgeFilesystem.service.js': {
      sanitizeAndNormalizePath: (p) => p,
      readFile: async () => { calls.readFile++; return file; },
      listFiles: async () => [file],
      writeFile: async () => { throw new Error('Unexpected direct source write'); },
    },
    '../../config/prisma.js': { prisma: {
      forgeProject: { findUnique: async () => project, update: async ({ data }) => Object.assign(project, data) },
      website: { findUnique: async () => website },
      forgeProjectFile: { update: async ({ data }) => { calls.ownership++; Object.assign(file, data); } },
    } },
    '../generator/sourcePreservation.service.js': { extractProtectedRegions: () => [], injectProtectedRegions: (s) => s },
    '../generator/jsxRenderer.js': { escapeJsxText: (s) => s },
    './unifiedCompiler.service.js': { compileAndSyncProject: async () => { calls.compile++; return { success: true, diagnostics: [] }; } },
    './pageRegistry.js': registry,
    './pageSourceSync.js': {
      importPageElements: () => { calls.imported++; return { ok: importOk, elements: [{ id: 'heading', type: 'heading', content: 'Imported' }], diagnostics: [] }; },
      reconcilePageSource: async () => { calls.reconcile++; return { status: existingOutcome, diagnostics: [] }; },
    },
    '../websites/documentGateway.js': { saveDocumentFromCode: async (_id, _actor, doc, version) => {
      calls.save++;
      if (saveConflict) throw new AppError('Concurrent save', 409, 'DOCUMENT_VERSION_CONFLICT');
      assert.equal(version, website.documentVersion);
      website.editorData = structuredClone(doc); website.documentVersion++;
      return { documentVersion: website.documentVersion };
    } },
  });
  return { module, calls, website, file, originalSource, initialDoc };
}
function assertNoMutation(h) {
  assert.deepEqual(h.website.editorData, h.initialDoc);
  assert.equal(h.file.content, h.originalSource);
  assert.equal(h.calls.save, 0); assert.equal(h.calls.compile, 0); assert.equal(h.calls.ownership, 0);
}
test('sync rejects same-route different-source before any write', async () => {
  const h = serviceHarness({ pages: [home, page('about', 'app/about/page.tsx', '/about', 'About')], filePath: 'app/(marketing)/about/page.tsx' });
  const result = await h.module.syncSourceToVisualWebsite('project', 'site', h.file.path, 'actor');
  assert.equal(result.status, 'conflict'); assert.equal(result.success, false); assertNoMutation(h);
});
test('sync never selects a different source by page title', async () => {
  const h = serviceHarness({ pages: [home, page('team', 'app/team/details/page.tsx', '/team/details', 'Details')], filePath: 'app/admin/details/page.tsx' });
  const result = await h.module.syncSourceToVisualWebsite('project', 'site', h.file.path, 'actor');
  assert.equal(result.status, 'synced'); assert.equal(h.calls.reconcile, 0);
  assert.equal(h.website.editorData.pages.length, 3);
  assert.deepEqual(h.website.editorData.pages[1], h.initialDoc.pages[1]);
});
test('sync preserves code when legacy compiler would relocate it', async () => {
  const h = serviceHarness({ filePath: 'src/app/(marketing)/about/page.tsx', relocate: true });
  const result = await h.module.syncSourceToVisualWebsite('project', 'site', h.file.path, 'actor');
  assert.equal(result.status, 'unsupported'); assert.equal(result.diagnostics[0].code, 'PAGE_SOURCE_LAYOUT_UNSUPPORTED'); assertNoMutation(h);
});
test('sync preserves URL instead of silently accepting compiler normalization', async () => {
  const h = serviceHarness({ routeChange: true });
  const result = await h.module.syncSourceToVisualWebsite('project', 'site', h.file.path, 'actor');
  assert.equal(result.status, 'unsupported'); assertNoMutation(h);
});
test('sync validates project/website relationship before source access', async () => {
  const h = serviceHarness({ mismatch: true });
  await assert.rejects(h.module.syncSourceToVisualWebsite('project', 'site', h.file.path, 'actor'), { code: 'PROJECT_WEBSITE_MISMATCH' });
  assert.equal(h.calls.readFile, 0); assertNoMutation(h);
});
test('sync rejects undocumented overwrite resolution before source access', async () => {
  const h = serviceHarness();
  await assert.rejects(h.module.syncSourceToVisualWebsite('project', 'site', h.file.path, 'actor', { resolve: 'overwrite' }), { code: 'INVALID_SYNC_RESOLUTION' });
  assert.equal(h.calls.readFile, 0); assertNoMutation(h);
});
test('sync rejects traversal before filesystem normalization', async () => {
  const h = serviceHarness();
  await assert.rejects(h.module.syncSourceToVisualWebsite('project', 'site', '../app/about/page.tsx', 'actor'), { code: 'INVALID_PAGE_SOURCE_PATH' });
  assert.equal(h.calls.readFile, 0); assertNoMutation(h);
});
test('new page save conflict stays a conflict without ownership/regeneration', async () => {
  const h = serviceHarness({ saveConflict: true });
  const result = await h.module.syncSourceToVisualWebsite('project', 'site', h.file.path, 'actor');
  assert.equal(result.status, 'conflict'); assert.equal(result.success, false);
  assert.equal(h.calls.save, 1); assert.equal(h.calls.compile, 0); assert.equal(h.calls.ownership, 0);
  assert.deepEqual(h.website.editorData, h.initialDoc); assert.equal(h.file.content, h.originalSource);
});
test('registered source continues down the existing reconciliation path', async () => {
  const h = serviceHarness({ filePath: home.filePath });
  const result = await h.module.syncSourceToVisualWebsite('project', 'site', h.file.path, 'actor');
  assert.equal(result.status, 'unchanged'); assert.equal(h.calls.reconcile, 1); assert.equal(h.calls.save, 0);
});
test('existing visual conflict continues to preserve both sides', async () => {
  const h = serviceHarness({ filePath: home.filePath, baselineChanged: true });
  const result = await h.module.syncSourceToVisualWebsite('project', 'site', h.file.path, 'actor');
  assert.equal(result.status, 'conflict'); assert.equal(h.calls.reconcile, 0); assert.equal(h.calls.save, 0);
  assert.equal(h.file.content, h.originalSource);
});
test('unsupported source import never changes canonical content', async () => {
  const h = serviceHarness({ importOk: false });
  const result = await h.module.syncSourceToVisualWebsite('project', 'site', h.file.path, 'actor');
  assert.equal(result.status, 'unsupported'); assertNoMutation(h);
});
test('ordinary component saves do not trigger page creation', async () => {
  const h = serviceHarness({ filePath: 'components/Card.tsx' });
  const result = await h.module.syncSourceToVisualWebsite('project', 'site', h.file.path, 'actor');
  assert.equal(result.status, 'not-a-page'); assertNoMutation(h);
});
test('qualified new source registration returns its persisted revision and stable page', async () => {
  const h = serviceHarness();
  const result = await h.module.syncSourceToVisualWebsite('project', 'site', h.file.path, 'actor');
  assert.equal(result.status, 'synced'); assert.equal(result.documentVersion, 2);
  assert.equal(h.calls.save, 1); assert.equal(h.calls.compile, 1);
  assert.equal(result.page.pageId, h.website.editorData.pages[1].id);
  assert.equal(result.page.routePath, '/about'); assert.equal(result.page.filePath, h.file.path);
  assert.equal(h.file.content, h.originalSource);
});

test('strict recognition types support exhaustive service control-flow narrowing', () => {
  const actual = path.join(root, 'src/services/compiler/pageRecognition.ts');
  const virtual = path.join(root, 'src/services/compiler/__recognition_contract_check__.ts');
  const source = `import { resolvePageSourceTarget } from './pageRecognition';
    const target = resolvePageSourceTarget([{key:'x', filePath:'x', routePath:'/', pageId:'x'}], 'src/pages/X.tsx', 'react');
    function check() {
      if (target.status === 'conflict') return;
      if (target.status === 'invalid' || target.status === 'unsupported') return;
      if (target.status === 'not-a-page') return;
      if (target.status === 'new') return;
      return target.page.pageId;
    }`;
  const options = { noEmit: true, strict: true, noUncheckedIndexedAccess: true,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, types: [], skipLibCheck: true };
  const host = ts.createCompilerHost(options);
  const originalRead = host.readFile.bind(host), originalExists = host.fileExists.bind(host);
  host.readFile = (name) => name === virtual ? source : originalRead(name);
  host.fileExists = (name) => name === virtual || originalExists(name);
  const program = ts.createProgram([actual, virtual], options, host);
  const errors = ts.getPreEmitDiagnostics(program).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
});
