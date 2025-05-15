// Supabase Edge Function to send team invitation emails
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import nodemailer from "npm:nodemailer@6.9.9";

// Environment variables are automatically available
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const smtpUrl = Deno.env.get("SMTP_URL");
const fromEmail = Deno.env.get("FROM_EMAIL") || "hello@decisionguide.ai";
const appUrl = Deno.env.get("APP_URL") || "https://decisionguide.ai";

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Handle HTTP requests
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("[CORS] Handling OPTIONS preflight request");
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  // Health check endpoint
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    console.log("[HEALTH] Checking SMTP connection health");
    try {
      // Validate SMTP URL
      if (!smtpUrl) {
        throw new Error("SMTP_URL environment variable is not set");
      }
      
      console.log("[HEALTH] SMTP URL length:", smtpUrl.length);
      console.log("[HEALTH] SMTP URL prefix:", smtpUrl.substring(0, 10) + "...");
      
      // Create transporter with explicit options instead of URL string
      const smtpOptions = parseSmtpUrl(smtpUrl);
      console.log("[HEALTH] Parsed SMTP options:", {
        host: smtpOptions.host,
        port: smtpOptions.port,
        secure: smtpOptions.secure,
        hasAuth: !!smtpOptions.auth
      });
      
      const transporter = nodemailer.createTransport(smtpOptions);
      console.log("[HEALTH] Created transporter, verifying connection...");
      
      await transporter.verify();
      console.log("[HEALTH] SMTP connection verified successfully");
      
      return new Response(
        JSON.stringify({ success: true, message: "SMTP connection OK" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (error) {
      console.error("[HEALTH] SMTP connection verification failed:", error);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "SMTP connection failed", 
          error: error.message,
          stack: error.stack
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
  }

  try {
    // Log environment configuration
    console.log("[ENV] Edge Function started with environment:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey && supabaseServiceKey.length > 20,
      hasSmtpUrl: !!smtpUrl,
      smtpUrlLength: smtpUrl?.length || 0,
      hasFromEmail: !!fromEmail,
      hasAppUrl: !!appUrl,
      timestamp: new Date().toISOString()
    });

    // Parse request body if this is a direct HTTP request
    if (req.method === "POST") {
      let body;
      try {
        body = await req.json();
        console.log("[REQUEST] Received payload:", JSON.stringify(body));
      } catch (parseError) {
        console.error("[REQUEST] Failed to parse request body:", parseError);
        return new Response(
          JSON.stringify({ error: "Invalid JSON payload", details: parseError.message }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }
      
      // Process the invitation
      try {
        await processInvitationPayload(body);
        
        return new Response(
          JSON.stringify({ success: true, message: "Invitation email sent" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      } catch (processError) {
        console.error("[PROCESS] Error processing invitation:", processError);
        return new Response(
          JSON.stringify({ 
            error: "Failed to process invitation", 
            details: processError.message,
            stack: processError.stack
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          }
        );
      }
    }
    
    // For webhook/subscription requests, just acknowledge receipt
    return new Response(
      JSON.stringify({ success: true, message: "Webhook received" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[GLOBAL] Unhandled error in edge function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Unhandled error in edge function", 
        message: error.message,
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Process invitation from payload
async function processInvitationPayload(payload: any) {
  try {
    console.log("[PROCESS] Starting invitation processing");
    const { invitation_id, email, team_id, team_name, inviter_id } = payload;
    
    if (!email || !team_id || !team_name) {
      console.error("[PROCESS] Missing required fields:", { email, team_id, team_name });
      throw new Error("Missing required fields in payload");
    }
    
    console.log("[PROCESS] Processing invitation payload:", {
      invitation_id,
      email,
      team_id,
      team_name,
      inviter_id
    });
    
    // Get inviter details if inviter_id is provided
    let inviterName = "A team admin";
    let inviterEmail = fromEmail;
    
    if (inviter_id) {
      try {
        console.log("[PROCESS] Fetching inviter profile:", inviter_id);
        const { data: inviter, error: inviterError } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, id")
          .eq("id", inviter_id)
          .single();
          
        if (inviterError) {
          console.error("[PROCESS] Error fetching inviter profile:", inviterError);
          throw inviterError;
        }
        
        console.log("[PROCESS] Fetching inviter user details");
        const { data: inviterUser, error: inviterUserError } = await supabase
          .auth.admin.getUserById(inviter_id);
          
        if (inviterUserError) {
          console.error("[PROCESS] Error fetching inviter user:", inviterUserError);
          throw inviterUserError;
        }
        
        if (inviter && inviterUser) {
          const firstName = inviter.first_name || "";
          const lastName = inviter.last_name || "";
          
          if (firstName || lastName) {
            inviterName = `${firstName} ${lastName}`.trim();
          } else if (inviterUser.user?.email) {
            inviterName = inviterUser.user.email.split("@")[0];
          }
          
          if (inviterUser.user?.email) {
            inviterEmail = inviterUser.user.email;
          }
          
          console.log("[PROCESS] Resolved inviter details:", { inviterName, inviterEmail });
        } else {
          console.log("[PROCESS] No inviter details found, using defaults");
        }
      } catch (error) {
        console.warn("[PROCESS] Error fetching inviter details:", error);
        // Continue with default inviter name
      }
    }
    
    // Generate invitation link
    const inviteLink = `${appUrl}/teams/join?token=${invitation_id}`;
    console.log("[PROCESS] Generated invite link:", inviteLink);
    
    // Send email
    try {
      await sendInvitationEmail({
        to: email,
        teamName: team_name,
        inviteeName: email.split("@")[0],
        inviterName,
        inviterEmail,
        inviteLink,
      });
      
      console.log(`[PROCESS] Invitation email sent to ${email} for team ${team_name}`);
    } catch (emailError) {
      console.error("[PROCESS] Failed to send invitation email:", emailError);
      throw emailError;
    }
    
    return true;
  } catch (error) {
    console.error("[PROCESS] Error processing invitation payload:", error);
    throw error;
  }
}

// Send invitation email
async function sendInvitationEmail({
  to,
  teamName,
  inviteeName,
  inviterName,
  inviterEmail,
  inviteLink,
}: {
  to: string;
  teamName: string;
  inviteeName: string;
  inviterName: string;
  inviterEmail: string;
  inviteLink: string;
}) {
  try {
    console.log(`[EMAIL] Preparing to send email to ${to}`);
    
    // Validate SMTP URL
    if (!smtpUrl) {
      throw new Error("SMTP_URL environment variable is not set");
    }
    
    console.log(`[EMAIL] SMTP URL length: ${smtpUrl.length}`);
    
    // HTML email template
    const htmlBody = `
<html>
  <body style="font-family: sans-serif; line-height:1.6; color:#333;">
    <h2>Hello ${inviteeName},</h2>
    <p>${inviterName} has invited you to join the team <strong>${teamName}</strong> on DecisionGuide.AI.</p>
    <p style="text-align:center; margin:40px 0;">
      <a href="${inviteLink}"
         style="background:#6366F1; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; display:inline-block;">
        Accept Your Invitation
      </a>
    </p>
    <p>If the button above doesn't work, copy and paste this URL into your browser:</p>
    <p style="word-break:break-all;"><a href="${inviteLink}">${inviteLink}</a></p>
    <hr style="margin:40px 0; border:none; border-top:1px #eee solid;" />
    <footer style="font-size:12px; color:#888;">
      DecisionGuide.AI · <a href="https://decisionguide.ai/decision">Make better decisions together</a>
    </footer>
  </body>
</html>
    `;

    // Plain text fallback
    const textBody = `
Hello ${inviteeName},

${inviterName} has invited you to join the team "${teamName}" on DecisionGuide.AI.

Accept your invitation:
${inviteLink}

Or paste the URL into your browser.

— The DecisionGuide.AI Team
    `;

    // Create SMTP transporter
    console.log("[EMAIL] Creating nodemailer transporter with parsed options");
    const smtpOptions = parseSmtpUrl(smtpUrl);
    console.log("[EMAIL] Parsed SMTP options:", {
      host: smtpOptions.host,
      port: smtpOptions.port,
      secure: smtpOptions.secure,
      hasAuth: !!smtpOptions.auth
    });
    
    const transporter = nodemailer.createTransport(smtpOptions);

    // Verify SMTP connection
    try {
      console.log("[EMAIL] Verifying SMTP connection");
      await transporter.verify();
      console.log("[EMAIL] SMTP connection verified successfully");
    } catch (verifyError) {
      console.error("[EMAIL] SMTP connection verification failed:", verifyError);
      throw new Error(`SMTP connection verification failed: ${verifyError.message}`);
    }

    // Send email
    console.log("[EMAIL] Sending email with the following details:", {
      from: `"DecisionGuide.AI" <${fromEmail}>`,
      to: to,
      subject: `You're invited to join "${teamName}" on DecisionGuide.AI`,
      textLength: textBody.length,
      htmlLength: htmlBody.length
    });
    
    const info = await transporter.sendMail({
      from: `"DecisionGuide.AI" <${fromEmail}>`,
      to: to,
      subject: `You're invited to join "${teamName}" on DecisionGuide.AI`,
      html: htmlBody,
      text: textBody
    });
    
    console.log(`[EMAIL] Email sent successfully:`, {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected
    });
    
    return info;
  } catch (error) {
    console.error("[EMAIL] Error sending email:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      command: error.command
    });
    throw error;
  }
}

// Helper function to parse SMTP URL into options object
function parseSmtpUrl(url: string): any {
  try {
    console.log("[SMTP] Parsing SMTP URL");
    
    // Parse URL
    const match = url.match(/^smtps?:\/\/(?:([^:]+):([^@]+)@)?([^:]+)(?::(\d+))?$/i);
    
    if (!match) {
      throw new Error("Invalid SMTP URL format");
    }
    
    const [, user, pass, host, portStr] = match;
    const port = portStr ? parseInt(portStr, 10) : (url.startsWith('smtps://') ? 465 : 587);
    const secure = port === 465;
    
    const options: any = {
      host,
      port,
      secure
    };
    
    // Add auth if credentials are provided
    if (user && pass) {
      options.auth = {
        user,
        pass
      };
    }
    
    console.log("[SMTP] Successfully parsed SMTP URL:", {
      host,
      port,
      secure,
      hasAuth: !!(user && pass)
    });
    
    return options;
  } catch (error) {
    console.error("[SMTP] Error parsing SMTP URL:", error);
    throw new Error(`Failed to parse SMTP URL: ${error.message}`);
  }
}