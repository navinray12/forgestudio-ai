import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTypeScript} from './load-typescript.mjs';
const {resolveWebsiteRole}=await loadTypeScript('backend/src/services/websites/scoped-access.ts',{'../../config/prisma.js':{prisma:{}}});
function site(overrides={}) {return {userId:'actor',organizationId:'org',workspaceId:'workspace',
 organization:{ownerId:'other',members:[{role:'MEMBER'}]},
 workspace:{ownerId:'other',organizationId:'org',members:[{role:'MEMBER'}]},
 collaborators:[],granularPermissions:[],...overrides};}

test('TEN-001: creator attribution cannot replace revoked workspace membership',()=>{
 assert.equal(resolveWebsiteRole(site({workspace:{ownerId:'actor',organizationId:'org',members:[]}}),'actor'),null);
});
test('TEN-001: parent workspace and website must belong to the same organization',()=>{
 assert.equal(resolveWebsiteRole(site({workspace:{ownerId:'actor',organizationId:'different',members:[{role:'OWNER'}]}}),'actor'),null);
});
test('TEN-001: org removal blocks retained workspace membership',()=>{
 assert.equal(resolveWebsiteRole(site({organization:{ownerId:'other',members:[]}}),'actor'),null);
});
test('AUTH-002: ordinary workspace membership is view-only even for a historical creator',()=>{
 assert.equal(resolveWebsiteRole(site(),'actor'),'VIEWER');
});
test('AUTH-002: current workspace owner receives project ownership within that workspace',()=>{
 assert.equal(resolveWebsiteRole(site({workspace:{ownerId:'actor',organizationId:'org',members:[{role:'OWNER'}]}}),'actor'),'OWNER');
});
test('AUTH-002: forged owner collaborator does not create ownership',()=>{
 assert.equal(resolveWebsiteRole(site({collaborators:[{permission:'OWNER'}]}),'actor'),null);
});
test('AUTH-002: approved resource-specific design role is preserved',()=>{
 assert.equal(resolveWebsiteRole(site({collaborators:[{permission:'DESIGNER'}]}),'actor'),'DESIGNER');
});
test('AUTH-002: explicit global view deny prevents content disclosure',()=>{
 assert.equal(resolveWebsiteRole(site({granularPermissions:[{effect:'DENY'}]}),'actor'),null);
});
test('TEN-001: legacy unscoped owner contract is preserved pending migration',()=>{
 assert.equal(resolveWebsiteRole(site({organizationId:null,workspaceId:null,organization:null,workspace:null}),'actor'),'OWNER');
 assert.equal(resolveWebsiteRole(site({organizationId:null,workspaceId:null,organization:null,workspace:null}),'outsider'),null);
});
