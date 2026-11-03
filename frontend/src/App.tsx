import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, ArrowUp, BarChart3, Check, ChevronDown, Info, LockKeyhole,
  Menu, MessageSquare, Moon, PanelLeftClose, PanelLeftOpen, Plus, Shield,
  ShieldCheck, Sparkles, Sun, UserRound, X, Zap, Globe2,
} from "lucide-react";

type View = "chat" | "about";
type AuthMode = "signin" | "signup";
type Theme = "dark" | "light";

function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand-lockup"><span className="brand-mark"><ShieldCheck size={20} /></span>{!compact && <span className="brand-name">Guard<span>AI</span></span>}</span>;
}

function AnimatedBackdrop() {
  return <div className="ambient-scene" aria-hidden="true">
    <div className="ambient-glow glow-a" /><div className="ambient-glow glow-b" />
    <svg className="wave-art" viewBox="0 0 1200 440" preserveAspectRatio="none">
      <defs><linearGradient id="waveGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#064e3b" stopOpacity="0"/><stop offset="48%" stopColor="#10b981" stopOpacity=".9"/><stop offset="100%" stopColor="#34d399" stopOpacity="0"/></linearGradient></defs>
      <path className="wave wave-a" d="M-40 260 C150 40 220 380 420 220 S720 30 900 205 S1100 320 1240 100"/>
      <path className="wave wave-b" d="M-30 300 C130 100 260 390 450 250 S730 100 900 220 S1080 290 1240 160"/>
      <path className="wave wave-c" d="M-30 200 C160 360 270 65 470 205 S740 360 930 170 S1100 90 1240 250"/>
      <path className="wave wave-d" d="M-30 330 C150 150 260 330 450 280 S720 110 910 260 S1100 340 1240 180"/>
    </svg>
    <div className="particle-field">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties}/>)}</div>
  </div>;
}

function AuthDialog({ open, mode, setMode, onClose }: { open: boolean; mode: AuthMode; setMode: (mode: AuthMode) => void; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  return <AnimatePresence>
    {open && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" initial={{ opacity: 0, y: 22, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .98 }} transition={{ type: "spring", stiffness: 280, damping: 25 }}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={18}/></button>
        <div className="modal-emblem"><LockKeyhole size={23}/></div>
        <span className="eyebrow">YOUR PRIVACY, YOUR CONTROL</span>
        <h2 id="auth-title">{mode === "signin" ? "Welcome back" : "Create your GuardAI account"}</h2>
        <p>{mode === "signin" ? "Sign in to continue with your protected AI workspace." : "Create an account to save secure conversations and activity."}</p>
        <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
          {mode === "signup" && <label>Full name<input type="text" placeholder="Your name" autoComplete="name" required/></label>}
          <label>Email address<input type="email" placeholder="you@example.com" autoComplete="email" required/></label>
          <label>Password<input type="password" placeholder="Enter your password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required/></label>
          <button className="primary-button auth-submit" type="submit">{mode === "signin" ? "Sign in" : "Create account"}<ArrowRight size={17}/></button><p className="form-note">Account connection is the next integration step.</p>
        </form>
        <div className="auth-switch">{mode === "signin" ? "New to GuardAI?" : "Already have an account?"}<button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Create account" : "Sign in"}</button></div>
        <div className="modal-security"><ShieldCheck size={14}/> Protected processing is available after authentication.</div>
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}

function LandingView({ onSignIn }: { onSignIn: () => void }) {
  const [prompt, setPrompt] = useState("");
  const send = (event?: FormEvent) => { event?.preventDefault(); if (prompt.trim()) onSignIn(); };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } };
  return <div className="landing-content">
    <div className="hero-content">
      <motion.div className="hero-shield" initial={{ opacity: 0, scale: .7, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .7 }}><Shield size={39}/><Sparkles className="shield-spark" size={13}/></motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12, duration: .65 }}>
        <span className="hero-kicker">THE PRIVACY LAYER FOR GENERATIVE AI</span>
        <h1>AI conversations,<br/><span>without the exposure.</span></h1>
        <p className="hero-description">GuardAI detects and masks supported sensitive information before your prompt reaches an external AI service.</p>
      </motion.div>
      <motion.div className="feature-grid" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .24, duration: .65 }}>
        <div className="feature-chip"><LockKeyhole size={17}/><span>Data masking</span></div><div className="feature-chip"><Zap size={17}/><span>PII detection</span></div><div className="feature-chip"><BarChart3 size={17}/><span>Risk scoring</span></div><div className="feature-chip"><ShieldCheck size={17}/><span>Privacy insights</span></div>
      </motion.div>
    </div>
    <motion.form className="composer-dock" onSubmit={send} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .32, duration: .55 }}>
      <div className="composer-box"><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={keyDown} placeholder="Message GuardAI..." rows={1} aria-label="Write a message to GuardAI"/><div className="composer-footer"><div className="composer-hint"><ShieldCheck size={14}/><span>Your prompt is checked after you send.</span></div><button type="submit" className="send-button" disabled={!prompt.trim()} aria-label="Send message"><ArrowUp size={19}/></button></div></div>
      <p className="composer-disclaimer">Explore GuardAI freely. <button type="button" onClick={onSignIn}>Sign in to start a protected conversation</button></p>
    </motion.form>
  </div>;
}

