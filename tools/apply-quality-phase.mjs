import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "frontend/src/App.tsx");
const packagePath = path.join(root, "frontend/package.json");
const mainPath = path.join(root, "frontend/src/main.tsx");

if (!fs.existsSync(appPath) || !fs.existsSync(packagePath) || !fs.existsSync(mainPath)) {
  throw new Error("Run this script from the GuardAI repository root. Expected frontend/src/App.tsx and frontend/package.json.");
}

let app = fs.readFileSync(appPath, "utf8");
let main = fs.readFileSync(mainPath, "utf8");
const appImport = 'import SecureChatWorkspace from "./components/chat/SecureChatWorkspace";';
const newImport = 'import ChatHistoryList from "./components/layout/ChatHistoryList";';
if (!app.includes(appImport)) {
  throw new Error("Could not find the expected SecureChatWorkspace import in App.tsx. No changes were made.");
}
if (!app.includes(newImport)) app = app.replace(appImport, `${appImport}\n${newImport}`);

const oldHistory = '<div className="sidebar-section"><div className="section-label">RECENT CHATS</div>{user && sessions.length > 0 ? <div className="chat-history-list">{sessions.map((session) => <button key={session.id} className={activeSessionId === session.id ? "chat-history-item active" : "chat-history-item"} onClick={() => { setActiveSessionId(session.id); navigate("workspace"); }}><MessageSquare size={15} /><span>{session.title}</span></button>)}</div> : <div className="history-empty"><MessageSquare size={19} /><span>{user ? "Your secure conversations will appear here after your first protected message." : "Your conversations will appear here after you sign in."}</span></div>}</div>';
const newHistory = '<div className="sidebar-section">{user ? <ChatHistoryList activeSessionId={activeSessionId} onSelect={(sessionId) => { setActiveSessionId(sessionId); navigate("workspace"); }} /> : <><div className="section-label">RECENT CHATS</div><div className="history-empty"><MessageSquare size={19} /><span>Your conversations will appear here after you sign in.</span></div></>}</div>';
if (app.includes(oldHistory)) {
  app = app.replace(oldHistory, newHistory);
} else if (!app.includes("<ChatHistoryList activeSessionId={activeSessionId}")) {
  throw new Error("Could not find the expected Recent Chats sidebar block in App.tsx. No files were changed.");
}

if (!main.includes('import "./secure-chat.css";')) {
  throw new Error("Could not find the secure-chat.css import in main.tsx. Apply the Phase 3 wiring first.");
}
if (!main.includes('import "./secure-chat-quality.css";')) {
  main = main.replace('import "./secure-chat.css";', 'import "./secure-chat.css";\nimport "./secure-chat-quality.css";\nimport "./history-management.css";');
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
pkg.dependencies ??= {};
pkg.dependencies["react-markdown"] ??= "^10.1.0";
pkg.dependencies["remark-gfm"] ??= "^4.0.1";

fs.writeFileSync(appPath, app, "utf8");
fs.writeFileSync(mainPath, main, "utf8");
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
console.log("GuardAI quality improvements wired into App.tsx, main.tsx and frontend/package.json.");
console.log("Added: managed conversation history, redaction-safe history labels and Markdown dependencies.");
