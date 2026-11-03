import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, ArrowUp, BarChart3, Check, ChevronDown, Info, LockKeyhole,
  Menu, MessageSquare, Moon, PanelLeftClose, PanelLeftOpen, Plus, Shield,
  ShieldCheck, Sparkles, Sun, UserRound, X, Zap, Globe2, Eye, EyeOff,
  Mail, KeyRound, ArrowLeft, LogOut, CircleCheck,
} from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import { useChatSessions } from "./contexts/ChatSessionContext";
import SecureChatWorkspace from "./components/chat/SecureChatWorkspace";
import AdminDashboard from "./components/admin/AdminDashboard";
import { supabase } from "./lib/supabase";
import ChatHistoryList from "./components/layout/ChatHistoryList";

type View = "chat" | "about" | "signin" | "signup" | "reset" | "workspace" | "admin";
type AuthMode = "signin" | "signup";
type Theme = "dark" | "light";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup">
      <span className="brand-mark"><ShieldCheck size={20} /></span>
      {!compact && <span className="brand-name">Guard<span>AI</span></span>}
    </span>
  );
}

function AnimatedBackdrop() {
  return (
    <div className="ambient-scene" aria-hidden="true">
      <div className="ambient-glow glow-a" />
      <div className="ambient-glow glow-b" />
      <svg className="wave-art" viewBox="0 0 1200 440" preserveAspectRatio="none">
        <defs>
          <linearGradient id="waveGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#064e3b" stopOpacity="0" />
            <stop offset="48%" stopColor="#10b981" stopOpacity=".9" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="wave wave-a" d="M-40 260 C150 40 220 380 420 220 S720 30 900 205 S1100 320 1240 100" />
        <path className="wave wave-b" d="M-30 300 C130 100 260 390 450 250 S730 100 900 220 S1080 290 1240 160" />
        <path className="wave wave-c" d="M-30 200 C160 360 270 65 470 205 S740 360 930 170 S1100 90 1240 250" />
        <path className="wave wave-d" d="M-30 330 C150 150 260 330 450 280 S720 110 910 260 S1100 340 1240 180" />
      </svg>
      <div className="particle-field">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}

function LandingView({
  onSignIn,
  onRequestToSend,
  prompt,
  setPrompt,
}: {
  onSignIn: (mode?: AuthMode) => void;
  onRequestToSend: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
}) {
  const send = (event?: FormEvent) => {
    event?.preventDefault();
    if (prompt.trim()) onRequestToSend();
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="landing-content">
      <div className="hero-content">
        <motion.div
          className="hero-shield"
          initial={{ opacity: 0, scale: .7, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: .7 }}
        >
          <Shield size={39} />
          <Sparkles className="shield-spark" size={13} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: .12, duration: .65 }}
        >
          <span className="hero-kicker">THE PRIVACY LAYER FOR GENERATIVE AI</span>
          <h1>AI conversations,<br /><span>without the exposure.</span></h1>
          <p className="hero-description">
            GuardAI detects and masks supported sensitive information before your prompt reaches an external AI service.
          </p>
        </motion.div>
        <motion.div
          className="feature-grid"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: .24, duration: .65 }}
        >
          <div className="feature-chip"><LockKeyhole size={17} /><span>Data masking</span></div>
          <div className="feature-chip"><Zap size={17} /><span>PII detection</span></div>
          <div className="feature-chip"><BarChart3 size={17} /><span>Risk scoring</span></div>
          <div className="feature-chip"><ShieldCheck size={17} /><span>Privacy insights</span></div>
        </motion.div>
      </div>

      {/* Centered with CSS margins; do not animate transform on this element. */}
      <motion.form
        className="composer-dock"
        onSubmit={send}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: .32, duration: .55 }}
      >
        <div className="composer-box">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={keyDown}
            placeholder="Message GuardAI..."
            rows={1}
            aria-label="Write a message to GuardAI"
          />
          <div className="composer-footer">
            <div className="composer-hint"><ShieldCheck size={14} /><span>Your prompt is checked after you send.</span></div>
            <button type="submit" className="send-button" disabled={!prompt.trim()} aria-label="Send message"><ArrowUp size={19} /></button>
          </div>
        </div>
        <p className="composer-disclaimer">
          Guest preview · Sign in is required to send prompts. <button type="button" onClick={() => onSignIn("signup")}>Create a free account</button>.
        </p>
      </motion.form>
    </div>
  );
}


