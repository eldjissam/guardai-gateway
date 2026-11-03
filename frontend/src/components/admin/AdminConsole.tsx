import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowLeft, ArrowRight, BarChart3,
  CheckCircle2, Clock3, Copy, Filter, LockKeyhole, RefreshCw, Search, ShieldAlert,
  ShieldCheck, Trash2, Users, UserPlus, X, XCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import ProjectTeamManager from "./ProjectTeamManager";
import "./admin-operations.css";

export type AdminSection = "overview" | "logs" | "users" | "team";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type SecurityEvent = {
  id: string; request_id: string; user_id: string; risk_score: number; risk_level: RiskLevel;
  entities_detected: number; entity_breakdown: Record<string, number> | null;
  status: "SUCCESS" | "FAILED"; processing_time_ms: number | null; created_at: string;
};
type AdminUser = {
  id: string; full_name: string | null; email: string | null; role: "user" | "admin";
  created_at: string; email_confirmed_at: string | null; last_sign_in_at: string | null;
};
type Metrics = {
  totalRequests: number; protectedRequests: number; failedRequests: number; entitiesDetected: number;
  highRiskRequests: number; averageRisk: number; activeUsers: number; registeredUsers: number;
  categories: Record<string, number>; dailyActivity: Array<{ day: string; requests: number }>;
};
type UserMetrics = { totalUsers: number; adminUsers: number; regularUsers: number; pendingInvitations: number; newUsersLast30Days: number };

const EMPTY_METRICS: Metrics = { totalRequests: 0, protectedRequests: 0, failedRequests: 0, entitiesDetected: 0, highRiskRequests: 0, averageRisk: 0, activeUsers: 0, registeredUsers: 0, categories: {}, dailyActivity: [] };
const EMPTY_USER_METRICS: UserMetrics = { totalUsers: 0, adminUsers: 0, regularUsers: 0, pendingInvitations: 0, newUsersLast30Days: 0 };
const PAGE_SIZES = [10, 20, 50];
const categoryNames: Record<string, string> = { PERSON: "Person names", EMAIL: "Email addresses", PHONE: "Phone numbers", CARD: "Payment cards", ORG: "Organizations", API_KEY: "API credentials" };
const formatNumber = (value: number) => new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
const formatDate = (value: string) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const dayStart = (value: string) => value ? new Date(`${value}T00:00:00`).toISOString() : null;
const dayEndExclusive = (value: string) => value ? new Date(new Date(`${value}T00:00:00`).getTime() + 86400000).toISOString() : null;

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "The request could not be completed. Please try again.";
}

async function adminAction(payload: Record<string, string>) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("admin-manage-users", { body: payload });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context instanceof Response) {
      const body = await context.clone().json().catch(() => null) as { error?: string } | null;
      throw new Error(body?.error || error.message);
    }
    throw error;
  }
  if (!data?.success) throw new Error(data?.error || "The administrator action was not confirmed.");
  return data as { success: true; message: string; userId?: string };
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="ao-page-heading"><div><span className="ao-eyebrow"><ShieldCheck size={14} /> {eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <div className="ao-page-heading-action">{action}</div>}</div>;
}

function MetricCard({ label, value, detail, icon, tone = "green" }: { label: string; value: string; detail: string; icon: ReactNode; tone?: string }) {
  return <article className={`ao-metric-card tone-${tone}`}><div className="ao-metric-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{detail}</small></article>;
}

