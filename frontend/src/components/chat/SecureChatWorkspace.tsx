import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Check, ChevronDown, ChevronUp, Clock3, Copy, LoaderCircle, LockKeyhole, MessageSquareText, ShieldAlert, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useChatSessions } from "../../contexts/ChatSessionContext";

type Entity = { type: string; start: number; end: number; token: string; label: string };
type SecurityInfo = {
  status: string;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  entitiesDetected: number;
  entityBreakdown: Record<string, number>;
  entities: Entity[];
  sanitizedPrompt: string;
  restorationWarning: boolean;
  processingTimeMs: number;
};
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  security?: SecurityInfo;
  historyOnly?: boolean;
};

type Props = { user: User; initialDraftPrompt: string };

/** Historical token IDs are intentionally not reversible. Present them as clear redaction labels. */
function humanizeRedactedTokens(content: string): string {
  const labels: Record<string, string> = {
    PERSON: "Person redacted",
    EMAIL: "Email redacted",
    PHONE: "Phone number redacted",
    CARD: "Payment card redacted",
    ORG: "Organization redacted",
    API_KEY: "API credential redacted",
  };
  return content.replace(
    /\[\[GAI_[A-Z0-9]+_(PERSON|EMAIL|PHONE|CARD|ORG|API_KEY)_\d+\]\]|\[(PERSON|EMAIL|PHONE|CARD|ORG|API_KEY)_\d+\]/g,
    (_token, longType: string | undefined, shortType: string | undefined) => {
      const type = longType ?? shortType;
      return type ? `[${labels[type] ?? "Sensitive data redacted"}]` : "[Sensitive data redacted]";
    },
  );
}

function HighlightedText({ text, entities }: { text: string; entities: Entity[] }) {
  const ordered = [...entities].sort((a, b) => a.start - b.start);
  const parts: Array<{ text: string; entity?: Entity; key: string }> = [];
  let cursor = 0;
  ordered.forEach((entity, index) => {
    if (entity.start < cursor || entity.end > text.length) return;
    if (entity.start > cursor) parts.push({ text: text.slice(cursor, entity.start), key: `plain-${index}` });
    parts.push({ text: text.slice(entity.start, entity.end), entity, key: `entity-${index}` });
    cursor = entity.end;
  });
  if (cursor < text.length) parts.push({ text: text.slice(cursor), key: "plain-tail" });
  return <>{parts.map((part) => part.entity
    ? <mark className="guardai-pii-highlight" key={part.key} title={`${part.entity.label} · ${part.entity.token}`}>{part.text}</mark>
    : <span key={part.key}>{part.text}</span>)}</>;
}

function RiskBadge({ level, score }: { level: SecurityInfo["riskLevel"]; score: number }) {
  return <span className={`guardai-risk-badge risk-${level.toLowerCase()}`}>{level} · {score}/100</span>;
}

