import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma, pgPool } from "../config/prisma.js";
import { PostgresIdentityStore } from "../adapters/postgres/identity.store.js";
import { AccountSessions } from "../modules/identity/application/account-sessions.js";
import { LocalAuthentication } from "../modules/identity/application/local-authentication.js";
import { OidcAuthentication } from "../modules/identity/application/oidc-authentication.js";
import type { IdentityProviderPort, VerifiedProviderIdentity, AuthorizationProof } from "../platform/ports/identity-provider.port.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { digest, opaqueToken } from "../modules/identity/domain/security-policy.js";
import { authenticateSession } from "../services/session-authentication.js";
import { createLocalIdentityRouter } from "../modules/identity/http/local.routes.js";
import { protectCookieMutations } from "../middlewares/browser-origin.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import authRoutes from "../routes/auth.routes.js";
import oauthRoutes from "../routes/oauth.routes.js";
import meRoutes from "../routes/me.routes.js";

const database = new URL(process.env.DATABASE_URL ?? "invalid:");
if (process.env.NODE_ENV !== "test" || process.env.FORGE_DISPOSABLE_TEST_DB !== "1" ||
    !["127.0.0.1", "localhost"].includes(database.hostname) || database.pathname !== "/forge_identity") {
  throw new Error("Identity tests require the explicitly opted-in local forge_identity database.");
}
const passwords = { hash: hashPassword, verify: verifyPassword };
const store = new PostgresIdentityStore();
const delivered = new Map<string, string>();
let mailFailed = false;
let clock = new Date();
const local = new LocalAuthentication(store, passwords, { async sendCode(input) {
  if (mailFailed) throw new Error("private SMTP credential must not leak");
  delivered.set(input.email, input.code);
} }, () => clock);
const password = "Fixture password with spaces ";
let passwordHash: string;
async function fixture() {
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, fullName:"Identity fixture", passwordHash } });
  return user;
}
async function challenge(user: Awaited<ReturnType<typeof fixture>>) {
  const pending = await local.beginLogin(user.email!, password, randomUUID());
  await local.sendCode(pending.secret, user.id, "LOGIN");
  return pending;
}
function invalid(error: unknown) { return typeof error === "object" && !!error && "statusCode" in error && (error as {statusCode:number}).statusCode >= 400; }
class ProviderFixture implements IdentityProviderPort {
  key = "fixture-provider";
  callbackUrl = "https://application.example/api/v1/auth/oidc/callback";
  exchanges = 0;
  proof: AuthorizationProof | undefined;
  identity: VerifiedProviderIdentity = { issuer:"https://issuer.example", subject:randomUUID(), email:`${randomUUID()}@example.test`,
    emailVerified:true, name:"Managed fixture", authenticatedAt:new Date(), assurance:"none" };
  async authorizationUrl(proof: AuthorizationProof) {
    this.proof = proof;
    const url = new URL("https://issuer.example/authorize"); url.searchParams.set("state",proof.state); return url.href;
  }
  async exchange(_url: URL, _proof: AuthorizationProof) { this.exchanges++; return this.identity; }
  callback() { return new URL(`${this.callbackUrl}?code=fixture-code&state=${this.proof!.state}`); }
}

