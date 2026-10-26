export type UsageRange = "cycle" | "30d" | "90d";
export interface DashboardUsage {
  success: boolean; scope: "owned_sites"; generatedAt: string; issues: string[];
  subscription: { status: string; planName: string; currentPeriodStart: string; currentPeriodEnd: string | null; billingInterval: string } | null;
  range: { key: UsageRange; start: string | null; end: string };
  websites: { used: number | null; limit: number | null };
  storage: { usedBytes: number | null; limitMb: number | null };
  optimization: { balance: number | null; performed: number | null };
  licensing: { activeLicenses: number; production: number; development: number } | null;
  credits: { status: string; allowance: number | null; used: number | null; remaining: number | null; message: string };
  activity: { units: number; executions: number; unit: string; source: string;
    daily: Array<{ date: string; units: number; executions: number }>;
    breakdown: Array<{ websiteId: string; websiteName: string; userId: string; userName: string; units: number; executions: number }> } | null;
}
export function number(value: number | null | undefined) {
  return value == null ? "Unavailable" : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
export function percentage(used: number | null, limit: number | null): number | null {
  return used == null || limit == null || limit <= 0 ? null : Math.min(100, Math.max(0, used / limit * 100));
}
export function dateLabel(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Not available";
}
/** Zero-fill UTC days; long ranges are grouped into at most 31 buckets. */
export function chartBuckets(data: DashboardUsage) {
  if (!data.activity || !data.range.start) return [];
  const start = new Date(data.range.start); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(data.range.end); end.setUTCHours(0, 0, 0, 0);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  const step = Math.max(1, Math.ceil(days / 31));
  const buckets = Array.from({ length: Math.ceil(days / step) }, (_, index) => ({
    date: new Date(start.getTime() + index * step * 86400000).toISOString().slice(0, 10), units: 0, executions: 0,
  }));
  for (const point of data.activity.daily) {
    const index = Math.floor((Date.parse(point.date) - start.getTime()) / (step * 86400000));
    if (index >= 0 && index < buckets.length) { buckets[index].units += point.units; buckets[index].executions += point.executions; }
  }
  return buckets;
}
