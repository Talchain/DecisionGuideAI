// Supabase Edge Function: delete-account
// Permanently deletes user data and auth record.
// Requires a valid JWT (Bearer token) — the requesting user deletes themselves.

import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const APP_URL = Deno.env.get("APP_URL") || "https://decisionguide.ai";

if (!SUPABASE_URL) throw new Error("SUPABASE_URL is required");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

// Tightened CORS — only allow known origins, never wildcard.
const ALLOWED_ORIGINS = [
  APP_URL,
  "https://decisionguide.ai",
  "https://app.decisionguide.ai",
  "http://localhost:5173",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.some((o) => origin === o);
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "content-type": "application/json" },
    });
  }

  try {
    // Extract and verify JWT
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization token" }), {
        status: 401,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    // Verify the caller's JWT. getUser(token) validates the token itself
    // (signature + expiry) regardless of which key the client was created with.
    // We use the service-role client here because Edge Functions don't expose
    // the anon key as an env var. The service-role key is NOT used to elevate
    // the caller's privileges — it only enables the getUser() call.
    const verifier = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await verifier.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    const userId = user.id;

    // Service role client for admin operations
    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    // Delete user data in dependency order
    // 1. turn_observations (references scenarios via scenario_id, not user_id)
    const { data: userScenarioIds } = await admin
      .from("scenarios")
      .select("id")
      .eq("user_id", userId);
    if (userScenarioIds && userScenarioIds.length > 0) {
      const sIds = userScenarioIds.map((s: { id: string }) => s.id);
      const { error: e1 } = await admin
        .from("turn_observations")
        .delete()
        .in("scenario_id", sIds);
      if (e1) console.error("delete turn_observations:", e1.message);
    }

    // 2. shared_briefs (references scenarios)
    if (userScenarioIds && userScenarioIds.length > 0) {
      const sIds = userScenarioIds.map((s: { id: string }) => s.id);
      const { error: e2 } = await admin
        .from("shared_briefs")
        .delete()
        .in("scenario_id", sIds);
      if (e2) console.error("delete shared_briefs:", e2.message);
    }

    // 3. scenarios
    const { error: e3 } = await admin
      .from("scenarios")
      .delete()
      .eq("user_id", userId);
    if (e3) console.error("delete scenarios:", e3.message);

    // 4. user_profiles
    const { error: e4 } = await admin
      .from("user_profiles")
      .delete()
      .eq("id", userId);
    if (e4) console.error("delete user_profiles:", e4.message);

    // 5. Delete auth user (admin API)
    const { error: e5 } = await admin.auth.admin.deleteUser(userId);
    if (e5) {
      console.error("delete auth user:", e5.message);
      return new Response(JSON.stringify({ error: "Failed to delete auth record" }), {
        status: 500,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...headers, "content-type": "application/json" },
    });
  } catch (err) {
    console.error("delete-account error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...headers, "content-type": "application/json" },
    });
  }
});
