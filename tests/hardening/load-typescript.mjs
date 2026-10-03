import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Execute the real TypeScript source with explicit dependency doubles.
 * These are isolated unit tests, not database, HTTP or production certification.
 * Unmocked package imports fail rather than connecting to a real service.
 */
export async function loadTypeScript(relativePath, mocks = {}, globals = {}) {
  const context = createContext({ console, Buffer, URL, TextEncoder, TextDecoder, process: { env: { NODE_ENV: "test" } }, ...globals });
  const modules = new Map();

  function synthetic(key, values) {
    if (!modules.has(key)) {
      modules.set(key, new SyntheticModule(Object.keys(values), function () {
        for (const [name, value] of Object.entries(values)) this.setExport(name, value);
      }, { context, identifier: key }));
    }
    return modules.get(key);
  }

  function source(path) {
    if (!existsSync(path) && path.endsWith('.js')) path = path.slice(0, -3) + '.ts';
    if (!existsSync(path) && !extname(path)) path += '.ts';
    if (!modules.has(path)) {
      const raw = readFileSync(path, 'utf8');
      const code = extname(path) === '.ts'
        ? stripTypeScriptTypes(raw, { mode: 'transform' }) : raw;
      modules.set(path, new SourceTextModule(code, { context, identifier: path }));
    }
    return modules.get(path);
  }

  const entry = source(resolve(root, relativePath));
  await entry.link(async (specifier, parent) => {
    if (Object.hasOwn(mocks, specifier)) return synthetic(`mock:${specifier}`, mocks[specifier]);
    if (specifier.startsWith('node:') || specifier === 'crypto') {
      return synthetic(specifier, await import(specifier));
    }
    if (specifier === 'zod') return synthetic(specifier, await import('../../backend/node_modules/zod/index.js'));
    if (!specifier.startsWith('.')) throw new Error(`Unmocked package import: ${specifier}`);
    return source(resolve(dirname(parent.identifier), specifier));
  });
  await entry.evaluate({ timeout: 5000 });
  return entry.namespace;
}
