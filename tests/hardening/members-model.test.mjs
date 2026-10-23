import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';
const api=await loadTypeScript('frontend/src/features/workspaces/members-model.ts');
const workspace=(role='OWNER',lifecycleStatus='ACTIVE')=>({userRole:role,lifecycleStatus});
const invitation=(role='MEMBER',status='PENDING')=>({role,status,expiresAt:'2030-01-01T00:00:00Z',emailStatus:'SENT',emailQueuedAt:'2020-01-01T00:00:00Z'});
test('owners and admins may invite, but role changes require the owner; archived workspaces are read-only',()=>{
  assert.equal(api.membersPermissions(workspace()).changeRoles,true);
  assert.equal(api.membersPermissions(workspace('ADMIN')).invite,true);assert.equal(api.membersPermissions(workspace('ADMIN')).changeRoles,false);
  assert.equal(api.membersPermissions(workspace('MEMBER')).manage,false);
  assert.equal(api.membersPermissions(workspace('OWNER','ARCHIVED')).invite,false);
  assert.equal(api.membersPermissions(workspace('OWNER','ARCHIVED')).manage,true);
});
test('administrator invitations can only be resent by owners; accepted/revoked invitations cannot be resent',()=>{
  assert.equal(api.canResendInvitation(workspace('ADMIN'),invitation('ADMIN')),false);
  assert.equal(api.canResendInvitation(workspace('OWNER'),invitation('ADMIN')),true);
  assert.equal(api.canResendInvitation(workspace('ADMIN'),invitation('MEMBER')),true);
  for(const status of ['ACCEPTED','REVOKED'])assert.equal(api.canResendInvitation(workspace(),invitation('MEMBER',status)),false);
  assert.equal(api.canResendInvitation(workspace('OWNER','ARCHIVED'),invitation()),false);
});
test('expiry is derived without confusing accepted or revoked invitations with pending records',()=>{
  const now=Date.parse('2031-01-01T00:00:00Z');
  assert.equal(api.invitationStatus(invitation(),now),'EXPIRED');
  assert.equal(api.invitationStatus(invitation('MEMBER','ACCEPTED'),now),'ACCEPTED');
  assert.equal(api.invitationStatus(invitation('MEMBER','REVOKED'),now),'REVOKED');
});
test('email resend cooldown and in-app renewal follow the backend contract',()=>{
  const item={...invitation(),emailQueuedAt:'2030-01-01T00:00:00Z'};
  assert.equal(api.resendWait(item,Date.parse(item.emailQueuedAt)+10_000),50);
  assert.equal(api.resendWait(item,Date.parse(item.emailQueuedAt)+60_000),0);
  assert.equal(api.resendWait({...item,emailStatus:'NONE'},Date.parse(item.emailQueuedAt)),0);
});
test('search includes email/name and combines with exact workspace role filtering',()=>{
  const member={role:'ADMIN',membershipStatus:'ACTIVE',user:{fullName:'Sam Jones',email:'sam@example.test',status:'ACTIVE'}};
  assert.equal(api.memberMatches(member,' EXAMPLE.TEST ','ADMIN'),true);
  assert.equal(api.memberMatches(member,'sam','MEMBER'),false);assert.equal(api.memberMatches(member,'jones','ALL'),true);
  assert.equal(api.memberStatus(member),'ACTIVE');
  assert.equal(api.memberStatus({...member,membershipStatus:'INACTIVE'}),'INACTIVE');
  assert.equal(api.memberStatus({user:{status:'ACTIVE'}}),'UNKNOWN');
  assert.equal(api.memberStatus({user:{status:'SUSPENDED'}}),'SUSPENDED');
});

test('workspace member projection exposes only safe details and accurately identifies inactive memberships',async()=>{
  const organization={id:'org',ownerId:'owner'};
  const current={id:'workspace',organizationId:'org',ownerId:'owner',name:'Workspace',settings:{},version:1};
  let projection;
  const row=(userId,status='ACTIVE',orgRoles=['MEMBER'],role='MEMBER')=>({id:userId,userId,role,createdAt:new Date(),user:{fullName:userId,email:userId+'@example.test',status,emailVerified:true,organizationMemberships:orgRoles.map(role=>({role}))}});
  const tx={
    $queryRaw:async()=>[], user:{findUnique:async()=>({status:'ACTIVE'})},
    organization:{findUnique:async()=>organization},organizationMember:{findUnique:async()=>({role:'OWNER'})},
    workspace:{findUnique:async()=>current},workspaceMember:{findUnique:async()=>({role:'OWNER'}),findMany:async options=>{projection=options.select;return[row('owner','ACTIVE',['OWNER'],'OWNER'),row('active'),row('suspended','SUSPENDED'),row('revoked-org','ACTIVE',[]),row('fake-owner','ACTIVE',['MEMBER'],'OWNER')];}},website:{findMany:async()=>[]},
  };
  const service=await loadTypeScript('backend/src/services/workspaces/workspace-api.service.ts',{
    '../../config/prisma.js':{prisma:{$transaction:fn=>fn(tx)}},
    '../billing/subscription-policy.js':{requireSubscriptionAccess(){}},'./command.js':{workspaceCommand(){}},
  });
  const result=await service.readTenantWorkspace('owner','workspace');
  assert.equal(result.members[0].membershipStatus,'ACTIVE');assert.equal(result.members[1].membershipStatus,'ACTIVE');
  assert.equal(result.members[2].membershipStatus,'SUSPENDED');assert.equal(result.members[3].membershipStatus,'INACTIVE');assert.equal(result.members[4].membershipStatus,'INACTIVE');
  assert.equal(result.members[1].user.email,'active@example.test');
  assert.equal('organizationMemberships' in result.members[1].user,false);
  assert.equal('passwordHash' in projection.user.select,false);assert.equal('sessions' in projection.user.select,false);
});
