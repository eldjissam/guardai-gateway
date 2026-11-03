import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "frontend/src/App.tsx");
const mainPath = path.join(root, "frontend/src/main.tsx");
let app = fs.readFileSync(appPath, "utf8");
let main = fs.readFileSync(mainPath, "utf8");

if (!app.includes('from "./components/chat/SecureChatWorkspace"')) {
  const authImport = 'import { useAuth } from "./contexts/AuthContext";';
  if (!app.includes(authImport)) throw new Error("Could not find the AuthContext import in App.tsx. No changes were made.");
  app = app.replace(authImport, `${authImport}\nimport { useChatSessions } from "./contexts/ChatSessionContext";\nimport SecureChatWorkspace from "./components/chat/SecureChatWorkspace";`);
}

const oldWorkspaceStart = app.indexOf("function AuthenticatedWorkspaceView(");
const appStart = app.indexOf("export default function App()");
if (oldWorkspaceStart < 0 || appStart < 0) throw new Error("Could not find the expected workspace and App sections. No changes were made.");
const replacement = `function AuthenticatedWorkspaceView({ user, draftPrompt, onSignOut }: {\n  user: import("@supabase/supabase-js").User;\n  draftPrompt: string;\n  onSignOut: () => void;\n}) {\n  void onSignOut; // The global application header owns the sign-out action.\n  return <SecureChatWorkspace user={user} initialDraftPrompt={draftPrompt} />;\n}\n\n`;
app = app.slice(0, oldWorkspaceStart) + replacement + app.slice(appStart);

if (!app.includes("const { sessions, activeSessionId, setActiveSessionId, setSessions } = useChatSessions();")) {
  const authState = 'const { user, loading: authLoading, authEvent, signOut } = useAuth();';
  if (!app.includes(authState)) throw new Error("Could not find the App auth-state declaration. No changes were made.");
  app = app.replace(authState, `${authState}\n  const { sessions, activeSessionId, setActiveSessionId, setSessions } = useChatSessions();\n  const previousUserId = useRef<string | null>(null);\n  useEffect(() => {\n    const currentUserId = user?.id ?? null;\n    if (previousUserId.current !== currentUserId) {\n      setSessions([]);\n      setActiveSessionId(null);\n      previousUserId.current = currentUserId;\n    }\n  }, [user?.id, setSessions, setActiveSessionId]);`);
}

const oldNewChat = '<button className="new-chat-button" onClick={() => navigate(user ? "workspace" : "chat")}><Plus size={18} /><span>New chat</span><kbd>⌘ K</kbd></button>';
const newNewChat = '<button className="new-chat-button" onClick={() => { setActiveSessionId(null); setDraftPrompt(""); navigate(user ? "workspace" : "chat"); }}><Plus size={18} /><span>New chat</span><kbd>⌘ K</kbd></button>';
if (app.includes(oldNewChat)) app = app.replace(oldNewChat, newNewChat);

const oldHistory = '<div className="sidebar-section"><div className="section-label">RECENT CHATS</div><div className="history-empty"><MessageSquare size={19} /><span>{user ? "Your secure conversations will appear here when chat is enabled." : "Your conversations will appear here after you sign in."}</span></div></div>';
const newHistory = `<div className="sidebar-section"><div className="section-label">RECENT CHATS</div>{user && sessions.length > 0 ? <div className="chat-history-list">{sessions.map((session) => <button key={session.id} className={activeSessionId === session.id ? "chat-history-item active" : "chat-history-item"} onClick={() => { setActiveSessionId(session.id); navigate("workspace"); }}><MessageSquare size={15} /><span>{session.title}</span></button>)}</div> : <div className="history-empty"><MessageSquare size={19} /><span>{user ? "Your secure conversations will appear here after your first protected message." : "Your conversations will appear here after you sign in."}</span></div>}</div>`;
if (app.includes(oldHistory)) app = app.replace(oldHistory, newHistory);
else if (!app.includes("chat-history-list")) throw new Error("Could not find the Recent Chats sidebar block. No changes were made.");

if (!main.includes('import "./secure-chat.css";')) {
  main = main.replace('import "./auth-status.css";', 'import "./auth-status.css";\nimport "./secure-chat.css";');
}
if (!main.includes("ChatSessionProvider")) {
  const authProviderImport = 'import { AuthProvider } from "./contexts/AuthContext";';
  if (!main.includes(authProviderImport)) throw new Error("Could not find AuthProvider import in main.tsx. No changes were made.");
  main = main.replace(authProviderImport, `${authProviderImport}\nimport { ChatSessionProvider } from "./contexts/ChatSessionContext";`);
  main = main.replace('<AuthProvider>\n      <App />\n    </AuthProvider>', '<AuthProvider>\n      <ChatSessionProvider>\n        <App />\n      </ChatSessionProvider>\n    </AuthProvider>');
}

fs.writeFileSync(appPath, app, "utf8");
fs.writeFileSync(mainPath, main, "utf8");
console.log("GuardAI privacy phase frontend wiring applied.");
console.log("Updated: frontend/src/App.tsx and frontend/src/main.tsx");
