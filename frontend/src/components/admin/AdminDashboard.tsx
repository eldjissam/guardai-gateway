import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowUpRight, BarChart3,
  CheckCircle2, Clock3, Database, LockKeyhole, RefreshCw, Search, ShieldCheck,
  Users, XCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./admin-dashboard.css";

type Range = "7d" | "30d" | "all";
type Tab = "overview" | "logs" | "users";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type SecurityEvent = {
  id: string;
  request_id: string;
  user_id: string;
  session_id: string | null;
  risk_score: number;
  risk_level: RiskLevel;
  entities_detected: number;
  entity_breakdown: Record<string, number> | null;
  status: "SUCCESS" | "FAILED";
  processing_time_ms: number | null;
  created_at: string;
};
type AdminUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "user" | "admin";
  created_at: string;
};
type DailyPoint = { day: string; requests: number };
type Metrics = {
  totalRequests: number;
  protectedRequests: number;
  failedRequests: number;
  entitiesDetected: number;
  highRiskRequests: number;
  averageRisk: number;
  activeUsers: number;
  registeredUsers: number;
  categories: Record<string, number>;
  dailyActivity: DailyPoint[];
};

const EMPTY_METRICS: Metrics = {
  totalRequests: 0,
  protectedRequests: 0,
  failedRequests: 0,
  entitiesDetected: 0,
  highRiskRequests: 0,
  averageRisk: 0,
  activeUsers: 0,
  registeredUsers: 0,
  categories: {},
  dailyActivity: [],
};

const categoryNames: Record<string, string> = {
  PERSON: "Person names",
  EMAIL: "Email addresses",
  PHONE: "Phone numbers",
  CARD: "Payment cards",
  ORG: "Organizations",
  API_KEY: "API credentials",
};

