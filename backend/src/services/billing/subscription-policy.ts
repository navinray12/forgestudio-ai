import { AppError } from "../../utils/app-error.js";

export interface SubscriptionAccess {
  status: string;
  currentPeriodEnd: Date | null;
  plan: { slug: string; price: number; isActive: boolean; websiteLimit: number };
}

/** Pure entitlement precondition. Billing reads themselves remain available for
 * inactive customers; business mutations must explicitly require active access.
 */
export function requireSubscriptionAccess(subscription: SubscriptionAccess, now = new Date()): number {
  const { plan, status, currentPeriodEnd } = subscription;
  const isFree = plan.slug === "free" && plan.price === 0;
  const endIsFuture = currentPeriodEnd !== null && currentPeriodEnd.getTime() > now.getTime();
  const active = status === "ACTIVE" && (isFree ? currentPeriodEnd === null || endIsFuture : endIsFuture);
  const trial = status === "TRIAL" && endIsFuture;
  const cancelledWithAccess = (status === "CANCELED" || status === "CANCELLED") && endIsFuture;
  if (!plan.isActive || !(active || trial || cancelledWithAccess)) {
    throw new AppError("Your subscription does not currently permit this action", 403, "SUBSCRIPTION_INACTIVE");
  }
  if (!Number.isSafeInteger(plan.websiteLimit) || plan.websiteLimit < 0) {
    throw new AppError("The subscription limit is unavailable", 503, "QUOTA_CONFIGURATION_INVALID");
  }
  return plan.websiteLimit;
}
