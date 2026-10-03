import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { prisma, pgPool } from "../config/prisma.js";
import { digest, opaqueToken } from "../modules/identity/domain/security-policy.js";
import { initPresenceWebSocketServer, getPresenceRoomsSummary } from "../services/collaboration/presence.service.js";

const database=new URL(process.env.DATABASE_URL??"invalid:");
if(process.env.NODE_ENV!=="test" || process.env.FORGE_DISPOSABLE_TEST_DB!=="1" ||
  !["localhost","127.0.0.1"].includes(database.hostname) || database.pathname!=="/forge_presence") throw new Error("Isolated forge_presence database required");
function frame(ws: WebSocket, type: string, send?: object): Promise<Record<string,any>> {
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{ws.off("message",receive);reject(new Error(`Missing frame ${type}`));},3000);
    const receive=(data:Buffer)=>{
      const value=JSON.parse(data.toString());if(value.type!==type)return;
      clearTimeout(timeout);ws.off("message",receive);resolve(value);
    };
    ws.on("message",receive);if(send)ws.send(JSON.stringify(send));
  });
}
const closed=(ws:WebSocket)=>new Promise<number>((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error("Connection did not close")),12000);
  ws.once("close",code=>{clearTimeout(timer);resolve(code);});
});
test("authenticated presence channel and revocation contracts", {timeout:45000}, async t=>{
  t.after(async()=>{await prisma.$disconnect();await pgPool.end();});
  const owner=await prisma.user.create({data:{email:`${randomUUID()}@example.test`,fullName:"Verified owner",emailVerified:true}});
  const sibling=await prisma.user.create({data:{email:`${randomUUID()}@example.test`,fullName:"Sibling member",emailVerified:true}});
  const organization=await prisma.organization.create({data:{name:"Presence fixture",slug:randomUUID(),ownerId:owner.id}});
  await prisma.organizationMember.createMany({data:[{organizationId:organization.id,userId:owner.id,role:"OWNER"},
    {organizationId:organization.id,userId:sibling.id,role:"MEMBER"}]});
  const sites: Array<{id:string}>=[];
  for(const name of ["A","B"]){
    const workspace=await prisma.workspace.create({data:{name,slug:randomUUID(),organizationId:organization.id,ownerId:owner.id}});
    await prisma.workspaceMember.create({data:{workspaceId:workspace.id,userId:owner.id,role:"OWNER"}});
    sites.push(await prisma.website.create({data:{name,slug:randomUUID(),userId:owner.id,organizationId:organization.id,workspaceId:workspace.id}}));
  }
  async function token(userId:string){
    const raw=opaqueToken();await prisma.session.create({data:{userId,tokenHash:digest(raw),authEpoch:1,authMethod:"local",audience:"TENANT",
      authTime:new Date(),expiresAt:new Date(Date.now()+3600000)}});return raw;
  }
  const ownerToken=await token(owner.id);const siblingToken=await token(sibling.id);
  const server=http.createServer((_req,res)=>res.end());
  const wss=initPresenceWebSocketServer(server);server.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const url=`ws://127.0.0.1:${(server.address() as {port:number}).port}/ws/presence`;
  const sockets:WebSocket[]=[];
  t.after(async()=>{
    for(const ws of sockets)ws.terminate();
    await new Promise<void>(resolve=>wss.close(()=>resolve()));await new Promise<void>(resolve=>server.close(()=>resolve()));
  });
  async function connect(raw?:string,origin="http://localhost:5173") {
    return new Promise<WebSocket>((resolve,reject)=>{
      const ws=new WebSocket(url,{headers:{Origin:origin,...(raw?{Cookie:`forge_session=${raw}`}:{})},handshakeTimeout:3000});
      sockets.push(ws);ws.on("error",error=>reject(error));
      ws.once("unexpected-response",(_req,res)=>{res.resume();ws.terminate();reject(new Error(`HTTP_${res.statusCode}`));});
      ws.once("open",()=>resolve(ws));
    });
  }
  await t.test("upgrade requires a valid cookie and exact browser origin",async()=>{
    await assert.rejects(connect(),/HTTP_401/);
    await assert.rejects(connect(ownerToken,"https://attacker.example"),/HTTP_403/);
    await assert.rejects(connect("supp_invalid"),/HTTP_401/);
  });
  let a:WebSocket;
  await t.test("client-supplied peer identities are ignored",async()=>{
    a=await connect(ownerToken);
    const sync=await frame(a,"SYNC",{type:"JOIN",websiteId:sites[0].id,user:{id:sibling.id,name:"Forged identity",role:"SUPER_ADMIN"}});
    const self=sync.peers.find((p:any)=>p.socketId===sync.selfSocketId);
    assert.equal(self.user.userId,owner.id);assert.equal(self.user.name,"Verified owner");
    assert.equal("email" in self.user,false);assert.doesNotMatch(JSON.stringify(sync),/Forged identity|passwordHash/);
  });
  await t.test("organization membership alone cannot join a restricted workspace",async()=>{
    const ws=await connect(siblingToken);const result=closed(ws);let disclosed=false;
    ws.on("message",()=>{disclosed=true;});ws.send(JSON.stringify({type:"JOIN",websiteId:sites[0].id,user:{id:owner.id}}));
    assert.equal(await result,1008);assert.equal(disclosed,false);
  });
  await t.test("switching rooms removes the old subscription before accepting a new one",async()=>{
    const hop=await connect(ownerToken);await frame(hop,"SYNC",{type:"JOIN",websiteId:sites[0].id});
    await frame(hop,"SYNC",{type:"JOIN",websiteId:sites[1].id});
    const received:unknown[]=[];hop.on("message",raw=>{const msg=JSON.parse(raw.toString());if(msg.type==="PEER_CURSOR")received.push(msg);});
    a!.send(JSON.stringify({type:"CURSOR",cursor:{x:12,y:22}}));
    await new Promise(resolve=>setTimeout(resolve,150));assert.equal(received.length,0);
    hop.terminate();
  });
  await t.test("frames are schema-checked and bounded before broadcast",async()=>{
    const bad=await connect(ownerToken);await frame(bad,"SYNC",{type:"JOIN",websiteId:sites[0].id});
    const done=closed(bad);bad.send(JSON.stringify({type:"CURSOR",cursor:{x:"invalid",y:0}}));assert.equal(await done,1008);
    const huge=await connect(ownerToken);const oversized=closed(huge);
    huge.send(JSON.stringify({type:"JOIN",websiteId:sites[0].id,user:{name:"x".repeat(9000)}}));assert.equal(await oversized,1009);
  });
  await t.test("bursting clients cannot create an unbounded message queue",async()=>{
    const burst=await connect(ownerToken);const done=closed(burst);
    for(let i=0;i<40;i++)burst.send(JSON.stringify({type:"PING"}));
    assert.equal(await done,1008);
  });
  await t.test("session revocation removes a live authorized connection within its lease",async()=>{
    const done=closed(a!);const start=Date.now();
    await prisma.session.updateMany({where:{tokenHash:digest(ownerToken)},data:{revokedAt:new Date()}});
    assert.equal(await done,1008);assert.ok(Date.now()-start<11000);
    assert.deepEqual(Object.keys(getPresenceRoomsSummary()).sort(),["connections","rooms"]);
  });
});
