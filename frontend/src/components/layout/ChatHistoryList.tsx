import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock3, MessageSquare, MoreHorizontal, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useChatSessions, type ChatSessionSummary } from "../../contexts/ChatSessionContext";
import "../../history-management.css";

type Props = {
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
};
type ConfirmAction = { kind: "delete"; session: ChatSessionSummary } | { kind: "clear" } | null;

type SessionGroup = { label: string; sessions: ChatSessionSummary[] };

function dayStart(date: Date): number {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

function groupSessions(sessions: ChatSessionSummary[]): SessionGroup[] {
  const today = dayStart(new Date());
  const yesterday = today - 24 * 60 * 60 * 1000;
  const weekStart = today - 7 * 24 * 60 * 60 * 1000;
  const buckets = new Map<string, ChatSessionSummary[]>([
    ["Today", []], ["Yesterday", []], ["Previous 7 days", []], ["Earlier", []],
  ]);

  for (const session of sessions) {
    const created = dayStart(new Date(session.updated_at || session.created_at));
    const label = created >= today ? "Today" : created >= yesterday ? "Yesterday" : created >= weekStart ? "Previous 7 days" : "Earlier";
    buckets.get(label)?.push(session);
  }

  return [...buckets.entries()].filter(([, items]) => items.length > 0).map(([label, items]) => ({ label, sessions: items }));
}

export default function ChatHistoryList({ activeSessionId, onSelect }: Props) {
  const { sessions, setSessions, setActiveSessionId } = useChatSessions();
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmAction>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groups = useMemo(() => groupSessions(sessions), [sessions]);

  const confirmDelete = async () => {
    if (!confirmation || !supabase || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (confirmation.kind === "delete") {
        const sessionId = confirmation.session.id;
        const { data, error: rpcError } = await supabase.rpc("delete_guardai_session", { p_session_id: sessionId });
        if (rpcError) throw rpcError;
        if (data !== true) throw new Error("This conversation could not be deleted. Refresh and try again.");
        setSessions((current) => current.filter((session) => session.id !== sessionId));
        if (activeSessionId === sessionId) setActiveSessionId(null);
      } else {
        const { data, error: rpcError } = await supabase.rpc("delete_my_guardai_history");
        if (rpcError) throw rpcError;
        if (data !== true) throw new Error("Your conversation history could not be cleared. Please try again.");
        setSessions([]);
        setActiveSessionId(null);
      }
      setConfirmation(null);
      setMenuSessionId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The conversation history could not be changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="guardai-history-manager">
      <div className="guardai-history-toolbar">
        <span className="section-label">RECENT CHATS</span>
        {sessions.length > 0 && (
          <button className="guardai-clear-history" onClick={() => { setError(null); setConfirmation({ kind: "clear" }); }} aria-label="Clear all conversation history" title="Clear all history">
            <Trash2 size={13} /><span>Clear</span>
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="history-empty"><MessageSquare size={19} /><span>Your secure conversations will appear here after your first protected message.</span></div>
      ) : (
        <div className="guardai-history-groups">
          {groups.map((group) => (
            <section className="guardai-history-group" key={group.label}>
              <div className="guardai-history-group-label">{group.label}</div>
              {group.sessions.map((session) => (
                <div className={`guardai-history-row ${activeSessionId === session.id ? "active" : ""}`} key={session.id}>
                  <button className="guardai-history-open" onClick={() => onSelect(session.id)} title={session.title}>
                    <MessageSquare size={14} />
                    <span>{session.title || "New conversation"}</span>
                  </button>
                  <button
                    className="guardai-history-more"
                    aria-label={`More actions for ${session.title}`}
                    aria-expanded={menuSessionId === session.id}
                    onClick={() => setMenuSessionId((current) => current === session.id ? null : session.id)}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  <AnimatePresence>
                    {menuSessionId === session.id && (
                      <motion.div className="guardai-history-menu" initial={{ opacity: 0, y: 5, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: .98 }}>
                        <button className="danger" onClick={() => { setConfirmation({ kind: "delete", session }); setMenuSessionId(null); }}><Trash2 size={14} /> Delete conversation</button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {error && <p className="guardai-history-error" role="alert">{error}</p>}

      <AnimatePresence>
        {confirmation && (
          <motion.div className="guardai-confirm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setConfirmation(null); }}>
            <motion.section className="guardai-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="guardai-delete-title" initial={{ opacity: 0, y: 14, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }}>
              <button className="guardai-confirm-close" aria-label="Close confirmation" disabled={busy} onClick={() => setConfirmation(null)}><X size={17} /></button>
              <span className="guardai-confirm-icon"><Trash2 size={20} /></span>
              <h3 id="guardai-delete-title">{confirmation.kind === "clear" ? "Clear all conversations?" : "Delete this conversation?"}</h3>
              <p>{confirmation.kind === "clear"
                ? "This permanently removes your saved conversations, messages and associated security events. This action cannot be undone."
                : `“${confirmation.session.title}” and its saved messages and associated security events will be permanently deleted.`}</p>
              <div className="guardai-confirm-actions">
                <button className="guardai-confirm-cancel" disabled={busy} onClick={() => setConfirmation(null)}>Keep history</button>
                <button className="guardai-confirm-delete" disabled={busy} onClick={() => void confirmDelete()}>
                  {busy ? <Clock3 size={15} className="guardai-history-spin" /> : <Trash2 size={15} />}
                  {busy ? "Deleting…" : confirmation.kind === "clear" ? "Clear history" : "Delete chat"}
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
