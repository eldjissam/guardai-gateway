import { useState, type FormEvent, type KeyboardEvent, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, ArrowUp, BarChart3, Check, ChevronDown, Info, LockKeyhole,
  Menu, MessageSquare, Moon, PanelLeftClose, PanelLeftOpen, Plus, Shield,
  ShieldCheck, Sparkles, Sun, UserRound, X, Zap, Globe2, Eye, EyeOff,
  Mail, KeyRound, ArrowLeft,
} from "lucide-react";

type View = "chat" | "about" | "signin" | "signup";
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

function LandingView({ onSignIn }: { onSignIn: (mode?: AuthMode) => void }) {
  const [prompt, setPrompt] = useState("");

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    if (prompt.trim()) onSignIn("signin");
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
          Explore GuardAI freely. <button type="button" onClick={() => onSignIn("signup")}>Create an account</button> to start a protected conversation.
        </p>
      </motion.form>
    </div>
  );
}

function AboutView() {
  return (
    <div className="about-content">
      <div className="about-heading">
        <span className="hero-kicker">BUILT FOR A MORE PRIVATE AI FUTURE</span>
        <h1>About <span>GuardAI</span></h1>
        <p>
          GuardAI is an academic software engineering project exploring how an intermediary privacy layer can reduce exposure of sensitive information when people use generative AI.
        </p>
      </div>
      <div className="about-cards">
        <article className="about-card"><ShieldCheck /><h3>Privacy by design</h3><p>Supported personal information is detected and replaced before prompts are sent to an external AI provider.</p></article>
        <article className="about-card"><BarChart3 /><h3>Transparent protection</h3><p>Users can inspect what was detected, masked and assessed for risk after each request.</p></article>
        <article className="about-card"><Globe2 /><h3>Responsible AI use</h3><p>The project makes privacy controls visible while documenting the limits of automated detection.</p></article>
      </div>
      <section className="team-placeholder">
        <div><span className="hero-kicker">THE PEOPLE BEHIND THE PROJECT</span><h2>Project team</h2><p>Team names, registration numbers and academic details will be added after confirmation.</p></div>
        <div className="team-note"><UserRound size={20} /><span>Three team members</span></div>
      </section>
    </div>
  );
}

