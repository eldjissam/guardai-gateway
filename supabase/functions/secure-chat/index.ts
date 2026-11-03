import { createClient } from "npm:@supabase/supabase-js@2";
import { detectSensitiveSpans } from "./modules/detector.ts";
import { tokenizePrompt } from "./modules/tokenizer.ts";
import { calculateRisk, countEntities } from "./modules/risk-engine.ts";
import { containsUnresolvedGuardToken, restoreKnownTokens } from "./modules/restoration.ts";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://192.168.1.65:5173",
  "http://192.168.1.65:5174",
];

function allowedOrigins(): string[] {
  const configured = Deno.env.get("GUARDAI_ALLOWED_ORIGINS");
  return configured
    ? configured.split(",").map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
}

function makeCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (!origin) headers["Access-Control-Allow-Origin"] = "*";
  else if (allowedOrigins().includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function getDefaultKey(jsonValue: string | undefined): string | null {
  if (!jsonValue) return null;
  try {
    const parsed = JSON.parse(jsonValue) as Record<string, string>;
    return parsed.default ?? null;
  } catch {
    return null;
  }
}

function getSupabaseKeys() {
  const publishable = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    getDefaultKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"));
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    getDefaultKey(Deno.env.get("SUPABASE_SECRET_KEYS"));
  return { publishable, secret };
}

function safeErrorMessage() {
  return "GuardAI could not complete this protected request. Your unmasked prompt was not sent as a fallback. Please try again.";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function recordFailure(
  admin: ReturnType<typeof createClient>,
  data: {
    requestId: string;
    userId: string;
    sessionId: string | null;
    riskScore: number;
    riskLevel: string;
    entityBreakdown: Record<string, number>;
    entityCount: number;
    processingTimeMs: number;
  },
) {
  // Metadata only: never write the raw prompt, detected value, or token map.
  await admin.from("security_events").insert({
    request_id: data.requestId,
    user_id: data.userId,
    session_id: data.sessionId,
    risk_score: data.riskScore,
    risk_level: data.riskLevel,
    entities_detected: data.entityCount,
    entity_breakdown: data.entityBreakdown,
    status: "FAILED",
    processing_time_ms: data.processingTimeMs,
  });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  const cors = makeCorsHeaders(origin);

  if (origin && !allowedOrigins().includes(origin)) {
    return jsonResponse({ error: "Origin is not allowed." }, 403, cors);
  }
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, cors);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication is required." }, 401, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const { publishable, secret } = getSupabaseKeys();
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-6-luna";
  if (!supabaseUrl || !publishable || !secret) {
    return jsonResponse({ error: "The GuardAI server is missing its Supabase configuration." }, 503, cors);
  }
  if (!openAiKey) {
    return jsonResponse({ error: "The OpenAI server key has not been configured." }, 503, cors);
  }

  const jwt = authorization.slice("Bearer ".length).trim();
  const userClient = createClient(supabaseUrl, publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData.user) {
    return jsonResponse({ error: "Your session is invalid or expired. Please sign in again." }, 401, cors);
  }

  const admin = createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userId = userData.user.id;
  const { data: rateLimitAllowed, error: rateLimitError } = await admin.rpc("consume_guardai_rate_limit", {
    p_user_id: userId,
    p_limit: 15,
    p_window_seconds: 60,
  });
  if (rateLimitError) {
    return jsonResponse({ error: "GuardAI could not verify the request limit. Please try again shortly." }, 503, cors);
  }
  if (rateLimitAllowed !== true) {
    return jsonResponse({ error: "You have reached the temporary request limit. Please wait a minute and try again." }, 429, cors);
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let sessionId: string | null = null;
  let riskScore = 0;
  let riskLevel = "LOW";
  let entityBreakdown: Record<string, number> = {};
  let entityCount = 0;

  try {
    const contentLength = Number(request.headers.get("Content-Length") ?? 0);
    if (contentLength > 20_000) return jsonResponse({ error: "The request is too large." }, 413, cors);
    const rawBody = await request.text();
    if (rawBody.length > 20_000) return jsonResponse({ error: "The request is too large." }, 413, cors);
    let body: { message?: unknown; sessionId?: unknown };
    try {
      body = JSON.parse(rawBody) as { message?: unknown; sessionId?: unknown };
    } catch {
      return jsonResponse({ error: "The request body must be valid JSON." }, 400, cors);
    }
    if (typeof body.message !== "string" || !body.message.trim()) {
      return jsonResponse({ error: "Please enter a message before sending." }, 400, cors);
    }
    const originalPrompt = body.message.trim();
    if (originalPrompt.length > 10_000) {
      return jsonResponse({ error: "Messages must be 10,000 characters or fewer." }, 413, cors);
    }

    if (body.sessionId !== undefined && body.sessionId !== null) {
      if (typeof body.sessionId !== "string" || !isUuid(body.sessionId)) {
        return jsonResponse({ error: "The conversation identifier is invalid." }, 400, cors);
      }
      const { data: ownedSession, error: sessionLookupError } = await admin
        .from("chat_sessions")
        .select("id")
        .eq("id", body.sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (sessionLookupError || !ownedSession) {
        return jsonResponse({ error: "This conversation could not be found." }, 404, cors);
      }
      sessionId = ownedSession.id;
    }

    const spans = detectSensitiveSpans(originalPrompt);
    const risk = calculateRisk(spans);
    riskScore = risk.score;
    riskLevel = risk.level;
    entityBreakdown = countEntities(spans);
    entityCount = spans.length;
    const tokenized = tokenizePrompt(originalPrompt, spans, requestId);

    // Load only sanitized history written by the Edge Function.
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (sessionId) {
      const { data: priorMessages, error: historyError } = await admin
        .from("chat_messages")
        .select("role,sanitized_content")
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (historyError) throw new Error("HISTORY_LOAD_FAILED");
      for (const message of (priorMessages ?? []).reverse()) {
        if ((message.role === "user" || message.role === "assistant") && typeof message.sanitized_content === "string") {
          history.push({ role: message.role, content: message.sanitized_content });
        }
      }
    }

    // Crucial privacy boundary: only tokenized current content and sanitized history go to OpenAI.
    const openAiInput = [...history, { role: "user" as const, content: tokenized.sanitizedPrompt }];
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1000,
        instructions: "You are GuardAI's helpful assistant. Markers such as [[GAI_...]] are opaque privacy placeholders. Never guess or reconstruct hidden values. Preserve each marker exactly if you need to refer to it. Answer naturally and safely.",
        input: openAiInput,
      }),
    });

    if (!openAiResponse.ok) {
      await recordFailure(admin, {
        requestId, userId, sessionId, riskScore, riskLevel, entityBreakdown, entityCount,
        processingTimeMs: Date.now() - startedAt,
      });
      return jsonResponse({ error: safeErrorMessage(), requestId }, 502, cors);
    }

    const providerData = await openAiResponse.json() as {
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const sanitizedAssistantMessage = (providerData.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text" && typeof part.text === "string")
      .map((part) => part.text as string)
      .join("\n")
      .trim();
    if (!sanitizedAssistantMessage) throw new Error("EMPTY_AI_RESPONSE");

    const assistantMessage = restoreKnownTokens(sanitizedAssistantMessage, tokenized.mapping);
    const restorationWarning = containsUnresolvedGuardToken(assistantMessage);
    const finalSessionId = sessionId ?? crypto.randomUUID();

    if (!sessionId) {
      const { error: createSessionError } = await admin.from("chat_sessions").insert({
        id: finalSessionId,
        user_id: userId,
        title: "Secure conversation",
      });
      if (createSessionError) throw new Error("SESSION_SAVE_FAILED");
    }

    const now = new Date().toISOString();
    const { error: messagesError } = await admin.from("chat_messages").insert([
      { session_id: finalSessionId, user_id: userId, request_id: requestId, role: "user", sanitized_content: tokenized.sanitizedPrompt },
      { session_id: finalSessionId, user_id: userId, request_id: requestId, role: "assistant", sanitized_content: sanitizedAssistantMessage },
    ]);
    if (messagesError) {
      if (!sessionId) await admin.from("chat_sessions").delete().eq("id", finalSessionId).eq("user_id", userId);
      throw new Error("MESSAGE_SAVE_FAILED");
    }

    await admin.from("chat_sessions").update({ updated_at: now }).eq("id", finalSessionId).eq("user_id", userId);
    const elapsed = Date.now() - startedAt;
    const { error: auditError } = await admin.from("security_events").insert({
      request_id: requestId,
      user_id: userId,
      session_id: finalSessionId,
      risk_score: riskScore,
      risk_level: riskLevel,
      entities_detected: entityCount,
      entity_breakdown: entityBreakdown,
      status: "SUCCESS",
      processing_time_ms: elapsed,
    });
    if (auditError) throw new Error("AUDIT_SAVE_FAILED");

    return jsonResponse({
      success: true,
      requestId,
      sessionId: finalSessionId,
      assistantMessage,
      security: {
        status: entityCount > 0 ? "PROTECTED" : "NO_SENSITIVE_DATA_DETECTED",
        riskScore,
        riskLevel,
        entitiesDetected: entityCount,
        entityBreakdown,
        entities: tokenized.entities,
        sanitizedPrompt: tokenized.sanitizedPrompt,
        restorationWarning,
        processingTimeMs: elapsed,
      },
    }, 200, cors);
  } catch (_error) {
    // Never log request bodies, original prompt text, sensitive values, or the token map.
    try {
      await recordFailure(admin, {
        requestId, userId, sessionId, riskScore, riskLevel, entityBreakdown, entityCount,
        processingTimeMs: Date.now() - startedAt,
      });
    } catch {
      // Keep the outward failure message safe even if the audit insert also fails.
    }
    return jsonResponse({ error: safeErrorMessage(), requestId }, 500, cors);
  }
});