function number(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function dateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function sinceFor(range: Range): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function downloadCsv(events: SecurityEvent[]) {
  const headers = ["request_id", "created_at", "user_id", "risk_score", "risk_level", "entities_detected", "status", "processing_time_ms"];
  const rows = events.map((event) => [
    event.request_id,
    event.created_at,
    event.user_id,
    event.risk_score,
    event.risk_level,
    event.entities_detected,
    event.status,
    event.processing_time_ms ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `guardai-security-events-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricCard({
  label,
  value,
  description,
  icon,
  tone = "green",
}: {
  label: string;
  value: string;
  description: string;
  icon: ReactNode;
  tone?: "green" | "amber" | "red" | "blue";
}) {
  return (
    <article className={`admin-metric-card metric-${tone}`}>
      <div className="admin-metric-top"><span>{label}</span><span className="admin-metric-icon">{icon}</span></div>
      <strong>{value}</strong>
      <small>{description}</small>
    </article>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState<Range>("30d");
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = useCallback(async (quiet = false) => {
    if (!supabase) {
      setError("Supabase is not configured. Check the frontend environment variables.");
      setLoading(false);
      return;
    }

    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const since = sinceFor(range);
    const eventQuery = supabase
      .from("security_events")
      .select("id,request_id,user_id,session_id,risk_score,risk_level,entities_detected,entity_breakdown,status,processing_time_ms,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const filteredEventQuery = since ? eventQuery.gte("created_at", since) : eventQuery;

    const [metricsResult, eventsResult, usersResult] = await Promise.all([
      supabase.rpc("get_guardai_admin_metrics", { p_since: since }),
      filteredEventQuery,
      supabase
        .from("profiles")
        .select("id,full_name,email,role,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const failures = [metricsResult.error, eventsResult.error, usersResult.error].filter(Boolean);
    if (failures.length > 0) {
      const firstError = failures[0];
      setError(firstError?.message ?? "The admin data could not be loaded. Check the admin migration and database permissions.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setMetrics({ ...EMPTY_METRICS, ...((metricsResult.data ?? {}) as Partial<Metrics>) });
    setEvents((eventsResult.data ?? []) as SecurityEvent[]);
    setUsers((usersResult.data ?? []) as AdminUser[]);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, [range]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const userNames = useMemo(() => new Map(users.map((user) => [user.id, user.email || user.full_name || `${user.id.slice(0, 8)}…`])), [users]);
  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      `${user.full_name ?? ""} ${user.email ?? ""} ${user.role}`.toLowerCase().includes(query),
    );
  }, [users, userSearch]);

  const categories = useMemo(() => Object.entries(metrics.categories ?? {}).sort((a, b) => Number(b[1]) - Number(a[1])), [metrics.categories]);
  const maxCategory = Math.max(1, ...categories.map(([, count]) => Number(count)));
  const activity = metrics.dailyActivity ?? [];
  const maxActivity = Math.max(1, ...activity.map((point) => Number(point.requests)));
  const protectedRate = metrics.totalRequests > 0
    ? Math.round((metrics.protectedRequests / metrics.totalRequests) * 100)
    : 0;

  return (
    <main className="admin-dashboard">
      <header className="admin-page-heading">
        <div>
          <div className="admin-eyebrow"><ShieldCheck size={14} /> SECURITY OPERATIONS</div>
          <h1>Admin Control Center</h1>
          <p>Monitor GuardAI protection activity using live, privacy-safe audit metadata.</p>
        </div>
        <div className="admin-heading-actions">
          <span className="admin-live-status"><i /> Connected to Supabase</span>
          <button className="admin-action-button" onClick={() => void loadDashboard(true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "admin-spin" : ""} /> Refresh
          </button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Admin sections">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><BarChart3 size={16} /> Overview</button>
        <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}><Activity size={16} /> Security logs <span>{number(events.length)}</span></button>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}><Users size={16} /> Users <span>{number(metrics.registeredUsers)}</span></button>
      </nav>

      <div className="admin-toolbar">
        <div className="admin-data-caption"><Database size={14} /> Live database records · no sample metrics</div>
        <div className="admin-range-picker" aria-label="Date range">
          {(["7d", "30d", "all"] as Range[]).map((value) => (
            <button key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>
              {value === "7d" ? "7 days" : value === "30d" ? "30 days" : "All time"}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="admin-error" role="alert"><AlertTriangle size={17} /><div><strong>Dashboard data unavailable</strong><span>{error}</span></div></div>}

      {loading ? (
        <div className="admin-loading"><RefreshCw size={19} className="admin-spin" /> Loading protected analytics…</div>
      ) : (
        <>
          {tab === "overview" && (
            <section className="admin-section-content">
              <div className="admin-metric-grid">
                <MetricCard label="Total requests" value={number(metrics.totalRequests)} description={`${number(metrics.activeUsers)} users with activity`} icon={<Activity size={17} />} />
                <MetricCard label="Protected requests" value={number(metrics.protectedRequests)} description={`${protectedRate}% successful processing`} icon={<ShieldCheck size={17} />} />
                <MetricCard label="Sensitive entities" value={number(metrics.entitiesDetected)} description="Detected across recorded requests" icon={<LockKeyhole size={17} />} tone="blue" />
                <MetricCard label="High-risk requests" value={number(metrics.highRiskRequests)} description={`${number(metrics.failedRequests)} failed requests`} icon={<AlertTriangle size={17} />} tone="amber" />
                <MetricCard label="Average risk score" value={`${Math.round(metrics.averageRisk ?? 0)}/100`} description="Average across recorded requests" icon={<BarChart3 size={17} />} tone="blue" />
                <MetricCard label="Registered users" value={number(metrics.registeredUsers)} description="Total registered accounts" icon={<Users size={17} />} />
              </div>

              <div className="admin-analytics-grid">
                <section className="admin-panel admin-activity-panel">
                  <div className="admin-panel-heading"><div><h2>Request activity</h2><p>Daily secure-chat requests · last 30 days</p></div><span className="admin-panel-icon"><Activity size={17} /></span></div>
                  {activity.length > 0 ? (
                    <div className="admin-bar-chart" role="img" aria-label="Daily request activity bar chart">
                      {activity.slice(-30).map((point) => (
                        <div className="admin-bar-column" key={point.day} title={`${point.day}: ${point.requests} requests`}>
                          <div className="admin-bar-track"><i style={{ height: `${Math.max(5, (Number(point.requests) / maxActivity) * 100)}%` }} /></div>
                          <small>{new Date(`${point.day}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "short" })}</small>
                        </div>
                      ))}
                    </div>
                  ) : <div className="admin-empty-chart">No request activity is recorded for this period.</div>}
                </section>

                <section className="admin-panel admin-category-panel">
                  <div className="admin-panel-heading"><div><h2>Detected data types</h2><p>Aggregated entity categories</p></div><span className="admin-panel-icon"><ShieldCheck size={17} /></span></div>
                  {categories.length > 0 ? <div className="admin-category-list">
                    {categories.map(([key, count]) => (
                      <div className="admin-category-row" key={key}>
                        <div><span>{categoryNames[key] ?? key.replaceAll("_", " ")}</span><strong>{number(Number(count))}</strong></div>
                        <div className="admin-category-track"><i style={{ width: `${Math.max(2, (Number(count) / maxCategory) * 100)}%` }} /></div>
                      </div>
                    ))}
                  </div> : <div className="admin-empty-chart">No sensitive entities have been recorded in this period.</div>}
                </section>
              </div>

              <section className="admin-panel admin-recent-panel">
                <div className="admin-panel-heading"><div><h2>Recent security events</h2><p>Metadata only · original prompts and detected values are never shown here</p></div><button className="admin-text-button" onClick={() => setTab("logs")}>View all logs <ArrowUpRight size={14} /></button></div>
                <EventTable events={events.slice(0, 6)} userNames={userNames} />
              </section>
            </section>
          )}

          {tab === "logs" && (
            <section className="admin-section-content">
              <section className="admin-panel">
                <div className="admin-panel-heading"><div><h2>Security audit log</h2><p>Latest 200 events · filtered by selected date range</p></div><button className="admin-action-button" onClick={() => downloadCsv(events)} disabled={events.length === 0}><ArrowDownToLine size={15} /> Export CSV</button></div>
                <EventTable events={events} userNames={userNames} expanded />
              </section>
            </section>
          )}

          {tab === "users" && (
            <section className="admin-section-content">
              <section className="admin-panel">
                <div className="admin-panel-heading"><div><h2>Registered users</h2><p>Account directory · displaying the latest 200 profiles · role changes remain restricted to trusted administrators</p></div><span className="admin-panel-icon"><Users size={17} /></span></div>
                <label className="admin-search"><Search size={16} /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search name, email or role…" /></label>
                <div className="admin-user-list">
                  {filteredUsers.map((user) => (
                    <article className="admin-user-row" key={user.id}>
                      <span className="admin-user-avatar"><Users size={17} /></span>
                      <div className="admin-user-info"><strong>{user.full_name || "Name not provided"}</strong><span>{user.email || `${user.id.slice(0, 8)}…`}</span><small>Joined {new Date(user.created_at).toLocaleDateString()}</small></div>
                      <span className={`admin-role-badge ${user.role === "admin" ? "role-admin" : "role-user"}`}>{user.role}</span>
                    </article>
                  ))}
                  {filteredUsers.length === 0 && <div className="admin-empty-chart">No users match this search.</div>}
                </div>
              </section>
            </section>
          )}
        </>
      )}

      <footer className="admin-dashboard-footer">
        <span><ShieldCheck size={13} /> Privacy-safe administration · prompts and original PII are not displayed</span>
        <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting data"}</span>
      </footer>
    </main>
  );
}


