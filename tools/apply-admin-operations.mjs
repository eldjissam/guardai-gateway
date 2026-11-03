import { readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const appPath = "frontend/src/App.tsx";
const configPath = "supabase/config.toml";

if (!existsSync(appPath)) {
  console.error("Could not find frontend/src/App.tsx. Run this script from the GuardAI repository root.");
  process.exit(1);
}

// Normalize line endings before matching. Windows checkouts commonly use CRLF.
let app = (await readFile(appPath, "utf8")).replace(/\r\n/g, "\n");
const original = app;

function fail(message) { throw new Error(message); }
function addImportIfMissing(modulePath, statement) {
  if (app.includes(`from "${modulePath}"`)) return;
  const typeAnchor = app.indexOf("type View =");
  if (typeAnchor < 0) fail("Could not locate the App.tsx type declarations to add imports safely.");
  app = app.slice(0, typeAnchor) + statement + "\n" + app.slice(typeAnchor);
}
function replaceOnce(needle, replacement, label) {
  const first = app.indexOf(needle);
  if (first < 0) fail(`Could not find App.tsx anchor: ${label}. No files have been written.`);
  if (app.indexOf(needle, first + needle.length) >= 0) fail(`App.tsx anchor is ambiguous: ${label}. No files have been written.`);
  app = app.slice(0, first) + replacement + app.slice(first + needle.length);
}
function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

try {
  // The Stage 4.1 shell may already have replaced AdminDashboard with AdminShell.
  // Support both the pre-shell and post-shell App.tsx variants.
  if (!app.includes('from "./components/admin/AdminShell"')) {
    if (app.includes('import AdminDashboard from "./components/admin/AdminDashboard";')) {
      app = app.replace(
        'import AdminDashboard from "./components/admin/AdminDashboard";',
        'import AdminShell from "./components/admin/AdminShell";',
      );
    } else {
      addImportIfMissing("./components/admin/AdminShell", 'import AdminShell from "./components/admin/AdminShell";');
    }
  }
  addImportIfMissing("./components/shared/SignOutConfirmDialog", 'import SignOutConfirmDialog from "./components/shared/SignOutConfirmDialog";');
  addImportIfMissing("./components/about/PublicProjectTeam", 'import PublicProjectTeam from "./components/about/PublicProjectTeam";');

  // Ensure the application has a sign-out confirmation state. Stage 4.1 already has it.
  if (!app.includes("const [signOutDialogOpen, setSignOutDialogOpen]")) {
    const stateAnchor = '  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);';
    replaceOnce(stateAnchor, stateAnchor + '\n  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);\n  const [signingOut, setSigningOut] = useState(false);', "shared sign-out dialog state");
  }

  // Upgrade the old direct sign-out handler, but leave an already-confirmed handler intact.
  const handlerStart = app.indexOf("  const handleSignOut = async () => {");
  if (handlerStart < 0) fail("Could not find the existing handleSignOut function.");
  const handlerEnd = app.indexOf("  };", handlerStart);
  if (handlerEnd < 0) fail("Could not find the end of handleSignOut safely.");
  const handler = app.slice(handlerStart, handlerEnd + 4);
  if (!handler.includes("setSignOutDialogOpen(false)")) {
    const upgraded = `  const handleSignOut = async () => {\n    if (signingOut) return;\n    setSigningOut(true);\n    try { await signOut(); setGuestGateOpen(false); setSignOutDialogOpen(false); navigate("chat"); }\n    catch (error) { console.error("Sign out failed", error); }\n    finally { setSigningOut(false); }\n  };`;
    app = app.slice(0, handlerStart) + upgraded + app.slice(handlerEnd + 4);
  }

  // Replace the About-page team placeholder with live published profiles.
  if (!app.includes("<PublicProjectTeam")) {
    const teamStart = app.indexOf('<section className="about-team-section">');
    if (teamStart < 0) fail("Could not find the About-page team section. No files have been written.");
    const teamOpenEnd = app.indexOf(">", teamStart) + 1;
    const teamClose = app.indexOf("</section>", teamOpenEnd);
    if (teamOpenEnd === 0 || teamClose < 0) fail("Could not locate the About-page team section boundary safely.");
    const liveTeamSection = '<section className="about-team-section">\n        <PublicProjectTeam />\n      </section>';
    app = app.slice(0, teamStart) + liveTeamSection + app.slice(teamClose + "</section>".length);
  }

  // Remove the old hard-coded role cards, which are replaced by database-backed team profiles.
  const aboutStart = app.indexOf("function AboutView()");
  if (aboutStart >= 0) {
    const rolesStart = app.indexOf("  const roles = [", aboutStart);
    if (rolesStart >= 0) {
      const rolesEnd = app.indexOf("  ];", rolesStart);
      if (rolesEnd < 0) fail("Could not remove the old About roles safely.");
      app = app.slice(0, rolesStart) + app.slice(rolesEnd + 5);
    }
  }
  // Globe2 was only used by the removed placeholder; remove it if no other usage remains.
  if (countOccurrences(app, "Globe2") === 1) app = app.replace(/\bGlobe2,\s*/g, "").replace(/,\s*Globe2\b/g, "");

  // If Stage 4.1 has not yet installed the independent AdminShell route, install it.
  if (!app.includes("<AdminShell user=")) {
    const route = `  if (view === "admin" && user && profileLoading) {\n    return <div className="ga-admin-verifying"><span /> Verifying administrator access…</div>;\n  }\n  if (view === "admin" && user && isAdmin) {\n    return (\n      <>\n        <AdminShell user={user} onBackToWorkspace={() => navigate("workspace")} onSignOutRequest={() => setSignOutDialogOpen(true)} />\n        <SignOutConfirmDialog open={signOutDialogOpen} busy={signingOut} onCancel={() => setSignOutDialogOpen(false)} onConfirm={() => void handleSignOut()} />\n      </>\n    );\n  }\n\n`;
    replaceOnce('  return (\n    <div className="app-shell" data-theme={theme}>', route + '  return (\n    <div className="app-shell" data-theme={theme}>', "dedicated admin route");
  }

  // Remove the legacy in-shell dashboard route if it still exists.
  app = app.replace(/\s*\{view === "admin" && user && isAdmin && <motion\.div key="admin"[\s\S]*?<AdminDashboard\s*\/>[\s\S]*?<\/motion\.div>\}\n/g, "\n");

  // Convert the ordinary user sign-out button to the shared confirmation dialog.
  app = app.replace(
    '<button className="primary-button top-signin" onClick={handleSignOut}><LogOut size={15} /> Sign out</button>',
    '<button className="primary-button top-signin" onClick={() => setSignOutDialogOpen(true)}><LogOut size={15} /> Sign out</button>',
  );

  // Ensure the shared dialog is mounted in the ordinary user application tree.
  const guestDialog = '      <GuestAccessDialog open={guestGateOpen && !user} onClose={() => setGuestGateOpen(false)} onCreateAccount={() => { setGuestGateOpen(false); openAuth("signup"); }} onSignIn={() => { setGuestGateOpen(false); openAuth("signin"); }} />';
  const appRootSignOut = '      <SignOutConfirmDialog open={signOutDialogOpen} busy={signingOut} onCancel={() => setSignOutDialogOpen(false)} onConfirm={() => void handleSignOut()} />';
  if (app.includes(guestDialog) && !app.slice(app.indexOf(guestDialog), app.indexOf("    </div>", app.indexOf(guestDialog))).includes("<SignOutConfirmDialog")) {
    replaceOnce(guestDialog + "\n    </div>", guestDialog + "\n" + appRootSignOut + "\n    </div>", "ordinary workspace sign-out dialog mount");
  }

  if (app === original) console.log("App.tsx already contains the Phase 4.2 integration; no App.tsx changes were necessary.");

  // Update Supabase CLI config only after every App.tsx transformation has validated.
  let config = null;
  if (existsSync(configPath)) {
    config = (await readFile(configPath, "utf8")).replace(/\r\n/g, "\n");
    if (!config.includes("[functions.admin-manage-users]")) {
      config += "\n[functions.admin-manage-users]\nverify_jwt = true\n";
    }
  }

  const appBackup = `${appPath}.admin-operations-backup`;
  if (!existsSync(appBackup) && app !== original) await copyFile(appPath, appBackup);
  if (app !== original) await writeFile(appPath, app, "utf8");
  if (config !== null) {
    const currentConfig = (await readFile(configPath, "utf8")).replace(/\r\n/g, "\n");
    if (config !== currentConfig) {
      const configBackup = `${configPath}.admin-operations-backup`;
      if (!existsSync(configBackup)) await copyFile(configPath, configBackup);
      await writeFile(configPath, config, "utf8");
    }
  }

  console.log("GuardAI Admin Operations frontend integration applied.");
  console.log("Updated: frontend/src/App.tsx (when required)");
  console.log("Added database-backed About team profiles.");
  console.log("Dedicated AdminShell and shared sign-out confirmation preserved.");
  console.log("Supabase admin-manage-users JWT configuration verified.");
  if (existsSync(appBackup)) console.log(`App backup: ${appBackup}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("No partial App.tsx changes were written. Keep your current working application.");
  process.exit(1);
}
