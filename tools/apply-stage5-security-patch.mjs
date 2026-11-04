import { copyFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const paths = {
  restoration: join(root, "supabase/functions/secure-chat/modules/restoration.ts"),
  secureChat: join(root, "supabase/functions/secure-chat/index.ts"),
  adminUsers: join(root, "supabase/functions/admin-manage-users/index.ts"),
  deleteAccount: join(root, "supabase/functions/delete-my-account/index.ts"),
  packageJson: join(root, "package.json"),
};
for (const [label, path] of Object.entries(paths)) {
  if (!existsSync(path)) {
    console.error(`Required ${label} file not found: ${path.slice(root.length + 1)}`);
    console.error("Run this script from the GuardAI repository root after extracting the Stage 5 package.");
    process.exit(1);
  }
}

const normalise = (value) => value.replaceAll("\r\n", "\n");
const read = async (path) => normalise(await readFile(path, "utf8"));
const outputs = new Map();
const backups = new Set();
async function setOutput(path, content) { outputs.set(path, content); }
async function ensureBackup(path) {
  const backupPath = `${path}.stage5-backup`;
  if (!existsSync(backupPath)) {
    await copyFile(path, backupPath);
    backups.add(backupPath);
  }
}
function replaceExactlyOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Could not find ${label}. No project files have been written.`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Found multiple ${label} anchors. No project files have been written.`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

try {
  let restoration = await read(paths.restoration);
  let secureChat = await read(paths.secureChat);
  let adminUsers = await read(paths.adminUsers);
  let deleteAccount = await read(paths.deleteAccount);
  const packageJson = JSON.parse(await readFile(paths.packageJson, "utf8"));
  let changed = false;

  if (!restoration.includes("export function maskUnresolvedGuardTokens")) {
    const anchor = "export function containsUnresolvedGuardToken(text: string): boolean {\n  return /\\[\\[GAI_[A-Z0-9_]+\\]\\]/u.test(text);\n}";
    restoration = replaceExactlyOnce(
      restoration,
      anchor,
      anchor + "\n\n/** Hide model-repeated or historical GuardAI tokens that cannot be restored in this request. */\nexport function maskUnresolvedGuardTokens(text: string): string {\n  return text.replace(/\\[\\[GAI_[A-Z0-9_]+\\]\\]/gu, \"[sensitive information redacted]\");\n}",
      "the unresolved-token helper",
    );
    await setOutput(paths.restoration, restoration);
    changed = true;
  }

  if (!secureChat.includes("maskUnresolvedGuardTokens")) {
    secureChat = replaceExactlyOnce(
      secureChat,
      'import { containsUnresolvedGuardToken, restoreKnownTokens } from "./modules/restoration.ts";',
      'import { containsUnresolvedGuardToken, maskUnresolvedGuardTokens, restoreKnownTokens } from "./modules/restoration.ts";',
      "the restoration module import",
    );
    secureChat = replaceExactlyOnce(
      secureChat,
      "    const assistantMessage = restoreKnownTokens(sanitizedAssistantMessage, tokenized.mapping);\n    const restorationWarning = containsUnresolvedGuardToken(assistantMessage);",
      "    const restoredAssistantMessage = restoreKnownTokens(sanitizedAssistantMessage, tokenized.mapping);\n    const restorationWarning = containsUnresolvedGuardToken(restoredAssistantMessage);\n    // Only current-request tokens are restored. Any model-repeated historical/unknown token is hidden.\n    const assistantMessage = maskUnresolvedGuardTokens(restoredAssistantMessage);",
      "the assistant-response restoration block",
    );
    await setOutput(paths.secureChat, secureChat);
    changed = true;
  }

  if (!adminUsers.includes("guardai_set_profile_role")) {
    const roleBlockStart = '    if (body.action === "set_role") {';
    const roleBlockEnd = '\n\n    if (body.action === "delete") {';
    const start = adminUsers.indexOf(roleBlockStart);
    const end = adminUsers.indexOf(roleBlockEnd, start);
    if (start < 0 || end < 0) throw new Error("Could not locate the administrator role-update block. No project files have been written.");
    const replacement = `    if (body.action === "set_role") {\n      const role = body.role === "admin" ? "admin" : body.role === "user" ? "user" : null;\n      if (!role) return json({ error: "The requested role is not supported." }, 400, cors);\n      const { data: updated, error } = await admin.rpc("guardai_set_profile_role", { p_user_id: userId, p_role: role });\n      if (error) {\n        if (String(error.message ?? "").includes("LAST_GUARDAI_ADMIN")) return json({ error: "The last administrator cannot be demoted." }, 409, cors);\n        return json({ error: "The account role could not be updated." }, 500, cors);\n      }\n      if (updated !== true) return json({ error: "The account was not found." }, 404, cors);\n      return json({ success: true, message: "Account role updated." }, 200, cors);\n    }`;
    adminUsers = adminUsers.slice(0, start) + replacement + adminUsers.slice(end);
  }

  if (!adminUsers.includes("guardai_prepare_account_deletion")) {
    const start = adminUsers.indexOf('    if (body.action === "delete") {');
    const end = adminUsers.indexOf('\n\n    return json({ error: "Unsupported account-management action."', start);
    if (start < 0 || end < 0) throw new Error("Could not locate the admin account-deletion block. No project files have been written.");
    const replacement = `    if (body.action === "delete") {\n      const { data: allowedToDelete, error: guardError } = await admin.rpc("guardai_prepare_account_deletion", { p_user_id: userId });\n      if (guardError) {\n        if (String(guardError.message ?? "").includes("LAST_GUARDAI_ADMIN")) return json({ error: "The last administrator account cannot be deleted." }, 409, cors);\n        return json({ error: "Account deletion could not be safely authorized." }, 500, cors);\n      }\n      if (allowedToDelete !== true) return json({ error: "The account was not found." }, 404, cors);\n      const { error } = await admin.auth.admin.deleteUser(userId);\n      if (error) return json({ error: "The account could not be deleted. If it was an administrator, its role was safely revoked first." }, 500, cors);\n      return json({ success: true, message: "Account deleted." }, 200, cors);\n    }`;
    adminUsers = adminUsers.slice(0, start) + replacement + adminUsers.slice(end);
  }
  if (!adminUsers.includes("guardai_set_profile_role") || !adminUsers.includes("guardai_prepare_account_deletion")) {
    throw new Error("Admin role/deletion hardening did not apply correctly. No project files have been written.");
  }
  const originalAdmin = await read(paths.adminUsers);
  if (adminUsers !== originalAdmin) {
    await setOutput(paths.adminUsers, adminUsers);
    changed = true;
  }

  if (!deleteAccount.includes("guardai_prepare_account_deletion")) {
    const oldStart = "  // Never allow self-service deletion to remove the final administrator account.";
    const oldEnd = "  // Avatar objects are owned by the account and must be removed before deleting the Auth user.";
    const start = deleteAccount.indexOf(oldStart);
    const end = deleteAccount.indexOf(oldEnd, start);
    if (start < 0 || end < 0) throw new Error("Could not locate the self-service administrator deletion guard. No project files have been written.");
    const replacement = `  // The database RPC serializes administrator removals and prevents a last-admin race.\n  const { data: allowedToDelete, error: guardError } = await adminClient.rpc("guardai_prepare_account_deletion", { p_user_id: user.id });\n  if (guardError) {\n    if (String(guardError.message ?? "").includes("LAST_GUARDAI_ADMIN")) {\n      return json({ error: "This is the last administrator account. Promote another trusted administrator before deleting this account." }, 409, cors);\n    }\n    console.error("Could not safely authorize account deletion:", guardError.message);\n    return json({ error: "GuardAI could not verify administrator coverage. No deletion was completed." }, 500, cors);\n  }\n  if (allowedToDelete !== true) return json({ error: "The account could not be found." }, 404, cors);\n\n`;
    deleteAccount = deleteAccount.slice(0, start) + replacement + deleteAccount.slice(end);
    await setOutput(paths.deleteAccount, deleteAccount);
    changed = true;
  }

  const scripts = packageJson.scripts ?? (packageJson.scripts = {});
  const desiredScripts = {
    "qa:unit": "node --experimental-strip-types --experimental-default-type=module --test supabase/functions/secure-chat/modules/security.test.ts",
    "qa:security": "node tools/qa/guardai-security-audit.mjs",
    "qa": "npm run typecheck && npm run qa:unit && npm run qa:security && npm run build",
  };
  for (const [name, command] of Object.entries(desiredScripts)) {
    if (scripts[name] !== command) { scripts[name] = command; changed = true; }
  }
  if (JSON.stringify(packageJson.scripts) !== JSON.stringify((JSON.parse(await readFile(paths.packageJson, "utf8"))).scripts)) {
    await setOutput(paths.packageJson, JSON.stringify(packageJson, null, 2) + "\n");
  }

  if (outputs.size === 0) {
    console.log("Stage 5 security patch is already applied. No files changed.");
    process.exit(0);
  }

  // Validate every change and create every backup before writing the first file.
  for (const path of outputs.keys()) await ensureBackup(path);
  for (const [path, content] of outputs) {
    const old = await readFile(path, "utf8");
    const eol = old.includes("\r\n") ? "\r\n" : "\n";
    await writeFile(path, content.replaceAll("\n", eol), "utf8");
  }
  console.log("GuardAI Stage 5 security hardening applied.");
  for (const path of outputs.keys()) console.log(`Updated: ${path.slice(root.length + 1)}`);
  for (const path of backups) console.log(`Backup: ${path.slice(root.length + 1)}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("No project files have been written if an integration anchor failed.");
  process.exit(1);
}
