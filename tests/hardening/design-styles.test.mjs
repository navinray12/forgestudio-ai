import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTypeScript} from './load-typescript.mjs';
const utils = await loadTypeScript('frontend/src/pages/editor/utils/index.ts');
test('native preview resolves responsive styles without saved custom breakpoints', () => {
 const el={id:'main',type:'container',styles:{display:'grid',gap:'2rem',background:'linear-gradient(90deg,#fff,#eee)',gridTemplateColumns:'1fr 1fr'},responsiveStyles:{mobile:{gridTemplateColumns:'1fr',gap:'1rem'}}};
 const desktop=utils.resolveElementStyles(el,'desktop',[],{}), mobile=utils.resolveElementStyles(el,'mobile',[],{});
 assert.equal(desktop.gridTemplateColumns,'1fr 1fr');assert.equal(mobile.gridTemplateColumns,'1fr');assert.equal(mobile.gap,'1rem');assert.equal(mobile.background,el.styles.background);
 assert.equal(utils.getMergedStyles(el,'mobile').gridTemplateColumns,'1fr');
});
