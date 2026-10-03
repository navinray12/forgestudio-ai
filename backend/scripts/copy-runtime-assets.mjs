import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// prisma-client-js generates JS, WASM and its CommonJS package boundary. tsc
// does not copy these non-TypeScript runtime assets into the production output.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'src/generated/prisma');
const target = resolve(root, 'dist/generated/prisma');
if (!existsSync(resolve(source, 'client.js')) || !existsSync(resolve(source, 'package.json'))) {
  throw new Error('Generate the Prisma client before building runtime assets');
}
mkdirSync(dirname(target), { recursive: true });
cpSync(source, target, { recursive: true, force: true });
console.log('Copied generated Prisma runtime assets into dist/generated/prisma');