function EventTable({ events, userNames, expanded = false }: {
  events: SecurityEvent[];
  userNames: Map<string, string>;
  expanded?: boolean;
}) {
  if (events.length === 0) {
    return <div className="admin-empty-chart">No security events have been recorded yet. Send a protected chat message to create the first audit event.</div>;
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-event-table">
        <thead><tr><th>Time</th><th>User</th><th>Risk</th><th>Entities</th><th>Status</th><th>Duration</th></tr></thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td data-label="Time">{dateTime(event.created_at)}</td>
              <td data-label="User"><span className="admin-user-cell">{userNames.get(event.user_id) ?? `${event.user_id.slice(0, 8)}…`}</span></td>
              <td data-label="Risk"><span className={`admin-risk-pill risk-${event.risk_level.toLowerCase()}`}>{event.risk_level} · {event.risk_score}</span></td>
              <td data-label="Entities">{number(event.entities_detected)}</td>
              <td data-label="Status"><span className={`admin-status-pill ${event.status === "SUCCESS" ? "status-success" : "status-failed"}`}>{event.status === "SUCCESS" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}{event.status}</span></td>
              <td data-label="Duration">{event.processing_time_ms == null ? "—" : `${number(event.processing_time_ms)} ms`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {expanded && <p className="admin-table-note"><Clock3 size={12} /> Showing at most 200 recent events. The summary cards use server-side aggregate metrics.</p>}
    </div>
  );
}