function AuthPage({ mode, onMode, onBack }: {
  mode: AuthMode;
  onMode: (mode: AuthMode) => void;
  onBack: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const isSignup = mode === "signup";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("Authentication will be connected to Supabase in the next integration phase. No account has been created yet.");
  };

  return (
    <motion.main
      className={`auth-page auth-${mode}`}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .32, ease: "easeOut" }}
    >
      <button className="auth-back icon-button" onClick={onBack} aria-label="Back to GuardAI home">
        <ArrowLeft size={19} />
      </button>

      <div className="auth-split">
        <motion.section className="auth-form-panel" layout transition={{ duration: .45 }}>
          <div className="auth-form-inner">
            <button className="auth-brand-button" onClick={onBack} aria-label="GuardAI home"><Brand /></button>
            <div className="auth-heading">
              <span className="hero-kicker">{isSignup ? "START WITH PRIVACY" : "YOUR PRIVACY, YOUR CONTROL"}</span>
              <h1>{isSignup ? "Create your account" : "Welcome back."}</h1>
              <p>{isSignup ? "Create your secure workspace and take control of your AI conversations." : "Sign in to continue to your protected AI workspace."}</p>
            </div>

            <form className="auth-page-form" onSubmit={submit}>
              {isSignup && (
                <label>
                  Full name
                  <span className="auth-input-wrap"><UserRound size={17} /><input type="text" name="fullName" placeholder="Your full name" autoComplete="name" required /></span>
                </label>
              )}
              <label>
                Email address
                <span className="auth-input-wrap"><Mail size={17} /><input type="email" name="email" placeholder="you@example.com" autoComplete="email" required /></span>
              </label>
              <label>
                Password
                <span className="auth-input-wrap">
                  <KeyRound size={17} />
                  <input type={showPassword ? "text" : "password"} name="password" placeholder="At least 8 characters" minLength={8} autoComplete={isSignup ? "new-password" : "current-password"} required />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>
              {isSignup && (
                <label>
                  Confirm password
                  <span className="auth-input-wrap"><LockKeyhole size={17} /><input type="password" name="confirmPassword" placeholder="Repeat your password" minLength={8} required /></span>
                </label>
              )}
              {!isSignup && <button type="button" className="forgot-link" onClick={() => setNotice("Password reset will be available after Supabase Auth is connected.")}>Forgot password?</button>}
              <button className="primary-button auth-page-submit" type="submit">
                {isSignup ? "Create account" : "Sign in"} <ArrowRight size={18} />
              </button>
              {notice && <p className="auth-notice" role="status">{notice}</p>}
            </form>

            <div className="auth-page-switch">
              {isSignup ? "Already have an account?" : "New to GuardAI?"}
              <button onClick={() => { setNotice(""); onMode(isSignup ? "signin" : "signup"); }}>
                {isSignup ? "Sign in" : "Create account"}
              </button>
            </div>
            <div className="auth-assurance"><ShieldCheck size={15} /> Protected processing is available after authentication.</div>
          </div>
        </motion.section>

        <motion.section className="auth-visual-panel" layout transition={{ duration: .45 }}>
          <div className="auth-orbit orbit-one" />
          <div className="auth-orbit orbit-two" />
          <div className="auth-visual-content">
            <motion.div
              className="auth-visual-shield"
              animate={{ y: [0, -8, 0], rotate: [0, 2, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <ShieldCheck size={76} strokeWidth={1.35} />
              <Sparkles className="auth-visual-spark" size={20} />
            </motion.div>
            <span className="hero-kicker">GUARDAI GATEWAY</span>
            <h2>{isSignup ? "Your AI. Your data. Your control." : "Think freely. Share safely."}</h2>
            <p>
              {isSignup
                ? "Bring privacy into every AI interaction with visible protection and transparent security insights."
                : "Your sensitive information is detected and masked before it reaches an external AI service."}
            </p>
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

export default function App() {
  const [view, setView] = useState<View>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");

  const navigate = (next: View) => {
    setView(next);
    setSidebarOpen(false);
  };
  const openAuth = (mode: AuthMode = "signin") => navigate(mode);

  if (view === "signin" || view === "signup") {
    return (
      <div className="app-shell auth-shell" data-theme={theme}>
        <AnimatedBackdrop />
        <div className="auth-theme-control">
          <button className="icon-button theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle color theme">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <AnimatePresence mode="wait">
          <AuthPage key="auth" mode={view} onMode={openAuth} onBack={() => navigate("chat")} />
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <AnimatedBackdrop />
      <div className="app-frame">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.button className="mobile-scrim" aria-label="Close navigation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />
          )}
        </AnimatePresence>
        <motion.aside
          className={`sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${sidebarOpen ? "sidebar-mobile-open" : ""}`}
          initial={false}
          animate={{ width: sidebarCollapsed ? 76 : 258 }}
          transition={{ duration: .24, ease: [0.22, 1, .36, 1] }}
        >
          <div className="sidebar-top">
            <button className="brand-button" onClick={() => navigate("chat")} aria-label="GuardAI home"><Brand compact={sidebarCollapsed} /></button>
            <button className="icon-button sidebar-toggle desktop-only" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
            <button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button>
          </div>
          <div className="sidebar-actions">
            <button className="new-chat-button" onClick={() => navigate("chat")}><Plus size={18} /><span>New chat</span><kbd>⌘ K</kbd></button>
            <button className={`nav-button ${view === "about" ? "nav-active" : ""}`} onClick={() => navigate("about")}><Info size={18} /><span>About GuardAI</span></button>
          </div>
          {!sidebarCollapsed && (
            <>
              <div className="sidebar-section">
                <div className="section-label">RECENT CHATS</div>
                <div className="history-empty"><MessageSquare size={19} /><span>Your conversations will appear here after you sign in.</span></div>
              </div>
              <div className="sidebar-promo">
                <div className="promo-icon"><ShieldCheck size={20} /></div>
                <strong>Your privacy comes first</strong>
                <p>Detect sensitive data. Mask it before AI processing. Stay in control.</p>
                <div className="promo-points"><span><Check size={13} /> Data masking</span><span><Check size={13} /> Risk insights</span></div>
              </div>
            </>
          )}
          <div className="sidebar-bottom">
            <button className="profile-entry" onClick={() => openAuth("signin")}>
              <span className="avatar-placeholder"><UserRound size={17} /></span>
              {!sidebarCollapsed && <span className="profile-copy"><strong>Guest workspace</strong><small>Sign in to save your chats</small></span>}
              {!sidebarCollapsed && <ChevronDown size={15} className="muted-icon" />}
            </button>
          </div>
        </motion.aside>

        <main className="main-panel">
          <header className="topbar">
            <div className="topbar-left">
              <button className="icon-button mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
              <span className="mobile-brand"><Brand /></span>
              <span className="topbar-context">{view === "chat" ? "Private AI workspace" : "Discover GuardAI"}</span>
            </div>
            <div className="topbar-actions">
              <span className="protection-pill"><i /> Privacy layer ready</span>
              <button className="icon-button theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle color theme">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
              <button className="primary-button top-signin" onClick={() => openAuth("signin")}>Sign in <ArrowRight size={15} /></button>
            </div>
          </header>
          <AnimatePresence mode="wait">
            {view === "chat"
              ? <motion.div key="chat" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2 }}><LandingView onSignIn={openAuth} /></motion.div>
              : <motion.div key="about" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2 }}><AboutView /></motion.div>
            }
          </AnimatePresence>
          <footer className="page-footer"><span>GuardAI Gateway</span><span>Privacy-first AI · Academic prototype</span><span className="footer-status"><i /> Guest preview</span></footer>
        </main>
      </div>
    </div>
  );
}