function Pager({ page, pageSize, total, onPage, onPageSize }: { page: number; pageSize: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return <div className="ao-pagination"><span>Showing <b>{first}–{last}</b> of <b>{formatNumber(total)}</b></span><div className="ao-pagination-actions"><label>Rows <select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ArrowLeft size={15} /></button><span>Page {page} of {pages}</span><button onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page"><ArrowRight size={15} /></button></div></div>;
}

function DateFilters({ from, to, onFrom, onTo, onReset }: { from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void; onReset: () => void }) {
  return <div className="ao-date-filters"><label>From <input type="date" value={from} max={to || undefined} onChange={(event) => onFrom(event.target.value)} /></label><label>To <input type="date" value={to} min={from || undefined} onChange={(event) => onTo(event.target.value)} /></label><button className="ao-button ao-button-quiet" onClick={onReset}><X size={14} /> Reset dates</button></div>;
}

function exportCsv(events: SecurityEvent[]) {
  const headers = ["request_id", "created_at", "user_id", "risk_score", "risk_level", "entities_detected", "status", "processing_time_ms"];
  const rows = events.map((event) => [event.request_id, event.created_at, event.user_id, event.risk_score, event.risk_level, event.entities_detected, event.status, event.processing_time_ms ?? ""]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `guardai-security-events-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
}

export default function AdminConsole({ section }: { section: AdminSection }) {
  const [flash, setFlash] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  return <div className="admin-operations">
    {flash && <div className={`ao-flash ${flash.kind}`} role="status"><span>{flash.message}</span><button onClick={() => setFlash(null)} aria-label="Dismiss notification"><X size={15} /></button></div>}
    {section === "overview" && <Overview onOpenLogs={() => window.dispatchEvent(new CustomEvent("guardai-admin-open-logs"))} />}
    {section === "logs" && <SecurityLogs />}
    {section === "users" && <UserManagement onChanged={(message) => setFlash({ kind: "success", message })} />}
    {section === "team" && <ProjectTeamManager onNotice={(message, kind = "success") => setFlash({ kind, message })} />}
  </div>;
}

function Overview({ onOpenLogs }: { onOpenLogs: () => void }) {
  const [preset, setPreset] = useState<"7d" | "30d" | "90d" | "all" | "custom">("30d");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [recent, setRecent] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }
    setLoading(true); setError("");
    if (preset === "custom" && !from && !to) {
      setError("Choose a start date, an end date, or both to apply a custom range.");
      setMetrics(EMPTY_METRICS);
      setRecent([]);
      setLoading(false);
      return;
    }
    const now = new Date(); let since: string | null = null; let until: string | null = null;
    if (preset === "custom") { since = dayStart(from); until = dayEndExclusive(to); }
    else if (preset !== "all") { const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90; since = new Date(now.getTime() - days * 86400000).toISOString(); }
    let recentQuery = supabase.from("security_events").select("id,request_id,user_id,risk_score,risk_level,entities_detected,entity_breakdown,status,processing_time_ms,created_at").order("created_at", { ascending: false }).limit(6);
    if (since) recentQuery = recentQuery.gte("created_at", since);
    if (until) recentQuery = recentQuery.lt("created_at", until);
    const [metricsResult, eventsResult] = await Promise.all([
      supabase.rpc("get_guardai_admin_metrics", { p_since: since, p_until: until }),
      recentQuery,
    ]);
    if (metricsResult.error || eventsResult.error) setError(metricsResult.error?.message || eventsResult.error?.message || "Dashboard data could not be loaded.");
    else { setMetrics({ ...EMPTY_METRICS, ...(metricsResult.data as Partial<Metrics>) }); setRecent((eventsResult.data ?? []) as SecurityEvent[]); setUpdatedAt(new Date()); }
    setLoading(false);
  }, [preset, from, to]);
  useEffect(() => { void load(); }, [load]);
  const maxActivity = Math.max(1, ...metrics.dailyActivity.map((item) => Number(item.requests)));
  const categories = Object.entries(metrics.categories).sort((a, b) => Number(b[1]) - Number(a[1]));
  const protectedPercent = metrics.totalRequests ? Math.round(metrics.protectedRequests / metrics.totalRequests * 100) : 0;
  return <>
    <PageHeading eyebrow="SECURITY OVERVIEW" title="Operations at a glance" description="A live, privacy-safe view of GuardAI protection activity." action={<button className="ao-button ao-button-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "ao-spin" : ""} /> Refresh data</button>} />
    <div className="ao-filter-strip"><div className="ao-range-tabs">{(["7d", "30d", "90d", "all", "custom"] as const).map((value) => <button key={value} className={preset === value ? "active" : ""} onClick={() => setPreset(value)}>{({ "7d": "7 days", "30d": "30 days", "90d": "90 days", all: "All time", custom: "Custom" })[value]}</button>)}</div>{preset === "custom" && <DateFilters from={from} to={to} onFrom={setFrom} onTo={setTo} onReset={() => { setFrom(""); setTo(""); setPreset("30d"); }} />}</div>
    {error && <div className="ao-error"><AlertTriangle size={17} />{error}</div>}
    {loading ? <div className="ao-loading"><RefreshCw className="ao-spin" /> Loading real database metrics…</div> : <>
      <div className="ao-metric-grid">
        <MetricCard label="Total requests" value={formatNumber(metrics.totalRequests)} detail={`${formatNumber(metrics.activeUsers)} users active in range`} icon={<Activity size={18} />} />
        <MetricCard label="Protected requests" value={formatNumber(metrics.protectedRequests)} detail={`${protectedPercent}% successfully processed`} icon={<ShieldCheck size={18} />} />
        <MetricCard label="Sensitive entities" value={formatNumber(metrics.entitiesDetected)} detail="Detected and tokenized" icon={<LockKeyhole size={18} />} tone="blue" />
        <MetricCard label="High-risk requests" value={formatNumber(metrics.highRiskRequests)} detail={`${formatNumber(metrics.failedRequests)} failed requests`} icon={<ShieldAlert size={18} />} tone="amber" />
        <MetricCard label="Average risk score" value={`${Math.round(metrics.averageRisk)}/100`} detail="Across recorded requests" icon={<BarChart3 size={18} />} tone="violet" />
        <MetricCard label="Registered accounts" value={formatNumber(metrics.registeredUsers)} detail="All GuardAI accounts" icon={<Users size={18} />} />
      </div>
      <div className="ao-overview-grid">
        <section className="ao-card"><div className="ao-card-heading"><div><h2>Request activity</h2><p>Daily activity within the selected range, capped at 90 days; All time shows the latest 30 days</p></div><span className="ao-heading-icon"><Activity size={17} /></span></div>
          {metrics.dailyActivity.length ? <div className="ao-chart-bars">{metrics.dailyActivity.map((item) => <div className="ao-chart-bar" key={item.day} title={`${item.day}: ${item.requests} requests`}><div className="ao-chart-track"><i style={{ height: `${Math.max(4, Number(item.requests) / maxActivity * 100)}%` }} /></div><small>{new Date(`${item.day}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "short" })}</small></div>)}</div> : <div className="ao-empty">No request activity for this period.</div>}
        </section>
        <section className="ao-card"><div className="ao-card-heading"><div><h2>Detected information types</h2><p>Aggregate entity categories only</p></div><span className="ao-heading-icon"><ShieldCheck size={17} /></span></div>
          {categories.length ? <div className="ao-category-list">{categories.map(([key, count]) => <div className="ao-category" key={key}><div><span>{categoryNames[key] ?? key.replaceAll("_", " ")}</span><b>{formatNumber(Number(count))}</b></div><div className="ao-progress"><i style={{ width: `${Math.max(2, Number(count) / Math.max(1, ...categories.map(([, n]) => Number(n))) * 100)}%` }} /></div></div>)}</div> : <div className="ao-empty">No sensitive entities recorded yet.</div>}
        </section>
      </div>
      <section className="ao-card"><div className="ao-card-heading"><div><h2>Latest security activity</h2><p>Metadata only. Original prompts and sensitive values are never shown.</p></div><button className="ao-link-button" onClick={onOpenLogs}>Open audit log <ArrowRight size={14} /></button></div><EventTable events={recent} names={new Map()} /></section>
    </>}
    <div className="ao-bottom-note"><span><ShieldCheck size={14} /> Privacy-safe administration · no prompt content exposed</span><span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting data"}</span></div>
  </>;
}

