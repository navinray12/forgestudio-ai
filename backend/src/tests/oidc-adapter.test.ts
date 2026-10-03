import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { OpenIdProvider } from "../adapters/identity/oidc.provider.js";
import type { OidcConfiguration } from "../adapters/identity/oidc.config.js";
import type { AuthorizationProof } from "../platform/ports/identity-provider.port.js";

const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...pair.publicKey.export({format:"jwk"}), kid:"fixture-key", alg:"RS256", use:"sig" };
const settings: OidcConfiguration = { issuer:"https://issuer.example", clientId:"fixture-client", clientSecret:"fixture-only-secret",
  callbackUrl:"https://app.example/api/v1/auth/oidc/callback", allowedOrigins:["https://issuer.example"],
  mfaAcrs:["urn:fixture:mfa"], phishingResistantAcrs:["urn:fixture:webauthn"] };
const proof: AuthorizationProof = { state:"fixture-state", nonce:"fixture-nonce", verifier:"a".repeat(64) };
function token(changes: Record<string,unknown> = {}, badSignature=false) {
  const header = Buffer.from(JSON.stringify({alg:"RS256",kid:"fixture-key",typ:"JWT"})).toString("base64url");
  const payload = Buffer.from(JSON.stringify({iss:settings.issuer,sub:"subject-123",aud:settings.clientId,nonce:proof.nonce,
    exp:Math.floor(Date.now()/1000)+300,iat:Math.floor(Date.now()/1000),auth_time:Math.floor(Date.now()/1000),
    email:"verified@example.test",email_verified:true,name:"Verified fixture",acr:"urn:fixture:webauthn",...changes})).toString("base64url");
  const signingInput=`${header}.${payload}`;
  return `${signingInput}.${sign("RSA-SHA256",Buffer.from(signingInput),badSignature?other.privateKey:pair.privateKey).toString("base64url")}`;
}
function fixture(changes:Record<string,unknown>={}, badSignature=false, metadataChanges:Record<string,unknown>={}) {
  const calls: Array<{url:string; method:string; redirect:unknown}>=[];
  const transport: typeof fetch = async(input, init) => {
    const url=input.toString();calls.push({url,method:init?.method??"GET",redirect:init?.redirect});
    assert.ok(init?.signal);assert.equal(init?.redirect,"error");
    let result;
    if (url.endsWith("/.well-known/openid-configuration")) result = {
      issuer:settings.issuer,authorization_endpoint:`${settings.issuer}/authorize`,token_endpoint:`${settings.issuer}/token`,
      jwks_uri:`${settings.issuer}/jwks`,response_types_supported:["code"],subject_types_supported:["public"],
      id_token_signing_alg_values_supported:["RS256"],code_challenge_methods_supported:["S256"],...metadataChanges};
    else if (url.endsWith("/jwks")) result={keys:[jwk]};
    else if (url.endsWith("/token")) {
      const body=new URLSearchParams(String(init?.body));
      assert.equal(body.get("code_verifier"),proof.verifier);
      assert.equal(body.get("client_secret"),settings.clientSecret);
      result={id_token:token(changes,badSignature),access_token:"fixture-access-token",token_type:"Bearer",expires_in:300};
    } else throw new Error("Unexpected provider URL");
    return new Response(JSON.stringify(result),{status:200,headers:{"Content-Type":"application/json"}});
  };
  return {provider:new OpenIdProvider(settings,transport),calls};
}
const callback=()=>new URL(`${settings.callbackUrl}?code=fixture-code&state=${proof.state}`);
test("OIDC-ADAPTER-001: authorization code flow sends S256, nonce, state and recent-auth requirements",async()=>{
  const {provider}=fixture();const url=new URL(await provider.authorizationUrl(proof));
  assert.equal(url.searchParams.get("response_type"),"code");
  assert.equal(url.searchParams.get("code_challenge_method"),"S256");
  assert.equal(url.searchParams.get("state"),proof.state);
  assert.equal(url.searchParams.get("nonce"),proof.nonce);
  assert.equal(url.searchParams.get("max_age"),"900");
  assert.equal(url.searchParams.has("client_secret"),false);
});
test("OIDC-ADAPTER-002: signed issuer/audience-bound claims produce explicit assurance",async()=>{
  const {provider,calls}=fixture();const identity=await provider.exchange(callback(),proof);
  assert.equal(identity.subject,"subject-123");assert.equal(identity.assurance,"phishing-resistant");
  assert.equal(identity.emailVerified,true);assert.equal("access_token" in identity,false);
  assert.ok(calls.some(c=>c.url.endsWith("/jwks")),"ID token signature must actually be verified");
});
const invalidClaims: Array<Record<string,unknown>> = [
  {iss:"https://other.example"}, {aud:"another-client"}, {exp:Math.floor(Date.now()/1000)-300},
  {nonce:"swapped"}, {email_verified:false}, {email_verified:"true"}, {auth_time:Math.floor(Date.now()/1000)-1000},
  {auth_time:Math.floor(Date.now()/1000)+3600}, {sub:""}, {email:"invalid-address"},
];
for (const claims of invalidClaims) test(`OIDC-ADAPTER-003: reject invalid ${Object.keys(claims)[0]}=${claims[Object.keys(claims)[0]]}`,async()=>{
  const {provider}=fixture(claims);await assert.rejects(provider.exchange(callback(),proof));
});
test("OIDC-ADAPTER-004: a forged ID token cannot rely on token endpoint TLS instead of signature checks",async()=>{
  const {provider}=fixture({},true);await assert.rejects(provider.exchange(callback(),proof));
});
test("OIDC-ADAPTER-005: approved authentication context mapping never trusts an arbitrary amr string",async()=>{
  const {provider}=fixture({acr:"unapproved",amr:["mfa","webauthn"]});
  assert.equal((await provider.exchange(callback(),proof)).assurance,"none");
});
test("OIDC-ADAPTER-006: metadata cannot redirect token or key traffic outside approved origins",async()=>{
  const {provider,calls}=fixture({},false,{token_endpoint:"https://metadata.internal/token"});
  await assert.rejects(provider.exchange(callback(),proof));
  await assert.rejects(provider.exchange(callback(),proof));
  assert.equal(calls.length,1,"bad provider configuration must be backoff-limited");
});
test("OIDC-ADAPTER-007: missing PKCE advertisement blocks the configured provider",async()=>{
  const {provider}=fixture({},false,{code_challenge_methods_supported:[]});
  await assert.rejects(provider.authorizationUrl(proof));
});
test("OIDC-ADAPTER-008: oversized discovery responses are rejected",async()=>{
  let calls=0;
  const transport: typeof fetch=async()=>{calls++;return new Response(" ".repeat(262145),{headers:{"Content-Type":"application/json"}});};
  const provider=new OpenIdProvider(settings,transport);
  await assert.rejects(provider.authorizationUrl(proof));assert.equal(calls,1);
});
