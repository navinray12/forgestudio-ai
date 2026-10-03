import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma,pgPool} from "../../backend/src/config/prisma.js";
const database=new URL(process.env.DATABASE_URL || "invalid:");
if(process.env.FORGE_DISPOSABLE_TEST_DB!=="1" || !["localhost","127.0.0.1"].includes(database.hostname) || database.pathname!=="/elementor_saas") {
  throw new Error("Part B fixtures require the opted-in local elementor_saas database");
}
export async function runDatabaseTestSuite() {
  const results:Array<{testName:string;passed:boolean;details:string}>=[];
  const verify=async(testName:string,check:()=>Promise<void>)=>{
    try {await check();results.push({testName,passed:true,details:"Verified against disposable PostgreSQL"});}
    catch {results.push({testName,passed:false,details:"Database invariant failed"});}
  };
  let fixtureId:string|undefined;
  try {
    await verify("PostgreSQL user table",async()=>{assert.ok(await prisma.user.count()>=0);});
    await verify("WordPress connection schema",async()=>{await prisma.$queryRaw`SELECT id, "websiteId", "siteUrl", status FROM wordpress_connections LIMIT 5`;});
    await verify("Record creation and persistence",async()=>{
      const email=`probe-${randomUUID()}@example.test`;
      const row=await prisma.user.create({data:{email,fullName:"Disposable regression fixture"}});fixtureId=row.id;
      assert.equal((await prisma.user.findUnique({where:{id:row.id}}))?.email,email);
    });
    await verify("Record cleanup",async()=>{
      assert.ok(fixtureId);await prisma.user.delete({where:{id:fixtureId}});
      assert.equal(await prisma.user.findUnique({where:{id:fixtureId}}),null);
    });
  } finally {
    if(fixtureId)await prisma.user.deleteMany({where:{id:fixtureId}});
    await prisma.$disconnect();await pgPool.end();
  }
  const passed=results.filter(result=>result.passed).length;
  return {results,passed,failed:results.length-passed};
}
