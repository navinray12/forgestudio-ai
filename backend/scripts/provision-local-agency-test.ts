import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma, pgPool } from "../src/config/prisma.js";
import { hashPassword } from "../src/utils/password.js";
import { createTenantWorkspace } from "../src/services/workspaces/workspace-api.service.js";
import { withTenantTransaction } from "../src/platform/tenancy/context.js";

// Operator-run fixture only. Never import this script into an API or worker.
const url = new URL(process.env.DATABASE_URL ?? "invalid:");
if (process.env.FORGE_DISPOSABLE_TEST_DB !== "1" || process.env.NODE_ENV === "production" ||
    process.env.FORGE_AUTH_MODE !== "local" || url.hostname !== "postgres" || url.pathname !== "/forge") {
  throw new Error("Refusing to provision outside the explicitly opted-in disposable Compose database");
}

const email = "agency-tester@example.test";
const password = randomBytes(24).toString("base64url");

try {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Test account already exists; this script will not reset a password or modify an existing account");
  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: "agency" } });
  if (!plan?.isActive) throw new Error("Agency plan is missing; run npm run db:seed first");
  const actor = await prisma.$transaction(async tx => {
    const user = await tx.user.create({ data: {
      email, fullName: "ForgeStudio Agency Tester", role: "USER", status: "ACTIVE",
      emailVerified: true, verificationMethod: "EMAIL", passwordHash: await hashPassword(password),
    } });
    await tx.userSubscription.create({ data: {
      userId: user.id, planId: plan.id, status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    } });
    await tx.auditLog.create({ data: {
      userId: user.id, action: "LOCAL_TEST_ACCOUNT_PROVISIONED", targetResource: `user:${user.id}`,
      details: { plan: "agency", source: "disposable-compose-fixture" },
    } });
    return user;
  });
  const { workspace } = await createTenantWorkspace(actor.id, { name: "Agency test workspace" }, "local-agency-fixture-v1");
  await withTenantTransaction({ organizationId: workspace.organizationId!, actorId: actor.id }, async client => {
    await client.query(`INSERT INTO organization_subscriptions
      ("organizationId","planId",provider,status,"seatLimit","currentPeriodStart","currentPeriodEnd")
      VALUES ($1::uuid,$2::uuid,'local-fixture','ACTIVE',50,now(),now()+interval '30 days')`,
      [workspace.organizationId, plan.id]);
    await client.query(`INSERT INTO durable_outbox
      ("organizationId","eventType","aggregateType","aggregateId",payload)
      VALUES ($1::uuid,'billing.subscription.changed','organization',$1::uuid,$2::jsonb)`,
      [workspace.organizationId, JSON.stringify({ planId: plan.id, status: "ACTIVE", source: "local-fixture" })]);
  });
  console.log(JSON.stringify({ email, password, plan: "Agency", workspaceId: workspace.id,
    expiresInDays: 30, note: "Disposable local test account; no payment or provider entitlement was verified." }));
} finally {
  await prisma.$disconnect();
  await pgPool.end();
}
