import { readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const appPath = "frontend/src/App.tsx";
const dashboardPath = "frontend/src/components/admin/AdminDashboard.tsx";
const adminShellPath = "frontend/src/components/admin/AdminShell.tsx";
const signOutPath = "frontend/src/components/shared/SignOutConfirmDialog.tsx";

for (const path of [appPath, dashboardPath, adminShellPath, signOutPath]) {
  if (!existsSync(path)) {
    console.error(`Required file not found: ${path}. Extract the Phase 4.1 package into the repository root first.`);
    process.exit(1);
  }
}

let app = await readFile(appPath, "utf8");
let dashboard = await readFile(dashboardPath, "utf8");

function replaceExactlyOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`Could not find expected source anchor: ${label}. No source files have been changed.`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`Source anchor appears more than once: ${label}. No source files have been changed.`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

try {
  // AdminDashboard becomes a controlled content view; the new shell owns navigation.
  dashboard = replaceExactlyOnce(
    dashboard,
    'type Tab = "overview" | "logs" | "users";',
    'export type AdminSection = "overview" | "logs" | "users";',
    "admin section type",
  );
  dashboard = replaceExactlyOnce(
    dashboard,
    'export default function AdminDashboard() {\n  const [tab, setTab] = useState<Tab>("overview");',
    'export default function AdminDashboard({ activeTab, onTabChange }: { activeTab?: AdminSection; onTabChange?: (tab: AdminSection) => void } = {}) {\n  const [internalTab, setInternalTab] = useState<AdminSection>("overview");\n  const tab = activeTab ?? internalTab;\n  const setTab = onTabChange ?? setInternalTab;',
    "controlled admin dashboard state",
  );
  dashboard = replaceExactlyOnce(
    dashboard,
    '      <nav className="admin-tabs" aria-label="Admin sections">',
    '      {!onTabChange && <nav className="admin-tabs" aria-label="Admin sections">',
    "dashboard local tabs opening",
  );
  dashboard = replaceExactlyOnce(
    dashboard,
    '      </nav>\n\n      <div className="admin-toolbar">',
    '      </nav>}\n\n      <div className="admin-toolbar">',
    "dashboard local tabs closing",
  );

  // Route administrators into a dedicated layout and use a shared sign-out confirmation.
  app = replaceExactlyOnce(
    app,
    'import AdminDashboard from "./components/admin/AdminDashboard";',
    'import AdminShell from "./components/admin/AdminShell";\nimport SignOutConfirmDialog from "./components/shared/SignOutConfirmDialog";',
    "admin dashboard import",
  );
  app = replaceExactlyOnce(
    app,
    '  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);',
    '  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);\n  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);\n  const [signingOut, setSigningOut] = useState(false);',
    "sign-out dialog state",
  );
  app = replaceExactlyOnce(
    app,
    '  const handleSignOut = async () => {\n    try { await signOut(); setGuestGateOpen(false); navigate("chat"); }\n    catch (error) { console.error("Sign out failed", error); }\n  };',
    '  const handleSignOut = async () => {\n    if (signingOut) return;\n    setSigningOut(true);\n    try { await signOut(); setGuestGateOpen(false); setSignOutDialogOpen(false); navigate("chat"); }\n    catch (error) { console.error("Sign out failed", error); }\n    finally { setSigningOut(false); }\n  };',
    "sign-out handler",
  );

  const adminReturn = `  if (view === "admin" && user && profileLoading) {
    return <div className="ga-admin-verifying"><span /> Verifying administrator permissions…</div>;
  }

  if (view === "admin" && user && isAdmin) {
    return (
      <>
        <AdminShell user={user} onBackToWorkspace={() => navigate("workspace")} onSignOutRequest={() => setSignOutDialogOpen(true)} />
        <SignOutConfirmDialog open={signOutDialogOpen} busy={signingOut} onCancel={() => setSignOutDialogOpen(false)} onConfirm={() => void handleSignOut()} />
      </>
    );
  }

`;
  app = replaceExactlyOnce(
    app,
    '  return (\n    <div className="app-shell" data-theme={theme}>',
    adminReturn + '  return (\n    <div className="app-shell" data-theme={theme}>',
    "dedicated admin route",
  );
  app = replaceExactlyOnce(
    app,
    '<button className="primary-button top-signin" onClick={handleSignOut}><LogOut size={15} /> Sign out</button>',
    '<button className="primary-button top-signin" onClick={() => setSignOutDialogOpen(true)}><LogOut size={15} /> Sign out</button>',
    "user sign-out button",
  );
  app = replaceExactlyOnce(
    app,
    '            {view === "admin" && user && isAdmin && <motion.div key="admin" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2 }}><AdminDashboard /></motion.div>}\n',
    "",
    "old embedded admin dashboard route",
  );
  app = replaceExactlyOnce(
    app,
    '      <GuestAccessDialog open={guestGateOpen && !user} onClose={() => setGuestGateOpen(false)} onCreateAccount={() => { setGuestGateOpen(false); openAuth("signup"); }} onSignIn={() => { setGuestGateOpen(false); openAuth("signin"); }} />\n    </div>',
    '      <GuestAccessDialog open={guestGateOpen && !user} onClose={() => setGuestGateOpen(false)} onCreateAccount={() => { setGuestGateOpen(false); openAuth("signup"); }} onSignIn={() => { setGuestGateOpen(false); openAuth("signin"); }} />\n      <SignOutConfirmDialog open={signOutDialogOpen} busy={signingOut} onCancel={() => setSignOutDialogOpen(false)} onConfirm={() => void handleSignOut()} />\n    </div>',
    "shared sign-out dialog mount",
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error("No source files have been changed. Keep your current application and share this error for a tailored patch.");
  process.exit(1);
}

// Back up all existing files immediately before applying the validated changes.
await copyFile(appPath, `${appPath}.stage-4-1-backup`);
await copyFile(dashboardPath, `${dashboardPath}.stage-4-1-backup`);
await writeFile(dashboardPath, dashboard, "utf8");
await writeFile(appPath, app, "utf8");

console.log("GuardAI dedicated admin shell integrated successfully.");
console.log("Updated: frontend/src/App.tsx");
console.log("Updated: frontend/src/components/admin/AdminDashboard.tsx");
console.log("Added: frontend/src/components/admin/AdminShell.tsx");
console.log("Added: frontend/src/components/admin/admin-shell.css");
console.log("Added: shared sign-out confirmation dialog and styles");
console.log("Backups: App.tsx.stage-4-1-backup and AdminDashboard.tsx.stage-4-1-backup");