function SecurityInspection({ message, security }: { message: string; security: SecurityInfo }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copySanitized = async () => {
    try {
      await navigator.clipboard.writeText(security.sanitizedPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="guardai-inspection">
      <button className="guardai-inspection-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="inspection-toggle-left"><ShieldCheck size={17} /><strong>{security.entitiesDetected > 0 ? `${security.entitiesDetected} sensitive item${security.entitiesDetected === 1 ? "" : "s"} protected` : "Security inspection"}</strong></span>
        <span className="inspection-toggle-right"><RiskBadge level={security.riskLevel} score={security.riskScore} />{expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div className="guardai-inspection-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .22 }}>
            <div className="inspection-summary-row">
              <span><Check size={14} /> Sanitized prompt forwarded to OpenAI</span>
              <span><Clock3 size={14} /> {security.processingTimeMs} ms</span>
            </div>
            <div className="inspection-grid">
              <div className="inspection-panel">
                <div className="inspection-panel-heading"><strong>Detected in your message</strong><span>Original values · browser session</span></div>
                <p className="inspection-original"><HighlightedText text={message} entities={security.entities} /></p>
                {security.entities.length > 0 ? (
                  <div className="inspection-entities">
                    {security.entities.map((entity, index) => (
                      <div className="inspection-entity" key={`${entity.token}-${index}`}>
                        <span className="inspection-entity-type">{entity.label}</span>
                        <strong>{message.slice(entity.start, entity.end)}</strong>
                        <code>{entity.token}</code>
                      </div>
                    ))}
                  </div>
                ) : <p className="inspection-empty">No supported sensitive entities were detected by the current rule set.</p>}
              </div>
              <div className="inspection-panel">
                <div className="inspection-panel-heading"><strong>What OpenAI received</strong><button className="inspection-copy" onClick={copySanitized}><Copy size={13} /> {copied ? "Copied" : "Copy"}</button></div>
                <pre className="inspection-sanitized">{security.sanitizedPrompt}</pre>
                <div className="inspection-safe-note"><LockKeyhole size={14} /> Only this sanitized text was forwarded to the AI provider.</div>
              </div>
            </div>
            {security.restorationWarning && <div className="inspection-warning"><TriangleAlert size={15} /> A placeholder could not be safely restored. It remains masked.</div>}
            <p className="inspection-privacy-note">The original prompt is shown from this browser session. Supabase stores only sanitized conversation content and security metadata.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function SecureChatWorkspace({ user, initialDraftPrompt }: Props) {
  const { sessions, setSessions, activeSessionId, setActiveSessionId } = useChatSessions();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState(initialDraftPrompt);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipNextSessionLoad = useRef<string | null>(null);

  const refreshSessions = useCallback(async () => {
    if (!supabase) return;
    const { data, error: queryError } = await supabase
      .from("chat_sessions")
      .select("id,title,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (!queryError && data) setSessions(data);
  }, [setSessions, user.id]);

  useEffect(() => { void refreshSessions(); }, [refreshSessions]);

  useEffect(() => {
    let cancelled = false;
    async function loadMessages() {
      if (activeSessionId && skipNextSessionLoad.current === activeSessionId) {
        skipNextSessionLoad.current = null;
        return;
      }
      if (!activeSessionId) { setMessages([]); return; }
      if (!supabase) return;
      setLoadingHistory(true);
      setError(null);
      const { data, error: queryError } = await supabase
        .from("chat_messages")
        .select("id,role,sanitized_content,created_at,request_id")
        .eq("session_id", activeSessionId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (queryError) setError("We could not load this conversation. Please try again.");
      else setMessages((data ?? []).map((row) => ({
        id: row.id,
        role: row.role as "user" | "assistant",
        content: row.sanitized_content,
        createdAt: row.created_at,
        historyOnly: true,
      })));
      setLoadingHistory(false);
    }
    void loadMessages();
    return () => { cancelled = true; };
  }, [activeSessionId, user.id]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const activeTitle = useMemo(() => sessions.find((session) => session.id === activeSessionId)?.title ?? "New secure conversation", [activeSessionId, sessions]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const originalPrompt = draft.trim();
    if (!originalPrompt || sending) return;
    if (!supabase) { setError("Supabase is not configured. Check the frontend environment settings."); return; }

    setSending(true);
    setError(null);
    const optimisticId = crypto.randomUUID();
    setMessages((previous) => [...previous, { id: optimisticId, role: "user", content: originalPrompt, createdAt: new Date().toISOString() }]);
    setDraft("");

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("secure-chat", {
        body: { message: originalPrompt, sessionId: activeSessionId },
      });
      if (invokeError) throw new Error(invokeError.message || "Protected request failed.");
      if (!data?.success || typeof data.assistantMessage !== "string" || !data.security) {
        throw new Error(data?.error || "GuardAI returned an incomplete response.");
      }

      const security = data.security as SecurityInfo;
      const assistantMessage: ChatMessage = {
        id: `${data.requestId}-assistant`, role: "assistant", content: data.assistantMessage,
        createdAt: new Date().toISOString(),
      };
      setMessages((previous) => previous.map((message) => message.id === optimisticId ? { ...message, security } : message).concat(assistantMessage));
      if (!activeSessionId) skipNextSessionLoad.current = data.sessionId;
      setActiveSessionId(data.sessionId);
      await refreshSessions();
    } catch (requestError) {
      const safeMessage = requestError instanceof Error ? requestError.message : "GuardAI could not complete the protected request. Please try again.";
      setMessages((previous) => previous.filter((message) => message.id !== optimisticId));
      setDraft(originalPrompt);
      setError(safeMessage);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); }
  };
  const startNewChat = () => { setActiveSessionId(null); setMessages([]); setDraft(""); setError(null); textareaRef.current?.focus(); };

  return (
    <div className="secure-chat-workspace">
      <header className="secure-chat-heading">
        <div className="secure-chat-heading-copy">
          <span className="hero-kicker">PRIVATE AI WORKSPACE</span>
          <h1>{activeTitle}</h1>
          <p>GuardAI inspects and sanitizes your prompt before it reaches the AI provider.</p>
        </div>
        <div className="secure-chat-heading-actions">
          <span className="secure-chat-online"><i /> Protection pipeline</span>
          <button className="secure-new-chat-inline" onClick={startNewChat}><MessageSquareText size={15} /> New chat</button>
        </div>
      </header>

      <div className="secure-chat-body">
        <div className="secure-message-list" aria-live="polite" ref={messageListRef}>
          {loadingHistory && <div className="secure-chat-loading"><LoaderCircle size={17} /> Loading sanitized conversation…</div>}
          {!loadingHistory && messages.length === 0 && (
            <motion.div className="secure-chat-empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="secure-chat-empty-icon"><ShieldCheck size={30} /></div>
              <span className="hero-kicker">GUARDAI PROTECTION IS READY</span>
              <h2>What would you like to work on?</h2>
              <p>Write naturally. GuardAI checks your prompt after you send it, masks supported sensitive details, and shows you exactly what was forwarded to the AI provider.</p>
              <div className="secure-chat-suggestions">
                <button onClick={() => setDraft("Help me draft a professional email to a client.")}>Draft a professional email <span>↗</span></button>
                <button onClick={() => setDraft("Explain how data privacy works in generative AI.")}>Explore AI privacy <span>↗</span></button>
              </div>
            </motion.div>
          )}
          {messages.map((message) => (
            <article className={`secure-message-row ${message.role === "user" ? "secure-message-user" : "secure-message-assistant"}`} key={message.id}>
              {message.role === "assistant" && <div className="secure-assistant-avatar"><Sparkles size={16} /></div>}
              <div className="secure-message-main">
                <div className="secure-message-author">{message.role === "user" ? "You" : "GuardAI"}<time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
                <div className={`secure-message-bubble ${message.role === "assistant" ? "secure-markdown" : ""}`}>
                  {message.role === "user" && message.security
                    ? <HighlightedText text={message.content} entities={message.security.entities} />
                    : message.role === "assistant"
                      ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{humanizeRedactedTokens(message.content)}</ReactMarkdown>
                      : message.historyOnly
                        ? humanizeRedactedTokens(message.content)
                        : message.content}
                </div>
                {message.role === "user" && message.security && <SecurityInspection message={message.content} security={message.security} />}
                {message.role === "user" && message.historyOnly && <div className="secure-history-label"><LockKeyhole size={12} /> Sanitized history · original values were not retained</div>}
              </div>
            </article>
          ))}
          {sending && <div className="secure-processing"><span className="secure-processing-pulse"><ShieldCheck size={16} /></span><div><strong>GuardAI is protecting your prompt</strong><small>Inspecting sensitive data and preparing a sanitized AI request…</small></div><LoaderCircle size={17} className="secure-spinner" /></div>}
        </div>

        <div className="secure-composer-wrap">
          {error && <div className="secure-chat-error" role="alert"><ShieldAlert size={15} /><span>{error}</span></div>}
          <form className="secure-chat-composer" onSubmit={submit}>
            <textarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onComposerKeyDown} placeholder="Message GuardAI…" rows={1} maxLength={10000} aria-label="Write a secure AI message" />
            <div className="secure-composer-footer">
              <span><ShieldCheck size={14} /> Checked after sending · 10,000 character limit</span>
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Send protected prompt">{sending ? <LoaderCircle size={18} className="secure-spinner" /> : <ArrowUp size={19} />}</button>
            </div>
          </form>
          <p className="secure-composer-caption">Original text is processed by GuardAI. Only the sanitized prompt is forwarded to OpenAI.</p>
        </div>
      </div>
    </div>
  );
}
