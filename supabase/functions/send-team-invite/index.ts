// supabase/functions/send-team-invite/index.ts

import { createClient } from "npm:@supabase/supabase-js@2.39.7";

// Environment variables
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const FROM_EMAIL    = Deno.env.get("FROM_EMAIL")    || "hello@decisionguide.ai";
const APP_URL       = Deno.env.get("APP_URL")       || "https://decisionguide.ai";

// Debug
console.log('DEBUG EDGE ENV • BREVO_API_KEY:', BREVO_API_KEY.slice(0,8) + '…');
console.log('DEBUG EDGE ENV • FROM_EMAIL:   ', FROM_EMAIL);
console.log('DEBUG EDGE ENV • APP_URL:      ', APP_URL);

// Supabase client
const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase           = createClient(supabaseUrl, supabaseServiceKey);

// **CORS** — added x-client-version here so Supabase-JS will pass preflight
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": [
    "authorization",
    "apikey",
    "content-type",
    "x-client-info",
    "x-client-version"
  ].join(", ")
};

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

  console.log("➤ Sending via Brevo:", opts.to, opts.subject);
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
  // handle CORS preflight everywhere
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url  = new URL(req.url);
  const path = url.pathname;

  console.log("→ Request:", req.method, path);

  // --- Health Check ---
  if (path.endsWith("/health")) {
    try {
      const result = await sendBrevoEmail({
        to:           FROM_EMAIL,
        subject:      "Health Check – DecisionGuide.AI",
        htmlContent:  "<p>Health check</p>",
        textContent:  "Health check"
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
      console.error("Health check failed:", err);
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

  // --- Test Email ---
  if (path.endsWith("/test-email")) {
    try {
      const { email } = await req.json();
      if (!email) throw new Error("Email address required");

      const result = await sendBrevoEmail({
        to:           email,
        subject:      "Test Email from DecisionGuide.AI",
        htmlContent:  `<h2>Test</h2><p>If you got this, it works!</p>`,
        textContent:  "Test email from DecisionGuide.AI"
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("Test email failed:", err);
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

  // --- Send Invite ---
  if (req.method === "POST") {
    try {
      const { invitation_id, email, team_id, team_name, inviter_id } = await req.json();
      if (!invitation_id || !email || !team_id || !team_name) {
        return new Response(JSON.stringify({ success: false, message: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // record attempt
      await supabase.rpc("track_invitation_status", {
        invitation_uuid: invitation_id,
        status_value:    "sending",
        details_json:    { team_id, team_name, inviter_id }
      });

      // send email
      const result = await sendBrevoEmail({
        to:           email,
        subject:      `Join ${team_name} on DecisionGuide.AI`,
        htmlContent:  `
          <h2>Team Invitation</h2>
          <p>Click below to join <strong>${team_name}</strong>:</p>
          <a href="${APP_URL}/teams/join?token=${invitation_id}"
             style="background:#4F46E5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Accept Invite</a>`,
        textContent:  `Join ${team_name}: ${APP_URL}/teams/join?token=${invitation_id}`
      });

      // record result
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

  // --- Fallback ---
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});