function GuestAccessDialog({
  open,
  onClose,
  onCreateAccount,
  onSignIn,
}: {
  open: boolean;
  onClose: () => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="guest-gate-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            className="guest-gate-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-gate-title"
            initial={{ opacity: 0, y: 18, scale: .97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: .98 }}
            transition={{ type: "spring", stiffness: 280, damping: 25 }}
          >
            <button className="icon-button guest-gate-close" onClick={onClose} aria-label="Close sign-in notice"><X size={18} /></button>
            <div className="guest-gate-icon"><LockKeyhole size={25} /></div>
            <span className="hero-kicker">ONE MORE STEP TO GET STARTED</span>
            <h2 id="guest-gate-title">Sign in to send your prompt</h2>
            <p className="guest-gate-description">
              A GuardAI account is required to start protected AI processing, review detected information and save your secure conversation history.
            </p>
            <div className="guest-gate-assurance">
              <span><ShieldCheck size={16} /> Your draft has not been sent to GuardAI or OpenAI.</span>
              <span><Check size={16} /> It will remain here while you choose how to continue.</span>
            </div>
            <div className="guest-gate-actions">
              <button className="primary-button guest-gate-primary" onClick={onCreateAccount}>
                Create a free account <ArrowRight size={17} />
              </button>
              <button className="guest-gate-secondary" onClick={onSignIn}>
                I already have an account <ArrowRight size={16} />
              </button>
              <button className="guest-gate-dismiss" onClick={onClose}>Continue exploring as a guest</button>
            </div>
            <div className="guest-gate-footnote"><ShieldCheck size={14} /> Protected processing starts after authentication.</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AboutView() {
  const pillars = [
    { number: "01", icon: <ShieldCheck size={20} />, title: "Detect with context", description: "Identify supported personal and organizational information in a submitted prompt." },
    { number: "02", icon: <LockKeyhole size={20} />, title: "Protect before AI", description: "Replace detected values with temporary tokens before the request leaves the gateway." },
    { number: "03", icon: <BarChart3 size={20} />, title: "Make protection visible", description: "Show users what was detected, what was masked and the risk assessment." },
    { number: "04", icon: <Eye size={20} />, title: "Be transparent about limits", description: "Explain detection limits and never present automated masking as a guarantee of complete privacy." },
  ];
  const steps = ["Prompt submitted", "Sensitive data detected", "Sanitized request sent", "Response restored"];
  const roles = [
    { number: "01", role: "Frontend & experience", focus: "Interface, accessibility and interaction design" },
    { number: "02", role: "Backend & AI integration", focus: "Gateway, data flow and model integration" },
    { number: "03", role: "Privacy & quality", focus: "Detection rules, risk evaluation and testing" },
  ];

  return (
    <div className="about-content">
      <motion.section className="about-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
        <div className="about-hero-copy">
          <span className="hero-kicker">THE PRIVACY LAYER FOR GENERATIVE AI</span>
          <h1>Meet <span>GuardAI.</span></h1>
          <p>Bring a privacy checkpoint to every AI conversation. GuardAI helps identify sensitive information, mask it before external processing and make each protection decision easier to understand.</p>
        </div>
        <div className="about-hero-visual" aria-hidden="true">
          <div className="about-orbit about-orbit-a" /><div className="about-orbit about-orbit-b" />
          <div className="about-hero-emblem"><ShieldCheck size={58} strokeWidth={1.45} /><Sparkles size={17} /></div>
          <span className="about-visual-caption">PRIVACY · TRANSPARENCY · CONTROL</span>
        </div>
        <div className="about-meta-row">
          <span><ShieldCheck size={14} /> Privacy-first architecture</span>
          <span><Zap size={14} /> AI-assisted workflow</span>
          <span><UserRound size={14} /> Three-person project team</span>
        </div>
      </motion.section>

      <section className="about-section-block">
        <div className="about-section-heading"><div><span className="section-eyebrow">WHAT MAKES IT DIFFERENT</span><h2>Protection you can actually see.</h2></div><span className="about-section-aside">Our four core principles</span></div>
        <div className="about-pillar-grid">
          {pillars.map((item, index) => (
            <motion.article className="about-pillar-card" key={item.number} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 * index, duration: .38 }}>
              <div className="pillar-card-top"><span className="pillar-icon">{item.icon}</span><span className="pillar-number">{item.number}</span></div>
              <h3>{item.title}</h3><p>{item.description}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="about-flow-section">
        <div className="about-section-heading compact"><div><span className="section-eyebrow">HOW IT WORKS</span><h2>One protected journey.</h2></div><span className="about-section-aside">From prompt to response</span></div>
        <div className="about-flow-track">
          {steps.map((step, index) => <div className="about-flow-step" key={step}><span className="flow-step-number">0{index + 1}</span><span className="flow-step-dot" /><strong>{step}</strong>{index < steps.length - 1 && <span className="flow-step-line" />}</div>)}
        </div>
      </section>

      <section className="about-team-section">
        <div className="about-team-intro"><span className="section-eyebrow">THE PEOPLE BEHIND THE PROJECT</span><h2>Built by a team of three.</h2><p>One shared goal: make safer AI interactions easier to understand.</p><span className="team-academic-tag"><Globe2 size={13} /> Academic software engineering project</span></div>
        <div className="about-role-grid">
          {roles.map((item) => <article className="about-role-card" key={item.number}><span>{item.number}</span><div><strong>{item.role}</strong><small>{item.focus}</small></div></article>)}
        </div>
        <div className="about-team-note"><Info size={14} /><span>Member names, registration numbers and group details will be added after confirmation.</span></div>
      </section>
    </div>
  );
}

type AuthPageMode = AuthMode | "reset";
type Notice = { kind: "success" | "error" | "info"; message: string } | null;

function AuthPage({ mode, onMode, onBack, onAuthenticated, confirmationEmail, onRegistrationPending, onClearConfirmation }: {
  mode: AuthPageMode;
  onMode: (mode: AuthMode) => void;
  onBack: () => void;
  onAuthenticated: () => void;
  confirmationEmail: string | null;
  onRegistrationPending: (email: string) => void;
  onClearConfirmation: () => void;
}) {
  const { isConfigured, signIn, signUp, resendConfirmation, resetPassword, updatePassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [email, setEmail] = useState("");
  const isSignup = mode === "signup";
  const isReset = mode === "reset";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (isSubmitting) return;
    if (!isConfigured) {
      setNotice({ kind: "error", message: "Supabase is not configured yet. Add the project URL and publishable key to frontend/.env.local, then restart the development server." });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if ((isSignup || isReset) && password !== confirmPassword) {
      setNotice({ kind: "error", message: "The passwords do not match. Please check both fields." });
      return;
    }
    if (password.length < 8) {
      setNotice({ kind: "error", message: "Use a password with at least 8 characters." });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    try {
      if (isReset) {
        await updatePassword(password);
        setNotice({ kind: "success", message: "Your password has been updated. You are now signed in." });
        onAuthenticated();
        return;
      }

      if (isSignup) {
        const fullName = String(formData.get("fullName") ?? "").trim();
        if (fullName.length < 2) {
          setNotice({ kind: "error", message: "Please enter your full name." });
          return;
        }
        const normalizedEmail = email.trim().toLowerCase();
        const result = await signUp(fullName, normalizedEmail, password);
        if (result.emailConfirmationRequired) {
          // Clear all credential fields before navigating away from sign-up.
          formElement.reset();
          setEmail("");
          setShowPassword(false);
          onRegistrationPending(normalizedEmail);
        } else {
          formElement.reset();
          setEmail("");
          onClearConfirmation();
          onAuthenticated();
        }
      } else {
        await signIn(email.trim().toLowerCase(), password);
        onClearConfirmation();
        onAuthenticated();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed. Please try again.";
      setNotice({ kind: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendResetEmail = async () => {
    if (!isConfigured) {
      setNotice({ kind: "error", message: "Supabase is not configured yet. Add your project URL and publishable key first." });
      return;
    }
    if (!email.trim()) {
      setNotice({ kind: "info", message: "Enter your account email address first, then select Forgot password." });
      return;
    }
    setIsSubmitting(true);
    setNotice(null);
    try {
      await resetPassword(email.trim());
      setNotice({ kind: "success", message: "Password reset email sent. Open the email on this device and follow its link to choose a new password." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not send the reset email. Please try again.";
      setNotice({ kind: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendSignupConfirmation = async () => {
    if (!confirmationEmail || isSubmitting) return;
    setIsSubmitting(true);
    setNotice(null);
    try {
      await resendConfirmation(confirmationEmail);
      setNotice({ kind: "success", message: "A new confirmation email has been sent. Check your inbox and spam folder." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not resend the confirmation email. Please try again.";
      setNotice({ kind: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isReset ? "Choose a new password" : isSignup ? "Create your account" : "Welcome back.";
  const description = isReset
    ? "Choose a new password for your GuardAI account."
    : isSignup
      ? "Create your secure workspace and take control of your AI conversations."
      : "Sign in to continue to your protected AI workspace.";

  return (
    <motion.main
      className={`auth-page auth-${mode}`}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .32, ease: "easeOut" }}
    >
      <button className="auth-back icon-button" onClick={onBack} aria-label="Back to GuardAI home"><ArrowLeft size={19} /></button>
      <div className="auth-split">
        <motion.section className="auth-form-panel" layout transition={{ duration: .45 }}>
          <div className="auth-form-inner">
            <button className="auth-brand-button" onClick={onBack} aria-label="GuardAI home"><Brand /></button>
            <div className="auth-heading">
              <span className="hero-kicker">{isReset ? "ACCOUNT RECOVERY" : isSignup ? "START WITH PRIVACY" : "YOUR PRIVACY, YOUR CONTROL"}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>

            {!isSignup && !isReset && confirmationEmail && (
              <section className="email-confirmation-panel" role="status" aria-live="polite">
                <div className="email-confirmation-icon"><CircleCheck size={20} /></div>
                <div className="email-confirmation-copy">
                  <strong>Account created. Check your inbox.</strong>
                  <p>We sent a verification link to <b>{confirmationEmail}</b>. Open it in this browser to verify your address. If Supabase establishes a session, GuardAI will open your workspace automatically.</p>
                  <button type="button" className="email-resend-button" onClick={resendSignupConfirmation} disabled={isSubmitting}>
                    {isSubmitting ? "Sending…" : "Resend confirmation email"}
                  </button>
                </div>
              </section>
            )}

            <form className="auth-page-form" onSubmit={submit}>
              {isSignup && (
                <label>Full name
                  <span className="auth-input-wrap"><UserRound size={17} /><input type="text" name="fullName" placeholder="Your full name" autoComplete="name" minLength={2} required /></span>
                </label>
              )}
              {!isReset && (
                <label>Email address
                  <span className="auth-input-wrap"><Mail size={17} /><input type="email" name="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></span>
                </label>
              )}
              <label>{isReset ? "New password" : "Password"}
                <span className="auth-input-wrap">
                  <KeyRound size={17} />
                  <input type={showPassword ? "text" : "password"} name="password" placeholder={isReset ? "Enter your new password" : "At least 8 characters"} minLength={8} autoComplete={isSignup || isReset ? "new-password" : "current-password"} required />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </span>
              </label>
              {(isSignup || isReset) && (
                <label>Confirm password
                  <span className="auth-input-wrap"><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} name="confirmPassword" placeholder="Repeat your password" minLength={8} autoComplete="new-password" required /></span>
                </label>
              )}
              {!isSignup && !isReset && <button type="button" className="forgot-link" onClick={sendResetEmail} disabled={isSubmitting}>Forgot password?</button>}
              <button className="primary-button auth-page-submit" type="submit" disabled={isSubmitting || !isConfigured}>
                {isSubmitting ? "Please wait…" : isReset ? "Update password" : isSignup ? "Create account" : "Sign in"} <ArrowRight size={18} />
              </button>
              {!isConfigured && <p className="auth-notice auth-notice-info" role="status">Supabase connection is not configured yet. Complete the environment setup to enable accounts.</p>}
              {notice && <p className={`auth-notice auth-notice-${notice.kind}`} role="status">{notice.message}</p>}
            </form>

            <div className="auth-page-switch">
              {isReset ? "Remembered your password?" : isSignup ? "Already have an account?" : "New to GuardAI?"}
              <button onClick={() => { setNotice(null); onMode("signin"); }}>
                {isReset ? "Back to sign in" : isSignup ? "Sign in" : "Create account"}
              </button>
            </div>
            <div className="auth-assurance"><ShieldCheck size={15} /> Protected processing is available after authentication.</div>
          </div>
        </motion.section>

        <motion.section className="auth-visual-panel" layout transition={{ duration: .45 }}>
          <div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" />
          <div className="auth-visual-content">
            <motion.div className="auth-visual-shield" animate={{ y: [0, -8, 0], rotate: [0, 2, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
              <ShieldCheck size={76} strokeWidth={1.35} /><Sparkles className="auth-visual-spark" size={20} />
            </motion.div>
            <span className="hero-kicker">GUARDAI GATEWAY</span>
            <h2>{isSignup ? "Your AI. Your data. Your control." : isReset ? "Regain control securely." : "Think freely. Share safely."}</h2>
            <p>{isSignup ? "Bring privacy into every AI interaction with visible protection and transparent security insights." : isReset ? "Choose a new password and return to your protected workspace." : "Your sensitive information is detected and masked before it reaches an external AI service."}</p>
            <div className="auth-visual-points">
              <span><Check size={15} /> Sensitive data detection</span>
              <span><Check size={15} /> Dynamic data masking</span>
              <span><Check size={15} /> Transparent risk insights</span>
            </div>
          </div>
          <span className="auth-visual-footer">INTELLIGENT PRIVACY FOR GENERATIVE AI</span>
        </motion.section>
      </div>
    </motion.main>
  );
}

function AuthenticatedWorkspaceView({ user, draftPrompt, onSignOut }: {
  user: import("@supabase/supabase-js").User;
  draftPrompt: string;
  onSignOut: () => void;
}) {
  void onSignOut; // The global application header owns the sign-out action.
  return <SecureChatWorkspace user={user} initialDraftPrompt={draftPrompt} />;
}

export default function App() {
  const [view, setView] = useState<View>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [guestGateOpen, setGuestGateOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const { user, loading: authLoading, authEvent, signOut } = useAuth();
  const { activeSessionId, setActiveSessionId, setSessions } = useChatSessions();
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const isAdmin = profileRole === "admin";
  const client = supabase;
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setProfileRole(null);
      setProfileLoading(false);
      return;
    }

    if (!client) {
      setProfileRole(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const loadRole = async () => {
      const { data, error } = await client
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfileRole(error ? null : (data?.role ?? "user"));
      setProfileLoading(false);
    };
    void loadRole();
    return () => { cancelled = true; };
  }, [user?.id]);
  const previousUserId = useRef<string | null>(null);
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (previousUserId.current !== currentUserId) {
      setSessions([]);
      setActiveSessionId(null);
      previousUserId.current = currentUserId;
    }
  }, [user?.id, setSessions, setActiveSessionId]);
  const recoveryEventHandled = useRef(false);

  const navigate = (next: View) => { setView(next); setSidebarOpen(false); };
  useEffect(() => {
    if (view !== "admin") return;
    if (!user) setView("chat");
    else if (!profileLoading && profileRole !== "admin") setView("workspace");
  }, [view, user, profileLoading, profileRole]);
  const openAuth = (mode: AuthMode = "signin") => {
    if (mode === "signup") setConfirmationEmail(null);
    navigate(mode);
  };
  const handleRegistrationPending = (email: string) => {
    setConfirmationEmail(email);
    navigate("signin");
  };
  const clearConfirmationEmail = () => setConfirmationEmail(null);
  const handleSignOut = async () => {
    try { await signOut(); setGuestGateOpen(false); navigate("chat"); }
    catch (error) { console.error("Sign out failed", error); }
  };
  const handleAuthenticated = () => navigate("workspace");

  useEffect(() => {
    if (authLoading) return;
    if (authEvent === "PASSWORD_RECOVERY" && !recoveryEventHandled.current) {
      recoveryEventHandled.current = true;
      setView("reset");
      return;
    }
    if (authEvent !== "PASSWORD_RECOVERY") recoveryEventHandled.current = false;
    if (!user && view === "workspace") setView("chat");
    if (user && (view === "signin" || view === "signup")) {
      setConfirmationEmail(null);
      setView("workspace");
    }
    if (user && view === "chat" && (authEvent === "SIGNED_IN" || authEvent === "INITIAL_SESSION")) setView("workspace");
  }, [authLoading, authEvent, user, view]);

  if (view === "signin" || view === "signup" || view === "reset") {
    const authMode: AuthPageMode = view;
    return (
      <div className="app-shell auth-shell" data-theme={theme}>
        <AnimatedBackdrop />
        <div className="auth-theme-control"><button className="icon-button theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle color theme">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button></div>
        <AnimatePresence mode="wait"><AuthPage
            key={authMode}
            mode={authMode}
            onMode={openAuth}
            onBack={() => navigate("chat")}
            onAuthenticated={handleAuthenticated}
            confirmationEmail={confirmationEmail}
            onRegistrationPending={handleRegistrationPending}
            onClearConfirmation={clearConfirmationEmail}
          /></AnimatePresence>
      </div>
    );
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <AnimatedBackdrop />
      <div className="app-frame">
        <AnimatePresence>{sidebarOpen && <motion.button className="mobile-scrim" aria-label="Close navigation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />}</AnimatePresence>
        <motion.aside className={`sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${sidebarOpen ? "sidebar-mobile-open" : ""}`} initial={false} animate={{ width: sidebarCollapsed ? 76 : 258 }} transition={{ duration: .24, ease: [0.22, 1, .36, 1] }}>
          <div className="sidebar-top">
            <button className="brand-button" onClick={() => navigate(user ? "workspace" : "chat")} aria-label="GuardAI home"><Brand compact={sidebarCollapsed} /></button>
            <button className="icon-button sidebar-toggle desktop-only" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>
            <button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button>
          </div>
          <div className="sidebar-actions">
            <button className="new-chat-button" onClick={() => { setActiveSessionId(null); setDraftPrompt(""); navigate(user ? "workspace" : "chat"); }}><Plus size={18} /><span>New chat</span><kbd>⌘ K</kbd></button>
            <button className={`nav-button ${view === "about" ? "nav-active" : ""}`} onClick={() => navigate("about")}><Info size={18} /><span>About GuardAI</span></button>
            {isAdmin && <button className={`nav-button ${view === "admin" ? "nav-active" : ""}`} onClick={() => navigate("admin")}><ShieldCheck size={18} /><span>Admin Control Center</span></button>}
          </div>
          {!sidebarCollapsed && <>
            <div className="sidebar-section">{user ? <ChatHistoryList activeSessionId={activeSessionId} onSelect={(sessionId) => { setActiveSessionId(sessionId); navigate("workspace"); }} /> : <><div className="section-label">RECENT CHATS</div><div className="history-empty"><MessageSquare size={19} /><span>Your conversations will appear here after you sign in.</span></div></>}</div>
            <div className="sidebar-promo"><div className="promo-icon"><ShieldCheck size={20} /></div><strong>Your privacy comes first</strong><p>Detect sensitive data. Mask it before AI processing. Stay in control.</p><div className="promo-points"><span><Check size={13} /> Data masking</span><span><Check size={13} /> Risk insights</span></div></div>
          </>}
          <div className="sidebar-bottom">
            <button className="profile-entry" onClick={() => user ? navigate("workspace") : openAuth("signin")}>
              <span className="avatar-placeholder"><UserRound size={17} /></span>
              {!sidebarCollapsed && <span className="profile-copy"><strong>{user ? (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "GuardAI member") : "Guest workspace"}</strong><small>{user?.email ?? "Sign in to save your chats"}</small></span>}
              {!sidebarCollapsed && <ChevronDown size={15} className="muted-icon" />}
            </button>
          </div>
        </motion.aside>

        <main className="main-panel">
          <header className="topbar">
            <div className="topbar-left"><button className="icon-button mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><span className="mobile-brand"><Brand /></span><span className="topbar-context">{view === "chat" ? "Private AI workspace" : view === "workspace" ? "Your authenticated workspace" : view === "admin" ? "Security operations" : "Discover GuardAI"}</span></div>
            <div className="topbar-actions">
              <span className="protection-pill"><i /> Privacy layer ready</span>
              <button className="icon-button theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle color theme">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
              {user ? <button className="primary-button top-signin" onClick={handleSignOut}><LogOut size={15} /> Sign out</button> : <button className="primary-button top-signin" onClick={() => openAuth("signin")}>Sign in <ArrowRight size={15} /></button>}
            </div>
          </header>
          <AnimatePresence mode="wait">
            {view === "chat" && <motion.div key="chat" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2 }}><LandingView onSignIn={openAuth} prompt={draftPrompt} setPrompt={setDraftPrompt} onRequestToSend={() => user ? navigate("workspace") : setGuestGateOpen(true)} /></motion.div>}
            {view === "about" && <motion.div key="about" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2 }}><AboutView /></motion.div>}
            {view === "admin" && user && isAdmin && <motion.div key="admin" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2 }}><AdminDashboard /></motion.div>}
            {view === "workspace" && user && <motion.div key="workspace" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2 }}><AuthenticatedWorkspaceView user={user} draftPrompt={draftPrompt} onSignOut={handleSignOut} /></motion.div>}
          </AnimatePresence>
          <footer className="page-footer"><span>GuardAI Gateway</span><span>Privacy-first AI · Academic prototype</span><span className="footer-status"><i /> {user ? "Authenticated session" : "Guest preview"}</span></footer>
        </main>
      </div>
      <GuestAccessDialog open={guestGateOpen && !user} onClose={() => setGuestGateOpen(false)} onCreateAccount={() => { setGuestGateOpen(false); openAuth("signup"); }} onSignIn={() => { setGuestGateOpen(false); openAuth("signin"); }} />
    </div>
  );
}
