import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma, pgPool } from "../src/config/prisma.js";
import { hashPassword } from "../src/utils/password.js";

// Explicit operator action against the isolated qualification database only.
// No session injection, password reset, production seed, or authentication exception.
const url = new URL(process.env.DATABASE_URL ?? "invalid:");
if (process.env.FORGE_DISPOSABLE_TEST_DB !== "1" || process.env.NODE_ENV !== "development" ||
    process.env.FORGE_AUTH_MODE !== "local" || url.hostname !== "127.0.0.1" ||
    url.port !== "55434" || url.pathname !== "/forge_hardening") {
  throw new Error("Requires the explicitly opted-in local qualification database on 127.0.0.1:55434/forge_hardening");
}
try {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: "agency" } });
  if (!plan?.isActive) throw new Error("Active agency plan required; seed the qualification database first");
  const suffix = randomBytes(4).toString("hex");
  const roles = process.argv.includes("--builder-only") ? ["USER"] as const : ["ADMIN", "SUPER_ADMIN"] as const;
  const accounts = roles.map(role => ({
    role, email: `${role.toLowerCase().replaceAll("_", "-")}-${suffix}@example.test`,
    password: randomBytes(24).toString("base64url"),
  }));
  const hashes = await Promise.all(accounts.map(account => hashPassword(account.password)));
  await prisma.$transaction(async tx => {
    for (const [index, account] of accounts.entries()) {
      const user = await tx.user.create({ data: {
        email: account.email, fullName: `Local ${account.role} tester`, role: account.role,
        status: "ACTIVE", emailVerified: true, verificationMethod: "EMAIL", passwordHash: hashes[index]!,
      } });
      await tx.userSubscription.create({ data: {
        userId: user.id, planId: plan.id, status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      } });
      await tx.auditLog.create({ data: {
        userId: user.id, action: "LOCAL_TEST_ACCOUNT_PROVISIONED", targetResource: `user:${user.id}`,
        details: { role: account.role, source: "disposable-qualification-fixture", plan: "agency" },
      } });
    }
  });
  // One-time credentials go only to the invoking operator, never application logs/audits.
  console.log(JSON.stringify({ accounts, loginUrl: "http://127.0.0.1:55173/login",
    note: "Local test accounts only. Email OTP is still required. Platform control requires OIDC step-up. Agency entitlement is a 30-day local fixture, not paid billing." }));
} finally {
  await prisma.$disconnect();
  await pgPool.end();
}
