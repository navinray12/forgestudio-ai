import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { getUserSubscription } from "./subscription.service.js";
import { getUserLicenses } from "./license.service.js";
import { resolveWebsiteRole } from "./websites/scoped-access.js";

export type UsageRange = "cycle" | "30d" | "90d";

/** Read-only account telemetry. Failures remain unavailable, never synthetic zeroes. */
export async function getDashboardUsage(userId: string, range: UsageRange = "cycle", now = new Date()) {
  if (!userId) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  if (!["cycle", "30d", "90d"].includes(range)) throw new AppError("Invalid usage range", 400, "INVALID_USAGE_RANGE");
  const issues: string[] = [];
  async function read<T>(label: string, operation: () => Promise<T>): Promise<T | null> {
    try { return await operation(); } catch { issues.push(label); return null; }
  }
  const [subscription, websiteCount, storage, balance, optimizations, licenses, sites] = await Promise.all([
    read("Subscription details are unavailable.", () => getUserSubscription(userId)),
    // Match checkWebsiteLimit: archived sites still consume a slot until purged.
    read("Website slots are unavailable.", () => prisma.website.count({ where: { userId } })),
    read("Storage usage is unavailable.", () => prisma.mediaAsset.aggregate({ where: { userId }, _sum: { sizeBytes: true } })),
    read("Optimization credit balance is unavailable.", () => prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { optimizationCredits: true } })),
    read("Image optimization history is unavailable.", () => prisma.optimizationCreditLedger.count({ where: { userId, actionType: "IMAGE_OPTIMIZATION", creditsUsed: { gt: 0 } } })),
    read("License usage is unavailable.", () => getUserLicenses(userId)),
    // Creator attribution alone must not bypass revoked tenant membership or VIEW denials.
    read("Site activity scope is unavailable.", () => prisma.website.findMany({
      where: { userId, deletedAt: null, status: { not: "TRASH" } },
      select: {
        id: true, userId: true, organizationId: true, workspaceId: true,
        organization: { select: { ownerId: true, members: { where: { userId }, select: { role: true } } } },
        workspace: { select: { ownerId: true, organizationId: true, lifecycleStatus: true, members: { where: { userId }, select: { role: true } } } },
        collaborators: { where: { userId }, select: { permission: true } },
        granularPermissions: { where: { userId, resourceId: "*", capability: "VIEW" }, select: { effect: true } },
      },
    })),
  ]);
  const plan = subscription?.plan;
  const cycleStart = subscription?.currentPeriodStart ?? null;
  const cycleEnd = subscription?.currentPeriodEnd ?? null;
  const end = cycleEnd && cycleEnd < now && range === "cycle" ? cycleEnd : now;
  const start = range === "cycle" ? cycleStart : new Date(now.getTime() - Number(range.slice(0, -1)) * 86400000);
  const siteIds = sites?.filter(site => resolveWebsiteRole(site, userId)).map(site => site.id);
  const activity = start && start <= end && siteIds ? await read("AI activity is unavailable.", async () => {
    // These are settled execution units, NOT a monetary or monthly credit ledger.
    const rows = await prisma.aiExecution.groupBy({
      by: ["websiteId", "actorId", "createdAt"],
      where: { websiteId: { in: siteIds }, status: "COMPLETED", createdAt: { gte: start, lt: end } },
      _sum: { reservedUnits: true }, _count: { _all: true },
    });
    const byDay = new Map<string, { date: string; units: number; executions: number }>();
    const bySiteUser = new Map<string, { websiteId: string; userId: string; units: number; executions: number }>();
    let units = 0; let executions = 0;
    for (const row of rows) {
      const count = row._count._all;
      const used = row._sum.reservedUnits ?? 0;
      units += used; executions += count;
      const date = row.createdAt.toISOString().slice(0, 10);
      const day = byDay.get(date) ?? { date, units: 0, executions: 0 };
      day.units += used; day.executions += count; byDay.set(date, day);
      const key = `${row.websiteId}:${row.actorId}`;
      const item = bySiteUser.get(key) ?? { websiteId: row.websiteId, userId: row.actorId, units: 0, executions: 0 };
      item.units += used; item.executions += count; bySiteUser.set(key, item);
    }
    const [websites, actors] = await Promise.all([
      prisma.website.findMany({ where: { id: { in: [...new Set(rows.map(row => row.websiteId))] } }, select: { id: true, name: true } }),
      prisma.user.findMany({ where: { id: { in: [...new Set(rows.map(row => row.actorId))] } }, select: { id: true, fullName: true } }),
    ]);
    return {
      units, executions, unit: "execution units", source: "completed_ai_executions",
      daily: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
      breakdown: [...bySiteUser.values()].map(item => ({ ...item,
        websiteName: websites.find(site => site.id === item.websiteId)?.name ?? "Deleted site",
        userName: actors.find(actor => actor.id === item.userId)?.fullName || "Unnamed user",
      })).sort((a, b) => b.units - a.units || a.websiteId.localeCompare(b.websiteId)),
    };
  }) : null;
  if (!start || start > end) issues.push("A valid billing cycle is not available. Select the last 30 or 90 days to view activity.");
  const active = licenses?.filter((license: { status: string; expiresAt?: string | Date | null }) =>
    license.status === "ACTIVE" && (!license.expiresAt || new Date(license.expiresAt) > now));
  return {
    success: true, scope: "owned_sites", generatedAt: now.toISOString(), issues,
    subscription: subscription ? { status: subscription.status, planName: plan?.name, currentPeriodStart: cycleStart, currentPeriodEnd: cycleEnd, billingInterval: plan?.billingInterval } : null,
    range: { key: range, start: start?.toISOString() ?? null, end: end.toISOString() },
    websites: { used: websiteCount, limit: plan?.websiteLimit ?? null },
    storage: { usedBytes: storage ? storage._sum.sizeBytes ?? 0 : null, limitMb: plan?.storageLimitMb ?? null },
    optimization: { balance: balance?.optimizationCredits ?? null, performed: optimizations },
    licensing: active ? { activeLicenses: active.length,
      production: active.reduce((sum: number, item: { telemetry: { productionActivations: number } }) => sum + item.telemetry.productionActivations, 0),
      development: active.reduce((sum: number, item: { telemetry: { localhostActivations: number } }) => sum + item.telemetry.localhostActivations, 0) } : null,
    credits: { status: "NOT_METERED", allowance: plan?.aiCreditLimit ?? null, used: null, remaining: null,
      message: "Monthly AI credit balance is not metered. Activity below shows recorded execution units, not billed credits." },
    activity,
  };
}
