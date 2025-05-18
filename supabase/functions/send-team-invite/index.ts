// Supabase Edge Function for team invitations using Brevo API
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

// Environment variables
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "hello@decisionguide.ai";
const APP_URL = Deno.env.get("APP_URL") || "https://decisionguide.ai";

// Enhanced debug logging
console.log('DEBUG EDGE ENV • BREVO_API_KEY:', BREVO_API_KEY?.slice(0,8) + '…');
console.log('DEBUG EDGE ENV • FROM_EMAIL:   ', FROM_EMAIL);
console.log('DEBUG EDGE ENV • APP_URL:      ', APP_URL);
console.log('DEBUG EDGE ENV • TIMESTAMP:    ', new Date().toISOString());

// Create Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Send email via Brevo API
async function sendBrevoEmail(options: {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}) {
  const payload = {
    sender: { name: "DecisionGuide.AI", email: FROM_EMAIL },
    to: [{ email: options.to }],
    subject: options.subject,
    htmlContent: options.htmlContent,
    textContent: options.textContent
  };

  console.log("Sending email via Brevo API:", {
    to: options.to,
    subject: options.subject
  });

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY
    },
    body: JSON.stringify(payload)
  });

  const json = await response.json();
  console.log("Brevo API response:", {
    status: response.status,
    body: json
  });

  return {
    success: response.ok,
    status: response.status,
    response: json
  };
}

// Handle HTTP requests
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // Log request details
  console.log('Edge Function Request:', {
    method: req.method,
    path: new URL(req.url).pathname,
    timestamp: new Date().toISOString()
  });

  // Health check endpoint
  if (path.endsWith("/health")) {
    try {
      const result = await sendBrevoEmail({
        to: FROM_EMAIL,
        subject: "Health Check - DecisionGuide.AI",
        htmlContent: "<p>Health check test email</p>",
        textContent: "Health check test email"
      });

      return new Response(
        JSON.stringify({
          success: result.success,
          status: result.status,
          message: "Email system operational",
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    } catch (error) {
      console.error("Health check failed:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      );
    }
  }

  // Test email endpoint
  if (path.endsWith("/test-email")) {
    try {
      const { email } = await req.json();
      
      if (!email) {
        return new Response(
          JSON.stringify({ success: false, message: "Email address required" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400
          }
        );
      }

      const result = await sendBrevoEmail({
        to: email,
        subject: "Test Email from DecisionGuide.AI",
        htmlContent: `
          <h2>Test Email</h2>
          <p>This is a test email to verify the email delivery system.</p>
          <p>If you received this, the system is working correctly!</p>
        `,
        textContent: "This is a test email to verify the email delivery system."
      });

      return new Response(
        JSON.stringify(result),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    } catch (error) {
      console.error("Test email failed:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      );
    }
  }

  // Process team invitation
  if (req.method === "POST") {
    try {
      const { invitation_id, email, team_id, team_name, inviter_id } = await req.json();

      if (!email || !team_id || !team_name) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Missing required fields"
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400
          }
        );
      }

      // Get inviter details
      const { data: inviter } = await supabase.auth.admin.getUserById(inviter_id);
      const inviterName = inviter?.user?.email?.split('@')[0] || "A team admin";

      // Generate accept link
      const acceptLink = `${APP_URL}/teams/join?token=${invitation_id}`;

      // Log attempt
      await supabase.rpc('track_invitation_status', {
        invitation_uuid: invitation_id,
        status_value: 'sending',
        details_json: { team_id, team_name, inviter_id }
      });

      // Send invitation email
      const result = await sendBrevoEmail({
        to: email,
        subject: `Join ${team_name} on DecisionGuide.AI`,
        htmlContent: `
          <h2>Team Invitation</h2>
          <p>${inviterName} has invited you to join ${team_name} on DecisionGuide.AI</p>
          <p style="text-align:center">
            <a href="${acceptLink}" style="background:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
              Accept Invitation
            </a>
          </p>
          <p>Or copy this link: ${acceptLink}</p>
        `,
        textContent: `
          ${inviterName} has invited you to join ${team_name} on DecisionGuide.AI
          
          Accept your invitation here: ${acceptLink}
        `
      });

      // Log result
      await supabase.rpc('track_invitation_status', {
        invitation_uuid: invitation_id,
        status_value: result.success ? 'sent' : 'failed',
        details_json: {
          status: result.status,
          response: result.response,
          timestamp: new Date().toISOString()
        }
      });

      return new Response(
        JSON.stringify(result),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    } catch (error) {
      console.error("Invitation failed:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405
    }
  );
});