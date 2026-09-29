import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import type { Prisma } from "../generated/prisma/client.js";
import { requireSubscriptionAccess } from "./billing/subscription-policy.js";

type SubscriptionWithPlan = Prisma.UserSubscriptionGetPayload<{ include: { plan: true } }>;
// Legacy callers may render these fields. Free provisioning never fabricates
// a license key or a paid invoice; verified provider integration owns them.
type PlanSelectionResult = SubscriptionWithPlan & {
  license?: { key: string; maxSites: number };
  invoiceNumber?: string;
};

function requireUserId(userId: string): void {
  if (typeof userId !== "string" || !userId) {
    throw new AppError("User ID is required", 400, "INVALID_USER_ID");
  }
}

export async function getAllActivePlans() {
  return prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { price: "asc" } });
}

/** Read-only: missing records and unavailable storage are not an active plan. */
export async function getUserSubscription(userId: string): Promise<SubscriptionWithPlan> {
  requireUserId(userId);
  const subscription = await prisma.userSubscription.findUnique({ where: { userId }, include: { plan: true } });
  if (!subscription) {
    throw new AppError("Subscription provisioning is incomplete", 503, "SUBSCRIPTION_NOT_PROVISIONED");
  }
  return subscription;
}

/** Explicit, idempotent onboarding. It cannot overwrite an existing paid plan. */
export async function assignDefaultFreePlan(userId: string): Promise<SubscriptionWithPlan> {
  requireUserId(userId);
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.userSubscription.findUnique({ where: { userId }, include: { plan: true } });
        if (existing) return existing;
        const plan = await tx.subscriptionPlan.findUnique({ where: { slug: "free" } });
        if (!plan || !plan.isActive || plan.price !== 0) {
          throw new AppError("The free plan is not configured", 503, "FREE_PLAN_UNAVAILABLE");
        }
        const subscription = await tx.userSubscription.create({
          data: { userId, planId: plan.id, status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: null },
          include: { plan: true },
        });
        await tx.auditLog.create({ data: {
          userId, action: "FREE_SUBSCRIPTION_PROVISIONED", targetResource: `subscription:${subscription.id}`,
          details: { planId: plan.id, source: "explicit-onboarding" },
        } });
        return subscription;
      }, { isolationLevel: "Serializable", maxWait: 2000, timeout: 5000 });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (attempt >= 2 || (code !== "P2034" && code !== "P2002")) throw error;
      // Only this local, transactional operation retries. There are no provider
      // side effects to duplicate; a competing provisioning attempt is reread.
    }
  }
}

/** Compatibility endpoint. Paid changes require an implemented, verified billing
 * adapter; there is deliberately no client flag or test-mode bypass.
 */
export async function changeUserPlan(userId: string, planSlug: string): Promise<PlanSelectionResult> {
  requireUserId(userId);
  if (typeof planSlug !== "string" || !/^[a-z0-9-]{1,64}$/i.test(planSlug)) {
    throw new AppError("Invalid subscription plan", 400, "INVALID_PLAN");
  }
  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: planSlug.toLowerCase() } });
  if (!plan || !plan.isActive) throw new AppError("Invalid or inactive subscription plan", 400, "INVALID_PLAN");
  if (plan.slug !== "free" || plan.price !== 0) {
    throw new AppError("Paid plan changes require verified checkout", 402, "PAYMENT_VERIFICATION_REQUIRED");
  }
  const subscription = await assignDefaultFreePlan(userId);
  if (subscription.plan.slug !== "free" || subscription.plan.price !== 0) {
    throw new AppError("Manage the existing subscription through its billing provider", 409, "BILLING_PROVIDER_REQUIRED");
  }
  return subscription;
}

export async function cancelSubscription(userId: string) {
  requireUserId(userId);
  return prisma.$transaction(async (tx) => {
    const current = await tx.userSubscription.findUnique({ where: { userId }, include: { plan: true } });
    if (!current) throw new AppError("Subscription not found", 404, "SUBSCRIPTION_NOT_FOUND");
    if (current.plan.slug !== "free" || current.plan.price !== 0) {
      throw new AppError("Provider cancellation must be confirmed before access changes", 503, "BILLING_PROVIDER_REQUIRED");
    }
    if (current.status === "CANCELED") {
      return { success: true, message: "Free subscription is already cancelled", subscription: current };
    }
    const subscription = await tx.userSubscription.update({
      where: { userId }, data: { status: "CANCELED", currentPeriodEnd: new Date() }, include: { plan: true },
    });
    await tx.auditLog.create({ data: {
      userId, action: "FREE_SUBSCRIPTION_CANCELLED", targetResource: `subscription:${subscription.id}`,
      details: { previousStatus: current.status },
    } });
    return { success: true, message: "Free subscription cancelled; new business actions are disabled", subscription };
  }, { isolationLevel: "Serializable", maxWait: 2000, timeout: 5000 });
}

export async function getUserInvoices(userId: string) {
  requireUserId(userId);
  return prisma.billingInvoice.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 200 });
}

/** Preflight only. The create handler must enforce count + insertion in one
 * transaction; caller-supplied counts are never quota authority.
 */
export async function checkWebsiteLimit(userId: string, _legacyCount?: number) {
  const subscription = await getUserSubscription(userId);
  const limit = requireSubscriptionAccess(subscription);
  const current = await prisma.website.count({ where: { userId } });
  const allowed = current < limit;
  return { allowed, limit, current, message: allowed ? undefined : "Your website limit has been reached" };
}
