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

const DEFAULT_TIERS = [
  { name: "Free", slug: "free", price: 0, currency: "INR", billingInterval: "monthly", websiteLimit: 1, storageLimitMb: 100, aiCreditLimit: 0, features: ["1 Website", "Basic widgets", "Basic templates", "Preview", "HTML/CSS export"], isActive: true },
  { name: "Starter", slug: "starter", price: 499, currency: "INR", billingInterval: "monthly", websiteLimit: 3, storageLimitMb: 1000, aiCreditLimit: 100, features: ["3 Websites", "More templates", "More widgets", "Custom CSS", "1 GB storage", "Basic SEO"], isActive: true },
  { name: "Professional", slug: "professional", price: 999, currency: "INR", billingInterval: "monthly", websiteLimit: 10, storageLimitMb: 10000, aiCreditLimit: 1000, features: ["10 Websites", "All widgets", "Global styles", "AI features", "10 GB storage", "ZIP export", "Priority support"], isActive: true },
  { name: "Agency", slug: "agency", price: 2499, currency: "INR", billingInterval: "monthly", websiteLimit: 50, storageLimitMb: 50000, aiCreditLimit: 5000, features: ["50 Websites", "Client management", "White-label branding", "5,000 AI Credits", "50 GB storage", "Dedicated SLA"], isActive: true },
];

export async function ensureDefaultPlans(): Promise<void> {
  for (const tier of DEFAULT_TIERS) {
    try {
      await prisma.subscriptionPlan.upsert({
        where: { slug: tier.slug },
        update: { isActive: true },
        create: {
          name: tier.name,
          slug: tier.slug,
          price: tier.price,
          currency: tier.currency,
          billingInterval: tier.billingInterval,
          websiteLimit: tier.websiteLimit,
          storageLimitMb: tier.storageLimitMb,
          aiCreditLimit: tier.aiCreditLimit,
          features: tier.features,
          isActive: true,
        },
      });
    } catch {}
  }
}

export async function getAllActivePlans() {
  const plans = await prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { price: "asc" } });
  if (plans.length > 0) return plans;
  await ensureDefaultPlans();
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

export function isDevPlanSwitchingEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_PLAN_SWITCHING === "true";
}

/**
 * Plan selection endpoint. In production, paid plan changes strictly require verified checkout.
 * In development with DEV_PLAN_SWITCHING=true, allows developers to switch tiers for testing.
 */
export async function changeUserPlan(userId: string, planSlug: string): Promise<PlanSelectionResult> {
  requireUserId(userId);
  if (typeof planSlug !== "string" || !/^[a-z0-9-]{1,64}$/i.test(planSlug)) {
    throw new AppError("Invalid subscription plan", 400, "INVALID_PLAN");
  }
  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: planSlug.toLowerCase() } });
  if (!plan || !plan.isActive) throw new AppError("Invalid or inactive subscription plan", 400, "INVALID_PLAN");

  const devAllowed = isDevPlanSwitchingEnabled();

  // Strict production check: No payment bypass in production or when dev flag is disabled
  if (!devAllowed && (plan.slug !== "free" || plan.price !== 0)) {
    throw new AppError("Paid plan changes require verified checkout", 402, "PAYMENT_VERIFICATION_REQUIRED");
  }

  // Development mode plan override: safely update user subscription to the selected plan
  if (devAllowed) {
    const now = new Date();
    const isFree = plan.slug === "free" && plan.price === 0;
    // Set 1-year future expiry for paid tiers in development so entitlement checks succeed
    const currentPeriodEnd = isFree ? null : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const subscription = await prisma.$transaction(async (tx) => {
      const existing = await tx.userSubscription.findUnique({ where: { userId } });
      let record: SubscriptionWithPlan;
      if (existing) {
        record = await tx.userSubscription.update({
          where: { userId },
          data: {
            planId: plan.id,
            status: "ACTIVE",
            currentPeriodStart: now,
            currentPeriodEnd,
          },
          include: { plan: true },
        });
      } else {
        record = await tx.userSubscription.create({
          data: {
            userId,
            planId: plan.id,
            status: "ACTIVE",
            currentPeriodStart: now,
            currentPeriodEnd,
          },
          include: { plan: true },
        });
      }
      await tx.auditLog.create({
        data: {
          userId,
          action: "DEV_PLAN_SWITCHED",
          targetResource: `subscription:${record.id}`,
          details: { planId: plan.id, planSlug: plan.slug, devOverride: true },
        },
      });
      return record;
    });
    return subscription;
  }

  // Standard production flow for free plan
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
