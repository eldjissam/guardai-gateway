import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://192.168.1.65:5173",
  "http://192.168.1.65:5174",
];

function readKeySet(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    return parsed.default ?? Object.values(parsed)[0] ?? null;
  } catch {
    return null;
  }
}

function keys() {
  const url = Deno.env.get("SUPABASE_URL");
  const publishable = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    readKeySet(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"));
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    readKeySet(Deno.env.get("SUPABASE_SECRET_KEYS"));
  return { url, publishable, secret };
}

function allowedOrigins(): string[] {
  const configured = Deno.env.get("GUARDAI_ALLOWED_ORIGINS");
  return configured
    ? configured.split(",").map((value) => value.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
}

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (!origin) headers["Access-Control-Allow-Origin"] = "*";
  else if (allowedOrigins().includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin);
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);
  if (origin && !allowedOrigins().includes(origin)) return json({ error: "Origin not allowed." }, 403, cors);

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Authentication is required." }, 401, cors);

  let payload: { confirmation?: string } = {};
  try { payload = await request.json(); } catch { return json({ error: "Invalid request body." }, 400, cors); }
  if (payload.confirmation !== "DELETE") return json({ error: "Explicit deletion confirmation is required." }, 400, cors);

  const config = keys();
  if (!config.url || !config.publishable || !config.secret) {
    console.error("delete-my-account is missing server-side Supabase key configuration.");
    return json({ error: "Account deletion is not configured. Please contact the administrator." }, 503, cors);
  }

  const userClient = createClient(config.url, config.publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userResult, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userResult.user) return json({ error: "Your session is invalid or expired. Sign in again." }, 401, cors);

  const user = userResult.user;
  const adminClient = createClient(config.url, config.secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The database RPC serializes administrator removals and prevents a last-admin race.
  const { data: allowedToDelete, error: guardError } = await adminClient.rpc("guardai_prepare_account_deletion", { p_user_id: user.id });
  if (guardError) {
    if (String(guardError.message ?? "").includes("LAST_GUARDAI_ADMIN")) {
      return json({ error: "This is the last administrator account. Promote another trusted administrator before deleting this account." }, 409, cors);
    }
    console.error("Could not safely authorize account deletion:", guardError.message);
    return json({ error: "GuardAI could not verify administrator coverage. No deletion was completed." }, 500, cors);
  }
  if (allowedToDelete !== true) return json({ error: "The account could not be found." }, 404, cors);

  // Avatar objects are owned by the account and must be removed before deleting the Auth user.
  const { error: avatarError } = await adminClient.storage.from("user-avatars").remove([`${user.id}/avatar`]);
  if (avatarError) {
    console.error("Could not remove the user's profile avatar before account deletion:", avatarError.message);
    return json({ error: "Your profile photo could not be removed. The account has not been deleted." }, 500, cors);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("Could not delete the authenticated GuardAI account:", deleteError.message);
    return json({ error: "GuardAI could not delete this account. No account deletion was completed." }, 500, cors);
  }

  return json({ success: true }, 200, cors);
});
