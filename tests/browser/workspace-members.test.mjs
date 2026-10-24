import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import path from 'node:path';

const workspaceId='4bbdb207-2bbe-484f-ab50-efc014d47265';
const otherId='94457617-4d53-4637-8b21-108d82246f2a';
const ownerId='e58d8a53-f557-4e20-8617-1f79c6644186';
const memberId='a6db5cbf-1e42-48f8-9b5a-e3d7ec532b3c';
const joined='2026-01-01T00:00:00.000Z';
const member=(id,name,email,role='MEMBER',status='ACTIVE')=>({id,userId:id,role,createdAt:joined,membershipStatus:status,user:{fullName:name,email,status,emailVerified:true}});
const invitation=(email,options={})=>({id:randomUUID(),recipientUserId:null,invitedEmail:email,role:'MEMBER',status:'PENDING',version:1,
  expiresAt:new Date(Date.now()+7*86400000).toISOString(),emailStatus:'SENT',emailQueuedAt:joined,emailSentAt:joined,...options});
const scope=(id=workspaceId,name='Current workspace')=>({id,name,slug:id,organizationId:otherId,userRole:'OWNER',version:1,lifecycleStatus:'ACTIVE',
  members:[member(ownerId,'Workspace owner','owner@example.test','OWNER'),member(memberId,'Sam Member','sam@example.test')],websites:[],hasMoreWebsites:false});

