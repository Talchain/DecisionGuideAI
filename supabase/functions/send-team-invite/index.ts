// src/functions/send-team-invite/index.ts

// Supabase Edge Function for team invitations using Brevo API
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

// SECURITY: All secrets MUST be set via Supabase Edge Function secrets.
// NEVER commit .env files or log key material.
// See SECURITY.md for rotation procedures.

const BREVO_API_KEY             = Deno.env.get("BREVO_API_KEY");
const FROM_EMAIL                = Deno.env.get("FROM_EMAIL")     || "hello@decisionguide.ai";
const APP_URL                   = Deno.env.get("APP_URL")        || "https://decisionguide.ai";
const SUPABASE_URL              = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Validate required environment variables
if (!BREVO_API_KEY) {
  throw new Error("BREVO_API_KEY environment variable is required");
}
if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is required");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
}

// SECURITY: NEVER log secrets or key material
console.log("✅ Environment variables validated");
console.log("📧 FROM_EMAIL:   ", FROM_EMAIL);
console.log("🌐 APP_URL:      ", APP_URL);
console.log("⏰ TIMESTAMP:    ", new Date().toISOString());

// Create your Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// SECURITY: CORS allow-list (never use wildcard in production)
const ALLOWED_ORIGINS = [
  "https://decisionguide.ai",
  "https://app.olumi.app",
  "http://localhost:5173",  // Dev only
  "http://localhost:4173",  // Preview builds
];

// Helper to check if origin is allowed and get CORS headers
function getCorsHeaders(requestOrigin: string | null): Record<string, string> | null {
  // SECURITY: Reject unknown origins explicitly (don't fallback)
  if (!requestOrigin || !ALLOWED_ORIGINS.includes(requestOrigin)) {
    return null; // Signal rejection
  }

  return {
    "Access-Control-Allow-Origin":  requestOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin", // Critical for caching with multiple origins
  };
}

// Helper to send via Brevo
async function sendBrevoEmail(opts: {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}) {
  const payload = {
    sender:      { name: "DecisionGuide.AI", email: FROM_EMAIL },
    to:          [{ email: opts.to }],
    subject:     opts.subject,
    htmlContent: opts.htmlContent,
    textContent: opts.textContent,
  };

  console.log("✉️  Sending via Brevo:", opts.to, opts.subject);
  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method:  "POST",
    headers: {
      "Accept":        "application/json",
      "Content-Type":  "application/json",
      "api-key":       BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const body = await resp.json();
  console.log("📬 Brevo response:", resp.status, body);
  return { success: resp.ok, status: resp.status, response: body };
}

// Entrypoint
Deno.serve(async (req) => {
  const url    = new URL(req.url);
  const path   = url.pathname;
  const method = req.method.toUpperCase();

  // Get CORS headers for this request's origin
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // SECURITY: Reject unknown origins explicitly
  if (!corsHeaders) {
    console.warn("⛔ Rejected request from unknown origin:", origin);
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  // Always respond to preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  console.log("➡️  Request", { method, path, origin, time: new Date().toISOString() });

  // 1) Health check
  if (path.endsWith("/health") && method === "GET") {
    try {
      const result = await sendBrevoEmail({
        to:          FROM_EMAIL,
        subject:     "Health Check – DecisionGuide.AI",
        htmlContent: "<p>Health check test email</p>",
        textContent: "Health check test email",
      });

      return new Response(
        JSON.stringify({
          success:   result.success,
          status:    result.status,
          message:   "Email system operational",
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      console.error("❌ Health check error:", err);
      return new Response(
        JSON.stringify({ success: false, error: err.message, timestamp: new Date().toISOString() }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // 2) Test-email
  if (path.endsWith("/test-email") && method === "POST") {
    try {
      const { email } = await req.json();
      if (!email) {
        return new Response(
          JSON.stringify({ success: false, message: "Email address required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await sendBrevoEmail({
        to:          email,
        subject:     "Test Email from DecisionGuide.AI",
        htmlContent: `
          <h2>Test Email</h2>
          <p>This is a test email to verify delivery.</p>
        `,
        textContent: "This is a test email to verify delivery.",
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("❌ Test email error:", err);
      return new Response(
        JSON.stringify({ success: false, error: err.message, timestamp: new Date().toISOString() }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // 3) Send team invite
  if (path.endsWith("/send-team-invite") && method === "POST") {
    try {
      const { invitation_id, email, team_id, team_name, inviter_id } = await req.json();
      if (!invitation_id || !email || !team_id || !team_name) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Lookup inviter
      const { data: inv, error: invErr } = await supabase.auth.admin.getUserById(inviter_id);
      if (invErr) throw invErr;
      const inviterEmail = inv?.user?.email || "A team admin";
      const acceptLink   = `${APP_URL}/teams/join?token=${invitation_id}`;

      // Track “sending”
      await supabase.rpc("track_invitation_status", {
        invitation_uuid: invitation_id,
        status_value:    "sending",
        details_json:    { team_id, team_name, inviter_id },
      });

      // Send
      const brevoResult = await sendBrevoEmail({
        to:          email,
        subject:     `Join ${team_name} on DecisionGuide.AI`,
        htmlContent: `
          <h2>Team Invitation</h2>
          <p>${inviterEmail} invited you to join <strong>${team_name}</strong> on DecisionGuide.AI</p>
          <p style="text-align:center">
            <a href="${acceptLink}"
               style="background:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">
              Accept Invitation
            </a>
          </p>
          <p>Or copy: ${acceptLink}</p>
        `,
        textContent: `${inviterEmail} invited you to join ${team_name}.\nAccept: ${acceptLink}`,
      });

      // Track result
      await supabase.rpc("track_invitation_status", {
        invitation_uuid: invitation_id,
        status_value:    brevoResult.success ? "sent" : "failed",
        details_json:    { status: brevoResult.status, response: brevoResult.response },
      });

      return new Response(JSON.stringify(brevoResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("❌ Invitation error:", err);
      return new Response(
        JSON.stringify({ success: false, error: err.message, timestamp: new Date().toISOString() }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // 4) Fallback for everything else → 405
  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});