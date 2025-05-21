// supabase/functions/send-team-invite/index.ts

import { createClient } from "npm:@supabase/supabase-js@2.39.7";

// Environment variables
const BREVO_API_KEY         = Deno.env.get("BREVO_API_KEY")!;
const FROM_EMAIL            = Deno.env.get("FROM_EMAIL")        || "hello@decisionguide.ai";
const APP_URL               = Deno.env.get("APP_URL")           || "https://decisionguide.ai";
const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Debug logging
console.log("DEBUG EDGE ENV • BREVO_API_KEY:", BREVO_API_KEY.slice(0,8) + "…");
console.log("DEBUG EDGE ENV • FROM_EMAIL:   ", FROM_EMAIL);
console.log("DEBUG EDGE ENV • APP_URL:      ", APP_URL);
console.log("DEBUG EDGE ENV • TIMESTAMP:    ", new Date().toISOString());

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// CORS (including x-client-version)
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-client-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Brevo send helper
async function sendBrevoEmail(opts: {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}) {
  console.log("Brevo_SEND:", { to: opts.to, subject: opts.subject });
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Accept":       "application/json",
      "Content-Type": "application/json",
      "api-key":      BREVO_API_KEY
    },
    body: JSON.stringify({
      sender:      { name: "DecisionGuide.AI", email: FROM_EMAIL },
      to:          [{ email: opts.to }],
      subject:     opts.subject,
      htmlContent: opts.htmlContent,
      textContent: opts.textContent
    })
  });
  const body = await res.json();
  console.log("Brevo_RESP:", res.status, body);
  return { success: res.ok, status: res.status, response: body };
}

Deno.serve(async (req) => {
  const url  = new URL(req.url);
  const path = url.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Health check
  if (path.endsWith("/health")) {
    try {
      const result = await sendBrevoEmail({
        to:          FROM_EMAIL,
        subject:     "Health Check – DecisionGuide.AI",
        htmlContent: "<p>Health check test email</p>",
        textContent: "Health check test email"
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
      console.error("Health_ERR:", err);
      return new Response(JSON.stringify({
        success: false,
        error:   err.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // Test-email
  if (path.endsWith("/test-email") && req.method === "POST") {
    try {
      const { email } = await req.json();
      if (!email) {
        return new Response(JSON.stringify({ success: false, message: "Email address required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const result = await sendBrevoEmail({
        to:          email,
        subject:     "Test Email from DecisionGuide.AI",
        htmlContent: `
          <h2>Test Email</h2>
          <p>This is a test email to verify delivery.</p>
        `,
        textContent: "This is a test email to verify delivery."
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("Test_ERR:", err);
      return new Response(JSON.stringify({
        success: false,
        error:   err.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // Team invitation
  if (req.method === "POST") {
    try {
      const { invitation_id, email, team_id, team_name, inviter_id } = await req.json();
      if (!invitation_id || !email || !team_id || !team_name) {
        return new Response(JSON.stringify({ success: false, message: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Get inviter
      const { data: { user: inviter } } = await supabase.auth.admin.getUserById(inviter_id);
      const inviterName = inviter?.email?.split("@")[0] || "A team admin";

      // Track “sending”
      await supabase.rpc("track_invitation_status", {
        invitation_uuid: invitation_id,
        status_value:    "sending",
        details_json:    { team_id, team_name, inviter_id, timestamp: new Date().toISOString() }
      });

      // Build link
      const acceptLink = `${APP_URL}/teams/join?token=${invitation_id}`;

      // Send
      const result = await sendBrevoEmail({
        to:          email,
        subject:     `Join ${team_name} on DecisionGuide.AI`,
        htmlContent: `
          <h2>Team Invitation</h2>
          <p>${inviterName} has invited you to join <strong>${team_name}</strong>.</p>
          <p style="text-align:center">
            <a href="${acceptLink}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
              Accept Invitation
            </a>
          </p>
          <p>Or copy this link: ${acceptLink}</p>
        `,
        textContent: `${inviterName} has invited you to join ${team_name}.\nAccept here: ${acceptLink}`
      });

      // Track result
      await supabase.rpc("track_invitation_status", {
        invitation_uuid: invitation_id,
        status_value:    result.success ? "sent" : "failed",
        details_json:    { status: result.status, response: result.response, timestamp: new Date().toISOString() }
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("Invite_ERR:", err);
      return new Response(JSON.stringify({
        success: false,
        error:   err.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // Fallback
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});