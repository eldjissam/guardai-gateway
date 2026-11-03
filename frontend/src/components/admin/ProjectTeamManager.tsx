import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, Camera, Check, Edit3, ImagePlus, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserRound, X, Users } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./admin-operations.css";

type TeamMember = {
  id: string; full_name: string; registration_number: string | null; university: string | null;
  faculty: string | null; programme: string | null; role_title: string; phone: string | null;
  email: string | null; bio: string | null; photo_path: string | null;
  show_registration_number: boolean; show_phone: boolean; show_email: boolean;
  is_published: boolean; display_order: number; created_at: string;
};
type TeamForm = Omit<TeamMember, "id" | "created_at">;
const EMPTY_FORM: TeamForm = {
  full_name: "", registration_number: "", university: "", faculty: "", programme: "", role_title: "",
  phone: "", email: "", bio: "", photo_path: null, show_registration_number: false,
  show_phone: false, show_email: false, is_published: false, display_order: 0,
};
const PAGE_SIZE = 8;

export default function ProjectTeamManager({ onNotice }: { onNotice: (message: string, kind?: "success" | "error") => void }) {
  const [members, setMembers] = useState<TeamMember[]>([]); const [total, setTotal] = useState(0);
  const [publishedCount, setPublishedCount] = useState(0); const [draftCount, setDraftCount] = useState(0);
  const [page, setPage] = useState(1); const [search, setSearch] = useState(""); const [published, setPublished] = useState("all");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [editing, setEditing] = useState<TeamMember | null>(null); const [creating, setCreating] = useState(false); const [busyId, setBusyId] = useState("");
  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }
    setLoading(true); setError("");
    let query = supabase.from("project_team_members").select("*", { count: "exact" }).order("display_order", { ascending: true }).order("created_at", { ascending: true });
    if (published === "published") query = query.eq("is_published", true);
    if (published === "draft") query = query.eq("is_published", false);
    if (from) query = query.gte("created_at", new Date(`${from}T00:00:00`).toISOString());
    if (to) query = query.lt("created_at", new Date(new Date(`${to}T00:00:00`).getTime() + 86400000).toISOString());
    const term = search.trim().replace(/[,%()]/g, "");
    if (term) query = query.or(`full_name.ilike.%${term}%,role_title.ilike.%${term}%,university.ilike.%${term}%`);
    const [listResult, publishedResult, draftResult] = await Promise.all([
      query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
      supabase.from("project_team_members").select("id", { count: "exact", head: true }).eq("is_published", true),
      supabase.from("project_team_members").select("id", { count: "exact", head: true }).eq("is_published", false),
    ]);
    if (listResult.error || publishedResult.error || draftResult.error) setError(listResult.error?.message || publishedResult.error?.message || draftResult.error?.message || "Project team records could not be loaded.");
    else { setMembers((listResult.data ?? []) as TeamMember[]); setTotal(listResult.count ?? 0); setPublishedCount(publishedResult.count ?? 0); setDraftCount(draftResult.count ?? 0); }
    setLoading(false);
  }, [published, search, from, to, page]);
  useEffect(() => { void load(); }, [load]);

  const removeMember = async (member: TeamMember) => {
    if (!supabase) return;
    if (!window.confirm(`Delete the project team profile for ${member.full_name}? This will also remove its uploaded photograph.`)) return;
    setBusyId(member.id); setError("");
    const { error: deleteError } = await supabase.from("project_team_members").delete().eq("id", member.id);
    if (deleteError) { setError(deleteError.message); setBusyId(""); return; }
    if (member.photo_path) await supabase.storage.from("guardai-team-avatars").remove([member.photo_path]);
    onNotice("Project team member deleted.");
    if (members.length === 1 && page > 1) setPage((value) => Math.max(1, value - 1));
    else await load();
    setBusyId("");
  };

  const saveMember = async (event: FormEvent<HTMLFormElement>, form: TeamForm, file: File | null) => {
    event.preventDefault();
    if (!supabase) throw new Error("Supabase is not configured.");
    let photoPath = form.photo_path;
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Upload a JPG, PNG or WebP image.");
      if (file.size > 5 * 1024 * 1024) throw new Error("The profile image must be 5 MB or smaller.");
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").slice(-80);
      const nextPath = `${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("guardai-team-avatars").upload(nextPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      photoPath = nextPath;
    }

    const payload = {
      full_name: form.full_name.trim(), registration_number: form.registration_number?.trim() || null,
      university: form.university?.trim() || null, faculty: form.faculty?.trim() || null,
      programme: form.programme?.trim() || null, role_title: form.role_title.trim(),
      phone: form.phone?.trim() || null, email: form.email?.trim().toLowerCase() || null,
      bio: form.bio?.trim() || null, photo_path: photoPath, show_registration_number: form.show_registration_number,
      show_phone: form.show_phone, show_email: form.show_email, is_published: form.is_published,
      display_order: Number.isFinite(form.display_order) ? form.display_order : 0,
    };

    const result = editing
      ? await supabase.from("project_team_members").update(payload).eq("id", editing.id)
      : await supabase.from("project_team_members").insert(payload);
    if (result.error) {
      if (file && photoPath) await supabase.storage.from("guardai-team-avatars").remove([photoPath]);
      throw result.error;
    }
    if (editing?.photo_path && file && editing.photo_path !== photoPath) await supabase.storage.from("guardai-team-avatars").remove([editing.photo_path]);
    setCreating(false); setEditing(null); onNotice(editing ? "Project team profile updated." : "Project team member created."); await load();
  };

  return <>
    <div className="ao-page-heading"><div><span className="ao-eyebrow"><UserRound size={14} /> PUBLIC PROJECT CONTENT</span><h1>Project team</h1><p>Manage the people shown on the public About GuardAI page. Personal information stays private unless you explicitly publish it.</p></div><button className="ao-button ao-button-primary" onClick={() => setCreating(true)}><Plus size={16} /> Add team member</button></div>
    <div className="ao-team-summary"><div><strong>{total}</strong><span>Matching profiles</span></div><div><strong>{publishedCount}</strong><span>Published on About</span></div><div><strong>{draftCount}</strong><span>Draft profiles</span></div><div className="ao-team-summary-note"><ShieldCheck size={16} /> Public profiles show only approved fields.</div></div>
    <div className="ao-filter-panel"><div className="ao-filter-grid"><label className="ao-search-field"><Search size={16} /><input placeholder="Search name, role or university…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><label>Publication<select value={published} onChange={(event) => { setPublished(event.target.value); setPage(1); }}><option value="all">All profiles</option><option value="published">Published</option><option value="draft">Drafts</option></select></label><label>Added from<input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label><label>Added to<input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label><button className="ao-button ao-button-quiet" onClick={() => { setSearch(""); setPublished("all"); setFrom(""); setTo(""); setPage(1); }}><X size={14} /> Clear</button></div></div>
    {error && <div className="ao-error">{error}</div>}
    {loading ? <div className="ao-loading"><RefreshCw className="ao-spin" /> Loading project team…</div> : members.length ? <div className="ao-team-grid">{members.map((member) => {
      const avatar = member.photo_path && supabase ? supabase.storage.from("guardai-team-avatars").getPublicUrl(member.photo_path).data.publicUrl : "";
      return <article className="ao-team-card" key={member.id}><div className="ao-team-image">{avatar ? <img src={avatar} alt={`${member.full_name} profile`} /> : <span>{member.full_name.slice(0, 1).toUpperCase()}</span>}<span className={`ao-publish-badge ${member.is_published ? "published" : "draft"}`}>{member.is_published ? "Published" : "Draft"}</span></div><div className="ao-team-card-body"><h3>{member.full_name}</h3><p>{member.role_title}</p><div className="ao-team-meta">{member.university && <span><Building2 size={13} />{member.university}</span>}{member.programme && <span>{member.programme}</span>}</div><div className="ao-team-card-actions"><button className="ao-button ao-button-secondary" onClick={() => setEditing(member)}><Edit3 size={14} /> Edit</button><button className="ao-icon-danger" onClick={() => void removeMember(member)} disabled={busyId === member.id} aria-label={`Delete ${member.full_name}`}><Trash2 size={15} /></button></div></div></article>;
    })}</div> : <div className="ao-card ao-empty"><ImagePlus size={24} />No team members yet. Add the first member to publish the group on About GuardAI.</div>}
    <div className="ao-pagination"><span>Showing <b>{total ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, total)}</b> of <b>{total}</b></span><div className="ao-pagination-actions"><button onClick={() => setPage((value) => value - 1)} disabled={page <= 1}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span><button onClick={() => setPage((value) => value + 1)} disabled={page >= Math.ceil(total / PAGE_SIZE)}>Next</button></div></div>
    {(creating || editing) && <TeamMemberDialog initial={editing} onClose={() => { setCreating(false); setEditing(null); }} onSave={saveMember} />}
  </>;
}

function TeamMemberDialog({ initial, onClose, onSave }: { initial: TeamMember | null; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>, form: TeamForm, file: File | null) => Promise<void> }) {
  const [form, setForm] = useState<TeamForm>(initial ? {
    full_name: initial.full_name, registration_number: initial.registration_number ?? "", university: initial.university ?? "",
    faculty: initial.faculty ?? "", programme: initial.programme ?? "", role_title: initial.role_title,
    phone: initial.phone ?? "", email: initial.email ?? "", bio: initial.bio ?? "", photo_path: initial.photo_path,
    show_registration_number: initial.show_registration_number, show_phone: initial.show_phone, show_email: initial.show_email,
    is_published: initial.is_published, display_order: initial.display_order,
  } : EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null); const [localPreview, setLocalPreview] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => {
    if (!file) { setLocalPreview(""); return; }
    const url = URL.createObjectURL(file); setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const change = <K extends keyof TeamForm>(key: K, value: TeamForm[K]) => setForm((old) => ({ ...old, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (busy) return; setBusy(true); setError(""); try { await onSave(event, form, file); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "The team profile could not be saved."); } finally { setBusy(false); } };
  const preview = localPreview || (initial?.photo_path && supabase ? supabase.storage.from("guardai-team-avatars").getPublicUrl(initial.photo_path).data.publicUrl : "");
  return <div className="ao-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><section className="ao-modal ao-team-modal" role="dialog" aria-modal="true" aria-labelledby="ao-team-title"><button className="ao-modal-close" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} /></button><span className="ao-eyebrow"><Users size={14} /> PROJECT TEAM PROFILE</span><h2 id="ao-team-title">{initial ? "Edit team member" : "Add team member"}</h2><p>Keep private contact and registration details hidden unless the member has approved their publication.</p>
    <form className="ao-form" onSubmit={submit}>
      <div className="ao-photo-upload"><div className="ao-photo-preview">{preview ? <img src={preview} alt="Selected profile preview" /> : <UserRound size={28} />}</div><label className="ao-button ao-button-secondary"><Camera size={15} /> {file ? "Change photo" : "Upload photo"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><small>JPG, PNG or WebP · maximum 5 MB</small></div>
      <div className="ao-form-grid"><label>Full name *<input required maxLength={120} value={form.full_name} onChange={(event) => change("full_name", event.target.value)} /></label><label>Project position *<input required maxLength={100} value={form.role_title} onChange={(event) => change("role_title", event.target.value)} placeholder="Frontend developer" /></label><label>Registration number<input maxLength={80} value={form.registration_number ?? ""} onChange={(event) => change("registration_number", event.target.value)} /></label><label>University<input maxLength={160} value={form.university ?? ""} onChange={(event) => change("university", event.target.value)} /></label><label>Faculty<input maxLength={160} value={form.faculty ?? ""} onChange={(event) => change("faculty", event.target.value)} /></label><label>Programme<input maxLength={160} value={form.programme ?? ""} onChange={(event) => change("programme", event.target.value)} /></label><label>Phone<input maxLength={40} value={form.phone ?? ""} onChange={(event) => change("phone", event.target.value)} /></label><label>Email<input type="email" maxLength={254} value={form.email ?? ""} onChange={(event) => change("email", event.target.value)} /></label><label>Display order<input type="number" min={0} max={9999} value={form.display_order} onChange={(event) => change("display_order", Number(event.target.value))} /></label></div>
      <label>Short biography<textarea rows={3} maxLength={500} value={form.bio ?? ""} onChange={(event) => change("bio", event.target.value)} placeholder="A short introduction about this team member…" /></label>
      <div className="ao-privacy-options"><strong>Public visibility controls</strong><label><input type="checkbox" checked={form.show_registration_number} onChange={(event) => change("show_registration_number", event.target.checked)} /> Show registration number</label><label><input type="checkbox" checked={form.show_phone} onChange={(event) => change("show_phone", event.target.checked)} /> Show phone number</label><label><input type="checkbox" checked={form.show_email} onChange={(event) => change("show_email", event.target.checked)} /> Show email address</label></div>
      <label className="ao-publish-toggle"><input type="checkbox" checked={form.is_published} onChange={(event) => change("is_published", event.target.checked)} /><span><b>Publish on About GuardAI</b><small>Only published profiles are visible publicly.</small></span></label>
      {error && <div className="ao-error">{error}</div>}
      <div className="ao-modal-actions"><button type="button" className="ao-button ao-button-quiet" onClick={onClose} disabled={busy}>Cancel</button><button className="ao-button ao-button-primary" disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : "Create team profile"} <Check size={15} /></button></div>
    </form></section></div>;
}