function AboutView() {
  return <div className="about-content">
    <div className="about-heading"><span className="hero-kicker">BUILT FOR A MORE PRIVATE AI FUTURE</span><h1>About <span>GuardAI</span></h1><p>GuardAI is an academic software engineering project exploring how an intermediary privacy layer can reduce exposure of sensitive information when people use generative AI.</p></div>
    <div className="about-cards"><article className="about-card"><ShieldCheck/><h3>Privacy by design</h3><p>Supported personal information is detected and replaced before prompts are sent to an external AI provider.</p></article><article className="about-card"><BarChart3/><h3>Transparent protection</h3><p>Users can inspect what was detected, masked and assessed for risk after each request.</p></article><article className="about-card"><Globe2/><h3>Responsible AI use</h3><p>The project makes privacy controls visible while documenting the limits of automated detection.</p></article></div>
    <section className="team-placeholder"><div><span className="hero-kicker">THE PEOPLE BEHIND THE PROJECT</span><h2>Project team</h2><p>Team names, registration numbers and academic details will be added after confirmation.</p></div><div className="team-note"><UserRound size={20}/><span>Three team members</span></div></section>
  </div>;
}

export default function App() {
  const [view, setView] = useState<View>("chat");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authOpen, setAuthOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const closeAuth = useCallback(() => setAuthOpen(false), []);
  const openAuth = (mode: AuthMode = "signin") => { setAuthMode(mode); setAuthOpen(true); };
  const navigate = (next: View) => { setView(next); setSidebarOpen(false); };

  return <div className="app-shell" data-theme={theme}><AnimatedBackdrop/>
    <div className="app-frame">
      <AnimatePresence>{sidebarOpen && <motion.button className="mobile-scrim" aria-label="Close navigation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)}/>}</AnimatePresence>
      <motion.aside className={`sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${sidebarOpen ? "sidebar-mobile-open" : ""}`} initial={false} animate={{ width: sidebarCollapsed ? 76 : 258 }} transition={{ duration: .24, ease: [0.22, 1, .36, 1] }}>
        <div className="sidebar-top"><button className="brand-button" onClick={() => navigate("chat")} aria-label="GuardAI home"><Brand compact={sidebarCollapsed}/></button><button className="icon-button sidebar-toggle desktop-only" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}</button><button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18}/></button></div>
        <div className="sidebar-actions"><button className="new-chat-button" onClick={() => navigate("chat")}><Plus size={18}/><span>New chat</span><kbd>⌘ K</kbd></button><button className={`nav-button ${view === "about" ? "nav-active" : ""}`} onClick={() => navigate("about")}><Info size={18}/><span>About GuardAI</span></button></div>
        {!sidebarCollapsed && <><div className="sidebar-section"><div className="section-label">RECENT CHATS</div><div className="history-empty"><MessageSquare size={19}/><span>Your conversations will appear here after you sign in.</span></div></div><div className="sidebar-promo"><div className="promo-icon"><ShieldCheck size={20}/></div><strong>Your privacy comes first</strong><p>Detect sensitive data. Mask it before AI processing. Stay in control.</p><div className="promo-points"><span><Check size={13}/> Data masking</span><span><Check size={13}/> Risk insights</span></div></div></>}
        <div className="sidebar-bottom"><button className="profile-entry" onClick={() => openAuth("signin")}><span className="avatar-placeholder"><UserRound size={17}/></span>{!sidebarCollapsed && <span className="profile-copy"><strong>Guest workspace</strong><small>Sign in to save your chats</small></span>}{!sidebarCollapsed && <ChevronDown size={15} className="muted-icon"/>}</button></div>
      </motion.aside>

      <main className="main-panel">
        <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><span className="mobile-brand"><Brand/></span><span className="topbar-context">{view === "chat" ? "Private AI workspace" : "Discover GuardAI"}</span></div><div className="topbar-actions"><span className="protection-pill"><i/> Privacy layer ready</span><button className="icon-button theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle color theme">{theme === "dark" ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="primary-button top-signin" onClick={() => openAuth("signin")}>Sign in <ArrowRight size={15}/></button></div></header>
        {view === "chat" ? <LandingView onSignIn={() => openAuth("signin")}/> : <AboutView/>}
        <footer className="page-footer"><span>GuardAI Gateway</span><span>Privacy-first AI · Academic prototype</span><span className="footer-status"><i/> Guest preview</span></footer>
      </main>
    </div>
    <AuthDialog open={authOpen} mode={authMode} setMode={setAuthMode} onClose={closeAuth}/>
  </div>;
}
