import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import path from 'node:path';

const id='94457617-4d53-4637-8b21-108d82246f2a';
const workspaceId='4bbdb207-2bbe-484f-ab50-efc014d47265';
const actorId='e58d8a53-f557-4e20-8617-1f79c6644186';
const token='a'.repeat(43);
const storageKey='forge.workspace.pending-invitation';
const verifiedUser={id:actorId,fullName:'Invited member',email:'invited@example.test',role:'USER',status:'ACTIVE',emailVerified:true};

test('workspace invitation browser flows (mock HTTP, no database or email)',{timeout:240000},async t=>{
  const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const base=`http://127.0.0.1:${port}`;
  const vite=spawn(process.execPath,[path.resolve('frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{
    cwd:path.resolve('frontend'),windowsHide:true,env:{...process.env,VITE_API_URL:base},stdio:['ignore','pipe','pipe'],
  });
  t.after(()=>{vite.kill();});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Vite fixture did not start')),20000);
    vite.once('error',reject);vite.once('exit',code=>{clearTimeout(timer);reject(new Error('Vite fixture exited: '+code));});
    vite.stdout.on('data',chunk=>{if(chunk.toString().includes('Local:')){clearTimeout(timer);resolve();}});
  });
  const executablePath=[process.env.FORGE_CHROME_PATH,chromium.executablePath(),'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&existsSync(p));
  const browser=await chromium.launch({executablePath,headless:true});t.after(()=>browser.close());
  async function fixture(options={}){
    const state={user:options.user??null,resolveError:null,acceptError:null,acceptOnce:false,managed:false,...options};
    const requests=[];
    const context=await browser.newContext();t.after(()=>context.close());
    if(options.blockStorage)await context.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw new Error('blocked')}}));
    await context.route('**/*',async route=>{
      const request=route.request();const url=new URL(request.url());
      if(url.hostname==='provider.example'){
        state.user={...verifiedUser};await route.fulfill({status:302,headers:{location:base+'/dashboard'},body:''});return;
      }
      if(!url.pathname.startsWith('/api/')){
        if(url.origin===base)await route.continue();else await route.abort();return;
      }
      const body=request.postDataJSON();requests.push({path:url.pathname,search:url.search,method:request.method(),body,headers:request.headers()});
      const respond=(status,value)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
      const fail=(code,status)=>respond(status,{success:false,error:{code,message:'Fixture failure'}});
      if(url.pathname.endsWith('/auth/me'))return state.user?respond(200,{success:true,data:{user:state.user}}):fail('UNAUTHORIZED',401);
      if(url.pathname.endsWith('/auth/capabilities'))return respond(200,{success:true,data:{local:!state.managed,managed:state.managed,phone:false,...(state.localFile?{verificationDelivery:'LOCAL_FILE'}:{})}});
      if(url.pathname.endsWith('/auth/logout')){state.user=null;return respond(200,{success:true});}
      if(url.pathname.endsWith('/auth/oidc/start'))return respond(200,{success:true,data:{authorizationUrl:'https://provider.example/authorize'}});
      if(/\/auth\/(login|signup)$/.test(url.pathname))return respond(200,{success:true,data:{userId:actorId,email:'invited@example.test'}});
      if(url.pathname.endsWith('/verify-otp')){state.user={...verifiedUser};return respond(200,{success:true,data:{user:state.user}});}
      if(url.pathname.includes('/auth/'))return respond(200,{success:true});
      if(url.pathname.endsWith('/resolve')){
        if(state.resolveError)return fail(state.resolveError.code,state.resolveError.status);
        return respond(200,{success:true,invitation:{id,workspaceId,workspaceName:'Invited workspace',role:'MEMBER',expiresAt:'2030-01-01T00:00:00.000Z'}});
      }
      if(url.pathname.endsWith('/accept')){
        if(state.acceptGate)await state.acceptGate;
        if(state.acceptError){const error=state.acceptError;if(state.acceptOnce)state.acceptError=null;return fail(error.code,error.status);}
        return respond(200,{success:true,accepted:true,resourceId:workspaceId,invitationId:id});
      }
      if(url.pathname.endsWith('/tenant-workspaces/'+workspaceId))return respond(200,{success:true,workspace:{id:workspaceId,name:'Invited workspace',organizationName:'Fixture org',organizationId:id,userRole:'MEMBER',version:1,lifecycleStatus:'ACTIVE',members:[{id:actorId,userId:actorId,role:'MEMBER',user:{fullName:'Invited member'}}],websites:[],hasMoreWebsites:false}});
      return respond(200,{success:true,websites:[],workspaces:[]});
    });
    const page=await context.newPage();page.setDefaultTimeout(20000);
    const open=()=>page.goto(base+'/workspace-invitations/'+id+'#token='+token);
    return{state,requests,page,context,open};
  }
  async function signIn(page,mode='login'){
    if(mode==='signup'){await page.getByLabel('Full name',{exact:true}).fill('Invited member');await page.getByLabel('Confirm password',{exact:true}).fill('fixture-password-only');}
    await page.getByLabel('Email address',{exact:true}).fill('invited@example.test');await page.getByLabel('Password',{exact:true}).fill('fixture-password-only');
    await page.getByRole('button',{name:mode==='signup'?'Create your account':'Sign in to Forge',exact:true}).click();
    await page.getByLabel('Verification code',{exact:true}).fill('123456');await page.getByRole('button',{name:'Verify and sign in',exact:true}).click();
    await page.waitForURL('**/workspace-invitations/'+id);
    await expect(page.getByRole('button',{name:'Accept invitation',exact:true})).toBeVisible();
  }
  async function accepted(f){
    await f.page.getByRole('button',{name:'Accept invitation',exact:true}).click();
    await f.page.waitForURL('**/dashboard/workspaces/'+workspaceId);
    await expect(f.page.getByRole('heading',{name:'Workspace dashboard',exact:true})).toBeVisible();
    await expect(f.page.getByRole('heading',{name:'Invited workspace',exact:true})).toBeVisible();
    assert.equal(await f.page.evaluate(key=>sessionStorage.getItem(key),storageKey),null);
    for(const request of f.requests){assert.equal(request.search.includes(token),false);assert.equal(request.headers.authorization,undefined);}
  }
  await t.test('verified user resolves then explicitly accepts; secret is scrubbed and sent only in JSON',async()=>{
    const f=await fixture({user:verifiedUser});await f.open();
    await expect(f.page.getByRole('button',{name:'Accept invitation',exact:true})).toBeVisible();
    assert.equal(new URL(f.page.url()).hash,'');assert.equal(f.requests.filter(r=>r.path.endsWith('/accept')).length,0);
    assert.equal(f.requests.find(r=>r.path.endsWith('/resolve')).body.token,token);
    await accepted(f);const command=f.requests.find(r=>r.path.endsWith('/accept'));assert.equal(command.body.token,token);assert.ok(command.headers['idempotency-key']);
  });
  await t.test('a rapid double click submits one acceptance',async()=>{
    let release;const gate=new Promise(resolve=>{release=resolve;});
    const f=await fixture({user:verifiedUser,acceptGate:gate});await f.open();
    await f.page.getByRole('button',{name:'Accept invitation',exact:true}).evaluate(button=>{button.click();button.click();});
    await expect.poll(()=>f.requests.filter(r=>r.path.endsWith('/accept')).length).toBe(1);
    release();await f.page.waitForURL('**/dashboard/workspaces/'+workspaceId);
    assert.equal(f.requests.filter(r=>r.path.endsWith('/accept')).length,1);
  });
  await t.test('a renewed email link opened in the same tab replaces the old captured proof',async()=>{
    const f=await fixture({user:verifiedUser,resolveError:{code:'NOT_FOUND',status:404}});await f.open();
    await expect(f.page.getByRole('button',{name:'Use a different account',exact:true})).toBeVisible();
    f.state.resolveError=null;const renewedToken='b'.repeat(43);
    await f.page.goto(base+'/workspace-invitations/'+id+'#token='+renewedToken);
    await expect(f.page.getByRole('button',{name:'Accept invitation',exact:true})).toBeVisible();
    assert.equal(new URL(f.page.url()).hash,'');
    assert.equal(f.requests.filter(r=>r.path.endsWith('/resolve')).at(-1).body.token,renewedToken);
    await accepted(f);assert.equal(f.requests.find(r=>r.path.endsWith('/accept')).body.token,renewedToken);
  });
  await t.test('workspace acceptance also works for a verified account with an administrator global role',async()=>{
    const f=await fixture({user:{...verifiedUser,role:'ADMIN'}});await f.open();await accepted(f);
  });
  for(const mode of ['login','signup'])await t.test(`invite survives ${mode}, OTP and page reloads without putting its secret into auth requests`,async()=>{
    const f=await fixture();await f.open();await f.page.getByRole('button',{name:mode==='login'?'Sign in':'Create an account',exact:true}).click();
    await f.page.waitForURL('**/'+mode+'?workspaceInvite='+id);
    const other=f.page.getByRole('link',{name:mode==='login'?'Create an account':'Already have an account? Sign in',exact:true});
    assert.ok((await other.getAttribute('href')).includes('workspaceInvite='+id));
    await f.page.reload();await signIn(f.page,mode);
    assert.equal(f.requests.filter(r=>r.path.includes('/auth/')).some(r=>JSON.stringify(r.body).includes(token)),false);
    await accepted(f);
  });
  await t.test('managed sign-in resumes from the existing dashboard callback',async()=>{
    const f=await fixture({managed:true});await f.open();await f.page.getByRole('button',{name:'Sign in',exact:true}).click();
    await f.page.getByRole('button',{name:'Continue with identity provider',exact:true}).click();
    await f.page.waitForURL('**/workspace-invitations/'+id);await accepted(f);
  });
  await t.test('explicit local file delivery explains where to read the code and preserves invitation login',async()=>{
    const f=await fixture({localFile:true});await f.open();await f.page.getByRole('button',{name:'Sign in',exact:true}).click();
    await f.page.getByLabel('Email address',{exact:true}).fill('invited@example.test');await f.page.getByLabel('Password',{exact:true}).fill('fixture-password-only');
    await f.page.getByRole('button',{name:'Sign in to Forge',exact:true}).click();
    await expect(f.page.getByRole('heading',{name:'Your verification code',exact:true})).toBeVisible();
    await expect(f.page.getByText(/Open the configured local verification file/)).toBeVisible();
    await f.page.getByLabel('Verification code',{exact:true}).fill('123456');await f.page.getByRole('button',{name:'Verify and sign in',exact:true}).click();
    await expect(f.page.getByRole('button',{name:'Accept invitation',exact:true})).toBeVisible();
  });
  await t.test('wrong account can sign out and return with the correct account',async()=>{
    const f=await fixture({user:{...verifiedUser,email:'wrong@example.test'},resolveError:{status:404,code:'NOT_FOUND'}});await f.open();
    await expect(f.page.getByRole('alert')).toContainText('not available for this account');
    assert.equal(await f.page.getByRole('button',{name:'Accept invitation',exact:true}).count(),0);
    f.state.resolveError=null;await f.page.getByRole('button',{name:'Use a different account',exact:true}).click();await signIn(f.page);await accepted(f);
  });
  await t.test('unverified users cannot resolve or accept before verification',async()=>{
    const f=await fixture({user:{...verifiedUser,emailVerified:false}});await f.open();
    await expect(f.page.getByRole('alert')).toContainText('must be verified');
    assert.equal(f.requests.some(r=>r.path.endsWith('/resolve')||r.path.endsWith('/accept')),false);
  });
  await t.test('expired/revoked links are terminal and clear their stored secret',async()=>{
    const f=await fixture({user:verifiedUser,resolveError:{status:409,code:'INVITATION_UNAVAILABLE'}});await f.open();
    await expect(f.page.getByRole('alert')).toContainText('expired');assert.equal(await f.page.evaluate(key=>sessionStorage.getItem(key),storageKey),null);
    assert.equal(f.requests.some(r=>r.path.endsWith('/accept')),false);
  });
  await t.test('invalid fragment is scrubbed and never submitted',async()=>{
    const f=await fixture({user:verifiedUser});await f.page.goto(base+'/workspace-invitations/'+id+'#token=bad');
    await expect(f.page.getByRole('alert')).toContainText('missing or invalid');assert.equal(new URL(f.page.url()).hash,'');
    assert.equal(f.requests.some(r=>r.path.endsWith('/resolve')),false);
  });
  await t.test('acceptance 401 retains the proof and retry key through reauthentication',async()=>{
    const f=await fixture({user:verifiedUser,acceptError:{status:401,code:'UNAUTHORIZED'},acceptOnce:true});await f.open();
    await f.page.getByRole('button',{name:'Accept invitation',exact:true}).click();await f.page.getByRole('button',{name:'Sign in again',exact:true}).click();
    await signIn(f.page);await accepted(f);
    const calls=f.requests.filter(r=>r.path.endsWith('/accept'));assert.equal(calls.length,2);assert.equal(calls[0].headers['idempotency-key'],calls[1].headers['idempotency-key']);
  });
  await t.test('MFA errors offer reauthentication rather than accepting with insufficient assurance',async()=>{
    const f=await fixture({user:verifiedUser,resolveError:{status:403,code:'MFA_REQUIRED'}});await f.open();
    await expect(f.page.getByRole('alert')).toContainText('multi-factor');await expect(f.page.getByRole('button',{name:'Sign in again',exact:true})).toBeVisible();
    assert.equal(f.requests.some(r=>r.path.endsWith('/accept')),false);
  });
  await t.test('network failure retries with the same key; a reload can recover a lost acceptance response',async()=>{
    const f=await fixture({user:verifiedUser,acceptError:{status:503,code:'DEPENDENCY_UNAVAILABLE'},acceptOnce:true});await f.open();
    await f.page.getByRole('button',{name:'Accept invitation',exact:true}).click();await expect(f.page.getByRole('button',{name:'Try accepting again',exact:true})).toBeVisible();
    f.state.resolveError={status:409,code:'INVITATION_UNAVAILABLE'};await f.page.reload();
    await f.page.getByRole('button',{name:'Check acceptance',exact:true}).click();await f.page.waitForURL('**/dashboard/workspaces/'+workspaceId);
    const calls=f.requests.filter(r=>r.path.endsWith('/accept'));assert.equal(calls.length,2);assert.equal(calls[0].headers['idempotency-key'],calls[1].headers['idempotency-key']);
  });
  await t.test('blocked storage explains how to preserve the email link instead of silently losing it',async()=>{
    const f=await fixture({blockStorage:true});await f.open();await f.page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(f.page.getByRole('alert')).toContainText('Allow session storage');assert.ok(f.page.url().includes('/workspace-invitations/'));
  });
  await t.test('ordinary login still goes to the original dashboard',async()=>{
    const f=await fixture();await f.open();await f.page.getByRole('button',{name:'Sign in',exact:true}).click();
    await f.page.waitForURL('**/login?workspaceInvite='+id);await f.page.goto(base+'/login');
    await f.page.getByLabel('Email address',{exact:true}).fill('invited@example.test');await f.page.getByLabel('Password',{exact:true}).fill('fixture-password-only');
    await f.page.getByRole('button',{name:'Sign in to Forge',exact:true}).click();await f.page.getByLabel('Verification code',{exact:true}).fill('123456');await f.page.getByRole('button',{name:'Verify and sign in',exact:true}).click();
    await f.page.waitForURL(base+'/dashboard');
  });
});
