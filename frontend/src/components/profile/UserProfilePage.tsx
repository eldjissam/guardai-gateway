import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft, BadgeCheck, Camera, Check, ChevronRight, Clock3, GraduationCap,
  KeyRound, LoaderCircle, LockKeyhole, Mail, Phone, Save, ShieldCheck,
  Trash2, Upload, UserRound, X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./user-profile-page.css";

type Props = { user: User; onBack: () => void };

type PrivateProfile = {
  phone: string;
  registration_number: string;
  university: string;
  faculty: string;
  programme: string;
  year_of_study: string;
  bio: string;
  avatar_path: string | null;
};

type Notice = { kind: "success" | "error" | "info"; text: string } | null;

const EMPTY_PROFILE: PrivateProfile = {
  phone: "",
  registration_number: "",
  university: "",
  faculty: "",
  programme: "",
  year_of_study: "",
  bio: "",
  avatar_path: null,
};

function initials(value: string): string {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "G";
}

function dateLabel(value?: string | null): string {
  if (!value) return "Not available";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not available" : parsed.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export default function UserProfilePage({ user, onBack }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "");
  const [profile, setProfile] = useState<PrivateProfile>(EMPTY_PROFILE);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [otherSessionsBusy, setOtherSessionsBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!supabase) {
      setNotice({ kind: "error", text: "Supabase is not configured. Check your frontend environment settings." });
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const [baseResult, privateResult] = await Promise.all([
        supabase.from("profiles").select("full_name,created_at").eq("id", user.id).maybeSingle(),
        supabase.from("user_private_profiles").select("phone,registration_number,university,faculty,programme,year_of_study,bio,avatar_path").eq("user_id", user.id).maybeSingle(),
      ]);
      if (baseResult.error) throw baseResult.error;
      if (privateResult.error) throw privateResult.error;
      if (baseResult.data?.full_name) setFullName(baseResult.data.full_name);
      if (privateResult.data) setProfile({
        phone: privateResult.data.phone ?? "",
        registration_number: privateResult.data.registration_number ?? "",
        university: privateResult.data.university ?? "",
        faculty: privateResult.data.faculty ?? "",
        programme: privateResult.data.programme ?? "",
        year_of_study: privateResult.data.year_of_study ?? "",
        bio: privateResult.data.bio ?? "",
        avatar_path: privateResult.data.avatar_path ?? null,
      });
      if (privateResult.data?.avatar_path) {
        const { data: signed, error: signedError } = await supabase.storage.from("user-avatars").createSignedUrl(privateResult.data.avatar_path, 15 * 60);
        if (!signedError) setAvatarUrl(signed?.signedUrl ?? null);
      } else {
        setAvatarUrl(null);
      }
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not load your profile." });
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const setField = (field: keyof PrivateProfile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || saving) return;
    const cleanName = fullName.trim();
    if (cleanName.length < 2 || cleanName.length > 100) {
      setNotice({ kind: "error", text: "Enter a name between 2 and 100 characters." });
      return;
    }
    if (profile.bio.length > 500) {
      setNotice({ kind: "error", text: "Keep your biography within 500 characters." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const { error: baseError } = await supabase.from("profiles").update({ full_name: cleanName }).eq("id", user.id);
      if (baseError) throw baseError;
      const { error: privateError } = await supabase.from("user_private_profiles").upsert({
        user_id: user.id,
        phone: profile.phone.trim() || null,
        registration_number: profile.registration_number.trim() || null,
        university: profile.university.trim() || null,
        faculty: profile.faculty.trim() || null,
        programme: profile.programme.trim() || null,
        year_of_study: profile.year_of_study.trim() || null,
        bio: profile.bio.trim() || null,
        avatar_path: profile.avatar_path,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (privateError) throw privateError;
      const { error: metadataError } = await supabase.auth.updateUser({ data: { full_name: cleanName } });
      if (metadataError) throw metadataError;
      setNotice({ kind: "success", text: "Your profile has been saved." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not save your profile." });
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !supabase || uploading) return;
    if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setNotice({ kind: "error", text: "Choose a JPG, PNG or WebP image." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice({ kind: "error", text: "Your profile photo must be 2 MB or smaller." });
      return;
    }
    setUploading(true);
    setNotice(null);
    try {
      const path = `${user.id}/avatar`;
      const { error: uploadError } = await supabase.storage.from("user-avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });
      if (uploadError) throw uploadError;
      const { error: profileError } = await supabase.from("user_private_profiles").upsert({
        user_id: user.id,
        avatar_path: path,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (profileError) throw profileError;
      const { data: signed, error: signedError } = await supabase.storage.from("user-avatars").createSignedUrl(path, 15 * 60);
      if (signedError) throw signedError;
      setProfile((current) => ({ ...current, avatar_path: path }));
      setAvatarUrl(signed.signedUrl);
      setNotice({ kind: "success", text: "Profile photo updated. The image is stored in your private account folder." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not upload your photo." });
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!supabase || !profile.avatar_path || deletingAvatar) return;
    setDeletingAvatar(true);
    try {
      const { error } = await supabase.storage.from("user-avatars").remove([profile.avatar_path]);
      if (error) throw error;
      const { error: updateError } = await supabase.from("user_private_profiles").upsert({ user_id: user.id, avatar_path: null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (updateError) throw updateError;
      setProfile((current) => ({ ...current, avatar_path: null }));
      setAvatarUrl(null);
      setNotice({ kind: "success", text: "Your profile photo has been removed." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not remove your photo." });
    } finally {
      setDeletingAvatar(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || passwordBusy) return;
    if (newPassword.length < 10) {
      setNotice({ kind: "error", text: "Use at least 10 characters for your new password." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ kind: "error", text: "The new passwords do not match." });
      return;
    }
    if (!user.email || !currentPassword) {
      setNotice({ kind: "error", text: "Enter your current password to verify this change." });
      return;
    }
    setPasswordBusy(true);
    setNotice(null);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (verifyError) throw new Error("Your current password could not be verified.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOpen(false);
      setNotice({ kind: "success", text: "Your password has been changed." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not change your password." });
    } finally {
      setPasswordBusy(false);
    }
  };

  const signOutOtherSessions = async () => {
    if (!supabase || otherSessionsBusy) return;
    setOtherSessionsBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      setNotice({ kind: "success", text: "Other active sessions have been signed out. This session remains active." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not sign out other sessions." });
    } finally {
      setOtherSessionsBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!supabase || deleteBusy || deletePhrase !== "DELETE") return;
    setDeleteBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase.functions.invoke("delete-my-account", { body: { confirmation: "DELETE" } });
      if (error) throw error;
      await supabase.auth.signOut({ scope: "local" });
      setDeleteOpen(false);
      onBack();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Account deletion could not be completed. Please contact an administrator." });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="ga-profile-page">
      <div className="ga-profile-heading">
        <button className="ga-profile-back" onClick={onBack}><ArrowLeft size={16} /> Back to workspace</button>
        <div className="ga-profile-heading-copy">
          <span className="ga-profile-eyebrow"><UserRound size={14} /> PERSONAL WORKSPACE</span>
          <h1>My profile</h1>
          <p>Manage your personal details, academic information and account security.</p>
        </div>
        <span className="ga-profile-private-pill"><LockKeyhole size={13} /> Private to your account</span>
      </div>

      {notice && <div className={`ga-profile-notice is-${notice.kind}`} role="status"><span>{notice.kind === "success" ? <Check size={16} /> : <ShieldCheck size={16} />}</span><p>{notice.text}</p><button onClick={() => setNotice(null)} aria-label="Dismiss notice"><X size={15} /></button></div>}

      {loading ? (
        <div className="ga-profile-loading"><LoaderCircle className="ga-profile-spin" size={22} /> Loading your profile…</div>
      ) : (
        <div className="ga-profile-layout">
          <aside className="ga-profile-summary ga-profile-panel">
            <div className="ga-profile-avatar-wrap">
              {avatarUrl ? <img className="ga-profile-avatar" src={avatarUrl} alt="Your profile" /> : <div className="ga-profile-avatar ga-profile-avatar-fallback">{initials(fullName || user.email || "GuardAI")}</div>}
              <button className="ga-profile-avatar-edit" onClick={() => fileInput.current?.click()} disabled={uploading} aria-label="Upload profile photo">{uploading ? <LoaderCircle className="ga-profile-spin" size={15} /> : <Camera size={15} />}</button>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} hidden />
            </div>
            <h2>{fullName || "GuardAI member"}</h2>
            <p className="ga-profile-email">{user.email}</p>
            <span className="ga-profile-member-badge"><BadgeCheck size={13} /> Authenticated account</span>
            <div className="ga-profile-summary-divider" />
            <div className="ga-profile-summary-row"><span>Member since</span><strong>{dateLabel(user.created_at)}</strong></div>
            <div className="ga-profile-summary-row"><span>Account ID</span><strong title={user.id}>{user.id.slice(0, 8)}…</strong></div>
            <div className="ga-profile-summary-actions">
              <button type="button" className="ga-profile-subtle-button" onClick={() => fileInput.current?.click()} disabled={uploading}><Upload size={14} /> {uploading ? "Uploading…" : "Change photo"}</button>
              {profile.avatar_path && <button type="button" className="ga-profile-remove-photo" onClick={removeAvatar} disabled={deletingAvatar}>{deletingAvatar ? <LoaderCircle className="ga-profile-spin" size={14} /> : <Trash2 size={14} />} Remove</button>}
            </div>
          </aside>

          <div className="ga-profile-main-column">
            <section className="ga-profile-panel ga-profile-form-panel">
              <div className="ga-profile-section-heading"><div className="ga-profile-section-icon"><UserRound size={18} /></div><div><h2>Personal information</h2><p>Update how your account is identified in GuardAI.</p></div></div>
              <form onSubmit={saveProfile} className="ga-profile-form">
                <label className="ga-profile-field"><span>Full name</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={100} required placeholder="Your full name" /></label>
                <label className="ga-profile-field"><span>Email address</span><div className="ga-profile-input-with-icon"><Mail size={16} /><input value={user.email ?? ""} readOnly aria-readonly="true" /><span className="ga-profile-readonly">{user.email_confirmed_at ? "Verified by Auth" : "Verification pending"}</span></div><small>Email changes require a separate verification flow.</small></label>
                <label className="ga-profile-field"><span>Phone number <small>Optional</small></span><div className="ga-profile-input-with-icon"><Phone size={16} /><input value={profile.phone} onChange={(event) => setField("phone", event.target.value)} maxLength={40} placeholder="+250 …" /></div></label>
                <label className="ga-profile-field ga-profile-field-wide"><span>Short biography <small>Optional · 500 characters</small></span><textarea value={profile.bio} onChange={(event) => setField("bio", event.target.value)} maxLength={500} rows={3} placeholder="Tell us a little about yourself…" /><small className="ga-profile-char-count">{profile.bio.length}/500</small></label>
                <div className="ga-profile-form-actions"><span><LockKeyhole size={13} /> These details are private to your account.</span><button className="ga-profile-primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="ga-profile-spin" size={16} /> : <Save size={16} />} Save changes</button></div>
              </form>
            </section>

            <section className="ga-profile-panel ga-profile-form-panel">
              <div className="ga-profile-section-heading"><div className="ga-profile-section-icon"><GraduationCap size={19} /></div><div><h2>Academic information</h2><p>Optional details for your private GuardAI portfolio.</p></div></div>
              <form onSubmit={saveProfile} className="ga-profile-form">
                <label className="ga-profile-field"><span>University</span><input value={profile.university} onChange={(event) => setField("university", event.target.value)} maxLength={160} placeholder="University or institution" /></label>
                <label className="ga-profile-field"><span>Faculty / School</span><input value={profile.faculty} onChange={(event) => setField("faculty", event.target.value)} maxLength={160} placeholder="Faculty or school" /></label>
                <label className="ga-profile-field"><span>Programme</span><input value={profile.programme} onChange={(event) => setField("programme", event.target.value)} maxLength={160} placeholder="Programme or degree" /></label>
                <label className="ga-profile-field"><span>Year of study</span><input value={profile.year_of_study} onChange={(event) => setField("year_of_study", event.target.value)} maxLength={60} placeholder="e.g. Year 2" /></label>
                <label className="ga-profile-field ga-profile-field-wide"><span>Registration number <small>Private · Never shown publicly</small></span><input value={profile.registration_number} onChange={(event) => setField("registration_number", event.target.value)} maxLength={80} placeholder="Your university registration number" /></label>
                <div className="ga-profile-form-actions"><span><LockKeyhole size={13} /> Academic records are not public project-team data.</span><button className="ga-profile-primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="ga-profile-spin" size={16} /> : <Save size={16} />} Save changes</button></div>
              </form>
            </section>

            <section className="ga-profile-panel ga-profile-security-panel">
              <div className="ga-profile-section-heading"><div className="ga-profile-section-icon"><ShieldCheck size={18} /></div><div><h2>Account security</h2><p>Keep your GuardAI account protected.</p></div></div>
              <div className="ga-profile-security-row"><div className="ga-profile-security-copy"><strong><KeyRound size={15} /> Password</strong><small>Change your password after verifying your current one.</small></div><button className="ga-profile-subtle-button" onClick={() => setPasswordOpen((value) => !value)}>{passwordOpen ? "Cancel" : "Change password"}<ChevronRight size={14} /></button></div>
              {passwordOpen && <form className="ga-profile-password-form" onSubmit={changePassword}><label className="ga-profile-field"><span>Current password</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label><label className="ga-profile-field"><span>New password</span><input type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><label className="ga-profile-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label><button className="ga-profile-primary-button" type="submit" disabled={passwordBusy}>{passwordBusy ? <LoaderCircle className="ga-profile-spin" size={16} /> : <KeyRound size={15} />} Update password</button></form>}
              <div className="ga-profile-security-row"><div className="ga-profile-security-copy"><strong><Clock3 size={15} /> Active sessions</strong><small>Sign out other devices while keeping this session active.</small></div><button className="ga-profile-subtle-button" onClick={signOutOtherSessions} disabled={otherSessionsBusy}>{otherSessionsBusy ? <LoaderCircle className="ga-profile-spin" size={14} /> : <ShieldCheck size={14} />} Sign out other devices</button></div>
              <div className="ga-profile-security-row ga-profile-danger-row"><div className="ga-profile-security-copy"><strong><Trash2 size={15} /> Delete account</strong><small>Permanently remove your account, private profile and saved GuardAI history.</small></div><button className="ga-profile-danger-button" onClick={() => setDeleteOpen(true)}>Delete account</button></div>
            </section>
          </div>
        </div>
      )}

      {deleteOpen && <div className="ga-profile-modal-backdrop" role="presentation"><section className="ga-profile-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ga-profile-delete-title"><div className="ga-profile-delete-icon"><Trash2 size={21} /></div><button className="ga-profile-modal-close" onClick={() => { setDeleteOpen(false); setDeletePhrase(""); }} disabled={deleteBusy} aria-label="Close dialog"><X size={17} /></button><h2 id="ga-profile-delete-title">Permanently delete your account?</h2><p>This removes your GuardAI account, private profile, avatar and saved conversations. This action cannot be undone.</p><label className="ga-profile-field"><span>Type DELETE to confirm</span><input value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} autoComplete="off" placeholder="DELETE" /></label><div className="ga-profile-delete-actions"><button className="ga-profile-subtle-button" onClick={() => { setDeleteOpen(false); setDeletePhrase(""); }} disabled={deleteBusy}>Keep my account</button><button className="ga-profile-danger-button" onClick={deleteAccount} disabled={deleteBusy || deletePhrase !== "DELETE"}>{deleteBusy ? <LoaderCircle className="ga-profile-spin" size={15} /> : <Trash2 size={15} />} Permanently delete</button></div></section></div>}
    </div>
  );
}