test("identity migration, authentication and HTTP contracts on PostgreSQL", {timeout:60000}, async t => {
  t.after(async () => { await prisma.$disconnect(); await pgPool.end(); });
  assert.equal(await prisma.user.count(), 0, "Use a fresh disposable database for each run.");
  await pgPool.query(`DROP TABLE auth_challenges, oidc_identities, identity_rate_buckets;
    ALTER TABLE users DROP COLUMN "authEpoch";
    ALTER TABLE sessions DROP COLUMN "authEpoch", DROP COLUMN "authMethod", DROP COLUMN audience, DROP COLUMN "authTime", DROP COLUMN assurance, DROP COLUMN "mfaVerifiedAt";`);
  const oldId=randomUUID(); const oldToken=opaqueToken();
  passwordHash=await hashPassword(password);
  await pgPool.query('INSERT INTO users (id,email,"passwordHash","updatedAt") VALUES ($1,$2,$3,now())',[oldId,`${randomUUID()}@example.test`,passwordHash]);
  await pgPool.query('INSERT INTO sessions (id,"userId","tokenHash","expiresAt") VALUES ($1,$2,$3,now()+interval \'1 day\')',[randomUUID(),oldId,digest(oldToken)]);
  await pgPool.query(readFileSync("prisma/migrations/20260928170000_identity_boundary/migration.sql","utf8"));
  await t.test("migration invalidates unclassifiable sessions without resetting passwords",async()=>{
    assert.equal(await authenticateSession(oldToken),null);
    assert.equal((await prisma.user.findUniqueOrThrow({where:{id:oldId}})).passwordHash,passwordHash);
    assert.equal((await prisma.user.findUniqueOrThrow({where:{id:oldId}})).authEpoch,1);
  });
  await t.test("user ID alone is not a password proof or challenge binding",async()=>{
    const user=await fixture();
    await assert.rejects(local.sendCode(undefined,user.id,"LOGIN"),invalid);
    await assert.rejects(local.finish(undefined,user.id,"LOGIN","123456"),invalid);
    await assert.rejects(local.beginLogin(user.email!,"wrong-password",randomUUID()),invalid);
    assert.equal(await prisma.authChallenge.count({where:{userId:user.id}}),0);
  });
  await t.test("one cookie-bound verification atomically issues one safe session",async()=>{
    const user=await fixture(); const pending=await challenge(user);
    const result=await local.finish(pending.secret,user.id,"LOGIN",delivered.get(user.email!)!);
    assert.equal(result.user.id,user.id); assert.equal("passwordHash" in result.user,false);
    const session=await authenticateSession(result.token); assert.equal(session?.user.emailVerified,true);
    assert.equal(session?.assurance,"email-otp"); assert.equal(session?.mfaVerifiedAt,null);
    await assert.rejects(local.finish(pending.secret,user.id,"LOGIN",delivered.get(user.email!)!),invalid);
    assert.equal(await prisma.session.count({where:{userId:user.id}}),1);
  });
  await t.test("concurrent valid responses converge on a single consumed challenge",async()=>{
    const user=await fixture(); const pending=await challenge(user); const code=delivered.get(user.email!)!;
    const results=await Promise.allSettled(Array.from({length:6},()=>local.finish(pending.secret,user.id,"LOGIN",code)));
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(await prisma.session.count({where:{userId:user.id}}),1);
  });
  await t.test("concurrent invalid attempts commit the exact attempt ceiling",async()=>{
    const user=await fixture(); const pending=await challenge(user);
    const wrong=delivered.get(user.email!)==="123456"?"999999":"123456";
    const results=await Promise.allSettled(Array.from({length:12},()=>local.finish(pending.secret,user.id,"LOGIN",wrong)));
    assert.equal(results.filter(r=>r.status==="fulfilled").length,0);
    const row=await store.findChallenge(digest(pending.secret)); assert.equal(row?.attempts,5); assert.equal(row?.status,"FAILED");
    await assert.rejects(local.finish(pending.secret,user.id,"LOGIN",delivered.get(user.email!)!),invalid);
    assert.equal(await prisma.session.count({where:{userId:user.id}}),0);
  });
  await t.test("binding and purpose swapping cannot authenticate another actor",async()=>{
    const a=await fixture(); const b=await fixture(); const pa=await challenge(a); const pb=await challenge(b);
    await assert.rejects(local.finish(pa.secret,b.id,"LOGIN",delivered.get(b.email!)!),invalid);
    await assert.rejects(local.finish(pb.secret,b.id,"SIGNUP",delivered.get(b.email!)!),invalid);
    await assert.rejects(local.finish(opaqueToken(),a.id,"LOGIN",delivered.get(a.email!)!),invalid);
  });
  await t.test("suspension and credential-epoch changes invalidate pending proofs",async()=>{
    const a=await fixture(); const pa=await challenge(a);
    await prisma.user.update({where:{id:a.id},data:{status:"SUSPENDED"}});
    await assert.rejects(local.finish(pa.secret,a.id,"LOGIN",delivered.get(a.email!)!),invalid);
    const b=await fixture(); const pb=await challenge(b);
    await prisma.user.update({where:{id:b.id},data:{authEpoch:{increment:1}}});
    await assert.rejects(local.finish(pb.secret,b.id,"LOGIN",delivered.get(b.email!)!),invalid);
  });
  await t.test("a failed delivery never becomes a usable code or reported success",async()=>{
    const user=await fixture(); const pending=await local.beginLogin(user.email!,password,randomUUID());
    mailFailed=true;
    await assert.rejects(local.sendCode(pending.secret,user.id,"LOGIN"),(error:unknown)=>{
      assert.equal((error as {code:string}).code,"IDENTITY_DELIVERY_UNAVAILABLE"); assert.doesNotMatch(String(error),/private SMTP/); return true;
    });
    mailFailed=false;
    assert.equal((await store.findChallenge(digest(pending.secret)))?.status,"FAILED");
    assert.equal(await prisma.session.count({where:{userId:user.id}}),0);
  });
  await t.test("resend reservation is serialized and does not reset guessed attempts",async()=>{
    const user=await fixture(); const pending=await local.beginLogin(user.email!,password,randomUUID());
    const results=await Promise.allSettled(Array.from({length:3},()=>local.sendCode(pending.secret,user.id,"LOGIN")));
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    await assert.rejects(local.sendCode(pending.secret,user.id,"LOGIN"),invalid);
    const wrong=delivered.get(user.email!)==="123456"?"999999":"123456";
    await assert.rejects(local.finish(pending.secret,user.id,"LOGIN",wrong),invalid);
    clock=new Date(clock.getTime()+61000);
    await local.sendCode(pending.secret,user.id,"LOGIN");
    assert.equal((await store.findChallenge(digest(pending.secret)))?.attempts,1);
    clock=new Date();
  });
  await t.test("expiry is authoritative even when a correct code is supplied",async()=>{
    const user=await fixture(); const pending=await challenge(user);
    clock=new Date(clock.getTime()+600001);
    await assert.rejects(local.finish(pending.secret,user.id,"LOGIN",delivered.get(user.email!)!),invalid);
    clock=new Date();
  });
  await t.test("mandatory audit failure rolls back consumed proof and session",async()=>{
    const user=await fixture(); const pending=await challenge(user);
    await pgPool.query(`CREATE FUNCTION reject_identity_audit_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='IDENTITY_LOGIN_COMPLETED' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_identity_audit_fixture BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_identity_audit_fixture();`);
    try { await assert.rejects(local.finish(pending.secret,user.id,"LOGIN",delivered.get(user.email!)!)); }
    finally { await pgPool.query("DROP TRIGGER reject_identity_audit_fixture ON audit_logs; DROP FUNCTION reject_identity_audit_fixture()"); }
    assert.equal((await store.findChallenge(digest(pending.secret)))?.status,"READY");
    assert.equal(await prisma.session.count({where:{userId:user.id}}),0);
    await local.finish(pending.secret,user.id,"LOGIN",delivered.get(user.email!)!);
  });
  await t.test("shared rate budgets are atomic across concurrent request attempts",async()=>{
    const key=randomUUID();
    const results=await Promise.allSettled(Array.from({length:12},()=>local.rateLimit("fixture",key,5)));
    assert.equal(results.filter(r=>r.status==="fulfilled").length,5);
  });
  await t.test("managed identity is bound to issuer and subject, not email alone",async()=>{
    const provider=new ProviderFixture(); const oidc=new OidcAuthentication(store,provider);
    const user=await fixture(); provider.identity.email=user.email!;
    const pending=await oidc.begin();
    await assert.rejects(oidc.finish(pending.secret,provider.callback()),(error:unknown)=>(error as {code:string}).code==="IDENTITY_LINK_REQUIRED");
    assert.equal(await prisma.oidcIdentity.count({where:{userId:user.id}}),0);
  });
  await t.test("managed login validates the cookie, state, lifetime and one-time callback",async()=>{
    const provider=new ProviderFixture(); const oidc=new OidcAuthentication(store,provider);
    const pending=await oidc.begin(); const callback=provider.callback();
    await assert.rejects(oidc.finish(opaqueToken(),callback),invalid);
    const wrong=new URL(callback); wrong.searchParams.set("state","wrong");
    await assert.rejects(oidc.finish(pending.secret,wrong),invalid); assert.equal(provider.exchanges,0);
    const results=await Promise.allSettled([oidc.finish(pending.secret,callback),oidc.finish(pending.secret,callback)]);
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1); assert.equal(provider.exchanges,1);
    const result=results.find(r=>r.status==="fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof oidc.finish>>>;
    const session=await authenticateSession(result.value.token);
    assert.equal(session?.authMethod,"oidc");
    assert.equal(await prisma.oidcIdentity.count({where:{userId:result.value.user.id}}),1);
  });
  await t.test("provider policy changes invalidate pending browser grants",async()=>{
    const provider=new ProviderFixture(); const oidc=new OidcAuthentication(store,provider);
    const pending=await oidc.begin(); provider.key="changed-policy";
    await assert.rejects(oidc.finish(pending.secret,provider.callback()),invalid); assert.equal(provider.exchanges,0);
  });
  await t.test("privileged accounts require a verified strong assurance context",async()=>{
    const user=await fixture(); await prisma.user.update({where:{id:user.id},data:{role:"SUPER_ADMIN"}});
    const provider=new ProviderFixture(); provider.identity.email=user.email!;
    await prisma.oidcIdentity.create({data:{userId:user.id,issuer:provider.identity.issuer,subject:provider.identity.subject}});
    const oidc=new OidcAuthentication(store,provider);
    let pending=await oidc.begin();
    await assert.rejects(oidc.finish(pending.secret,provider.callback()),invalid);
    provider.identity.assurance="mfa"; pending=await oidc.begin();
    await assert.rejects(oidc.finish(pending.secret,provider.callback()),invalid);
    provider.identity.assurance="phishing-resistant"; pending=await oidc.begin();
    const result=await oidc.finish(pending.secret,provider.callback()); assert.equal(result.user.id,user.id);
    const session=await authenticateSession(result.token); assert.equal(session?.assurance,"phishing-resistant");
  });
  await t.test("identity linking requires both identities and a fresh current initiating session",async()=>{
    const user=await fixture(); const pending=await challenge(user);
    const login=await local.finish(pending.secret,user.id,"LOGIN",delivered.get(user.email!)!);
    const session=await authenticateSession(login.token); assert.ok(session);
    const provider=new ProviderFixture(); provider.identity.email=user.email!;
    const oidc=new OidcAuthentication(store,provider); const link=await oidc.begin({userId:user.id,sessionId:session.id});
    await assert.rejects(oidc.finish(link.secret,provider.callback(),randomUUID()),invalid);
    const linked=await oidc.finish(link.secret,provider.callback(),session.id);
    assert.equal(linked.user.id,user.id);
    assert.equal(await prisma.user.count({where:{email:user.email}}),1);
    await prisma.session.update({where:{id:session.id},data:{revokedAt:new Date()}});
    await assert.rejects(oidc.begin({userId:user.id,sessionId:session.id}),invalid);
  });
  await t.test("concurrent registration preserves one identity and maps the uniqueness conflict",async()=>{
    const email=`${randomUUID()}@example.test`;
    const results=await Promise.allSettled([local.beginSignup(email,"Concurrent registration",password,randomUUID()),
      local.beginSignup(email,"Concurrent registration",password,randomUUID())]);
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    const rejected=results.find(r=>r.status==="rejected") as PromiseRejectedResult;
    assert.equal(rejected.reason.statusCode,409);
    assert.equal(await prisma.user.count({where:{email}}),1);
  });
  await t.test("account session administration rejects foreign targets and fences pending login proofs",async()=>{
    const user=await fixture(); const begun=await challenge(user);
    const login=await local.finish(begun.secret,user.id,"LOGIN",delivered.get(user.email!)!);
    const session=await authenticateSession(login.token); assert.ok(session);
    const actor={userId:user.id,sessionId:session.id}; const accounts=new AccountSessions(store);
    const unrelated=await fixture();
    const token=opaqueToken();
    const foreign=await prisma.session.create({data:{userId:unrelated.id,tokenHash:digest(token),expiresAt:new Date(Date.now()+600_000),
      authEpoch:1,authMethod:"local",authTime:new Date(),audience:"TENANT"}});
    await assert.rejects(accounts.revoke(actor,foreign.id),e=>(e as {statusCode:number}).statusCode===404);
    assert.ok(await authenticateSession(token));
    const pending=await local.beginLogin(user.email!,password,randomUUID());
    await accounts.revokeAll(actor);
    assert.equal(await authenticateSession(login.token),null);
    await assert.rejects(local.sendCode(pending.secret,user.id,"LOGIN"),invalid);
    await assert.rejects(accounts.list(actor),invalid);
  });
  await t.test("failed mandatory revocation audit rolls back the session mutation",async()=>{
    const user=await fixture(); const begun=await challenge(user);
    const login=await local.finish(begun.secret,user.id,"LOGIN",delivered.get(user.email!)!);
    const session=await authenticateSession(login.token); assert.ok(session);
    await pgPool.query(`CREATE FUNCTION identity_revoke_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='IDENTITY_SESSION_REVOKED' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER identity_revoke_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION identity_revoke_audit_failure();`);
    try {
      await assert.rejects(new AccountSessions(store).revoke({userId:user.id,sessionId:session.id},session.id));
      assert.ok(await authenticateSession(login.token));
    } finally { await pgPool.query("DROP TRIGGER identity_revoke_audit_failure ON audit_logs; DROP FUNCTION identity_revoke_audit_failure();"); }
  });
  const app=express(); app.use(express.json({limit:"16kb"}),cookieParser(),protectCookieMutations);
  app.use("/api/v1/auth",createLocalIdentityRouter(local),authRoutes,oauthRoutes,meRoutes,errorMiddleware);
  const server=app.listen(0,"127.0.0.1"); await new Promise<void>(resolve=>server.once("listening",resolve));
  t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1/auth`;
  const request=async(path:string,body:object,cookie?:string,origin="http://localhost:5173")=>fetch(base+path,{method:"POST",headers:{
    "Content-Type":"application/json",Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  await t.test("HTTP legacy password and support routes cannot mutate accounts or expose credentials",async()=>{
    const user=await fixture();
    const response=await request("/create-password",{userId:user.id,password:"Attacker password"});
    assert.equal(response.status,410);
    assert.equal((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).passwordHash,passwordHash);
    assert.equal((await request("/support-login",{supportToken:oldToken})).status,410);
  });
  await t.test("HTTP password proof, CSRF, schema validation and cookie flags are enforced",async()=>{
    const user=await fixture();
    assert.equal((await request("/login/send-otp",{userId:user.id})).status,401);
    assert.equal((await request("/login",{identifier:user.email,password},undefined,"https://attacker.example")).status,403);
    assert.equal((await request("/login",{identifier:user.email,password,role:"SUPER_ADMIN"})).status,422);
    const begun=await request("/login",{identifier:user.email,password}); assert.equal(begun.status,200);
    const cookie=begun.headers.get("set-cookie")!; assert.match(cookie,/HttpOnly/i); assert.match(cookie,/SameSite=Lax/i);
    assert.equal((await request("/login/send-otp",{userId:user.id,channel:"EMAIL"},cookie.split(";")[0])).status,200);
    const verified=await request("/login/verify-otp",{userId:user.id,channel:"EMAIL",otp:delivered.get(user.email!)},cookie.split(";")[0]);
    assert.equal(verified.status,200); assert.equal((await verified.json() as {data:{user:{id:string}}}).data.user.id,user.id);
    const sessionCookie=verified.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await request("/logout",{},sessionCookie,"null")).status,403);
    const sessions=await fetch(base+"/sessions",{headers:{Cookie:sessionCookie}}); assert.equal(sessions.status,200);
    assert.doesNotMatch(await sessions.text(),/tokenHash|passwordHash/);
    assert.equal((await request("/logout",{},sessionCookie)).status,200);
    assert.equal((await fetch(base+"/me",{headers:{Cookie:sessionCookie}})).status,401);
  });
});
