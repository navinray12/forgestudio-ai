import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTypeScript} from './load-typescript.mjs';
const policy=await loadTypeScript('frontend/src/features/content-runtime/runtime-policy.ts');
const studio='https://studio.example.test';const content='https://published.example-content.test';
for(const [current,management,runtime] of [
 [studio,studio,content],[content,undefined,content],[content,studio,undefined],
 [studio,studio,studio],['https://studio.example.test:444',studio,'https://studio.example.test:444'],
 ['http://published.example-content.test',studio,'http://published.example-content.test'],
 [content,studio,'https://name:password@published.example-content.test'],
 [content,studio,content+'/nested'],[content,studio,content+'?token=x'],
 [content,studio,content+'#fragment'],['https://other.example.test',studio,content],
])test(`FG-007: active content is denied outside an explicit isolated origin (${String(runtime)})`,()=>{
 assert.equal(policy.permitsActiveContent(current,management,runtime),false);
});
test('FG-007: explicitly configured distinct HTTPS content origin is eligible',()=>{
 assert.equal(policy.permitsActiveContent(content,studio,content),true);
});
test('FG-007: closing tags cannot escape the fixed script document',()=>{
 const html=policy.isolatedScriptDocument('</SCRIPT><img src="https://attacker.test">');
 assert.equal((html.match(/<\/script>/gi)||[]).length,1);
 assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);
 assert.ok(!html.includes("allow-same-origin"));
});
