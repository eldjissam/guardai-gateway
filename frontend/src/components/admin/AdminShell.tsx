import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft, ChevronLeft, ChevronRight, LayoutDashboard,
  Menu, ShieldAlert, ShieldCheck, Users, UserRound, X,
} from "lucide-react";
import AdminConsole, { type AdminSection } from "./AdminConsole";
import "./admin-shell.css";

type Props = { user: User; onBackToWorkspace: () => void; onSignOutRequest: () => void };
const items: Array<{ id: AdminSection; label: string; caption: string; icon: ReactNode }> = [
  { id: "overview", label: "Overview", caption: "System health and metrics", icon: <LayoutDashboard size={18} /> },
  { id: "logs", label: "Security logs", caption: "Audit records and filters", icon: <ShieldAlert size={18} /> },
  { id: "users", label: "User management", caption: "Accounts, invitations and roles", icon: <Users size={18} /> },
  { id: "team", label: "Project team", caption: "Public About page profiles", icon: <UserRound size={18} /> },
];

export default function AdminShell({ user, onBackToWorkspace, onSignOutRequest }: Props) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "Administrator";

  useEffect(() => {
    const openLogs = () => setSection("logs");
    window.addEventListener("guardai-admin-open-logs", openLogs);
    return () => window.removeEventListener("guardai-admin-open-logs", openLogs);
  }, []);

  const select = (next: AdminSection) => { setSection(next); setMobileOpen(false); };
  return <div className="guardai-admin-shell" data-admin-theme="light">
    {mobileOpen && <button className="ga-admin-scrim" onClick={() => setMobileOpen(false)} aria-label="Close administration navigation" />}
    <aside className={`ga-admin-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}>
      <div className="ga-admin-brand-row"><div className="ga-admin-brand-mark"><ShieldCheck size={22} /></div>{!collapsed && <div className="ga-admin-brand-copy"><strong>Guard<span>AI</span></strong><small>ADMINISTRATION</small></div>}<button className="ga-admin-icon-button ga-admin-collapse ga-desktop-only" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button><button className="ga-admin-icon-button ga-mobile-only" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
      {!collapsed && <div className="ga-admin-workspace-label"><i /> SECURITY OPERATIONS</div>}
      <nav className="ga-admin-nav" aria-label="Admin sections">{!collapsed && <span className="ga-admin-nav-label">WORKSPACE</span>}{items.map((item) => <button key={item.id} className={`ga-admin-nav-item ${section === item.id ? "active" : ""}`} onClick={() => select(item.id)} title={collapsed ? item.label : undefined} aria-current={section === item.id ? "page" : undefined}><span className="ga-admin-nav-icon">{item.icon}</span>{!collapsed && <span className="ga-admin-nav-copy"><b>{item.label}</b><small>{item.caption}</small></span>}{!collapsed && section === item.id && <i className="ga-admin-active-dot" />}</button>)}</nav>
      <div className="ga-admin-sidebar-spacer" />
      <div className="ga-admin-sidebar-bottom"><button className="ga-admin-back-button" onClick={onBackToWorkspace} title={collapsed ? "Back to user workspace" : undefined}><ArrowLeft size={17} />{!collapsed && <span>Back to User Workspace</span>}</button><div className="ga-admin-security-note"><ShieldCheck size={15} /><span>Access is verified by Supabase policies and server-side role checks.</span></div><div className="ga-admin-account"><div className="ga-admin-avatar">{displayName.trim().slice(0, 1).toUpperCase()}</div>{!collapsed && <div className="ga-admin-account-copy"><b>{displayName}</b><small>{user.email ?? "Administrator account"}</small></div>}{!collapsed && <span className="ga-admin-role">ADMIN</span>}</div></div>
    </aside>
    <section className="ga-admin-main"><header className="ga-admin-topbar"><div className="ga-admin-topbar-left"><button className="ga-admin-icon-button ga-mobile-only ga-open-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="ga-admin-breadcrumb"><span>GuardAI</span><i>/</i><b>Administration</b><i>/</i><strong>{items.find((item) => item.id === section)?.label}</strong></div></div><div className="ga-admin-topbar-actions"><span className="ga-admin-mode-pill"><i /> ADMIN WORKSPACE</span><button className="ga-admin-signout" onClick={onSignOutRequest}>Sign out</button></div></header><main className="ga-admin-content" key={section}><AdminConsole section={section} /><footer className="ga-admin-footer"><span><ShieldCheck size={14} /> GuardAI Security Administration</span><span>Privacy-first operations</span></footer></main></section>
  </div>;
}
