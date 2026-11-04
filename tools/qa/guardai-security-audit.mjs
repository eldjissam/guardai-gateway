import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const checks = [];
const pass = (name, ok, detail, critical = true) => checks.push({ name, ok, detail, critical });
const read = async (path) => existsSync(join(root, path)) ? readFile(join(root, path), "utf8") : null;

const requiredFiles = [
  "supabase/functions/secure-chat/index.ts",
  "supabase/functions/secure-chat/modules/detector.ts",
  "supabase/functions/secure-chat/modules/tokenizer.ts",
  "supabase/functions/secure-chat/modules/restoration.ts",
  "supabase/functions/admin-manage-users/index.ts",
  "supabase/functions/delete-my-account/index.ts",
  "supabase/migrations/20261103210000_admin_control_center.sql",
  "supabase/migrations/20261103220000_admin_operations_and_project_team.sql",
  "supabase/migrations/20261103230000_user_profiles.sql",
  "supabase/migrations/20261103235900_guardai_security_hardening.sql",
  "supabase/tests/guardai_security.test.sql",
];
for (const path of requiredFiles) pass(`Required file: ${path}`, existsSync(join(root, path)), existsSync(join(root, path)) ? "present" : "missing");

const config = await read("supabase/config.toml") ?? "";
for (const name of ["secure-chat", "admin-manage-users", "delete-my-account"]) {
  const section = new RegExp(`\\[functions\\.${name.replaceAll("-", "\\-")}\\][\\s\\S]*?verify_jwt\\s*=\\s*true`, "m");
  pass(`JWT verification: ${name}`, section.test(config), "verify_jwt must be explicitly true in supabase/config.toml");
}

