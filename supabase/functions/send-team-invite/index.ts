// Supabase Edge Function to send team invitation emails
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import nodemailer from "npm:nodemailer@6.9.9";
import { SMTPTransport } from "npm:nodemailer@6.9.9/lib/smtp-transport";
import { SMTPTransport } from "npm:nodemailer@6.9.9/lib/smtp-transport";

// Environment variables are automatically available
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const smtpUrl = Deno.env.get("SMTP_URL") || "";
const fromEmail = Deno.env.get("FROM_EMAIL") || "hello@decisionguide.ai";
const appUrl = Deno.env.get("APP_URL") || "https://decisionguide.ai";

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parse SMTP URL and create transporter
let transporter: nodemailer.Transporter;

try {
  console.log("Setting up SMTP transporter with URL:", smtpUrl.replace(/:[^:]*@/, ":***@"));
  
  // Parse SMTP URL manually to handle potential issues
  const smtpConfig = parseSmtpUrl(smtpUrl);
  transporter = nodemailer.createTransport(smtpConfig);
  
  console.log("SMTP transporter created successfully");
} catch (error) {
  console.error("Failed to create SMTP transporter:", error);
}

// Function to parse SMTP URL into config object
function parseSmtpUrl(url: string): SMTPTransport.Options {
  try {
    if (!url || url.trim() === "") {
      throw new Error("SMTP_URL is empty or not provided");
    }
    
    // Parse URL parts
    const match = url.match(/^smtps?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/);
    if (!match) {
      throw new Error("Invalid SMTP URL format");
    }
    
    const [_, user, pass, host, port] = match;
    
    return {
      host,
      port: parseInt(port, 10),
      secure: url.startsWith("smtps://"),
      auth: {
        user,
        pass
      },
      debug: true,
      logger: true
    };
  } catch (error) {
    console.error("Error parsing SMTP URL:", error);
    throw error;
  }
}

// Parse SMTP URL and create transporter
let transporter: nodemailer.Transporter;

try {
  console.log("Setting up SMTP transporter with URL:", smtpUrl.replace(/:[^:]*@/, ":***@"));
  
  // Parse SMTP URL manually to handle potential issues
  const smtpConfig = parseSmtpUrl(smtpUrl);
  transporter = nodemailer.createTransport(smtpConfig);
  
  console.log("SMTP transporter created successfully");
} catch (error) {
  console.error("Failed to create SMTP transporter:", error);
}

