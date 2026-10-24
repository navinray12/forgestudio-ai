import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, CalendarDays, ChevronDown, Database, Globe, Image, Info, KeyRound, Layers, RefreshCw, Sparkles, Zap } from "lucide-react";
import { chartBuckets, dateLabel, number, percentage, type DashboardUsage, type UsageRange } from "./usage-model";
import "./UsageView.css";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
function Meter({ value, label }: { value: number | null; label: string }) {
  return value == null ? <div className="usage-meter-unavailable">Usage percentage unavailable</div> : <progress aria-label={label} value={value} max={100} />;
}
function QuotaCard({ title, icon, badge, children, tone }: { title: string; icon: ReactNode; badge: string; children: ReactNode; tone: string }) {
  return <article className={`usage-quota usage-tone-${tone}`}><div className="usage-quota-heading"><span className="usage-icon">{icon}</span><h2>{title}</h2><span className="usage-badge">{badge}</span></div>{children}</article>;
}

export default function UsageView() {
  const [range, setRange] = useState<UsageRange>("cycle");
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<DashboardUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [details, setDetails] = useState(false);
  const [siteFilter, setSiteFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(""); setData(null); setSessionExpired(false);
      try {
        const response = await fetch(`${apiUrl}/api/v1/users/me/usage/dashboard?range=${range}`, { credentials: "include", signal: controller.signal, cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (response.status === 401) { setSessionExpired(true); throw new Error("Your session has expired. Sign in again to view usage."); }
        if (!response.ok || !body?.success || !body.websites || !body.credits || !body.range) throw new Error(body?.error?.message || body?.message || "Unable to load account usage.");
        setData(body as DashboardUsage);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load account usage.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [range, retry]);
  const buckets = useMemo(() => data ? chartBuckets(data) : [], [data]);
  const maxUnits = Math.max(1, ...buckets.map(point => point.units));
  const rows = data?.activity?.breakdown ?? [];
  const filteredRows = rows.filter(row => (!siteFilter || row.websiteId === siteFilter) && (!userFilter || row.userId === userFilter));
  const storageMb = data?.storage.usedBytes == null ? null : data.storage.usedBytes / (1024 * 1024);
  const websitePercent = data ? percentage(data.websites.used, data.websites.limit) : null;
  const storagePercent = data ? percentage(storageMb, data.storage.limitMb) : null;
  const remainingSlots = data?.websites.used == null || data.websites.limit == null ? null : Math.max(0, data.websites.limit - data.websites.used);
  const storageFree = storageMb == null || data?.storage.limitMb == null ? null : Math.max(0, data.storage.limitMb - storageMb);
  const cycleEnd = data?.subscription?.currentPeriodEnd;
  const cycleDays = cycleEnd && data ? Math.ceil((Date.parse(cycleEnd) - Date.parse(data.generatedAt)) / 86400000) : null;
  return <div className="usage-page">
    <div className="usage-heading"><div><h1>Site Usage</h1><p>Track your account resources and activity across your owned websites.</p></div><div className="usage-toolbar"><label className="usage-range"><CalendarDays size={14} /><select aria-label="Usage date range" value={range} onChange={event => { setRange(event.target.value as UsageRange); setSiteFilter(""); setUserFilter(""); }}><option value="cycle">Current billing cycle</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option></select><ChevronDown size={13} /></label><button className="usage-refresh" aria-label="Refresh usage" disabled={loading} onClick={() => setRetry(value => value + 1)}><RefreshCw size={15} className={loading ? "spin" : ""} /></button></div></div>
    {data && <p className="usage-period">{data.subscription?.planName ? `${data.subscription.planName} plan · ` : ""}{dateLabel(data.range.start)} – {dateLabel(range === "cycle" ? data.subscription?.currentPeriodEnd ?? data.range.end : data.range.end)} <span>UTC · Account usage</span></p>}
    {error && <div className="usage-alert" role="alert"><span>{error}</span>{sessionExpired ? <Link to="/login">Sign in</Link> : <button onClick={() => setRetry(value => value + 1)}>Try again</button>}</div>}
    {loading && <div className="usage-loading" role="status"><div className="usage-skeletons">{[0, 1, 2, 3].map(index => <div key={index} />)}</div><span>Loading account usage…</span></div>}
    {data && <>
      {data.issues.length > 0 && <div className="usage-alert" role="alert"><div><strong>Some usage data is unavailable.</strong>{data.issues.map(issue => <p key={issue}>{issue}</p>)}</div><button onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
      <div className="usage-quotas">
        <QuotaCard title="Website Slots" tone="blue" icon={<Globe size={17} />} badge={`${number(data.websites.used)} / ${number(data.websites.limit)}`}><div className="usage-value"><strong>{number(data.websites.used)}</strong><span>of {number(data.websites.limit)} used</span></div><Meter value={websitePercent} label="Website slots used" /><div className="usage-quota-footer"><span>{remainingSlots == null ? "Capacity unavailable" : `${number(remainingSlots)} slots available`}</span><span>{websitePercent == null ? "—" : `${number(websitePercent)}%`}</span></div></QuotaCard>
        <QuotaCard title="Storage Used" tone="purple" icon={<Layers size={17} />} badge="MEDIA"><div className="usage-value"><strong>{storageMb == null ? "Unavailable" : `${number(storageMb)} MB`}</strong><span>of {number(data.storage.limitMb)} MB</span></div><Meter value={storagePercent} label="Storage used" /><div className="usage-quota-footer"><span>{storageFree == null ? "Capacity unavailable" : `${number(storageFree)} MB free`}</span><span>{storagePercent == null ? "—" : `${number(storagePercent)}%`}</span></div></QuotaCard>
        <QuotaCard title="Image Opt. Credits" tone="teal" icon={<Image size={17} />} badge="BALANCE"><div className="usage-value"><strong>{number(data.optimization.balance)}</strong></div><p className="usage-muted">optimization credits remaining</p><div className="usage-quota-footer"><span>{data.optimization.performed == null ? "History unavailable" : `${number(data.optimization.performed)} optimizations performed`}</span></div></QuotaCard>
        <QuotaCard title="Active Licenses" tone="amber" icon={<KeyRound size={17} />} badge="SITES"><div className="usage-value"><strong>{number(data.licensing?.production)}</strong><span>prod ({number(data.licensing?.development)} dev)</span></div><div className="usage-quota-footer"><span>{data.licensing ? `${number(data.licensing.activeLicenses)} active license key(s)` : "Licenses unavailable"}</span></div></QuotaCard>
      </div>
      <section className="usage-credit-panel" aria-label="Credit balance"><h2><Database size={16} /> Credit balance</h2><div className="usage-credit-heading"><strong>{data.credits.remaining == null ? "Balance unavailable" : `${number(percentage(data.credits.remaining, data.credits.allowance))}% remaining`}</strong><span>{data.credits.remaining == null ? `${number(data.credits.allowance)} AI credits in your plan allowance` : `${number(data.credits.remaining)} / ${number(data.credits.allowance)} credits remaining`}</span></div><Meter value={percentage(data.credits.remaining, data.credits.allowance)} label="AI credits remaining" /><div className="usage-credit-footer"><p><Info size={15} /><span>{cycleDays == null ? "A credit reset date is not available." : cycleDays > 0 ? `Current billing period ends in ${cycleDays} day${cycleDays === 1 ? "" : "s"}.` : "The recorded billing period has ended."}</span></p><Link to="/subscriptions">Manage plan <ArrowRight size={14} /></Link></div><p className="usage-metering-note">{data.credits.message}</p></section>
      <div className="usage-activity-grid"><section className="usage-panel usage-features"><h2><span className="usage-feature-icon"><Zap size={18} /></span> Features Used</h2><strong>{number(data.activity?.executions)}</strong><p className="usage-muted">{data.activity ? "completed AI operations in this period" : "Activity is unavailable for this period"}</p><div className="usage-feature-total"><Activity size={14} /><span>{number(data.activity?.units)} recorded execution units</span></div></section>
        <section className="usage-panel usage-chart-panel" aria-label="AI activity"><div className="usage-chart-heading"><h2>Credit activity</h2><span>{range === "cycle" ? "Current billing cycle" : range === "30d" ? "Last 30 days" : "Last 90 days"}</span></div><p className="usage-muted">Recorded execution units · UTC</p>{data.activity ? <><div className="usage-chart"><svg viewBox="0 0 700 180" role="img" aria-label={`AI activity: ${number(data.activity.units)} execution units across ${number(data.activity.executions)} completed operations`}><line x1="8" x2="692" y1="145" y2="145" stroke="#2b2544" />{[0, .5, 1].map(factor => <g key={factor}><line x1="30" x2="692" y1={145 - factor * 115} y2={145 - factor * 115} stroke="#242036" strokeDasharray="3 5" /><text x="0" y={141 - factor * 115} fill="#89839f" fontSize="9">{number(maxUnits * factor)}</text></g>)}{buckets.map((point, index) => { const width = 650 / Math.max(buckets.length, 1); const height = point.units / maxUnits * 112; return <g key={point.date}><rect x={35 + index * width} y={145 - height} width={Math.max(2, width * .42)} height={height} rx="3" fill="#a460e4"><title>{dateLabel(point.date)}: {number(point.units)} units, {number(point.executions)} operations</title></rect>{(index === 0 || index === buckets.length - 1 || (index < buckets.length - 3 && index % Math.max(1, Math.ceil(buckets.length / 5)) === 0)) && <text x={35 + index * width} y="169" textAnchor={index === buckets.length - 1 ? "end" : "start"} fill="#89839f" fontSize="10">{new Date(point.date).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}</text>}</g>; })}</svg></div>{data.activity.executions === 0 && <p className="usage-empty"><Sparkles size={14} />No credit activity to display</p>}</> : <p className="usage-empty">Activity is unavailable. Try another date range or refresh.</p>}</section></div>
      <section className="usage-panel usage-breakdown"><div className="usage-breakdown-heading"><span className="usage-icon"><Database size={18} /></span><div><h2>Credit usage by site and user</h2><p className="usage-muted">See which owned sites and users recorded AI activity during the selected date range.</p></div><button disabled={!data.activity || rows.length === 0} aria-expanded={details} aria-controls={rows.length ? "usage-details" : undefined} onClick={() => setDetails(value => !value)}>{details ? "Hide details" : "View details"}<ArrowRight size={14} /></button></div>
        {!data.activity ? <p className="usage-empty">Site and user usage is unavailable.</p> : rows.length === 0 ? <p className="usage-empty"><Sparkles size={14} />No credit activity to display</p> : <><div className="usage-breakdown-summary">{number(data.activity.executions)} completed operations · {number(data.activity.units)} execution units · {new Set(rows.map(row => row.websiteId)).size} sites</div><div id="usage-details" hidden={!details}><div className="usage-filters"><label>Site<select aria-label="Filter usage by site" value={siteFilter} onChange={event => setSiteFilter(event.target.value)}><option value="">All sites</option>{[...new Map(rows.map(row => [row.websiteId, row.websiteName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>User<select aria-label="Filter usage by user" value={userFilter} onChange={event => setUserFilter(event.target.value)}><option value="">All users</option>{[...new Map(rows.map(row => [row.userId, row.userName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div><div className="usage-table-wrap"><table><caption>Recorded AI execution usage by site and user</caption><thead><tr><th>Site</th><th>User</th><th>Operations</th><th>Execution units</th></tr></thead><tbody>{filteredRows.map(row => <tr key={`${row.websiteId}:${row.userId}`}><td>{row.websiteName}</td><td>{row.userName}</td><td>{number(row.executions)}</td><td>{number(row.units)}</td></tr>)}</tbody></table>{filteredRows.length === 0 && <p className="usage-empty">No activity matches these filters.</p>}</div></div></>}
      </section>
    </>}
  </div>;
}
