// Supabase Edge Function to send team invitation emails
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import nodemailer from "npm:nodemailer@6.9.9";

// Environment variables are automatically available
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const smtpUrl = Deno.env.get("SMTP_URL") || "";
const fromEmail = Deno.env.get("FROM_EMAIL") || "hello@decisionguide.ai";
const appUrl = Deno.env.get("APP_URL") || "https://decisionguide.ai";

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create SMTP transporter
let transporter: any = null;

// Parse SMTP URL into config
function parseSmtpUrl(url: string): any {
  try {
    if (!url) {
      console.error("SMTP_URL environment variable is not set");
      return null;
    }
    
    // Parse the SMTP URL - handle both smtps:// and smtp:// protocols
    const match = url.match(/^smtps?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/i);
    if (!match) {
      console.error("Invalid SMTP_URL format");
      return null;
    }
    
    const [, user, pass, host, port] = match;
    const portNum = parseInt(port, 10);
    
    return {
      host,
      port: portNum,
      secure: portNum === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    };
  } catch (error) {
    console.error("Error parsing SMTP URL:", error);
    return null;
  }
}

// Initialize SMTP transporter
try {
  console.log("Initializing SMTP transporter with URL:", smtpUrl ? `${smtpUrl.substring(0, 20)}...` : "undefined");
  const smtpConfig = parseSmtpUrl(smtpUrl);
  if (smtpConfig) {
    console.log("SMTP config parsed:", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
    });
    transporter = nodemailer.createTransport(smtpConfig);
    console.log("SMTP transporter created with config:", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: { user: smtpConfig.auth.user, pass: "***" }
    });
  } else {
    console.error("Failed to create SMTP transporter: Invalid configuration");
  }
} catch (error) {
  console.error("Error creating SMTP transporter:", error);
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Handle HTTP requests
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }
  
  // Health check endpoint
  if (path.endsWith("/health")) {
    try {
      console.log("Health check requested");
      // Check if transporter is initialized
      if (!transporter) {
        console.log("Health check failed: SMTP transporter not initialized");
        return new Response(
          JSON.stringify({
            success: false,
            message: "SMTP transporter not initialized",
            error: "Missing or invalid SMTP configuration",
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          }
        );
      }
      
      // Verify SMTP connection
      try {
        console.log("Verifying SMTP connection...");
        await transporter.verify();
        console.log("SMTP connection verified successfully");
        
        return new Response(
          JSON.stringify({
            success: true,
            message: "SMTP connection successful",
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      } catch (smtpError) {
        console.error("SMTP verification failed:", smtpError);
        return new Response(
          JSON.stringify({
            success: false,
            message: "SMTP connection failed",
            error: smtpError.message,
            stack: smtpError.stack,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          }
        );
      }
    } catch (error) {
      console.error("Health check error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Health check failed",
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
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
    console.log("Edge Function started with environment:", {
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
      const body = await req.json();
      console.log("Received direct request:", JSON.stringify(body));
      
      // Process the invitation
      const result = await processInvitationPayload(body);
      
      return new Response(
        JSON.stringify({ 
          success: result.success, 
          message: result.message,
          details: result.details,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in edge function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Process invitation from payload
async function processInvitationPayload(payload: any): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const { invitation_id, email, team_id, team_name, inviter_id } = payload;
    
    if (!email || !team_id || !team_name) {
      return {
        success: false,
        message: "Missing required fields in payload",
        details: { payload }
      };
    }
    
    console.log("Processing invitation payload:", {
      invitation_id: invitation_id || "Not provided",
      email: email,
      team_id: team_id,
      team_name: team_name,
      inviter_id: inviter_id || "Not provided"
    });
    
    // Get inviter details if inviter_id is provided
    let inviterName = "A team admin";
    let inviterEmail = fromEmail;
    
    if (inviter_id) {
      try {        
        const { data: inviter, error: inviterError } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, id")
          .eq("id", inviter_id)
          .single();
          
        if (inviterError) throw inviterError;
        
        // Get inviter email
        const { data: inviterUser, error: inviterUserError } = await supabase
          .auth.admin.getUserById(inviter_id);
          
        if (inviterUserError) throw inviterUserError;
        
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
        }
      } catch (error) {
        console.warn("Error fetching inviter details:", error);
        // Continue with default inviter name
      }
    }
    
    // Generate invitation link
    const inviteLink = `${appUrl}/teams/join?token=${invitation_id}`;
    
    try {
      // Log the invitation attempt
      await supabase.rpc('track_invitation_status', {
        invitation_uuid: invitation_id,
        status_value: 'sending',
        details_json: { team_id, team_name, inviter_id }
      });
      
      // Send email
      await sendInvitationEmail({
        to: email,
        teamName: team_name,
        inviteeName: email.split("@")[0],
        inviterName,
        inviterEmail,
        inviteLink,
      });
      
      // Log success
      await supabase.rpc('track_invitation_status', {
        invitation_uuid: invitation_id,
        status_value: 'sent',
        details_json: { timestamp: new Date().toISOString() }
      });
      
      return { success: true, message: `Invitation email sent to ${email} for team ${team_name}` };
    } catch (error) {
      // Log failure
      await supabase.rpc('track_invitation_status', {
        invitation_uuid: invitation_id,
        status_value: 'failed',
        details_json: { 
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      });
      
      throw error;
    }
    
  } catch (error) {
    console.error("Error processing invitation payload:", error);
    return {
      success: false,
      message: "Failed to process invitation",
      details: {
        error: error.message,
        stack: error.stack
      }
    };
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
}): Promise<any> {
  try {
    console.log(`Sending email to ${to} with link ${inviteLink}`);
    
    if (!transporter) {
      throw new Error("SMTP transporter not initialized");
    }
    
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

    // Verify SMTP connection
    try {
      console.log("Verifying SMTP connection before sending email...");
      await transporter.verify();
      console.log("SMTP connection verified successfully");
    } catch (verifyError) {
      console.error("SMTP verification failed:", verifyError);
      throw new Error(`SMTP verification failed: ${verifyError.message}`);
    }

    // Send email
    console.log(`Sending email to ${to}...`);
    const info = await transporter.sendMail({
      from: `"DecisionGuide.AI" <${fromEmail}>`,
      to: to,
      subject: `You're invited to join "${teamName}" on DecisionGuide.AI`,
      html: htmlBody,
      text: textBody
    });
    
    console.log(`Email sent successfully to ${to}:`, info.messageId);
    console.log("Email sending response:", info);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error(`Email sending failed: ${error.message}`);
  }
}