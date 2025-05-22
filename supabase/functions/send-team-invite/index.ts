// supabase/functions/send-team-invite/index.ts

import { createClient } from "npm:@supabase/supabase-js@2.39.7";

// Environment variables
const BREVO_API_KEY       = Deno.env.get("BREVO_API_KEY")!;
const FROM_EMAIL          = Deno.env.get("FROM_EMAIL")    || "hello@decisionguide.ai";
const APP_URL             = Deno.env.get("APP_URL")       || "https://decisionguide.ai";
const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Debug log of values (partially masked)
console.log("DEBUG • BREVO_API_KEY:", BREVO_API_KEY.slice(0,8) + "…");
console.log("DEBUG • FROM_EMAIL:   ", FROM_EMAIL);
console.log("DEBUG • APP_URL:      ", APP_URL);

// Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// CORS headers — note 200 on OPTIONS and including x-client-version
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": [
    "authorization",
    "apikey",
    "content-type",
    "x-client-info",
    "x-client-version"
  ].join(", ")
};

// Common Brevo send
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
    textContent: opts.textContent
  };

  console.log("➤ Sending Brevo:", opts.to, opts.subject);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method:  "POST",
    headers: {
      "Accept":       "application/json",
      "Content-Type": "application/json",
      "api-key":      BREVO_API_KEY
    },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  console.log("↩️ Brevo responded:", res.status, json);
  return { success: res.ok, status: res.status, response: json };
}

Deno.serve(async (req) => {
  const { method, url } = req;
  const path = new URL(url).pathname;

  // 1) CORS preflight for **any** path
  if (method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  console.log("→ Request:", method, path);

  // 2) Health: POST to /health
  if (path.endsWith("/health")) {
    try {
      const result = await sendBrevoEmail({
        to:          FROM_EMAIL,
        subject:     "Health Check – DecisionGuide.AI",
        htmlContent: "<p>Health check OK</p>",
        textContent: "Health check OK"
      });
      return new Response(JSON.stringify({
        success:   result.success,
        status:    result.status,
        message:   "Email system operational",
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("Health failed:", err);
      return new Response(JSON.stringify({
        success:   false,
        error:     err.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // 3) Test email: POST to /test-email
  if (path.endsWith("/test-email")) {
    try {
      const { email } = await req.json();
      if (!email) throw new Error("Email required");

      const result = await sendBrevoEmail({
        to:          email,
        subject:     "Test Email – DecisionGuide.AI",
        htmlContent: "<p>If you got this, it works!</p>",
        textContent: "Test email successful"
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("Test-email failed:", err);
      return new Response(JSON.stringify({
        success:   false,
        error:     err.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // 4) Invite: POST anywhere else
  if (method === "POST") {
    try {
      const { invitation_id, email, team_id, team_name, inviter_id } = await req.json();
      if (!invitation_id || !email || !team_id || !team_name) {
        throw new Error("Missing required fields");
      }

      // Track “sending”
      await supabase.rpc("track_invitation_status", {
        invitation_uuid: invitation_id,
        status_value:    "sending",
        details_json:    { team_id, team_name, inviter_id }
      });

      // Send
      const result = await sendBrevoEmail({
        to:          email,
        subject:     `Join ${team_name} on DecisionGuide.AI`,
        htmlContent: `
          <h2>Invitation</h2>
          <p>Click to join <strong>${team_name}</strong>:</p>
          <a href="${APP_URL}/teams/join?token=${invitation_id}"
             style="padding:12px 24px;background:#4F46E5;color:#fff;border-radius:6px;text-decoration:none;">
            Accept Invite
          </a>`,
        textContent: `Join ${team_name}: ${APP_URL}/teams/join?token=${invitation_id}`
      });

      // Track result
      await supabase.rpc("track_invitation_status", {
        invitation_uuid: invitation_id,
        status_value:    result.success ? "sent" : "failed",
        details_json:    { status: result.status, response: result.response }
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("Invitation failed:", err);
      return new Response(JSON.stringify({
        success:   false,
        error:     err.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // 5) All other methods → 405
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});