import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const snapshot=()=>({success:true,scope:'owned_sites',generatedAt:'2026-10-23T12:00:00Z',issues:[],
  subscription:{status:'ACTIVE',planName:'Team',currentPeriodStart:'2026-10-01T00:00:00Z',currentPeriodEnd:'2026-11-01T00:00:00Z',billingInterval:'monthly'},
  range:{key:'cycle',start:'2026-10-01T00:00:00Z',end:'2026-10-23T12:00:00Z'},
  websites:{used:7,limit:12},storage:{usedBytes:1572864,limitMb:900},optimization:{balance:83,performed:17},licensing:{activeLicenses:2,production:5,development:3},
  credits:{status:'NOT_METERED',allowance:713,used:null,remaining:null,message:'Monthly AI credit balance is not metered. Activity below shows recorded execution units, not billed credits.'},
  activity:{units:19,executions:4,unit:'execution units',source:'completed_ai_executions',daily:[{date:'2026-10-02',units:7,executions:2},{date:'2026-10-21',units:12,executions:2}],breakdown:[
    {websiteId:'a',websiteName:'Academy',userId:'u1',userName:'Morgan',units:7,executions:2},
    {websiteId:'b',websiteName:'Portfolio',userId:'u2',userName:'Taylor',units:12,executions:2},
  ]},
});
test('Usage dashboard browser interactions (mock HTTP)',{timeout:180000},async t=>{
  const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const base=`http://127.0.0.1:${port}`;
  const vite=spawn(process.execPath,[path.resolve('frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:path.resolve('frontend'),windowsHide:true,env:{...process.env,VITE_API_URL:base},stdio:['ignore','pipe','pipe']});
  t.after(()=>vite.kill());
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite startup timeout')),20000);vite.once('error',reject);vite.stdout.on('data',data=>{if(String(data).includes('Local:')){clearTimeout(timer);resolve();}});});
  const executablePath=[process.env.FORGE_CHROME_PATH,chromium.executablePath(),'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&existsSync(p));
  const browser=await chromium.launch({headless:true,executablePath});t.after(()=>browser.close());
  async function fixture(options={}){
    const state={data:snapshot(),status:200,gate:null,...options};const requests=[];
    const context=await browser.newContext({viewport:{width:1440,height:1100}});t.after(()=>context.close());
    await context.route('**/api/**',async route=>{
      const request=route.request();const url=new URL(request.url());
      const respond=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
      if(url.pathname.endsWith('/auth/me'))return respond(200,{success:true,data:{user:{id:'owner',fullName:'Account owner',email:'owner@example.test',role:'USER',status:'ACTIVE',emailVerified:true}}});
      if(url.pathname.endsWith('/usage/dashboard')){
        requests.push({range:url.searchParams.get('range'),credentials:request.headers().cookie});
        const gate=state.gate;const data=structuredClone(state.data);const status=state.status;
        if(gate)await gate;
        return respond(status,data).catch(()=>{});
      }
      if(url.pathname==='/api/v1/tenant-workspaces')return respond(200,{success:true,workspaces:[]});
      return respond(200,{success:true,websites:[]});
    });
    const page=await context.newPage();page.setDefaultTimeout(10000);
    const open=async()=>{await page.goto(base+'/dashboard');await page.getByRole('button',{name:'Usage',exact:true}).click();};
    return{page,state,requests,open};
  }
  await t.test('real response values, chart, filters and plan navigation; shared shell stays consistent',async()=>{
    const f=await fixture();await f.open();const page=f.page;
    await expect(page.getByRole('heading',{name:'Site Usage',exact:true})).toBeVisible();
    await expect(page.locator('.usage-quotas')).toContainText('7 / 12');await expect(page.locator('.usage-quotas')).toContainText('1.5 MB');
    await expect(page.locator('.usage-quotas')).toContainText('83');await expect(page.locator('.usage-quotas')).toContainText('17 optimizations performed');
    await expect(page.getByRole('progressbar',{name:'Website slots used'})).toHaveAttribute('value',String(7/12*100));
    await expect(page.locator('.usage-credit-panel')).toContainText('713 AI credits');await expect(page.locator('.usage-credit-panel')).toContainText('Balance unavailable');
    await expect(page.getByRole('img',{name:'AI activity: 19 execution units across 4 completed operations'})).toBeVisible();
    assert.equal(await page.locator('.usage-chart rect').evaluateAll(nodes=>nodes.filter(node=>Number(node.getAttribute('height'))>0).length),2);
    await page.getByRole('button',{name:'View details'}).click();await expect(page.getByRole('table')).toContainText('Morgan');
    await page.getByLabel('Filter usage by site').selectOption('a');await expect(page.getByRole('table')).toContainText('Academy');await expect(page.getByRole('table')).not.toContainText('Portfolio');
    await page.getByLabel('Filter usage by user').selectOption('u2');await expect(page.getByText('No activity matches these filters.')).toBeVisible();
    mkdirSync('artifacts/usage',{recursive:true});await page.screenshot({path:'artifacts/usage/desktop.png',fullPage:true});
    await page.getByLabel('Usage date range').selectOption('30d');await expect(page.getByLabel('Filter usage by site')).toHaveValue('');await expect.poll(()=>f.requests.at(-1).range).toBe('30d');
    await page.getByRole('button',{name:'Refresh usage'}).click();await expect.poll(()=>f.requests.length).toBeGreaterThanOrEqual(3);
    await page.getByRole('button',{name:'Sites',exact:true}).click();await expect(page.getByRole('heading',{name:'All sites',exact:true,level:1})).toBeVisible();
    await expect(page.locator('.usage-page')).toHaveCount(0);await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Usage',exact:true}).click();await page.getByRole('link',{name:'Manage plan'}).click();await expect(page).toHaveURL(/\/subscriptions$/);
  });
  await t.test('loading and empty states are honest, responsive, and retain zero quotas',async()=>{
    let release;const gate=new Promise(resolve=>{release=resolve;});const data=snapshot();data.websites.used=0;data.optimization.balance=0;
    data.activity={...data.activity,units:0,executions:0,daily:[],breakdown:[]};const f=await fixture({data,gate});await f.open();
    await expect(f.page.getByRole('status')).toContainText('Loading account usage');release();
    await expect(f.page.locator('.usage-page')).toContainText('0 / 12');await expect(f.page.locator('.usage-chart-panel')).toContainText('No credit activity to display');
    assert.equal(await f.page.locator('.usage-chart rect').evaluateAll(nodes=>nodes.some(node=>Number(node.getAttribute('height'))>0)),false);
    await f.page.setViewportSize({width:390,height:844});await expect(f.page.getByRole('heading',{name:'Site Usage',exact:true})).toBeVisible();
    assert.equal(await f.page.locator('.studio-main').evaluate(el=>el.scrollWidth>el.clientWidth),false);
    assert.equal(await f.page.locator('.usage-quotas').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
    await f.page.screenshot({path:'artifacts/usage/mobile.png',fullPage:true});
  });
  await t.test('partial data does not show invented zero storage; retry recovers',async()=>{
    const data=snapshot();data.issues=['Storage usage is unavailable.'];data.storage.usedBytes=null;data.activity=null;
    const f=await fixture({data});await f.open();await expect(f.page.getByRole('alert')).toContainText('Storage usage is unavailable.');
    await expect(f.page.locator('.usage-quota').filter({hasText:'Storage Used'})).toContainText('Unavailable');
    await expect(f.page.getByRole('progressbar',{name:'Storage used'})).toHaveCount(0);
    f.state.data=snapshot();await f.page.getByRole('button',{name:'Try again',exact:true}).click();await expect(f.page.getByRole('alert')).toHaveCount(0);
    await expect(f.page.locator('.usage-quota').filter({hasText:'Storage Used'})).toContainText('1.5 MB');
  });
  await t.test('HTTP failure and expired session clear stale metrics with recovery actions',async()=>{
    const f=await fixture({status:503,data:{success:false,message:'Usage unavailable'}});await f.open();
    await expect(f.page.getByRole('alert')).toContainText('Usage unavailable');await expect(f.page.locator('.usage-quotas')).toHaveCount(0);
    f.state.status=200;f.state.data=snapshot();await f.page.getByRole('button',{name:'Try again'}).click();await expect(f.page.locator('.usage-quotas')).toBeVisible();
    f.state.status=401;f.state.data={success:false};await f.page.getByRole('button',{name:'Refresh usage'}).click();
    await expect(f.page.getByRole('alert')).toContainText('session has expired');await expect(f.page.getByRole('link',{name:'Sign in',exact:true})).toHaveAttribute('href','/login');await expect(f.page.locator('.usage-quotas')).toHaveCount(0);
  });
  await t.test('rapid date range changes cannot replace a newer response with stale activity',async()=>{
    const f=await fixture();await f.open();await expect(f.page.locator('.usage-quotas')).toBeVisible();
    let release;f.state.gate=new Promise(resolve=>{release=resolve;});await f.page.getByLabel('Usage date range').selectOption('30d');await expect.poll(()=>f.requests.at(-1).range).toBe('30d');
    f.state.gate=null;f.state.data.activity.units=91;f.state.data.activity.daily=[{date:'2026-10-21',units:91,executions:4}];
    await f.page.getByLabel('Usage date range').selectOption('90d');await expect(f.page.getByRole('img',{name:/AI activity: 91/})).toBeVisible();release();
    await expect(f.page.getByRole('img',{name:/AI activity: 91/})).toBeVisible();await expect(f.page.getByLabel('Usage date range')).toHaveValue('90d');
  });
});