test('Workspace Members UI (mock HTTP; no real database or email)',{timeout:240000},async t=>{
  const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const base=`http://127.0.0.1:${port}`;
  const vite=spawn(process.execPath,[path.resolve('frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{
    cwd:path.resolve('frontend'),windowsHide:true,env:{...process.env,VITE_API_URL:base},stdio:['ignore','pipe','pipe'],
  });t.after(()=>vite.kill());
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Vite fixture did not start')),20000);
    vite.once('error',reject);vite.once('exit',code=>{clearTimeout(timer);reject(new Error('Vite exited: '+code));});
    vite.stdout.on('data',data=>{if(data.toString().includes('Local:')){clearTimeout(timer);resolve();}});
  });
  const executablePath=[process.env.FORGE_CHROME_PATH,chromium.executablePath(),'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&existsSync(p));
  const browser=await chromium.launch({executablePath,headless:true});t.after(()=>browser.close());
  async function fixture(options={}){
    const initial=scope();
    const state={scopes:[initial],invitations:[],failure:null,loadFailure:null,failOnce:false,readGates:new Map(),...options};
    const requests=[];const journal=new Map();const context=await browser.newContext({viewport:{width:1440,height:1000}});t.after(()=>context.close());
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(!url.pathname.startsWith('/api/')){if(url.origin===base)await route.continue();else await route.abort();return;}
      const body=request.postDataJSON(),headers=request.headers();requests.push({path:url.pathname,method:request.method(),body,headers});
      const respond=(status,value)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
      const fail=(code,status,message='Fixture failure')=>respond(status,{success:false,error:{code,message}});
      if(url.pathname.endsWith('/auth/me'))return respond(200,{success:true,data:{user:{id:ownerId,fullName:'Workspace owner',email:'owner@example.test',role:'USER',status:'ACTIVE',emailVerified:true}}});
      const prefix='/api/v1/tenant-workspaces';
      if(!url.pathname.startsWith(prefix))return respond(200,{success:true,websites:[]});
      const segments=url.pathname.slice(prefix.length).split('/').filter(Boolean);const workspace=state.scopes.find(item=>item.id===segments[0]);
      if(request.method()==='GET'){
        const segment=segments.length===0?'list':segments.length===1?'detail':'invitations';
        if(state.loadFailure?.segment===segment)return fail(state.loadFailure.code,state.loadFailure.status);
        if(!segments.length)return respond(200,{success:true,workspaces:state.scopes.map(({members,websites,...rest})=>rest)});
        if(!workspace)return fail('NOT_FOUND',404);
        if(segments.length===1){const gate=state.readGates.get(workspace.id);if(gate)await gate;return respond(200,{success:true,workspace}).catch(()=>{});}
        if(segments[1]==='invitations'){
          if(workspace.userRole==='MEMBER')return fail('FORBIDDEN',403);
          return respond(200,{success:true,invitations:state.invitations.filter(item=>!item.workspaceId||item.workspaceId===workspace.id)});
        }
        return fail('NOT_FOUND',404);
      }
      if(journal.has(headers['idempotency-key']))return respond(200,journal.get(headers['idempotency-key']));
      if(state.failure){const error=state.failure;if(state.failOnce)state.failure=null;return fail(error.code,error.status,error.message);}
      if(!workspace||workspace.userRole==='MEMBER')return fail('FORBIDDEN',403);
      let result={success:true};
      if(segments[1]==='member-role'){
        if(workspace.userRole!=='OWNER')return fail('FORBIDDEN',403);
        if(headers['if-match']!==`"${workspace.id}:${workspace.version}"`)return fail('VERSION_CONFLICT',412);
        workspace.members.find(item=>item.userId===body.userId).role=body.role;workspace.version++;
      }else if(segments.length===2&&segments[1]==='invitations'){
        if(body.role==='ADMIN'&&workspace.userRole!=='OWNER')return fail('FORBIDDEN',403);
        if(state.invitations.some(item=>item.status==='PENDING'&&item.invitedEmail===body.email))return fail('INVITATION_EXISTS',409,'Renew or revoke the existing invitation');
        const item=invitation(body.email,{role:body.role,workspaceId:workspace.id,emailStatus:'QUEUED',emailQueuedAt:new Date().toISOString(),emailSentAt:null});
        state.invitations.push(item);result={success:true,invitation:item,delivery:'QUEUED'};
      }else{
        const item=state.invitations.find(item=>item.id===segments[2]);if(!item)return fail('NOT_FOUND',404);
        if(headers['if-match']!==`"${item.id}:${item.version}"`)return fail('VERSION_CONFLICT',412);
        if(segments[3]==='renew'){
          if(item.role==='ADMIN'&&workspace.userRole!=='OWNER')return fail('FORBIDDEN',403);
          Object.assign(item,{version:item.version+1,expiresAt:new Date(Date.now()+7*86400000).toISOString(),emailStatus:'QUEUED',emailQueuedAt:new Date().toISOString(),emailSentAt:null});
        }else Object.assign(item,{version:item.version+1,status:'REVOKED'});
      }
      if(state.afterCommandLoadFailure)state.loadFailure=state.afterCommandLoadFailure;
      journal.set(headers['idempotency-key'],result);return respond(200,result);
    });
    const page=await context.newPage();page.setDefaultTimeout(10000);
    const open=async()=>{await page.goto(base+'/dashboard');await page.getByRole('button',{name:'Members',exact:true}).click();};
    const modal=()=>page.getByRole('dialog',{name:'Invite a member'});
    const invite=async()=>{await page.locator('.members-toolbar').getByRole('button',{name:'Invite member',exact:true}).click();await expect(modal()).toBeVisible();};
    return{state,requests,page,context,open,invite,modal};
  }
  await t.test('shared dashboard settings toggle, support navigation and logout work on desktop and mobile',async()=>{
    const f=await fixture();
    await f.context.route('**/api/**',route=>{
      const pathname=new URL(route.request().url()).pathname;
      if(pathname.includes('/auth/')||pathname.startsWith('/api/v1/tenant-workspaces')||pathname.startsWith('/api/websites'))return route.fallback();
      return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Section data unavailable in layout fixture'})});
    });
    await f.open();
    const settings=f.page.getByRole('button',{name:'Settings',exact:true});
    await expect(settings).toHaveAttribute('aria-expanded','false');
    await expect(f.page.getByRole('link',{name:'Help center',exact:true})).toHaveCount(0);
    await expect(f.page.getByRole('button',{name:/^(Undo|Redo)$/})).toHaveCount(0);
    const closedBounds=await settings.boundingBox();
    const navBounds=await f.page.getByRole('navigation',{name:'Workspace navigation'}).boundingBox();
    await settings.focus();await f.page.keyboard.press('Enter');
    await expect(settings).toHaveAttribute('aria-expanded','true');
    assert.deepEqual(await settings.boundingBox(),closedBounds);
    assert.deepEqual(await f.page.getByRole('navigation',{name:'Workspace navigation'}).boundingBox(),navBounds);
    const popup=f.page.locator('#dashboard-settings');
    const popupBounds=await popup.boundingBox();assert.ok(popupBounds.y+popupBounds.height<=closedBounds.y);
    await f.page.getByRole('link',{name:'Help center',exact:true}).focus();await f.page.keyboard.press('Escape');
    await expect(settings).toHaveAttribute('aria-expanded','false');await expect(settings).toBeFocused();
    await settings.click();await f.page.locator('.studio-brand').click();
    await expect(settings).toHaveAttribute('aria-expanded','false');
    await settings.click();await settings.click();await expect(settings).toHaveAttribute('aria-expanded','false');
    for(const section of ['Sites','Archive','Members','Usage','Forms','Billing','Integrations','Libraries & Templates']){
      await f.page.getByRole('navigation',{name:'Workspace navigation'}).getByRole('button',{name:section,exact:true}).click();
      await expect(settings).toBeVisible();
      await expect(settings).toHaveAttribute('aria-expanded','false');await settings.click();
      await expect(f.page.getByRole('link',{name:'Help center',exact:true})).toHaveAttribute('href','/support');
      await expect(f.page.getByRole('button',{name:/^(Undo|Redo)$/})).toHaveCount(0);
    }
    await f.page.getByRole('link',{name:'Help center',exact:true}).click();await expect(f.page).toHaveURL(/\/support$/);
    await f.page.goto(base+'/dashboard');
    await f.page.setViewportSize({width:390,height:844});
    await f.page.getByRole('button',{name:'Toggle navigation'}).click();
    await expect.poll(async()=>Math.round((await settings.boundingBox()).x)).toBe(15);
    const mobileBounds=await settings.boundingBox();
    await settings.click();await expect(f.page.getByRole('button',{name:'Log out',exact:true})).toBeVisible();
    assert.deepEqual(await settings.boundingBox(),mobileBounds);
    await f.page.keyboard.press('Escape');await expect(settings).toHaveAttribute('aria-expanded','false');
    await settings.click();await f.page.locator('.studio-main').click({position:{x:280,y:10}});
    await expect(settings).toHaveAttribute('aria-expanded','false');await settings.click();
    await settings.click();await expect(settings).toHaveAttribute('aria-expanded','false');
    await settings.click();await f.page.getByRole('button',{name:'Log out',exact:true}).click();
    await expect(f.page).toHaveURL(/\/login$/);
    assert.ok(f.requests.some(r=>r.path.endsWith('/auth/logout')&&r.method==='POST'));
  });
  await t.test('email invites use the existing API, normalize input, and remain pending without creating a member',async()=>{
    const f=await fixture();await f.open();await f.invite();
    await f.modal().getByLabel('Email address',{exact:true}).fill(' New@Example.Test ');await f.modal().getByLabel('Role',{exact:true}).selectOption('ADMIN');
    await f.modal().getByRole('button',{name:'Send invite',exact:true}).click();await expect(f.modal()).toHaveCount(0);
    await expect(f.page.getByRole('status')).toContainText('Invitation email queued for new@example.test');
    const mutation=f.requests.find(r=>r.method==='POST');assert.deepEqual(mutation.body,{email:'new@example.test',role:'ADMIN'});assert.ok(mutation.headers['idempotency-key']);
    assert.equal(mutation.headers.authorization,undefined);await expect(f.page.getByRole('region',{name:'Workspace invitations'})).toContainText('Email queued');
    assert.equal(f.state.scopes[0].members.length,2);assert.equal(await f.page.getByRole('table',{name:'Workspace members'}).getByText('new@example.test',{exact:true}).count(),0);
  });
  await t.test('failed invites preserve the modal, email, role and retry key',async()=>{
    const f=await fixture({failure:{status:503,code:'DELIVERY_UNAVAILABLE',message:'Email delivery is unavailable'},failOnce:true});await f.open();await f.invite();
    await f.modal().getByLabel('Email address',{exact:true}).fill('retry@example.test');await f.modal().getByLabel('Role',{exact:true}).selectOption('ADMIN');
    await f.modal().getByRole('button',{name:'Send invite',exact:true}).click();await expect(f.modal().getByRole('alert')).toContainText('Email delivery is unavailable');
    await expect(f.modal().getByLabel('Email address',{exact:true})).toHaveValue('retry@example.test');await expect(f.modal().getByLabel('Role',{exact:true})).toHaveValue('ADMIN');
    await f.modal().getByRole('button',{name:'Send invite',exact:true}).click();await expect(f.modal()).toHaveCount(0);
    const calls=f.requests.filter(r=>r.method==='POST');assert.equal(calls.length,2);assert.equal(calls[0].headers['idempotency-key'],calls[1].headers['idempotency-key']);
  });
  await t.test('duplicate invitations surface the server conflict inside the retained form',async()=>{
    const f=await fixture({invitations:[invitation('existing@example.test')]});await f.open();await f.invite();await f.modal().getByLabel('Email address',{exact:true}).fill('existing@example.test');
    await f.modal().getByRole('button',{name:'Send invite',exact:true}).click();await expect(f.modal().getByRole('alert')).toContainText('Renew or revoke');
    await expect(f.modal().getByLabel('Email address',{exact:true})).toHaveValue('existing@example.test');assert.equal(f.state.invitations.length,1);
  });
  await t.test('successful invite stays successful if refresh fails; retrying the read never sends another invite',async()=>{
    const f=await fixture({afterCommandLoadFailure:{segment:'list',status:503,code:'UNAVAILABLE'}});await f.open();await f.invite();
    await f.modal().getByLabel('Email address',{exact:true}).fill('sent@example.test');await f.modal().getByRole('button',{name:'Send invite',exact:true}).click();
    await expect(f.modal()).toHaveCount(0);await expect(f.page.getByRole('status')).toContainText('Invitation email queued for sent@example.test');
    await expect(f.page.getByRole('alert')).toBeVisible();f.state.loadFailure=null;
    await f.page.getByRole('button',{name:'Try again',exact:true}).click();await expect(f.page.getByRole('region',{name:'Workspace invitations'})).toContainText('sent@example.test');
    assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
  });
  await t.test('stale invitation versions show an error and reload the current version before retry',async()=>{
    const pending=invitation('changed@example.test');const f=await fixture({invitations:[pending]});await f.open();
    await expect(f.page.getByRole('button',{name:'Revoke invitation to changed@example.test',exact:true})).toBeVisible();pending.version++;
    await f.page.getByRole('button',{name:'Revoke invitation to changed@example.test',exact:true}).click();await expect(f.page.getByRole('alert')).toBeVisible();
    await expect(f.page.getByRole('button',{name:'Revoke invitation to changed@example.test',exact:true})).toBeEnabled();
    await f.page.getByRole('button',{name:'Revoke invitation to changed@example.test',exact:true}).click();await expect(f.page.getByRole('status')).toContainText('Invitation revoked');
    const calls=f.requests.filter(r=>r.path.endsWith('/revoke'));assert.equal(calls.length,2);assert.equal(calls[1].headers['if-match'],`"${pending.id}:2"`);
    assert.notEqual(calls[0].headers['idempotency-key'],calls[1].headers['idempotency-key']);
  });
  await t.test('pending, expiry, delivery failures and history render correctly; resend/revoke use versions',async()=>{
    const failed=invitation('failed@example.test',{emailStatus:'FAILED'}),expired=invitation('expired@example.test',{expiresAt:'2020-01-01T00:00:00Z'});
    const f=await fixture({invitations:[failed,expired,invitation('accepted@example.test',{status:'ACCEPTED'}),invitation('revoked@example.test',{status:'REVOKED'})]});await f.open();
    const region=f.page.getByRole('region',{name:'Workspace invitations'});await expect(region).toContainText('Delivery failed');await expect(region.getByText('Expired',{exact:true})).toBeVisible();
    await region.getByRole('button',{name:'Resend invitation to failed@example.test',exact:true}).click();await expect(region).toContainText('Email queued');
    assert.equal(f.requests.find(r=>r.path.endsWith('/renew')).headers['if-match'],`"${failed.id}:1"`);
    await expect(region.getByRole('button',{name:'Resend invitation to failed@example.test',exact:true})).toBeDisabled();
    await region.getByRole('button',{name:'Revoke invitation to expired@example.test',exact:true}).click();
    assert.equal(f.requests.find(r=>r.path.endsWith('/revoke')).headers['if-match'],`"${expired.id}:1"`);
    await region.getByText(/Invitation history/).click();await expect(region.getByText('Accepted',{exact:true})).toBeVisible();
    await expect(region.getByRole('button',{name:'Revoke invitation to expired@example.test',exact:true})).toHaveCount(0);
  });
  await t.test('member details and email search match actual status; owner can change an active non-owner role',async()=>{
    const current=scope();current.members.push(member(randomUUID(),'Suspended person','suspended@example.test','ADMIN','SUSPENDED'));
    const f=await fixture({scopes:[current]});await f.open();const table=f.page.getByRole('table',{name:'Workspace members'});
    await expect(table.getByText('sam@example.test',{exact:true})).toBeVisible();await expect(table.getByText('Suspended',{exact:true})).toBeVisible();
    await expect(table.locator('time').first()).toHaveAttribute('datetime',joined);
    await expect(table.getByText('Active',{exact:true})).toHaveCount(2);
    assert.equal(await table.getByLabel('Role for Workspace owner',{exact:true}).count(),0);assert.equal(await table.getByLabel('Role for Suspended person',{exact:true}).count(),0);
    await table.getByLabel('Role for Sam Member',{exact:true}).selectOption('ADMIN');await expect(f.page.getByRole('status')).toContainText('Member role updated');
    assert.equal(f.requests.find(r=>r.method==='PATCH').headers['if-match'],`"${workspaceId}:1"`);await expect(table.getByLabel('Role for Sam Member',{exact:true})).toHaveValue('ADMIN');
    await f.page.getByLabel('Search members',{exact:true}).fill('SAM@EXAMPLE');await expect(table.getByRole('row')).toHaveCount(2);
    await f.page.getByLabel('Filter members',{exact:true}).selectOption('MEMBER');await expect(table).toContainText('No members match your filters');
  });
  await t.test('admins can invite members but cannot grant admin, change roles, or resend admin invitations',async()=>{
    const current=scope();current.userRole='ADMIN';const f=await fixture({scopes:[current],invitations:[invitation('admin@example.test',{role:'ADMIN'}),invitation('allowed@example.test')]});await f.open();
    assert.equal(await f.page.getByLabel('Role for Sam Member',{exact:true}).count(),0);
    assert.equal(await f.page.getByRole('button',{name:'Resend invitation to admin@example.test',exact:true}).count(),0);
    await expect(f.page.getByRole('button',{name:'Revoke invitation to admin@example.test',exact:true})).toBeVisible();
    await f.invite();await expect(f.modal().getByLabel('Role',{exact:true}).locator('option')).toHaveCount(1);
    await f.modal().getByLabel('Email address',{exact:true}).fill('admin-invite@example.test');await f.modal().getByRole('button',{name:'Send invite',exact:true}).click();
    assert.equal(f.requests.find(r=>r.method==='POST').body.role,'MEMBER');
  });
  await t.test('members cannot manage invitations; archived managers may revoke but not invite/resend/change roles',async()=>{
    const current=scope();current.userRole='MEMBER';const f=await fixture({scopes:[current]});await f.open();
    await expect(f.page.getByRole('table',{name:'Workspace members'})).toBeVisible();assert.equal(f.requests.some(r=>r.path.endsWith('/invitations')),false);
    assert.equal(await f.page.getByRole('region',{name:'Workspace invitations'}).count(),0);assert.equal(await f.page.locator('.members-toolbar').getByRole('button',{name:'Invite member',exact:true}).count(),0);
    current.userRole='OWNER';current.lifecycleStatus='ARCHIVED';f.state.invitations.push(invitation('archived@example.test'));await f.page.getByRole('button',{name:'Refresh members',exact:true}).click();
    await expect(f.page.getByRole('button',{name:'Revoke invitation to archived@example.test',exact:true})).toBeVisible();assert.equal(await f.page.getByRole('button',{name:'Resend invitation to archived@example.test',exact:true}).count(),0);
    assert.equal(await f.page.getByLabel('Role for Sam Member',{exact:true}).count(),0);
  });
  await t.test('accepted invitations refresh into active member details on focus and through cross-tab notification',async()=>{
    const pending=invitation('joined@example.test');const f=await fixture({invitations:[pending]});await f.open();
    await expect(f.page.getByRole('button',{name:'Revoke invitation to joined@example.test',exact:true})).toBeVisible();
    const sender=await f.context.newPage();await sender.goto(base+'/dashboard');
    f.state.scopes[0].members.push(member(randomUUID(),'Focus member','focus@example.test'));await f.page.bringToFront();
    await f.page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(f.page.getByRole('table',{name:'Workspace members'}).getByText('focus@example.test',{exact:true})).toBeVisible();
    pending.status='ACCEPTED';f.state.scopes[0].members.push(member(randomUUID(),'Joined member','joined@example.test'));
    await sender.evaluate(async id=>{const {notifyMembersChanged}=await import('/src/features/workspaces/members-sync.ts');notifyMembersChanged(id);},workspaceId);
    await expect(f.page.getByRole('table',{name:'Workspace members'}).getByText('joined@example.test',{exact:true})).toBeVisible();
    await expect(f.page.getByRole('button',{name:'Revoke invitation to joined@example.test',exact:true})).toHaveCount(0);
  });
  await t.test('periodic refresh picks up acceptance from another browser',async()=>{
    const pending=invitation('polled@example.test');const f=await fixture({invitations:[pending]});await f.page.clock.install();await f.open();
    await expect(f.page.getByRole('button',{name:'Revoke invitation to polled@example.test',exact:true})).toBeVisible();pending.status='ACCEPTED';f.state.scopes[0].members.push(member(randomUUID(),'Polled member','polled@example.test'));
    await f.page.clock.fastForward(31_000);await expect(f.page.getByRole('table',{name:'Workspace members'}).getByText('polled@example.test',{exact:true})).toBeVisible();
  });
  await t.test('rapid workspace changes cannot be overwritten by a stale response',async()=>{
    const second=scope(otherId,'Second workspace');const f=await fixture({scopes:[scope(),second]});await f.open();await expect(f.page.locator('.members-workspace-name')).toBeVisible();
    let release;f.state.readGates.set(otherId,new Promise(resolve=>{release=resolve;}));
    await f.page.getByLabel('Workspace',{exact:true}).selectOption(otherId);await f.page.getByLabel('Workspace',{exact:true}).selectOption(workspaceId);
    await expect(f.page.locator('.members-workspace-name')).toBeVisible();release();
    await expect(f.page.getByLabel('Workspace',{exact:true})).toHaveValue(workspaceId);
    await expect(f.page.getByLabel('Dashboard workspace',{exact:true})).toHaveValue(workspaceId);
  });
  await t.test('sidebar and Members share workspace selection across dashboard navigation',async()=>{
    const second=scope(otherId,'Second workspace');second.members=[member(randomUUID(),'Other member','other@example.test')];
    const f=await fixture({scopes:[scope(),second]});await f.open();
    const sidebar=f.page.getByLabel('Dashboard workspace',{exact:true});
    await expect(sidebar).toHaveValue(workspaceId);
    await sidebar.selectOption(otherId);
    await expect(f.page.getByLabel('Workspace',{exact:true})).toHaveValue(otherId);
    await expect(f.page.getByRole('table',{name:'Workspace members'})).toContainText('other@example.test');
    await f.page.getByRole('button',{name:'Sites',exact:true}).click();await expect(sidebar).toHaveValue(otherId);
    await f.page.getByRole('button',{name:'Members',exact:true}).click();
    await expect(f.page.locator('.members-workspace-name')).toHaveText('Second workspace');
    await f.page.getByLabel('Workspace',{exact:true}).selectOption(workspaceId);
    await expect(sidebar).toHaveValue(workspaceId);
    await expect(f.page.getByRole('table',{name:'Workspace members'})).toContainText('sam@example.test');
  });
  await t.test('missing member fields show honest fallbacks without inventing active status or a join date',async()=>{
    const current=scope();current.members=[{id:memberId,userId:memberId,role:'MEMBER',createdAt:'invalid',user:{fullName:' ',email:' ',status:'ACTIVE'}}];
    const f=await fixture({scopes:[current]});await f.open();const table=f.page.getByRole('table',{name:'Workspace members'});
    await expect(table).toContainText('Unnamed member');await expect(table).toContainText('Email unavailable');
    await expect(table).toContainText('Status unavailable');await expect(table.locator('.member-joined')).toHaveText('—');
    await expect(table.locator('time')).toHaveCount(0);
  });
  await t.test('owner email and active status come from the backend, and both workspace labels use the real owner',async()=>{
    const current=scope();current.ownerId=ownerId;current.owner={id:ownerId,fullName:'Actual Owner'};
    current.userRole='MEMBER';current.members[0].user.email='actual-owner@example.test';
    const f=await fixture({scopes:[current]});await f.open();
    await expect(f.page.getByLabel('Dashboard workspace').locator('option:checked')).toHaveText("Actual Owner's Workspace");
    await expect(f.page.locator('.members-workspace-name')).toHaveText("Actual Owner's Workspace");
    const owner=f.page.getByRole('table',{name:'Workspace members'}).getByRole('row').filter({hasText:'actual-owner@example.test'});
    await expect(owner).toContainText('Active');await expect(owner).toContainText('Owner');
    assert.equal(await owner.getByText('Email unavailable').count(),0);
  });
  for(const segment of ['list','detail','invitations'])await t.test(`401 during ${segment} loading clears data and offers sign-in`,async()=>{
    const f=await fixture({loadFailure:{segment,status:401,code:'UNAUTHORIZED'}});await f.open();await expect(f.page.getByRole('link',{name:'Sign in again',exact:true})).toBeVisible();
    assert.equal(await f.page.getByRole('table',{name:'Workspace members'}).count(),0);
  });
  await t.test('401 during an invite closes stale controls; 403 load failures retain normal retry behavior',async()=>{
    const f=await fixture({failure:{status:401,code:'UNAUTHORIZED'}});await f.open();await f.invite();await f.modal().getByLabel('Email address',{exact:true}).fill('expired@example.test');
    await f.modal().getByRole('button',{name:'Send invite',exact:true}).click();await expect(f.page.getByRole('link',{name:'Sign in again',exact:true})).toBeVisible();await expect(f.modal()).toHaveCount(0);
    const g=await fixture({loadFailure:{segment:'invitations',status:403,code:'FORBIDDEN'}});await g.open();await expect(g.page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
    assert.equal(await g.page.getByRole('link',{name:'Sign in again',exact:true}).count(),0);g.state.loadFailure=null;await g.page.getByRole('button',{name:'Try again',exact:true}).click();await expect(g.page.getByRole('table',{name:'Workspace members'})).toBeVisible();
  });
  await t.test('empty workspace list finishes loading and the modal can cancel without losing a failed draft',async()=>{
    const f=await fixture({scopes:[]});await f.open();await expect(f.page.getByText('No workspaces are available for this account.',{exact:true})).toBeVisible();
    const g=await fixture();await g.open();await g.invite();await g.modal().getByLabel('Email address',{exact:true}).fill('draft@example.test');await g.modal().getByRole('button',{name:'Cancel',exact:true}).click();
    await g.invite();await expect(g.modal().getByLabel('Email address',{exact:true})).toHaveValue('draft@example.test');
  });
});
