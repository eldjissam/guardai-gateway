import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = (origin: string | null) => {
  const allowed = (Deno.env.get("GUARDAI_ALLOWED_ORIGINS") ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (!origin) headers["Access-Control-Allow-Origin"] = "*";
  else if (allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
};

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

function getDefaultKey(raw: string | undefined, fallback?: string): string {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      // A plain legacy key is accepted as a server-only fallback.
      return raw;
    }
  }
  return fallback ?? "";
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);
  if (origin && !cors["Access-Control-Allow-Origin"]) return json({ error: "Origin not allowed." }, 403, cors);

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication is required." }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = getDefaultKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"), Deno.env.get("SUPABASE_ANON_KEY"));
  const secretKey = getDefaultKey(Deno.env.get("SUPABASE_SECRET_KEYS"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: "Server-side Supabase keys are not available to this function." }, 500, cors);
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const caller = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await caller.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Your session is invalid or has expired." }, 401, cors);

    const { data: allowed, error: roleError } = await caller.rpc("is_guardai_admin");
    if (roleError || allowed !== true) return json({ error: "Administrator privileges are required." }, 403, cors);

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const body = await request.json().catch(() => null) as {
      action?: string;
      email?: string;
      fullName?: string;
      role?: string;
      userId?: string;
    } | null;
    if (!body?.action) return json({ error: "An account-management action is required." }, 400, cors);

    if (body.action === "invite") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const fullName = String(body.fullName ?? "").trim();
      const role = body.role === "admin" ? "admin" : body.role === "user" ? "user" : null;
      if (!/^\S+@\S+\.\S+$/.test(email) || fullName.length < 2 || !role) {
        return json({ error: "Provide a valid email, a full name and a supported role." }, 400, cors);
      }
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        ...(origin ? { redirectTo: origin } : {}),
      });
      if (error || !data.user) return json({ error: error?.message ?? "The invitation could not be created." }, 400, cors);

      const { error: profileError } = await admin.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        email,
        role,
      }, { onConflict: "id" });
      if (profileError) {
        return json({ error: "The invitation was created, but the account profile could not be synchronized. Review the account before sending another invitation." }, 500, cors);
      }
      return json({ success: true, userId: data.user.id, message: "Invitation email sent." }, 200, cors);
    }

    const userId = String(body.userId ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: "A valid account identifier is required." }, 400, cors);
    }
    if (userId === authData.user.id) return json({ error: "You cannot change or delete your own administrator account here." }, 400, cors);

    if (body.action === "set_role") {
      const role = body.role === "admin" ? "admin" : body.role === "user" ? "user" : null;
      if (!role) return json({ error: "The requested role is not supported." }, 400, cors);
      const { data: updated, error } = await admin.rpc("guardai_set_profile_role", { p_user_id: userId, p_role: role });
      if (error) {
        if (String(error.message ?? "").includes("LAST_GUARDAI_ADMIN")) return json({ error: "The last administrator cannot be demoted." }, 409, cors);
        return json({ error: "The account role could not be updated." }, 500, cors);
      }
      if (updated !== true) return json({ error: "The account was not found." }, 404, cors);
      return json({ success: true, message: "Account role updated." }, 200, cors);
    }

    if (body.action === "delete") {
      const { data: allowedToDelete, error: guardError } = await admin.rpc("guardai_prepare_account_deletion", { p_user_id: userId });
      if (guardError) {
        if (String(guardError.message ?? "").includes("LAST_GUARDAI_ADMIN")) return json({ error: "The last administrator account cannot be deleted." }, 409, cors);
        return json({ error: "Account deletion could not be safely authorized." }, 500, cors);
      }
      if (allowedToDelete !== true) return json({ error: "The account was not found." }, 404, cors);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: "The account could not be deleted. If it was an administrator, its role was safely revoked first." }, 500, cors);
      return json({ success: true, message: "Account deleted." }, 200, cors);
    }

    return json({ error: "Unsupported account-management action." }, 400, cors);
  } catch (error) {
    console.error("admin-manage-users failed", error);
    return json({ error: "The account-management request could not be completed." }, 500, cors);
  }
});