// Function to parse SMTP URL into config object
function parseSmtpUrl(url: string): SMTPTransport.Options {
  try {
    if (!url || url.trim() === "") {
      throw new Error("SMTP_URL is empty or not provided");
    }
    
    // Parse URL parts
    const match = url.match(/^smtps?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/);
    if (!match) {
      throw new Error("Invalid SMTP URL format");
    }
    
    const [_, user, pass, host, port] = match;
    
    return {
      host,
      port: parseInt(port, 10),
      secure: url.startsWith("smtps://"),
      auth: {
        user,
        pass
      },
      debug: true,
      logger: true
    };
  } catch (error) {
    console.error("Error parsing SMTP URL:", error);
    throw error;
  }
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Handle HTTP requests
Deno.serve(async (req) => {
  console.log(`[${new Date().toISOString()}] Request received: ${req.method} ${req.url}`);
  
  console.log(`[${new Date().toISOString()}] Request received: ${req.method} ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    console.log("Handling CORS preflight request");
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  // Handle health check
  const url = new URL(req.url);
  if (url.pathname.endsWith('/health')) {
    console.log("Health check requested");
    try {
      // Verify SMTP connection
      await transporter.verify();
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "SMTP connection successful",
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (error) {
      console.error("SMTP connection failed:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "SMTP connection failed",
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
  }

  // Handle health check
  const url = new URL(req.url);
  if (url.pathname.endsWith('/health')) {
    console.log("Health check requested");
    try {
      // Verify SMTP connection
      await transporter.verify();
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "SMTP connection successful",
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (error) {
      console.error("SMTP connection failed:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "SMTP connection failed",
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
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
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey && supabaseServiceKey.length > 20,
      hasSmtpUrl: !!smtpUrl,
      smtpUrlLength: smtpUrl?.length || 0,
      smtpUrlLength: smtpUrl?.length || 0,
      hasFromEmail: !!fromEmail,
      hasAppUrl: !!appUrl,
      timestamp: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

    // Parse request body if this is a direct HTTP request
    if (req.method === "POST") {
      const body = await req.json();
      console.log("Received direct request payload:", JSON.stringify(body));
      
      // Process the invitation
      await processInvitationPayload(body);
      
      return new Response(
        JSON.stringify({ success: true }),
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
    console.error("Error in edge function:", error.message, error.stack);
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
async function processInvitationPayload(payload: any) {
  try {
    const { invitation_id, email, team_id, team_name, inviter_id } = payload;
    
    if (!email || !team_id || !team_name) {
      throw new Error("Missing required fields");
    }
    
    console.log("Processing invitation payload:", {
      invitation_id: invitation_id || "Not provided",
      email: email,
      team_id: team_id,
      team_name: team_name,
      inviter_id: inviter_id || "Not provided"
    });
    
    // Log invitation status
    console.log("Processing invitation payload:", {
      invitation_id: invitation_id || "Not provided",
      email: email,
      team_id: team_id,
      team_name: team_name,
      inviter_id: inviter_id || "Not provided"
    });
    
    // Log invitation status
    await supabase.rpc('track_invitation_status', {
      invitation_uuid: invitation_id,
      status_value: 'processing',
      details_json: { payload }
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
        console.warn("Error fetching inviter details:", error.message, error.stack);
        // Continue with default inviter name
      }
    }
    
    // Generate invitation link
    const inviteLink = `${appUrl}/teams/join?token=${invitation_id}`;
    
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
      status_value: 'email_sent',
      details_json: { email, team_name, timestamp: new Date().toISOString() }
    });
    
    // Log success
    await supabase.rpc('track_invitation_status', {
      invitation_uuid: invitation_id,
      status_value: 'email_sent',
      details_json: { email, team_name, timestamp: new Date().toISOString() }
    });
    
    console.log(`Invitation email sent to ${email} for team ${team_name}`);
    return true;
  } catch (error) {
    // Log failure
    await supabase.rpc('track_invitation_status', {
      invitation_uuid: payload.invitation_id,
      status_value: 'email_failed',
      details_json: { error: error.message, stack: error.stack }
    });
    // Log failure
    await supabase.rpc('track_invitation_status', {
      invitation_uuid: payload.invitation_id,
      status_value: 'email_failed',
      details_json: { error: error.message, stack: error.stack }
    });
    console.error("Error processing invitation payload:", error);
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
    console.log(`Preparing to send email to ${to} with link ${inviteLink}`);
    
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

    console.log("Verifying SMTP connection...");
    try {
      await transporter.verify();
      console.log("SMTP connection verified successfully");
    } catch (verifyError) {
      console.error("SMTP connection verification failed:", verifyError);
      throw verifyError;
    }

    // Verify SMTP connection
    console.log("Verifying SMTP connection...");
    try {
      await transporter.verify();
      console.log("SMTP connection verified successfully");
    } catch (verifyError) {
      console.error("SMTP connection verification failed:", verifyError);
      throw verifyError;
    }

    console.log("Sending email with the following details:", {
      from: `"DecisionGuide.AI" <${fromEmail}>`,
      to: to,
      subject: `You're invited to join "${teamName}" on DecisionGuide.AI`
    });
    
    let info;
    try {
      info = await transporter.sendMail({
        from: `"DecisionGuide.AI" <${fromEmail}>`,
        to: to,
        subject: `You're invited to join "${teamName}" on DecisionGuide.AI`,
        html: htmlBody,
        text: textBody
      });
    } catch (sendError) {
      console.error("Error sending email:", sendError);
      throw sendError;
    }
    
    console.log(`Email sent successfully to ${to}:`, info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error.message, error.stack);
    throw error;
  }
}