function SecurityLogs() {
  const [rows, setRows] = useState<SecurityEvent[]>([]); const [names, setNames] = useState<Map<string, string>>(new Map());
  const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10);
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [risk, setRisk] = useState("all"); const [status, setStatus] = useState("all"); const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }
    setLoading(true); setError("");
    let query = supabase.from("security_events").select("id,request_id,user_id,risk_score,risk_level,entities_detected,entity_breakdown,status,processing_time_ms,created_at", { count: "exact" }).order("created_at", { ascending: false });
    if (from) query = query.gte("created_at", dayStart(from)!);
    if (to) query = query.lt("created_at", dayEndExclusive(to)!);
    if (risk !== "all") query = query.eq("risk_level", risk);
    if (status !== "all") query = query.eq("status", status);
    const cleanSearch = search.trim();
    if (cleanSearch) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanSearch);
      if (!isUuid) { setRows([]); setNames(new Map()); setTotal(0); setLoading(false); return; }
      query = query.eq("request_id", cleanSearch);
    }
    const { data, count, error: queryError } = await query.range((page - 1) * pageSize, page * pageSize - 1);
    if (queryError) { setError(queryError.message); setRows([]); setTotal(0); setLoading(false); return; }
    const events = (data ?? []) as SecurityEvent[]; setRows(events); setTotal(count ?? 0);
    const ids = [...new Set(events.map((event) => event.user_id))];
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      setNames(new Map((profiles ?? []).map((profile) => [profile.id, profile.email || profile.full_name || `${profile.id.slice(0, 8)}…`])));
    } else setNames(new Map());
    setLoading(false);
  }, [from, to, risk, status, search, page, pageSize]);
  useEffect(() => { void load(); }, [load]);
  const resetFilters = () => { setFrom(""); setTo(""); setRisk("all"); setStatus("all"); setSearch(""); setPage(1); };
  return <>
    <PageHeading eyebrow="AUDIT & COMPLIANCE" title="Security audit log" description="Search and inspect request metadata without exposing prompt content." action={<button className="ao-button ao-button-secondary" onClick={() => exportCsv(rows)} disabled={!rows.length}><ArrowDownToLine size={15} /> Export current page</button>} />
    <div className="ao-filter-panel"><div className="ao-filter-title"><Filter size={15} /> Filters</div><div className="ao-filter-grid"><label className="ao-search-field"><Search size={16} /><input placeholder="Paste a full request ID…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><label>Risk level<select value={risk} onChange={(event) => { setRisk(event.target.value); setPage(1); }}><option value="all">All risks</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="SUCCESS">Successful</option><option value="FAILED">Failed</option></select></label><label>From<input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label><label>To<input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label><button className="ao-button ao-button-quiet" onClick={resetFilters}><X size={14} /> Clear filters</button></div></div>
    {error && <div className="ao-error"><AlertTriangle size={17} />{error}</div>}
    <section className="ao-card"><div className="ao-card-heading"><div><h2>Recorded events</h2><p>{formatNumber(total)} matching records · newest first</p></div><button className="ao-button ao-button-quiet" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "ao-spin" : ""} /> Refresh</button></div>{loading ? <div className="ao-loading"><RefreshCw className="ao-spin" /> Loading audit records…</div> : <EventTable events={rows} names={names} />}
      <Pager page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={(value) => { setPageSize(value); setPage(1); }} />
    </section>
  </>;
}

