import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { chromium } from '@playwright/test';
import dotenv from '../../backend/node_modules/dotenv/lib/main.js';
import pg from '../../backend/node_modules/pg/lib/index.js';
import { startTestInbox, messageText } from '../fixtures/smtp-test-inbox.mjs';

const execute = promisify(execFile);
const enabled = process.env.FORGE_RUN_LIVE_MEMBERS === '1';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 25000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const result = await check(); if (result) return result; await delay(150); }
  throw new Error('Timed out: ' + label);
}
async function freePort() {
  const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve)); return port;
}

test('real Workspace Members journey: local PostgreSQL, browser, Express, SMTP and worker', { skip: !enabled, timeout: 480000 }, async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'forge-members-live-'));
  const databaseName = 'forge_members_e2e_' + randomBytes(8).toString('hex');
  const report = { database: databaseName, checks: [], externalMailSent: false, originalDataPreserved: false, cleanup: false };
  const secrets = new Set(), logs = [], children = [];
  let source, database, inbox, browser, prisma, pgPool, created = false, failure;
  const record = label => { report.checks.push(label); console.log('PASS: ' + label); };
  const redact = text => { let value = String(text); for (const secret of secrets) if (secret) value = value.split(secret).join('[redacted]'); return value; };
  const child = (args, env, cwd = 'backend') => {
    const process = spawn(globalThis.process.execPath, args, { cwd: path.resolve(cwd), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.on('data', data => logs.push(data.toString())); process.stderr.on('data', data => logs.push(data.toString()));
    children.push(process); return process;
  };
  async function stop(process) {
    if (process.exitCode !== null || process.signalCode !== null) return;
    const exited = new Promise(resolve => process.once('exit', resolve)); process.kill();
    await Promise.race([exited, delay(5000)]);
    if (process.exitCode === null && process.signalCode === null) throw new Error('Test process did not stop');
  }
  const sourceFingerprints = async () => {
    const result = {};
    for (const table of ['users', 'organizations', 'organization_members', 'workspaces', 'workspace_members', 'workspace_invitations', 'workspace_outbox', '_prisma_migrations']) {
      result[table] = (await source.query(`SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text),'')) AS digest FROM "${table}" t`)).rows[0];
    }
    return result;
  };
  let before;
  try {
    const config = dotenv.parse(await readFile('backend/.env', 'utf8'));
    const sourceUrl = new URL(config.DATABASE_URL); secrets.add(config.DATABASE_URL);
    assert.ok(['localhost', '127.0.0.1'].includes(sourceUrl.hostname), 'Only a local source database is allowed');
    assert.ok(!sourceUrl.pathname.includes('forge_members_e2e_'), 'Source must be the development database');
    source = new pg.Pool({ connectionString: config.DATABASE_URL, max: 1 }); before = await sourceFingerprints();
    const bin = process.env.FORGE_TEST_POSTGRES_BIN || 'C:/Program Files/PostgreSQL/18/bin';
    const pgEnv = { ...process.env, PGHOST: sourceUrl.hostname, PGPORT: sourceUrl.port || '5432', PGUSER: decodeURIComponent(sourceUrl.username), PGPASSWORD: decodeURIComponent(sourceUrl.password), PGDATABASE: sourceUrl.pathname.slice(1) };
    const schema = path.join(folder, 'schema.sql');
    await execute(path.join(bin, 'pg_dump.exe'), ['--schema-only', '--no-owner', '--no-privileges', '--file', schema], { env: pgEnv, windowsHide: true });
    assert.match(databaseName, /^forge_members_e2e_[a-f0-9]{16}$/);
    await source.query(`CREATE DATABASE "${databaseName}"`); created = true;
    const testUrl = new URL(sourceUrl); testUrl.pathname = '/' + databaseName;
    database = new pg.Pool({ connectionString: testUrl.toString(), max: 2 });
    await execute(path.join(bin, 'psql.exe'), ['-X', '--set', 'ON_ERROR_STOP=1', '--quiet', '--file', schema], { env: { ...pgEnv, PGDATABASE: databaseName }, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    assert.equal((await database.query('SELECT count(*)::int AS count FROM users')).rows[0].count, 0);
    record('Schema-only database copy contains no existing users or queued work');

    const key = path.join(folder, 'smtp.key'), cert = path.join(folder, 'smtp.crt');
    await execute(process.env.FORGE_TEST_OPENSSL || 'C:/Program Files/Git/usr/bin/openssl.exe', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { windowsHide: true });
    inbox = await startTestInbox({ key: await readFile(key), cert: await readFile(cert) });
    const frontPort = await freePort(), apiPort = await freePort(), base = `http://127.0.0.1:${frontPort}`, api = `http://127.0.0.1:${apiPort}`;
    await writeFile(path.join(folder, 'empty.env'), '');
    const signingKey = randomBytes(32).toString('hex'); secrets.add(signingKey);
    const env = { ...process.env, DOTENV_CONFIG_PATH: path.join(folder, 'empty.env'), NODE_ENV: 'test', FORGE_AUTH_MODE: 'local',
      DATABASE_URL: testUrl.toString(), PORT: String(apiPort), FRONTEND_URL: base, VITE_API_URL: api,
      WORKSPACE_INVITATION_TOKEN_KEY: signingKey, SMTP_HOST: 'localhost', SMTP_PORT: '2525', SMTP_USER: 'fixture', SMTP_PASSWORD: 'fixture', SMTP_FROM: 'forge@example.test',
      NODE_EXTRA_CA_CERTS: cert, FORGE_LOCAL_OTP_FILE: '', FORGE_ALLOW_MEMORY_JOB_FALLBACK: '0' };
    Object.assign(process.env, { DATABASE_URL: testUrl.toString(), DOTENV_CONFIG_PATH: env.DOTENV_CONFIG_PATH, NODE_ENV: 'test' });
    ({ prisma, pgPool } = await import('../../backend/dist/config/prisma.js'));
    const plan = await prisma.subscriptionPlan.create({ data: { name: 'Isolated test free plan', slug: 'free', price: 0, websiteLimit: 20, features: [], isActive: true } });
    const apiProcess = child(['dist/server.js'], env);
    await until(async () => { if (apiProcess.exitCode !== null) throw new Error('Backend exited before ready'); return fetch(api + '/api/v1/health').then(r => r.ok).catch(() => false); }, 'real backend startup', 60000);
    child([path.resolve('frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(frontPort), '--strictPort'], env, 'frontend');
    await until(() => fetch(base).then(r => r.ok).catch(() => false), 'real frontend startup');
    let worker = child(['dist/workers/main.js'], env);
    await until(() => logs.join('').includes('Worker ready.'), 'real background worker startup');
    const executablePath = [process.env.FORGE_CHROME_PATH, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
    browser = await chromium.launch({ executablePath, headless: true });
    const contexts = [];
    async function page() {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
      // No local API mocking. Block only external traffic (fonts/analytics/etc.).
      await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      const result = await context.newPage(); result.setDefaultTimeout(30000); result.setDefaultNavigationTimeout(60000); return result;
    }
    const password = 'Isolated test ' + randomBytes(18).toString('hex'); secrets.add(password);
    const mail = (email, start, pattern) => until(() => inbox.messages.slice(start).filter(m => m.recipient === email).map(m => ({ message: m, text: messageText(m) })).find(m => pattern.test(m.text)), 'SMTP message captured');
    async function authenticate(page, email, mode, name = 'Safe test account') {
      const start = inbox.messages.length;
      await page.getByLabel('Email address', { exact: true }).fill(email);
      await page.getByLabel('Password', { exact: true }).fill(password);
      if (mode === 'signup') { await page.getByLabel('Full name', { exact: true }).fill(name); await page.getByLabel('Confirm password', { exact: true }).fill(password); }
      await page.getByRole('button', { name: mode === 'signup' ? 'Create your account' : 'Sign in', exact: mode === 'signup' }).click();
      const message = await mail(email, start, /code is \d{6}/);
      assert.ok(message.message.secure && message.message.authenticated, 'OTP must use authenticated TLS SMTP');
      const code = message.text.match(/code is (\d{6})/)[1]; secrets.add(code);
      await page.getByRole('heading', { name: 'Check your email', exact: true }).waitFor();
      await page.locator('input[inputmode="numeric"]').fill(code);
      await page.getByRole('button', { name: 'Verify and sign in', exact: true }).click();
      await page.waitForURL(url => !url.pathname.startsWith('/signup') && !url.pathname.startsWith('/login'));
      const user = await prisma.user.findUnique({ where: { email } }); assert.ok(user?.emailVerified, 'Real OTP must verify account email'); return user;
    }
    async function request(page, suffix, options = {}) {
      return page.context().request.fetch(api + '/api/v1/tenant-workspaces' + suffix, { ...options, headers: { Origin: base, 'Content-Type': 'application/json', 'X-Forge-Intent': 'workspace-command', 'Idempotency-Key': randomUUID(), ...options.headers } });
    }
    const ownerPage = await page(); await ownerPage.goto(base + '/signup');
    const ownerEmail = 'owner@example.test', owner = await authenticate(ownerPage, ownerEmail, 'signup', 'E2E Workspace owner');
    await prisma.userSubscription.create({ data: { userId: owner.id, planId: plan.id, status: 'ACTIVE' } });
    const createdResponse = await request(ownerPage, '', { method: 'POST', data: { name: 'Isolated E2E workspace' } });
    assert.ok(createdResponse.ok(), 'Workspace creation must succeed'); const workspace = (await createdResponse.json()).workspace;
    await ownerPage.goto(base + '/dashboard'); await ownerPage.getByRole('button', { name: 'Members', exact: true }).click();
    await ownerPage.getByRole('table', { name: 'Workspace members' }).waitFor();
    record('Owner signs up through real SMTP OTP and opens the real Members page');
    const invitationRow = email => prisma.workspaceInvitation.findFirst({ where: { workspaceId: workspace.id, invitedEmail: email }, orderBy: { createdAt: 'desc' } });
    const countMemberships = userId => prisma.workspaceMember.count({ where: { workspaceId: workspace.id, userId } });
    async function invite(email, role = 'MEMBER') {
      await ownerPage.locator('.members-toolbar').getByRole('button', { name: 'Invite member', exact: true }).click();
      const modal = ownerPage.getByRole('dialog', { name: 'Invite a member' });
      await modal.getByLabel('Email address', { exact: true }).fill(email); await modal.getByLabel('Role', { exact: true }).selectOption(role);
      const start = inbox.messages.length; await modal.getByRole('button', { name: 'Send invite', exact: true }).click();
      await modal.waitFor({ state: 'hidden' });
      const captured = await mail(email, start, /workspace-invitations/);
      assert.ok(captured.message.secure && captured.message.authenticated, 'Invitation must use authenticated TLS SMTP');
      const link = captured.text.match(/http:\/\/[^\s]+\/workspace-invitations\/[^\s]+/)[0];
      secrets.add(link); secrets.add(new URL(link).hash.slice(7));
      const row = await until(async () => { const row = await invitationRow(email); return row?.emailStatus === 'SENT' && row; }, 'worker marks invitation SENT');
      return { row, link };
    }
    const newcomerEmail = 'new-member@example.test', newcomerInvite = await invite(newcomerEmail);
    assert.equal(await prisma.user.count({ where: { email: newcomerEmail } }), 0);
    assert.equal(await prisma.workspaceMember.count({ where: { workspaceId: workspace.id } }), 1);
    assert.ok(newcomerInvite.row.tokenHash && !JSON.stringify(newcomerInvite.row).includes(new URL(newcomerInvite.link).hash.slice(7)), 'Only invitation proof hash is stored');
    record('Invite queues durable work; real worker sends TLS SMTP email; no account or membership is granted early');
    const newPage = await page(); await newPage.goto(newcomerInvite.link);
    await newPage.getByRole('button', { name: 'Create an account', exact: true }).click();
    const newcomer = await authenticate(newPage, newcomerEmail, 'signup', 'E2E New member');
    assert.equal(await countMemberships(newcomer.id), 0);
    await newPage.getByRole('button', { name: 'Accept invitation', exact: true }).click();
    await newPage.waitForURL(url => url.pathname === '/dashboard/workspaces/' + workspace.id);
    assert.equal(await countMemberships(newcomer.id), 1); assert.equal((await invitationRow(newcomerEmail)).status, 'ACCEPTED');
    await ownerPage.bringToFront(); await ownerPage.evaluate(() => window.dispatchEvent(new Event('focus')));
    await ownerPage.getByRole('table', { name: 'Workspace members' }).getByText(newcomerEmail, { exact: true }).waitFor();
    assert.equal((await prisma.workspaceMember.findFirst({ where: { workspaceId: workspace.id, userId: newcomer.id } })).role, 'MEMBER');
    const activeDetails = (await (await request(ownerPage, '/' + workspace.id)).json()).workspace.members.find(member => member.userId === newcomer.id);
    assert.equal(activeDetails.membershipStatus, 'ACTIVE'); assert.equal(activeDetails.user.email, newcomerEmail);
    record('New recipient preserves email link through signup/OTP, accepts, becomes ACTIVE, and appears on owner page');

    const { hashPassword } = await import('../../backend/dist/utils/password.js');
    const registeredEmail = 'registered@example.test';
    const registered = await prisma.user.create({ data: { email: registeredEmail, fullName: 'E2E Registered admin', passwordHash: await hashPassword(password), role: 'USER', status: 'ACTIVE', emailVerified: true } });
    const registeredInvite = await invite(registeredEmail, 'ADMIN'); assert.equal(await countMemberships(registered.id), 0);
    const registeredPage = await page(); await registeredPage.goto(registeredInvite.link); await registeredPage.getByRole('button', { name: 'Sign in', exact: true }).click();
    await authenticate(registeredPage, registeredEmail, 'login');
    await registeredPage.getByRole('button', { name: 'Accept invitation', exact: true }).click(); await registeredPage.waitForURL(url => url.pathname === '/dashboard/workspaces/' + workspace.id);
    assert.equal((await prisma.workspaceMember.findFirst({ where: { workspaceId: workspace.id, userId: registered.id } })).role, 'ADMIN');
    record('Registered recipient logs in with real SMTP OTP and accepts the correct ADMIN role');

    const duplicate = await request(ownerPage, '/' + workspace.id + '/invitations', { method: 'POST', data: { email: registeredEmail, role: 'MEMBER' } }); assert.equal(duplicate.status(), 409);
    const replay = await request(newPage, `/${workspace.id}/invitations/${newcomerInvite.row.id}/accept`, { method: 'POST', data: { token: new URL(newcomerInvite.link).hash.slice(7) } }); assert.equal(replay.status(), 409); assert.equal(await countMemberships(newcomer.id), 1);
    const forbidden = await request(newPage, '/' + workspace.id + '/invitations', { method: 'POST', data: { email: 'forbidden@example.test', role: 'ADMIN' } }); assert.equal(forbidden.status(), 403);
    record('Duplicate membership, invitation replay, and member privilege escalation are rejected');

    const renewEmail = 'renew@example.test', renewable = await invite(renewEmail);
    const duplicateInvite = await request(ownerPage, '/' + workspace.id + '/invitations', { method: 'POST', data: { email: renewEmail, role: 'MEMBER' } }); assert.equal(duplicateInvite.status(), 409);
    const wrong = await request(newPage, `/invitations/${renewable.row.id}/resolve`, { method: 'POST', data: { token: new URL(renewable.link).hash.slice(7) } }); assert.equal(wrong.status(), 404);
    const cooldown = await request(ownerPage, `/${workspace.id}/invitations/${renewable.row.id}/renew`, { method: 'POST', headers: { 'If-Match': `"${renewable.row.id}:${renewable.row.version}"` }, data: {} }); assert.equal(cooldown.status(), 429);
    record('Duplicate pending invites, wrong accounts and resend cooldown are enforced by real APIs');
    // Only this disposable test invitation is aged; production wait is not bypassed.
    await prisma.workspaceInvitation.update({ where: { id: renewable.row.id }, data: { emailQueuedAt: new Date(Date.now() - 61000) } });
    await ownerPage.getByRole('button', { name: 'Refresh members', exact: true }).click();
    const start = inbox.messages.length;
    await ownerPage.getByRole('button', { name: 'Resend invitation to ' + renewEmail, exact: true }).click();
    const renewedMail = await mail(renewEmail, start, /workspace-invitations/), renewedLink = renewedMail.text.match(/http:\/\/[^\s]+\/workspace-invitations\/[^\s]+/)[0]; secrets.add(renewedLink); secrets.add(new URL(renewedLink).hash.slice(7));
    assert.notEqual(renewedLink, renewable.link);
    const renewed = await until(async () => { const row = await invitationRow(renewEmail); return row.version === 2 && row.emailStatus === 'SENT' && row; }, 'renewed email delivery');
    const renewUser = await prisma.user.create({ data: { email: renewEmail, fullName: 'E2E Renew member', passwordHash: await hashPassword(password), role: 'USER', status: 'ACTIVE', emailVerified: true } });
    const renewPage = await page(); await renewPage.goto(renewable.link); await renewPage.getByRole('button', { name: 'Sign in', exact: true }).click(); await authenticate(renewPage, renewEmail, 'login');
    await until(() => renewPage.getByRole('button', { name: 'Use a different account', exact: true }).count(), 'old token rejected'); assert.equal(await countMemberships(renewUser.id), 0);
    await renewPage.goto(renewedLink); await renewPage.getByRole('button', { name: 'Accept invitation', exact: true }).waitFor();
    await ownerPage.getByRole('button', { name: 'Revoke invitation to ' + renewEmail, exact: true }).click();
    await renewPage.getByRole('button', { name: 'Accept invitation', exact: true }).click();
    await until(() => renewPage.getByRole('alert').count(), 'revoked link rejected'); assert.equal(await countMemberships(renewUser.id), 0);
    assert.equal((await invitationRow(renewEmail)).status, 'REVOKED');
    record('UI resend delivers a new link, invalidates old proof; UI revoke blocks acceptance and creates no membership');

    const expired = await invite('expired@example.test');
    await prisma.workspaceInvitation.update({ where: { id: expired.row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expiredUser = await prisma.user.create({ data: { email: 'expired@example.test', fullName: 'E2E Expired', passwordHash: await hashPassword(password), role: 'USER', status: 'ACTIVE', emailVerified: true } });
    const expiredPage = await page(); await expiredPage.goto(expired.link); await expiredPage.getByRole('button', { name: 'Sign in', exact: true }).click(); await authenticate(expiredPage, 'expired@example.test', 'login');
    await until(() => expiredPage.getByRole('alert').count(), 'expired link rejected'); assert.equal(await countMemberships(expiredUser.id), 0);
    record('Expired invitation is rejected after real login without granting membership');

    await stop(worker);
    const queuedResponse = await request(ownerPage, '/' + workspace.id + '/invitations', { method: 'POST', data: { email: 'retry@example.test', role: 'MEMBER' } }); assert.ok(queuedResponse.ok());
    const retry = await invitationRow('retry@example.test'); assert.equal(retry.emailStatus, 'QUEUED');
    inbox.failNext(); worker = child(['dist/workers/main.js'], env);
    await until(async () => (await prisma.workspaceOutbox.findFirst({ where: { resourceId: retry.id, operation: 'WORKSPACE_INVITATION_EMAIL' } }))?.lastError === 'INVITATION_EMAIL_DELIVERY_FAILED', 'SMTP failure recorded');
    assert.equal((await invitationRow('retry@example.test')).emailStatus, 'QUEUED');
    await until(async () => (await invitationRow('retry@example.test')).emailStatus === 'SENT', 'worker retries SMTP with backoff', 50000);
    assert.equal(inbox.messages.filter(m => m.recipient === 'retry@example.test').length, 1);
    record('Worker restart preserves queued invitation; temporary SMTP failure retries after real backoff and delivers');

    await prisma.session.updateMany({ where: { userId: owner.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await ownerPage.getByRole('button', { name: 'Refresh members', exact: true }).click(); await ownerPage.getByRole('link', { name: 'Sign in again', exact: true }).waitFor();
    assert.equal(await ownerPage.getByRole('table', { name: 'Workspace members' }).count(), 0);
    record('Expired real cookie session clears protected Members data and offers sign-in');
    assert.ok(inbox.messages.every(m => m.recipient.endsWith('@example.test') && m.secure && m.authenticated));
    const combinedLogs = logs.join(''); for (const secret of secrets) assert.ok(!combinedLogs.includes(secret), 'Service logs must not contain passwords, OTPs, invitation proofs or signing keys');
    assert.equal(await prisma.auditLog.count({ where: { action: 'IDENTITY_CODE_ACCEPTED_BY_DEV_FALLBACK' } }), 0);
    record('All mail stayed in authenticated local TLS inbox; no OTP fallback or secrets in service logs');
  } catch (error) {
    failure = new Error(redact(error?.stack || error));
    if (database) {
      report.diagnostics = {
        invitations: await database.query('SELECT role,status,"emailStatus",version FROM workspace_invitations').then(r => r.rows).catch(() => []),
        delivery: await database.query('SELECT operation,attempts,"lastError",("dispatchedAt" IS NOT NULL) AS dispatched,("lockedUntil">now()) AS leased FROM workspace_outbox WHERE operation=\'WORKSPACE_INVITATION_EMAIL\'').then(r => r.rows).catch(() => []),
        capturedMessages: inbox?.messages.length || 0,
        dispatchErrors: logs.filter(line => line.includes('workspace-invitation-email-dispatch-failed')).length,
        processExitCodes: children.map(process => process.exitCode),
        browserStates: browser ? await Promise.all(browser.contexts().flatMap(context => context.pages()).map(async page => ({
          path: new URL(page.url()).pathname,
          alerts: (await page.getByRole('alert').allTextContents()).map(redact),
        }))) : [],
      };
      console.log('Safe failure diagnostics: ' + JSON.stringify(report.diagnostics));
    }
  }
  finally {
    try {
      await browser?.close();
      const stopped = await Promise.allSettled(children.reverse().map(stop));
      await inbox?.close(); await prisma?.$disconnect(); await pgPool?.end(); await database?.end();
      if (created) {
        assert.match(databaseName, /^forge_members_e2e_[a-f0-9]{16}$/);
        await source.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [databaseName]);
        await source.query(`DROP DATABASE "${databaseName}"`);
      }
      if (source && before) { assert.deepEqual(await sourceFingerprints(), before, 'Original development data changed'); report.originalDataPreserved = true; }
      report.cleanup = stopped.every(result => result.status === 'fulfilled');
      if (!report.cleanup) throw new Error('A test child process did not stop');
    } catch (error) { failure ??= new Error(redact(error?.stack || error)); }
    finally {
      await source?.end();
      const resolved = path.resolve(folder); assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep + 'forge-members-live-'));
      await rm(resolved, { recursive: true, force: true });
      await mkdir('.data/workspace-members-live', { recursive: true });
      await writeFile('.data/workspace-members-live/report.json', JSON.stringify({ ...report, passed: !failure }, null, 2));
    }
  }
  if (failure) throw failure;
});
