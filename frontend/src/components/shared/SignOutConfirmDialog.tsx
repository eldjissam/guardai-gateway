import { useEffect } from "react";
import { LogOut, ShieldCheck, X } from "lucide-react";
import "./sign-out-confirm-dialog.css";

type Props = { open: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void };
export default function SignOutConfirmDialog({ open, busy = false, onCancel, onConfirm }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return <div className="ga-signout-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}><section className="ga-signout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ga-signout-title"><button className="ga-signout-close" onClick={onCancel} disabled={busy} aria-label="Close"><X size={18} /></button><div className="ga-signout-icon"><LogOut size={22} /></div><span className="ga-signout-eyebrow"><ShieldCheck size={13} /> SECURE ACCOUNT SESSION</span><h2 id="ga-signout-title">Sign out of GuardAI?</h2><p>You will need to sign in again to access your protected workspace and saved conversations.</p><div className="ga-signout-actions"><button className="ga-signout-cancel" onClick={onCancel} disabled={busy}>Stay signed in</button><button className="ga-signout-confirm" onClick={onConfirm} disabled={busy}>{busy ? "Signing out…" : "Yes, sign out"} <LogOut size={15} /></button></div></section></div>;
}