function EventTable({ events, names }: { events: SecurityEvent[]; names: Map<string, string> }) {
  if (!events.length) return <div className="ao-empty">No security events match these filters.</div>;
  return <div className="ao-table-wrap"><table className="ao-table"><thead><tr><th>Time</th><th>Account</th><th>Risk</th><th>Entities</th><th>Status</th><th>Duration</th><th>Request ID</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td data-label="Time">{formatDate(event.created_at)}</td><td data-label="Account">{names.get(event.user_id) ?? `${event.user_id.slice(0, 8)}…`}</td><td data-label="Risk"><span className={`ao-pill risk-${event.risk_level.toLowerCase()}`}>{event.risk_level} · {event.risk_score}</span></td><td data-label="Entities">{event.entities_detected}</td><td data-label="Status"><span className={`ao-pill ${event.status === "SUCCESS" ? "success" : "danger"}`}>{event.status === "SUCCESS" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}{event.status}</span></td><td data-label="Duration">{event.processing_time_ms == null ? "—" : `${formatNumber(event.processing_time_ms)} ms`}</td><td data-label="Request ID"><span className="ao-request-id"><code title={event.request_id}>{event.request_id.slice(0, 8)}…</code><button type="button" className="ao-copy-id" title="Copy full request ID" aria-label="Copy full request ID" onClick={() => { void navigator.clipboard?.writeText(event.request_id); }}><Copy size={12} /></button></span></td></tr>)}</tbody></table></div>;
}

