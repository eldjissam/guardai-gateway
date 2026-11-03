import { readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const appPath = "frontend/src/App.tsx";
const configPath = "supabase/config.toml";
const componentPath = "frontend/src/components/profile/UserProfilePage.tsx";
const stylePath = "frontend/src/components/profile/user-profile-page.css";
const migrationPath = "supabase/migrations/20261103230000_user_profiles.sql";
const functionPath = "supabase/functions/delete-my-account/index.ts";

for (const path of [appPath, configPath, componentPath, stylePath, migrationPath, functionPath]) {
  if (!existsSync(path)) {
    console.error(`Required Stage 4.3 file is missing: ${path}`);
    console.error("No application files were changed. Extract the complete Stage 4.3 package into the repository root.");
    process.exit(1);
  }
}

let app = (await readFile(appPath, "utf8")).replace(/\r\n/g, "\n");
let config = (await readFile(configPath, "utf8")).replace(/\r\n/g, "\n");
const originalApp = app;
const originalConfig = config;

function fail(message) {
  console.error(message);
  console.error("No application files were changed. Keep the current working application and share the error for a tailored installer update.");
  process.exit(1);
}

// 1) Extend the local App view union without replacing any existing view.
const viewMatch = app.match(/^type View = (.*);$/m);
if (!viewMatch) fail("Could not find the App.tsx View type declaration.");
if (!viewMatch[1].includes('"profile"')) {
  const updatedViews = `${viewMatch[1]} | "profile"`;
  app = app.replace(viewMatch[0], `type View = ${updatedViews};`);
}

// 2) Add the page import once, near the existing authenticated chat import.
if (!app.includes('from "./components/profile/UserProfilePage"')) {
  const chatImport = app.match(/^import SecureChatWorkspace from [^;]+;$/m);
  if (chatImport) {
    app = app.replace(chatImport[0], `${chatImport[0]}\nimport UserProfilePage from "./components/profile/UserProfilePage";`);
  } else {
    const historyImport = app.match(/^import ChatHistoryList from [^;]+;$/m);
    if (historyImport) app = app.replace(historyImport[0], `${historyImport[0]}\nimport UserProfilePage from "./components/profile/UserProfilePage";`);
    else fail("Could not find a safe import anchor for UserProfilePage.");
  }
}

// 3) Route the existing signed-in profile entry to the new profile page.
if (!/className="profile-entry"/.test(app)) {
  fail('Could not find the existing user sidebar profile button (className="profile-entry").');
}
if (!app.includes('navigate("profile")')) {
  const entryStart = app.indexOf('className="profile-entry"');
  const buttonStart = entryStart < 0 ? -1 : app.lastIndexOf("<button", entryStart);
  const buttonEnd = buttonStart < 0 ? -1 : app.indexOf("</button>", buttonStart);
  if (buttonStart < 0 || buttonEnd < 0) fail("Could not safely identify the existing profile button action.");
  const buttonMarkup = app.slice(buttonStart, buttonEnd);
  if (!buttonMarkup.includes('navigate("workspace")')) {
    fail("The profile button does not use the expected workspace navigation. No automatic replacement was made.");
  }
  const updatedMarkup = buttonMarkup.replace('navigate("workspace")', 'navigate("profile")');
  app = app.slice(0, buttonStart) + updatedMarkup + app.slice(buttonEnd);
}

// 4) Insert the profile view inside the existing main view transition.
if (!app.includes('<UserProfilePage user={user}')) {
  const footerIndex = app.indexOf('<footer className="page-footer">');
  if (footerIndex < 0) fail("Could not find the main application footer to identify the view transition safely.");
  const transitionClose = app.lastIndexOf("</AnimatePresence>", footerIndex);
  if (transitionClose < 0) fail("Could not find the main view transition closing tag.");
  const profileRoute = `            {view === "profile" && user && <motion.div key="profile" className="view-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2 }}><UserProfilePage user={user} onBack={() => navigate("workspace")} /></motion.div>}\n`;
  app = app.slice(0, transitionClose) + profileRoute + app.slice(transitionClose);
}

// 5) Update the topbar context label if the current shell has the known ternary.
app = app.replace(
  'view === "admin" ? "Security operations" : "Discover GuardAI"',
  'view === "profile" ? "Your profile" : view === "admin" ? "Security operations" : "Discover GuardAI"',
);

// 6) Make the account-deletion Edge Function explicitly JWT protected.
if (!/^\[functions\.delete-my-account\]/m.test(config)) {
  config = `${config.trimEnd()}\n\n[functions.delete-my-account]\nverify_jwt = true\n`;
}

if (app === originalApp && config === originalConfig) {
  console.log("GuardAI User Profile integration is already applied. No files needed updating.");
  process.exit(0);
}

// Backups are created before any writes. All anchors have been validated above.
await copyFile(appPath, `${appPath}.phase43-backup`);
await copyFile(configPath, `${configPath}.phase43-backup`);
await writeFile(appPath, app, "utf8");
await writeFile(configPath, config, "utf8");

console.log("GuardAI User Profile integration applied.");
if (app !== originalApp) console.log("Updated: frontend/src/App.tsx");
if (config !== originalConfig) console.log("Updated: supabase/config.toml");
console.log("Added: private profile page, avatar upload, password controls and account deletion.");
console.log("Backups: App.tsx.phase43-backup and config.toml.phase43-backup");
