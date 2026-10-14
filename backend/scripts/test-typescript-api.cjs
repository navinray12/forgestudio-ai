/** Resolve a JavaScript AST compiler explicitly; the native TS CLI is not that API.
 * Prefer the committed frontend compiler, matching the production locator's
 * qualified fallback. Offline source-unit runs may use their installed JS compiler.
 * No dependency is installed or substituted by this helper.
 */
const path = require('node:path');
const candidates = [
  path.resolve(__dirname, '../../frontend/node_modules/typescript/lib/typescript.js'),
  'typescript-compiler-api',
  'typescript',
];
let selected;
for (const candidate of candidates) {
  try {
    const mod = require(candidate);
    const api = mod && typeof mod.createSourceFile === 'function' ? mod : mod?.default;
    if (api && typeof api.transpileModule === 'function' &&
        typeof api.createProgram === 'function' && api.ScriptTarget && api.ModuleKind) {
      selected = api;
      break;
    }
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND' && error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
  }
}
if (!selected) throw new Error('Install a qualified TypeScript JavaScript compiler API; the native CLI alone cannot run these source tests.');
console.log(`# JavaScript compiler API: TypeScript ${selected.version}`);
module.exports = selected;