function UserManagement({ onChanged }: { onChanged: (message: string) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]); const [total, setTotal] = useState(0); const [stats, setStats] = useState<UserMetrics>(EMPTY_USER_METRICS);
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10); const [search, setSearch] = useState(""); const [role, setRole] = useState("all"); const [verification, setVerification] = useState("all"); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [showInvite, setShowInvite] = useState(false); const [busyId, setBusyId] = useState("");
  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }
    setLoading(true); setError("");
    let query = supabase.from("profiles").select("id,full_name,email,role,created_at,email_confirmed_at,last_sign_in_at", { count: "exact" }).order("created_at", { ascending: false });
    if (role !== "all") query = query.eq("role", role);
    if (verification === "verified") query = query.not("email_confirmed_at", "is", null);
    if (verification === "pending") query = query.is("email_confirmed_at", null);
    if (from) query = query.gte("created_at", dayStart(from)!);
    if (to) query = query.lt("created_at", dayEndExclusive(to)!);
    const q = search.trim().replace(/[,%()]/g, "");
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
    const [listResult, statsResult] = await Promise.all([
      query.range((page - 1) * pageSize, page * pageSize - 1),
      supabase.rpc("get_guardai_admin_user_metrics"),
    ]);
    if (listResult.error || statsResult.error) setError(listResult.error?.message || statsResult.error?.message || "User data could not be loaded. Apply the admin operations migration.");
    else {
      const nextTotal = listResult.count ?? 0;
      const lastPage = Math.max(1, Math.ceil(nextTotal / pageSize));
      if (page > lastPage) { setPage(lastPage); setLoading(false); return; }
      setUsers((listResult.data ?? []) as AdminUser[]);
      setTotal(nextTotal);
      setStats({ ...EMPTY_USER_METRICS, ...(statsResult.data as Partial<UserMetrics>) });
    }
    setLoading(false);
  }, [role, verification, from, to, search, page, pageSize]);
  useEffect(() => { void load(); }, [load]);
  const updateRole = async (target: AdminUser, nextRole: string) => {
    if (target.role === nextRole) return;
    const confirmed = window.confirm(`Change ${target.full_name || target.email || "this account"} to ${nextRole.toUpperCase()}?`);
    if (!confirmed) return;
    setBusyId(target.id); setError("");
    try { const result = await adminAction({ action: "set_role", userId: target.id, role: nextRole }); onChanged(result.message); await load(); }
    catch (actionError) { setError(getErrorMessage(actionError)); }
    finally { setBusyId(""); }
  };
  const deleteUser = async (target: AdminUser) => {
    const confirmed = window.confirm(`Permanently delete ${target.full_name || target.email || "this account"}? Their GuardAI account, conversations and associated records will be removed. This cannot be undone.`);
    if (!confirmed) return;
    setBusyId(target.id); setError("");
    try { const result = await adminAction({ action: "delete", userId: target.id }); onChanged(result.message); await load(); }
    catch (actionError) { setError(getErrorMessage(actionError)); }
    finally { setBusyId(""); }
  };
  const clear = () => { setSearch(""); setRole("all"); setVerification("all"); setFrom(""); setTo(""); setPage(1); };
  return <>
    <PageHeading eyebrow="IDENTITY & ACCESS" title="User management" description="Invite accounts, review verification status and maintain least-privilege access." action={<button className="ao-button ao-button-primary" onClick={() => setShowInvite(true)}><UserPlus size={16} /> Invite user</button>} />
    <div className="ao-metric-grid ao-user-metrics"><MetricCard label="Total accounts" value={formatNumber(stats.totalUsers)} detail="All registered profiles" icon={<Users size={18} />} /><MetricCard label="Standard users" value={formatNumber(stats.regularUsers)} detail="Regular GuardAI accounts" icon={<Users size={18} />} tone="blue" /><MetricCard label="Administrators" value={formatNumber(stats.adminUsers)} detail="Privileged accounts" icon={<ShieldCheck size={18} />} tone="violet" /><MetricCard label="Pending verification" value={formatNumber(stats.pendingInvitations)} detail={`${formatNumber(stats.newUsersLast30Days)} new accounts in 30 days`} icon={<Clock3 size={18} />} tone="amber" /></div>
    <div className="ao-filter-panel"><div className="ao-filter-title"><Filter size={15} /> Directory filters</div><div className="ao-filter-grid"><label className="ao-search-field"><Search size={16} /><input placeholder="Search name or email…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><label>Account role<select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="all">All roles</option><option value="user">User</option><option value="admin">Administrator</option></select></label><label>Email status<select value={verification} onChange={(event) => { setVerification(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="verified">Verified</option><option value="pending">Pending</option></select></label><label>Joined from<input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label><label>Joined to<input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label><button className="ao-button ao-button-quiet" onClick={clear}><X size={14} /> Clear filters</button></div></div>
    {error && <div className="ao-error"><AlertTriangle size={17} />{error}</div>}
    <section className="ao-card"><div className="ao-card-heading"><div><h2>Registered accounts</h2><p>{formatNumber(total)} matching account records · select a role to update permissions</p></div><button className="ao-button ao-button-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "ao-spin" : ""} /> Refresh</button></div>
      {loading ? <div className="ao-loading"><RefreshCw className="ao-spin" /> Loading user directory…</div> : users.length ? <div className="ao-table-wrap"><table className="ao-table ao-user-table"><thead><tr><th>Account</th><th>Role</th><th>Email status</th><th>Joined</th><th>Last sign-in</th><th>Actions</th></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td data-label="Account"><div className="ao-account-cell"><span className="ao-account-avatar">{(item.full_name || item.email || "U").slice(0, 1).toUpperCase()}</span><span><b>{item.full_name || "Name not provided"}</b><small>{item.email || item.id.slice(0, 12)}</small></span></div></td><td data-label="Role"><select className="ao-role-select" value={item.role} disabled={busyId === item.id} onChange={(event) => void updateRole(item, event.target.value)}><option value="user">User</option><option value="admin">Administrator</option></select></td><td data-label="Email status"><span className={`ao-pill ${item.email_confirmed_at ? "success" : "pending"}`}>{item.email_confirmed_at ? "Verified" : "Pending"}</span></td><td data-label="Joined">{new Date(item.created_at).toLocaleDateString()}</td><td data-label="Last sign-in">{item.last_sign_in_at ? new Date(item.last_sign_in_at).toLocaleDateString() : "Never"}</td><td data-label="Actions"><button className="ao-icon-danger" onClick={() => void deleteUser(item)} disabled={busyId === item.id} aria-label={`Delete ${item.email || "user"}`}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div> : <div className="ao-empty">No accounts match the selected filters.</div>}
      <Pager page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={(value) => { setPageSize(value); setPage(1); }} />
    </section>
    {showInvite && <InviteUserDialog onClose={() => setShowInvite(false)} onInvited={async (message) => { setShowInvite(false); onChanged(message); await load(); }} />}
  </>;
}

