import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(path.resolve("frontend/package.json"));
const ts = require("typescript");
const moduleRoot = "backend/src/modules/identity";
const files = folder => readdirSync(folder, {withFileTypes:true}).flatMap(entry =>
  entry.isDirectory() ? files(path.join(folder,entry.name)) : [path.join(folder,entry.name)]);
test("ARCH-IDENTITY-001: domain and application import no provider implementation", () => {
  for (const filename of [...files(`${moduleRoot}/domain`), ...files(`${moduleRoot}/application`)]) {
    if (!filename.endsWith(".ts")) continue;
    const source = ts.createSourceFile(filename,readFileSync(filename,"utf8"),ts.ScriptTarget.Latest,true);
    const inspect = node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = node.moduleSpecifier?.text;
        if (typeof specifier === "string") {
          assert.doesNotMatch(specifier, /adapters\/|config\/|composition|generated\/|prisma|openid-client|nodemailer|^pg$|aws-sdk/,
            `Forbidden provider import in ${filename}`);
        }
      }
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          ts.isIdentifier(node.expression) && node.expression.text === "require")) {
        assert.fail(`Dynamic provider import is not permitted in identity application/domain: ${filename}`);
      }
      ts.forEachChild(node,inspect);
    };
    inspect(source);
  }
});
test("ARCH-IDENTITY-002: HTTP identity handlers do not bypass repository ports", () => {
  for (const filename of [...files(`${moduleRoot}/http`), "backend/src/controllers/auth.controller.ts", "backend/src/routes/auth.routes.ts"]) {
    assert.doesNotMatch(readFileSync(filename,"utf8"), /from ["'][^"']*(?:config\/prisma|config\/database|generated\/prisma|adapters\/)/,
      `Direct infrastructure import in ${filename}`);
  }
});
test("ARCH-IDENTITY-003: scoped manifest links real operations, handlers, tests and runbook", () => {
  const manifest=JSON.parse(readFileSync(`${moduleRoot}/feature.manifest.json`,"utf8"));
  assert.equal(manifest.criticality,"locked"); assert.equal(manifest.productionProvider,"oidc");
  assert.ok(manifest.owner); assert.ok(existsSync(manifest.migration)); assert.ok(existsSync(manifest.runbook));
  const ids=new Set();
  for (const operation of manifest.operations) {
    assert.ok(!ids.has(operation.id)); ids.add(operation.id);
    assert.ok(operation.permission); assert.ok(operation.method); assert.ok(operation.path);
    assert.ok(existsSync(operation.handler)); assert.ok(operation.tests.length);
    for (const file of operation.tests) assert.ok(existsSync(file),file);
  }
  for (const file of [...manifest.ports,...manifest.adapters,...manifest.tests]) assert.ok(existsSync(file),file);
  assert.equal(manifest.verification.production,"NOT_QUALIFIED");
});