const secureChat = await read("supabase/functions/secure-chat/index.ts") ?? "";
pass("Secure chat validates the Auth JWT with getUser", /auth\.getUser\(jwt\)/.test(secureChat), "A bearer token must be verified, not merely decoded.");
pass("Secure chat uses server-side rate limiting", /consume_guardai_rate_limit/.test(secureChat), "Requests must be limited before OpenAI processing.");
pass("OpenAI request disables provider storage", /store:\s*false/.test(secureChat), "Responses API request should set store:false.");
pass("Prompt and request body size limits are enforced", /rawBody\.length\s*>\s*20_000/.test(secureChat) && /originalPrompt\.length\s*>\s*10_000/.test(secureChat), "Reject oversized requests before provider processing.");
pass("Only sanitized conversation content is persisted", /sanitized_content:\s*tokenized\.sanitizedPrompt/.test(secureChat) && /sanitized_content:\s*sanitizedAssistantMessage/.test(secureChat), "Database writes must not store original prompt or restored assistant values.");
pass("Secure chat contains no raw-prompt console logging", !/console\.(?:log|info|debug)\([^\n]*(?:originalPrompt|rawBody|tokenized\.mapping)/i.test(secureChat), "Do not log raw prompts, bodies or token maps.");
pass("Unresolved historical tokens are hidden in responses", /maskUnresolvedGuardTokens\(restoredAssistantMessage\)/.test(secureChat), "Current-request tokens may be restored; unknown/historical markers must be hidden.");

const adminFunction = await read("supabase/functions/admin-manage-users/index.ts") ?? "";
pass("Admin function verifies caller identity", /auth\.getUser\(token\)/.test(adminFunction), "Admin operations require a valid authenticated identity.");
pass("Admin function verifies admin role server-side", /rpc\(["']is_guardai_admin["']\)/.test(adminFunction), "Do not trust a frontend role flag.");
pass("Role changes use serialized database RPC", /rpc\(["']guardai_set_profile_role["']/.test(adminFunction), "Protect the final-admin invariant against concurrent changes.");
pass("Admin account deletion uses serialized database RPC", /rpc\(["']guardai_prepare_account_deletion["']/.test(adminFunction), "Protect the final-admin invariant against concurrent deletions.");

const deleteFunction = await read("supabase/functions/delete-my-account/index.ts") ?? "";
pass("Self-service deletion verifies user identity", /auth\.getUser\(token\)/.test(deleteFunction), "Account deletion must bind to the authenticated caller.");
pass("Self-service deletion requires explicit confirmation", /payload\.confirmation\s*!==\s*["']DELETE["']/.test(deleteFunction), "Destructive action must require a typed confirmation.");
pass("Self-service deletion uses serialized admin guard", /rpc\(["']guardai_prepare_account_deletion["']/.test(deleteFunction), "The last administrator must not be removed.");

const migrationPaths = [
  "supabase/migrations/20261103170000_profiles_auth.sql",
  "supabase/migrations/20261103190000_secure_chat.sql",
  "supabase/migrations/20261103210000_admin_control_center.sql",
  "supabase/migrations/20261103220000_admin_operations_and_project_team.sql",
  "supabase/migrations/20261103230000_user_profiles.sql",
  "supabase/migrations/20261103235900_guardai_security_hardening.sql",
];
let migrations = "";
for (const path of migrationPaths) migrations += (await read(path)) ?? "";
for (const table of ["profiles", "chat_sessions", "chat_messages", "security_events", "project_team_members", "user_private_profiles"]) {
  const enabled = new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i").test(migrations);
  pass(`RLS enabled in migrations: ${table}`, enabled, "Every exposed table must have explicit RLS enablement and matching grants/policies.");
}
pass("Private profile read policy is owner-scoped", /Users read their own private profile[\s\S]{0,400}auth\.uid\(\)[\s\S]{0,100}user_id/i.test(migrations), "Private academic/contact fields must remain owner-only.");
pass("Private profile migration has no admin read policy", !/create\s+policy[^;]+on\s+public\.user_private_profiles[^;]+is_guardai_admin/i.test(migrations), "Administrators should not inherit access to private personal/academic fields.");
pass("Admin roster functions are server-only", /revoke all on function public\.guardai_set_profile_role\(uuid, text\) from public, anon, authenticated/i.test(migrations) && /grant execute on function public\.guardai_set_profile_role\(uuid, text\) to service_role/i.test(migrations), "Role mutation must not be callable from the browser.");

const sourceRoots = ["frontend/src", "supabase/functions"];
const sourceFiles = [];
async function walk(path) {
  if (!existsSync(path)) return;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
      await walk(full);
    } else if (/\.(?:js|mjs|cjs|ts|tsx|jsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx|js|mjs)$/.test(entry.name)) {
      sourceFiles.push(full);
    }
  }
}
for (const folder of sourceRoots) await walk(join(root, folder));
const secretPatterns = [
  /\bsb_secret_[A-Za-z0-9_-]{16,}\b/g,
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/g,
];
const secretFindings = [];
for (const file of sourceFiles) {
  const content = await readFile(file, "utf8");
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) secretFindings.push(relative(root, file));
    pattern.lastIndex = 0;
  }
}
pass("No high-confidence provider secret literals in frontend/Edge source", secretFindings.length === 0, secretFindings.length ? `Potential secret literal in: ${[...new Set(secretFindings)].join(", ")}` : "No matching secret literals found.");
const frontendFiles = sourceFiles.filter((file) => relative(root, file).replaceAll("\\", "/").startsWith("frontend/"));
const forbiddenFrontendSecretNames = [];
for (const file of frontendFiles) {
  const content = await readFile(file, "utf8");
  if (/(?:OPENAI_API_KEY|SUPABASE_SECRET_KEYS|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SB_SECRET_KEY)/.test(content)) forbiddenFrontendSecretNames.push(relative(root, file));
}
pass("No server-only secret environment variables referenced by frontend source", forbiddenFrontendSecretNames.length === 0, forbiddenFrontendSecretNames.length ? `Server-only secret reference in: ${[...new Set(forbiddenFrontendSecretNames)].join(", ")}` : "Frontend source references no server-only key variables.");

try {
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split(/\r?\n/).filter(Boolean);
  const trackedEnv = tracked.filter((path) => /(^|\/)\.env(?:\..*)?$/.test(path) && !/(^|\/)(?:\.env\.example|\.env\.local\.example)$/.test(path));
  pass("No real .env files are tracked by Git", trackedEnv.length === 0, trackedEnv.length ? `Tracked environment file(s): ${trackedEnv.join(", ")}` : "No tracked .env files detected.");
} catch {
  pass("Git tracked-file secret check", true, "Skipped because git is unavailable in this environment.", false);
}

const failed = checks.filter((item) => !item.ok && item.critical);
const warnings = checks.filter((item) => !item.critical);
for (const item of checks) {
  const status = item.ok ? "PASS" : item.critical ? "FAIL" : "WARN";
  console.log(`${status.padEnd(4)} ${item.name} — ${item.detail}`);
}
console.log(`\nGuardAI static audit: ${checks.filter((item) => item.ok).length} passed, ${failed.length} failed, ${warnings.length} warnings.`);
if (failed.length) process.exitCode = 1;
