import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from '../../backend/node_modules/pg/lib/index.js';

const execute = promisify(execFile);
const migrationPath = 'backend/prisma/migrations/20261022100000_workspace_email_invitations/migration.sql';
const bin = process.env.FORGE_TEST_POSTGRES_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '/usr/lib/postgresql/18/bin');
const command = name => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
// pg_ctl's daemon can inherit execFile's pipes on Windows and keep them open
// after pg_ctl exits. Ignore stdio and wait for exit rather than pipe closure.
function control(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command('pg_ctl'), args, { windowsHide: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Temporary PostgreSQL control failed (${code})`)));
  });
}

test('email invitations on isolated PostgreSQL, including real migrations and restricted-role RLS', { timeout: 120000 }, async t => {
  // Never read DATABASE_URL. Start a fresh loopback-only server in an owned temp directory.
  const folder = await mkdtemp(path.join(tmpdir(), 'forge-invitation-test-'));
  const data = path.join(folder, 'data');
  let started = false; let database; let prisma; let pgPool;
  t.after(async () => {
    await prisma?.$disconnect(); await pgPool?.end(); await database?.end();
    if (started) await control(['-D', data, '-m', 'immediate', '-w', 'stop']);
    const resolved = path.resolve(folder);
    assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep + 'forge-invitation-test-'));
    await rm(resolved, { recursive: true, force: true });
  });
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  await execute(command('initdb'), ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8'], { windowsHide: true });
  await control(['-D', data, '-l', path.join(folder, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -F`, '-w', 'start']);
  started = true;
  database = new pg.Pool({ connectionString: `postgresql://postgres@127.0.0.1:${port}/postgres`, max: 1 });
  await database.query(await readFile('tests/fixtures/workspace-email-base.sql', 'utf8'));
  for (const migration of ['20260928090000_workspace_command_journal', '20260928122000_workspace_lifecycle'])
    await database.query(await readFile(`backend/prisma/migrations/${migration}/migration.sql`, 'utf8'));
  const foundations = await readFile('backend/prisma/migrations/20260929013000_saas_production_foundations/migration.sql', 'utf8');
  await database.query(foundations.slice(foundations.indexOf('CREATE OR REPLACE FUNCTION forge_actor_uuid()'), foundations.indexOf('ALTER TABLE websites ENABLE ROW LEVEL SECURITY;')));
  const owner = randomUUID(), admin = randomUUID(), member = randomUUID(), registered = randomUUID(), organization = randomUUID(), workspace = randomUUID();
  for (const [id, email] of [[owner,'owner@example.test'],[admin,'admin@example.test'],[member,'member@example.test'],[registered,'registered@example.test']])
    await database.query('INSERT INTO users(id,email,"emailVerified") VALUES($1,$2,true)', [id,email]);
  await database.query('INSERT INTO organizations(id,name,slug,"ownerId") VALUES($1,\'Test\',\'test\',$2)', [organization,owner]);
  await database.query('BEGIN');
  await database.query('INSERT INTO workspaces(id,"organizationId","ownerId",name,slug) VALUES($1,$2,$3,\'Test\',\'test\')', [workspace,organization,owner]);
  for (const [id,role] of [[owner,'OWNER'],[admin,'ADMIN'],[member,'MEMBER']]) {
    await database.query('INSERT INTO organization_members(id,"organizationId","userId",role) VALUES($1,$2,$3,$4)', [randomUUID(),organization,id,role]);
    await database.query('INSERT INTO workspace_members(id,"workspaceId","userId",role) VALUES($1,$2,$3,$4)', [randomUUID(),workspace,id,role]);
  }
  await database.query('COMMIT');
  const legacyId = randomUUID();
  await database.query('INSERT INTO workspace_invitations(id,"organizationId","workspaceId","recipientUserId","invitedBy",role,"expiresAt") VALUES($1,$2,$3,$4,$5,\'MEMBER\',now()+interval \'7 days\')', [legacyId,organization,workspace,registered,owner]);
  const caseVariant = randomUUID(), duplicate = randomUUID();
  await database.query('INSERT INTO users(id,email,"emailVerified") VALUES($1,\'REGISTERED@example.test\',true)', [caseVariant]);
  await database.query('INSERT INTO workspace_invitations(id,"organizationId","workspaceId","recipientUserId","invitedBy",role,"expiresAt") VALUES($1,$2,$3,$4,$5,\'MEMBER\',now()+interval \'7 days\')', [duplicate,organization,workspace,caseVariant,owner]);
  await assert.rejects(database.query(await readFile(migrationPath, 'utf8')), /Resolve duplicate pending/);
  await database.query('ROLLBACK');
  assert.equal((await database.query("SELECT count(*) FROM information_schema.columns WHERE table_name='workspace_invitations' AND column_name='invitedEmail'")).rows[0].count,'0');
  await database.query('UPDATE workspace_invitations SET status=\'REVOKED\' WHERE id=$1',[duplicate]);
  // A legacy development database can have lifecycle tables without SaaS
  // foundations. Keep policy dependencies intact while testing the missing helper.
  await database.query('ALTER FUNCTION forge_actor_uuid() RENAME TO fixture_original_actor_uuid');
  await database.query(await readFile(migrationPath, 'utf8'));
  assert.ok((await database.query("SELECT to_regprocedure('public.forge_actor_uuid()') AS helper")).rows[0].helper);
  const legacy = (await database.query('SELECT * FROM workspace_invitations WHERE id=$1', [legacyId])).rows[0];
  assert.equal(legacy.invitedEmail, 'registered@example.test'); assert.equal(legacy.tokenHash, null);
  await database.query('CREATE ROLE invitation_app LOGIN NOSUPERUSER NOBYPASSRLS; GRANT USAGE ON SCHEMA public TO invitation_app; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO invitation_app');
  process.env.DATABASE_URL = `postgresql://invitation_app@127.0.0.1:${port}/postgres`;
  process.env.NODE_ENV = 'test'; process.env.FRONTEND_URL = 'https://forge.example';
  process.env.WORKSPACE_INVITATION_TOKEN_KEY = 'ab'.repeat(32);
  Object.assign(process.env, { SMTP_HOST: 'unused.example.test', SMTP_PORT: '587', SMTP_USER: 'fixture', SMTP_PASSWORD: 'fixture', SMTP_FROM: 'forge@example.test' });
  ({ prisma, pgPool } = await import('../../backend/dist/config/prisma.js'));
  const api = await import('../../backend/dist/services/workspaces/invitation.service.js');
  const tokens = await import('../../backend/dist/services/workspaces/invitation-token.js');
  const delivery = await import('../../backend/dist/services/workspaces/invitation-delivery.service.js');
  const create = (email, actor = owner, role = 'MEMBER', key = randomUUID()) => api.inviteWorkspaceMemberByEmail(actor, workspace, email, role, key);
  const row = async id => (await database.query('SELECT * FROM workspace_invitations WHERE id=$1', [id])).rows[0];
  const membershipCount = async id => Number((await database.query('SELECT count(*) FROM workspace_members WHERE "workspaceId"=$1 AND "userId"=$2', [workspace,id])).rows[0].count);
  const orgCount = async id => Number((await database.query('SELECT count(*) FROM organization_members WHERE "organizationId"=$1 AND "userId"=$2', [organization,id])).rows[0].count);

  await t.test('legacy acceptance stays compatible; membership is granted only on acceptance', async () => {
    assert.equal(await orgCount(registered),0);
    await api.acceptWorkspaceInvitation(registered,workspace,legacyId,randomUUID());
    assert.equal(await orgCount(registered),1); assert.equal(await membershipCount(registered),1);
    assert.equal((await row(legacyId)).status,'ACCEPTED');
  });
  await t.test('existing frontend user-ID invitations never auto-join an organization', async () => {
    const id = randomUUID(); await database.query('INSERT INTO users(id,email,"emailVerified") VALUES($1,\'legacy-new@example.test\',true)', [id]);
    const result = await api.inviteWorkspaceMember(owner,workspace,id,'MEMBER',randomUUID());
    assert.equal(result.delivery,'IN_APP'); assert.equal(await orgCount(id),0); assert.equal(await membershipCount(id),0);
    await api.acceptWorkspaceInvitation(id,workspace,result.invitation.id,randomUUID());
    assert.equal(await membershipCount(id),1);
  });
  await t.test('new-email creation is normalized, transactional, secret-free and idempotent', async () => {
    const key = randomUUID(); const created = await create(' New@Example.Test ',owner,'MEMBER',key);
    assert.equal(created.invitation.invitedEmail,'new@example.test'); assert.equal(created.invitation.recipientUserId,null);
    assert.equal(created.delivery,'QUEUED'); assert.equal('tokenHash' in created.invitation,false);
    assert.deepEqual(await create('new@example.test',owner,'MEMBER',key),created);
    const stored = await row(created.invitation.id);
    assert.ok(tokens.matchesInvitationToken(tokens.invitationToken(stored.id,1),stored.tokenHash));
    const outbox = (await database.query('SELECT * FROM workspace_outbox WHERE "resourceId"=$1 AND operation=\'WORKSPACE_INVITATION_EMAIL\'', [stored.id])).rows;
    assert.equal(outbox.length,1); assert.deepEqual(outbox[0].payload,{invitationId:stored.id,version:1});
    assert.equal(JSON.stringify(outbox).includes(tokens.invitationToken(stored.id,1)),false);
    await assert.rejects(create('NEW@example.test'),{code:'INVITATION_EXISTS'});
  });
  await t.test('registered recipients can be unverified when invited but must verify before accepting', async () => {
    const id = randomUUID(); await database.query('INSERT INTO users(id,email) VALUES($1,\'verify@example.test\')',[id]);
    const created = await create('verify@example.test'); const token = tokens.invitationToken(created.invitation.id,1);
    assert.equal(created.invitation.recipientUserId,id); assert.equal(await orgCount(id),0);
    await assert.rejects(api.acceptWorkspaceInvitation(id,workspace,created.invitation.id,randomUUID(),token),{code:'VERIFIED_IDENTITY_REQUIRED'});
    await database.query('UPDATE users SET "emailVerified"=true WHERE id=$1',[id]);
    await api.acceptWorkspaceInvitation(id,workspace,created.invitation.id,randomUUID(),token);
    assert.equal(await membershipCount(id),1);
  });
  await t.test('new signup must have the verified invited email and secret; concurrent acceptance grants once', async () => {
    const invitation = (await database.query('SELECT * FROM workspace_invitations WHERE "invitedEmail"=\'new@example.test\'')).rows[0];
    const id = randomUUID(); await database.query('INSERT INTO users(id,email,"emailVerified") VALUES($1,\'new@example.test\',true)',[id]);
    const token = tokens.invitationToken(invitation.id,1);
    await assert.rejects(api.acceptWorkspaceInvitation(member,workspace,invitation.id,randomUUID(),token),{code:'NOT_FOUND'});
    await assert.rejects(api.acceptWorkspaceInvitation(id,workspace,invitation.id,randomUUID(),'x'.repeat(43)),{code:'NOT_FOUND'});
    assert.equal(await orgCount(id),0);
    const resolved = await api.resolveWorkspaceInvitation(id,invitation.id,token);
    assert.equal(resolved.invitation.workspaceId,workspace); assert.equal(await orgCount(id),0);
    const key = randomUUID();
    const results = await Promise.all([api.acceptWorkspaceInvitation(id,workspace,invitation.id,key,token),api.acceptWorkspaceInvitation(id,workspace,invitation.id,key,token)]);
    assert.deepEqual(results[0],results[1]); assert.equal(await membershipCount(id),1);
    assert.equal((await row(invitation.id)).status,'ACCEPTED');
    await assert.rejects(api.acceptWorkspaceInvitation(id,workspace,invitation.id,randomUUID(),token),{code:'INVITATION_UNAVAILABLE'});
  });
  await t.test('backend role restrictions and duplicate creation races are enforced', async () => {
    await assert.rejects(create('forbidden@example.test',member),{code:'FORBIDDEN'});
    await assert.rejects(create('forbidden@example.test',admin,'ADMIN'),{code:'FORBIDDEN'});
    const allowed = await create('admin-member@example.test',admin); assert.equal(allowed.invitation.role,'MEMBER');
    const results = await Promise.allSettled([create('race@example.test'),create('RACE@example.test')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.find(r=>r.status==='rejected').reason.code,'INVITATION_EXISTS');
  });
  await t.test('expiry, renewal rotation, resend throttling, revocation and version conflicts', async () => {
    const id = randomUUID(); await database.query('INSERT INTO users(id,email,"emailVerified") VALUES($1,\'renew@example.test\',true)',[id]);
    const created = await create('renew@example.test'); const invitationId=created.invitation.id; const oldToken=tokens.invitationToken(invitationId,1);
    await assert.rejects(api.updateWorkspaceInvitation(owner,workspace,invitationId,'RENEW',1,randomUUID()),{code:'INVITATION_RESEND_LIMIT'});
    await database.query('UPDATE workspace_invitations SET "expiresAt"=now()-interval \'1 second\',"emailQueuedAt"=now()-interval \'2 minutes\' WHERE id=$1',[invitationId]);
    await assert.rejects(api.acceptWorkspaceInvitation(id,workspace,invitationId,randomUUID(),oldToken),{code:'INVITATION_UNAVAILABLE'});
    const renewed=await api.updateWorkspaceInvitation(owner,workspace,invitationId,'RENEW',1,randomUUID()); assert.equal(renewed.invitation.version,2);
    await assert.rejects(api.acceptWorkspaceInvitation(id,workspace,invitationId,randomUUID(),oldToken),{code:'NOT_FOUND'});
    await assert.rejects(api.updateWorkspaceInvitation(owner,workspace,invitationId,'REVOKE',1,randomUUID()),{code:'VERSION_CONFLICT'});
    await api.updateWorkspaceInvitation(owner,workspace,invitationId,'REVOKE',2,randomUUID());
    await assert.rejects(api.acceptWorkspaceInvitation(id,workspace,invitationId,randomUUID(),tokens.invitationToken(invitationId,2)),{code:'INVITATION_UNAVAILABLE'});
    assert.equal(await orgCount(id),0);
  });
  await t.test('an audit failure rolls back invitation and queued delivery', async () => {
    await database.query(`CREATE FUNCTION fail_invitation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit unavailable'; END $$;
      CREATE TRIGGER fail_invitation_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_invitation_audit()`);
    try { await assert.rejects(create('rollback@example.test')); }
    finally { await database.query('DROP TRIGGER fail_invitation_audit ON audit_logs; DROP FUNCTION fail_invitation_audit()'); }
    assert.equal((await database.query('SELECT count(*) FROM workspace_invitations WHERE "invitedEmail"=\'rollback@example.test\'')).rows[0].count,'0');
  });
  await t.test('failed acceptance rolls back both memberships and leaves the invitation pending', async () => {
    const id=randomUUID(); await database.query('INSERT INTO users(id,email,"emailVerified") VALUES($1,\'rollback-accept@example.test\',true)',[id]);
    const created=await create('rollback-accept@example.test');
    await database.query(`CREATE FUNCTION fail_acceptance_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit unavailable'; END $$;
      CREATE TRIGGER fail_acceptance_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_acceptance_audit()`);
    try { await assert.rejects(api.acceptWorkspaceInvitation(id,workspace,created.invitation.id,randomUUID(),tokens.invitationToken(created.invitation.id,1))); }
    finally { await database.query('DROP TRIGGER fail_acceptance_audit ON audit_logs; DROP FUNCTION fail_acceptance_audit()'); }
    assert.equal(await orgCount(id),0); assert.equal(await membershipCount(id),0); assert.equal((await row(created.invitation.id)).status,'PENDING');
  });
  await t.test('account email changes, archived workspaces and revoked inviter authority cannot grant access', async () => {
    const id=randomUUID(); await database.query('INSERT INTO users(id,email,"emailVerified") VALUES($1,\'authority@example.test\',true)',[id]);
    const created=await create('authority@example.test',admin); const token=tokens.invitationToken(created.invitation.id,1);
    await database.query('UPDATE users SET email=\'changed@example.test\' WHERE id=$1',[id]);
    await assert.rejects(api.acceptWorkspaceInvitation(id,workspace,created.invitation.id,randomUUID(),token),{code:'NOT_FOUND'});
    await database.query('UPDATE users SET email=\'authority@example.test\' WHERE id=$1',[id]);
    await database.query('UPDATE workspaces SET "lifecycleStatus"=\'ARCHIVED\',"archivedAt"=now() WHERE id=$1',[workspace]);
    await assert.rejects(api.acceptWorkspaceInvitation(id,workspace,created.invitation.id,randomUUID(),token),{code:'WORKSPACE_READ_ONLY'});
    await database.query('UPDATE workspaces SET "lifecycleStatus"=\'ACTIVE\',"archivedAt"=null WHERE id=$1',[workspace]);
    await database.query('UPDATE workspace_members SET role=\'MEMBER\' WHERE "workspaceId"=$1 AND "userId"=$2',[workspace,admin]);
    try { await assert.rejects(api.acceptWorkspaceInvitation(id,workspace,created.invitation.id,randomUUID(),token),{code:'FORBIDDEN'}); }
    finally { await database.query('UPDATE workspace_members SET role=\'ADMIN\' WHERE "workspaceId"=$1 AND "userId"=$2',[workspace,admin]); }
    assert.equal(await orgCount(id),0); assert.equal(await membershipCount(id),0);
  });
  await t.test('delivery retries, lease recovery and fencing use only safe persisted errors', async () => {
    // Existing worker architecture polls across tenants using a separate elevated identity.
    await database.query('ALTER ROLE invitation_app BYPASSRLS');
    try {
      await database.query('UPDATE workspace_outbox SET "dispatchedAt"=now()');
      const created=await create('delivery@example.test'); const id=created.invitation.id;
      let sends=0;
      await delivery.dispatchWorkspaceInvitationEmail(async () => { sends++; throw new Error('provider-secret-must-not-be-stored'); });
      let queued=(await database.query('SELECT * FROM workspace_outbox WHERE "resourceId"=$1 AND operation=\'WORKSPACE_INVITATION_EMAIL\'',[id])).rows[0];
      assert.equal(queued.lastError,'INVITATION_EMAIL_DELIVERY_FAILED'); assert.equal(queued.dispatchedAt,null); assert.equal(queued.attempts,1);
      assert.equal(await delivery.dispatchWorkspaceInvitationEmail(async()=>{ sends++; }),false); assert.equal(sends,1);
      await database.query('UPDATE workspace_outbox SET "availableAt"=now(),"lockedUntil"=now()-interval \'1 second\',"lockToken"=$2 WHERE id=$1',[queued.id,randomUUID()]);
      await delivery.dispatchWorkspaceInvitationEmail(async message => {
        sends++; const token=tokens.invitationToken(id,1); assert.ok(message.text.includes('#token='+token));
        assert.equal(message.email,'delivery@example.test'); assert.ok(message.messageId.includes(id));
      });
      assert.equal(sends,2); assert.equal((await row(id)).emailStatus,'SENT');
      assert.equal(await delivery.dispatchWorkspaceInvitationEmail(async()=>assert.fail('duplicate delivery')),false);
      const failed=await create('terminal@example.test');
      await database.query('UPDATE workspace_outbox SET attempts=7 WHERE "resourceId"=$1',[failed.invitation.id]);
      await delivery.dispatchWorkspaceInvitationEmail(async()=>{throw new Error('secret');});
      assert.equal((await row(failed.invitation.id)).emailStatus,'FAILED');
      const stale=await create('stale@example.test');
      await api.updateWorkspaceInvitation(owner,workspace,stale.invitation.id,'REVOKE',1,randomUUID());
      await delivery.dispatchWorkspaceInvitationEmail(async()=>assert.fail('revoked invitation sent'));
      const fenced=await create('fenced@example.test');
      await delivery.dispatchWorkspaceInvitationEmail(async()=>{
        await database.query('UPDATE workspace_outbox SET "lockedUntil"=now()-interval \'1 second\',"lockToken"=$2 WHERE "resourceId"=$1',[fenced.invitation.id,randomUUID()]);
      });
      assert.equal((await row(fenced.invitation.id)).emailStatus,'QUEUED');
      const pending=(await database.query('SELECT "dispatchedAt" FROM workspace_outbox WHERE "resourceId"=$1',[fenced.invitation.id])).rows[0];
      assert.equal(pending.dispatchedAt,null);
    } finally { await database.query('ALTER ROLE invitation_app NOBYPASSRLS'); }
  });
});