function InviteUserDialog({ onClose, onInvited }: { onClose: () => void; onInvited: (message: string) => Promise<void> }) {
  const [fullName, setFullName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState("user"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); if (busy) return; setBusy(true); setError(""); try { const result = await adminAction({ action: "invite", fullName: fullName.trim(), email: email.trim().toLowerCase(), role }); await onInvited(result.message); } catch (actionError) { setError(getErrorMessage(actionError)); } finally { setBusy(false); } };
  return <div className="ao-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><section className="ao-modal" role="dialog" aria-modal="true" aria-labelledby="ao-invite-title"><button className="ao-modal-close" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} /></button><span className="ao-eyebrow"><UserPlus size={14} /> NEW ACCOUNT</span><h2 id="ao-invite-title">Invite a GuardAI user</h2><p>The person receives an invitation email and creates their own password. GuardAI never asks an administrator to set a user's password.</p><form onSubmit={submit} className="ao-form"><label>Full name<input required minLength={2} maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" /></label><label>Email address<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label><label>Account role<select value={role} onChange={(event) => setRole(event.target.value)}><option value="user">User</option><option value="admin">Administrator</option></select></label>{role === "admin" && <div className="ao-warning-note"><AlertTriangle size={15} /> Administrator accounts can access all GuardAI administration tools. Only invite trusted team members.</div>}{error && <div className="ao-error">{error}</div>}<div className="ao-modal-actions"><button type="button" className="ao-button ao-button-quiet" onClick={onClose} disabled={busy}>Cancel</button><button className="ao-button ao-button-primary" disabled={busy}>{busy ? "Sending invitation…" : "Send invitation"} <ArrowRight size={15} /></button></div></form></section></div>;
}
