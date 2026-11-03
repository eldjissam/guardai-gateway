import { readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const appPath = "frontend/src/App.tsx";
if (!existsSync(appPath)) {
  console.error("Could not find frontend/src/App.tsx. Run this script from the GuardAI repository root.");
  process.exit(1);
}

let source = await readFile(appPath, "utf8");

function replaceExactlyOnce(needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first === -1) throw new Error(`Could not find the expected App.tsx anchor for: ${label}. No file changes have been written.`);
  if (source.indexOf(needle, first + needle.length) !== -1) throw new Error(`The App.tsx anchor for ${label} appears more than once. No file changes have been written.`);
  source = source.slice(0, first) + replacement + source.slice(first + needle.length);
}

try {
  replaceExactlyOnce(
    'import SecureChatWorkspace from "./components/chat/SecureChatWorkspace";\n',
    'import SecureChatWorkspace from "./components/chat/SecureChatWorkspace";\nimport AdminDashboard from "./components/admin/AdminDashboard";\nimport { supabase } from "./lib/supabase";\n',
    "dashboard import",
  );
  replaceExactlyOnce(
    'type View = "chat" | "about" | "signin" | "signup" | "reset" | "workspace";',
    'type View = "chat" | "about" | "signin" | "signup" | "reset" | "workspace" | "admin";',
    "admin view type",
  );
  replaceExactlyOnce(
    '  const { activeSessionId, setActiveSessionId, setSessions } = useChatSessions();\n',
    `  const { activeSessionId, setActiveSessionId, setSessions } = useChatSessions();
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const isAdmin = profileRole === "admin";
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setProfileRole(null);
      setProfileLoading(false);
      return;
    }
    if (!supabase) {
      setProfileRole(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const loadRole = async () => {
      const { data, error } = await supabase
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
`,
    "profile role lookup",
  );
  replaceExactlyOnce(
    '  const navigate = (next: View) => { setView(next); setSidebarOpen(false); };\n',
    `  const navigate = (next: View) => { setView(next); setSidebarOpen(false); };
  useEffect(() => {
    if (view !== "admin") return;
    if (!user) setView("chat");
    else if (!profileLoading && profileRole !== "admin") setView("workspace");
  }, [view, user, profileLoading, profileRole]);
`,
    "admin view guard",
  );
  const aboutButton = '<button className={`nav-button ${view === "about" ? "nav-active" : ""}`} onClick={() => navigate("about")}><Info size={18} /><span>About GuardAI</span></button>';
  replaceExactlyOnce(
    aboutButton,
    `${aboutButton}\n            {isAdmin && <button className={\`nav-button \${view === "admin" ? "nav-active" : ""}\`} onClick={() => navigate("admin")}><ShieldCheck size={18} /><span>Admin Control Center</span></button>}`,
    "admin navigation item",
  );
  replaceExactlyOnce(
    '{view === "chat" ? "Private AI workspace" : view === "workspace" ? "Your authenticated workspace" : "Discover GuardAI"}',
    '{view === "chat" ? "Private AI workspace" : view === "workspace" ? "Your authenticated workspace" : view === "admin" ? "Security operations" : "Discover GuardAI"}',
    "admin topbar label",
  );
  const workspaceAnchor = '{view === "workspace" && user && <motion.div key="workspace"';
  replaceExactlyOnce(
    workspaceAnchor,
    '{view === "admin" && user && isAdmin && <motion.div key="admin" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2 }}><AdminDashboard /></motion.div>}\n            ' + workspaceAnchor,
    "admin dashboard view",
  );

  const backupPath = `${appPath}.phase4-backup`;
  if (!existsSync(backupPath)) await copyFile(appPath, backupPath);
  await writeFile(appPath, source, "utf8");
  console.log("GuardAI Admin Control Center frontend integration applied.");
  console.log("Updated: frontend/src/App.tsx");
  console.log("Added: frontend/src/components/admin/AdminDashboard.tsx and admin-dashboard.css");
  console.log(`Backup: ${backupPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("No changes were written to App.tsx. Keep the current app and share the error for a tailored patch.");
  process.exit(1);
}
